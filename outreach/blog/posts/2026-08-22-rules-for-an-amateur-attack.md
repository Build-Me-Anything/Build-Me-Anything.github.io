---
title: Rules for an amateur attack on a Millennium problem
slug: rules-for-an-amateur-attack
date: 2026-08-22
study: The programme
order: 10
tag: charter
dek: I am an aeronautical engineer with a laptop, not an analyst with a theorem. Here is the ladder I intend to climb, and the rule at every rung that stops me lying to myself.
---

The Clay Mathematics Institute asks a question that sounds like it should be easy for a fluid dynamicist.
Take the three-dimensional incompressible Navier–Stokes equations on a periodic box, start them from smooth
initial data with finite energy, and let them run. Does the solution stay smooth forever, or can some quantity
run away to infinity in finite time? Nobody knows. It is worth a million dollars and about seventy years of
failed attacks (Fefferman, 2000).

I am not going to solve it. I want to be completely clear about that on the first page, because the internet is
full of people who wrote a solver, saw a big number, and announced a singularity.

What I *am* doing is building an instrument and learning to read it, in public, with the numbers on the table.

## What a simulation can and cannot do here

A computer cannot exhibit a singularity. It has a finite grid and a finite time step; at best it can show a
quantity growing until the grid can no longer represent the structure that is growing. Those two situations —
*the equations are concentrating vorticity without bound* and *my grid has run out* — look identical from the
inside. Distinguishing them is the entire craft.

What a simulation can do is three things:

1. **Verify the instrument.** Reproduce known solutions to round-off, reproduce published benchmark numbers,
   and grade every run against conservation laws the equations satisfy exactly.
2. **Measure what is computable.** For a given flow at a given resolution, say which diagnostics have converged
   and which have not — and quantify the cost of moving one of them from the second list to the first.
3. **Look for patterns that survive refinement.** A relationship between vorticity amplification, stretching,
   enstrophy and dissipation that does not move when the grid is doubled is a candidate for a conjecture.
   A conjecture, later, might become an inequality. An inequality, much later, might become a theorem.

That chain is the programme:

```
numerical evidence → verified numerics → resolution-independent pattern → conjecture → inequality → proof
```

Everything published on this site lives in the first two links. I do not expect to reach the last one. The
programme is worth running anyway, because the middle links are real work that produces real, checkable results,
and because the discipline required to *not* skip a link is the interesting part.

## The gates

The programme is organised as gates. A gate is not passed because it feels passed; it is passed because a
specific artefact exists in the archive.

| Gate | Requirement | Status |
|---|---|---|
| G0 | Existing solvers regression-tested, baseline frozen | done — five suites, ALL PASS |
| G1 | 3D discretisation verified against exact solutions | done — 3·10⁻¹² on the ABC flow, measured RK4 order 4.01 |
| G2 | Taylor–Green vortex reproduced | done for the energetics; **not** for max\|ω\| |
| G3 | Grid and time convergence automated | done — refinement ladders with verdicts |
| G4 | Vorticity and stretching diagnostics validated | done — two independent estimates agree to 10⁻¹⁴ |
| G5 | Reproducible long-time experiments | done — NS-001, NS-002, NS-003 in the archive |
| G6 | A resolution-independent phenomenon identified | **not started** |
| G7 | Candidate inequality discovered | not started |
| G8 | Inequality proven | — |
| G9 | Proof closes the Clay formulation | — |

We are at the boundary of G5 and G6, and the honest summary of the work so far is that the most interesting
quantity in the problem — the maximum vorticity — has refused to converge in every flow tried. That is a
statement about my instrument, not about the equations. Saying so precisely, with numbers, is the job.

## The three rules

**1. Never claim a proof.** Not in a post, not in a plot label, not in a README. The words are *numerical
evidence* and, at most, *conjecture*. A result is not even a conjecture until the run passes its health report
and survives refinement in both grid and time step.

**2. Judge vorticity growth on the Beale–Kato–Majda integral across a ladder, never on a single peak.**
Beale, Kato and Majda (1984) proved for the Euler equations that a smooth solution can only break down at time
*T* if ∫₀ᵀ‖ω‖∞ dt diverges; the analogous continuation criterion is standard for Navier–Stokes. The instantaneous
maximum is a local, intermittent, site-hopping quantity that a coarse grid cannot be trusted on at all. Its time
integral is better behaved. Both must be shown at three resolutions or they mean nothing.

**3. Do not record a conclusion the health report or the ladder did not support.** Every run is graded before
it may be cited: divergence of the velocity field, exact energy conservation of the nonlinear term, RK4-consistent
energy and enstrophy budgets, the resolution parameter kmax·η, the decay of the spectral tail, and the agreement
of two independently computed estimates of the vortex-stretching term. A run that fails is not evidence. A run
that warns is evidence with an asterisk, and the asterisk goes in the post.

::: note title=What would change my mind
If a growth rate in this programme is real rather than numerical, it must survive a doubling of the grid, a
halving of the time step, and a change of initial condition — and its Beale–Kato–Majda integral, not its peak,
must be the thing that grows. So far nothing has met that standard, and the honest headline of the first three
studies is *the instrument ran out before the physics did.*
:::

## Who is doing this

I am an aeronautical engineer — airframe structures and aerodynamics by trade, which means I read fluid
mechanics for a living and have no standing whatsoever in analysis. This programme runs on one laptop with a
6 GB GPU, in the evenings. The solver, the verification framework and the
analysis were built with Claude (Anthropic) as a pair; the physics judgement, the experiment design and the
decision about what may be claimed are mine.

The instrument itself is a single HTML file that runs offline from disk, with no network and no dependencies,
and it started life as an aerofoil tool. [How it is built](how-the-instrument-is-built.html) is the next post.
The three studies so far are [NS-001](ns-001-what-a-laptop-can-measure.html),
[NS-002](ns-002-the-number-that-grows-with-the-grid.html) and
[NS-003](ns-003-turning-the-reynolds-number-down.html), which is the first to show a local exponent falling.
