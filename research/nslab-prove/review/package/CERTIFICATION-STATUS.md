# Certification status — frozen 2026-08-27

**This statement is immutable as of tag `r4b-certification-complete-v1`. It changes only if an external
reviewer, an external reproducer, or the AL-017 historical check finds something — and then by a recorded
event, never a silent edit.**

> Computational certification complete. R1–R4 independently implemented and accepted; clean-room
> reproduction succeeds; deliberate certificate corruption is rejected; independent conventional numerical
> computation finds no contradiction; adversarial hypothesis-removal tests pass. Mathematical validity and
> novelty remain subject to external review and the targeted historical literature check.

## The evidence, one line each

| what | where | outcome |
|---|---|---|
| Frozen mathematical claim | tag `r4b-statement-v1` = `0d7c663` | fixed; label errata in AL-018 |
| Four-rung independent audit | `6262599`, tag `r4b-audit-complete-v1` = `8ccecac` | ACCEPT × 4, contracts frozen first |
| Clean-room reproduction | `repro/package/`, isolated run | ACCEPT × 4, no prover present, ~20 s |
| Refusal demonstration | `reproduce.py --demonstrate-refusal` | all four tampers REJECTED; manifest refuses altered bytes |
| Internal proof audit | `PROOF-AUDIT.md` | no unresolved gaps identified; citations closed at source; **not** "proof verified" |
| Numerical sanity (non-rigorous) | `sanity/REPORT.md` | no numerical counterexample found; Galerkin ladder converges from the correct side |
| Adversarial hypothesis-removal | `cap/test_adversarial.py` | invalid mathematical premise ⟹ REFUSE, row by row |
| Full ladder | `cap/run-all.py` | 10 suites, 446 checks, ALL PASS |
| Open-literature novelty search | `LITERATURE-CHECK.md`, AL-013…016 | closed at `4f390e1`; no identified prior art for the combination |

## The freeze rule

**The certificate machinery is frozen.** No changes to `cap/`, the certificates, the auditors, or the
reproduction package unless one of the three external gates produces a finding:

1. **AL-017** — the targeted MathSciNet/Fichera historical check (`AL-017-HANDOFF.md`);
2. **external reproduction** — a person who wrote neither implementation runs `repro/package/`;
3. **hostile expert review** — the standing question: *find the first invalid implication*
   (`review/` when assembled; `PROOF-AUDIT.md` is the attack map).

The hierarchy that survives the freeze: no prior art ≠ theorem; independent certificate ≠ theorem;
numerical agreement ≠ theorem. If the mathematical review survives, those pieces become mutually
reinforcing evidence around the actual theorem — and not before.

---

*Nothing in this document is a claim about the Navier–Stokes or De Gregorio equations.*
