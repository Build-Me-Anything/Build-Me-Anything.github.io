# Renting a GPU for one rung

The laptop's 6 GB card stops at 256³ in double precision. The open question in the programme — whether NS-003's
resolution exponent keeps falling below N^0.60 — needs a fourth rung, and a fourth rung needs more memory than
this machine has. Renting one for an afternoon costs about the same as lunch.

## What it costs, and why

Memory scales with the grid. Measured: 256³ uses **5.98 GB**, which is ~358 bytes per point.

| Grid | float64 | float32 | Card needed (fp64) |
|---|---|---|---|
| 384³ | 20 GB | 10 GB | anything with 24 GB+ |
| 512³ | **48 GB** | 24 GB | **80 GB card** — A100 80GB or H100 |
| 640³ | 94 GB | 47 GB | H100 80GB only in fp32 |

Time scales roughly as N⁴ — N³ points, and more steps because the CFL limit tightens. From the measured 1.68 h
at 256³ on the laptop, and an A100's ~2 039 GB/s against the laptop's ~336 GB/s (this solver is bandwidth-bound,
so bandwidth is the right ratio):

| Run | Work vs 256³ | Estimated wall time on an A100 80GB | Cost at ~$1.50/h |
|---|---|---|---|
| 384³ float64 | 5× | ~1.5 h | **~$3** |
| **512³ float64** | 16× | **~5 h** | **~$8–12** |

Add an hour of fumbling and it is still under $20. **Do not rent a consumer card (4090, 5090) for float64
work** — NVIDIA runs FP64 at 1/64 rate on those, so they are 5–10× slower than an A100 despite looking cheaper.
For float32 exploration they are excellent value.

## Which provider

| | |
|---|---|
| **RunPod** | Easiest. Pick an A100 80GB or H100 in Secure Cloud, attach a **persistent volume** mounted at `/workspace`, use any PyTorch/CUDA 12 template, connect by SSH or the web terminal. |
| **Vast.ai** | Cheapest, a marketplace of other people's machines. Filter on ≥ 80 GB VRAM and reliability > 99 %. Interruptible instances are fine here — see below. |
| **Lambda Labs** | Clean and predictable, on-demand A100/H100, often capacity-constrained. |

**Interruptible / spot instances are safe for this**, and roughly half price, because the runner checkpoints
every 2 time units and resumes automatically from `checkpoint.npz`. The one condition: put `--out` on a
**persistent volume**, or a reclaimed instance takes the checkpoint with it. `/workspace` on RunPod is
persistent; the container filesystem is not.

## Doing it

1. Start the instance. A100 80GB (or H100), CUDA 12 image, persistent volume at `/workspace`.
2. Open a terminal on it and paste:

```bash
curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh | bash
```

   or upload `run-cloud.sh` and `bash run-cloud.sh`. Defaults to the 512³ Re 2000 tube run — NS-005.

3. The script installs CuPy, clones the repo, then does two things before spending real money:
   - **`--bench`**: prints device memory and seconds per step at that grid. If it will not fit, you find out in
     thirty seconds rather than three hours.
   - **a parity check**: 256³ Re 2000 tubes to t = 2, printed next to the archived `run.log` line for the same
     case. E, Z, ε and max|ω| should agree to round-off. A rented card is an unfamiliar instrument; grade it
     before trusting it, exactly as every run is graded.
4. It then launches the real run detached under `nohup`. Watch with `tail -f`.
5. When it finishes, pull back the small files — **not** the checkpoint, which is ~3 GB at 512³:

```bash
tar czf nslab-N512.tgz -C /workspace/runs/tubes-Re2000-N512-gpu final.json run.log slices
```

   Then `scp` it down, drop the folder into `research/nslab/`, and run `node analyse.js <folder>` and
   `node outreach/blog/figures.js` — the ladder tables and every chart pick it up automatically.

## What to run, in order

1. **384³ float64, Re 2000 tubes** (~$3). Cheap, and it is a real fourth rung in its own right.
2. **512³ float64, Re 2000 tubes** (~$10). The one that answers the question: does the peak exponent keep
   falling below 0.60, or flatten?
3. Only if those are interesting: **512³ float64 Taylor–Green Re 1600** (~$10), which would put NS-001 directly
   against van Rees et al.'s 512³ reference instead of comparing a 256³ run to their published number.

## What this buys before buying hardware

If the exponent keeps falling, the programme has somewhere to go and a £2,700 machine is justified by a result
you already have in hand. If it flattens — that is a *converged pointwise maximum*, the first in the programme,
and worth far more than the hardware. Either answer is worth $10 and an afternoon.
