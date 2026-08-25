# A system that builds and tests theorems

**Scoping document, NSLab rigorous-numerics line (NSLab-Prove).** Written 2026-08-24, ladder updated 2026-08-25.

**Build status.** The ladder of §4 is built through **R4b**: `cd research/nslab-prove/cap && python run-all.py` runs
eight suites and reports ALL PASS (223 checks). R0, R1a, R1b, R3 and R4 carry certificates; R2 carries one for
the Galerkin truncation only; R4b is transcription and ordinary numerics, deliberately not a certificate. Machine C
audits R0–R4 in exact rationals and rejects 44 tampered certificates; it does not reach R4b, which has no
certificate to audit.

Numerical evidence and proof are different categories, and no quantity of the first becomes the second. This
document scopes the only architecture on which a computer contributes to a *proof* about the Navier–Stokes or
Euler equations — the computer-assisted proof (CAP) — states what it can and cannot establish, and sets a
validation ladder whose first rung has a known answer.

Nothing in this document proves anything. It describes a machine that could, and the order in which to build it.

---

## 1. Why the existing instrument cannot be extended into one

NSLab integrates the equations forward from an initial condition on a finite grid for a finite time. Three
properties of that design are fatal to a proof, and none of them is a resource limit:

1. **One initial condition.** The Clay statement quantifies over *all* smooth divergence-free finite-energy data.
   A trajectory says nothing about a class.
2. **Finite time, finite resolution.** A singularity is defined by quantities becoming unbounded. Any fixed grid
   misrepresents the flow *most severely* exactly where the interesting behaviour is, so trustworthiness falls as
   the target approaches. NS-004 measured this directly: at Re 1000 the 192³ and 224³ rungs agreed with each other
   to 4.4 % and were both about 20 % wrong.
3. **Approximation, not enclosure.** Every floating-point operation discards information silently. A proof needs
   arithmetic that never claims more than it can guarantee.

The historical warning is this programme's own initial condition. Kerr proposed antiparallel vortex tubes as an
Euler blow-up candidate on numerical evidence in 1993; Hou and Li recomputed at higher resolution and the growth
did not survive. The tubes case has already destroyed one singularity claim by refinement, and NS-004 reproduced
the same failure mode in miniature. Any programme using this initial condition should assume it will try again.

## 2. The move that makes rigour possible

**Do not integrate toward the singularity. Look for a fixed point instead.**

Under dynamic rescaling, write

    u(x, t) = (T − t)^(−α) U(y),    y = x / (T − t)^β

and the question "does this solution blow up at T?" becomes "does a steady profile `U` of the rescaled equation
exist, and is it stable?". That converts a statement about a *limit* — which no finite computation can reach —
into a statement about the *existence of an object*, which a contraction-mapping argument can settle. Every
computer-assisted blow-up proof in the literature turns on this reformulation.

## 3. The five layers

### Layer 1 — Search (fast, unrigorous, disposable)

Find an approximate profile `Ū` to high accuracy by ordinary spectral numerics. The existing CuPy/GPU stack does
this. Nothing here is part of the proof; it only has to be close enough that Layer 3 can close. A bad `Ū` costs
compute, never correctness — the certificate simply fails to close.

### Layer 2 — Certified arithmetic

Every quantity becomes an enclosure `[lo, hi]` with directed rounding, so a computed result is a bracket that
provably contains the true value. Ball arithmetic (midpoint ± radius) is the practical form.

- **Arb / FLINT** (C, via `python-flint`) — arbitrary-precision ball arithmetic, certified linear algebra.
- **Julia**: `IntervalArithmetic.jl`. Best-supported ecosystem for this kind of work.

This is a research-layer dependency, which the working agreement allows. It never touches the single-file
deliverable.

### Layer 3 — The proof engine: radii polynomials

The standard machinery. Given `Ū` and an approximate inverse `A` of the linearisation `DF(Ū)`, define the Newton
operator `T(u) = u − A·F(u)` and bound:

| bound | meaning |
|---|---|
| `Y₀ ≥ ‖A·F(Ū)‖` | how badly the approximate profile fails to solve the equation |
| `Z₀, Z₁` | how far `A` is from a true inverse; the linear operator's behaviour on the ball |
| `Z₂` | the nonlinear remainder's Lipschitz constant on the ball |

If the radii polynomial `p(r) = Z₂r² − (1 − Z₀ − Z₁)r + Y₀` has a positive root `r`, then `T` is a contraction on
the ball of radius `r` about `Ū`, so a **true** solution exists within `r` of the computed one. That is a theorem,
and `r` is its error bar. `RadiiPolynomial.jl` implements this pattern.

### Layer 4 — Tail control (the part no computer supplies)

The computation carries finitely many spectral modes. The infinitely many discarded ones must be bounded
**analytically** — typically by an analyticity argument giving exponential decay of coefficients, with an
explicitly certified constant. This is mathematician work. It is also where a CAP most often fails, and it cannot
be automated away.

**R4 changed what this layer costs.** For a *profile* equation posed as a compact-operator eigenproblem, the tail
bound is supplied by compactness itself: writing `τ(n) := ‖T e_n‖_ν / ν^{|n|}`, the tail contribution to `Z₁` is
`(‖A_fin‖ + 1/|λ̄|)·sup_{|n|>N} τ(n)`, and `τ(n) → 0` *is* compactness. The discriminating test is in the R4
suite: a merely **bounded** operator, identical in every other respect, gives a `τ` that does not decay, the
supremum does not shrink with `N`, and nothing closes. So the layer is not eliminated — it is discharged by a
property of the operator rather than by a bespoke estimate, which is exactly why the reformulation is worth
making.

### Layer 5 — Audit

The certificate is a finite list of inequalities. It should be re-checkable by a third party without rerunning the
search, and ideally re-verified in a proof assistant — Lean 4, or Coq with `CoqInterval`'s verified interval
arithmetic. Archive each certificate with the code version, the enclosure radii, and an explicit statement of what
it does and does not establish, exactly as `research/nslab/README.md` archives runs.

## 3b. Three machines, and the contract between them

The four layers above split naturally into separate machines with separate obligations. Keeping them separate is
not tidiness; it is the thing that makes aggressive search safe.

| | machine | arithmetic | obligation | output |
|---|---|---|---|---|
| **A** | **Conjecture Engine** | ordinary float, GPU | find a candidate worth testing | a candidate package |
| **B** | **Verifier** | certified ball arithmetic | close the contraction, or refuse | a certificate, or a failure with reasons |
| **C** | **Auditor** | independent implementation | re-check B's inequalities | agreement, or a discrepancy |

**Machine C is built** — four modules now (`auditor.py`, `auditor_r23.py`, `auditor_r01.py`, `auditor_r4.py`),
covering R0 through R4. Each imports `fractions`, `json` and `math` — and nothing else; a structural test asserts
that they share no module with the prover. They re-derive every bound from the problem definition and ā alone in
**exact rational arithmetic**, so they cannot have a rounding bug, and each uses a *different argument* from the
prover's: IVT and range enclosure where the prover uses Krawczyk, its own preconditioner at R2, series with proved
remainders for π/sin/cos, and at R4 a closed-form residual with no matrix formed and nothing inverted. They accept
the real certificates, reject all **44** tampered variants, and agree with the prover's interval arithmetic on Y₀
to 6.4e-23.

That agreement between implementations sharing no code is worth more than any number of further tests written by
the author of the first one — and it stopped being a theoretical argument the day the R4 auditor was first run.
It rejected a genuine certificate over a relative 1.7e-17, which turned out to be a perturbation constant written
as a decimal string that was 2⁻²⁶ truncated at 17 digits: the prover and the certificate denoted different
numbers. No suite sharing the prover's implementation could have seen it, because both sides of such a suite read
the same wrong constant.

**A** searches for the profile *and* for the certificate's parameters — truncation order, norm and weight,
working precision, the approximate inverse, the proposed radius. It makes no claims. **B** takes the package and
returns a binary verdict. **C** exists because B is software, and software is wrong; the certificate is a finite
list of inequalities, so a second implementation — ideally a proof assistant — can re-check it without rerunning
the search.

### The frozen contract

**B's acceptance condition is fixed mathematics — the radii polynomial has a positive root — and A may vary only
the inputs. A must never be able to weaken the test it is judged by.**

This is the pre-registration rule from NS-005 moved up one level: you may improve the experiment, you may not move
the threshold. If a failing search can widen B's tolerance, the pair stops being a proof system and becomes an
elaborate way of agreeing with yourself.

### The feedback that *is* allowed

When B fails it must say **which bound was too large**, because each points somewhere different:

| bound too large | what it means | what A should change |
|---|---|---|
| `Y₀` (residual) | the profile does not solve the equation well enough | more modes, tighter Newton solve |
| `Z₀`, `Z₁` (operator) | the approximate inverse or the norm is poorly chosen | different weight `ν`, better preconditioner |
| `Z₂` (nonlinear) | the ball is too large for the nonlinearity | smaller `r`, or a sharper `Y₀` to permit one |

Diagnostic information flowing back changes the *experiment*. It does not touch the verdict. That distinction is
the whole safety property.

### Why this earns the right to search hard

In the DNS half of this programme, search volume is a hazard: try enough grids and some pair will look converged,
which is exactly what Re 1000 did at 192³ and 224³. Pre-registration exists to contain that.

A verifier inverts it. A closed contraction is a proof, not a statistic — there is no multiple-comparisons
problem, no look-elsewhere effect, and no threshold that a million attempts can erode. **A may therefore throw
unlimited candidates at B, and the only cost is electricity.** This is the strongest single argument for the
architecture, and it is the exact opposite of the discipline the DNS line requires.

The one thing that breaks it is **B being wrong**, which is why C exists and why the ladder below starts at a
problem with a closed-form answer. B is graded before it is trusted, exactly as the rented A100 was graded against
the archive before any money was spent on it.

### The interface, written down

**Implemented** in `cap/certificate.py`, with one design rule learned in the
building: every number the auditor needs is carried as an **exact rational**, never a decimal rendering of a
floating-point value. Otherwise prover and auditor disagree in the last bits for reasons of formatting, and a
real discrepancy becomes indistinguishable from a rounding artefact. For the same reason the certified problems
use parameters exactly representable in both binary and rational form (mu = 1/8, nu = 3/2, q = 1/2).

A frozen contract has to be a file, not an intention. Both artefacts are archived and hashed, in the same idiom as
`final.json`.

`candidate.json` — **A → B**

```
problem:        equation, ansatz (self-similar exponents), parameters
discretisation: basis, number of modes, working precision in bits
profile:        coefficients of the approximate solution, plus a hash
operator:       the approximate inverse A, and the norm (type and weight)
proposed:       the radius r to attempt
```

`certificate.json` — **B → archive, and → C**

```
verdict:        CLOSED | FAILED
bounds:         Y0, Z0, Z1, Z2 as enclosures, not floats
polynomial:     the radii polynomial's coefficients and its roots
interval:       [r_min, r_max] over which the contraction holds
arithmetic:     library, version, precision — the instrument, recorded
candidate_hash: what exactly was verified
statement:      the theorem, in prose, including what it is NOT about
```

That last field is not decoration. A certificate about Constantin–Lax–Majda is a certificate about
Constantin–Lax–Majda, and the file should say so in words a reader cannot skip.

## 4. The validation ladder

Same discipline as every other line in this programme: start where the answer is already known, and grade the
instrument before trusting it.

| rung | target | why this one | status |
|---|---|---|---|
| **R0** | certified enclosure of a polynomial root | learn the arithmetic; confirm the toolchain is rigorous end to end | **built** — √2 to half-width 3.4e-41; refuses two-root and degenerate boxes |
| **R1a** | **finite-time blow-up for Constantin–Lax–Majda** (`ω_t = ω·H(ω)`) via the closed form | **has a closed-form blow-up solution** — the Taylor–Green Re 1600 of this world. If the machinery cannot recover the exact blow-up time inside its own certified bracket, it is wrong | **built** — `T = 2` to width 4.6e-41 |
| **R1b** | the same result by radii polynomials in `ℓ¹_ν` | R1a uses the answer as the method and none of it transfers; this is the route that does | **built** — certified `T ≥ 2`, sharp; radius within 0.0001 % of truth on the Catalan problem |
| **R2** | De Gregorio steady state | genuinely hard, results exist in the literature to check against | **Galerkin certificate only** — the PDE statement is not claimed; domain-dependence stated |
| **R3** | preconditioning as the cure for derivative loss | the textbook route out of R2's obstruction | **built and graded — and it is the wrong door**, see below |
| **R4** | certified eigenpairs of a compact operator | the route the literature actually uses for profile equations; single-space, no derivative-gaining inverse | **built** — certified against exactly known eigenpairs, and a merely *bounded* operator fails the same test |
| **R4b** | the De Gregorio self-similar profile operator (Huang–Tong–Wei) | the first real instantiation of R4 | **transcribed, not certified** — reproduces the six published eigenvalues by ordinary quadrature |
| **R5** | 2D Boussinesq / axisymmetric Euler with boundary | the actual research frontier; Chen and Hou's territory | out of scope alone, and §R3 of `cap/README.md` now says *why* with a number |

**R3 was the build, and it failed upward.** It closes on the problem it was aimed at, and the literature check
(`LITERATURE-CHECK.md`) then established that no published proof in this family takes that route at all. R4 is the
correction: reformulate the profile equation so the derivative loss disappears, rather than invert it away. That
is why the ladder gained a rung after the rung that worked.

**R4b is the live edge.** Certifying `λf = M(f)` needs exactly two things — rigorous enclosures of the matrix
entries `A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}`, which are improper integrals, and a proven bound on their tail. The
machinery that consumes both is built and graded at R4. Naming the missing piece is worth more than pretending it
is done.

## 5. What a finished certificate would and would not mean

**Would:** that a true solution of *the rescaled model equation* exists within a proven radius of the computed
profile, and — with the stability estimate — that the corresponding solution blows up in finite time.

**Would not:** anything about Navier–Stokes, unless the reduction from Navier–Stokes to that model is itself
proved. The system tests theorems; it does not invent them.

This distinction must survive into every document, exactly as "numerical evidence, never proof" does now. A
certificate about CLM is a certificate about CLM.

## 6. Honest assessment

Chen and Hou's computer-assisted proof of finite-time blow-up for 3D Euler with boundary rests on years of
analysis by specialists, and on 1D model results proved first. R5 is not reachable solo, and saying otherwise
would be the same error this programme spent NS-004 learning to avoid.

R0 and R1 were reachable and are now built, and they gave this programme something it did not previously have: an
output that is true rather than well-measured. What the ladder has since learned is less comfortable and worth
more. The rung that *worked* (R3) turned out to answer a question nobody in the literature asks, and only an
external check caught it — the machinery was sound and pointed at the wrong door. Certificates are not
self-validating about their own relevance: soundness is checkable by machine, and choosing the right theorem is
not.

The Clay problem still needs a mathematician. This is the machine that would check their work — and the only
route on which a computer participates in a proof at all.

---

*Numerical evidence only. Nothing in the NSLab programme, including anything described here, proves regularity or
blow-up of the Navier–Stokes equations.*
