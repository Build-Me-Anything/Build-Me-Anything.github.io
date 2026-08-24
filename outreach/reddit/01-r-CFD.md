# Draft 1 — r/CFD

**Type:** text post (self-post), blog linked at the end, not a link post.
**Flair:** check the sidebar — most likely *Discussion* or *Personal project*, if either exists.
**Post this one first.** See `posting-playbook.md` §2 and run the pre-flight checklist in §3.

---

## Title options

1. **A verified pseudo-spectral DNS on a laptop: the energetics converge, max|ω| refuses to — three flows, same story**
2. I built a single-file offline aero tool that grew a 3D Navier–Stokes lab, and the maximum vorticity won't converge on any grid I can afford
3. Refinement ladders on vortex reconnection at Re_Γ = 8 000 and 16 000: ε converges to 0.8 %, peak vorticity scales as N^0.85

*(1) is the recommended headline: it is the result, and it invites people who have fought this exact battle.*

**If you want the ambition in the title, this is the honest version:**

> Two days of "build me anything" turned into a Navier–Stokes regularity programme. Three studies in, here is
> what a laptop can and cannot measure — and why none of it is evidence of anything yet.

---

## Body

I have been building a 3D incompressible Navier–Stokes laboratory on a laptop and grading every run before I
believe it. Three studies in, the result is consistent and slightly annoying, and I would like people who have
done this properly to tell me what I am missing.

**Setup.** Fourier pseudo-spectral on the periodic 2π box — 2/3 dealiasing, rotational form, exact projection,
RK4 with adaptive CFL. Double precision. Implemented twice, once in JavaScript (browser Web Worker and Node)
and once in CuPy/cuFFT on a 6 GB RTX 3060, which is where the evidence runs happen. The two implementations
agree to 3·10⁻¹⁵ on small cases and to 4·10⁻¹² in E, Z, ε and max|ω| over all 1229 steps of a 192³ run to
t = 16. Verified against the ABC exact solution to 3·10⁻¹², measured RK4 order 4.01, ∇·u at 10⁻¹⁶, hand-written
mixed-radix FFT checked against a direct DFT to 7·10⁻¹².

Every run carries a health report — divergence, exact energy conservation of the nonlinear term, RK4-consistent
energy and enstrophy budgets, kmax·η, spectral tail, and two independently computed estimates of ⟨ω·S·ω⟩ that
must agree — and nothing gets quoted before its report is read.

**NS-001, Taylor–Green at Re 1600, ladder 96³ → 192³ → 256³.** The dissipation peak converges: ε_max = 0.01291
at t = 8.88 on 256³, which is 0.7 % below the 512³ spectral reference (van Rees et al. 2011) and 2.5 % above
Brachet et al. (1983), and 1.7 % from its own 192³ level. The maximum vorticity does not: 37.0 → 55.1 → 74.3,
+49 % then +35 %, peak instant drifting later, history getting spikier. The BKM integral ∫₀¹⁰‖ω‖∞ dt converges
faster than the peak — 160 → 223 → 250 — but is still moving.

**NS-002, Kerr-type antiparallel vortex tubes, Re 4000 (Re_Γ ≈ 16 000), same ladder.** Energetics converged by
256³: ε_max +0.8 %, Z_max +0.9 % on the level below, health PASS, kmax·η ≥ 1.81, enstrophy budget 9·10⁻⁶.
Peak max|ω|: **60.7 → 108.5 → 138.8**, i.e. N^0.84 then N^0.86 — the exponent is not falling. BKM integral
181 → 264 → 314, N^0.6. Both sides of the enstrophy budget triple across the ladder (peak ⟨ω·S·ω⟩ 0.73 → 1.71
→ 2.48, peak 2νP 0.53 → 1.61 → 2.41) while their difference, dZ/dt, moves 0.49 → 0.51 → 0.61. The maximum on
the archived z = 0 plane *does* converge (35.3 → 33.0); the volume maximum does not — so the grid-limited
structure is the bridge core off that plane.

Halving Δt at 96³ changes the peak by 0.002 %, so this is spatial, not temporal.

**NS-003, same initial condition at Re 2000, complete.** The idea was that a thicker bridge would let the
ladder converge. Peak max|ω|: 52.3 → 92.1 → 109.4, which is **N^0.82 then N^0.60 — the first falling exponent in
the programme** (Re 4000 gave 0.84 → 0.86, flat). The BKM integral does the same, N^0.44 → N^0.37. So halving Re
buys partial convergence, slowly: +18.7 % on the last level is still nowhere near converged.

The uncomfortable part is that the 256³ level is the best-resolved run I have: health PASS on the *worst*
snapshot, kmax·η = 2.94 and spectral tail 2.7·10⁻⁵ at the instant of the event, budgets 1.6·10⁻⁹ and 1.1·10⁻⁶ —
and its peak is still 19 % above the level below. ε_max, by contrast, moves 0.2 %. Splitting the BKM integral at
the point where the vorticity first meets its periodic image: ∫₀⁷ is converged to **0.2 %** across the ladder
(64.3, 63.2, 63.3) while ∫₇¹⁶ moves +81 % then +11 %. Everything that fails to converge happens inside the
reconnection itself, not in the box geometry.

**What I am claiming:** nothing about regularity. A quantity that grows when you refine the grid is an
under-resolved structure, not a feature of the equations, and the whole point of building the health report and
the ladders was to be able to say that with numbers instead of vibes. What I think the runs do show is a
quantitative ordering of what is measurable at a given cost: integral energetics first, then ∫‖ω‖∞ dt, then the
instantaneous maximum, last and possibly not at all — and that the gap between the first and the last widens
sharply in a flow that concentrates vorticity into a sheet.

**Where I would like help, specifically:**

1. In your experience with reconnection DNS, what resolution *does* it take before the peak vorticity in a
   Kerr-type configuration stops moving — and is it the bridge thickness that sets it, or something else?
2. Is there a better local resolution diagnostic than kmax·η for this? Something that grades the worst
   structure rather than the mean dissipation. I have been using the spectral tail at the peak instant as a
   proxy and it feels crude.
3. Periodic images: mine crosses the boundary in z at t ≈ 7 and the event is at t ≈ 8.3, so strictly the
   dramatic part is a replicated system. I now log the gap to the nearest image every snapshot (it holds at
   2.7–3.3 box units through the event at Re 2000) and split the BKM integral at the crossing. Is that enough
   to call the event clean, or is a bigger box the only honest answer?

Full write-up with the ladders, the health reports, the figures and the caveats: https://build-me-anything.github.io. The archive has
every run's series, snapshots, spectra and grades; happy to hand over the data for anyone who wants to compare
against a real code.

*Disclosure, since it will come up: I am an aeronautical engineer, not a mathematician, and the solver, the
verification framework and most of the write-up were built in partnership with Claude (Anthropic). The
experiment design and every decision about what may be claimed are mine — which is why the claims are so
carefully small. The verification is all reproducible and I would rather someone found a flaw in it than not.*

---

## First comment (post immediately after, if the body ran long)

The one number I keep coming back to: at 256³ the Re 4000 tube run passes every global check — kmax·η 1.81,
energy budget 2·10⁻⁸, enstrophy budget 9·10⁻⁶, spectral tail 1.2·10⁻⁵ at the end of the run — and its peak
vorticity is still 28 % above the level below. The tail only creeps up to ~1·10⁻⁴ during the four snapshots
around the event. A run can be fully resolved in every mean sense and completely unresolved in the one place
that matters.

---

## Notes

- The blog link is live and already filled in: https://build-me-anything.github.io
- If a moderator asks you to remove the blog link, the post still stands on its own — say so and leave it.
- Do not reply to "so is Navier–Stokes solved?" with anything but "no, and nothing here bears on it."
