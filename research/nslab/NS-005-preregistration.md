# NS-005 — what the Re 2000 float64 rungs will be allowed to conclude

Written **before** the numbers arrived, at 2026-08-24 20:08, while `tubes-Re2000-N288-gpu` was at t = 14.5 of 16
and `tubes-Re2000-N320-gpu` had not started. The point of writing it first is that the criteria cannot then be
adjusted in response to the result. Timestamps in the run logs and the git history of this file establish the
order.

## The runs

Two rungs of the Re 2000 antiparallel-tube case in **float64**, on a rented A100 80GB, same case as the archive
(`--ic tubes --Re 2000 --tEnd 16 --cfl 0.4`): **288³** and **320³**. They join the existing float64 rungs at 96³,
192³ and 256³. The card was graded against the archived 256³ run before either started: E, Z, ε and max|ω| agreed
to 6×10⁻¹⁶ over 363 steps.

Their only job is to remove **precision** as an explanation for the flattening seen in the float32 ladder
(115.9 → 132.2 → 132.7 at 256³/288³/320³). Nothing else.

## The criteria, as they already stand

Applied unchanged, not re-derived:

- **Primary** — interpolated peak max|ω|, relative change at the last rung < 2 %.
- **Structural companion** — peak-time displacement |Δt_peak| ≤ 0.3 between the last two rungs. Empirical, and
  specific to this study: calibrated on Re 1000 reading 0.44 against ≤ 0.15 for every other tested case. It is
  not a universal CFD threshold and must not be quoted as one.
- Grid maximum, full peak history, L1 history difference, spectral and health measures, energetics and the local
  integrated quantities remain **diagnostics**. They explain a failure; they do not vote on the verdict.

## What each outcome will be allowed to mean

**If both criteria pass** (fp64 ladder flattens where the fp32 one did):

> The Re 2000 flattening is reproduced in double precision. Precision is eliminated as its cause.

That is the whole claim. It is **not** a demonstration that the Re 2000 pointwise maximum has converged, and the
Re 1000 precedent is the reason: there, 192³ and 224³ agreed with each other to 4.4 % and were **both ~20 % too
high**, which only became visible at 256³. Two agreeing rungs are a plateau, not an asymptote. A pass here leaves
Re 2000 in exactly the configuration Re 1000 was in before it broke — a two-rung plateau — and so still requires a
**384³** rung before anything stronger is said.

**If either criterion fails:** the float32 flattening does not survive double precision, the fp32 exploration
ladder is not a reliable guide to the fp64 one, and NS-003b's "first observed convergence of a pointwise maximum"
is withdrawn outright rather than qualified.

**If they disagree** (scalar passes, peak-time fails, or the reverse): report both, conclude nothing, and treat it
as the same class of event as Re 1000 — a case that exposes a criterion, not a case that answers a question.

## What is not permitted

- Introducing a new metric because the existing two gave an awkward answer.
- Moving the 2 % or the 0.3 after seeing the numbers.
- Promoting a diagnostic to a criterion to break a tie.
- Describing a two-rung plateau as convergence, in any document, at any grade.

## Cost, measured rather than estimated

On this A100 the 288³ float64 run measured 187 ms/step and 8.40 GB, ~0.19 h. Scaling by N³ per step and N steps:
**384³ ≈ 0.6 h (~$1)** and **512³ ≈ 1.9 h (~$3)**. The `cloud/README.md` table was built from a bandwidth ratio
and is roughly 2× pessimistic; it should be corrected to these measured figures. The 384³ rung the paragraph above
demands therefore costs about a pound.
