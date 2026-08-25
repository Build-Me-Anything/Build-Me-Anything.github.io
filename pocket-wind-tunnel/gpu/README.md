# NSLab GPU runner (`nslab_gpu.py`)

A CuPy/cuFFT port of `src/nslab.js` for the research batch layer: same equations, discretisation, RK4, budgets,
diagnostics, health report and JSON output as the browser/Node solver, in **float64** by default. The single-file
app stays dependency-free; this runner lives outside it, where the evidence archive already lives.

## Install (once)

```bash
pip install cupy-cuda12x nvidia-cufft-cu12 nvidia-cuda-runtime-cu12 nvidia-cuda-nvrtc-cu12 nvidia-cublas-cu12 nvidia-curand-cu12 nvidia-cusolver-cu12 nvidia-cusparse-cu12 nvidia-nvjitlink-cu12
```

The NVIDIA driver must be CUDA-12 capable (610.62 here). `CUDA path could not be detected` at start-up is a benign
CuPy warning — the libraries come from the pip wheels. No CUDA Toolkit install is needed.

## Use

```bash
python gpu/nslab_gpu.py --N 192 --Re 1600 --tEnd 16 --out "../research/nslab/tgv-Re1600-N192-gpu"
python gpu/nslab_gpu.py --N 32 --Re 1600 --tEnd 2 --compare <cpu final.json>   # validate against the CPU solver
python gpu/nslab_gpu.py --N 256 --bench                                          # timing and device memory only
```

Options: `--ic tgv|tgv2d|abc|tubes|random`, `--icp key=val …` (e.g. `--icp amp=8 sigma=0.4 sep=0.7 pert=0.2`, `seed=1 k0=4 E0=0.5`),
`--cfl` (adaptive Δt, default 0.4), `--dt` (fixed), `--snap` (snapshot interval, default 0.5), `--ckpt` (checkpoint interval in
time units; the run resumes automatically from `checkpoint.npz` if present), `--fp32`, `--cpu` (NumPy fallback).

### Runner 0.1.3 (2026-08-25) — the health report stops grading roundoff

Found while auditing why the Re 2000 640³ float32 run reported `health FAIL` at every snapshot with `kmax·η 8.2` —
an extremely well-resolved number. Nothing was wrong with the flow. Two things were wrong with the report.

**1. Two rows were unpassable in float32, structurally.** `divergence L∞` (graded 1e-10 / 1e-6) and
`nonlinear energy transfer |T|/ε` (1e-9 / 1e-6) measure quantities that are **exactly zero in exact arithmetic** —
the divergence after projection, and the net energy transfer by a nonlinear term that conserves energy. They
therefore measure nothing but roundoff, and those thresholds are float64-calibrated. In float32 the floor is
`≈ ε·k_c·|u| ≈ 1.2e-7 · 213 · 0.3 ≈ 8e-6`, so no resolution can meet them. The archive shows it cleanly: every
float32 run fails exactly these two rows, every float64 run passes with nothing flagged.

They are now reported **`N/A` — roundoff-limited, ungraded** in float32. This is a refusal to grade a quantity the
arithmetic cannot deliver, not a loosened threshold: **the float64 limits are untouched and no float64 run changes
verdict.** A float32 PASS is consequently *weaker* than a float64 PASS — silent about those quantities rather than
clear on them — and `health.note` and the new `health.precision` field say so in every `final.json`.

**2. The cutoff pile-up guard was precision-blind.** `pileUp` already declined to grade when `E(0.8·k_c)` was
negligible, but the test was a fixed `1e-20 · peak`. `E` is quadratic in the field, so the spectral noise floor is
`~ε²`: 4.9e-32 in float64 (where 1e-20 was safely above it) but **1.4e-14 in float32**, six orders of magnitude
*above* the old guard. So in float32 the metric graded pure roundoff. Measured on the 640³ run: at t = 0.5,
`E(0.8·k_c)/peak` was 8.76e-20 — clearing the old guard by a factor of 8.8 on an absolute energy of 2.6e-21 — and
the metric duly reported **15.38**, the ratio of two noise values, which the worst-instant rule then carried as a
FAIL for the whole run.

The subtler half: from t = 1.5 it read **exactly 1.000** for eleven consecutive snapshots. That is not a resolved
spectrum either. It is the same noise, now decaying monotonically with k, so the band maximum sits at `k8` by
construction. **The reassuring reading was as empty as the alarming one** — the NS-005 lesson arriving from the
other direction — so the fix ungrades both rather than rescuing either.

The guard is now `100·ε²` of the working precision (float32 1.4e-12, float64 4.9e-30). Applied to the 640³ run it
suppresses t ≤ 5.0 and begins grading at t = 5.5, where `E(0.8·k_c)/peak` has risen to 1.9e-12 — real spectral
content reaching the cutoff band as the field roughens. On the archived float64 runs it changes **one** snapshot
verdict out of 66. The margin of 100 is a judgement call and the only tunable here; it is stated rather than fitted.

`src/nslab.js` (NSLab 0.1.2) carries the same guard expressed the same way. That instrument is always float64, so
its constant is fixed rather than derived — the form is kept identical so the two state one rule.

**This does not retroactively change a completed run.** `final.json` stores the verdict computed at the time, by
the runner version recorded beside it. Re-grading an archived run means recomputing from its snapshots.

### Runner 0.1.2 (2026-08-24) — parity with the browser solver

`src/nslab.js` (NSLab 0.1.1, app 0.5.1) now carries the same four diagnostics, and both instruments gained two more:
the **cutoff pile-up** `max E(k)/E(0.8·kmax)` over `[0.8 kc, kc]` (a fit-free truncation-bottleneck signature — above 1
the spectrum turns up again at the dealiasing edge, which the `E(kmax)/E(peak)` tail check can miss; graded 1.2 / 2.0,
and carried in the worst-instant rows) and **‖u‖_L³**, the Escauriaza–Seregin–Šverák continuation quantity. Both appear
in `snapshots[]` (`pileUp`, `uL3`) and in the health report. The two implementations agree to 1e-6 on the interpolated
maximum, checked by `test/validate-ns.js`.

### Diagnostics added for NS-003 (runner 0.1.1, 2026-08-23)

- **Spectrally interpolated maximum of |ω|** (`omMaxI`, `omMaxIpos` in every snapshot; `peakTrack` in the JSON, evaluated at
  every new running maximum of the grid value so the peak instant is covered). The grid maximum samples the band-limited
  field at the nodes only and underestimates its continuous maximum by O(Δx²); `Solver.interpMax` evaluates the exact
  trigonometric interpolant, its gradient and Hessian by staged contractions and maximises |ω|² by a safeguarded Newton
  ascent started from the largest grid values ∪ largest grid local maxima. Validated: a Taylor–Green field shifted off
  the grid by a sub-cell offset gives grid 1.9856 → interpolated 2.000000000000; a 24³ tube field against an exact
  4×-finer zero-padded resampling of the same field: 7.7320 vs 7.7322. **The two maxima are always reported
  separately** (`max|ω| … (interp …)` in the log); ladder tables use the grid value.
- **Periodic-image diagnostic** (`zCentroid`, `zExtent`, `imageGap`, `zBands` per snapshot; `zgap` in the log): the
  enstrophy profile along z (the tube pair's direction of travel) — circular centroid, extent of the region carrying
  > 1 % of the profile's maximum, and the gap left to its periodic image. When the gap reaches 0 the vorticity straddles
  the box boundary and everything after is the replicated system, not an isolated pair.
- **Worst-instant health verdict**: `health.worst` now includes the worst archived snapshot (kmax·η, spectral tail,
  stretching consistency, each with its time, as extra rows); `health.worstEnd` is the end-of-run verdict alone. Runs
  archived before this change (NS-001, NS-002, NS-003 96³/192³ first pass) carry end-of-run verdicts only.
- Slices now include the plane x = π (`_x<N/2>.f32`), the tubes' closest approach.
- Fixed in the resume path (never exercised by an archived run before): the checkpoint file handle stayed open (`np.load`
  on an `.npz`) so the next `os.replace` failed on Windows; and `outs` was aliased to `st['outputs']`, duplicating every
  snapshot after a resume.

Output directory layout is identical to `test/run-ns-long.js` (`run.log`, `partial.json`, `final.json`, `slices/*.f32`,
checkpoints), so `research/nslab/analyse.js <dir>` reads it unchanged.

## Validation against the CPU solver (2026-08-22, RTX 3060 Laptop, float64)

| Case | Steps | max relative difference in E, Z, ε, max\|ω\| | Other |
|---|---|---|---|
| Taylor–Green 32³ Re 1600, t ≤ 2 | 26 | 3×10⁻¹⁵ | ⟨ω·S·ω⟩ spectral = physical 0.2381463; ∇·u 9×10⁻¹⁶ |
| ABC 16³ Re 10, t ≤ 1 | 16 | 3×10⁻¹⁶ | exact-solution L∞ error 3.14×10⁻¹² (CPU: 3.14×10⁻¹²) |
| Antiparallel tubes 24³ Re 500, t ≤ 0.5 | 11 | 6×10⁻¹⁵ | exercises the Biot–Savart initial condition |

The two instruments agree to round-off (the only difference is the order of the reductions), so a GPU run is
admissible evidence on the same footing as a CPU run — *in float64*.

## Timings (RTX 3060 Laptop GPU, 6 GB)

| N | precision | s/step | steps to t = 16 (CFL 0.4) | wall | peak device memory |
|---|---|---|---|---|---|
| 192³ | float64 | 0.84 | ≈ 1 220 | **≈ 17 min** (CPU core: 3.2 h) | 3.2 GB |
| 192³ | float32 | 0.20 | ≈ 1 220 | ≈ 4 min | 2.1 GB |
| 256³ | float64 | 1.87 | ≈ 1 630 | ≈ 51 min | **5.98 GB — at the card's limit** |

Float64 on a consumer GPU runs at 1/64 of the float32 rate, so the FFTs are compute-bound and the speed-up over one
CPU core is ~11× rather than the ~100× a float32 run gets. 256³ float64 fits only just; 384³ does not.

## Precision policy

- **Archived evidence: float64**, CPU or GPU (they agree to 10⁻¹⁵).
- **`--fp32` is for exploration only** — parameter sweeps, choosing initial conditions, deciding what deserves a
  float64 run. Its verification floors are ~10⁻⁶, which is where the budgets and the max|ω| extremes live.
- Anything that is going to be claimed as a resolution-independent feature gets a float64 ladder.
