# Audit Completion Statement — the R4b certified enclosure

**Post-audit status addendum, NSLab-Prove line. Written 2026-08-26.**

This document is the bridge between the frozen mathematical statement and the completed computational audit.
It **modifies nothing**: the statement stays frozen at its tag, the audit log keeps its append-only history,
and everything below is a summary of provenance already in the repository, gathered in one place so it can be
cited without reconstruction.

> ## WHAT THIS DOCUMENT IS — read before anything else
>
> | | |
> |---|---|
> | **It records** | That the frozen certificate has been independently audited end-to-end: four certification layers, each accepted by a second implementation sharing no relevant machinery with the prover. |
> | **It does NOT claim** | An independently proved theorem. The mathematical proof is the frozen statement document, and nothing here strengthens, weakens, or reinterprets it. |
> | **Novelty status** | Unchanged and **open**. The audit is evidence about correctness and implementation integrity; it says nothing about whether the result is new. MathSciNet and zbMATH have still not been consulted. |

---

## 1. The frozen object

| | |
|---|---|
| Statement document | `Certified Spectral Enclosure for the De Gregorio Profile Operator — Statement.md` |
| Frozen at | tag **`r4b-statement-v1`** = commit `0d7c663` |
| The certified table | `λ₁ ∈ [0.2895674, 0.2895979]` · `λ₂ ∈ [0.1508500, 0.1509279]` · `λ₃ ∈ [0.1021951, 0.1028375]` |
| Status boxes in that document | Deliberately stale — accurate *as at the tag* (AL-007). Live audit status is `AUDIT-LOG.md` and this addendum. |

## 2. The commit chain

| event | commit |
|---|---|
| Statement frozen, audit log opened | `0d7c663` (tag `r4b-statement-v1`) |
| **Rung 1** audited — the Gram matrix (`auditor_r4b.py`) | `d453595` |
| **Rung 2** audited — `A₂` + tail (`auditor_r4b_a2.py`, contract `R2-AUDIT-CONTRACT.md`) | `994b946` |
| **Rung 3** contract frozen before implementation | `a716189` |
| **Rung 3** audited — the Lehmann pencil (`auditor_r4b_lehmann.py`) | `e970145` |
| **Rung 4** contract frozen before implementation | `aff2a71` |
| **Rung 4** audited — the assembled enclosures (`auditor_r4b_final.py`) | `6262599` |

**A provenance nuance, stated rather than glossed.** The Rung 2 contract entered the repository in the same
commit as its implementation (`994b946`); its freeze-before-implementation is asserted by the document and the
session record, but git cannot attest the ordering. For Rungs 3 and 4 the freeze is **commit-separated** —
`a716189 → e970145` and `aff2a71 → 6262599` — so the git history itself witnesses that the acceptance criteria
predate the code they judge.

## 3. The verdict

| rung | object | verdict |
|---|---|---|
| 1 | Gram matrix `A_{nm}` (Lemma 1′) | **ACCEPT** |
| 2 | `A₂ = AᵀB⁻¹A` and its tail (Lemmas 2, 3) | **ACCEPT** |
| 3 | Lehmann pencil and inertia counting (§5) | **ACCEPT** |
| 4 | the assembled enclosures `λ_j ∈ [L_j, U_j]` | **ACCEPT** |

**Suite state at completion:** 9 suites, **433 checks, 0 failures** (`cap/run-all.py`, commit `6262599`).
Every rung's suite includes: tamper batteries (every falsified certificate rejected), static dependency audits
(AST-verified zero forbidden imports), dynamic independence tests (every relevant prover routine replaced by a
raising stub; the auditor's complete finding list — bounds, verdict, refusal reasons — bit-identical), refusal
stress (every undecidable or unsupported step refuses rather than returning a number), and ambient-precision
regressions (the AL-002/AL-004 class).

## 4. The independence structure — the substantive claim

The auditors are not alternate transcriptions of the prover's numerics. At each layer the independent route
goes through **different mathematics**, so the two implementations fail in different places:

| layer | prover's route | auditor's route |
|---|---|---|
| entries | `Ci` closed form, mpmath directed-rounding intervals, `iv.pi` | **`Cin` form** (γ and log cancel), exact-rational outward-rounded endpoints, π by Machin |
| `A₂` tail | entry asymptotics: `\|Ci\| ≤ 2/x`, the `\|A_km\|` bound, three `∫ln^p/x⁴` moments; needs `K_sum ≥ 2K` | **HTW's smoothing estimate (H3)** + Parseval: `Σ_k A_ki² ≤ (iπ)²`, then Cauchy–Schwarz; a finite analytic bound, **no `K_sum` hypothesis** |
| inertia | LDLᵀ pivot counting, refusing on an unsignable pivot | **Jacobi's division-free minor rule**, refusing on an unsignable minor; `R ≻ 0` *checked* by Sylvester's criterion |
| assembly | `certified_bracket` + `certified_upper_bounds` | per-`j` **prefix Gershgorin in two readings** (conservative and generous, no tuned slack), the `τ_{J+1−j} ↔ λ_j` pairing recomputed, the **H6 envelope** as an imported sanity bracket |

Twice the independent route came out **sharper** where it was only required to overlap — the Rung 3 τ₁ bracket
(`[−86, −85]` against `[−87.31, −83.67]`, AL-010) and the Rung 4 own `U₃` (`0.10265` against the claimed
`0.10284`, AL-012). Recorded as findings, promoted to nothing: sharpness is not the criterion, and the frozen
table stands. What the asymmetry evidences is that the routes are genuinely different — which is what
independence is for.

## 5. The findings that matter, and what they say about the apparatus

The audit found defects on **both sides of the prover/auditor boundary**, which is evidence about the audit
apparatus itself — an audit that only ever vindicates its own side has not been tested:

| finding | side | defect |
|---|---|---|
| **AL-004** | auditor | fixed `PREC_BITS` + a stale cached π produced an `A₂` tail of 7e8 that mimicked a mathematical failure; the arithmetic contract, not the mathematics, was wrong |
| **AL-008** | prover | the τ-endpoint justification was wrong ("1/τ increasing") while the code stayed sound; certificates now carry the exact rational sup `−ρ − 1/b` |
| **AL-011** | emission | the naive lower-half emission path (round-to-nearest `lo()`/mpf scan) sat **5.4e-45 above** the exact-rational scan of the same data — masked in this instance by ~1e-30 of entry conservatism, an accident of magnitudes, not a guarantee; the certificate carries a wholly exact-rational scan |

Together with AL-002 (a fake 25-order finding from ambient precision), these fix the line's standing rule:
**do not promote a numerical difference to a finding until the arithmetic contract producing it has itself
been checked** — and its dual, do not let a certificate claim what round-to-nearest arithmetic cannot support.

## 6. What "independently audited certificate" means — the precise claim

> The frozen certificate has been independently audited end-to-end by a second certification implementation
> which, across all four certification layers, shares no relevant implementation machinery with the prover,
> and which accepts the complete certificate under independently implemented certified arithmetic and
> fail-closed verification rules.

That is the whole claim. Explicitly:

- **It is not an independently proved theorem.** The mathematical proof is the statement document at
  `r4b-statement-v1`. The completed ladder is independent computational evidence that the certificate
  machinery was implemented correctly — a different and weaker statement, and the one being made.
- **It is not a PDE statement.** The certificate bounds the spectrum of `M`. Nothing here reaches an
  eigenfunction, the functional `c(f)`, a self-similar profile, or any blow-up conclusion — the chain
  `σ(M) → eigenfunction → profile → blow-up` breaks at the first arrow, as the statement's §6 says.
- **It is not a novelty claim.** The narrow candidate claim (the `AᵀB⁻¹A` reduction with its tail doubling as
  the Galerkin truncation enclosure, for this operator and basis) remains at "**no identified prior art**",
  which is not the same as novel. A definitive check requires MathSciNet or zbMATH, which have not been
  consulted; the productive query is recorded in the statement's §8.

## 7. What follows this document

The computational audit is finished. Changes to the certificate machinery from here would be maintenance, not
audit work. The open work is of a different kind:

1. **Provenance:** this addendum, tagged, is the citable summary; the frozen statement and the audit log are
   the record.
2. **Novelty:** the MathSciNet/zbMATH check of §8's query, done as a literature search rather than a string
   match — the Beattie–Greenlee "Corollary 3.7" label collision is the recorded cautionary example.
3. **Any strengthening of the displayed bounds** (for example, adopting an auditor-sharper `U₃`) would be a
   **new statement version under a new tag with explicit provenance** — deliberate, separately recorded, and
   never an in-place edit of the frozen document.

---

*Nothing in this document is a claim about the Navier–Stokes or De Gregorio equations. The certified table
bounds the spectrum of one compact operator, and the audit is evidence about the implementation of that
certification — no more.*
