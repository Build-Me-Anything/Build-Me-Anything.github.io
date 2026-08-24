#!/usr/bin/env bash
# NSLab on a rented GPU — provision, grade the card, then run detached.
#
# Paste this whole file into a fresh Linux GPU instance (RunPod, Vast.ai, Lambda) and run it. It installs CuPy,
# clones the public repo, checks that the card reproduces an archived run to round-off, and only then starts the
# long job. Nothing here is interactive; every gate either passes or stops the script.
#
#   bash run-cloud.sh                      # default: 288^3 float64, Re 2000 tubes - see cloud/README.md for why
#   N=320 bash run-cloud.sh                # the other rung of the flattening, in double precision
#   N=384 bash run-cloud.sh                # a genuine fourth fp64 rung above it
#   N=512 bash run-cloud.sh                # NS-005, only if 384^3 moves (needs an 80 GB card)
#   N=512 FP32=1 bash run-cloud.sh         # single precision (exploration only, not evidence)
#   SKIP_PARITY=1 bash run-cloud.sh        # resuming on a card already graded — skip the 4-minute check
#   BENCH_ONLY=1 bash run-cloud.sh         # memory + s/step only, then stop (pennies; run this first)
#
# Everything is checkpointed every 2 time units and resumes automatically, so a reclaimed spot instance costs
# you minutes, not the run — provided OUT is on a persistent volume.
set -euo pipefail

N=${N:-288}
RE=${RE:-2000}
IC=${IC:-tubes}
TEND=${TEND:-16}
CFL=${CFL:-0.4}
FP32=${FP32:-0}
WORK=${WORK:-/workspace}
OUT=${OUT:-$WORK/runs/$IC-Re$RE-N$N-gpu}
SKIP_PARITY=${SKIP_PARITY:-0}
BENCH_ONLY=${BENCH_ONLY:-0}
PREC=$( [ "$FP32" = 1 ] && echo float32 || echo float64 )
FP32FLAG=$( [ "$FP32" = 1 ] && echo --fp32 || echo )

echo "=== NSLab cloud run: ${IC} N=${N} Re=${RE} tEnd=${TEND} ${PREC}"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
nvidia-smi --query-gpu=ecc.errors.uncorrected.volatile.total --format=csv,noheader || true

# --- 0. will it fit, on the card and on the disk? ---------------------------------------------------------
# Spectral state is three complex arrays of N x N x (N/2+1). float64 => 16 B per component, float32 => 8 B.
# Device memory needs several of those live at once (RK4 stages + the nonlinear term); the measured 256^3 fp64
# figure is 5.98 GB, i.e. ~358 B per grid point, and that is the number to scale by. Disk needs the checkpoint
# twice over, because it is written to <name>.tmp.npz and then renamed over the old one.
BPP=$( [ "$FP32" = 1 ] && echo 179 || echo 358 )
NEED_GB=$(python3 -c "print(f'{$BPP*$N**3/1e9:.1f}')")
CKPT_GB=$(python3 -c "print(f'{3*(16 if $FP32==0 else 8)*$N*$N*($N//2+1)/1e9:.1f}')")
DISK_GB=$(python3 -c "print(f'{3*float($CKPT_GB):.1f}')")
HAVE_GB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | awk '{print $1/1024}')
mkdir -p "$OUT"
FREE_GB=$(df -B1G --output=avail "$OUT" | tail -1 | tr -d ' ')
echo "=== budget: needs ~${NEED_GB} GB of the card's ${HAVE_GB} GB; checkpoint ${CKPT_GB} GB, so ~${DISK_GB} GB of disk (have ${FREE_GB} GB free at $OUT)"
python3 -c "import sys; sys.exit(0 if $NEED_GB < 0.92*$HAVE_GB else 1)" || {
  echo "STOP: ${NEED_GB} GB will not fit on a ${HAVE_GB} GB card. Rent a bigger one, drop N, or set FP32=1 (exploration grade)."; exit 1; }
python3 -c "import sys; sys.exit(0 if $FREE_GB > $DISK_GB else 1)" || {
  echo "STOP: only ${FREE_GB} GB free at $OUT but the checkpoint cycle needs ~${DISK_GB} GB."
  echo "      Attach a bigger persistent volume, or point OUT at one. A checkpoint on the container filesystem"
  echo "      is lost with the instance, which defeats the whole reason spot pricing is safe here."; exit 1; }
case "$OUT" in /workspace/*) ;; *) echo "WARNING: $OUT is not under /workspace — on RunPod only /workspace survives a reclaim.";; esac

# --- 1. dependencies -------------------------------------------------------------------------------------
# CuPy wheels carry their own CUDA libraries; no CUDA Toolkit install is needed, and the base image does not have
# to be a CUDA image at all. It does need Python, which the lean Ubuntu bases may not carry - so check, do not
# assume, and install it if it is missing.
if ! command -v python3 >/dev/null 2>&1; then
  echo "=== no python3 in this image - installing it"
  (apt-get update -qq && apt-get install -y -qq python3 python3-pip python3-venv curl git) || {
    echo "STOP: could not install python3. Use a RunPod PyTorch template instead of a bare base image."; exit 1; }
fi
echo "=== installing CuPy"
# The [ctk] extra is not optional on a non-CUDA base image. CuPy JIT-compiles its elementwise kernels at first
# use and needs the CUDA headers to do it; without them the very first array expression dies with "Failed to find
# CUDA headers". The CUDA *runtime* comes with the wheel, the headers do not. Observed on runpod/base:1.0.2 with
# CuPy 14.2.0, and caught by the bench gate before it could waste an hour.
PIPFLAGS=""
python3 -m pip install -q --upgrade pip 2>/dev/null || PIPFLAGS="--break-system-packages"
python3 -m pip install -q $PIPFLAGS "cupy-cuda12x[ctk]" numpy
python3 -c "import cupy; print('cupy', cupy.__version__, '| runtime CUDA', cupy.cuda.runtime.runtimeGetVersion())"

# --- 2. the code -----------------------------------------------------------------------------------------
cd "$WORK"
if [ ! -d Build-Me-Anything.github.io ]; then
  git clone --depth 1 https://github.com/Build-Me-Anything/Build-Me-Anything.github.io.git
fi
REPO="$WORK/Build-Me-Anything.github.io"
RUNNER="$REPO/pocket-wind-tunnel/gpu/nslab_gpu.py"
test -f "$RUNNER"
echo "=== runner: $(grep -m1 "^VERSION" "$RUNNER")"

# --- 3. does it fit, and how fast? -----------------------------------------------------------------------
# --bench reports device memory and seconds per step without running the case. Pennies, and it catches an
# out-of-memory or a bad wheel before a multi-hour job does.
echo "=== bench (memory + s/step at N=$N)"
python3 "$RUNNER" --N "$N" --ic "$IC" --Re "$RE" --tEnd "$TEND" --cfl "$CFL" $FP32FLAG --bench
if [ "$BENCH_ONLY" = 1 ]; then
  echo "=== BENCH_ONLY set - stopping before the parity check. Read the estimated hours above, then re-run without it."
  exit 0
fi

# --- 4. parity: does this card reproduce the archive? -----------------------------------------------------
# 256^3 Re 2000 tubes to t = 2 against the same case in the archive, compared by number and not by eye: E, Z,
# eps, max|w| and the spectral production must track to round-off. A rented card is an unfamiliar instrument;
# grade it before trusting it, exactly as every run in this programme is graded. ~4 minutes on an A100.
if [ "$SKIP_PARITY" = 1 ]; then
  echo "=== parity check skipped (SKIP_PARITY=1)"
else
  echo "=== parity check against the archive (256^3 Re 2000 fp64 to t=2)"
  rm -rf "$WORK/parity"
  python3 "$RUNNER" --N 256 --ic tubes --Re 2000 --tEnd 2 --snap 1 --ckpt 99 --out "$WORK/parity" | tail -3
  python3 "$REPO/cloud/parity-check.py" "$WORK/parity/final.json" "$REPO/research/nslab/tubes-Re2000-N256-gpu/final.json"
fi

# --- 5. the run ------------------------------------------------------------------------------------------
echo "=== starting the long run -> $OUT"
nohup python3 -u "$RUNNER" \
  --N "$N" --ic "$IC" --Re "$RE" --tEnd "$TEND" --cfl "$CFL" \
  --snap 0.5 --ckpt 2 $FP32FLAG \
  --out "$OUT" > "$OUT/console.log" 2>&1 &

echo "started, pid $!"
echo
echo "watch:      tail -f $OUT/console.log"
echo "progress:   grep -c '^\[' $OUT/run.log      # one line per snapshot; ETA is on each line"
echo "resume:     SKIP_PARITY=1 bash run-cloud.sh   # picks up from checkpoint.npz automatically"
echo "when done:  tar czf /workspace/nslab-N$N.tgz -C $OUT final.json run.log slices   # not the ${CKPT_GB} GB checkpoint"
echo "            then from the laptop:  runpodctl receive <code>   (after 'runpodctl send' on the pod)"
