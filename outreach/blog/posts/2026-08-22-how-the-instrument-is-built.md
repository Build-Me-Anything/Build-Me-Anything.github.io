---
title: How the instrument is built
slug: how-the-instrument-is-built
date: 2026-08-22
study: The instrument
order: 20
tag: engineering
dek: A 388 kB HTML file that opens from disk with no network, no framework and no dependencies — and inside it, a double-precision pseudo-spectral Navier–Stokes solver that agrees with its own GPU twin to fifteen digits.
---

The research programme has an unusual instrument, so it is worth describing before any of the results.

It began as **The Pocket Wind Tunnel**: an offline aerofoil tool, one HTML file, opened from disk. No server,
no CDN, no build step at the user's end, no network access at all. That constraint was a preference at first
and turned out to be a discipline: everything in it had to be written, and everything written had to be tested,
because there was nothing to import.

Today it has five modes:

| Mode | Physics |
|---|---|
| Subsonic | Hess–Smith panel method with a Thwaites/Michel/Head integral boundary layer |
| Tunnel | The same section between wind-tunnel walls (method of images) with Barlow–Rae–Pope blockage corrections |
| CFD | 2D compressible RANS, Spalart–Allmaras or k-ω SST, Roe/MUSCL finite volume, LU-SGS, in a Web Worker |
| Hypersonic | US76 atmosphere, exact oblique-shock and Prandtl–Meyer relations, shock-expansion and Newtonian, aerothermal |
| NSLab | 3D incompressible Navier–Stokes on the periodic box — the research mode |

Only the last one matters here. None of the engineering machinery — compressibility, turbulence closures,
aerofoil geometry — enters the research solver. The other four modes exist as a frozen, regression-tested
baseline so that a change made for research cannot silently break something that was already validated.

## The research solver

NSLab integrates

```
∂u/∂t + (u·∇)u = −∇p + ν∇²u,    ∇·u = 0
```

on Ω = [0, 2π]³ with periodic boundaries, using a Fourier pseudo-spectral method: 2/3-rule dealiasing, the
rotational form of the advection term (so the gradient part is absorbed into the pressure), exact projection
onto the divergence-free subspace in wavenumber space, and classical fourth-order Runge–Kutta in time with an
adaptive CFL-limited step. This is a standard, boring, well-understood scheme, chosen precisely because it is
boring: its errors are understood and its conservation properties are checkable to machine precision.

The FFT is hand-written — a mixed-radix complex transform in JavaScript — because the file may not have
dependencies. It is verified against a direct DFT to 7·10⁻¹².

There are three implementations of the same solver:

- **In the browser**, in a Web Worker, so the page stays responsive while a 64³ or 96³ run integrates.
- **In Node**, for long batch runs with checkpoints (`run-ns-long.js`), on one CPU core.
- **On the GPU**, in CuPy/cuFFT, float64 (`nslab_gpu.py`), which is where the evidence runs happen.

Two independent implementations that agree are the cheapest verification there is. The GPU port reproduces the
CPU solver to **3·10⁻¹⁵** on small cases, and on the 192³ Taylor–Green run the two agree to **4·10⁻¹²** in
energy, enstrophy, dissipation and max\|ω\| over all 1229 steps to *t* = 16 — the growth from 10⁻¹⁵ to 10⁻¹² being
round-off amplified through the turbulent phase, which is what should happen.

## The health report

Every run carries a verification report, and no number from a run may be cited before the report is read. It
grades, at each snapshot:

- **∇·u** in the maximum norm (should be at round-off: typically 10⁻¹⁴);
- **nonlinear energy transfer** |T|/ε — the advection term conserves energy exactly for periodic flow, so this
  measures how well the discrete operator inherits that (typically 10⁻¹⁴);
- the **energy budget** dE/dt = −ε and the **enstrophy budget** dZ/dt = ⟨ω·S·ω⟩ − 2νP, both compared in an
  RK4-consistent way (typically 10⁻⁸ and 10⁻⁵);
- **resolution** kmax·η, the classical DNS criterion (PASS at ≥ 1);
- **spectral tail** E(kmax)/E(peak) — energy piling up at the truncation is the signature of an under-resolved
  spectral run (PASS below 10⁻⁴);
- **vortex stretching computed two independent ways**, spectrally and in physical space; they agree to 10⁻¹⁴
  while the flow is resolved and separate when it is not, which makes their difference a resolution alarm.

A run is PASS, WARN or FAIL. Since NS-002 the verdict carries the **worst** snapshot rather than the last one —
a lesson the tubes run taught, described in that post.

Above the health report sit **refinement ladders**: the same case at three grid resolutions, with the
level-to-level change in every peak reported as a percentage and, where there are three levels, as a power of N.
The ladder is the grade. A single beautiful run is not evidence of anything.

## What it cost

The hardware is one laptop: an RTX 3060 with 6 GB. In double precision that puts the ceiling at 256³ — the
Taylor–Green run at that size uses 5.98 GB and takes 58 minutes; the vortex-tube run uses 6.25 GB and takes
1.68 hours, with nothing else allowed on the card. A 192³ run is 17–36 minutes. The same 192³ case in Node on
one CPU core takes 3.23 hours, which is the price of having a second, independent instrument.

Long runs go detached, with checkpoints every two time units, so they survive a closed laptop lid or a lost
session. Each writes `final.json` when it finishes and `partial.json` while it is still going — which is why
[the post about the run happening right now](ns-003-turning-the-reynolds-number-down.html) updates itself every
time this site is rebuilt.

## The gate that matters

```bash
node build.js --verify && node test/validate-cfd.js
```

`build.js` inlines the sources into the single HTML file, and `--verify` runs the fast validation suites first
and **refuses to build** if any of them fails. Five suites, all of which must stay at ALL PASS: the panel
method against published aerofoil data, the hypersonic relations against exact theory, the tunnel corrections
against Barlow–Rae–Pope, the Navier–Stokes core against exact solutions, and the RANS solver against NASA
turbulence-model reference cases.

It is not a large amount of ceremony, and it is the only reason I trust anything on this site.
