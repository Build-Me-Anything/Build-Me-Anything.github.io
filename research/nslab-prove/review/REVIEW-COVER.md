# Please try to find the first invalid implication.

That is the whole request. Not "please confirm this looks correct" — a confirmation obtained by asking for
one is worth little. You are being asked to **break** the chain below at the earliest point you can, and a
single invalid implication is a complete success for this review, however small it looks.

**The claim under attack.** A computer-assisted result: certified two-sided enclosures of the three leading
eigenvalues of the Huang–Tong–Wei De Gregorio profile operator `M` (Comm. Math. Phys. 402 (2023) 2791–2829,
MR4581109) —

    λ₁ ∈ [0.2895674, 0.2895979]   λ₂ ∈ [0.1508500, 0.1509279]   λ₃ ∈ [0.1021951, 0.1028375]

— lower halves by Courant–Fischer, upper halves by Lehmann–Maehly (Zimmermann–Mertins form) with Sylvester
inertia counting, the second Lehmann matrix obtained through the invariance collapse `M(V) ⊆ V ⇒
A₂ = AᵀB⁻¹A`, and one explicit tail bound serving simultaneously as the Galerkin truncation enclosure.
**This is a claim about the spectrum of one compact operator. It is not a claim about an eigenfunction, a
self-similar profile, or any PDE** — the statement's §6 draws that boundary, and you are invited to attack
the boundary-drawing too.

## Ground rules

- **Anything may be attacked**: the statement's lemmas and theorem, the imported hypotheses and how they are
  used, the audit contracts, the auditors themselves, the interval arithmetic, the certificates' semantics,
  and the reductions between all of them. The one thing not under review is style.
- **The attack map is `PROOF-AUDIT.md`**: every implication is numbered P-01…P-28 with its classification
  and, where the frozen statement glossed a proof, the completed derivation. Reporting "P-14 is invalid
  because …" is the ideal form of a finding. A finding against the *audit itself* ("P-18's completed proof
  is wrong") counts identically.
- **Know what you are attacking**: `PROOF-AUDIT.md` is an **internal** audit — the project's own pass, which
  found no unresolved gaps. That is precisely the claim your review tests.
- **This project rewards refutation.** Its own record contains eighteen audit-log entries of which five are
  genuine self-caught defects (AL-002, AL-004, AL-008, AL-011, AL-018 — two fake findings unmasked, a wrong
  justification over sound code, an emission path that could overstate a bound by an ulp, and two wrong
  citation labels in the frozen statement itself). A refutation from you goes into the same log with the
  same standing. "No finding" is also a result — but say what you attacked and how hard.

## Reading order

1. `statement/…Statement.md` — the frozen claim (tag `r4b-statement-v1`; two known label errata, AL-018:
   read "Corollary 3.7" as HTW's Corollary 3.9, "Theorem 3.5" as their Theorem 3.7).
2. `PROOF-AUDIT.md` — the implication-by-implication map, your primary target list.
3. `AUDIT-LOG.md` — the findings history; `AUDIT-COMPLETION.md` — what "independently audited certificate"
   does and does not claim.
4. `statement/R2/R3/R4-AUDIT-CONTRACT.md` — what the auditors were required to prove independent of.
5. `LITERATURE-CHECK.md` — the novelty position (deliberately narrow, explicitly provisional).

## Running the computational evidence

The nested `repro-package/` is self-contained (Python 3.9+, stdlib only, ~20 s):

    cd repro-package && python reproduce.py                        # ACCEPT at all four rungs, or a finding
    cd repro-package && python reproduce.py --demonstrate-refusal  # every falsified certificate REJECTED

The manifest refuses altered bytes before any mathematics runs. If you must change anything to make it run,
that is itself a finding — report it rather than fixing it.

## Reporting

Findings in any form, but ideally: the P-number (or statement section), the assertion attacked, why it
fails, and a counterexample where one exists. Address them to the project; they will be recorded verbatim in
`AUDIT-LOG.md` with your attribution (or without, if you prefer). The reviewer this cover sheet asks for is
one who would *enjoy* the sentence "the first invalid implication is P-xx".

---

*Nothing in this package claims anything about the Navier–Stokes or De Gregorio equations' regularity or
blow-up. The chain `σ(M) → eigenfunction → profile → blow-up` breaks at the first arrow, and saying so
plainly is part of the claim under review.*
