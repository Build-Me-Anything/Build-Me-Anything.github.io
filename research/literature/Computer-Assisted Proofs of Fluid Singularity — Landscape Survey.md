# Computer-Assisted Proofs of Fluid Singularity — A Landscape Survey

**Purpose.** To decide, before writing further code, whether the NSLab-Prove line has a defensible target — and if
so which. The question that prompted it: *has anyone built this before?*

**Date.** 2026-08-25. **Author.** Assistant survey for Michael, NSLab programme.

**Answer in one line.** Yes — comprehensively, by several strong groups, using off-the-shelf libraries; the one
thing this survey could find no precedent for is the piece we built by accident.

---

## 0. Findings

**F1. The pipeline we proposed to build is mainstream, and it has delivered.** "Numerically construct an
approximate self-similar profile → prove its nonlinear stability with interval arithmetic → conclude finite-time
blow-up" is the Chen–Hou architecture. It has produced published, refereed blow-up proofs for the De Gregorio
model on ℝ and for the 2D Boussinesq and 3D axisymmetric Euler equations with boundary. §2.

**F2. The certificate machinery is off-the-shelf.** `RadiiPolynomial.jl`, CAPD, INTLAB, Arb, CoqInterval, Gappa.
`cap/` hand-rolls what these libraries already do. §2.3.

**F3. The highest-visibility open target — certifying DeepMind's unstable self-similar profiles — is being
pursued by the people who produced them.** Javier Gómez-Serrano is both a co-author of that work and one of the
field's leading CAP practitioners. This is the most-attacked target in the area, not an under-attacked one. §3.3.

**F4. The community's own stated problem list contains two items this project's existing machinery already
touches** — a guaranteed, proof-emitting eigenvalue enclosure, and the trustworthiness of computer-assisted
proofs that depend on inaccessible software. §4.

**F5. This survey found no published example of an independent re-verification of a fluid computer-assisted
proof by a second, differently-argued implementation.** Formalisation of CAPs in proof assistants exists, but that
mechanises the *same* argument. Re-derivation by different arguments — Machine C's pattern — was not found. §5.2.
*NOT FOUND is a search result, not a proof of novelty.*

**Recommendation.** Do not compete on the mathematics. Target **independent verifiability** — §6, target T1.

---

## 1. Method and standard of evidence

Searched: the arXiv and web literature on singularity formation in incompressible fluid models, computer-assisted
proof methodology and libraries, and the reproducibility of validated numerics. Sources were read where full text
was reachable; where only a search snippet or abstract was available, the claim is marked **[abstract only]**.

Two standing rules from this programme, both applied:

- **NOT FOUND is a success, and is not a proof of absence.** A failure to find a precedent is reported as a
  failure to find, never as novelty.
- **Recent preprints are graded lower.** Anything from 2025 onward is marked *less verified*, following the
  convention already used in `research/nslab-prove/LITERATURE-CHECK.md`.

Not searched, and therefore not claimed on: conference proceedings without preprints, non-English literature,
theses beyond the two encountered, and any private or in-progress work. The last of these matters — F3's judgement
that a target is "attacked" rests on who the authors are, not on evidence of work in progress.

---

## 2. What has already been built

### 2.1 The architecture

The method is *dynamic rescaling with weighted energy estimates*. Blow-up is reduced to the long-time stability of
an approximate self-similar profile; the profile is constructed numerically; the transport term is never inverted
but moved onto a smooth weight by integration by parts; and the computer verifies **finitely many scalar
inequalities** in interval arithmetic while the infinite-dimensional analysis is done by hand.

This is the same change of variables that would be needed to make NSLab's DNS produce a candidate — the difference
being that in this architecture the rescaling is the *whole method*, not a pre-processing step for a simulation.

### 2.2 Results delivered

| system | domain / data | status | reference |
|---|---|---|---|
| De Gregorio | ℝ, smooth compactly supported | **blow-up proved**, computer-assisted | Chen, Hou & Huang, CPAM **74** (2021), arXiv:1905.06387 |
| De Gregorio | S¹, C^α | **blow-up proved** | Chen, arXiv:2107.04777 |
| De Gregorio | S¹, smooth | **open**, conjectured globally regular | ibid.; Jia–Stewart–Šverák, ARMA **231** (2019) |
| gCLM (a-family) | ℝ, a ≤ 1 | exact self-similar blow-up with smooth interior profiles | arXiv:2305.05895, ARMA (2024) |
| gCLM | degenerate data, a > 0 and a < 0 | new profile families, 2026 | arXiv:2603.25104 *[abstract only, less verified]* |
| 2D Boussinesq, 3D axisym. Euler | bounded domain, **with boundary**, smooth data | **blow-up proved**, computer-assisted | Chen & Hou, arXiv:2210.07191 (analysis) + arXiv:2305.05660 (rigorous numerics), Multiscale Model. Simul. (2025); PNAS 10.1073/pnas.2500940122 |
| 2D Boussinesq / 3D Euler | **no boundary**, C^∞ | **open** — conjectured, "we do not yet know how to establish this rigorously" | Elgindi & Pasqualotto, arXiv:2310.19780 |
| IPM | without boundary mass | active, 2025 | arXiv:2511.01827 *[abstract only, less verified]* |
| Free-boundary Euler | smooth graph → turnover → splash | **open**, stated as a workshop problem by Fefferman | AIM report, Problem 6 |
| 3D Navier–Stokes | R³ or T³, smooth finite-energy | **open** (Clay) — no credible CAP route | — |

The second Boussinesq/Euler row is the one that matters for our purposes: **"a model of the solution, and the maths
to show it" has been delivered for 3D Euler with boundary.** That is precisely the deliverable we described wanting.

### 2.3 The toolchain

| tool | language | role |
|---|---|---|
| `RadiiPolynomial.jl` | Julia | the radii-polynomial contraction — the same theorem `cap/radiipoly.py` implements |
| CAPD | C++ | validated numerics for dynamical systems |
| INTLAB | MATLAB/Octave | interval arithmetic |
| Arb | C | arbitrary-precision ball arithmetic; validated dense eigenvalue enclosures |
| CoqInterval, Gappa | Coq | *certified* interval arithmetic inside a proof assistant |

Note for our own records: `RadiiPolynomial.jl` uses the **Lipschitz** Z₂ convention, ours is **uniform-sup** —
already recorded in `LITERATURE-CHECK.md`. Correct citations for the radii-polynomial theorem remain
Day–Lessard–Mischaikow (2007) and Hungria–Lessard–Mireles James (2016), plus Jaquette–Lessard–Takayasu
(arXiv:2012.09734) for the statement including the injectivity hypothesis.

### 2.4 The machine-learning front end

DeepMind's contribution (Wang et al., arXiv:2509.14185) replaces the hand-built profile solver with a
physics-informed neural network trained by a full-matrix Gauss–Newton optimiser, reaching residuals near double
precision — a level the authors describe as meeting the requirements for computer-assisted proof. A November 2025
follow-up (arXiv:2511.22819) extends this to a 4th unstable IPM solution and describes itself as *"an important
ingredient for bridging the gap between numerical discovery and computer-assisted proofs"* — i.e. **as of that
paper the certificates were not yet closed.** *[abstract only, less verified]*

The certificate half of their pipeline was already standard. The novel half is the profile solver.

---

## 3. What is open, and who is on it

### 3.1 Genuinely open, in the target family

- **De Gregorio on S¹ from smooth data.** Open, conjectured globally regular. Note that `a = 1` is a *sharp*
  transition: slightly below 1 gives finite-time asymptotically self-similar blow-up from smooth data on the
  circle, slightly above gives global existence (Chen, ARMA **241** (2021), arXiv:2010.12700).
- **Boussinesq / 3D Euler blow-up from truly C^∞ data with no boundary and no geometric restriction.**
- **Water wave, graph → turnover → splash** as a single continuous scenario. The two halves are proved separately
  (Ann. of Math. 2012 and 2013); joining them is open.
- **3D Navier–Stokes** — the prize. No credible CAP route, and regularity is the expected answer.

### 3.2 Why "open" does not mean "available"

Every item in §3.1 is open because it is hard for reasons that are not about machinery. De Gregorio on the circle
is open *to the same people who proved the ℝ case*. The absence of a proof after a decade of concentrated effort by
Chen, Hou, Huang, Elgindi, Jeong, Šverák and Gómez-Serrano is evidence about difficulty, not about opportunity.

### 3.3 The visible target, and why not to take it

Certifying DeepMind's unstable IPM and Boussinesq profiles is well-posed, high-profile, and apparently not yet
done. It is also the single most-attacked problem in this area, by a team that includes the field's leading CAP
practitioner and possesses the profiles, the code and the compute. A solo effort entering that race loses.

---

## 4. What the community says it needs

From the AIM workshop report *Computational Mathematics in Computer Assisted Proofs* (undated in the report;
latest citation 2021, so ≥ 2021; talks by Hou, Buzzard, Gómez-Serrano, Balakrishnan, Helfgott, Veličković).
Its problem session produced eight problems. Four are relevant here.

**Problem 1 (K. Buzzard) — Are computer-assisted proofs real proofs?** *"Are computer-assisted proofs always real
proofs when proprietary software and/or hardware is involved that is not accessible to all readers/reviewers?"*
The discussion concluded that moving computations from closed-source to open-source systems is possible **"but it
involves work and there is not much incentive"**, and moving to verified systems such as Lean is possible in theory
but **"involves a huge amount of work in practice and there is again not much incentive."**

**Problem 3 (S. Olver) — a guaranteed eigenvalue solver.** Arb already computes validated spectra of dense
matrices to ~10⁻⁷⁰. Four gaps are named, of which two matter to us:

> 2. Rigorous proofs. E.g. Arb could potentially generate a computer verifiable proof but at the moment this is
>    not done.
> 3. Support for sparse or otherwise structured matrices.

**Problem 6 (C. Fefferman) — the water wave graph-to-splash problem.** §3.1.

**Problem 7 (F. Brehard) — validated numerics.** A roadmap for the ideal tool: an efficient C core, an easy
Python/Julia wrapper, and *"a proof assistant-side certification which would rule out possible bugs in the
implementation."*

**Problem 8 (A. Hansen) — AI in computer-assisted proofs.** Gómez-Serrano described PINNs as producers of initial
guesses for a checker, which *"can potentially lead to fully computer assisted proofs of open problems regarding
finite-time blow-up."* This is the DeepMind programme, named in a workshop problem session before it happened.

**The pattern.** Three of these four are about *trusting the computation*, not about the mathematics. Buzzard's
question and Brehard's item (3) are the same worry from two directions, and the report says out loud that the work
is unrewarded. That is a gap created by incentives, and a project with no publication pressure is unusually well
placed to occupy it.

---

## 5. Our assets, honestly assessed

### 5.1 What is not an advantage

`cap/`'s radii polynomials, Krawczyk operator and interval arithmetic duplicate mature libraries. Our verifier is
fast enough (a 90-mode candidate certified in 2.7 s; a K = 48 Galerkin eigenproblem in 0.65 s; certified matrix
entries at ~13 ms each — all measured 2026-08-25 on the laptop) but Arb is faster and better tested. Nothing here
is a research contribution.

### 5.2 What might be

**Machine C.** `auditor*.py` import `fractions`, `json` and `math` and nothing else — enforced by a structural
test — and re-derive every bound in **exact rational arithmetic by different arguments**: interval-arithmetic
range enclosure and the intermediate value theorem where the prover uses Krawczyk; its own preconditioner; series
with proved remainders for π, sin and cos. It rejects 44 tampered certificates and accepts the true ones,
agreeing with the prover to 6.4 × 10⁻²³.

That is a direct, working answer to Buzzard's Problem 1, in the one form the report says nobody is incentivised to
produce. Searching for prior art returned formalisation of CAPs inside proof assistants — which mechanises the
same argument in a trusted kernel — and a substantial literature on reproducibility in computational fluid
dynamics, including a replication study that took three years and four codes. **No example of a published fluid
computer-assisted proof being independently re-derived by a second implementation using different arguments was
found.** Stated as a failure to find.

**The discipline.** Verdicts that are not booleans; refusing rather than assuming an unverified hypothesis;
provenance recorded and never read. These are design decisions the archive paid for and they transfer.

---

## 6. Candidate targets, ranked

### T1 — A certificate-emitting, independently auditable eigenvalue enclosure **(recommended)**

Close R4b: rigorous enclosures of the matrix entries (**done**, 2026-08-25) *plus* a proven Galerkin truncation
bound (**the remaining piece**), giving a certified enclosure of the De Gregorio profile operator's eigenvalues —
then have Machine C re-derive it in exact rationals by a different argument.

Why this one:

- It is the piece our own line is already blocked on, so it serves the mathematics we have.
- It answers AIM Problem 3 items 2 and 3 — a *proof-emitting* enclosure, for a *structured* operator — which is a
  named community wish rather than our own invention.
- It is bounded. The two ingredients are stated, one is finished, and the machinery to consume both is graded.
- It does not race anyone.

Risk: the truncation bound may be genuinely hard for the Ḣ^{1/2} inner product, and the essential-spectrum
realisation hazard recorded in `LITERATURE-CHECK.md` bites the moment a space is fixed implicitly by truncation.
R4b fixes its space explicitly, so the hazard does not apply today — but any extension must re-check it.

### T2 — Independent re-verification of a published computer-assisted step **(recommended as a second)**

Take a *published* CAP step and re-derive it independently, by different arguments, in a dependency-free
implementation. The best-scoped candidate found: Elgindi & Pasqualotto (arXiv:2310.19780) require computer-assisted
verification that a function solving a linear Volterra integral equation on [0, ∞) is non-negative, and write that
proving it by hand *"appears to be challenging, at the current time, though we do not doubt that it is possible."*
Small, self-contained, named in a real paper, and exactly Machine C's pattern pointed outward instead of inward.

Risk: a re-verification that confirms the original is worth little unless the method is demonstrably capable of
rejecting a wrong one — which is why the 44 tamper cases matter, and why any such exercise must carry them.

### T3 — De Gregorio on S¹ from smooth data **(not recommended)**

Genuinely open, in the family, machinery mostly built. Also open to the people who solved the harder-looking ℝ
case with better tools. §3.2.

### T4 — Certify a DeepMind unstable profile **(not recommended)**

§3.3. Well-posed and losing.

### T5 — Water wave graph-to-splash **(out of reach)**

Fefferman's problem. Requires the free-boundary machinery from scratch; not adjacent to anything we have.

---

## 7. What this survey could not establish

1. Whether Gómez-Serrano and collaborators have CAPs of the DeepMind profiles in progress. Assumed yes on the
   basis of authorship. If wrong, T4's ranking changes.
2. Whether an independent re-derivation of a fluid CAP exists in literature this search did not reach. F5 is a
   failure to find.
3. The AIM workshop's date, and therefore how current its problem list is. Latest internal citation is 2021.
4. Whether Chen–Hou's published rigorous-numerics code is complete enough for a re-verification to be meaningful
   without contacting the authors. Not checked.
5. Anything about the 2026 gCLM preprints beyond their abstracts.

---

## 8. Reading order for whoever picks this up

1. `research/nslab-prove/LITERATURE-CHECK.md` — the four claims of ours that were refuted.
2. Chen & Hou, arXiv:2210.07191 §1 — the architecture, in the authors' own framing.
3. Huang, Tong & Wei, arXiv:2209.08232 — the compact-operator reformulation, which is R4b.
4. The AIM report, Problems 1, 3 and 7 — the trust gap.
5. Elgindi & Pasqualotto, arXiv:2310.19780 §1.4.6 and §5 — the Volterra step, for T2.

---

*Numerical evidence and literature assessment only. Nothing in this document proves anything about the
Navier–Stokes equations, and no claim here should be read as one.*
