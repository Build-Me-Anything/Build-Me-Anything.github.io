# Literature check of the NSLab-Prove line — what survived, and what did not

**2026-08-25.** The first real run of the `oracle-hunter` agent (`research/nslab-prove/agents/oracle-hunter/`) was
pointed at the claims underpinning R1–R3. It confirmed most of them and **refuted one**, which is the reason the
fleet exists: every check in `cap/` up to that point had been written by the author of the code it tested, and
none of it could have caught a claim that was wrong about the *literature* rather than about the arithmetic.

Citations below are the agent's, spot-checked. The pre-2022 sources are well known and solid; anything from 2025
onward is marked as less-verified.

---

## CONFIRMED

**The De Gregorio equation and its mean-zero condition.** `ω_t + u ω_x = ω u_x`, `u_x = H(ω)`, `∫ u = 0`, exactly
as implemented. The mean-zero condition is part of the standard statement, not an extra assumption.
— Jia, Stewart & Šverák, *On the De Gregorio modification of the Constantin–Lax–Majda Model*, ARMA **231** (2019)
1269–1304, arXiv:1710.02737.

**`ω = A sin x` is an exact steady state — and is far from obscure.** It is the `m = 1` member of a documented
two-dimensional manifold of equilibria `Ω_{A,θ₀} = A sin m(θ − θ₀)`. JSS Theorem 1.1 proves the `m = 1` manifold
is **nonlinearly, exponentially stable**, with solutions relaxing onto it; `m ≥ 2` are unstable (made rigorous in
Guo & Jiu, arXiv:2506.02800, 2025 — *less verified*).

Useful detail the agent supplied and the code should record: the cancellation is **independent of the Hilbert
transform sign convention**. With `Hω = εA(−cos x)` and `ε = ±1`, mean-zero forces `u = −εA sin x` and the two
terms cancel for either sign. So R2's end-to-end check does not silently depend on our convention matching a
paper's.

**The a-family.** `ω_t + a u ω_x = u_x ω`, `a = 0` → CLM, `a = 1` → De Gregorio, due to Okamoto, Sakajo & Wunsch,
*On a generalization of the Constantin–Lax–Majda equation*, Nonlinearity **21** (2008) 2447–2461. Caution: some
authors put `a` on the stretching term instead, so the convention must be stated.

**The derivative-loss diagnosis.** `u_x ω = (Hω)ω` is bounded on `ℓ¹_ν` (H is a unit-modulus Fourier multiplier
and `ℓ¹_ν` is a Banach algebra); `u ω_x` loses one derivative and is genuinely unbounded there. So the residual
does not map `ℓ¹_ν → ℓ¹_ν` and a naive single-space radii-polynomial contraction fails at the first step. That
much of `problem_degregorio.py` was right.

---

## REFUTED — the prognosis, not the diagnosis

`problem_degregorio.py`, the `cap/README.md` and the architecture document all stated that the fix is **"a
two-space Newton–Kantorovich with an approximate inverse that gains the derivative the transport term loses"**,
and framed the situation as a wall that stops the programme.

**No published proof in this family does that.** The established routes are:

**(a) Dynamic rescaling with weighted energy estimates.** The transport term is never inverted; it is moved onto a
known smooth weight by integration by parts, `∫ u ω_x ω φ = −½ ∫ ω² (uφ)_x`. The computer then verifies **finitely
many scalar inequalities** about an approximate profile in interval arithmetic, and the infinite-dimensional
analysis is done by hand. This is the Chen–Hou–Huang / Chen–Hou architecture.
— Chen, Hou & Huang, *On the Finite Time Blowup of the De Gregorio Model for the 3D Euler Equations*, CPAM **74**
(2021) 1282–1350, arXiv:1905.06387; Chen & Hou, arXiv:2210.07191 (analysis) and arXiv:2305.05660 (rigorous
numerics).

Chen & Hou are explicit that Sobolev norms are the wrong choice for the Euler problem — they combine weighted
`L^∞` and weighted `C^{1/2}` estimates, because strong advection normal to the boundary produces a large growth
factor in weighted `L²`/`H^k`.

**(b) Reformulate so the loss disappears.** For the *profile* equation, Huang, Tong & Wei recast De Gregorio
self-similar profiles as **eigenfunctions of a compact self-adjoint operator** (*On self-similar finite-time
blowups of the De Gregorio model on the real line*, CMP 2023, arXiv:2209.08232). A compact operator eigenproblem
is exactly the kind of object a radii-polynomial argument handles in a single space.

**(c) A genuine scale-of-spaces route exists but does not do what we want.** Trading the lost derivative for a
shrinking analyticity radius, `ℓ¹_ν → ℓ¹_{ν'}` with `ν' < ν` (abstract Cauchy–Kovalevskaya / Ovsyannikov), gives
local-in-time analytic well-posedness on a shrinking scale — **not a contraction with a fixed point**, so no
certified enclosure.

**And the sharpest correction:** Chen–Hou–Huang proved **finite-time blow-up for De Gregorio on ℝ from smooth
compactly supported data, by a computer-assisted interval-arithmetic argument, in 2019** — derivative loss and
all. Describing it as an obstruction that stops the programme was wrong. It is a solved design problem, and this
project picked the wrong door.

---

## CONFIRMED, and a gap in our documents: the domain matters

De Gregorio's blow-up status is **domain-dependent**, and our write-ups said "De Gregorio" without a domain:

| domain | data | status |
|---|---|---|
| ℝ | smooth, compactly supported | **blow-up proved** (Chen–Hou–Huang, computer-assisted) |
| S¹ | smooth | **open**, conjectured globally regular; proved global on a nontrivial sign/symmetry class (Chen, arXiv:2107.04777) |
| S¹ | `C^α` | **blow-up proved** (Chen, arXiv:2107.04777) |

`a = 1` is a sharp transition: for `a` slightly below 1 there is finite-time asymptotically self-similar blow-up
from smooth data on the circle; slightly above 1, global existence with `‖ω‖_{H¹} = O(t^{-1})`.
— Chen, *On the Slightly Perturbed De Gregorio Model on S¹*, ARMA **241** (2021) 1843–1869, arXiv:2010.12700.

Elgindi & Jeong (ARMA **235**, 2020, arXiv:1701.04050) proved blow-up in `L^p ∩ C^α(ℝ)` and *conjectured* global
regularity for `ω₀ ∈ L^p ∩ C¹(ℝ)`; CHH's later `C_c^∞` blow-up on ℝ sits inside that class, so the second half of
that conjecture is superseded on the line. The circle conjecture stands.

---

## What this changes in the code and documents

1. **R2's scope statement is rewritten.** "Blocked by derivative loss" becomes: *the single-space `ℓ¹_ν`
   radii-polynomial formulation cannot close on the transport term; the literature closes it by weighted energy
   estimates with integration by parts, or by recasting the profile equation as a compact operator eigenproblem.*
2. **The domain is stated everywhere** De Gregorio is mentioned.
3. **`ω = A sin x` is labelled as the known ground state**, not as a convenient exact solution we found — and the
   convention-independence of the cancellation is recorded.
4. **The next rung changes.** The realistic R3 target is no longer "invent a two-space estimate". It is either
   Huang–Tong–Wei's **compact operator eigenproblem** — genuinely `ℓ¹`-friendly, and reachable by the machinery
   already built — or reproducing a piece of the CHH finite-dimensional interval-arithmetic verification.

**All four are done** (2026-08-25). Items 1–3 are in `cap/problem_degregorio.py` and `cap/README.md`. Item 4 became
**R4** (`cap/problem_eigen.py` — the compact-operator machinery, certified against exactly known eigenpairs, with a
merely bounded operator refused as the discriminating test) and **R4b** (`cap/problem_dg_profile.py` — the
Huang–Tong–Wei profile operator transcribed, its six published eigenvalues reproduced, and explicitly *not*
certified). The remaining step is named rather than done: rigorous enclosures of
`A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}` and a proven tail bound on them.

## One hazard worth carrying forward

The essential spectrum of the self-similar generator is **realization-dependent** — an `L²` realization fills
strips where an `H²` realization collapses to lines. Any discretised CAP that fixes a space implicitly through its
truncation inherits whichever picture that space gives. Flagged for the compact-operator route.

**Still open, and not yet recorded in the code** (checked 2026-08-25). R4b fixes its space explicitly — `V` with
the plain `Ḣ¹` inner product, per the source — so the hazard does not bite there today. It will bite the first
time an operator is discretised whose space is chosen by the truncation rather than stated in advance, and no
check in `cap/` would notice.
— Xu, *The spectral picture of self-similar collapse in the Constantin–Lax–Majda equation*, arXiv:2607.19762
(2026) — *less verified, recent preprint*.

---

# Second check: the radii-polynomial methodology

## REFUTED — a missing hypothesis, now fixed

Our statement of the radii-polynomial theorem omitted a standing hypothesis: **A must be injective** (and `A·F`
must map the space into itself). It is not decorative. `T(a) = a` gives only `A·F(a) = 0`, which is `F(a) = 0`
solely when A kills nothing. Every careful source states it:

> "assume that A is injective and that Af : X → X. Let Y₀, Z₀ and Z₁ be nonnegative constants… Define the radii
> polynomial by p(r) := Z₂(r)r² − (1 − Z₁ − Z₀)r + Y₀. If there exists r₀ > 0 such that p(r₀) < 0, then there
> exists a unique p̃ ∈ B_{r₀}(p̄) such that f(p̃) = 0."
> — Jaquette, Lessard & Takayasu, arXiv:2012.09734, Thm 3.5; same structure in Castelli, Gameiro & Lessard,
> ARMA **228** (2018), arXiv:1509.08648, Lemma 3.5.

`radiipoly.verify()` sees only three numbers and cannot check injectivity, so the hypothesis is now stated in the
module and **each problem records why its A is injective**: identity for CLM and Burgers; for the quadratic
problem, the exact inverse of a lower-triangular matrix with unit diagonal, block-diagonal with an identity tail.

## CONFIRMED, with the convention pinned

Two conventions differ in the r² coefficient. Ours is the **uniform-sup** convention (Z₂ bounds
`‖A(DF(b) − DF(ā))‖ ≤ Z₂·r` over the ball, coefficient Z₂, strict `p(r) < 0`), matching Jaquette et al. and
Castelli et al. The **Lipschitz** convention gives ½Z₂ and needs a separate contraction condition — this is what
RadiiPolynomial.jl uses, with `p(r) ≤ 0` *and* `p′(r) < 0`. Every Z₂ in this project is a uniform-sup bound, so
our form is the right one; mixing them would be conservative by a factor of two, not wrong.

We also collapse the usual Z₀/Z₁ split by taking `A† = DF(ā)` exactly. Legitimate; it forfeits the computational
reason the split exists (Z₀ a finite matrix norm, Z₁ the tail).

## CORRECTED — two citations that do not support what they were cited for

Both were given verbally as radii-polynomial references. Neither is:

- **van den Berg & Lessard, *Rigorous Numerics in Dynamics*, Notices AMS 62(9) (2015).** Full text checked: it
  contains no radii polynomial, no Y/Z bounds, no Kantorovich statement. It supports the surrounding narrative
  only.
- **Gómez-Serrano, *Computer-assisted proofs in PDE: a survey*, SeMA J. 76 (2019), arXiv:1810.00745.** Grepped:
  zero occurrences of "radii", "Krawczyk", "Kantorovich", "Newton", "contraction", "fixed point". It is the right
  survey for interval arithmetic and fluid CAPs, and the wrong one for this.

**Use instead:** Day, Lessard & Mischaikow, *Validated continuation for equilibria of PDEs*, SIAM J. Numer. Anal.
**45**(4) (2007) — the origin; and Hungria, Lessard & Mireles James, *Rigorous numerics for analytic solutions of
differential equations: the radii polynomial approach*, Math. Comp. **85** (2016) — the name.

## CONFIRMED — ℓ¹_ν, with a precision fix

Banach algebra and the analyticity interpretation both confirmed (Jaquette et al., Def. 1.2). But the strip
half-width is **log(ν)/ω**, not log ν, where ω is the fundamental frequency — equal only for period 2π, which is
our case. Stated generally now so it does not silently break on a rescaled domain.
— Mireles James et al., arXiv:2405.12446, Lemma C.1 (Cauchy bounds).

## CONFIRMED — Krawczyk, and the interior requirement is load-bearing

> "**Theorem 2** 1. If x\* ∈ [x] and F(x\*) = 0, then x\* ∈ K(x₀, [x], F). 2. If K(x₀, [x], F) ⊂ **int** [x], then
> there exists in [x] **exactly one** solution of F(x) = 0."
> — Zgliczyński, *Interval Krawczyk and Newton method*, CAP course notes, Jagiellonian University (2007).

Attribution: Krawczyk (1969) for the operator, Moore (1977) for existence, Rump (1983) for uniqueness. Our
insistence on `⊂ int` rather than `⊆` is correct and is used twice in the proof. Note: over **complex** intervals
uniqueness needs an extra condition `√2‖1 − Y·JF(I)‖_∞ < 1` (Breiding, Rose & Timme, arXiv:2011.05000, Thm 3.6);
our R0 works over real intervals, so this does not bite — recorded in case that changes.

## CONFIRMED as a real failure mode — but our remedy is not the citable one

The dyadic-boundary trap is documented, in software rather than in a paper. IntervalRootFinding.jl exposes
`where_bisect`, default **127/256**:

> "Value used to bisect the region. It is used to avoid bisecting exactly on zero when starting with symmetrical
> regions, often leading to having a solution directly on the boundary of a region, which prevent the contractor
> to prove it's unicity."

That is exactly our bug. **Golden-ratio splitting was NOT FOUND anywhere as a remedy for this** — ours works, but
127/256 is the precedent, and is arguably better: exactly representable in binary, so the split point carries no
rounding of its own. Recorded in `clm.py`; not changed, because swapping a green split for a citation is the wrong
trade.

## CONFIRMED — Chen & Hou, and Elgindi

Chen & Hou proved finite-time blow-up for **2D Boussinesq and 3D axisymmetric Euler with smooth finite-energy data
and boundary** — the Hou–Luo scenario — on the cylinder with no-flow boundary. Part I (analysis) arXiv:2210.07191;
Part II (rigorous numerics) arXiv:2305.05660, Multiscale Model. Simul. **23**(1):25–130 (2025); announcement PNAS
**122**(27):e2500940122 (2025). Mechanism: nonlinear stability of a numerically constructed approximate
self-similar profile in weighted `L^∞` + weighted `C^{1/2}`, with the linearised operator split into a
leading-order part plus a **finite-rank operator of rank < 50**. INTLAB for round-off only; all discretisation
error bounded analytically. No CPU-hour figure is published; the verification is parallelised over time
subintervals, run on Caltech HPC plus a 28-core Xeon W with 768 GB.

Elgindi, *Finite-time singularity formation for C^{1,α} solutions to the incompressible Euler equations on ℝ³*,
**Annals of Mathematics 194**(3):647–727 (2021) — axisymmetric **without swirl**, no boundary needed, and
**purely analytical, no interval arithmetic**. The two results trade in opposite directions: Chen–Hou take smooth
data but need a boundary; Elgindi needs no boundary but gives up smoothness.

---

# Third check: CLM — everything confirmed, and a new external oracle

Claims 1–4 **CONFIRMED exactly as implemented**, constants and sign conventions included. Chae's survey uses our
precise variable convention:

> `z(x,t) = Hθ(x,t) + iθ(x,t)` … `z_t = (1/2) z²` … `z = z₀ / (1 − (1/2) t z₀(x))`
> — Chae, *Incompressible Euler Equations: the blow-up problem and related results*, arXiv:math/0703405, §4.2.

The blow-up-time formula is CLM 1985 **Corollary 1**, quoted by number in Huang, Qin & Wang, arXiv:2401.14615 §2:
blow-up occurs **iff** `S = {x : ω₀(x) = 0, H(ω₀)(x) > 0}` is non-empty, and then `T = 2/sup{H(ω₀)(x) : x ∈ S}`.
The periodic Hilbert transform with symbol `−i·sgn(k)` — i.e. `H(cos kx) = sin kx` — is our convention, and the
closed form is valid on the circle as well as the line (Ambrose, Huang, Siegel et al., arXiv:2411.01891).

For `ω₀ = cos x`: `S = {π/2}`, sup = 1, **T = 2**. Convention-proof for this datum — the opposite sign convention
gives `S = {−π/2}` with the same sup — though *not* in general, since flipping H is equivalent to `t → −t`.

**New external oracle, now in the R1 suite.** Elgindi & Jeong's exact self-similar CLM solution, as reproduced in
Huang–Qin–Wang §2.1:

    ω₀(x) = −2a²cx/(a² + c²x²),   H(ω₀)(x) = 2a³/(a² + c²x²),   blow-up at T = 1/a

Our formula gives `θ₀(0) = 2a`, hence `T = 2/(2a) = 1/a` — agreement for every `a`, which **pins the factor of 2**
against a source that computed the time by a different route. This is now `test_r1.py` §8, with a paired check
that the constant 1 in place of 2 *fails* it, so the test has teeth. Four `(a, c)` pairs pass.

## SOFTENED — one claim we should not make

"CLM blows up for generic smooth data" is not literature-grade. Sources say "most solutions" (Okamoto–Sakajo–
Wunsch) or "a large class" (Ambrose et al.). On ℝ it is false in any reasonable topology: any `ω₀` that never
vanishes gives `S = ∅` and global existence, and that family is open in `L^∞`. The correct statement is the
**iff**. On the circle with mean-zero data the set `S` is non-empty automatically — but that argument was derived
by the checking agent and not found in a source, so it is recorded here as an observation, not a citation.

---

# Scoreboard

| claim checked | verdict |
|---|---|
| CLM equation, linearisation, closed form, blow-up-time formula, T = 2 for cos x | **CONFIRMED**, constants and conventions included |
| De Gregorio equation and mean-zero condition | **CONFIRMED** |
| `ω = A sin x` an exact steady state | **CONFIRMED** — and it is the known, provably stable ground state, not a find |
| a-family parameterisation (Okamoto–Sakajo–Wunsch) | **CONFIRMED** |
| derivative loss blocks a single-space `ℓ¹_ν` radii-polynomial argument | **CONFIRMED** |
| ℓ¹_ν Banach algebra; finite norm ⇒ analyticity | **CONFIRMED**, half-width is log(ν)/ω |
| Krawczyk interior requirement for uniqueness | **CONFIRMED** |
| dyadic-boundary trap is a real, documented failure mode | **CONFIRMED** (software docs; 127/256 is the precedent) |
| Chen–Hou, Elgindi results as described | **CONFIRMED** |
| "the fix is a two-space derivative-gaining inverse" | **REFUTED** — nobody does this; see (a) and (b) above |
| radii polynomial as we stated it | **REFUTED in part** — A-injectivity was missing |
| van den Berg–Lessard / Gómez-Serrano as radii-polynomial references | **REFUTED** — they do not contain it |
| "CLM blows up for generic smooth data" | **SOFTENED** — the correct statement is the iff |
| golden-ratio bisection as a documented remedy | **NOT FOUND** — works, but 127/256 is the citable one |

Four refutations, one softening, one not-found — against machinery that passed 138 of its own checks. That ratio
is the argument for the fleet: internal tests cannot catch a claim that is wrong about the *literature* rather
than about the arithmetic.

---

# Third check: the landscape survey (2026-08-25)

`research/literature/Computer-Assisted Proofs of Fluid Singularity — Landscape Survey.md` answers "has anyone
built this before?" — yes, comprehensively, by several strong groups using off-the-shelf libraries. Its
De Gregorio findings (the S¹ C^α/smooth split, the sharp transition at `a = 1`) are already recorded above; two
items are new and belong here rather than in a transcript:

**Machine C's pattern: NOT FOUND.** No published example was found of a fluid computer-assisted proof being
independently re-derived by a second implementation using *different arguments*. Formalisation inside a proof
assistant exists, but that mechanises the same argument in a trusted kernel rather than re-deriving it.
**NOT FOUND is a search result, not a proof of novelty**, and this line has been wrong about novelty before.

The survey's recommendation follows from it: do not compete on the mathematics, target **independent
verifiability** — its target T1, which is the piece R4b is already blocked on, and which answers AIM workshop
Problem 3 (a *proof-emitting* eigenvalue enclosure, for a *structured* operator) rather than a wish of our own.

**Unverified, recorded so it is not silently inherited:** a 2026 survey, *Singularity Formation: Synergy in
Theoretical, Numerical and Machine Learning Approaches*, arXiv:2604.16842 — cited to us, not checked.


---

# Fourth check: prior art for the Lehmann line (2026-08-26)

## A REJECTED MATCH, kept as audit history rather than deleted

A prior-art search identified **Beattie & Greenlee, *Convergence theorems for intermediate problems. II* (2002),
Corollary 3.7** as a direct match for "our Corollary 3.7". **It is not a match.**

* **Ours** is Huang–Tong–Wei, arXiv:2209.08232, Corollary 3.7 — a *numeric two-sided bracket* on the profile
  operator's spectrum, `(2/π²)·λ̃_n ≤ λ_n < λ̃_n = 1/(nπ)`.
* **Theirs** states that if `span{s_i}` is a core for the operator, the right-definite Temple–Lehmann method
  produces convergent lower bounds to every eigenvalue below the spectral cutoff.

Same number, unrelated theorems. The match was made on the **label**, not on the load-bearing statement — which is
precisely what `oracle-hunter`'s rule 3 exists to prevent ("quote, don't paraphrase, the load-bearing statement").
It is recorded here rather than deleted because a rejected match is audit history: the next search will hit the
same collision.

Note also that the correction lands on a claim this project never made. `problem_dg_profile.py` has always
labelled the bracket **"theirs, not ours … a published theorem, used here as a citation."**

## CONFIRMED prior art — the lineage `lehmann.py` now cites

**Bazley & Fox, *Truncations in the Method of Intermediate Problems for Lower Bounds to Eigenvalues*, J. Res.
National Bureau of Standards **65B**(2) (1961) 105–111.** Develops procedures for lower bounds of semibounded
self-adjoint operators and explicitly reduces the computation to matrix problems.

So **"truncation in intermediate problems" has been a named subject since 1961**, and none of that framework is
ours. The lineage is Weinstein → Aronszajn → **Bazley–Fox** → Temple–Lehmann → Goerisch → **Beattie–Greenlee**
(the last supplying convergence theory for the abstract methods). Beattie & Greenlee is genuine prior art for the
machinery — just not for Huang–Tong–Wei's Corollary 3.7.

## What this leaves, stated narrowly

**Not** a new eigenvalue-bound theory. Nothing in `lehmann.py` is a new theorem, and the general idea that a
Lehmann truncation can be bounded by a tail estimate is sixty-five years old.

The claim that survives is operator-specific: *for Huang–Tong–Wei's `M`, on `V = {f odd, f ∈ H¹₀([−1,1])}` with
`s_n = χ sin(nπx)`, the `A₂` term reduces to `AᵀB⁻¹A`, and the rigorous tail needed to certify that object
simultaneously supplies the previously separate Galerkin truncation enclosure — removing the Hilbert-transform
route entirely.* No prior publication of that specific reduction was found. **A failure to find, not novelty.**

The proof architecture should be written in that shape: known abstract theorem → prove this `M` and this basis
satisfy its hypotheses → certify the problem-specific matrices and tails → instantiate.

## A wording rule that came out of this, and it is easy to get wrong

There are **two different "published values"** and they are not the same kind of object:

| | what it is |
|---|---|
| `λ̃_n = 1/(nπ)` | an a priori **upper bound** from Corollary 3.7 — *not* an estimate of `λ_n` |
| `0.2896, 0.1509, …` | Appendix-A **estimates** of the eigenvalues, printed to four decimals |

Our certified width of `3.0e-5` on `λ₁` is narrower than the `±5e-5` implied by the printed `0.2896`. That is a
statement about the **precision at which their value is displayed**. It is **not** a claim about `1/π`, and **not**
a claim that their underlying mathematics is accurate only to four decimals. The safe phrasing: *an independent,
substantially tighter certified enclosure of the eigenvalue than the broad a priori bound the published theorem
supplies.*

And the epistemic role of Corollary 3.7 in the certification is worth stating explicitly, because it is unusual:
it is **not** used as the answer. It supplies `λ_{J+1} < 1/((J+1)π)`, which together with our own certified lower
bound on `λ_J` establishes the Lehmann shift hypothesis. A published theorem used as an **input certificate**.

---

# Fifth check: the zbMATH Open novelty search (2026-08-26)

The statement's §8 flagged that a definitive prior-art check "requires MathSciNet or zbMATH, which have not
been consulted." **zbMATH Open has now been consulted** — a structured field search through its public REST API
(`api.zbmath.org`, same query syntax as the site), not a web string search. **MathSciNet has still not been**:
it needs an institutional subscription this machine does not have. The claim's status line must keep saying so.

## What was searched, with hit counts

Queries are zbMATH one-line syntax; an empty result set returns 404 from the API, recorded below as 0.

| axis | query (abridged) | hits | outcome |
|---|---|---|---|
| verified-Lehmann corpus | `Lehmann + eigenvalue + interval arithmetic` | 7 | Behnke, Davies, Liu–Okayama–Oishi, Mayer — all differential operators / matrices |
| Goerisch corpus | `Goerisch + eigenvalue` | 25 | the classical lineage, 1978–2018: plates, sloshing, Steklov, Trefftz, FEM flux reconstruction |
| Behnke corpus | `au:Behnke + eigenvalue` | 13 | matrices, plates, photonic crystals, domain decomposition — no integral operator |
| Lehmann–Maehly by name | `"Lehmann-Maehly"` | 10 | + Bazley–Fox 1964, Barrenechea–Boulton–Boussaïd, Liu 2024 — none nonlocal |
| truncation of intermediate problems | `intermediate problems + truncation + eigenvalue` | 5 | Gould, Poznyak, Beattie–Greenlee, Beattie–Banach — the known lineage |
| De Gregorio corpus | `De Gregorio + blow-up`, `ti: self-similar De Gregorio` | 7 + 2 | all analytic; HTW is Zbl 1529.35388 |
| HTW citation sweep | Semantic Scholar, arXiv:2209.08232 | **8** | exhaustive; all analytic self-similar-blowup papers; none certifies σ(M) |
| the two spectral neighbours | Xu arXiv:2607.19762; Guo–Jiu arXiv:2506.02800 | — | CLM collapse spectrum (exact, analytic, different operator); DG torus stability (analytic) |
| guaranteed bounds, modern FEM | `guaranteed + eigenvalue bounds + compact` | 2 | Carstensen–Ern–Puttkammer, Gallistl — Laplacian-type |
| **the gap itself** | `Lehmann + integral operator + bounds` | **0** | and `eigenvalue enclosure + integral operator` = **0** |

The lone 2-term hit for `Lehmann + integral operator` is a many-body-physics paper using the **Lehmann
representation** of Green's functions — a name collision, same species as the Beattie–Greenlee "Corollary 3.7"
false match above, recorded so the next search does not chase it.

## What the search found, and did not find

**Found — the machinery lineage, again.** Every rigorous Lehmann/Goerisch/Zimmermann–Mertins computation
located operates on a **differential operator** (Laplacian, plates, Maxwell, angular Kerr–Newman Dirac,
Schrödinger–Poisson) through FEM or spline trial spaces, where applying the operator to a trial function is
direct. The nearest machinery neighbour is Boulton–Winklmeier (arXiv:1410.5357): certified sharp enclosures for
a Dirac-type operator — still differential, piecewise-linear trial functions, no invariance collapse.

**Not found — any of the three ingredients of the narrow claim, in any combination:** (i) a Lehmann/inertia
certificate for a **compact nonlocal integral operator** none of whose applications to trial functions is
computed directly; (ii) the **invariance collapse** `M(V) ⊆ V ⇒ A₂ = AᵀB⁻¹A` making the second Lehmann matrix
available from the already-certified first; (iii) a tail bound **doubling** as the Galerkin truncation
enclosure. The zero-hit queries above are the sharpest statement: zbMATH Open indexes no document pairing
Lehmann-method eigenvalue bounds with an integral operator at all.

**Also not found — anyone else computing σ(M).** The eight papers citing HTW, plus the zbMATH De Gregorio
corpus, contain no rigorous (or even numerical-headline) spectral computation of the HTW profile operator. The
two spectral papers in the neighbourhood study different operators by purely analytic means.

## Status after this check

The claim stays exactly where AL-012 and the completion statement left it, with a stronger evidentiary basis:

> **No identified prior art** — now on the basis of a structured zbMATH Open field search and an exhaustive
> citation sweep of HTW, not merely web string searches. **Still not the same as novel.** MathSciNet remains
> unconsulted, and the German-language 1980s Goerisch/Albrecht corpus was enumerated by title and abstract
> only — a general invariance remark could hide in a full text; that is the residual risk, named.

The frozen statement's §8 wording is unchanged, as the freeze requires.

## Addendum (2026-08-27): the battery mirror, and the Fichera correction

Before handing the MathSciNet battery over (`MATHSCINET-SEARCH-BRIEF.md`), its genuinely new concept
intersections — invariant subspace, Schur complement, "spectral enclosure", finite section, two-sided bounds,
kernel-operator synonyms — were mirrored against zbMATH Open. Most returned zero or known material. Three
results matter:

**1. The two zero-hit queries of the fifth check were phrase artifacts, and the correction is the Fichera
school.** `two-sided + eigenvalue bounds + integral operator` surfaced Noschese–Ricci (1999), *On the
eigenvalues of a kernel* — rigorous two-sided bounds for the first five eigenvalues of Ostrowski's integral
operator, refining Fichera–Sneider (1975) — and pulling that thread opened **Fichera's method of orthogonal
invariants**: a classical school (~26 papers on zbMATH; Fichera 1965 *Sul calcolo degli autovalori*, 1982
*Upper and lower bounds to eigenvalues*; Dirschmid 1970 *Zur Einschließung der Eigenwerte vollstetiger
positiver Operatoren*; Fredholm-kernel computations through Leuzzi 1981 and Natalini–Noschese–Ricci 1999) of
**rigorous two-sided eigenvalue bounds for compact positive operators, integral kernels included** — under
Italian and German vocabulary the English phrase searches cannot see. Exactly the failure mode the battery's
synonym section anticipated, caught on the open database first.

**2. Classified on the five-question rule, the claim does not move.** Different operators; **trace-based
invariants**, not an invariance collapse — no `A₂ = AᵀB⁻¹A`, no second Lehmann matrix at all; no tail doubling
as a Galerkin truncation enclosure; no inertia counting; not the combination. But the *category* "rigorous
two-sided bounds for a compact integral operator" is hereby **conceded as classical** alongside the Lehmann
lineage, and any write-up claiming anything about integral operators must cite Fichera. The fifth check's
zero-hit lines must be read as statements about *phrases*, never about the category.

**3. "Spectral enclosure" has a third meaning.** Besides Lehmann-type certified computation, the phrase names
the operator-matrix literature's analytic enclosures (Langer, Trunk, et al. — essential/point spectra of
non-self-adjoint block operator matrices). Recorded beside the "Lehmann representation" and "Corollary 3.7"
collisions.

**Status: unchanged** — "no identified prior art" for the combination, now with the Fichera school named,
classified, and conceded rather than invisible. The MathSciNet task inherits one sharpened instruction: read
*inside* the orthogonal-invariants corpus for an invariance-collapse or tail-duality remark that titles and
abstracts cannot rule out.
