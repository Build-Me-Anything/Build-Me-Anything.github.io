# The CAP machinery — R0 and R1

Working code for the rigorous-numerics line described in
[`../Certified Blow-Up — System Architecture.md`](../Certified%20Blow-Up%20—%20System%20Architecture.md). This is
**Machine B**, the Verifier: it takes a candidate and either closes a proof or refuses. It has no tolerance to
tune and no third answer.

```bash
cd research/rigorous/cap
python run-all.py          # both suites, ~1 minute
```

Requires `mpmath` only (already present with sympy). Pure Python, arbitrary precision, outward-rounding interval
arithmetic — slow, and deliberately so: at this scale a reader auditing every line is worth more than speed.

## What is here

| file | rung | what it does |
|---|---|---|
| `ivutil.py` | — | interval helpers: endpoints as plain floats, strict containment, intersection, interval matrices |
| `krawczyk.py` | **R0** | the Krawczyk operator — certified existence *and uniqueness* of a zero in a box, plus interval-Newton sharpening |
| `clm.py` | **R1** | Constantin–Lax–Majda: Hilbert transform, closed-form solution, complete zero-set search, certified blow-up time |
| `test_r0.py` | R0 | 10 checks |
| `test_r1.py` | R1 | 16 checks |

## Status

| rung | target | status |
|---|---|---|
| **R0** | certified root enclosure | **ALL PASS** — √2 enclosed to half-width 3.4e-41 |
| **R1** | CLM certified blow-up time | **ALL PASS** — T = 2 enclosed to width 4.6e-41 |
| R2 | De Gregorio | not started — needs radii polynomials in a sequence space, a real step up |
| R3 | 2D Boussinesq / axisymmetric Euler | out of scope alone |

## The two failures worth keeping

Both suites are built so that roughly half the checks demand a **refusal**. That is where the defects turned up.

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

**2. A singular preconditioner is a failure of the test, not an error.** The first version raised an exception
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

## What R1 does and does not establish

A closed R1 certificate says: *for this initial datum, the CLM equation's solution blows up at a time inside this
enclosure.* It says nothing whatever about Navier–Stokes, or about Euler. CLM is a one-dimensional model chosen
because it linearises exactly and therefore has an answer to grade the machinery against — the same role
Taylor–Green Re 1600 plays for the DNS instrument.
