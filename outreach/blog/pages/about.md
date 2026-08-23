---
title: About this logbook
slug: about
dek: What this is, what it is not, who is doing it, and how to check any number on the site.
---

## What this is

The open notebook of a small research programme called **NSLab** — the Navier–Stokes Regularity Laboratory —
run by one aeronautical engineer on one laptop, using an instrument built from scratch for the purpose.

The instrument is **The Pocket Wind Tunnel**: a single HTML file, about 376 kB, that opens from disk with no
network, no framework and no dependencies. It began as an aerofoil tool and grew a research mode that
integrates the three-dimensional incompressible Navier–Stokes equations on the periodic box with a Fourier
pseudo-spectral method. The full story is in
[It started with a CV and “build me anything”](posts/it-started-with-build-me-anything.html).

Studies are numbered NS-001, NS-002, … Each one is a refinement ladder: the same flow at three grid resolutions,
graded by a health report, with the level-to-level change in every peak quoted as a percentage.

## What this is not

It is not a proof, an attempted proof, or a claim on the Clay Millennium Prize. It is not a preprint. It is not
peer reviewed. Numerical simulation cannot decide the regularity question, and no result on this site should be
read as bearing on it beyond establishing what the instrument can and cannot measure.

Where the site says a quantity grows, it means *a number computed on a finite grid grows*. Every time that has
happened so far, the honest reading has been that the grid ran out, and the post says so.

## The rules

1. Never claim a proof. The words are *numerical evidence* and, at most, *conjecture*.
2. Judge vorticity growth on the Beale–Kato–Majda integral across a refinement ladder, never on a single peak.
3. Do not record a conclusion the health report or the ladder did not support.

They are set out at length in [the charter](posts/rules-for-an-amateur-attack.html).

## Who

Michael — an aeronautical engineer, airframe structures and aerodynamics by trade, in Scotland. The solver, the
verification framework and the analysis were built in partnership with Claude (Anthropic), which also writes
most of the prose here; the experiment design, the physics judgement and every decision about what may be
claimed are mine.

## Checking the work

Every figure on this site is generated directly from the archived run files by a script, not drawn by hand, and
every number in the text comes from the same files. The archive holds, for each run: the per-step series, the
snapshot diagnostics, the spectra, the health report with all of its checks, the initial-condition parameters,
the build version of the instrument that produced it, and the wall-clock cost.

The solver is verified against exact solutions (the ABC flow to 3·10⁻¹², measured Runge–Kutta order 4.01,
divergence at 10⁻¹⁶), against a direct DFT for the hand-written FFT, and against a second, independent
implementation on the GPU which agrees to 3·10⁻¹⁵ on small cases and 4·10⁻¹² over 1229 steps at 192³. The
Taylor–Green benchmark is reproduced to within 0.7 % of the published 512³ spectral reference.

If you find an error, that is the most useful thing that can happen to a programme like this one. It will be
corrected in place, with a note saying what changed.

## Reuse

The numbers, figures and text here may be quoted with attribution. If you want the run data itself for a
comparison, ask — it is a few hundred megabytes of JSON, checkpoints and slice files, and it is nobody's secret.
