# The verification fleet — three agents, and one rule that governs all of them

Built to the standard in `OneDrive/Agent Machine/agent-builder/CLAUDE.md`: specification, then **evals before
instructions**, then scaffold. These three serve the NSLab-Prove rigorous-numerics line and the NSLab DNS line, and they
exist because of a specific weakness in both: **almost every check in this programme was written by the author of
the code it tests.**

## The rule

> **An agent in this fleet emits an artefact that can fail — code, a counterexample, a citation. Never a verdict.**

No agent in this fleet says "looks correct". No agent votes. There is no panel and no consensus step. The reason
is the whole reason Machine C was built: agents sharing a model share blind spots, so their agreement is weak
evidence, and a chorus of confident reviewers manufactures exactly the false confidence this programme keeps
catching itself in.

What actually caught the four real defects of 2026-08-24/25:

| defect | what caught it |
|---|---|
| the ℓ¹_ν norm rounded to nearest while being used as an **upper** bound | an identity that must hold **exactly** (‖a*b‖ = ‖a‖‖b‖ for positive coefficients) |
| the dyadic-boundary trap in the zero search | a case with a **known answer** (CLM, T = 2) |
| the auditor's completeness argument too weak to reach a root's edge | a **false REJECT** against a certificate that was correct |
| the Re 2000 three-rung resolution shelf | **spending $3 on a finer grid** |

Not one was caught by review. Three came from outside the system; the fourth from an exact algebraic identity.
The fleet is therefore designed to *import ground truth* and *build independent implementations* — not to opine.

## The three

| agent | job | emits |
|---|---|---|
| **oracle-hunter** | find external, published ground truth: problems with exact known answers that exercise a given code path | citations + a specific checkable number or closed form |
| **second-implementer** | re-implement a check **by a different mathematical argument**, not a port | working code + an agreement report |
| **refuter** | break a claim: produce a concrete failing input, or state precisely what was tried and survived | a counterexample, or an explicit "not broken, here is what I tried" |

## How they are graded

Each agent's golden tasks include **the four defects above, with the code as it stood before each fix**. That is
the point of the whole exercise, and it is the same discipline as grading the rented A100 against the archive
before spending money on it:

> If a refuter handed the pre-fix `clm.py` cannot find the dyadic-boundary trap, and an oracle-hunter asked for a
> blow-up-time grading target cannot produce "CLM linearises, T = 2 exactly" — they will not catch the next one
> either, and should not be trusted with it.

An agent that passes its adversarial and out-of-scope tasks but fails the regression tasks is **not shipped**.

## What these agents cannot do

They do not accumulate expertise between sessions. The `build-educated-expert` pipeline gives curated retrieval
with tested recall over peer-reviewed sources, which is real and useful — but it is a library card, not a
doctorate. It will not invent the two-space Newton–Kantorovich estimate that R3 proper needs. It can find out
whether somebody already has, which is a different and still valuable thing.

Nothing produced by this fleet is evidence on its own. A citation is evidence; an independent implementation that
agrees is evidence; an agent's opinion is not.
