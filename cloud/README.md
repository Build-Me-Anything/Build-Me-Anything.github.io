# Renting a GPU for one rung

The laptop's 6 GB card stops at 256³ in double precision. Everything above it in this programme — the 288³ and
320³ rungs where the Re 2000 peak flattened, the 384³ and 512³ rungs nobody has run — exists only in float32,
which is exploration grade and not evidence. Renting a card that can do those in float64 costs about the same
as lunch.

## What it costs, and why

Memory scales with the grid. Measured: 256³ float64 uses **5.98 GB**, which is ~358 bytes per point.

| Grid | float64 | float32 | Card needed (fp64) |
|---|---|---|---|
| 288³ | 8.6 GB | 4.3 GB | anything with 16 GB+ |
| 320³ | 11.7 GB | 5.9 GB | anything with 16 GB+ |
| 384³ | 20 GB | 10 GB | anything with 24 GB+ |
| 512³ | **48 GB** | 24 GB | **80 GB card** — A100 80GB or H100 |
| 640³ | 94 GB | 47 GB | H100 80GB only in fp32 |

Time scales roughly as N⁴ — N³ points, and more steps because the CFL limit tightens. The anchor is measured:
**1.68 h for 256³ float64 to t = 16** on the laptop. This solver is bandwidth-bound, so scale by memory
bandwidth: an A100 80GB's ~2 039 GB/s against the laptop's ~336 GB/s is a factor of ~6.

| Run | Work vs 256³ | Estimated wall time on an A100 80GB | Cost at ~$1.90/h |
|---|---|---|---|
| 288³ float64 | 1.6× | ~0.45 h | ~$1 |
| 320³ float64 | 2.4× | ~0.7 h | ~$1.50 |
| 384³ float64 | 5× | ~1.4 h | ~$3 |
| **512³ float64** | 16× | **~4.5 h** | **~$9** |

Add an hour of fumbling and the whole ladder is still under $20. **Do not rent a consumer card (4090, 5090)
for float64 work** — NVIDIA runs FP64 at 1/64 rate on GeForce silicon and 1/32 on most workstation Ampere, so
they are 5–10× slower than an A100 despite looking cheaper. For float32 exploration they are excellent value,
but so is the laptop.

## Which provider

| | |
|---|---|
| **RunPod** | Easiest, and what the scripts here drive. A100 80GB or H100 in Secure Cloud, a **network volume** mounted at `/workspace`, any PyTorch/CUDA 12 template, SSH or the web terminal. |
| **Vast.ai** | Cheapest, a marketplace of other people's machines. Filter on ≥ 80 GB VRAM and reliability > 99 %. |
| **Lambda Labs** | Clean and predictable, on-demand A100/H100, often capacity-constrained. |

**Interruptible / spot instances are safe for this**, and roughly half price, because the runner checkpoints
every 2 time units and resumes automatically from `checkpoint.npz`. The one condition: put `--out` on a
**network volume**, not a pod-local one and not the container filesystem. A network volume outlives the pod
entirely, so a reclaim — or a pod you terminated yourself — keeps every checkpoint. At 512³ float64 that
checkpoint is 3.2 GB and it is written to a temporary file and renamed, so budget ~10 GB of volume for it.

## Setting up RunPod

One API key unlocks everything (`runpodctl`, `flash`, and the RunPod MCP server, which takes the same key as a
bearer token). Getting it is the one step that cannot be automated — it needs a browser login.

1. **The key.** Sign in at <https://console.runpod.io/user/settings> → *API Keys* → create one with read/write.
2. **The CLI.** `runpodctl` is a single binary, no installer:

   ```bash
   curl -sSL https://cli.runpod.net | bash            # macOS / Linux
   ```

   On Windows, download `runpodctl-windows-amd64.exe` from the
   [releases page](https://github.com/runpod/runpodctl/releases/latest), verify it against the release's
   `checksums_*_sha256.txt`, and drop it on the PATH as `runpodctl.exe`. (This machine has v2.11.0 at
   `C:\Users\User\bin\runpodctl.exe`, checksum verified.)
3. **Wire the key in**, once, non-interactively — this writes `~/.runpod/config.toml`, which every tool reads:

   ```bash
   runpodctl config --apiKey <your key>
   ```

   Check it: `runpodctl user` should print the account and its balance.

## Doing it

`provision-runpod.sh` is deliberately two-step — nothing is created until you pass `--go`, and the pod it creates
carries an auto-terminate time so a forgotten instance cannot run overnight.

```bash
bash cloud/provision-runpod.sh --survey        # what fp64 cards are free, where, and at what price
bash cloud/provision-runpod.sh                 # print the plan; creates nothing
GPU="NVIDIA A100 80GB PCIe" DC=<datacenter> HOURS=8 bash cloud/provision-runpod.sh --go
```

Then, on the pod:

```bash
N=288 bash <(curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh)
```

`run-cloud.sh` spends nothing until it has checked four things, in order, and stops on any of them:

1. **Does it fit** — device memory against the card, and disk against the checkpoint cycle (which needs the
   checkpoint twice over, because it is written to a temp file and renamed).
2. **`--bench`** — device memory and seconds per step at that grid, so the estimated hours are a measurement
   rather than the table above. `BENCH_ONLY=1` stops here, for pennies.
3. **Parity** — 256³ Re 2000 tubes to t = 2, compared *by number* against the archived run of the same case
   (`cloud/parity-check.py`): E, Z, ε, max|ω| and the spectral production must track to round-off, and the
   script exits non-zero if they do not. A rented card is an unfamiliar instrument; grade it before trusting
   it, exactly as every run in this programme is graded. ~4 minutes.
4. Only then does it launch the real run under `nohup`, checkpointing to the network volume.

Watch it with `tail -f`. Every log line carries its own ETA.

When it finishes, pull back the small files — **not** the checkpoint:

```bash
tar czf /workspace/nslab-N288.tgz -C /workspace/runs/tubes-Re2000-N288-gpu final.json run.log slices
runpodctl send /workspace/nslab-N288.tgz
```

and `runpodctl receive <code>` on the laptop. Drop the folder into `research/nslab/`, then
`node analyse.js <folder>`, `node ns004-scaling.js` and `node outreach/blog/figures.js` pick it up automatically.
Finally, **stop the meter**: `bash cloud/provision-runpod.sh --teardown <podId>`.

## What to run, in order

The order changed after NS-003b and NS-004. The 512³ run was originally meant to answer "does the peak exponent
keep falling below N^0.60?" — but the float32 ladder already answered it: 256³ → 288³ → 320³ gave 115.9 → 132.2
→ 132.7, a peak that flattened. That result is **exploration grade**. And 256³ — the laptop's float64 ceiling —
sits 15 % below that flattened value, so the highest rung this programme has in evidence grade is the one rung
that demonstrably has not converged. (Precision itself is not the issue: at 256³ the float32 and float64 runs of
this case agree to every printed digit. The issue is that the rungs above it exist only in float32.) So the first
job of a rented card is not to go higher; it is to redo the rungs that matter in double precision.

1. **288³ and 320³ float64, Re 2000 tubes** (~$2.50 together, ~1.2 h). Converts the programme's one observed
   flattening of a pointwise maximum from exploration grade to evidence grade. Cheapest and highest value.
2. **384³ float64, Re 2000 tubes** (~$3). A genuine fourth fp64 rung above the flattening — does it stay flat?
3. **512³ float64, Re 2000 tubes** (~$9). Worth doing only if 384³ moves. If it does, the flattening was an
   artefact of the fp32 ladder and this is the run that says so.
4. Separately, and only if the above are clean: **512³ float64 Taylor–Green Re 1600** (~$9), which would put
   NS-001 directly against van Rees et al.'s 512³ reference instead of comparing a 256³ run to their published
   number.

Everything above is Re 2000 tubes at `--tEnd 16 --cfl 0.4`, the same case as the archive, so each new rung drops
straight into the existing ladder.

## What this buys before buying hardware

If the flattening survives double precision and a fourth rung, the programme has its first converged pointwise
maximum in evidence grade — worth far more than the hardware. If it does not, the £2 700 machine in
`research/hardware/next-machine.md` is being justified by a number that was an artefact, and finding that out
costs $10 instead of £2 700. Either answer is worth an afternoon.
