---
title: It started with a CV and “build me anything”
slug: it-started-with-build-me-anything
date: 2026-08-21
study: Origin
order: 5
tag: story
dek: Two days from an empty folder to a Navier–Stokes laboratory. Nobody set out to work on a Millennium problem — the tool got trustworthy first, and the problem was what sat at the top of the ladder it had accidentally built.
---

There was no plan. There was an empty folder called **Build Me Anything**, my CV, and one instruction to an AI:
build me anything, you can download any free tool you like.

It is a strange thing to say to a machine. I meant it as a test — I wanted to see what it would *choose*. The CV
was the only context: aeronautical engineer, aircraft engineering degree, airframe design, fuel systems, nine years
of field engineering before that. Anyone reading it would guess I like aeroplanes and dislike being told numbers
without being shown where they came from.

What came back was a wind tunnel in an HTML file.

## Day one: an aerofoil calculator that would not stop growing

The first version was a Hess–Smith panel method with an integral boundary layer — Thwaites, Michel's transition
criterion, Head's entrainment — drawing pressure distributions for a NACA section you could drag around. One
file, opened from disk, no internet. I asked for more, the way you do.

By the end of the first day it had:

- a **test-section mode**, the same aerofoil between wind-tunnel walls by the method of images, with
  Barlow–Rae–Pope blockage corrections, because I have spent enough time near real tunnels to want the
  correction factors visible rather than hidden;
- a **CFD mode** — an actual 2D compressible RANS solver, Roe fluxes with MUSCL reconstruction, LU-SGS implicit
  time stepping, Spalart–Allmaras turbulence, running in a Web Worker so the page stayed alive;
- a **hypersonic mode** with the US76 atmosphere, exact oblique-shock and Prandtl–Meyer relations, and
  aerothermal heating estimates;
- and a **local LLM assistant**, Phi-4 Mini through Ollama on my own GPU, wired to the tool's own functions so it
  could set conditions and read results without any of it leaving the machine.

Then k-ω SST as a second turbulence model, validated against the NASA Turbulence Modeling Resource cases.

Somewhere in there I sent it eight CFD papers I had collected and asked it to check them. Three of them were
wrong in ways I could confirm. One had been published in a venue that, on inspection, could not exist. That
afternoon set the tone for everything after it: *nothing goes in unless it has been checked against something
that already exists in the literature, and where it disagrees, we say so.*

## The turn

On the second day I asked the obvious next question. This thing solves the Navier–Stokes equations in two
dimensions, with models, for engineering. What would it take to solve them *properly* — three dimensions, no
turbulence model, no compressibility, nothing but the equations — and point that at the open question?

The open question being the one everybody in fluid mechanics learns about and nobody touches: whether smooth
solutions of the three-dimensional incompressible Navier–Stokes equations stay smooth forever. Clay Mathematics
Institute, one of seven, a million dollars, unsolved since it was posed and effectively unsolved since Leray in
the 1930s.

I want to be honest about the sequence, because it matters. **We did not set out to attack a Millennium problem.**
We set out to build an instrument that could be trusted, and when it was trustworthy enough that I could say
exactly how far I trusted each number in it, the Millennium problem was simply the thing sitting at the top of
that ladder. Everything since has been about climbing rungs that are much, much lower down — and finding out
that even those are further apart than they look.

## What "properly" meant

A different solver, not a modification of the engineering one. A Fourier pseudo-spectral method on the periodic
box, 2/3 dealiasing, exact projection, fourth-order Runge–Kutta — the standard, boring, checkable scheme. The
FFT had to be written by hand because the file is not allowed dependencies. The radix-3 butterfly sign was wrong
on the first attempt, which is exactly the sort of thing that a comparison against a direct DFT catches and a
pretty picture does not.

Then, before any physics: a **health report** on every run, grading divergence, the exact energy conservation
of the nonlinear term, the energy and enstrophy budgets, the resolution parameter, the spectral tail, and two
independently computed estimates of vortex stretching that must agree. Then **refinement ladders**, because a
single run is an anecdote.

Then a second implementation on the GPU in CuPy, in double precision, so that two instruments could be compared.
They agree to fifteen digits on small cases and to 4·10⁻¹² over 1229 steps of a 192³ run. That agreement is not
physics, but it retires an entire category of doubt.

::: note title=The assistant knows its place
The local model inside the tool is the experiment controller: it can set up a case, launch it, and read the
diagnostics back. It is emphatically not the mathematician. I probed it on the physics and it got the
Beale–Kato–Majda criterion and the enstrophy equation wrong. It stays on the switches.
:::

## Where that left us

Three studies later, the summary is not what I expected when I started. The integral quantities — energy,
enstrophy, dissipation — converge beautifully and land within a fraction of a percent of the published
literature values. The one quantity that a regularity argument would actually need, the maximum vorticity,
has refused to converge in every flow tried, growing by 30 to 80 % every time the grid is refined, in runs whose
global resolution criterion says they are fully resolved.

That is not evidence of a singularity. It is the opposite: it is the instrument telling me, precisely and
repeatedly, where its own reach ends. Learning to hear that clearly — and to write it down rather than reach
for the exciting interpretation — is the whole programme so far.

The rules I now work under are in [the charter](rules-for-an-amateur-attack.html). What the instrument is made
of is in [how it is built](how-the-instrument-is-built.html). And the studies themselves —
[NS-001](ns-001-what-a-laptop-can-measure.html), [NS-002](ns-002-the-number-that-grows-with-the-grid.html) and
[NS-003](ns-003-turning-the-reynolds-number-down.html), whose top rung landed while this was being written
— are where the numbers live.

All of it from an empty folder, a CV, and a badly specified brief.
