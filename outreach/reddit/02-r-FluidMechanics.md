# Draft 2 — r/FluidMechanics

**Type:** text post. **When:** 2–3 days after the r/CFD thread, and only if that one went reasonably.
**Angle:** the physics of the reconnection, not the software. This audience skews academic and student, so the
question at the end matters more than the instrument description.
**Flair:** check the sidebar; there is usually a *Discussion* or *Research* flair.

---

## Title options

1. **Vortex reconnection at Re_Γ ≈ 8 000–16 000: the energetics converge on my grid, every local diagnostic doesn't. Where does the bridge stop being under-resolved?**
2. Antiparallel tube reconnection: both sides of the enstrophy budget triple across a refinement ladder while dZ/dt barely moves
3. What resolution does a Kerr-type reconnection bridge actually need? A ladder from 96³ to 256³ says "more than this"

---

## Body

I have been running a Kerr-type antiparallel vortex-tube reconnection in a periodic box as a resolution study,
and I have run into something I would like the reconnection people here to sanity-check.

**Configuration.** Two Gaussian-core tubes of opposite circulation along *x*, amplitude 8, core σ = 0.4,
half-separation 0.7 + 0.2 cos *x* in a 2π box, projected to a divergence-free field; Γ ≈ 4.0 per tube. Fourier
pseudo-spectral, 2/3 dealiased, exact projection, RK4, double precision, on a refinement ladder 96³ → 192³ →
256³. Two Reynolds numbers: ν = 1/4000 (Re_Γ ≈ 16 000) and ν = 1/2000 (Re_Γ ≈ 8 000). The pair self-advects to
the periodic plane by t ≈ 7 and reconnects around t ≈ 8.3.

**What converges.** At Re 4000, between 192³ and 256³: energy to 0.06 % at t = 10, dissipation to ≤ 0.1 % up to
t = 7 and ~5 % through the event, peak dissipation +0.8 %, peak enstrophy +0.9 % (1.357 → 1.369). Global
resolution kmax·η ≥ 1.81 throughout, enstrophy budget residual 9·10⁻⁶, and the spectral and physical estimates
of ⟨ω·S·ω⟩ agree to every printed figure.

**What does not.** Peak max|ω| goes 60.7 → 108.5 → 138.8 across the ladder — N^0.84 then N^0.86, exponent flat.
The BKM integral ∫₀¹⁰‖ω‖∞ dt goes 181 → 264 → 314, N^0.6. Peak ⟨ω·S·ω⟩ goes 0.73 → 1.71 → 2.48 and peak
palinstrophy dissipation 2νP goes 0.53 → 1.61 → 2.41 — both roughly tripling — while their difference, dZ/dt,
moves only 0.49 → 0.51 → 0.61. Two large unconverged quantities whose difference is converged, with the budget
closing to 10⁻⁶ the whole time.

The maximum on the plane z = 0 converges (35.3 at 192³ against 33.0 at 256³) while the volume maximum does not,
which puts the grid-limited structure in the bridge core near x = π rather than on the symmetry plane. Local
ω·S·ω there reaches ~2 100 against a volume mean of 2.4.

**Halving Re helps, but only partly.** At Re 2000 the same ladder gives 52.3 → 92.1 → 109.4: N^0.82 then
**N^0.60**, the first falling exponent I have measured (Re 4000 stayed at 0.84 → 0.86). The BKM integral follows,
N^0.44 → N^0.37. But the 256³ level passes every check even at its worst snapshot — kmax·η = 2.94, spectral tail
2.7·10⁻⁵ at the instant of the event — and its peak is still 19 % above the level below, while ε_max moves 0.2 %.
Spectral interpolation of the maximum accounts for at most 6 %, so it is not a grid-sampling artefact.

Splitting the BKM integral where the vorticity first meets its periodic image: ∫₀⁷‖ω‖∞ dt is converged to 0.2 %
across the ladder (64.3, 63.2, 63.3) while ∫₇¹⁶ moves +81 % then +11 %, and the image gap holds at 2.7–3.3 box
units through the event. The non-convergence is a property of the reconnection, not of the box.

**Time step is not the culprit:** halving Δt at 96³ moves the peak by 0.002 % and the BKM integral by 0.13 %.

**Caveat I want to state before anyone else does:** the vorticity-carrying region crosses the box boundary in z
at t ≈ 7, so both the max|ω| event and the enstrophy peak occur after the pair has begun interacting with its
own periodic images. Only t ≲ 7 is clean isolated-pair dynamics. I log the image gap every snapshot now and
report convergence separately either side of the crossing.

**Questions for people who do this properly:**

1. Is the tripling of both budget terms with a converged difference a familiar signature? My reading is that
   production and palinstrophy dissipation both live in the bridge and are therefore effectively local
   quantities, so they inherit the bridge's resolution problem while their difference — which is what the
   equations actually constrain — does not. Is that the standard picture?
2. What sets the resolution requirement for the bridge? If it is δ ~ (ν t)^½ then Re 2000 at 256³ should have
   been comfortable, and it does not look comfortable at 192³.
3. Is there an accepted *local* resolution criterion for reconnection studies? kmax·η is a mean-dissipation
   quantity and it is clearly grading the wrong thing here.
4. Practical: how do people keep an antiparallel pair from meeting its images before reconnection completes,
   short of a much bigger box?

Write-up with the full ladders, the health reports and the figures: [BLOG URL]. I am aware of the Kerr (1993) /
Hou & Li (2006) history and of Kerr (2018) on enstrophy and circulation scaling; this is not an attempt to
revisit that argument, it is an attempt to find out what my own instrument can measure.

*Disclosure: I am an airframe engineer by trade, and the solver and analysis were built in partnership with
Claude (Anthropic). Verification details are in the write-up — exact solutions to 3·10⁻¹², two independent
implementations agreeing to 4·10⁻¹², Taylor–Green reproduced to 0.7 % of the 512³ reference — and I would much
rather someone found a hole in it than not.*
