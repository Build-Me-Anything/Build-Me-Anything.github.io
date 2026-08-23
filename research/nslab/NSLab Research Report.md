# NSLab: a verified pseudo-spectral laboratory for the three-dimensional incompressible Navier–Stokes equations, with resolution studies of the Taylor–Green vortex at Re = 1600 and of antiparallel vortex tubes at Re = 4000

**Authors:** Michael (principal investigator, Pocket Wind Tunnel research programme); Claude (Anthropic) — instrument development, verification and analysis.
**Date:** 22–23 August 2026. **Instrument:** Pocket Wind Tunnel 0.5.0 / NSLab 0.1.0 (CPU and CuPy-GPU implementations, GPU runner 0.1.0).
**Status:** working report, version 1.3 (NS-002 and NS-003, antiparallel vortex tubes at Re = 4000 and 2000, added; NS-001 CPU 192³ run completed; GPU runner 0.1.1 diagnostics).

---

## Abstract

We describe NSLab, a numerical laboratory for the three-dimensional incompressible Navier–Stokes equations on the periodic box [0, 2π]³, built as the first stage of a research programme whose long-term object is the Clay Millennium problem on existence and smoothness. The solver is Fourier pseudo-spectral (2/3-rule dealiasing, rotational form of the advection term, exact projection) with classical fourth-order Runge–Kutta time integration, implemented twice — in JavaScript (browser Web Worker and Node) and in CuPy/cuFFT on a GPU — in double precision. Every run is accompanied by a verification report that grades divergence, nonlinear energy conservation, RK4-consistent energy and enstrophy budgets, resolution (kmax·η), spectral-tail decay and the agreement of two independent estimates of the vortex-stretching term; refinement ladders grade the convergence of peak quantities. Verification against exact solutions gives velocity errors of 3×10⁻¹² and a measured temporal order of 4.0; the two implementations agree to 3×10⁻¹⁵ on small cases and to 3×10⁻¹³ over 770 steps at 192³. For the Taylor–Green vortex at Re = 1600 the peak dissipation rate converges with resolution to ε_max = 0.01314 at t = 8.85 on a 192³ grid (kmax·η ≥ 1.30), within 1 % of the 512³ spectral reference and 4 % above Brachet et al. (1983), whereas the maximum vorticity — the quantity controlled by the Beale–Kato–Majda criterion — rises 37.0 → 55.1 → 74.3 from 96³ to 192³ to 256³ (ε_max at 256³: 0.01291, 0.7 % from the 512³ reference) and is not converged at any resolution reached; its time integral converges faster (+12 % from 192³ to 256³) than its instantaneous value (+26 %). A second study, a Kerr-type antiparallel-vortex-tube reconnection at Re = 4000 (Re_Γ ≈ 16 000) on a 96³ → 192³ → 256³ ladder run entirely on the GPU, finds the energetics converged at 256³ (ε_max and Z_max to 1 %) while the maximum vorticity rises 60.7 → 108.5 → 138.8, scaling as N^0.85 with no sign of saturation, its Beale–Kato–Majda integral as N^0.6, and the volume-averaged vortex stretching and palinstrophy dissipation triple across the ladder while their difference closes the enstrophy budget — a reconnection bridge below the grid scale at every level reached, under a global resolution criterion (kmax·η ≥ 1.8) that is met. A third study repeats the reconnection at Re = 2000 (Re_Γ ≈ 8 000), where the 256³ level passes every health check at every instant (kmax·η ≥ 2.9), with new instrumentation — a spectrally interpolated maximum reported beside the grid maximum, a periodic-image diagnostic, a worst-instant health verdict and convergence by time window. There the energetics converge by 192³ and the local quantities show the onset of convergence (level-to-level changes of 10–25 % at the last rung with falling exponents, against 20–50 % at Re = 4000) but not convergence: a run that passes every global check still moves its pointwise maximum by 19 % under refinement, and the interpolated maximum shows the bridge core still sharpening with the grid. We conclude that integral energetics converge at resolutions where the local vorticity maximum does not, that the standard global resolution criteria are necessary but not sufficient for pointwise quantities, that the set of trustworthy quantities shrinks in flows that concentrate vorticity into sheets, quantify the cost in each case, and state explicitly that nothing in this work bears on regularity beyond establishing what the instrument can and cannot measure.

**Keywords:** Navier–Stokes regularity; pseudo-spectral DNS; Taylor–Green vortex; vortex reconnection; vortex stretching; verification; Beale–Kato–Majda.

---

## 1. Introduction

### 1.1 Context

The Clay Mathematics Institute problem asks whether smooth, finite-energy solutions of the three-dimensional incompressible Navier–Stokes equations remain smooth for all time, or whether finite-time breakdown can occur (Fefferman, 2000). The question is mathematical; numerical simulation cannot settle it. Simulation can, however, do three things of value: verify that a numerical instrument reproduces the known behaviour of the equations; measure which quantities are and are not computable at a given resolution; and generate candidate relationships — between vorticity amplification, enstrophy, stretching and dissipation — that might later be formulated as inequalities and attacked analytically.

This report documents the first stage of a programme organised around that progression (numerical evidence → verified numerics → resolution-independent pattern → conjecture → inequality → proof). Its scope is deliberately narrow: the construction and verification of the instrument, and one resolution study of the standard benchmark flow.

### 1.2 Relation to the existing engineering tool

NSLab is a mode of Pocket Wind Tunnel, an offline single-file aerofoil analysis tool (subsonic panel method, wind-tunnel wall corrections, compressible RANS with Spalart–Allmaras and k-ω SST turbulence models, hypersonic shock-expansion methods). Those modes form a regression-tested baseline that was frozen before this work (gate G0 of the programme's gate table, `research/nslab/README.md`); none of them is used in the Navier–Stokes experiments, and none of the engineering machinery (compressibility, turbulence closures, aerofoil geometry) enters the research solver.

### 1.3 Contributions

1. A double-precision pseudo-spectral solver for the periodic box, with a home-written mixed-radix FFT, that runs inside a browser and in Node, and an independent GPU implementation (CuPy/cuFFT) that reproduces it to round-off.
2. A verification framework in which every run is graded before any feature in it may be cited, and refinement ladders that grade the convergence of the peaks of ε and max|ω|.
3. A resolution study of the Taylor–Green vortex at Re = 1600 from 24³ to 256³, showing convergence of the dissipation peak to the published value and non-convergence of the maximum vorticity.
4. A resolution study of a Kerr-type antiparallel-vortex-tube reconnection at Re = 4000 (Re_Γ ≈ 16 000) on a 96³ → 192³ → 256³ ladder, entirely on the GPU in double precision, grading the growth of the maximum vorticity and of its Beale–Kato–Majda integral through the event (§6).
5. The same reconnection at Re = 2000 with four new diagnostics — a spectrally interpolated maximum, a periodic-image diagnostic, a worst-instant health verdict and convergence by window — showing the onset but not the attainment of convergence of the local quantities at a level that passes every global check (§6.8).
6. An evidence archive (`research/nslab/`) with build-stamped, reproducible runs.

---

## 2. Governing equations and diagnostics

The equations are solved in non-dimensional form on Ω = [0, 2π]³ with periodic boundary conditions:

∂u/∂t + (u·∇)u = −∇p + ν∇²u,    ∇·u = 0,

with ν = 1/Re, velocity scale 1 and box length 2π. Writing ω = ∇×u, the advection term is evaluated in rotational form (u·∇)u = ω×u + ∇(|u|²/2), the gradient being absorbed into the pressure.

Diagnostics are defined as volume averages (⟨·⟩ = (2π)⁻³∫_Ω · dx):

- kinetic energy E = ½⟨|u|²⟩; enstrophy Z = ½⟨|ω|²⟩; palinstrophy P = ½⟨|∇ω|²⟩;
- dissipation rate ε = 2νZ, which equals −dE/dt exactly for periodic flow;
- maximum vorticity ‖ω‖_∞ = max_x |ω(x, t)| (written max|ω|) and its time integral ∫‖ω‖_∞ dt, the Beale–Kato–Majda (1984) quantity: a smooth solution can lose regularity at time T only if this integral diverges as t → T;
- vortex stretching ⟨ω·S·ω⟩ = ⟨ω_i S_ij ω_j⟩ with S_ij = ½(∂_i u_j + ∂_j u_i), which enters the enstrophy balance dZ/dt = ⟨ω·S·ω⟩ − 2νP;
- the energy spectrum E(k, t) by shell summation; the Kolmogorov scale η = (ν³/ε)^{1/4} and the resolution parameter kmax·η; the Taylor microscale λ and Re_λ;
- the velocity-derivative skewness in two forms: directly, S_d = ⟨(∂_x u)³⟩/⟨(∂_x u)²⟩^{3/2} averaged over the three directions, and through the isotropic relation used by Brachet et al. (1983), S_ω = −(6√15/7)⟨ω·S·ω⟩/⟨|ω|²⟩^{3/2};
- the alignment of ω with the eigenvectors e₁, e₂, e₃ (eigenvalues λ₁ ≥ λ₂ ≥ λ₃) of S, reported as the mean of |cos θ_i| over the grid and as histograms (Ashurst et al., 1987);
- the Q-criterion Q = ¼|ω|² − ½‖∇u‖²_F and the local stretching field ω·S·ω, for visualisation.

---

## 3. Numerical method

### 3.1 Spatial discretisation

Fields are represented by their Fourier coefficients on an N³ grid, û(k), with the real-to-complex half spectrum k_x ∈ [0, N/2]. Derivatives are spectral. The nonlinear term is formed in physical space as u×ω and transformed back; aliasing is removed by the 2/3 rule (Orszag, 1971), retaining |k_i| ≤ k_c = ⌊N/3⌋. Incompressibility is enforced exactly by projection, n̂ ← n̂ − k(k·n̂)/k², applied to the nonlinear term at every evaluation; the mean mode is held at zero. The resulting divergence is at round-off (≤ 10⁻¹⁵) throughout.

The FFT is a mixed-radix (2, 3, 4) Stockham autosort transform written for this work, with real input handled by packing two real lines into one complex line and exploiting Hermitian symmetry in the remaining directions; grid sizes must be of the form 2^a·3^b. The GPU implementation uses cuFFT through CuPy's `rfftn`/`irfftn`.

### 3.2 Time integration

Classical four-stage, fourth-order Runge–Kutta is applied to the full right-hand side P[(u×ω)^] − νk²û. The step is adaptive, Δt = min(C·Δx/u_max, 2.5/(3νk_c²)) with C = 0.4 (the RK4 imaginary-axis stability limit corresponds to C ≈ 0.78), or fixed for temporal-refinement studies. Each step costs 4 × (6 inverse + 3 forward) = 36 real transforms, plus one further right-hand-side evaluation so that the recorded series are exact at t_{n+1}.

### 3.3 Initial conditions

- Taylor–Green vortex (Taylor & Green, 1937; Brachet et al., 1983): u = sin x cos y cos z, v = −cos x sin y cos z, w = 0, with E(0) = 1/8 and Z(0) = 3/8.
- Two-dimensional Taylor–Green vortex, u = sin x cos y, v = −cos x sin y: an exact solution decaying as e^{−2νt}.
- Arnold–Beltrami–Childress flow, u = A sin z + C cos y, v = B sin x + A cos z, w = C sin y + B cos x: a Beltrami field (ω = u) for which the nonlinear term is a pure gradient, so the exact solution is u(0)e^{−νt} in three dimensions.
- Antiparallel vortex tubes: ω_x = −A exp(−r₊²/σ²) + A exp(−r₋²/σ²) about the lines y = π ± d(x), z = π, d(x) = d₀ + δ cos x, with r± the (periodic) distance to each line; made solenoidal by projection and converted to velocity by û = ik×ω̂/k². Defaults A = 8, σ = 0.4, d₀ = 0.7, δ = 0.2, giving a circulation Γ = Aπσ² ≈ 4.0 per tube, E(0) = 0.0703, Z(0) = 0.400. A Kerr-type configuration (antiparallel tubes that approach where the perturbation brings them closest; Kerr, 1993) — not Kerr's profile, box or perturbation — used in §6.
- Random solenoidal field with E(k) ∝ k⁴exp(−2(k/k₀)²), seeded by a bit-exact shared PRNG so that both implementations generate identical fields.

### 3.4 Implementations

The reference implementation (`src/nslab.js`) runs in a browser Web Worker and under Node; a batch runner (`test/run-ns-long.js`) adds checkpoint/resume and continuous output. The GPU implementation (`gpu/nslab_gpu.py`, CuPy 14.2, float64) is a line-for-line port that writes the same output format. Measured costs on the machine used (AMD Ryzen 9 5900HX, NVIDIA RTX 3060 Laptop 6 GB): 32³ 35 ms/step and 64³ 0.3 s/step on one CPU core; 192³ 9.3 s/step on the CPU core and 0.84 s/step on the GPU in float64 (0.20 s/step in float32, which is used only for exploration); 256³ 1.87 s/step on the GPU at 5.98 GB, the card's limit.

---

## 4. Verification framework

### 4.1 Per-run health report

Every run is graded on the following checks (PASS/WARN/FAIL thresholds in parentheses):

| Check | Quantity | PASS / WARN |
|---|---|---|
| Divergence | max\|∇·u\| from spectral derivatives | ≤ 10⁻¹⁰ / 10⁻⁶ |
| Nonlinear energy transfer | \|Re Σ û*·P[(u×ω)^]\| / ε | ≤ 10⁻⁹ / 10⁻⁶ |
| Energy budget | \|ΔE − Simpson(−ε over the four RK4 stage states)\| / E₀, max over steps | ≤ 10⁻⁵ / 10⁻³ |
| Enstrophy budget | same for ΔZ against ⟨ω·S·ω⟩ − 2νP | ≤ 10⁻⁴ / 10⁻² |
| Resolution | kmax·η with kmax = √3 k_c | ≥ 1.0 / 0.5 |
| Spectral tail | E(k_c)/E(k_peak) | ≤ 10⁻⁴ / 10⁻² |
| Stretching consistency | \|⟨ω·S·ω⟩_spectral − ⟨ω·S·ω⟩_physical\| / max(\|·\|, 2νP) | ≤ 10⁻² / 10⁻¹ |
| CFL | u_max Δt/Δx | ≤ 0.8 / 1.2 |

The budget checks use Simpson weights (1, 2, 2, 1)/6 over the stage states of the RK4 step so that they test the discrete scheme rather than a quadrature error of the check itself; on resolved runs they are of order 10⁻⁹–10⁻¹³. The nonlinear-transfer check is exactly zero in exact arithmetic for any dealiasing, because u·(u×ω) = 0 pointwise and Parseval's identity holds on the grid; it is a round-off check. Dealiasing errors appear instead in the enstrophy budget and in the stretching-consistency check, where the spectral estimate Re Σ k²û*·n̂ and the physical-space estimate ⟨ω_iω_j∂_ju_i⟩ differ only through aliasing and truncation.

From GPU runner 0.1.1 (NS-003 onward) the verdict also carries the worst archived snapshot — the minimum kmax·η, the maximum spectral tail and the maximum stretching discrepancy, each with its time — alongside the end-of-run verdict, because the event itself can be the least healthy part of a run whose last snapshot passes (NS-001 and NS-002 both showed this; §6.8 records a level turning from PASS to WARN under the new rule).

### 4.2 Refinement ladders

A study reruns the case on a ladder of grids (or time steps) and reports the level-to-level change of the peak of ε, the peak of max|ω| and E(t_end), with an observed order of convergence; the verdict is PASS when the last change is below 1 % and decreasing.

### 4.3 Verification results

| Test | Result |
|---|---|
| FFT against a direct DFT, N ∈ {12, 16, 24, 32, 48, 64, 96} | max error 7×10⁻¹² |
| 3D real transform round trip (24³) | 1×10⁻¹⁵ |
| ABC exact solution, N = 16, ν = 0.1, t = 1 | L∞ velocity error 3.1×10⁻¹²; energy matches 1.5e^{−2νt} to 3×10⁻¹² |
| RK4 temporal order (Δt = 0.1, 0.05, 0.025) | 4.01, 3.99 |
| 2D Taylor–Green exact decay, t = 1 | 2×10⁻⁹ |
| Divergence; nonlinear energy transfer | 10⁻¹⁶–10⁻³¹; 10⁻¹⁹ |
| TGV initial invariants | E₀ = 1/8, Z₀ = 3/8 exactly; initial ⟨ω·S·ω⟩ = 0 |
| TGV reflection symmetry | direct skewness S_d ≈ 0 throughout (∂_x u is odd under x → π − x, preserved by the equations) |
| Stretching, spectral vs physical, resolved stage | agreement to 10⁻¹⁴ |
| CPU vs GPU, TGV 32³ (26 steps) / ABC 16³ / tubes 24³ | 3×10⁻¹⁵ / 3×10⁻¹⁶ / 6×10⁻¹⁵ in E, Z, ε, max\|ω\| |
| CPU vs GPU, TGV 192³, 770 steps to t = 9 | 3×10⁻¹³ |
| CPU vs GPU, TGV 192³, all 1229 steps to t = 16 (CPU run completed 23:22 on 22 August, 3.23 h) | 4×10⁻¹² in E, Z, ε, max\|ω\| — round-off amplified through the turbulent phase |

All of these are checked automatically by `test/validate-ns.js` (13 s) except the 192³ cross-checks, which were made on the archived runs.

---

## 5. Results: Taylor–Green vortex at Re = 1600

### 5.1 Reference values

Brachet et al. (1983) computed the flow spectrally on an effective 256³ grid using its symmetries and reported a dissipation maximum ε_max ≈ 1.26×10⁻² near t ≈ 9. Later 512³ pseudo-spectral computations (van Rees et al., 2011; the reference solution of the International Workshop on High-Order CFD Methods, DeBonis, 2013; Wang et al., 2013) give ε_max ≈ 0.013 at t ≈ 9. No published reference exists for the maximum vorticity.

### 5.2 Refinement ladder

| N | k_c | steps | wall time | ε_max | t(ε_max) | max\|ω\| peak | t | E(10) | min kmax·η | health |
|---|---|---|---|---|---|---|---|---|---|---|
| 24³ | 8 | 102 | 2 s (CPU) | 0.00631 | 10.07 | 12.49 | 6.5 | 0.0944 | 0.19 | FAIL |
| 32³ | 10 | 146 | 6 s | 0.00780 | 9.25 | 19.34 | 6.2 | 0.0861 | 0.23 | FAIL |
| 48³ | 16 | 207 | 24 s | 0.01189 | 9.65 | 20.87 | 8.3 | 0.0753 | 0.33 | FAIL |
| 64³ | 21 | 271 | 80 s | 0.01339 | 9.17 | 21.87 | 7.6 | 0.0698 | 0.43 | FAIL |
| 96³ | 32 | 427 | 618 s | 0.01386 | 9.25 | 36.98 | 7.5 | 0.0708 | 0.65 | FAIL |
| 192³ | 64 | 1228 | 17 min (GPU) | **0.01314** | **8.85** | **55.10** | 8.88 | 0.0740 | 1.30 | WARN (tail 2.1×10⁻⁴) |
| 256³ | 85 | 1654 | 58 min (GPU) | **0.01291** | **8.88** | **74.28** | 10.07 | 0.0745 | 1.73 | PASS (tail 2.1×10⁻⁴ at the peak instant) |
| reference | | | | 0.0126–0.013 | ≈ 9 | — | | | | |

All runs: CFL 0.4, t ∈ [0, 10] (192³ and 256³: [0, 16]).

### 5.3 Convergence of the dissipation peak

ε_max rises monotonically from 24³ to 64³, overshoots at 96³ (0.0139) and settles at 0.01314 on 192³ — 1.0 % above the 512³ spectral value and 4.2 % above Brachet's 256³ result. The 96³ overshoot is the expected behaviour of an under-resolved spectral computation: with the spectral tail not decayed (E(k_c)/E(k_peak) = 2×10⁻² at 96³) energy accumulates near the truncation, and ε = 2νZ, which weights the high wavenumbers, is over-predicted. At 192³ the resolution parameter stays above 1.30 throughout; the only check not passed is the spectral tail at the peak (2.1×10⁻⁴ against a 10⁻⁴ threshold), i.e. the run is a marginally resolved DNS by the usual standard.

Level-to-level changes in ε between 96³ and 192³ are 0.3–1.0 % up to t = 5, 3–7 % during the cascade (t = 6–9) and 5.5 % at the peak. The energy E(t) changes by ≤ 0.04 % up to t = 5 and 1.6 % at t = 9.

### 5.4 Non-convergence of the maximum vorticity

| t | max\|ω\| 96³ | max\|ω\| 192³ | change |
|---|---|---|---|
| 1–3 | 1.57–3.60 | 1.58–3.62 | 0.5–0.6 % |
| 4 | 12.1 | 13.8 | 12 % |
| 5 | 17.7 | 21.2 | 16 % |
| 6 | 21.1 | 24.7 | 15 % |
| 7 | 23.6 | 33.8 | 30 % |
| 8 | 28.8 | 45.9 | 37 % |
| 9 | 31.0 | 45.1 | 31 % |
| 10 | 22.7 | 45.7 | 50 % |
| peak | 37.0 (t 7.5) | 55.1 (t 8.88) | +33 % |

The maximum vorticity agrees between levels only while the flow is laminar (t ≲ 3). It separates at the moment the cascade reaches the coarser cutoff and the discrepancy grows through the turbulent phase even as the integral quantities converge. The per-step series at 192³ also shows a first burst to 23.1 at t = 4.5 (the roll-up of the vortex sheets) that 96³ rounds off to 17.7. At 192³ the BKM integral ∫₀¹⁶ max|ω| dt = 420; its convergence cannot be assessed from the levels available.

### 5.5 Structural diagnostics

At all resolutions the vorticity aligns preferentially with the intermediate strain eigenvector from t ≈ 3 onward (192³: mean |cos θ₂| = 0.62–0.67 against 0.35–0.48 for e₁ and e₃, persisting through the decay), reproducing the classical result of Ashurst et al. (1987). The enstrophy-production skewness S_ω reaches −0.92 during the organised sheet stage (t ≈ 4–4.5) and lies between −0.54 and −0.67 through the turbulent phase; the direct skewness S_d remains at the 10⁻³ level throughout, as required by the symmetry of the Taylor–Green flow. Spectral and physical-space estimates of ⟨ω·S·ω⟩ agree to five significant figures at 192³ over the whole run, indicating negligible aliasing at that level; at 24³ they differ by 30 %.

### 5.6 The 256³ level

The 256³ run (k_c = 85; 58 min on the GPU in float64 at 5.4 GB of the 6 GB card) is the cleanest of the set: kmax·η ≥ 1.73 throughout, health PASS at the end (the spectral tail reaches 2.1×10⁻⁴ at the peak instant, marginally above the 10⁻⁴ PASS line), budgets 5×10⁻¹⁰ and 4×10⁻⁸, and spectral and physical stretching equal to five figures. Its dissipation peak, ε_max = 0.01291 at t = 8.88, lies 0.7 % below the 512³ spectral reference and 2.5 % above Brachet's value, and 1.7 % below the 192³ peak: the dissipation is converged at the level of the reference scatter. E and ε agree with 192³ to ≤ 1 % through the peak (Table, §5.4 counterpart: Δε 0.1–1.9 % for t ≤ 10).

The maximum vorticity moves again: peak 74.3 at t = 10.07 against 55.1 (192³, t = 8.88) and 37.0 (96³), +26 % per level, and the history becomes more intermittent with resolution (65.7, 41.3, 73.1, 48.7 at t = 9.0, 9.5, 10.0, 10.5 on 256³). Its time integral converges faster than its instantaneous value: ∫₀¹⁰ max|ω| dt = 160, 223, 250 at 96³, 192³, 256³ (+39 %, then +12 %), and ∫₀¹⁶ = 445 at 256³ against 420 at 192³. Resolutions beyond 256³ are not available in double precision on this hardware.

### 5.7 Re = 100

For completeness, a Re = 100 ladder (16³, 24³, 32³; t ∈ [0, 10]) gives ε_max = 0.01258, 0.01281, 0.01295 at t ≈ 4.8 (changes of 1.8 % and 1.1 %) while the max|ω| peak still moves by ≈ 25 % per level (2.80, 3.53, 4.38) — the same separation between integral and local quantities at a Reynolds number where the energetics are resolved at 32³ (kmax·η = 1.6).

---

## 6. Results: antiparallel vortex tubes at Re = 4000 (NS-002)

### 6.1 Design

The second study asks the question §7.1 poses: in a flow built to amplify vorticity — two antiparallel tubes that reconnect — does any growth of max|ω| survive refinement? The initial condition is the tube preset of §3.3 with its default parameters (Γ ≈ 4.0 per tube; one perturbation wavelength along the tubes in the 2π box). The Reynolds number was chosen from three float32 exploration runs at 96³ (t ≤ 16; exploration only, not archived as evidence), with kmax·η at 256³ projected from the 96³ value by the factor 8/3:

| Re | Re_Γ = Γ/ν | max\|ω\| peak (t) | Z_max (t) | ε_max (t) | min kmax·η at 96³ | projected at 256³ |
|---|---|---|---|---|---|---|
| 500 | ≈ 2 000 | 23.7 (10.0) | 0.40 (t = 0; Z decays throughout) | 0.0016 (0) | 2.65 | ≈ 7 |
| 2000 | ≈ 8 000 | 52.3 (8.56) | 0.86 (9.0) | 0.00087 (9.1) | 1.08 | ≈ 2.9 |
| 4000 | ≈ 16 000 | 60.7 (8.44) | 1.32 (11.7) | 0.00067 (11.7) | 0.69 | ≈ 1.8 |

At Re = 500 the cores diffuse (σ_eff = √(σ² + 4νt) ≈ 0.5 by t = 10) before the tubes interact and the enstrophy never exceeds its initial value; at Re = 2000 there is a reconnection but 96³ already resolves it, leaving a ladder nothing to grade; at Re = 4000 the event is the strongest that the card's 256³ double-precision ceiling still resolves, with the bottom rung marginal (WARN) exactly as in NS-001. The pair's self-induced translation Γ/(4πd₀) ≈ 0.46 carries it from z = π to the periodic plane z = 0 by t ≈ 7, which is when the z = 0 slices light up and max|ω| starts to climb. Re_Γ ≈ 16 000 lies in the range of the viscous-reconnection literature (Hussain & Duraisamy, 2011: 9 000; Kerr, 2018: up to 64 000; Yao & Hussain, 2020: up to 40 000), but those studies use different profiles, boxes and perturbations and no quantitative comparison is made.

The archived ladder is 96³, 192³ and 256³ in float64 on the GPU, CFL 0.4, t ∈ [0, 16], snapshots every Δt = 0.5 with slices on z = 0, z = π/2 and x = π/2, checkpoints every 2 time units, launched as one detached sequence (`run-ns002.ps1`).

### 6.2 Refinement ladder

| N | k_c | steps | wall (GPU) | ε_max | t | Z_max | t | max\|ω\| peak | t | ∫₀¹⁰ max\|ω\| dt | ∫₀¹⁶ | min kmax·η | health |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 96³ | 32 | 1118 | 2.4 min | 0.000665 | 11.71 | 1.329 | 11.71 | 60.72 | 8.44 | 180.5 | 324.5 | 0.69 (t 11.5) | WARN (kmax·η; tail 2.3×10⁻³ at the peak) |
| 192³ | 64 | 2348 | 36 min | 0.000679 | 10.00 | 1.357 | 10.00 | **108.52** | 8.26 | 263.9 | 539.9 | 1.37 (t 10) | PASS (budgets 4×10⁻⁸ / 1×10⁻⁵) |
| 256³ | 85 | 3169 | 1.68 h | 0.000684 | 9.50 | 1.369 | 9.50 | **138.82** | 8.25 | 313.9 | 654.2 | 1.81 (t 9.5) | PASS (budgets 2×10⁻⁸ / 9×10⁻⁶; tail 1.0–1.3×10⁻⁴ at t 8.5–9) |

### 6.3 Convergence of the energetics

96³ → 192³: E agrees between the two levels to 0.1 % through t = 10 and 1 % at t = 16. ε agrees to ≤ 2 % up to t = 7, 6 % at t = 8 (the reconnection), 1 % at t = 9 and 5 % at t = 10; the enstrophy peak changes by 2 % (1.329 → 1.357) and moves from t = 11.7 to 10.0. After the peak the levels separate — ε differs by 33–37 % at t = 12–14 — because 96³ holds a broad plateau of dissipation that 192³ does not. That is the truncation bottleneck of §7.2 in a different guise: energy accumulates at an undecayed spectral tail and ε = 2νZ, weighted toward high k, stays high. The WARN grade at 96³ (kmax·η 0.69–0.78 through the event, tail 2×10⁻³) reported it before the comparison did.

192³ → 256³: E agrees to 0.06 % at t = 10; ε to ≤ 0.1 % up to t = 7, 1.8 % at t = 8, 4.6–4.8 % at t = 9–10 and 1–3 % afterwards — the late plateau is gone; ε_max changes by 0.8 % (0.000679 → 0.000684) and Z_max by 0.9 % (1.357 → 1.369), both instants moving from 10.0 to 9.5. By the standard of NS-001 (1.7 % in ε_max between the same levels) the energetics of this flow are converged at 256³.

### 6.4 The maximum vorticity and its integral

| t | max\|ω\| 96³ | max\|ω\| 192³ | max\|ω\| 256³ | 192³ → 256³ (relative to 256³) |
|---|---|---|---|---|
| 6 | 11.0 | 10.4 | 10.1 | 3 % |
| 7 | 16.5 | 16.9 | 17.3 | 2 % |
| 7.5 | 24.7 | 36.1 | 38.4 | 6 % |
| 8 | 44.1 | 72.4 | 71.8 | 1 % |
| 8.25 | 47.9 | 107.9 | 138.8 | 22 % |
| 8.5 | 57.6 | 68.8 | 127.6 | 46 % |
| 9 | 44.6 | 72.7 | 112.3 | 35 % |
| 10 | 34.9 | 87.2 | 94.3 | 8 % |
| 12 | 28.2 | 59.2 | 61.8 | 4 % |
| peak | 60.7 (t 8.44) | 108.5 (t 8.265) | 138.8 (t 8.246) | +79 %, then +28 % |
| ∫₀¹⁰ max\|ω\| dt | 180.5 | 263.9 | 313.9 | +46 %, then +19 % |
| ∫₀¹⁶ max\|ω\| dt | 324.5 | 539.9 | 654.2 | +66 %, then +21 % |

The maximum vorticity does the opposite of converging across the event. The approach is converged — at t = 8.0 the three levels give 44, 72.4 and 71.8, the last two within 1 % — and the whole divergence is in the bridge in the quarter time unit that follows: 47.9, 107.9 and 138.8 at t = 8.25, at an instant that no longer moves (8.44 → 8.265 → 8.246). Where 96³ shows a single smooth hump (57.6 at t = 8.5, then a monotone fall), the finer histories are spiky — 192³: 107.9, 68.8, 81.7, 72.7, 87.2 at t = 8.25, 8.5, 8.75, 9, 10; 256³: 138.8, 127.6, 96.0, 112.3, 94.3 at the same instants — the intermittent, site-hopping maximum of NS-001 again. The spectral tail touches the PASS/WARN boundary at the peak instants at both resolved levels (2.9×10⁻⁴ at 192³, 1.0–1.3×10⁻⁴ at 256³, t = 8.5–9) while the end-of-run verdicts are PASS.

Over the three levels the peak scales as N^0.84 and then N^0.86, and the Beale–Kato–Majda integral as N^0.55 and then N^0.60 — neither exponent is falling. In NS-001 the integral's exponent fell (0.48 → 0.40) over the same levels while the peak's did not; here **the time-integrated maximum has not begun to converge either.** The two sides of the enstrophy budget dZ/dt = ⟨ω·S·ω⟩ − 2νP are themselves unconverged while the budget closes: peak ⟨ω·S·ω⟩ = 0.73, 1.71, 2.48 (+133 %, +46 %), peak 2νP = 0.53, 1.61, 2.41, peak dZ/dt = 0.49, 0.51, 0.61. In NS-001 the same two terms moved by 7 % and 11 % from 192³ to 256³ with dZ/dt unchanged. The production term is an integral by construction, but in a reconnection it lives in the bridge and behaves like a local quantity.

### 6.5 Structure

The slice sequences (`slices-vort-z0.png`, `slices-vort-x48.png` in each run folder) show the pair arriving at the z = 0 plane at t ≈ 7 as a bow-tie with a thin bridging sheet on the centreline — the reconnection bridge, which carries the maximum — and, in the x = π/2 cross-section, the two cores with a trailing sheet behind and a turbulent head ahead. The 96³ frames carry visible spectral ringing around the bridge that 192³ has largely lost. The archived planes do not cut the global maximum: on z = 0 the slice maximum reaches 35 against a volume maximum of 108 at 192³, so the bridge's core lies off those planes (near x = π, where the perturbation makes the separation least). The enstrophy-production skewness S_ω reaches −1.2 through the event (Taylor–Green: −0.9 at most) and the vorticity alignment shifts from the most-stretching eigenvector e₁ before the event (mean |cos θ₁| 0.57–0.60 for t ≤ 4) to the intermediate one e₂ after it (0.55–0.59 for t ≥ 10), the classical turbulent alignment (Ashurst et al., 1987).

### 6.6 Where the maximum lives, and what the ladder says

The maximum on the archived plane z = 0 converges (35.3 at 192³, 33.0 at 256³ around t = 8.5–9) while the volume maximum does not, so the grid-limited structure lies off that plane: the core of the bridge near x = π, where the perturbation brings the tubes closest. On z = 0 the local ω·S·ω reaches ≈ 2 100 against a volume mean of 2.4, a thousandfold concentration along a line (`slices-stretch-z0.png`; ladder comparison `ns002-ladder-stretch-z0-t8.5.png`). The global resolution parameter kmax·η ≥ 1.81 grades the mean dissipation; the bridge is thinner than the scale it describes, which is what the marginal tail at the peak instants is reporting.

Evidence, stated as evidence: in a Kerr-type reconnection at Re_Γ ≈ 16 000 the energetics (E, ε, Z, Z_max, dZ/dt) converge by 256³, while the grid-sampled max|ω|, its Beale–Kato–Majda integral and the stretching and palinstrophy terms do not, and scale as clean powers of N from 96³ to 256³ under a global resolution criterion that is met. The defensible statement is that the global energetics converge substantially while the local stretching/reconnection diagnostics remain resolution-sensitive, which separates the quantities that are already trustworthy from those whose physical interpretation requires further spatial refinement. In NS-001 the Beale–Kato–Majda integral converged faster than the peak; here neither it nor ⟨ω·S·ω⟩ has begun to converge, so no statement about a "middle rung" is made for this flow. Not shown: any growth of vorticity that "survives refinement" in the sense the programme is after, and certainly not a Beale–Kato–Majda integral approaching divergence — the diagnostic itself is resolution-sensitive here. What grows here grows *with* the grid, which is what an under-resolved sheet does; it measures the instrument's reach (the bridge is below the grid scale at 256³, the card's double-precision ceiling), not a property of the equations, and it is not a conjecture.

**Periodic images.** A first reading of this run said that the vorticity "crosses the periodic boundary in z at t ≈ 7" and that the event therefore belongs to the periodically replicated system. The image diagnostic added for NS-003 (§6.8; same initial condition and kinematics) shows that this conflated two things. The enstrophy-carrying band is 3.0–3.5 wide in z from t ≈ 6 and translates at 0.35–0.49 per time unit; its leading edge passes the coordinate plane z = 2π ≡ 0 at t ≈ 6 and its centroid at t ≈ 8.4 — which is why the z = 0 slices light up — but the gap between the band and its own periodic image never falls below 2.7 (about seven core radii) at any resolution or instant. The pair's vorticity never meets its image's. The images act, as in every periodic computation, through the velocity field from t = 0: at the closest approach an image at a distance of ≈ 3 induces a velocity of order Γ/(2π·3) ≈ 0.2 against the pair's self-induced 0.46. The correct caveat is therefore one of box size — the image-induced velocity is ~40 % of the self-induced one throughout, and every number in §6 is for this periodic configuration; a box of 4π in z would halve the effect — not one of a crossing event. The split at t ≈ 7 used in §6.8 remains meaningful for a different reason: it is when the bridge forms, so it separates the laminar approach from the reconnection.

### 6.7 Time-step check

The 96³ level was repeated at CFL 0.2 (2236 steps against 1118; `tubes-Re4000-dtcheck-N96-cfl02-gpu/`). Halving Δt changes the max|ω| peak by 0.002 % (60.719 → 60.720, same instant), ε_max and Z_max by 0.18 %, ∫₀¹⁶ max|ω| dt by 0.13 % and E(16) by 0.006 %; instantaneous differences stay below 0.35 % in ε and 0.6 % in max|ω| except for 2.3 % at t = 12, and the RK4-consistent energy-budget residual falls from 2.8×10⁻⁷ to 4.8×10⁻⁹. The level-to-level differences of §§6.3–6.4 are spatial, not temporal, and CFL 0.4 is an adequate step for this class of run.

### 6.8 NS-003: the same reconnection at Re = 2000

**Question and instrument.** If the bridge is resolved by every check, do the local quantities converge? The same initial condition was run at Re = 2000 (Re_Γ ≈ 8 000) on the same ladder (96³, 192³, 256³; kmax·η 1.08, 2.20, 2.94). Four diagnostics were added to the GPU runner (0.1.1) for this study: slices on x = π, the tubes' closest approach; a spectrally interpolated maximum of |ω| — the exact trigonometric interpolant of the dealiased field maximised by a safeguarded Newton ascent from the largest grid values and local maxima, validated on a sub-cell-shifted Taylor–Green field (grid 1.9856 → 2.000000000000) and against an exact 4×-finer resampling of a 24³ tube field (7.7320 vs 7.7322) — reported beside the grid maximum and never in its place; a per-snapshot periodic-image diagnostic (z-extent of the enstrophy-carrying band, gap to its image, circular centroid); and a health verdict that carries its worst archived instant alongside the end-of-run verdict. `analyse.js` reports convergence by window. The 96³ and 192³ levels were first run on runner 0.1.0 and re-run on 0.1.1 (bit-identical physics; the first pass is archived as `v0-…`).

| N | k_c | steps | wall (GPU) | ε_max (t) | Z_max (t) | max\|ω\| grid peak (t) | interpolated peak (t) | ∫₀¹⁰ max\|ω\| dt | ∫₀¹⁶ | peak ⟨ω·S·ω⟩ | min kmax·η | health worst instant / end |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 96³ | 32 | 1067 | 3.8 min | 0.000874 (9.11) | 0.874 (9.11) | 52.28 (8.56) | 52.77 (8.51) | 162.5 | 270.3 | 0.60 | 1.08 | WARN / WARN (tail 1.8×10⁻³, stretching 1.3×10⁻² at t 9) |
| 192³ | 64 | 2216 | 37 min | 0.000809 (8.84) | 0.809 (8.84) | 92.10 (8.75) | 94.23 (8.73) | 220.8 | 436.8 | 0.83 | 2.20 | WARN / PASS (tail 1.26×10⁻⁴ at t 9) |
| 256³ | 85 | 2919 | 1.68 h | 0.000808 (8.76) | 0.808 (8.76) | **109.36** (8.77) | **115.91** (8.74) | 245.5 | 477.2 | 1.03 | 2.94 | **PASS / PASS** (tail ≤ 2.7×10⁻⁵ throughout) |

**Convergence by window** (maximum level-to-level difference over the window; BKM integral over the window):

| levels | window | max Δε | max ΔE | max Δmax\|ω\| | ∫ max\|ω\| dt | Δ∫ |
|---|---|---|---|---|---|---|
| 96³ → 192³ | 0 ≤ t ≤ 7 | 0.4 % | 0.01 % | 12 % | 64.1 → 63.2 | −1.4 % |
| 96³ → 192³ | 7 ≤ t ≤ 16 | 9.0 % | 0.21 % | 71 % | 205.9 → 373.4 | +81 % |
| 192³ → 256³ | 0 ≤ t ≤ 7 | 0.0 % | 0.00 % | 2.7 % | 63.2 → 63.3 | +0.1 % |
| 192³ → 256³ | 7 ≤ t ≤ 16 | 4.1 % | 0.10 % | 31 % | 373.4 → 413.8 | +10.8 % |

**Energetics.** Converged by 192³: ε_max changes by 0.2 % and Z_max by 0.1 % between 192³ and 256³, E by 0.00 % through t = 10 and 0.1 % at t = 16, and ε by ≤ 2 % at every sampled instant after the event. The 96³ level overshoots the dissipation peak by 8 % — the truncation bottleneck of §7.2, caught by its WARN — so the bottom rung is not a resolved level at this Reynolds number either, despite kmax·η = 1.08.

**Local quantities: the onset of convergence, not convergence.** The grid peak goes 52.3 → 92.1 → 109.4 (+76 %, +19 %; exponents 0.82 then 0.60, against 0.84 → 0.86 at Re = 4000); the BKM integral to t = 10 goes 162.5 → 220.8 → 245.5 (+36 %, +11 %; exponents 0.44 → 0.37, as NS-001's 0.48 → 0.40); the peak stretching 0.60 → 0.83 → 1.03 (+38 %, +24 %), the peak palinstrophy dissipation 0.48 → 0.85 → 1.06, the peak dZ/dt 0.25 → 0.25 → 0.28. Before the bridge forms (t ≤ 7) everything is converged between 192³ and 256³, the pointwise maximum (2.7 %) and its integral (0.1 %) included; after it the maximum still differs by up to 31 % and its integral by 11 %. Against NS-002's 192³ → 256³ (post-event Δε 11 %, Δmax|ω| 46 %, Δ∫ 24 %) every local number is better by a factor of two to three and every exponent is falling. But a level that passes every health check at every instant, with kmax·η ≥ 2.94, still moves its maximum by 19 % at the last refinement: **passing the global resolution checks at every instant is necessary, not sufficient, for the pointwise quantities; only the ladder grades them.** A 384³ rung — beyond this card in double precision — is what would show whether the sequence flattens.

**The interpolated maximum: the core is still sharpening.** The interpolated peak exceeds the grid peak by 0.9 %, 2.3 % and 6 % at 96³, 192³ and 256³, and has its own ladder 52.8 → 94.2 → 115.9 (+78 %, +23 %; exponents 0.84 → 0.72). For a resolved structure that correction would shrink with N; it grows, i.e. the peak structure sharpens relative to the grid at every refinement. Its position at 256³, (3.28, 3.11, 0.82), is the head of the bridge: within 0.14 of the plane x = π, on the symmetry plane y = π, at z ≈ 0.8 after the pair has travelled ≈ 4 from z = π at ≈ 0.45 per time unit. The x = π slices show the bridge as a sheet in the plane y = π, one or two cells thick at every resolution, with ω·S·ω ≈ 8 000 on that plane against a volume mean of 1.0; the plane catches 70 % of the volume maximum (71 against 103 at t = 8.5), where the planes archived for NS-002 caught a quarter.

**A fit-free resolution signature.** At every archived snapshot the analysis now reports the cutoff pile-up, max E(k)/E(0.8 k_c) over [0.8 k_c, k_c]: above 1 the spectrum turns up again at the dealiasing edge, i.e. energy accumulates at the truncation even while E(k_c)/E(k_peak) passes its threshold. The Taylor–Green run at 256³ never does so after the sheet roll-up (1.19 at t = 3.5, then 1.00 through the cascade); both tube runs do so during the bridge event — NS-002 at 256³ reaches 2.55 at t = 9, NS-003 reaches 2.10 at 192³ and 1.78 at 256³ — and return to 1.00 by t = 12. This is the spectral counterpart of the unconverged maximum: the bridge feeds energy to the cutoff at every resolution reached, a reconnection-specific signature absent from the cascade, and it will become a row of the health report (pile-up > 1.2 → WARN). An analyticity-strip width δ(t) (E(k) ∝ k^{−n} e^{−2δk}; Sulem, Sulem & Frisch 1983; Bustamante & Brachet 2012) was also fitted; with k_c ≤ 85 the dissipation-range window spans less than a decade in k, the exponent and the width trade off, and the estimate contradicts well-resolved instants, so it is not reported — strip analyses in the literature use 1024³ and beyond for this reason.

**Periodic images.** The diagnostic gives the correction recorded in §6.6: the band's leading edge passes z = 0 at t ≈ 6 and its centroid at t ≈ 8.4, but the gap to its periodic image is ≥ 2.7 at every level and instant, re-opening to 3.0–3.3 after t ≈ 8.5 as the bridge compacts the enstrophy in z. The image effect is a continuous velocity-field effect of order 40 % at closest approach — a box-size limitation (§8.7), not a crossing.

**Conclusion.** Reducing Re_Γ from ≈ 16 000 to ≈ 8 000 substantially improves the refinement behaviour of the reconnection event. The global energetics become resolved by 192³, and the pre-bridge vorticity evolution is already closely converged between 192³ and 256³. The remaining refinement sensitivity is concentrated in the reconnection bridge, where the pointwise maximum vorticity, its time integral and the vortex-stretching production continue to increase with resolution. The falling refinement exponents are evidence of an approach toward convergence, but the 256³ sequence is not yet converged. NS-003 therefore provides no basis for interpreting the growing ‖ω‖_∞ as physical blow-up; it demonstrates a progressively better-resolved but still numerically unresolved local reconnection structure, and it shows that the standard global resolution criteria — kmax·η, spectral tail, budget closure, stretching consistency — can all pass at every instant while a pointwise maximum is still 20 % from converged. Not shown: any resolution-independent growth, any self-similar collapse, anything about the equations.

---

## 7. Discussion

### 7.1 Integral versus local quantities

The central empirical finding is a quantitative version of something qualitatively well known: the quantities that converge first are the integral ones. At 192³ and 256³ the dissipation peak — the benchmark by which Taylor–Green computations are normally judged — matches the literature to 1 %, but the maximum vorticity rises by a quarter to a third at every refinement (74 at 256³), and its history becomes spikier rather than smoother. Between those two sits the Beale–Kato–Majda integral, which changes by 12 % between the two finest levels: the ordering energetics → ∫‖ω‖_∞ dt → ‖ω‖_∞ itself is the measured hierarchy of what a DNS of this size can be trusted on. For the regularity question this is the relevant observation: the Beale–Kato–Majda criterion is a statement about ‖ω‖_∞, not about E or Z, and a computation that is "converged" by every conventional measure can still be far from converged in the one norm that matters. Any claim of vorticity growth in a more aggressive configuration (antiparallel tubes, the initial data of Kerr, 1993, or Hou & Li, 2006) must therefore be judged against a refinement ladder in max|ω| itself, with the health report at PASS; the energetics are not a proxy. NS-002 (§6) made exactly that test on a reconnection and found the hierarchy sharper, not softer: there the integral of the maximum and even the volume-averaged stretching term scale with the grid while the energetics stand still, so in a flow that concentrates its vorticity into a sheet the set of quantities a 256³ computation can vouch for is smaller than in a cascade. The ordering is the same; the boundary between trusted and untrusted moves with the flow.

### 7.2 The overshoot at 96³

That an under-resolved spectral run over-predicts dissipation before converging from above is a useful diagnostic pattern: monotone approach from below, then a reversal, is the signature of the truncation bottleneck, and the spectral-tail check catches it before the comparison with a reference does. A single run that lands near a published value is not evidence of resolution; 64³ landed within 1 % of the reference with kmax·η = 0.43.

### 7.3 Two instruments

The CPU and GPU implementations were written independently of each other's code paths (a hand-written FFT in one, cuFFT in the other; different reduction orders) and agree to 10⁻¹³ at full resolution. That agreement is what allows a GPU result, obtained in 17 minutes, to stand as evidence on the same footing as the 3.2-hour CPU run. Float32 GPU runs, four times faster again, are deliberately excluded from the archive: their verification floors (~10⁻⁶) sit where the budget checks and the vorticity extremes live.

### 7.4 An instrument-characterisation experiment

Taken together, NS-001, NS-002 and NS-003 are not three simulations but one experiment on the instrument: Reynolds number → resolution requirement → diagnostic convergence. NS-002 showed that raising Re_Γ to ≈ 16 000 pushes the local reconnection event beyond the reach of a 256³ double-precision computation while its energetics stay resolved; NS-003 showed that lowering Re_Γ to ≈ 8 000 brings the event back toward the resolvable regime — energetics resolved at 192³, pre-bridge dynamics converged, refinement exponents falling — but not far enough for the bridge itself. The decisive question this poses is narrower and more useful than "run a larger simulation": at Re_Γ ≈ 8 000, does ‖ω‖_∞ flatten between 256³ and a finer rung? A positive answer would be the beginning of a genuine convergence demonstration for a reconnection; a negative one would establish that even Re = 2000 requires finer resolution around the bridge than a uniform 256³ grid provides. The hardware answer (§8.1) is that 384³ does not fit the available card in any precision, while 320³ does in single precision; the test is therefore a single-precision exploration ladder 256³ → 288³ → 320³ anchored on the double-precision 256³ level, which by the precision policy of §3.4 is not evidence grade but is adequate to ask whether the sequence flattens.

### 7.5 What this does not show

Nothing here constrains the regularity of the Navier–Stokes equations. The Taylor–Green flow at Re = 1600 is smooth; the instrument has reproduced its known behaviour and measured the cost of its local maxima. The candidate-inequality and proof stages of the programme have not begun, and when they do, the role of simulation will remain that of a conjecture generator whose outputs must survive refinement before they are written down as statements.

---

## 8. Limitations

1. Resolution: 256³ is the double-precision ceiling of the available GPU. The energetics are resolved there by every check in both studies; max|ω| is not, and the rate at which it is still moving (+26 % per 4/3 refinement in the Taylor–Green cascade, +28 % in the reconnection, where it scales as N^0.85 over the whole ladder) says it needs far more. In the reconnection the bridge is below the grid scale at every level reached.
2. Geometry: the periodic box only; no walls. The conclusions about the Clay problem's bounded-domain and whole-space formulations rest on the periodic case being representative, which is itself an assumption.
3. Time integration is explicit; very high Reynolds numbers would need an integrating factor or semi-implicit viscous treatment.
4. max|ω| is sampled on the grid; sub-grid maxima of a smooth field are not reconstructed. A spectral interpolation of the maximum would tighten this.
5. Two flows have been studied at a research resolution, one of them at a single Reynolds number. The alignment and skewness statistics are consistent with the literature but have not been compared quantitatively to published PDFs, and the tube configuration has no published twin: its ladder is its only grade.
6. The archived slice planes (z = 0, z = π/2, x = π/2) do not cut the reconnection bridge's core, so the structure that carries the maximum is seen only indirectly; planes through x = π would.
7. The tube box is 2π with one perturbation wavelength along the tubes. The pair's vorticity never meets its periodic image (gap ≥ 2.7 at every level and instant, §6.8), but the image-induced velocity is of order 40 % of the self-induced translation at the closest approach, so every tube result is for this periodic configuration and a 4π box in z would be needed to halve the effect. Kerr (1993) and the reconnection literature use longer boxes and different profiles; no number here is comparable with theirs.
8. The health verdict is the verdict at the end of the run; at the peak instants of both studies the spectral-tail check sits on the PASS/WARN boundary. The verdict should carry the worst snapshot, which is an instrument change for the next version.

---

## 9. Conclusions and next steps

NSLab is a verified double-precision pseudo-spectral instrument for the periodic-box Navier–Stokes equations, available in a browser and on a GPU, that grades its own runs and its own refinement studies. On the Taylor–Green vortex at Re = 1600 it reproduces the published dissipation peak to 1 % at 192³ and 256³ and demonstrates that the maximum vorticity is not converged at either (37.0 → 55.1 → 74.3), while its time integral — the Beale–Kato–Majda quantity — converges faster (+12 % at the last step). On a Kerr-type antiparallel-tube reconnection at Re = 4000 (Re_Γ ≈ 16 000), run entirely on the GPU, the energetics converge by 256³ (ε_max and Z_max to 1 %) while the maximum vorticity climbs 60.7 → 108.5 → 138.8 (∝ N^0.85), its integral climbs with it (∝ N^0.6), and the two sides of the enstrophy budget triple across the ladder as the budget itself closes: a sheet-like structure below the grid scale at every level reached. At Re = 2000, with the bridge resolved by every instantaneous check at 256³, the energetics converge by 192³ and the local quantities begin to converge — falling exponents, 10–25 % at the last rung — but do not: the global resolution criteria are necessary, not sufficient, for pointwise quantities. None of the three studies shows a resolution-independent growth of vorticity; each measures, in numbers, which quantities a computation of this size can vouch for. Gates G0–G4 of the programme are closed, G5 (a reproducible archive) holds three studies, and G6 (a resolution-independent phenomenon) has not been reached.

Next steps, in order: (i) a 384³ rung of NS-003 in single precision, for exploration only, to see whether the Re = 2000 sequence flattens; (ii) the analyticity-strip width δ(t) computed retroactively from every archived spectrum, and sup_t‖u‖_{L³} along every run; (iii) a box of 4π in z to halve the image-induced velocity; (iv) an analysis module that computes, along every archived run, the BKM integral, dZ/dt and the observed constant in the rigorous bound dZ/dt ≤ cZ³/ν³ (Doering & Foias, 2002; Lu & Doering, 2008), and fits candidate scalings across resolutions and Reynolds numbers (Kerr, 2018, reports a √ν-scaling of the enstrophy through reconnection that a Reynolds-number ladder could test); (v) float32 384³ runs for exploration only, to see whether the N^0.85 law continues.

---

## References

- Ashurst, W. T., Kerstein, A. R., Kerr, R. M. & Gibson, C. H. (1987). Alignment of vorticity and scalar gradient with strain rate in simulated Navier–Stokes turbulence. *Physics of Fluids* 30, 2343–2353.
- Beale, J. T., Kato, T. & Majda, A. (1984). Remarks on the breakdown of smooth solutions for the 3-D Euler equations. *Communications in Mathematical Physics* 94, 61–66.
- Brachet, M. E., Meiron, D. I., Orszag, S. A., Nickel, B. G., Morf, R. H. & Frisch, U. (1983). Small-scale structure of the Taylor–Green vortex. *Journal of Fluid Mechanics* 130, 411–452.
- Canuto, C., Hussaini, M. Y., Quarteroni, A. & Zang, T. A. (2006). *Spectral Methods: Fundamentals in Single Domains*. Springer.
- DeBonis, J. R. (2013). Solutions of the Taylor–Green vortex problem using high-resolution explicit finite difference methods. NASA/TM-2013-217850; AIAA 2013-0382.
- Doering, C. R. & Foias, C. (2002). Energy dissipation in body-forced turbulence. *Journal of Fluid Mechanics* 467, 289–306.
- Fefferman, C. L. (2000). Existence and smoothness of the Navier–Stokes equation. Clay Mathematics Institute problem description.
- Hussain, F. & Duraisamy, K. (2011). Mechanics of viscous vortex reconnection. *Physics of Fluids* 23, 021701.
- Kerr, R. M. (2018). Enstrophy and circulation scaling for Navier–Stokes reconnection. *Journal of Fluid Mechanics* 839, R2.
- Yao, J. & Hussain, F. (2020). A physical model of turbulence cascade via vortex reconnection sequence and avalanche. *Journal of Fluid Mechanics* 883, A51.
- Hou, T. Y. & Li, R. (2006). Dynamic depletion of vortex stretching and non-blowup of the 3-D incompressible Euler equations. *Journal of Nonlinear Science* 16, 639–664.
- Kerr, R. M. (1993). Evidence for a singularity of the three-dimensional, incompressible Euler equations. *Physics of Fluids A* 5, 1725–1746.
- Lu, L. & Doering, C. R. (2008). Limits on enstrophy growth for solutions of the three-dimensional Navier–Stokes equations. *Indiana University Mathematics Journal* 57, 2693–2727.
- Orszag, S. A. (1971). On the elimination of aliasing in finite-difference schemes by filtering high-wavenumber components. *Journal of the Atmospheric Sciences* 28, 1074.
- Taylor, G. I. & Green, A. E. (1937). Mechanism of the production of small eddies from large ones. *Proceedings of the Royal Society A* 158, 499–521.
- van Rees, W. M., Leonard, A., Pullin, D. I. & Koumoutsakos, P. (2011). A comparison of vortex and pseudo-spectral methods for the simulation of periodic vortical flows at high Reynolds numbers. *Journal of Computational Physics* 230, 2794–2805.
- Wang, Z. J. et al. (2013). High-order CFD methods: current status and perspective. *International Journal for Numerical Methods in Fluids* 72, 811–845.

---

## Appendix A — Reproduction

All commands run from the `pocket-wind-tunnel/` directory of the repository.

```
node build.js --verify                      # builds the application; refuses if a fast suite fails
node test/validate-ns.js                    # §4.3 verification suite (13 s)
node test/bench-ns.js 1600 10 24,32,48,64 out.json      # refinement ladder (CPU)
node test/run-ns-long.js --N 192 --Re 1600 --tEnd 16 --out <dir>          # CPU long run with checkpoints
python gpu/nslab_gpu.py --N 192 --Re 1600 --tEnd 16 --out <dir>           # GPU float64 long run
python gpu/nslab_gpu.py --N 32 --Re 1600 --tEnd 2 --compare <cpu final.json>   # cross-instrument check
python gpu/nslab_gpu.py --N 192 --ic tubes --Re 4000 --tEnd 16 --out <dir>    # NS-002 level (run-ns002.ps1 runs 96/192/256 in sequence)
python gpu/nslab_gpu.py --N 96 --ic tubes --Re 2000 --tEnd 16 --fp32 --out <dir>   # exploration only (float32), as in §6.1
node ../research/nslab/analyse.js <dir>     # peak, BKM-integral and level-comparison tables, analysis.md / analysis.svg
node ../research/nslab/slice-png.js <dir> --plane z0 --times 6,7.5,8,8.5,9,10   # slice strips as PNG
```

In the application, NSLab mode exposes the same solver interactively (grid 16³–128³, all initial conditions, single runs and refinement ladders, slice fields, histories, the enstrophy budget, the spectrum, alignment PDFs and the health report) and exports the evidence dossier as JSON.

## Appendix B — Data inventory (`research/nslab/`)

| Path | Content |
|---|---|
| `README.md` | programme, gate table, run summaries |
| `taylor-green-Re1600/ladder-24-32-48-64.json`, `ladder-96.json` | CPU ladders: per-step series, snapshots every Δt = 1, health |
| `taylor-green-Re100/ladder-16-24-32.json` | Re 100 ladder |
| `tgv-Re1600-N192/` | CPU 192³ run (`run.log`, `partial.json`/`final.json`, `slices/*.f32`, checkpoints) |
| `tgv-Re1600-N192-gpu/` | GPU 192³ run, `analysis.md`, `analysis.svg` |
| `tgv-Re1600-N256-gpu/` | GPU 256³ run, `analysis.md`, `analysis.svg` |
| `tubes-Re4000-N96-gpu/`, `-N192-gpu/`, `-N256-gpu/` | NS-002 ladder (GPU float64): `final.json`, `slices/*.f32`, `analysis.md`/`.svg`, `slices-vort-*.png` |
| `tubes-Re4000-dtcheck-N96-cfl02-gpu/` | NS-002 time-step check (96³, CFL 0.2) |
| `tubes-Re2000-N96-gpu/`, `-N192-gpu/`, `-N256-gpu/` | NS-003 ladder (runner 0.1.1): x = π slices, `omMaxI`/`peakTrack`, image diagnostic, worst-instant health |
| `v0-tubes-Re2000-N96-gpu/`, `v0-…-N192-gpu/` | NS-003 first pass on runner 0.1.0 (identical physics) |
| `ns002-ladder-*.png`, `ns003-ladder-*.png` | ladder comparison strips (§§6.6, 6.8) |
| `analyse.js`, `slice-png.js` | analysis script (finds the other levels of a case by folder name; BKM integrals); slice renderer |
| `run-192.ps1`, `run-ns002.ps1` | detached launchers: NS-001 CPU 192³; NS-002 GPU ladder |

Slices are Float32 N×N row-major arrays of |ω|, Q and ω·S·ω on the planes z = 0, z = π/2 and x = π/2 at every snapshot.

## Appendix C — 192³ snapshot table (GPU run, selected)

| t | E | Z | ε | max\|ω\| | ⟨ω·S·ω⟩ | kmax·η | S_ω | \|cos\| e₁/e₂/e₃ | E(k_c)/E(k_peak) |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 0.12500 | 0.375 | 4.69×10⁻⁴ | 2.00 | 0.000 | 2.98 | 0.000 | 0.43/0.60/0.43 | 5×10⁻³⁴ |
| 2.01 | 0.12391 | 0.569 | 7.11×10⁻⁴ | 1.87 | 0.237 | 2.68 | −0.648 | 0.60/0.46/0.25 | 4×10⁻¹² |
| 4.01 | 0.12148 | 1.668 | 2.09×10⁻³ | 14.06 | 1.674 | 2.05 | −0.912 | 0.35/0.65/0.42 | 4×10⁻⁶ |
| 6.01 | 0.11352 | 4.483 | 5.60×10⁻³ | 24.93 | 4.376 | 1.60 | −0.541 | 0.37/0.67/0.39 | 6×10⁻⁵ |
| 8.01 | 0.09799 | 8.418 | 1.05×10⁻² | 45.89 | 13.211 | 1.37 | −0.635 | 0.42/0.63/0.38 | 5×10⁻⁴ |
| 9.00 | 0.08592 | 10.355 | 1.29×10⁻² | 45.12 | 17.290 | 1.30 | −0.609 | 0.43/0.63/0.38 | 1×10⁻³ |
| 10.01 | 0.07381 | 9.153 | 1.14×10⁻² | 46.05 | 13.784 | 1.34 | −0.584 | 0.44/0.63/0.37 | 8×10⁻⁴ |
| 12.00 | 0.05348 | 6.843 | 8.55×10⁻³ | 37.14 | 8.306 | 1.44 | −0.545 | 0.46/0.64/0.35 | 7×10⁻⁴ |
| 16.01 | 0.03066 | 2.911 | 3.64×10⁻³ | 17.04 | 2.182 | 1.78 | −0.516 | 0.48/0.63/0.34 | — |

---

*Numerical evidence only. Nothing in this report is a proof of global regularity or of finite-time breakdown of the Navier–Stokes equations.*
