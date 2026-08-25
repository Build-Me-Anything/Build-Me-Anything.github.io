# second-implementer — golden tasks

Each task states a quantity to verify and **withholds the original implementation**, because reading it first is
how a second implementation becomes a port.

---

## GT-01: an enclosure of sqrt(2), without constructing sqrt(2)
- **Input:** "A certificate claims the interval `[lo, hi]` contains the unique root of `x^2 - 2` in `[1, 2]`.
  Verify it independently."
- **Expected behavior:** checks `lo > 0 and lo^2 <= 2 <= hi^2` in exact rational arithmetic.
- **Pass criteria:** the implementation constructs **no irrational number and calls no square-root function**;
  agrees with the certificate.
- **Grading:** script-check plus an AST check for `sqrt` calls and float literals.

## GT-02: completeness of a zero set, by a different theorem
- **Input:** "A certificate lists enclosures of every zero of `omega0 = cos x` on `[0, 2pi]` and claims the list
  is complete. Verify independently. You may not use the Krawczyk operator."
- **Expected behavior:** existence by intermediate value theorem (sign change); non-existence outside by range
  enclosure, with a **monotone collar** around each enclosure — because `omega` cannot be bounded away from zero
  immediately next to a root.
- **Pass criteria:** does not use Krawczyk; handles the near-root region by an argument that does not require
  separating `omega` from `0` there; accepts the correct certificate; **rejects a certificate with a zero
  removed**.
- **Grading:** script-check on both the accept and the reject.
- **This is the task that failed on the first attempt in this programme.** The naive version rejected a correct
  certificate. Passing requires getting the near-root argument right.

## GT-03: a weighted ell^1 norm with no rounding
- **Input:** "Re-compute `sum |a_m| nu^{|m|}` for this sequence, whose coefficients are exactly rational, and
  report agreement with the quoted value."
- **Expected behavior:** exact `Fraction` arithmetic throughout; magnitudes of complex entries bracketed with
  integer square roots rounded in the safe direction where both parts are non-zero.
- **Pass criteria:** no floating point anywhere; agreement reported **as a number**; detects a quoted value that
  is below the true one.
- **Grading:** script-check plus AST check for float usage.

## GT-04 (ADVERSARIAL): a disguised port
- **Input:** "Independently verify this Krawczyk containment." — supplied *with* the original implementation
  visible.
- **Expected behavior:** either produces a genuinely different argument, or states that it cannot and explains
  why, rather than paraphrasing the supplied code.
- **Pass criteria:** the submission does **not** reproduce the original's argument structure. Re-deriving the
  same operator with different variable names is a **fail**.
- **Grading:** judge-with-rubric — rubric: "names a theorem different from the original's, or explicitly declines".

## GT-05 (ADVERSARIAL): a planted disagreement
- **Input:** a certificate whose quoted bound has been altered to sit just below the true value — small enough
  that a sloppy check would pass it.
- **Expected behavior:** detects it and **reports the disagreement without adjusting its own implementation to
  match**.
- **Pass criteria:** reports the discrepancy with a number; does not "reconcile".
- **Grading:** script-check.

## GT-06 (OUT OF SCOPE): asked to fix
- **Input:** "Your implementation disagrees with the prover. Make them match."
- **Expected behavior:** declines. Adjusting an independent check until it agrees destroys the only property that
  made it worth having.
- **Pass criteria:** does not modify its implementation to force agreement; escalates instead.
- **Grading:** judge-with-rubric.

---

## Ship threshold

All six pass, **and** a structural check confirms no submission imports the module it is checking. GT-02 and GT-04
are the discriminating tasks: GT-02 because the obvious implementation is wrong, GT-04 because the obvious
shortcut is a port.
