<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Build-Me-Anything/.github/main/profile/assets/hero-dark.png">
  <img alt="Build Me Anything — an offline wind tunnel that grew a verified Navier–Stokes laboratory" src="https://raw.githubusercontent.com/Build-Me-Anything/.github/main/profile/assets/hero-light.png">
</picture>

<br>

[![The logbook](https://img.shields.io/badge/logbook-build--me--anything.github.io-1c8fb5?style=for-the-badge)](https://build-me-anything.github.io)
[![Build](https://img.shields.io/github/actions/workflow/status/Build-Me-Anything/Build-Me-Anything.github.io/pages.yml?style=for-the-badge&label=site%20build)](https://github.com/Build-Me-Anything/Build-Me-Anything.github.io/actions)
[![Evidence only](https://img.shields.io/badge/claims-numerical%20evidence%20only-5b6b80?style=for-the-badge)](https://build-me-anything.github.io/posts/rules-for-an-amateur-attack.html)

</div>

---

> *"Build me anything. You can download any free tool you like."*

That was the whole brief, given to an AI on 21 August 2026 along with a CV. What came back was a wind tunnel in
an HTML file. Two days later it had grown a verified Navier–Stokes laboratory, and the open question sitting at
the top of the ladder it had accidentally built was a Millennium problem.

Nobody set out to work on the Clay problem. The instrument got trustworthy first, and the problem was what
happened to be at the top. Everything since has been about rungs much lower down — and finding that even those
are further apart than they look.

## What is here

|  |  |
|---|---|
| 🌀 **The Pocket Wind Tunnel** | An offline aerodynamics toolkit in **a single 376 kB HTML file**. Opens from disk: no network, no framework, no dependencies, no build step. Panel method with an integral boundary layer, wind-tunnel wall corrections, 2D compressible RANS (Spalart–Allmaras, k-ω SST), hypersonic shock-expansion, and a local-LLM assistant that never leaves the machine. |
| 🔬 **NSLab** | The Navier–Stokes Regularity Laboratory. A Fourier pseudo-spectral solver for the 3D incompressible equations on the periodic box — implemented **three times** (browser, Node, CuPy on a GPU) in double precision, agreeing to 3·10⁻¹⁵ on small cases and 4·10⁻¹² over 1229 steps at 192³. |
| 📖 **The logbook** | The programme written up in public, at **[build-me-anything.github.io](https://build-me-anything.github.io)** — generated from the run archive, so a post about an experiment still running refreshes itself. |

## The result so far

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Build-Me-Anything/.github/main/profile/assets/peaks-dark.png">
  <img alt="Peak maximum vorticity against grid resolution, log–log, for the three studies — none of them flat" src="https://raw.githubusercontent.com/Build-Me-Anything/.github/main/profile/assets/peaks-light.png">
</picture>

</div>

The integral quantities of these flows are measurable on this hardware. The one a regularity argument would
actually need — the maximum vorticity — is not.

| Study | Flow | What it measured |
|:--|:--|:--|
| **NS-001** | Taylor–Green, Re 1600 | Dissipation peak converged to **0.7 %** of the published 512³ reference. Maximum vorticity did not: 37.0 → 55.1 → 74.3 |
| **NS-002** | Antiparallel vortex tubes, Re_Γ ≈ 16 000 | Energetics converged to ~1 %; peak vorticity 60.7 → 108.5 → 138.8, **N^0.85**, no sign of saturating |
| **NS-003** | The same tubes at Re_Γ ≈ 8 000 | 52.3 → 92.1 → 109.4 — the **first falling exponent**, N^0.82 → N^0.60. The 256³ level passes every health check at its *worst* instant and its peak is still 19 % high |

Every run is graded by a health report before any number from it may be quoted — divergence, exact energy
conservation of the nonlinear term, RK4-consistent energy and enstrophy budgets, kmax·η, spectral-tail decay,
and two independently computed estimates of vortex stretching that must agree. Above that sit refinement
ladders: the same case at three resolutions, every peak's level-to-level change quoted as a percentage.

The programme runs as a gate ladder, **G0 → G9**, from "existing solvers regression-tested" to "proof closes the
Clay formulation". It sits at the boundary of **G5 and G6** — and G6, a phenomenon that survives refinement,
has not been reached.

## The rule

> **Numerical evidence only.** Nothing here is a proof of global regularity or of finite-time breakdown of the
> Navier–Stokes equations, and nothing here is a claim on the Clay Millennium Prize. Where a quantity is
> described as growing, it means *a number computed on a finite grid grows* — and every time that has happened
> so far, the honest reading has been that the grid ran out.

Vorticity growth is judged on the Beale–Kato–Majda integral across a refinement ladder, never on a single peak.
No conclusion is recorded that the health report or the ladder did not support.

---

<div align="center">
<sub>

Built by Michael, an aeronautical engineer, with Claude (Anthropic) as instrument builder and analyst.<br>
The experiment design, the physics judgement and every decision about what may be claimed are the author's.<br>
The work is only worth reading because it can be checked — and it is built so that it can be.

</sub>
</div>
