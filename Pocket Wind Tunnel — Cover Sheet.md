# THE POCKET WIND TUNNEL

## An offline aerodynamics toolkit that grew a verified Navier–Stokes laboratory

**Project cover sheet** · version 0.5.0 · 23 August 2026

---

| | |
|---|---|
| **Project** | The Pocket Wind Tunnel (PWT) |
| **Research programme** | NSLab — the Navier–Stokes Regularity Laboratory |
| **First study** | NS-001 — Taylor–Green vortex resolution study, Re = 1600 |
| **Second study** | NS-002 — antiparallel vortex-tube reconnection, Re = 4000 (Re_Γ ≈ 16 000), 96³ → 256³ on the GPU |
| **Third study** | NS-003 — the same reconnection at Re = 2000 (Re_Γ ≈ 8 000), with interpolated maxima, image diagnostic and worst-instant verdicts |
| **Principal investigator** | Michael — aeronautical engineer |
| **Instrument development, verification and analysis** | Claude (Anthropic) |
| **Deliverable** | `pocket-wind-tunnel/Pocket Wind Tunnel.html` — one 376 kB file, runs from disk, no network, no dependencies |
| **Batch layer** | `test/run-ns-long.js` (CPU, Node) · `gpu/nslab_gpu.py` (CuPy, float64, RTX 3060) |
| **Evidence archive** | `research/nslab/` — build-stamped runs, ladders, dossiers, analyses |
| **Versions** | Pocket Wind Tunnel 0.5.0 · NSLab 0.1.0 · GPU runner 0.1.1 |
| **Verification** | five suites — `validate`, `validate-hyper`, `validate-tunnel`, `validate-ns`, `validate-cfd` — ALL PASS; `node build.js --verify` refuses to build otherwise |

---

## What it is

A single self-contained web page that carries five analysis modes — four engineering methods for two-dimensional aerofoils and one research instrument for the three-dimensional incompressible Navier–Stokes equations — each validated against published data, with a tool-bound local language model as an experiment assistant. Everything runs on the machine in front of you; nothing leaves it.

| Mode | Physics | Validated against |
|---|---|---|
| Subsonic | Hess–Smith panel method + Thwaites / Michel / Head integral boundary layer | Abbott & von Doenhoff; wind-tunnel Cd |
| Tunnel | Same section between walls (method of images) + Barlow–Rae–Pope corrections | exact image theory; blockage charts |
| CFD | 2D compressible RANS, Spalart–Allmaras or k-ω SST, Roe/MUSCL finite volume, LU-SGS | NASA Turbulence Modeling Resource; AGARD 211 |
| Hypersonic | US76 atmosphere, exact oblique shock / Prandtl–Meyer, shock-expansion, Newtonian, aerothermal | NACA Report 1135 |
| NSLab | 3D periodic-box Navier–Stokes, Fourier pseudo-spectral, RK4, health report, refinement ladders | exact solutions; Brachet et al. 1983; 512³ spectral DNS |

## The research programme

NSLab is stage one of a programme aimed, in the long run, at the Clay Millennium problem on the existence and smoothness of Navier–Stokes solutions:

numerical evidence → verified numerics → resolution-independent pattern → conjecture → inequality → proof

The instrument can supply the first two arrows. It produces evidence and conjectures; it cannot produce proofs, and nothing it outputs is presented as one.

| Gate | Requirement | Status |
|---|---|---|
| G0 | Engineering solvers regression-tested, baseline frozen | done |
| G1 | 3D discretisation verified (exact solutions 3×10⁻¹², RK4 order 4.0, ∇·u 10⁻¹⁶) | done |
| G2 | Taylor–Green reproduced (ε_max within 1 % of the 512³ reference at 192³) | done for the energetics; max\|ω\| not converged |
| G3 | Grid / time-step refinement automated with verdicts | done |
| G4 | Vorticity / stretching diagnostics validated | done |
| G5 | Reproducible long-time experiments archived | done for NS-001 (24³ … 256³), NS-002 and NS-003 (96³ … 256³) |
| G6–G9 | Resolution-independent phenomenon → inequality → proof | not started |

## Headline numbers

- NACA 0012, M 0.15, Re 6×10⁶, α 10°: Cl 1.107 (SA) / 1.107 (SST) against TMR 1.091 / 1.080.
- Taylor–Green, Re 1600, 256³: ε_max = 0.01291 at t = 8.88 — Brachet 0.0126, 512³ spectral ≈ 0.013; CPU and GPU implementations agree to 3×10⁻¹³.
- Maximum vorticity: 37.0 → 55.1 → 74.3 from 96³ to 256³ — the quantity the Beale–Kato–Majda criterion controls is the one that has not converged.
- Antiparallel tubes, Re 4000, 96³ → 256³ on the GPU: ε_max and Z_max converge to 1 % while max\|ω\| climbs 61 → 109 → 139 (∝ N^0.85) and the stretching term triples — a reconnection bridge thinner than the grid at kmax·η = 1.8. Evidence about the instrument's reach, not about the equations.
- The same reconnection at Re 2000, bridge resolved by every instantaneous check (kmax·η ≥ 2.9): energetics converged by 192³, max\|ω\| 52 → 92 → 109 with falling exponents — the onset of convergence, not convergence. Global resolution criteria are necessary, not sufficient, for pointwise quantities.

## Document set

| Document | Location |
|---|---|
| NSLab Research Report (academic structure) | `research/nslab/NSLab Research Report.md` / `.docx` |
| Research archive and gate table | `research/nslab/README.md` / `.docx` |
| NS-001 analyses (192³, 256³) | `research/nslab/tgv-Re1600-N{192,256}-gpu/analysis.md` / `.docx` |
| NS-002 analyses and slice figures | `research/nslab/tubes-Re4000-N{96,192,256}-gpu/analysis.md` / `.docx`, `slices-vort-*.png` |
| GPU runner | `pocket-wind-tunnel/gpu/README.md` / `.docx` |
| Developer notes | `pocket-wind-tunnel/DEVNOTES.md` / `.docx` |
| Working agreement | `CLAUDE.md` |

---

*Numerical evidence only. Nothing in this project is a proof of global regularity or of finite-time breakdown of the Navier–Stokes equations. Engineering results carry the stated model limits; near-stall RANS results and under-resolved NSLab runs are flagged as unconverged by the tool itself.*
