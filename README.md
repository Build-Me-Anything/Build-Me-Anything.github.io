# Build Me Anything

> "Build me anything. You can download any free tool you like."

That was the whole brief, given to an AI on 21 August 2026 along with a CV. This repository is what came back,
and what it turned into two days later.

**[The Pocket Wind Tunnel](pocket-wind-tunnel/)** — an offline aerodynamics toolkit in a single 376 kB HTML
file. It opens from disk. No network, no framework, no dependencies, no build step for the reader.

**[NSLab](research/nslab/)** — the Navier–Stokes Regularity Laboratory: a verified pseudo-spectral solver for
the 3D incompressible Navier–Stokes equations on the periodic box, and a research programme that uses it to ask
what a laptop can and cannot measure about the [Clay Millennium problem](https://www.claymath.org/millennium/navier-stokes-equation/).

**[The logbook](outreach/blog/)** — the programme, written up in public as it happens.
**→ https://build-me-anything.github.io**

> **Numerical evidence only.** Nothing in this repository is a proof of global regularity or of finite-time
> breakdown of the Navier–Stokes equations, and nothing here is a claim on the Clay Millennium Prize. Where a
> quantity is described as growing, it means *a number computed on a finite grid grows* — and every time that
> has happened so far, the honest reading has been that the grid ran out.

---

## The tool

Open `pocket-wind-tunnel/Pocket Wind Tunnel.html` in a browser. That is the entire installation procedure.

| Mode | Physics |
|---|---|
| Subsonic | Hess–Smith panel method with a Thwaites / Michel / Head integral boundary layer |
| Tunnel | The same section between wind-tunnel walls (method of images) with Barlow–Rae–Pope blockage corrections |
| CFD | 2D compressible RANS — Roe/MUSCL finite volume, LU-SGS, Spalart–Allmaras or k-ω SST — in a Web Worker |
| Hypersonic | US76 atmosphere, exact oblique-shock and Prandtl–Meyer relations, shock-expansion and Newtonian, aerothermal heating |
| NSLab | 3D incompressible Navier–Stokes on the periodic box: pseudo-spectral + RK4, vorticity-stretching diagnostics, health report, refinement ladders, evidence dossier |

There is also an optional assistant that talks to a local [Ollama](https://ollama.com) model and drives the tool
through its own function surface. It is the experiment controller, not the mathematician — it was probed on the
physics, got the Beale–Kato–Majda criterion wrong, and was kept on the switches.

### Building it

```bash
cd pocket-wind-tunnel
node build.js --verify          # inlines src/ into the single HTML file; refuses to build if a suite fails
node test/validate-cfd.js       # the slow suite, ~50 s
```

Five validation suites must stay at ALL PASS: the panel method against published aerofoil data, the hypersonic
relations against exact theory, the tunnel corrections against Barlow–Rae–Pope, the Navier–Stokes core against
exact solutions, and the RANS solver against NASA Turbulence Modeling Resource cases. Edit `src/`, never the
built HTML. Developer notes, including every numerical lesson that cost real debugging time, are in
[`pocket-wind-tunnel/DEVNOTES.md`](pocket-wind-tunnel/DEVNOTES.md).

## The research programme

NSLab integrates ∂u/∂t + (u·∇)u = −∇p + ν∇²u, ∇·u = 0 on [0, 2π]³ with a Fourier pseudo-spectral method
(2/3 dealiasing, rotational form, exact projection) and classical RK4, in double precision, with a hand-written
mixed-radix FFT. It is implemented three times — browser Web Worker, Node, and CuPy/cuFFT on a GPU — and the
implementations agree to 3·10⁻¹⁵ on small cases and 4·10⁻¹² over 1229 steps at 192³.

Every run is graded by a health report before any number from it may be cited: divergence, exact energy
conservation of the nonlinear term, RK4-consistent energy and enstrophy budgets, kmax·η, spectral-tail decay,
and two independently computed estimates of vortex stretching that must agree. Above that sit refinement
ladders: the same case at three resolutions, with every peak's level-to-level change quoted as a percentage.

### The studies so far

| Study | Flow | Result |
|---|---|---|
| **NS-001** | Taylor–Green vortex, Re 1600, 24³ → 256³ | Dissipation peak converged — ε_max = 0.01291 at t = 8.88, within 0.7 % of the 512³ spectral reference. max\|ω\| **not** converged: 37.0 → 55.1 → 74.3 |
| **NS-002** | Antiparallel vortex tubes, Re 4000 (Re_Γ ≈ 16 000), 96³ → 256³ | Energetics converged to ~1 %; peak max\|ω\| 60.7 → 108.5 → 138.8, scaling as N^0.85 with no sign of saturating |
| **NS-003** | The same tubes at Re 2000 | 52.3 → 92.1 → 109.4: the first falling exponent, N^0.82 → N^0.60. Energetics converged to 0.2 %; the 256³ level passes every check at its worst snapshot and its peak is still 19 % high |

The programme runs as a gate ladder, G0 to G9, from "existing solvers regression-tested" to "proof closes the
Clay formulation". It is at the boundary of G5 and G6, and G6 — a phenomenon that survives refinement — has not
been reached. The full status table, every run's numbers and the reading of each is in
[`research/nslab/README.md`](research/nslab/README.md); the academic write-up is
[`research/nslab/NSLab Research Report.md`](research/nslab/NSLab%20Research%20Report.md); a graded survey of the
field is in [`research/literature/`](research/literature/).

### Reproducing a run

```bash
# a refinement ladder on the CPU
node pocket-wind-tunnel/test/bench-ns.js 1600 10 96,192 out.json

# a long GPU run in double precision, with checkpoints
python pocket-wind-tunnel/gpu/nslab_gpu.py --N 256 --ic tubes --Re 2000 --tEnd 16 --cfl 0.4 --out run-folder

# tables, level-to-level comparison and an SVG, against the other levels of the same case
node research/nslab/analyse.js run-folder
```

Archived runs keep their per-step series, snapshot diagnostics, spectra, health report and the build version of
the instrument that produced them. The restart checkpoints and raw slice fields are not in the repository —
they are hundreds of megabytes per run — but everything needed to regenerate them is.

## The logbook

`outreach/blog/` is a zero-dependency static site generator, in the same spirit as the tool: about 700 lines of
Node, no framework, output that opens from `file://`.

```bash
cd outreach/blog
node figures.js && node build.js
```

The figures and the ladder tables are generated from the run archive at build time, so a post about an
experiment that is still running refreshes itself on every build. `site/nslab-logbook.html` is the whole
logbook as one self-contained offline file.

## Credits and method

Built by Michael, an aeronautical engineer, in partnership with Claude (Anthropic) — which wrote the solver,
the verification framework, the analysis scripts and most of the prose. The experiment design, the physics
judgement and every decision about what may be claimed are the author's.

Being explicit about that is the point rather than a disclaimer: the work is only worth reading because it can
be checked, and it is built so that it can be. Exact solutions to 3·10⁻¹², two independent implementations
agreeing to 4·10⁻¹², a published benchmark reproduced to 0.7 %, and a graded report attached to every run. If
you find an error, that is the most useful thing that can happen to a programme like this one.
