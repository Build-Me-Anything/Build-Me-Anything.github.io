# NSLab research archive

Authoritative numerical evidence produced with Pocket Wind Tunnel's NSLab mode lives here, outside the
single-file application, so that results can be compared months later against a recorded build.

```
research/nslab/
├── README.md                      this file: programme, gates, status
├── taylor-green-Re1600/
│   ├── ladder-24-32-48-64.json    grid-refinement ladder, Re 1600, t ∈ [0, 10] (series + snapshots + health)
│   └── ladder-96.json             the 96³ level (618 s in Node)
├── taylor-green-Re100/
│   └── ladder-16-24-32.json       Re 100 ladder
├── tgv-Re1600-N192/               NS-001 CPU float64 192³ run (run-ns-long.js): run.log, final.json, slices, checkpoints
├── tgv-Re1600-N192-gpu/           NS-001 GPU float64 192³ run (nslab_gpu.py) + analysis.md / analysis.svg
├── tgv-Re1600-N256-gpu/           NS-001 GPU float64 256³ run + analysis
├── tubes-Re4000-N96-gpu/          NS-002 antiparallel tubes, Re 4000, GPU float64 ladder: 96³ (+ analysis, slice PNGs)
├── tubes-Re4000-N192-gpu/         NS-002 192³
├── tubes-Re4000-N256-gpu/         NS-002 256³
├── tubes-Re4000-dtcheck-N96-cfl02-gpu/   NS-002 time-step check (96³ at CFL 0.2)
├── tubes-Re2000-N{96,192,256}-gpu/       NS-003 ladder, runner 0.1.1 (x = π slices, interpolated max, image gap, worst-instant health)
├── v0-tubes-Re2000-N{96,192}-gpu/        NS-003 first pass on runner 0.1.0 (identical physics, fewer diagnostics)
├── ns002-ladder-*.png, ns003-ladder-*.png   ladder comparison strips (NS-002: z = 0 at t 8.5; NS-003: x = π at t 8.5)
├── analyse.js                     peak / BKM-integral / convergence tables and SVG for a run against its ladder
├── slice-png.js                   archived slice fields → PNG strips (studio palette, zero dependencies)
└── run-192.ps1, run-ns002.ps1     detached launchers (CPU NS-001 192³; GPU NS-002 ladder)
```

Each JSON is the output of `node pocket-wind-tunnel/test/bench-ns.js <Re> <tEnd> <N,N,…> <out.json>` and carries,
per grid level: the per-step series (t, E, ε, max|ω|), snapshots every Δt = 1 (E, Z, ε, ⟨ω·S·ω⟩ spectral and
physical, kmax·η, skewness, alignment), the peak values and the health verdict.

## What NSLab is, and is not

NSLab integrates the 3D incompressible Navier–Stokes equations on the periodic box [0, 2π]³ with a Fourier
pseudo-spectral method (2/3 dealiased, rotational form, exact projection) and RK4. It produces **numerical
evidence** — histories of energy, enstrophy, dissipation, max|ω|, vortex stretching, spectra — together with a
verification report that grades every run (divergence, exact energy conservation of the nonlinear term,
RK4-consistent energy and enstrophy budgets, resolution kmax·η, spectral tail, agreement of two independent
stretching estimates) and refinement ladders that grade whether peaks have converged.

It does not, and cannot, prove anything about the Clay Navier–Stokes problem. The programme it serves is

```
numerical evidence → verified numerics → resolution-independent pattern → conjecture → inequality → proof
```

and this folder documents the first two arrows only.

## Gates

| Gate | Requirement | Status (2026-08-23) |
|---|---|---|
| G0 | Existing solvers regression-tested, baseline frozen | done — `validate.js`, `validate-hyper.js`, `validate-tunnel.js`, `validate-cfd.js` ALL PASS |
| G1 | 3D discretisation verified | done — FFT vs direct DFT 7e-12; ABC exact solution 3e-12; 2D TGV 2e-9; RK4 order 4.01/3.99; ∇·u 1e-16 (`validate-ns.js`) |
| G2 | Taylor–Green reproduced | **done for the energetics** — 256³ (kmax·η ≥ 1.73): ε_max 0.01291 at t 8.88, 0.7 % below the 512³ spectral value and 2.5 % above Brachet's; 192³ → 256³ changes ε_max by 1.7 %. **Not done for max\|ω\|**: 37.0 → 55.1 → 74.3 (96³ → 192³ → 256³) |
| G3 | Grid/time convergence automated | done — ladders with verdicts and observed order, in the app and in `bench-ns.js` |
| G4 | Vorticity/stretching diagnostics validated | done — spectral vs physical ⟨ω·S·ω⟩ agree to 1e-14 while resolved; TGV symmetry (direct skewness 0) and zero initial production reproduced; e₂ alignment reproduced |
| G5 | Reproducible long-time experiments | done for NS-001 (24³ … 256³, CPU and GPU), NS-002 (antiparallel tubes Re 4000, 96³ → 192³ → 256³, GPU float64) and NS-003 (the same tubes at Re 2000, same ladder, runner 0.1.1 diagnostics), in this folder |
| G6 | Resolution-independent phenomenon identified | not started |
| G7 | Candidate inequality discovered | not started |
| G8 | Inequality proven | — |
| G9 | Proof closes the Clay formulation | — |

## Taylor–Green vortex, Re = 1600 (2026-08-22, NSLab 0.1.0, build 0.5.0)

u = sin x cos y cos z, v = −cos x sin y cos z, w = 0; ν = 1/1600; RK4 with CFL 0.4; t ∈ [0, 10].

| N | steps | wall time | ε_max | t(ε_max) | max\|ω\| peak | t | E(10) | kmax·η at t 10 | health |
|---|---|---|---|---|---|---|---|---|---|
| 24³ | 102 | 2 s | 0.00631 | 10.07 | 12.49 | 6.5 | 0.0944 | 0.19 | FAIL |
| 32³ | 146 | 6 s | 0.00780 | 9.25 | 19.34 | 6.2 | 0.0861 | 0.23 | FAIL |
| 48³ | 207 | 24 s | 0.01189 | 9.65 | 20.87 | 8.3 | 0.0753 | 0.33 | FAIL |
| 64³ | 271 | 80 s | 0.01339 | 9.17 | 21.87 | 7.6 | 0.0698 | 0.43 | FAIL |
| 96³ | 427 | 618 s | 0.01386 | 9.25 | 36.98 | 7.5 | 0.0708 | 0.65 | FAIL (tail 2e-2) |
| **192³** (GPU, float64) | 1228 | 17 min | **0.01314** | **8.85** | **55.10** | 8.88 | 0.0740 | 1.30 (min, at t 9) | WARN (tail 2.1e-4; everything else PASS) |
| **256³** (GPU, float64) | 1654 | 58 min | **0.01291** | **8.88** | **74.28** | 10.07 | 0.0745 | 1.73 (min, at t 9) | PASS at the end; tail 2.1e-4 at the peak instant |
| reference | | | 0.0126 (Brachet et al. 1983, 256³ with symmetries) · ≈ 0.013 (van Rees et al. 2011, 512³) | ≈ 9 | | | | | |

**256³ (2026-08-22, GPU float64, t ∈ [0, 16], `tgv-Re1600-N256-gpu/`, 58 min at 5.4 GB):** the card's double-precision
ceiling, and the cleanest run: health PASS at the end, kmax·η ≥ 1.73 throughout, budgets 5·10⁻¹⁰ / 4·10⁻⁸, stretching
spectral = physical to five figures. ε_max = 0.01291 at t = 8.88 — **0.7 % below the 512³ spectral reference, 2.5 %
above Brachet**, and only 1.7 % below the 192³ value: the dissipation peak is converged. E and ε agree with 192³ to
≤ 1 % through the peak. The maximum vorticity is **not** converged and is not converging: peak 74.3 at t = 10.07
against 55.1 (192³) and 37.0 (96³) — +26 % per level, with the instant of the peak moving later and the max\|ω\|
history becoming spikier (65.7 → 41.3 → 73.1 → 48.7 at t = 9.0, 9.5, 10.0, 10.5), i.e. the maximum is an intermittent,
site-hopping quantity living in structures thinner than the global Kolmogorov estimate. The BKM integral converges
faster than the peak: ∫₀¹⁰ max\|ω\| dt = 160 (96³), 223 (192³), 250 (256³) — +39 % then +12 % — and ∫₀¹⁶ = 445 at
256³ (420 at 192³). That ordering — energetics, then the time-integrated maximum, then the instantaneous maximum — is
the programme's first quantitative result about what can and cannot be measured.

**192³ (2026-08-22, GPU float64, t ∈ [0, 16], `tgv-Re1600-N192-gpu/`):** the first resolved level. ε_max = 0.01314 at
t = 8.85 — 1.0 % from the 512³ spectral reference and 4.2 % above Brachet's 1983 value; the 96³ overshoot (0.0139) is
gone, as predicted. The health report passes every check except the spectral tail (2.1·10⁻⁴ against a 10⁻⁴ PASS
threshold at the peak), i.e. this is a marginally resolved DNS by the usual standards, which is exactly what
kmax·η = 1.30 says. The CPU run of the same case (`tgv-Re1600-N192/`, `run-ns-long.js`) agrees with it to 3·10⁻¹³ in
E, Z, ε and max|ω| over the 770 common steps to t = 9 — two instruments, one answer. The integral quantities are
converged: 96³ → 192³ changes ε by ≤ 1 % up to t = 5 and 5.5 % at the peak. **max|ω| is not**: its peak moves from
37.0 (96³) to **55.1 (192³, t = 8.88)**, +33 %, and the level-to-level difference grows through the cascade (12 % at
t = 4, 37 % at t = 8, 50 % at t = 10). The BKM integral ∫₀¹⁶ max|ω| dt = 420 at 192³. Whether 55 is the converged
peak needs 256³ (51 min on the GPU in float64, at the card's memory limit); until then the honest statement is that
the resolved energetics say nothing about the local vorticity maximum.

Reading of the ladder below 192³: the dissipation peak rises toward the published value as the grid is refined and then **overshoots it at
96³** (0.0139 against ≈ 0.013): with the spectral tail undecayed (E(kmax)/E(peak) = 2·10⁻² at 96³) energy piles up
near the truncation — the usual bottleneck of an under-resolved spectral run — and ε = 2νZ, weighted toward high k,
is over-predicted. Convergence from above is expected once kmax·η ≥ 1, i.e. N ≳ 150 for a 2/3-dealiased run at
Re 1600; none of these runs is resolved and the instrument says so. The max|ω| peak is by far the least converged
quantity (21.9 → 37.0 from 64³ to 96³) — exactly the quantity a regularity argument must control, and exactly the
one that demands the most resolution. That is the first, unsurprising, lesson of the programme: a *local* maximum of
vorticity is not a quantity a coarse simulation can be trusted on at all, while *integral* quantities (E, Z, ε)
settle far earlier.

## Taylor–Green vortex, Re = 100 (2026-08-22)

| N | ε_max | t(ε_max) | max\|ω\| peak | E(10) | health |
|---|---|---|---|---|---|
| 16³ | 0.01258 | 4.84 | 2.80 | 0.02652 | FAIL (tail) |
| 24³ | 0.01281 | 4.76 | 3.53 | 0.02611 | FAIL (tail 1.6e-2) |
| 32³ | 0.01295 | 4.86 | 4.38 | 0.02561 | WARN (kmax·η 1.6, tail 3.8e-3) |

At Re 100 the integral quantities converge quickly (ε_max changes 1.8 % then 1.1 %; Brachet's low-Re runs also
peak near t ≈ 5) while max|ω| still moves by 25 % per level — the same lesson at a Reynolds number where the
energetics are essentially resolved. `ladder-16-24-32.json` holds the data.

Alignment of vorticity with the intermediate strain eigenvector (mean |cos θ₂| ≈ 0.52–0.60 from t ≈ 3, against
≈ 0.37–0.48 for e₁ and e₃) and the zero direct skewness (a reflection symmetry of the Taylor–Green flow that the
equations preserve) are reproduced at every resolution.

## NS-002 — Antiparallel vortex tubes, Re = 4000 (2026-08-22/23, NSLab 0.1.0, GPU runner 0.1.0, build 0.5.0)

**Initial condition** (the app's `tubes` preset, unchanged): ω_x = −8 exp(−r₊²/0.4²) + 8 exp(−r₋²/0.4²) about the
lines y = π ± d(x), z = π with d = 0.7 + 0.2 cos x (r± the distance to each line, periodic images included),
projected and inverted to velocity by û = ik × ω̂ / k². Circulation per tube Γ = 8π·0.4² ≈ 4.0, so Re_Γ = Γ/ν ≈
16 000; E(0) = 0.0703, Z(0) = 0.400, max|ω|(0) = 8.0. The box is 2π with a single perturbation wavelength along the
tubes. This is a Kerr-type configuration — antiparallel tubes perturbed so that they approach where the separation is
least — **not** Kerr's 1993 profile, box or perturbation, and no published value exists for this exact case: the ladder
is the only grade. ν = 1/4000; RK4 at CFL 0.4; snapshots every Δt = 0.5 with slices on z = 0, z = π/2, x = π/2;
t ∈ [0, 16]. Launcher `run-ns002.ps1` runs the three levels in sequence on the GPU in float64 with checkpoints.

**Why Re 4000** — exploration in float32 at 96³ (t ≤ 16, not evidence, not archived):

| Re | Re_Γ | max\|ω\| peak (t) | Z_max (t) | ε_max (t) | min kmax·η at 96³ | → at 256³ |
|---|---|---|---|---|---|---|
| 500 | ≈ 2 000 | 23.7 (10.0) | 0.40 (0 — Z decays throughout) | 0.0016 (0) | 2.65 | ≈ 7 |
| 2000 | ≈ 8 000 | 52.3 (8.56) | 0.86 (9.0) | 0.00087 (9.1) | 1.08 | ≈ 2.9 |
| **4000** | **≈ 16 000** | **60.7 (8.44)** | **1.32 (11.7)** | **0.00067 (11.7)** | **0.69** | **≈ 1.8** |

At Re 500 the cores diffuse (σ_eff ≈ √(σ² + 4νt) ≈ 0.5 by t = 10) before the tubes interact and the enstrophy never
rises above its initial value; at Re 2000 there is a reconnection event but 96³ already resolves it, so the ladder
would have nothing to grade; at Re 4000 the event is the strongest the card's 256³ ceiling still resolves (kmax·η
≈ 1.8 projected, comparable with NS-001's 1.73), with the bottom rung marginal (WARN) exactly as in NS-001. The pair's
self-induced translation, Γ/(4πd) ≈ 0.46 for the mean separation, carries it from z = π to the periodic plane z = 0
by t ≈ 7 — which is when the z = 0 slices light up and when max|ω| starts to climb.

**Float64 ladder** (`tubes-Re4000-N{96,192,256}-gpu/`, `analysis.md` / `.svg` and `slices-vort-*.png` in each):

| N | steps | wall | ε_max | t | Z_max | t | max\|ω\| peak | t | ∫₀¹⁰ max\|ω\| dt | ∫₀¹⁶ | min kmax·η | health |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 96³ | 1118 | 2.4 min | 0.000665 | 11.71 | 1.329 | 11.71 | 60.72 | 8.44 | 180.5 | 324.5 | 0.69 (t 11.5) | WARN (kmax·η; tail 2.3·10⁻³ at the peak) |
| 192³ | 2348 | 36 min | 0.000679 | 10.00 | 1.357 | 10.00 | **108.52** | 8.26 | 263.9 | 539.9 | 1.37 (t 10) | PASS (budgets 4·10⁻⁸ / 1·10⁻⁵) |
| 256³ | 3169 | 1.68 h | 0.000684 | 9.50 | 1.369 | 9.50 | **138.82** | 8.25 | 313.9 | 654.2 | 1.81 (t 9.5) | PASS (budgets 2·10⁻⁸ / 9·10⁻⁶; tail 1.0–1.3·10⁻⁴ at t 8.5–9) |
| 96³, CFL 0.2 (Δt check) | 2236 | 4.3 min | 0.000666 | 11.71 | 1.332 | 11.71 | 60.72 | 8.44 | 180.8 | 324.7 | 0.69 | WARN (same checks; budgets 5·10⁻⁹ / 4·10⁻⁷) |

**96³ → 192³.** The energetics converge: E agrees to 0.1 % through t = 10 (1 % at t = 16); ε agrees to ≤ 2 % up to
t = 7, 6 % at t = 8 (the reconnection), 1 % at t = 9, 5 % at t = 10; the enstrophy peak changes by 2 % (1.33 → 1.36)
and moves from t = 11.7 to 10.0. After the peak the two levels separate — ε differs by 33–37 % at t = 12–14 — because
96³ keeps a broad plateau of dissipation that 192³ does not: the same bottleneck as the 96³ overshoot in NS-001
(energy piling up at an undecayed spectral tail), which is what the WARN grade at 96³ was reporting. The maximum
vorticity does the opposite of converging: **60.7 → 108.5 (+79 %)**, with the level-to-level gap growing through the
event (5 % at t = 6, 64 % at t = 8, 150 % at t = 10) and the peak moving earlier (8.44 → 8.26). Where 96³ shows one
smooth hump (57.6 at t = 8.5, then a monotone fall), the 192³ history is spiky — 107.9 at t = 8.25, 68.8 at 8.5, 81.7
at 8.75, 72.7 at 9.0, 87.2 at t = 10 — the same intermittent, site-hopping maximum NS-001 found, and the spectral tail
at 192³ touches 2–3.5·10⁻⁴ (WARN level) at the instants t = 8.5–10 before recovering to 5·10⁻⁵ (PASS). The BKM integral
∫₀¹⁰ max\|ω\| dt rises from 180 to 264 (+46 %) and ∫₀¹⁶ from 325 to 540 (+66 %) — far less converged than in NS-001
at the same step (+39 %). The per-level geometry is the same in the slices (`slices-vort-z0.png`: the pair arrives
at z = 0 as a bow-tie with a thin bridging sheet on the centreline; `slices-vort-x48.png`: cores, trailing sheet and a
turbulent head), and the 96³ frames carry visible spectral ringing that 192³ has mostly lost. Whether 108 is anything
like the converged peak was the 256³ question.

**192³ → 256³** (256³: 3169 steps, 1.68 h, health PASS, kmax·η ≥ 1.81, budgets 2·10⁻⁸ / 9·10⁻⁶, stretching spectral =
physical to all printed figures). The energetics are converged: E agrees to 0.06 % at t = 10; ε to ≤ 0.1 % up to t = 7,
1.8 % at t = 8, 4.6–4.8 % at t = 9–10 and 1–3 % afterwards (the 96³ late plateau is gone); ε_max 0.000679 → 0.000684
(+0.8 %), Z_max 1.357 → 1.369 (+0.9 %), their instants 10.0 → 9.5. The maximum vorticity is still growing:
**60.7 → 108.5 → 138.8** (+79 %, +28 %), at an instant that no longer moves (8.44 → 8.265 → 8.246). The approach to the
event is converged — max\|ω\| agrees to 1 % at t = 8.0 (72.4 vs 71.8) — and the whole divergence is in the bridge in
the quarter time unit that follows: 107.9 vs 138.8 at t = 8.25, 72.7 vs 112.3 at t = 9, 87 vs 94 at t = 10, with the
256³ history spikier again (138.8, 127.6, 96.0, 112.3, 104.1, 105.0, 88.6, 94.3 at t = 8.25 … 10). The BKM integral:
∫₀¹⁰ max\|ω\| dt = 180.5, 263.9, 313.9 (+46 %, +19 %); ∫₀¹⁶ = 325, 540, 654 (+66 %, +21 %). Over the three levels the
peak scales as N^0.84 then N^0.86 and the integral as N^0.55 then N^0.60 — neither exponent is falling, whereas in NS-001
the integral's fell (0.48 → 0.40) while the peak's did not. That is a stronger statement than NS-001's: **in this flow
the time-integrated maximum has not begun to converge either.**

The two sides of the enstrophy budget are themselves unconverged while the budget closes: peak ⟨ω·S·ω⟩ = 0.73 → 1.71
→ 2.48 (+133 %, +46 %), peak palinstrophy dissipation 2νP = 0.53 → 1.61 → 2.41, peak dZ/dt = 0.49 → 0.51 → 0.61. In
NS-001 the same two terms moved 7 % and 11 % from 192³ to 256³ with dZ/dt unchanged. The production term is an
integral by construction, but in a reconnection it lives in the bridge and behaves like a local quantity. Where the
maximum lives: the maximum on the archived plane z = 0 converges (35.3 at 192³, 33.0 at 256³, t ≈ 8.5–9) while the
volume maximum does not, so the grid-limited structure is off that plane — the bridge core near x = π, where the
perturbation brings the tubes closest; on z = 0 the local ω·S·ω reaches ≈ 2 100 against a volume mean of 2.4, a
thousandfold concentration in a line (`slices-stretch-z0.png`). The spectral tail at the peak instants is 2.9·10⁻⁴
at 192³ and 1.0–1.3·10⁻⁴ at 256³ (t = 8.5–9) — at the PASS/WARN boundary at both levels although the end-of-run
verdicts are PASS: the global kmax·η (1.81) grades the mean dissipation, and the bridge is thinner than the scale it
describes. Instrument lesson, the same one NS-001's 2.1·10⁻⁴-at-the-peak hinted at: the health verdict should carry
its worst snapshot, not its last one.

**Time-step check** (`tubes-Re4000-dtcheck-N96-cfl02-gpu/`, 96³ at CFL 0.2 against CFL 0.4): halving Δt changes the
max\|ω\| peak by 0.002 % (60.719 → 60.720 at the same instant), ε_max and Z_max by 0.18 %, ∫₀¹⁶ max\|ω\| dt by 0.13 %,
E(16) by 0.006 %; the instantaneous differences stay below 0.35 % in ε and 0.6 % in max\|ω\| except 2.3 % at t = 12;
the RK4-consistent energy-budget residual falls from 2.8·10⁻⁷ to 4.8·10⁻⁹ (×58, the expected fourth-order fall of ×16
compounded with the adaptive step). The level-to-level differences above are spatial, not temporal.

**What NS-002 shows, and does not.** Evidence: in a Kerr-type reconnection at Re_Γ ≈ 16 000 the energetics (E, ε, Z,
Z_max, dZ/dt) converge by 256³, while the grid-sampled max\|ω\|, its BKM integral and the stretching and palinstrophy
terms do not, and scale as clean powers of N from 96³ to 256³ under a global resolution criterion that is met (kmax·η
up to 1.8). The defensible statement is: **the global energetics converge substantially, while the local
stretching/reconnection diagnostics remain resolution-sensitive** — which separates the quantities that are already
trustworthy from those whose physical interpretation needs further spatial refinement. (NS-001's middle rung —
the BKM integral — converged faster than the peak there; here it does not, and neither does ⟨ω·S·ω⟩, so the
hierarchy is not "middle rung converges in a cascade, not in a bridge" but simply: nothing local has converged yet
in this flow.) Not shown: any growth of vorticity that "survives refinement", and certainly not a BKM integral
approaching divergence — the BKM diagnostic itself is resolution-sensitive here. What grows here grows *with* the
grid, which is what an under-resolved sheet does; it is a statement about the instrument's reach (the bridge is below
the grid scale at 256³, the card's float64 ceiling), not a feature of the equations, and it is not a conjecture.

**Periodic images — the caveat, corrected by NS-003's diagnostic.** The first reading of this run said the vorticity
"crosses the box boundary at t ≈ 7" and that the event (t = 8.25) and the enstrophy peak (t = 9.5) therefore belong to
the periodically replicated system. NS-003 (same initial condition, same kinematics, with a per-snapshot image
diagnostic) shows that statement conflated two things. The enstrophy-carrying band (> 1 % of the z-profile's
maximum) is 3.0–3.5 wide in z from t ≈ 6 and translates at 0.35–0.49 per time unit; its leading edge passes the
coordinate plane z = 2π ≡ 0 at t ≈ 6 and its centroid at t ≈ 8.4 — which is why the z = 0 slices light up — but
**the gap between the band and its own periodic image never falls below 2.7 (≈ 7 core radii) at any level.** The
pair's vorticity never meets its image's. The images act, as in any periodic box, through the velocity field from
t = 0: at the closest approach an image at distance ≈ 2.7–3 induces a velocity of order Γ/(2π·3) ≈ 0.2 against the
pair's self-induced 0.46 — a box-size effect present throughout the run, not a crossing event. So the right caveat
is: **a 2π box is small for this pair (the image-induced velocity is ~40 % of the self-induced one), and every number
here is for this periodic configuration; a 4π box in z would halve that.** The split at t ≈ 7 used below stays
meaningful for a different reason — it is when the bridge forms (laminar approach before, reconnection after) — and
the convergence contrast between the windows is about the reconnection, not the images. Next, in order: **NS-003**, the same initial
condition at Re 2000 (Re_Γ ≈ 8 000; the probe gave kmax·η 1.08 at 96³, so 256³ should resolve the bridge ≈ 3×), to
ask whether max\|ω\| and ⟨ω·S·ω⟩ converge at all in this class of flow once the bridge is resolved (≈ 2.3 h on the GPU);
slices through the bridge (x = π); a spectrally interpolated maximum; float32 384³ for exploration only.

## NS-003 — Antiparallel vortex tubes, Re = 2000 (2026-08-23, NSLab 0.1.0, GPU runner 0.1.1, build 0.5.0)

**Question.** NS-002's local quantities scaled with the grid under a global resolution criterion that was met. Does
lowering the Reynolds number so that the reconnection bridge is resolved by every check — Re 2000, Re_Γ ≈ 8 000, the
same initial condition, kmax·η 1.08 / 2.20 / 2.94 on the three rungs — make max\|ω\|, its BKM integral and
⟨ω·S·ω⟩ converge? Same ladder (96³ → 192³ → 256³, float64, CFL 0.4, t ∈ [0, 16]; `run-ns003.ps1`,
`tubes-Re2000-N{96,192,256}-gpu/`). New instrument for this study (runner 0.1.1, `gpu/README.md`): slices on
x = π; a spectrally interpolated maximum, **always reported beside the grid maximum, never in its place**; a
per-snapshot periodic-image diagnostic; the health verdict carrying its worst archived instant; convergence by
window in `analyse.js`. The 96³ and 192³ levels were first run on runner 0.1.0 (kept as `v0-…`, bit-identical
physics) and re-run so that all three carry the same diagnostics.

| N | steps | wall | ε_max (t) | Z_max (t) | max\|ω\| grid peak (t) | interpolated peak (t) | ∫₀¹⁰ max\|ω\| dt | ∫₀¹⁶ | peak ⟨ω·S·ω⟩ | min kmax·η | health worst instant / end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 96³ | 1067 | 3.8 min | 0.000874 (9.11) | 0.874 (9.11) | 52.28 (8.56) | 52.77 (8.51) | 162.5 | 270.3 | 0.60 | 1.08 | WARN / WARN (tail 1.8·10⁻³, stretching 1.3·10⁻² at t 9) |
| 192³ | 2216 | 37 min | 0.000809 (8.84) | 0.809 (8.84) | 92.10 (8.75) | 94.23 (8.73) | 220.8 | 436.8 | 0.83 | 2.20 | WARN / PASS (tail 1.26·10⁻⁴ at t 9) |
| 256³ | 2919 | 1.68 h | 0.000808 (8.76) | 0.808 (8.76) | **109.36** (8.77) | **115.91** (8.74) | 245.5 | 477.2 | 1.03 | 2.94 | **PASS / PASS** (tail ≤ 2.7·10⁻⁵ at every instant) |

**Convergence by window** (max level-to-level difference over the window; BKM integral over the window):

| levels | window | max Δε | max ΔE | max Δmax\|ω\| | ∫ max\|ω\| dt | Δ∫ |
|---|---|---|---|---|---|---|
| 96³ → 192³ | 0 ≤ t ≤ 7 | 0.4 % | 0.01 % | 12 % | 64.1 → 63.2 | −1.4 % |
| 96³ → 192³ | 7 ≤ t ≤ 16 | 9.0 % | 0.21 % | 71 % | 205.9 → 373.4 | +81 % |
| 192³ → 256³ | 0 ≤ t ≤ 7 | 0.0 % | 0.00 % | 2.7 % | 63.2 → 63.3 | +0.1 % |
| 192³ → 256³ | 7 ≤ t ≤ 16 | 4.1 % | 0.10 % | 31 % | 373.4 → 413.8 | +10.8 % |

**Energetics.** Converged by 192³: ε_max 0.000809 → 0.000808 (0.2 %), Z_max 0.1 %, E to 0.00 % through t = 10 and
0.1 % at t = 16; ε within 2 % at every sampled instant after the event (NS-002: 1–5 %). 96³ overshoots the dissipation
peak by 8 % — the truncation bottleneck, caught by its WARN (tail 1.8·10⁻³) — so the bottom rung is not a resolved
level here either, despite kmax·η = 1.08.

**Local quantities — the onset of convergence, not convergence.** Grid peak 52.3 → 92.1 → 109.4 (+76 %, +19 %;
exponents 0.82 then **0.60**, against 0.84 → 0.86 at Re 4000); BKM ∫₀¹⁰ 162.5 → 220.8 → 245.5 (+36 %, +11 %;
exponents 0.44 → 0.37, like NS-001's 0.48 → 0.40); peak ⟨ω·S·ω⟩ 0.60 → 0.83 → 1.03 (+38 %, +24 %); peak 2νP
0.48 → 0.85 → 1.06; peak dZ/dt 0.25 → 0.25 → 0.28. Before the bridge forms (t ≤ 7) everything is converged at
192³ → 256³ including the pointwise maximum (2.7 %) and its integral (0.1 %); after it, the maximum still changes by
31 % at some instants and its integral by 11 %. Against NS-002's 192³ → 256³ (post-event Δε 11 %, Δmax\|ω\| 46 %,
Δ∫ 24 %) every local number is better by a factor of two to three and every exponent is falling — but a run that
passes every health check at every instant, with kmax·η ≥ 2.94, still moves its maximum by 19 % at the last
refinement. **Health PASS at every instant is necessary, not sufficient, for the pointwise quantities; only the
ladder grades them.** A 384³ rung, which this card cannot run in float64, is what would show whether the sequence
flattens.

**The interpolated maximum says the core is still sharpening.** The spectrally interpolated peak sits above the grid
peak by 0.9 %, 2.3 % and 6 % at 96³, 192³ and 256³, and its own ladder is 52.8 → 94.2 → 115.9 (+78 %, +23 %;
exponents 0.84 → 0.72). If the peak structure were resolved the correction would shrink with N; it grows. Its position
at 256³, (x, y, z) = (3.28, 3.11, 0.82), is the head of the bridge: x within 0.14 of π (the tubes' closest approach),
y = π (the symmetry plane between the tubes), z ≈ 0.8 after the pair has travelled ≈ 4 from z = π at ≈ 0.45 per time
unit. The new x = π slices (`slices-vort-x128.png`, ladder `ns003-ladder-vort-xmid-t8.5.png`,
`ns003-ladder-stretch-xmid-t8.5.png`) show the bridge as a sheet in the plane y = π, one or two cells thick at all
three resolutions, with ω·S·ω reaching ≈ 8 000 on that plane against a volume mean of 1.0; the plane catches 70 % of
the volume maximum (71 vs 103 at t = 8.5) where the old planes caught a quarter.

**Periodic images.** The diagnostic (z-extent of the enstrophy-carrying band, gap to its image, circular centroid at
every snapshot) gives the correction recorded under NS-002 above: the band translates and its leading edge passes the
plane z = 0 at t ≈ 6 (centroid at t ≈ 8.4), but the gap to its periodic image is ≥ 2.7 at every level and every
instant, re-opening to ≈ 3.0–3.3 after t ≈ 8.5 as the bridge compacts the enstrophy in z. The images act through the
velocity only — a box-size effect of order 40 % of the self-induced speed at closest approach, present throughout.

**A fit-free resolution signature: energy piling up at the cutoff.** `analyse.js` now reports, at every archived
snapshot, max E(k)/E(0.8 kc) over [0.8 kc, kc] — above 1 the spectrum turns up again at the dealiasing edge, which is
energy accumulating at the truncation even when E(kc)/E(peak) passes its 10⁻⁴ line. Taylor–Green at 256³ never does
it after the sheet roll-up (1.19 at t = 3.5, then 1.00 throughout the cascade). Both tube runs do it during the
bridge event: NS-002 256³ reaches 2.55 at t = 9 (1.42 → 2.17 → 2.55 → 1.65 → 1.32 at t = 8 … 10); NS-003 reaches 2.10
at 192³ and 1.78 at 256³ (t = 8–9), back to 1.00 by t = 12. That is the spectral face of the unconverged maximum: the
bridge feeds energy to the cutoff at every resolution reached, a reconnection-specific signature absent from the
cascade. It is the cheapest diagnostic in the archive and belongs in the health report as a row (pile-up > 1.2 →
WARN) in the next runner version. An analyticity-strip width δ(t) was also fitted (E ∝ k^−n e^−2δk); at kc ≤ 85 the
dissipation-range window spans under a decade in k, n and δ trade off, and the estimate contradicts well-resolved
instants, so it is not tabulated — published strip analyses use 1024³ and beyond for this reason. The code stays for a
rung with kc ≥ 120.

**Instrument notes.** The worst-instant verdict turns 192³ from PASS (end of run) to WARN (tail 1.26·10⁻⁴ at t = 9,
the peak instant), which is what it is for. The per-step peak tracker first fired on every step during the laminar
rise and slowed 256³ sevenfold; it now fires on 2 % increments of the running grid maximum, and the diagnostics cost
≈ 50 % at 96³, 25 % at 192³ and nothing measurable at 256³ (1.68 h, as NS-002). Two latent bugs in the resume path
(an open checkpoint handle; duplicated snapshots after a resume) were found by the smoke tests and fixed; no archived
run had ever resumed.

**Conclusion.** Reducing Re_Γ from ≈ 16 000 to ≈ 8 000 substantially improves the refinement behaviour of the
reconnection event. The global energetics become resolved by 192³, and the pre-bridge vorticity evolution is already
closely converged between 192³ and 256³. The remaining refinement sensitivity is concentrated in the reconnection
bridge, where the pointwise maximum vorticity, its time integral and the vortex-stretching production continue to
increase with resolution. The falling refinement exponents are evidence of an approach toward convergence, but the
256³ sequence is not yet converged. NS-003 therefore provides no basis for interpreting the growing ‖ω‖∞ as physical
blow-up; it demonstrates a progressively better-resolved but still numerically unresolved local reconnection
structure — and it shows that the standard global resolution criteria (kmax·η, spectral tail, budget closure,
stretching consistency) can all pass at every instant while a pointwise maximum is still 20 % from converged.

**The result emerging across NS-001 → NS-002 → NS-003** is an instrument-characterisation experiment rather than
three simulations: Reynolds number → resolution requirement → diagnostic convergence. NS-002 showed that raising Re
pushes the local event beyond the 256³ instrument's reach; NS-003 shows that lowering Re brings it back toward the
resolvable regime, but not far enough. The decisive next question is therefore not "run a bigger simulation" but:
**at Re_Γ ≈ 8 000, does ‖ω‖∞ flatten between 256³ and a finer rung?** If it does, that is the beginning of a genuine
convergence demonstration; if not, even Re 2000 needs finer resolution around the bridge. 384³ does not fit the 6 GB
card in any precision (float32 pages at 15 s/step); 320³ float32 does (0.84 s/step, 0.6 h), so the test is a float32
exploration ladder 256³ → 288³ → 320³ anchored on the float64 256³ (`expl-tubes-Re2000-N*-fp32-gpu/`, not evidence
grade, kept outside the ladder prefix on purpose). After that: the analyticity-strip width δ(t) from the archived
spectra; sup‖u‖_{L³} and the Doering–Foias constant in the AnalysisCore; a 4π box in z; the 0.1.1 diagnostics in
`nslab.js`.

## NS-003b — the flattening test (float32 exploration ladder, 2026-08-23 → 24)

**The decisive question from NS-003: at Re_Γ ≈ 8 000, does ‖ω‖∞ flatten beyond 256³?** 384³ does not fit the 6 GB
card in any precision (it pages: 15 s/step); a single-precision 256³ → 288³ → 320³ ladder does
(`run-ns003-fp32.ps1` → `expl-tubes-Re2000-N{256,288,320}-fp32-gpu/`, deliberately outside the evidence-ladder
folder prefix). Control: the float32 256³ reproduces the float64 level to every printed digit in both peaks and to
0.04 % in ∫₀¹⁰ (∫₀¹⁶ differs by 0.9 %, the float32 drift accumulating only in the late decay) — single precision is
adequate for this question even though its budget residuals sit at the float32 floor (health FAIL by the float64
thresholds, as the precision policy expects).

| N (fp32) | steps | wall | ε_max (t) | Z_max | max\|ω\| grid peak (t) | interpolated peak (t) | ∫₀¹⁰ | ∫₀¹⁶ | peak ⟨ω·S·ω⟩ | cutoff pile-up (7 ≤ t ≤ 12) |
|---|---|---|---|---|---|---|---|---|---|---|
| 256³ | 2922 | 25 min | 0.000808 (8.76) | 0.808 | 109.36 (8.767) | 115.91 (8.740) | 245.6 | 481.3 | 1.029 | 1.78 (t 8) |
| 288³ | 3282 | 43 min | 0.000816 (8.76) | 0.816 | 129.78 (8.762) | 132.20 (8.747) | 261.0 | 510.8 | 1.193 | 1.70 (t 8) |
| 320³ | 3657 | 1.29 h* | 0.000816 (8.72) | 0.816 | **129.16** (8.613) | **132.70** (8.600) | 267.9 | 521.4 | 1.243 | 1.51 (t 8) |

*The 320³ run was interrupted at t = 11.5 by a machine shutdown and resumed from its t = 10 checkpoint the next day —
the first production use of the repaired resume path; the peak lies in the pre-interruption portion. Wall time
includes the lost first attempt.*

**Result: the maximum flattens.** Grid peak 109.4 → 129.8 → 129.2 (exponent 1.45, then **−0.05**); interpolated
115.9 → 132.2 → 132.7 (1.12, then **0.04**) — the last two rungs agree to 0.4 %. Z_max and ε_max are converged
(0.816 / 0.000816 at both), the stretching peak moves 4 % at the last rung (16 % before), the BKM integral 2.6 %
(6.3 % before), and the cutoff pile-up *decreases* with N for the first time (1.78 → 1.70 → 1.51): the bridge is
becoming a resolved structure. Windowed 288³ → 320³: pre-bridge ≤ 0.7 % everywhere; post-bridge the intermittent
decay still shows up to 16 % at single instants while the peak and the integral agree. Two further readings: the
jump from 256³ (+19 %) says the float64 256³ evidence level under-reports the converged peak by roughly 15 % — at
Re 2000 "resolved for the peak" begins near 288³; and the 96³→…→320³ sequence 52 → 92 → 109 → 130 → 129 is the
programme's **first observed convergence of a pointwise vorticity maximum**, at ≈ 130 (interpolated ≈ 132.5).

**Status of this result: exploration grade.** Float32, two rungs on the plateau, refinement ratios of only 1.125 and
1.11, the peak instant moving 0.15 at the last rung within a spiky history, and the BKM integral still moving 2.6 %.
Under the standing precision policy it is not archivable as evidence. Two routes would upgrade it: a float64 288³+
ladder (needs a ≥ 12 GB card), or an explicit amendment admitting float32 ladders that carry a float64 anchor and
stated verification floors — that policy change is the principal investigator's call, not the instrument's.

`run-192.ps1` → `pocket-wind-tunnel/test/run-ns-long.js --N 192 --Re 1600 --tEnd 16 --cfl 0.4`, `tgv-Re1600-N192/`:
1228 steps, 3.23 h on one CPU core (9.3 s/step, 1.94 GB), health WARN (spectral tail, as for its GPU twin).
ε_max = 0.013135 at t = 8.847, max\|ω\| peak 55.097 at t = 8.877, E(16) = 0.030660. Against `tgv-Re1600-N192-gpu/`
(CuPy float64) the per-step E, Z, ε and max\|ω\| agree to **4·10⁻¹² over all 1229 steps** to t = 16 — the full-length
confirmation of the 3·10⁻¹³-over-770-steps statement above; the growth from 10⁻¹³ to 10⁻¹² is round-off amplified
through the turbulent phase, not a discrepancy between the instruments.

## GPU runs

`pocket-wind-tunnel/gpu/nslab_gpu.py` (CuPy, float64) reproduces the CPU solver to 3·10⁻¹⁵ and runs 192³ in ≈ 17 min;
its output folders (`*-gpu`) have the same layout and are analysed with the same `analyse.js`. float32 runs are not
archived as evidence. `tgv-Re1600-N192-gpu/` is the GPU twin of the CPU 192³ run (agreement 4·10⁻¹² over all 1229
steps); `tgv-Re1600-N256-gpu/` is the 256³ run, the last level this card can run in double precision (5.98 GB for
Taylor–Green, 6.25 GB reported for the tubes at 256³ — at the limit; nothing else may use the card during such a run).
The NS-002 ladder (`tubes-Re4000-N*-gpu/`) ran entirely on the GPU: 2.4 min, 36 min and ≈ 1.6 h for the three levels.

## How to add an experiment

1. Run it in the app (NSLab mode), with `test/bench-ns.js` (ladders), with `test/run-ns-long.js` (CPU long runs with
   checkpoints) or with `gpu/nslab_gpu.py` (GPU, float64 for evidence; float32 only to choose parameters); export the
   evidence dossier (Export → dossier) or keep `final.json`. Long runs go detached — copy `run-ns002.ps1` (ASCII only:
   PowerShell 5.1 misreads a BOM-less UTF-8 script) and launch it with `Start-Process`.
2. Put the folder here as `<ic>-Re<Re>-N<N>[-gpu]`, run `node analyse.js <folder>` (it finds the other levels of the same
   case by that name) and `node slice-png.js <folder>`, and add the row to this README with the build version.
3. Judge vorticity growth on the BKM integral ∫max|ω|dt across the ladder, never on the peak alone.
4. Do not record a conclusion that the health report or the refinement ladder did not support.
