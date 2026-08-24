# A system that builds and tests theorems

**Scoping document, NSLab rigorous-numerics line (NS-R).** Written 2026-08-24.

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

## 3. The four layers

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

### Layer 5 — Audit

The certificate is a finite list of inequalities. It should be re-checkable by a third party without rerunning the
search, and ideally re-verified in a proof assistant — Lean 4, or Coq with `CoqInterval`'s verified interval
arithmetic. Archive each certificate with the code version, the enclosure radii, and an explicit statement of what
it does and does not establish, exactly as `research/nslab/README.md` archives runs.

## 4. The validation ladder

Same discipline as every other line in this programme: start where the answer is already known, and grade the
instrument before trusting it.

| rung | target | why this one | status |
|---|---|---|---|
| **R0** | certified enclosure of a polynomial root and a simple ODE flow | learn the arithmetic; confirm the toolchain is rigorous end to end | not started |
| **R1** | **finite-time blow-up for Constantin–Lax–Majda** (`ω_t = ω·H(ω)`) | **has a closed-form blow-up solution** — the Taylor–Green Re 1600 of this world. If the machinery cannot recover the exact blow-up time inside its own certified bracket, it is wrong, and we learn that in weeks | not started |
| **R2** | De Gregorio on the circle | genuinely hard, results exist in the literature to check against | not started |
| **R3** | 2D Boussinesq / axisymmetric Euler with boundary | the actual research frontier; Chen and Hou's territory | out of scope alone |

**R1 is the build.** It is scoped, it has a known answer, and it exercises all four layers.

## 5. What a finished certificate would and would not mean

**Would:** that a true solution of *the rescaled model equation* exists within a proven radius of the computed
profile, and — with the stability estimate — that the corresponding solution blows up in finite time.

**Would not:** anything about Navier–Stokes, unless the reduction from Navier–Stokes to that model is itself
proved. The system tests theorems; it does not invent them.

This distinction must survive into every document, exactly as "numerical evidence, never proof" does now. A
certificate about CLM is a certificate about CLM.

## 6. Honest assessment

Chen and Hou's computer-assisted proof of finite-time blow-up for 3D Euler with boundary rests on years of
analysis by specialists, and on 1D model results proved first. R3 is not reachable solo, and saying otherwise
would be the same error this programme spent NS-004 learning to avoid.

R0 and R1 are reachable, are worth building, and would give this programme something it does not currently have:
an output that is true rather than well-measured. The Clay problem still needs a mathematician. This is the
machine that would check their work — and the only route on which a computer participates in a proof at all.

---

*Numerical evidence only. Nothing in the NSLab programme, including anything described here, proves regularity or
blow-up of the Navier–Stokes equations.*
