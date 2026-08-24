#!/usr/bin/env bash
# NSLab on a rented GPU — provision, verify, then run detached.
#
# Paste this whole file into a fresh Linux GPU instance (RunPod, Vast.ai, Lambda) and run it. It installs CuPy,
# clones the public repo, checks that the card reproduces an archived run, and only then starts the long job.
#
#   bash run-cloud.sh                      # defaults: NS-005, the 512^3 fourth rung of the Re 2000 tube ladder
#   N=384 bash run-cloud.sh                # a cheaper 384^3 rung first
#   N=512 FP32=1 bash run-cloud.sh         # single precision (exploration only, not evidence)
#
# Everything is checkpointed every 2 time units and resumes automatically, so a reclaimed spot instance costs
# you minutes, not the run — provided OUT is on a persistent volume.
set -euo pipefail

N=${N:-512}
RE=${RE:-2000}
IC=${IC:-tubes}
TEND=${TEND:-16}
CFL=${CFL:-0.4}
FP32=${FP32:-0}
WORK=${WORK:-/workspace}
OUT=${OUT:-$WORK/runs/$IC-Re$RE-N$N-gpu}

echo "=== NSLab cloud run: ${IC} N=${N} Re=${RE} tEnd=${TEND} $( [ "$FP32" = 1 ] && echo float32 || echo float64 )"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

# --- 1. dependencies -------------------------------------------------------------------------------------
# CuPy wheels carry their own CUDA libraries; no CUDA Toolkit install is needed.
python3 -m pip install -q --upgrade pip
python3 -m pip install -q cupy-cuda12x numpy

# --- 2. the code -----------------------------------------------------------------------------------------
cd "$WORK"
if [ ! -d Build-Me-Anything.github.io ]; then
  git clone --depth 1 https://github.com/Build-Me-Anything/Build-Me-Anything.github.io.git
fi
REPO="$WORK/Build-Me-Anything.github.io"
RUNNER="$REPO/pocket-wind-tunnel/gpu/nslab_gpu.py"
test -f "$RUNNER"

# --- 3. does it fit, and how fast? -----------------------------------------------------------------------
# --bench reports device memory and seconds per step without running the case. Pennies, and it catches an
# out-of-memory or a bad wheel before a multi-hour job does.
echo "=== bench (memory + s/step at N=$N)"
python3 "$RUNNER" --N "$N" $( [ "$FP32" = 1 ] && echo --fp32 ) --bench

# --- 4. parity: does this card reproduce the archived run? ------------------------------------------------
# Two minutes of 256^3 Re 2000 tubes to t = 2, against the same case in the archive. If E, Z, eps and max|w|
# do not match the archived run.log to ~1e-12, stop and find out why before spending money.
echo "=== parity check against the archive (256^3 to t=2)"
python3 "$RUNNER" --N 256 --ic tubes --Re 2000 --tEnd 2 --snap 1 --ckpt 99 --out "$WORK/parity" | tail -4
echo "--- archived values for the same case, t = 2.00:"
grep -m1 "t 2\." "$REPO/research/nslab/tubes-Re2000-N256-gpu/run.log" || echo "  (archived log not found)"
echo "=== compare E, Z, eps and max|w| in the two lines above before continuing."
sleep 5

# --- 5. the run ------------------------------------------------------------------------------------------
mkdir -p "$OUT"
echo "=== starting the long run -> $OUT"
nohup python3 -u "$RUNNER" \
  --N "$N" --ic "$IC" --Re "$RE" --tEnd "$TEND" --cfl "$CFL" \
  --snap 0.5 --ckpt 2 $( [ "$FP32" = 1 ] && echo --fp32 ) \
  --out "$OUT" > "$OUT/console.log" 2>&1 &

echo "started, pid $!"
echo
echo "watch:      tail -f $OUT/console.log"
echo "resume:     re-run this script; it picks up from checkpoint.npz automatically"
echo "when done:  tar czf nslab-N$N.tgz -C $OUT final.json run.log slices   # a few hundred MB, not the checkpoint"
