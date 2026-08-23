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
