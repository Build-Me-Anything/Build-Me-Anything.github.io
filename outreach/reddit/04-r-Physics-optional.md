# Draft 4 — r/Physics (optional, lowest priority)

**Only post this if the r/CFD and r/FluidMechanics threads went well**, and only after reading their rules.
r/Physics removes personal-theory posts and is strict about self-promotion; a computational-methods post with
a concrete measured result and no claim is the version that survives. If a standalone post is removed, their
weekly "Physics Questions"/"Careers and Education" style threads are not the right home either — in that case
drop it and keep to the CFD subreddits.

**Type:** text post. **Flair:** likely *Research* or *Academic* — check.

---

## Title options

1. **Which quantities in a 3D Navier–Stokes DNS actually converge? A measured trust hierarchy from a refinement study**
2. Integral vs local diagnostics in spectral DNS: dissipation converges to 0.7 % where peak vorticity is still moving 35 % per grid level

---

## Body

A small computational result that I think is worth stating cleanly, because it is the sort of thing everyone
knows qualitatively and rarely sees quantified on one flow at one cost.

Running the 3D incompressible Navier–Stokes equations on a periodic box with a standard Fourier pseudo-spectral
method (2/3 dealiasing, exact projection, RK4, double precision) and grading the same flow at three grid
resolutions, there is a consistent ordering in what has converged:

1. **Integral energetics — E, Z, ε.** Converge first and cheaply. For the Taylor–Green vortex at Re = 1600, a
   256³ grid puts the peak dissipation at 0.01291 (t = 8.88), which is 0.7 % below the published 512³ spectral
   value and 2.5 % above Brachet et al. (1983), and within 1.7 % of its own 192³ level.
2. **The time-integrated maximum vorticity, ∫‖ω‖∞ dt** — the Beale–Kato–Majda quantity. Converges more slowly:
   160 → 223 → 250 across 96³ → 192³ → 256³, so +39 % then +12 %.
3. **The instantaneous maximum ‖ω‖∞.** Does not converge at any resolution reached: 37.0 → 55.1 → 74.3, with
   the instant of the peak drifting later and the history becoming increasingly intermittent.

In a flow designed to concentrate vorticity — two antiparallel vortex tubes perturbed into a reconnection at
Re_Γ ≈ 16 000 — the gap widens sharply. The energetics converge to better than 1 % between 192³ and 256³ while
the peak vorticity goes 60.7 → 108.5 → 138.8, scaling as N^0.85 with no sign of saturating, and the BKM integral
as N^0.6. Both terms of the enstrophy budget dZ/dt = ⟨ω·S·ω⟩ − 2νP roughly triple across the ladder while their
difference moves by 20 % and the budget closes to 10⁻⁶ throughout.

The global resolution criterion is satisfied the whole time (kmax·η ≥ 1.8), which is the interesting part:
kmax·η grades the mean dissipation scale, and a reconnection bridge is thinner than the scale it describes. A
run can be resolved in every mean sense and unresolved in the one structure that carries the maximum.

**Explicitly not claimed:** anything about the regularity problem. A quantity that grows when you refine the
grid is the signature of a structure the grid cannot represent. The point of the exercise is to establish, with
numbers, which diagnostics a given resolution can support — and the answer is that the one a
Beale–Kato–Majda-style argument would need is the last one you get, if you get it at all.

Full write-ups, refinement ladders, health reports and figures: https://build-me-anything.github.io. The runs are archived with their
per-step series, snapshot diagnostics, spectra and grades.

*Disclosure: I am an aeronautical engineer rather than a physicist, and the solver and analysis were built in
partnership with Claude (Anthropic). The verification is described in full — exact solutions to 3·10⁻¹², two
independent implementations agreeing to 4·10⁻¹² over 1229 steps, published benchmark reproduced to 0.7 % —
because it is the only thing that makes the numbers worth reading.*
