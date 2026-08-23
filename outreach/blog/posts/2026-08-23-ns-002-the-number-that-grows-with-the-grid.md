---
title: "NS-002: the number that grows with the grid"
slug: ns-002-the-number-that-grows-with-the-grid
date: 2026-08-23
study: NS-002 · vortex tubes Re 4000
order: 40
tag: resolution study
dek: Two antiparallel vortex tubes, pushed together until they reconnect. The energetics converge to within a percent. The maximum vorticity goes 60.7 → 108.5 → 138.8 as the grid is refined, scaling as N^0.85 with no sign of stopping — and that is a statement about my grid, not about the equations.
---

The Taylor–Green vortex is smooth, symmetric and generous. [It taught me](ns-001-what-a-laptop-can-measure.html)
that integral quantities converge long before local ones. The obvious next question is what happens in a flow
built specifically to concentrate vorticity into a thin structure — the kind of flow people reach for when they
go looking for singular behaviour.

So: two antiparallel vortex tubes, perturbed so that they approach each other where the separation is least.
This is the configuration Kerr used in his 1993 study of the Euler equations, in spirit if not in detail —
different core profile, different box, different perturbation, so no published number applies to it and the
refinement ladder is the only grade there is.

The initial condition is two Gaussian-core tubes of opposite circulation along *x*, amplitude 8, core σ = 0.4,
half-separation 0.7 + 0.2 cos *x* in a 2π box, projected to a divergence-free velocity field. Circulation per
tube Γ ≈ 4.0, so at ν = 1/4000 the circulation Reynolds number is Re_Γ ≈ 16 000. The pair translates under its
own induction, arrives at the periodic plane around *t* ≈ 7, and reconnects.

## Why Re = 4000

Not because it is a nice round number. I probed three Reynolds numbers in single precision at 96³ first — not
evidence, not archived, just parameter selection:

| Re | Re_Γ | what happens | projected kmax·η at 256³ |
|---|---|---|---|
| 500 | ≈ 2 000 | cores diffuse before the tubes interact; enstrophy never rises above its initial value | ≈ 7 |
| 2000 | ≈ 8 000 | a reconnection event, but 96³ already resolves it — the ladder would have nothing to grade | ≈ 2.9 |
| **4000** | **≈ 16 000** | the strongest event the card's 256³ ceiling can still resolve | **≈ 1.8** |

Re = 4000 puts the top of the ladder at a resolution comparable with the Taylor–Green study, with the bottom
rung marginal. That is the shape a ladder should have.

## The ladder

::: ladder study=ns-002
:::

## The energetics converge

::: figure src=ns002-eps
Dissipation ε = 2νZ against time for the three levels. Beyond the reconnection the 96³ level keeps a broad
plateau the finer grids do not have — the under-resolved spectral bottleneck again, and the reason that level
carries a WARN. Curves decimated by bucket maximum.
:::

Between 192³ and 256³: energy agrees to 0.06 % at *t* = 10; dissipation to better than 0.1 % up to *t* = 7,
1.8 % at *t* = 8, and about 5 % through the event; peak dissipation moves by **+0.8 %** and peak enstrophy by
**+0.9 %** (1.357 → 1.369). By the usual standards of this kind of study, converged.

The health report agrees: at 256³ the run is PASS throughout, kmax·η ≥ 1.81, energy budget 2·10⁻⁸, enstrophy
budget 9·10⁻⁶, and the two independent estimates of vortex stretching agree to every printed figure.

## The maximum vorticity does the opposite

::: figure src=ns002-ommax
Maximum vorticity against time. The three levels agree to about 1 % on the approach — 72.4 against 71.8 at
*t* = 8.0 — and then separate entirely during the quarter of a time unit in which the bridge forms.
:::

**60.7 → 108.5 → 138.8.** That is +79 % and then +28 %, which is N^0.84 and then N^0.86 — the exponent is not
falling. The instant of the peak has stopped moving (8.44 → 8.265 → 8.246), which is the one encouraging sign:
the *event* is converged in time even though its *amplitude* is not.

The Beale–Kato–Majda integral, the quantity the second rule of the programme says to judge growth on, is no
better: ∫₀¹⁰ max\|ω\| dt = 181 → 264 → 314, scaling as N^0.55 then N^0.61. In NS-001 the integral's exponent
*fell* between levels while the peak's did not. Here neither falls.

::: figure src=peak-vs-n
Peak maximum vorticity against grid resolution for the three studies, log–log, with the exponent of the last
leg. A converged quantity would be flat. None of these is flat — though NS-003, at half this Reynolds number,
is the one whose exponent has started to fall.
:::

::: figure src=bkm-vs-n
The Beale–Kato–Majda integral ∫₀¹⁰‖ω‖∞ dt against resolution. It converges faster than the peak — that is the
trust hierarchy from NS-001 — but at Re 4000 it has not begun to converge either.
:::

## Where the maximum actually lives

The enstrophy budget dZ/dt = ⟨ω·S·ω⟩ − 2νP closes to 9·10⁻⁶ at every level, and yet **both of its terms triple
across the ladder**: peak stretching 0.73 → 1.71 → 2.48, peak palinstrophy dissipation 0.53 → 1.61 → 2.41,
while their difference, the actual rate of change of enstrophy, moves only 0.49 → 0.51 → 0.61. Two large
unconverged numbers whose difference is converged. In Taylor–Green the same two terms moved 7 % and 11 % from
192³ to 256³.

The archived slices say where the trouble is. On the plane *z* = 0 the maximum vorticity **does** converge —
35.3 at 192³ against 33.0 at 256³ — while the volume maximum does not. So the grid-limited structure is not on
that plane: it is in the bridge core near *x* = π, where the perturbation brings the tubes closest. On the
*z* = 0 plane the local stretching ω·S·ω reaches about 2 100 against a volume mean of 2.4 — a thousandfold
concentration into a line.

::: image src=ns002-ladder-vort-z0-t8.5.png alt=Vorticity magnitude on the plane z equals zero at t equals 8.5, at three grid resolutions
Vorticity magnitude on *z* = 0 at *t* = 8.5, at 96³, 192³ and 256³. The pair arrives as a bow-tie with a thin
bridging sheet on the centreline. The 96³ frame carries visible spectral ringing that the finer levels have
mostly lost; the finer levels resolve the sheet, but the peak lives off this plane.
:::

## Is it the time step? No.

The obvious objection is that an event this sharp is being integrated too coarsely. It is not. Halving the time
step at 96³ (CFL 0.4 → 0.2) changes the peak maximum vorticity by **0.002 %** — 60.719 against 60.720, at the
same instant — the enstrophy and dissipation peaks by 0.18 %, and the BKM integral by 0.13 %, while the
RK4-consistent energy-budget residual falls by a factor of 58. The differences between the ladder levels are
spatial. They are about the grid.

::: caveat title=The caveat that matters most
The vorticity-carrying region crosses the box boundary in *z* at about *t* = 7 — and both the maximum-vorticity
event (*t* = 8.25) and the enstrophy peak (*t* = 9.5) happen **after** that. So the dramatic part of NS-002 is
the evolution of a periodically replicated vortex system, not the intrinsic dynamics of an isolated pair. Only
*t* ≲ 7 can be read as the latter. This does not invalidate the run as a numerical configuration — the equations
are being solved correctly on the box that was specified — but any statement about the physics of vortex
reconnection, as opposed to the behaviour of *this periodic configuration*, has to separate the two regimes.
NS-003 carries an explicit diagnostic for it: the *z*-extent and image gap of the enstrophy-carrying region,
reported at every snapshot.
:::

## What NS-002 shows, and does not

**Shows:** in a Kerr-type reconnection at Re_Γ ≈ 16 000, the global energetics converge by 256³ while every
local diagnostic — the maximum vorticity, its BKM integral, the stretching and palinstrophy terms — does not,
and all of them scale as clean powers of N under a global resolution criterion that is comfortably met.

**Does not show:** any growth of vorticity that survives refinement, and certainly not a BKM integral heading
for divergence. What grows here grows *with the grid*, which is what an under-resolved sheet does. The
reconnection bridge is below the grid scale at 256³, and 256³ is where this card stops. It is a statement about
the instrument's reach, not a feature of the equations, and it is not a conjecture.

## The instrument lesson

The end-of-run health verdict at both 192³ and 256³ was PASS. But at the peak instants the spectral tail touched
2.9·10⁻⁴ and 1.0–1.3·10⁻⁴, right at the PASS/WARN boundary — because the global kmax·η grades the *mean*
dissipation, and the bridge is thinner than the scale that number describes. A verdict that reports the state
of the flow at the end of a run is grading the wrong moment.

So the health report now carries its **worst** snapshot, not its last. That change is why NS-003's 192³ level
below reads WARN where the old code would have said PASS — same physics, more honest instrument.

Next: [NS-003](ns-003-turning-the-reynolds-number-down.html) — the same initial condition at half the Reynolds
number, where the bridge should be thick enough for 256³ to resolve — and where, for the first time, the
exponent falls.
