# Post-audit roadmap — from audited certificate to defensible theorem

**NSLab-Prove line, written 2026-08-27 (Michael's staging, recorded verbatim in substance).** The computational
audit is complete and the open-literature search is closed. This document fixes what comes next and in what
order, so that no stage is skipped because a later one is more attractive. **The key point, stated first:**
after AL-017 the project does *not* start writing the paper. The most valuable next milestone is
**proof audit + third-party reproduction** — the audit so far establishes that the computer is not quietly
cheating; the more fundamental question is whether **the mathematics being certified actually implies the
theorem being claimed.**

```
NOW ─► 1 AL-017 targeted MathSciNet/Fichera check
           ├─ prior art found ────────► revise novelty claim (recorded reopening)
           └─ no combination found ─► 2 COMPLETE AUDIT RELEASE
                                      3 THIRD-PARTY REPRODUCTION
                                      4 MATHEMATICAL PROOF AUDIT
                                      5 ATTACK THE REDUCTION ITSELF
                                      6 NUMERICAL SANITY LAYER
                                      7 ADVERSARIAL THEOREM TESTS
                                      8 INDEPENDENT EXPERT REVIEW
                                      9 PUBLICATION PACKAGE
                                     10 FORMAL THEOREM CLAIM
```

## 1. Close the novelty investigation — AL-017

The researcher answers only Q1 (equivalent invariance collapse in the historical literature?) and Q2 (a tail
construction that simultaneously certifies the truncation and the enclosure?) — `AL-017-HANDOFF.md`. If both
are negative, record *"AL-017 — targeted historical literature check complete"*. **Do not turn that into
"novelty proven."** The conclusion remains: no identified prior art for the specific claimed combination.

## 2. Freeze the complete audit artefact

A formal **release** at `r4b-audit-complete-v1`-level: statement tag, the four contract→auditor chains, the
final certificate, and the 433-check ladder as one immutable artefact. From that point the working tree stops
being the reference — no more casually touching anything the release contains.

## 3. Third-party reproducibility — the biggest logical step after the audit

So far: prover ≠ auditor. Next: **can a competent third party reproduce ACCEPT without knowing how the prover
works?** They receive *only* the frozen statement, the mathematical definitions, the certificate, the R1–R4
auditor source, dependencies, and build instructions — on a different machine. The strong form is
**clean-room**: no prover source, no prover intermediates, no cached data, no development environment, no
explanation of which implementation decisions matter. They attempt to reproduce `ACCEPT`. That is a
qualitatively stronger demonstration of independence than anything the internal ladder can provide.

## 4. Mathematical proof audit — `PROOF-AUDIT.md`

Deliberately separate the two questions that have run alongside each other. *Computational*: does the
implementation correctly certify the stated inequalities? (R1–R4 answers this.) *Mathematical*: **are the
inequalities and reductions used by the certificate actually sufficient to establish the theorem?** A
line-by-line audit classifying **every implication** as one of:

    proved analytically · definition · standard theorem · computer-certified ·
    depends on previous lemma · requires external citation · gap / unresolved

This is probably the most important remaining scientific step.

## 5. Attack the mathematical reduction itself

The most dangerous remaining possibility is not an interval-arithmetic bug — it is **a correctly implemented
certificate proving the wrong mathematical implication.** Four specific attacks:

- **(A) Invariance.** Verify `M(V) ⊆ V` follows from the stated operator and basis — **symbolically, not
  numerically.**
- **(B) The matrix identity.** Re-derive `A₂ = AᵀB⁻¹A` independently: dimensions, basis ordering, inner
  products, normalisation, transpose/conjugation conventions.
- **(C) Tail equivalence** — severest scrutiny, because it is the unusual step: verify the R2 estimate bounds
  the *operator quantity the finite spectral problem requires*, not merely individual coefficients.
- **(D) Lehmann applicability.** Every hypothesis before the Lehmann/inertia machinery applies: positivity,
  coercivity, domains, ordering, and the exact pencil-to-spectrum relationship.

## 6. Independent numerical sanity layer

Deliberately non-rigorous: conventional high-precision numerics as an **attack instrument** — `λ_j^numerical`
must sit comfortably inside `[L_j, U_j]`. If a conventional solver lands outside the certificate, **stop**.
The numerics are never allowed to enlarge or repair the certificate.

## 7. Stress the theorem, not just the software

The 433 checks attack implementation integrity; the next suite attacks the mathematical assumptions: perturbed
basis normalisation, perturbed quadrature/order parameters, varied truncation `K` and precision, deliberate
approach to hypothesis boundaries, sign-indefinite cases, nearly singular `B`, deliberately invalid
certificates, and removal of individual assumptions. Target property: **invalid mathematical premise ⟹
REFUSE.**

## 8. Independent expert review

Only after 3–7. Send the package to genuine expertise in spectral theory, compact/nonlocal operators,
Lehmann–Maehly–Goerisch, and rigorous numerics — and do not ask *"can you confirm our theorem?"* Ask:
**"find the first invalid implication."** Give them permission to destroy it. If they cannot, that is far
stronger evidence than a confirmation obtained by asking for one.

## 9. Publication package — three documents, deliberately separate

**Paper** (the mathematical argument) · **computational supplement** (certificate machinery, reproducibility)
· **audit report** (verification architecture, R1–R4, defects found, refusals, provenance). The audit is
evidence about the proof *machinery*; it must not overwhelm the mathematical paper.

## 10. Only then: the formal theorem claim

    mathematical theorem
      └─ supported by: certified computational certificate
           └─ independently checked by: R1–R4 auditor
                └─ independently reproducible by: third party

That is the point where "independently audited certificate" carries real weight — and the point where the
wording may move from *"rigorous spectral-enclosure construction"* to the precise theorem statement the
mathematics actually supports. Not before.

---

*Nothing in this roadmap is a claim about the Navier–Stokes or De Gregorio equations, and nothing in it
changes the frozen statement at `r4b-statement-v1`.*
