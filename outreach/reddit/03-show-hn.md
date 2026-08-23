# Draft 3 — Hacker News (Show HN)

**When:** after the CFD threads have stood up for a few days.
**Type:** Show HN with the blog (or the single-file tool) as the URL, plus a first comment from you.
**Timing:** weekday, 13:00–16:00 UK is the usual sweet spot for a European poster.
**HN specifics:** the title must start with "Show HN:" and must not be editorialised or clickbaity; no
exclamation marks; the site must work without a login and load fast. HN is unforgiving about
undisclosed AI authorship and generous about honest, well-verified hobby engineering.

---

## Title options

1. **Show HN: A 376 kB offline HTML file that runs a verified 3D Navier–Stokes DNS**
2. Show HN: I built an offline aerodynamics tool that grew a Navier–Stokes research programme
3. Show HN: Pocket Wind Tunnel – single-file CFD, no dependencies, with a verified spectral DNS inside

*(1) is the strongest: the improbable technical fact is in the title and it is true.*

---

## First comment (post immediately after submitting)

It started as an experiment in constraints: one HTML file, opened from `file://`, no network, no framework, no
dependencies, no build step for the user. That turned out to be a useful discipline — everything had to be
written and therefore had to be tested.

It now has a panel method with an integral boundary layer, a wind-tunnel test section with method-of-images wall
corrections, a 2D compressible RANS solver (Roe/MUSCL, LU-SGS, Spalart–Allmaras and k-ω SST) running in a Web
Worker, hypersonic shock-expansion and aerothermal methods, and an optional local-LLM assistant that talks to
Ollama on localhost and drives the tool through its own function surface.

The part I did not expect: a 3D incompressible Navier–Stokes research mode. Fourier pseudo-spectral on the
periodic box, 2/3 dealiasing, exact projection, RK4, double precision, with a hand-written mixed-radix FFT
because dependencies are not allowed. It is verified against exact solutions (ABC flow to 3·10⁻¹², measured
RK4 order 4.01), against a direct DFT for the transform, and against an independent CuPy/cuFFT port that
reproduces it to 3·10⁻¹⁵ on small cases and 4·10⁻¹² over 1229 steps at 192³.

The reason it exists is a research programme on the Navier–Stokes regularity question — the Clay problem — run
the only way an amateur sensibly can: as a study of what the instrument can measure. Three studies so far. The
Taylor–Green benchmark reproduces the published dissipation peak to 0.7 % of the 512³ reference. The quantity
that a regularity argument would need, the maximum vorticity, has failed to converge in every flow tried,
growing 30–80 % per grid refinement in runs that pass every global resolution criterion. That is a statement
about a 6 GB laptop GPU, not about the equations, and the write-up says so on every page.

Technical bits that might interest people here:

- Every run is graded by a health report before any number from it may be quoted: divergence, exact energy
  conservation of the nonlinear term, RK4-consistent energy and enstrophy budgets, kmax·η, spectral-tail decay,
  and two independently computed estimates of vortex stretching that have to agree. The build script runs the
  validation suites and refuses to produce the HTML file if one fails.
- The budget checks have to be RK4-consistent — comparing E(t+Δt) − E(t) against a trapezoidal ∫ε dt measures
  the error of your check, not of your scheme. Simpson weights over the four RK4 stage states drop the residual
  from 10⁻⁷ to 10⁻⁹.
- The blog is also a static site generator of about 400 lines with no dependencies, and the post about the
  experiment that is currently running regenerates its own numbers from the run's checkpoint files at build
  time.

Disclosure: I am an aeronautical engineer, and this was built in partnership with Claude (Anthropic) — the
solver, the verification framework and most of the prose. The physics judgement and the decisions about what
may be claimed are mine, which is why the claims are deliberately small and everything is checkable. If you
find an error in the verification, that is the most useful thing that could happen to it.

Blog and write-ups: [BLOG URL]

---

## Notes

- Answer every top comment for the first two hours; HN rewards presence.
- Expect: "why not WebGPU?" (answer: float32 only, not admissible as evidence — exploration only), "why not
  use FFTW/an existing DNS code?" (answer: the file cannot have dependencies, and an independent implementation
  is worth more to me than a fast one), and "is this AI slop?" (answer: disclosed above, here is the
  verification, please check it).
- Do not submit on a Saturday.
