# The CAP machinery — R0, R1, R2

Working code for the rigorous-numerics line described in
[`../Certified Blow-Up — System Architecture.md`](../Certified%20Blow-Up%20—%20System%20Architecture.md). This is
**Machine B**, the Verifier: it takes a candidate and either closes a proof or refuses. It has no tolerance to
tune and no third answer.

```bash
cd research/rigorous/cap
python run-all.py          # all four suites, 67 checks, ~4 minutes
```

Requires `mpmath` only (already present with sympy). Pure Python, arbitrary precision, outward-rounding interval
arithmetic — slow, and deliberately so: at this scale a reader auditing every line is worth more than speed.

## What is here

| file | rung | what it does |
|---|---|---|
| `ivutil.py` | — | interval helpers: endpoints as plain floats, strict containment, intersection, interval matrices |
| `ell1.py` | — | the sequence space ℓ¹_ν: complex-interval Fourier sequences, convolution, Hilbert transform, derivative, **upper-bound** norms |
| `radiipoly.py` | — | the radii polynomial: three bounds in, a theorem or a refusal out |
| `krawczyk.py` | **R0** | the Krawczyk operator — certified existence *and uniqueness* of a zero in a box, plus interval-Newton sharpening |
| `clm.py` | **R1a** | CLM via the closed form: complete zero-set search, certified blow-up time |
| `problem_quadratic.py` | **R1b** | quadratic convolution equation with the exact Catalan solution — the only problem with Z₂ > 0 |
| `problem_clm_fourier.py` | **R1b** | CLM as a fixed point in ℓ¹_ν; certified lower bound on T |
| `problem_degregorio.py` | **R2** | De Gregorio steady state, Galerkin certificate, and where the machinery stops |
| `test_r0/r1/r1b/r2.py` | | 10 / 16 / 21 / 20 checks |

## Status

| rung | target | status |
|---|---|---|
| **R0** | certified root enclosure | **ALL PASS** — √2 enclosed to half-width 3.4e-41 |
| **R1a** | CLM blow-up time, closed form | **ALL PASS** — T = 2 enclosed to width 4.6e-41 |
| **R1b** | radii polynomials in ℓ¹_ν | **ALL PASS** — certified **T ≥ 2**, sharp; enclosure radius within 0.0001 % of the true distance |
| **R2** | De Gregorio steady state | **ALL PASS** for the Galerkin truncation; the PDE statement is blocked, see below |
| R3 | 2D Boussinesq / axisymmetric Euler | out of scope alone |

## What R1b establishes, and why it is the one that matters

R1a uses CLM's closed-form solution — legitimate, but it uses the answer as the method and none of it transfers.
R1b redoes R1 the way R2 and R3 would have to be done, and it is graded twice over:

* On the **quadratic** problem, whose solution is the Catalan sequence exactly, the certified radius is within
  **0.0001 %** of the true distance ‖exact − ā‖. The bound is not merely sound, it is essentially sharp.
* On **CLM**, the tail estimate yields Z₁ = (t/2)·ν, so the contraction closes exactly when t < 2/ν. At ν = 1 that
  certifies **T ≥ 2**, and the exact answer is T = 2 — the threshold coincides with the true radius of
  convergence. Two independent routes (R1a's supremum, R1b's contraction) agree on T.
* With ν > 1 the same certificate states that ω(·,t) is **analytic in a strip of half-width log ν**. The weight is
  a result, not bookkeeping.

**Failure to close for t > 2/ν proves nothing.** Only existence, and hence a lower bound on T, is established.

## Where R2 stops — a structural wall, not a coding problem

The De Gregorio residual of the exact steady state ω = A·sin x is **identically zero** in interval arithmetic, so
the Fourier / Hilbert / derivative / product pipeline is verified end to end against a known answer. The Galerkin
truncation carries a rigorous Krawczyk certificate. But the **PDE** statement does not follow, and more modes will
not fix it:

F contains the transport term u·ω_x, and ‖D a‖_ν = Σ|m||a_m|ν^{|m|} is not bounded by ‖a‖_ν — multiplication by m
is unbounded on ℓ¹_ν for every ν. So F maps a stronger space into a weaker one, losing a derivative, and the
single-space radii-polynomial argument used at R1b does not apply. The fix is a two-space Newton–Kantorovich with
an approximate inverse that *gains* the derivative the transport term loses. That is Layer 4 of the architecture
document — the part no computer supplies — and inventing it here, against no known answer, would produce a
certificate indistinguishable from the sound ones and worth nothing.

R2 therefore reports what it can prove, and locates the wall precisely instead of asserting one exists.

## The three failures worth keeping

Every suite is built so that a large share of its checks demand a **refusal**. That is where the defects turned up.

**1. The dyadic-boundary trap (R1).** Bisecting `[0, 2π]` puts box boundaries at `2π·k/2^d`. The zeros of
`cos x` are at `π/2` and `3π/2` — exactly `2π/4` and `3·2π/4`. A zero on a shared boundary lies on the *endpoint*
of both neighbouring boxes, so `K(X)` can never be strictly inside `X` (uniqueness fails) and the box is never
provably empty either. Bisection cannot escape it at any depth.

The search behaved correctly: it spent its whole budget and then reported that it could **not** prove the zero set
complete, rather than returning the two zeros it had nearly found. Had it returned a partial list, the supremum
would have been silently too small and the blow-up time too large — an error in the dangerous direction, and
invisible afterwards.

What makes this worth recording is *which* case broke. The clean one with the exact answer (`ω₀ = cos x`,
`T = 2`) failed; the untidy one with non-dyadic roots passed. A suite of only realistic-looking cases would have
shipped the bug. Fixed by splitting at the golden-ratio conjugate instead of the midpoint.

**2. Norms were not upper bounds (R1b).** The ℓ¹_ν norm accumulated in ordinary `mpf`, which rounds to nearest —
so a quantity used as an *upper* bound could land a fraction below the truth. Every bound feeding the radii
polynomial must be an upper bound or the certificate is worthless, and nothing downstream would have noticed:
every certificate would still have printed CLOSED. It was caught by `banach_algebra_witness`, because for
all-positive coefficients ‖a*b‖ = ‖a‖‖b‖ holds *exactly* and the two sides disagreed in the last bits. Norms now
accumulate in interval arithmetic and return the upper endpoint.

**3. A singular preconditioner is a failure of the test, not an error.** The first version raised an exception
when the midpoint Jacobian was singular. But a double root and a badly centred box both land there, and the honest
answer to both is INCONCLUSIVE — a statement about the test, never about the function. Raising threw away the only
correct answer available.

## Design rules, inherited from the architecture document

- **`Verdict` is not a boolean.** A verifier usable as a truthy value invites `if verify(...)`, which silently
  treats INCONCLUSIVE as "no zero". It is not the same thing.
- **A bad preconditioner can waste time; it can never produce a false theorem.** Test 7 of the R0 suite feeds a
  deliberately terrible `Y` and requires the enclosure to stay sound. This is the property that lets Machine A be
  fast and unrigorous.
- **Shrinking a box on failure is allowed. Loosening the acceptance condition is not.** The frozen contract.
- **Completeness failures return no answer**, not an answer with a caveat.

## What these certificates do and do not establish

A closed R1 certificate says: *for this initial datum, the CLM equation blows up at a time inside this enclosure*
(R1a), or *the solution exists at this time and is analytic in this strip, so T is at least this large* (R1b). An
R2 certificate says: *the Galerkin truncation has exactly this one solution in this box.*

None of them says anything whatever about Navier–Stokes, or about Euler. CLM and De Gregorio are one-dimensional
models, chosen because they have answers to grade the machinery against — the same role Taylor–Green Re 1600 plays
for the DNS instrument. A certificate about CLM is a certificate about CLM.
