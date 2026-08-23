---
title: "NS-003: turning the Reynolds number down"
slug: ns-003-turning-the-reynolds-number-down
date: 2026-08-23
study: NS-003 · vortex tubes Re 2000
order: 50
tag: resolution study
dek: If the maximum vorticity refuses to converge because the reconnection bridge is thinner than the grid, then making the bridge thicker should fix it. I wrote down three possible outcomes before the top rung finished. The middle one landed — and the exponent finally moved.
---

[NS-002](ns-002-the-number-that-grows-with-the-grid.html) ended with an explanation and no test of it. The
explanation was: the maximum vorticity grows with the grid because the reconnection bridge is thinner than the
grid can represent, so every refinement finds more of a structure that was always there.

That explanation makes a prediction. Bridge thickness scales roughly with the viscous length, so halving the
Reynolds number should thicken it by about √2 while leaving the geometry of the event alone. If the explanation
is right, the same ladder at Re = 2000 should show the maximum vorticity beginning to converge — because for
once the grid would be fine enough to hold the thing that is growing.

So NS-003 is the same initial condition — the same tubes, the same perturbation, the same box — at ν = 1/2000,
Re_Γ ≈ 8 000, on the same 96³ → 192³ → 256³ ladder in double precision on the GPU. Total cost: 2.4 hours.

::: ladder study=ns-003
:::

::: figure src=ns003-ommax
Maximum vorticity against time at Re = 2000, all three levels complete. The event is the same shape as at
Re = 4000 and about 30 % weaker. What matters is the gap between the levels, not the height of the curve.
:::

## The prediction, and what happened

This is what I wrote before the 256³ level finished, reproduced unedited:

| If 256³ gives… | Reading |
|---|---|
| a change of less than ~10 % on 192³ (peak ≲ 101), exponent collapsing below ~0.3 | The bridge hypothesis holds. Resolution buys convergence… |
| another ~N^0.85 (peak ≈ 118) | The bridge hypothesis fails as stated… |
| **something between (peak ≈ 105–112)** | **The most likely and least satisfying outcome: partial convergence, and the ladder must be extended in a way this hardware cannot manage.** |

The answer is **109.36**, at t = 8.767. Middle row, near the centre of the band. I would rather it had been one
of the other two.

## What moved, and what did not

The important number is not the peak, it is its exponent. Across the ladder the peak maximum vorticity scales
as **N^0.82 and then N^0.60** — the first time in this programme that a local exponent has fallen. The
comparison that matters:

| Study | Re_Γ | peak max\|ω\| across 96³ → 192³ → 256³ | exponent, first leg → second |
|---|---|---|---|
| NS-002 | ≈ 16 000 | 60.7 → 108.5 → 138.8 | N^0.84 → N^0.86 |
| **NS-003** | **≈ 8 000** | **52.3 → 92.1 → 109.4** | **N^0.82 → N^0.60** |

At Re 4000 the exponent was flat: each refinement bought as much new vorticity as the last one. At Re 2000 it
has dropped by a quarter, and the Beale–Kato–Majda integral behaves the same way — ∫₀¹⁰‖ω‖∞ dt goes 163 → 221 →
246, which is N^0.44 then N^0.37, where the Re 4000 ladder gave N^0.55 rising to N^0.61.

So halving the Reynolds number did buy convergence. It bought *partial* convergence, and it bought it slowly:
+18.7 % on the last level is still an enormous distance from a converged quantity, and extrapolating an
exponent from two legs of a three-rung ladder is exactly the kind of thing this programme exists not to do.

The energetics, meanwhile, are simply finished: ε_max moves by **0.2 %** between 192³ and 256³ (0.0008093 →
0.0008078). The peak dissipation of this flow is a solved measurement at 256³; its peak vorticity is not.

## The uncomfortable part

The 256³ level is the best-resolved run this programme has produced. Health **PASS**, and not just at the end —
the report now carries its worst snapshot, and even that reads kmax·η = 2.94 and a spectral tail of 2.7·10⁻⁵ at
the instant of the event, both comfortably inside the PASS thresholds. Energy budget 1.6·10⁻⁹, enstrophy budget
1.1·10⁻⁶.

By every global criterion available, this run resolves its flow. Its peak vorticity is still 19 % above the
level below it.

That is the finding, and it is a warning about instruments rather than a discovery about fluids: **passing every
health check at every instant is necessary, not sufficient. Only the ladder grades a pointwise quantity.**
kmax·η and the spectral tail grade the mean dissipation scale, and a reconnection bridge is not a mean.

The vortex stretching tells the same story more gently than it did at Re 4000, where both sides of the enstrophy
budget tripled across the ladder. Here peak ⟨ω·S·ω⟩ goes 0.60 → 0.83 → 1.03 (+38 %, +24 %) and peak
palinstrophy dissipation 0.48 → 0.85 → 1.06, while peak dZ/dt moves 0.25 → 0.25 → 0.28. Still unconverged,
still by a factor of two to three less unconverged than the Re 4000 ladder at the same rung.

## The interpolated maximum says the core is still sharpening

The solver now reports a spectrally interpolated maximum beside the grid-point one — always beside it, never in
its place — which answers the obvious objection that the peak might simply be hiding between grid points. It is
not: the correction is 0.9 %, 2.3 % and 6.0 % at 96³, 192³ and 256³, against ladder steps of 76 % and 19 %.

But look at the direction. **If the peak structure were resolved, the correction would shrink as the grid
refines. It grows.** The interpolated ladder is 52.8 → 94.2 → 115.9, exponents 0.84 then 0.72 — a shade worse
than the grid maximum's 0.82 → 0.60. The grid is not merely missing the peak; the thing it is missing is getting
sharper relative to the mesh at every level.

The interpolator also says where the maximum is: at 256³ it sits at (x, y, z) = (3.28, 3.11, 0.82) — *x* within
0.14 of π, where the perturbation brings the tubes closest, *y* on the symmetry plane between them, and *z*
about 0.8, the pair having travelled ≈ 4 from its starting plane at roughly 0.45 per time unit. That is the head
of the reconnection bridge, exactly where NS-002 inferred it must be from the fact that the maximum on the
archived planes converged while the volume maximum did not.

::: image src=ns003-ladder-vort-xmid-t8.5.png alt=Vorticity magnitude on the plane x equals pi at t equals 8.5, at three grid resolutions
Vorticity magnitude on the plane *x* = π at *t* = 8.5, at 96³, 192³ and 256³ — the plane the peak actually lives
on, cut for this study rather than inherited from NS-002. The bridge is a sheet in *y* = π, one or two cells
thick at **all three** resolutions: the grid gets finer, the sheet gets thinner, and the ladder never catches
it. On this plane the local stretching ω·S·ω reaches ≈ 8 000 against a volume mean of 1.0.
:::

## The periodic images, measured this time

NS-002 carried a caveat I could not quantify: the vorticity crosses the box boundary before the event, so the
dramatic part is a replicated system rather than an isolated pair. NS-003 logs the gap between the
enstrophy-carrying region and its nearest periodic image at every snapshot, and the picture is better than
feared. Through the event the gap holds at **2.7–3.3** box units — the pair is not, at Re 2000, reconnecting in
its own image's lap.

Splitting the Beale–Kato–Majda integral at the crossing makes the point sharply:

| Window | 96³ | 192³ | 256³ | change |
|---|---|---|---|---|
| ∫₀⁷‖ω‖∞ dt — before the crossing | 64.3 | 63.2 | 63.3 | **0.2 %** |
| ∫₇¹⁶‖ω‖∞ dt — the event and after | 206.0 | 373.5 | 413.9 | +81 %, +11 % |

Before the images can matter, the ladder is converged to two parts in a thousand — and that includes the
pointwise maximum itself, which changes by only 2.7 % from 192³ to 256³ over that window against 31 % at some
instants after it. Everything that fails to converge happens in the reconnection itself. That is a cleaner
statement than NS-002 could make, and it means the non-convergence is a property of the event, not an artefact
of the box.

The honest remainder: the images act through the velocity field from *t* = 0, because that is what a periodic
box is, and at closest approach that amounts to a box-size effect of order 40 % of the pair's self-induced
speed. A 4π box in *z* would halve it. What the diagnostic rules out is the worse worry — that the vorticity
itself was overlapping its own copy during the event.

## Where this leaves the programme

Three studies, one consistent result: the integral energetics of these flows are measurable on this hardware,
and the local vorticity maximum is not — though at Re 2000 it is finally *approaching* measurable, at a rate
that would need a grid this laptop cannot hold to confirm.

Gate G6 asks for a phenomenon that survives refinement. Nothing here survives refinement yet. The falling
exponent at Re 2000 is the first thing that even looks like it might, and one falling exponent over one leg of
one ladder is an observation, not a phenomenon.

Next, in order: the same Re 2000 case at 384³ in single precision — exploration only, since float32 is not
admissible as evidence here — to see whether the falling sequence flattens; the analyticity-strip width δ(t)
recovered from the archived spectra, which can be done retroactively on every run in the archive; sup‖u‖_{L³}
and the Doering–Foias bound on enstrophy growth; a 4π box in *z* to halve the image effect; and a fourth
Reynolds number, to turn two points on an exponent-versus-Re plot into three.
