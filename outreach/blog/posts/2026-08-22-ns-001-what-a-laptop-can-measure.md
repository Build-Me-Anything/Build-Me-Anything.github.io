---
title: "NS-001: what a laptop can measure, and what it cannot"
slug: ns-001-what-a-laptop-can-measure
date: 2026-08-22
study: NS-001 · Taylor–Green Re 1600
order: 30
tag: resolution study
dek: The dissipation peak of the Taylor–Green vortex converges to within 0.7 % of the published 512³ value on a 256³ grid. The maximum vorticity in the same runs rises by 49 % and then 35 % per level and shows no sign of settling. Both facts come from the same three files.
---

The Taylor–Green vortex is the drosophila of this subject: a single, perfectly smooth initial condition,

```
u = sin x cos y cos z,   v = −cos x sin y cos z,   w = 0
```

which rolls up, cascades into small scales, peaks in dissipation somewhere around *t* ≈ 9 and then decays.
Brachet and co-workers computed it in 1983; van Rees and co-workers ran a 512³ spectral reference in 2011.
There are numbers to hit, which is exactly what a new instrument needs.

I ran it at Re = 1600 on a ladder — 24³ up to 256³, the last being the double-precision ceiling of a 6 GB card —
and asked one question: **which diagnostics have converged, and which have not?**

::: ladder study=ns-001
:::

## The energetics converge, and hit the published value

::: figure src=ns001-eps
Dissipation rate ε = 2νZ against time, at three resolutions. The three curves are on top of one another; the
dashed line is the 512³ spectral reference of van Rees et al. (2011). Curves are decimated to about 900 points
per level by taking the maximum in each bucket, so peaks are preserved.
:::

At 256³ the peak dissipation is **ε_max = 0.01291 at t = 8.88**. The 512³ spectral reference is ≈ 0.013 and
Brachet's 1983 value is 0.0126, so this run sits **0.7 % below the modern reference and 2.5 % above the
original** — and only 1.7 % below its own 192³ level. The dissipation peak has converged.

There is one wrinkle worth reporting because it looks like a bug and is not. The coarse levels *overshoot*:
96³ gives 0.01386, higher than the converged value, and then the finer grids come *down* to it. That is the
classic under-resolved spectral bottleneck — with the spectral tail undecayed (E(kmax)/E(peak) = 2·10⁻² at 96³)
energy piles up near the truncation, and ε = 2νZ is weighted toward high wavenumbers, so it is over-predicted.
The health report failed that level for exactly that reason before I looked at the number.

## The maximum vorticity does not converge

::: figure src=ns001-ommax
Maximum vorticity against time, same three runs. The curves separate as the cascade develops, and each finer
grid finds a larger maximum at a later time. This is the quantity the Beale–Kato–Majda criterion controls.
:::

Peak max\|ω\|: **37.0 → 55.1 → 74.3** for 96³ → 192³ → 256³. That is +49 % and then +35 %, and the instant of
the peak moves later each time (7.49 → 8.88 → 10.07), while the history becomes spikier: at 256³ the maximum
reads 65.7, 41.3, 73.1, 48.7 at *t* = 9.0, 9.5, 10.0, 10.5. It is not a smooth hump being resolved better. It
is an intermittent quantity that hops between sites, living in structures thinner than the global Kolmogorov
estimate the resolution criterion is built from.

The time integral behaves better. ∫₀¹⁰ max\|ω\| dt is **160 → 223 → 250**: +39 %, then +12 %. Still moving, but
converging at a rate the peak does not manage.

## The trust hierarchy

That ordering is the first quantitative result of this programme, and I have not yet found a flow that breaks it:

> **energetics** (E, Z, ε) converge first · then **∫‖ω‖∞ dt** · then, last and possibly not at all,
> **‖ω‖∞ itself**.

It is not a surprising ordering — integral quantities average over exactly the small-scale detail that a local
maximum is made of — but having it *measured*, in percentages, on a specific flow at a specific cost, is what
lets me say how much resolution a claim would need. And it decides the second rule of the programme: vorticity
growth is judged on the Beale–Kato–Majda integral across a ladder, never on the peak.

::: caveat title=What this does not show
A converged dissipation peak says the integral energetics of this flow are captured. It says nothing whatsoever
about regularity. The unconverged maximum vorticity is not evidence of anything either — a quantity that grows
when you refine the grid is the signature of a structure your grid cannot represent, not of a structure the
equations are building without bound.
:::

## Two instruments, one answer

The 192³ case was run twice: once on the GPU in CuPy float64, once in Node on a single CPU core (3.23 hours).
Over all 1229 steps to *t* = 16 the two agree to **4·10⁻¹²** in energy, enstrophy, dissipation and max\|ω\|.
That does not make the physics right, but it removes an entire category of doubt about the arithmetic.

At Re = 100, where the energetics are essentially resolved on a 32³ grid, max\|ω\| *still* moves by 25 % per
level. The lesson is not about Reynolds number. It is about what kind of quantity a local maximum is.

Everything here — series, snapshots, health reports, spectra, the analysis scripts — is in the evidence archive
under `research/nslab/`, stamped with the build that produced it.

Next: [NS-002](ns-002-the-number-that-grows-with-the-grid.html), where the same ladder is pointed at a flow that
concentrates vorticity deliberately, and the picture gets worse.
