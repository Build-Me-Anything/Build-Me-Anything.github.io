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
