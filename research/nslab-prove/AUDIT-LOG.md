# Audit log — R4b spectral enclosure

**Purpose.** The mathematical claim is frozen at tag `r4b-statement-v1`. From that point the statement document
does not change under the audit; findings are recorded here instead, so that the claim and the evidence about the
claim have separate provenance chains.

**Why separate.** A document that keeps changing underneath an audit cannot be audited. Anything that would
previously have edited the statement now becomes an entry below, and only a finding that genuinely invalidates the
mathematics may reopen the frozen document — which is itself recorded as an entry.

## Standing rules

- **A finding is recorded whether or not it changes anything.** "No change" is an outcome, not a reason to omit.
- **Do not change the novelty claim while Rungs 2–4 are running**, unless actual prior art is found. A
  computational defect is an audit finding; it is evidence about the implementation, not about novelty.
- **`independently audited certificate` ≠ `independently proved theorem`.** The proof is the statement document.
  A second implementation gives independent computational evidence that the machinery was implemented correctly.

## The four rungs

| rung | object | status |
|---|---|---|
| 1 | Gram matrix `A_{nm}` (Lemma 1′) | **audited** — `auditor_r4b.py` |
| 2 | `A₂ = AᵀB⁻¹A` and its tail (Lemmas 2, 3) | **audited** — `auditor_r4b_a2.py`, contract `R2-AUDIT-CONTRACT.md` |
| 3 | Lehmann pencil and Sylvester inertia counting (§5) | not audited |
| 4 | the final enclosures `λ_j ∈ [L_j, U_j]` | not audited |

Rung 2 must derive its own tail rather than importing the prover's, or the boundary is not independent. Rung 3
must **refuse** where a pivot's sign cannot be certified, rather than converting an undecided sign into a
numerical decision — `uncertainty ⇒ no certificate`, never `uncertainty ⇒ best guess`.

---

## Entries

### AL-001 — the Gram matrix is independently re-derived

| | |
|---|---|
| **Commit** | `d453595` |
| **Rung / test** | 1 — `auditor_r4b.py`; `test_audit.py` §17 |
| **Observation** | The Gram matrix of Lemma 1′ is reproduced from `fractions`/`json`/`math` plus π by Machin, in outward-rounded rational intervals, and every emitted entry overlaps the prover's. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | Independence rests on three separations: representation (`Cin` vs `Ci`), arithmetic (rational endpoints vs interval floats), constant (Machin's π vs `iv.pi`). |
| **Resulting commit** | `d453595` |

### AL-002 — an apparent 25-orders-of-magnitude discrepancy that was not one

| | |
|---|---|
| **Commit** | `d453595` |
| **Rung / test** | 1 — ad-hoc comparison harness, not a suite check |
| **Observation** | The auditor appeared **25 orders of magnitude tighter** than the prover (5.7e-41 against 4.4e-16), which would have implied the prover was leaving precision on the table. It was reported as a finding mid-session. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | **The finding was wrong.** The harness ran at the ambient `iv.dps`; the prover's own emitter runs at `setprec(45)`. Emitted properly the prover's widths are **3.5e-46** against the auditor's **5.7e-41** — the prover sharper, which is the expected ordering for a deliberately outward-rounded independent check. Retained rather than deleted, because the lesson is methodological: **do not promote an apparent numerical difference to a finding until the arithmetic contract producing it has itself been checked.** |
| **Resulting commit** | `d453595` (correction recorded in the commit message) |

### AL-003 — the audit's own boundary, stated

| | |
|---|---|
| **Commit** | `d453595` |
| **Rung / test** | 2, 3, 4 |
| **Observation** | `A₂`, the tail, the Lehmann step and the final enclosures are **not** independently re-derived. The certified intervals of §5 rest on a single implementation. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | Recorded in the statement's status box rather than left to be inferred. The first rung audited was also the one least likely to hide an error; Rungs 2–3 are where a silent defect would actually sit. |
| **Resulting commit** | `d453595` |

### AL-004 — the auditor's own arithmetic contract was wrong, and it looked like a tail failure

| | |
|---|---|
| **Commit** | (this commit) |
| **Rung / test** | 2 — first run of `auditor_r4b_a2.a2_enclosure` |
| **Observation** | The A₂ tail came out as **7e8** where ~1e-5 was expected. The first reading was that the (R2-D) tail bound was wrong. |
| **Changes the theorem?** | **No.** |
| **Changes the certificate?** | **No** — the defect was entirely in the auditor. The prover's certificate was never affected, and no prover output changed. |
| **Resolution** | Two coupled defects in `auditor_r4b`, both mine. (i) `PREC_BITS` was **fixed** at 512. The `Si`/`Cin` series at `x = 2kπ` has terms peaking near `e^x` — about 1e163 at k = 60 — and in `term = term * ratio(k)` the *absolute* rounding error of `ratio` is multiplied by the term's magnitude, so the width grows like `(max term) × 2^{−PREC}`. Fixed absolute rounding fails precisely where the cancellation is largest. (ii) `set_precision_for` cleared the series cache but **not the cached π**, and `pi_interval(120)` yields only ~170 digits regardless of the grid — so π silently became the limiting factor. Fixed: the grid is sized from `x`, π is recomputed with Machin terms scaled to the grid, and `A_entry` now **REFUSES a vacuous enclosure** rather than returning one. |
| **Lesson** | This is AL-002's lesson recurring on the audit side: **an arithmetic contract that has not itself been checked will produce a number that looks like a mathematical finding.** The symptom pointed at the tail mathematics; the cause was two lines of precision management. Contract §4's refusal condition — "sound but vacuous" — now catches it as a refusal instead of a value. |
| **Resulting commit** | (this commit) |

### AL-005 — Rung 2 audited: `A₂` and its tail, by an argument sharing nothing with the prover

| | |
|---|---|
| **Commit** | (this commit) |
| **Rung / test** | 2 — `auditor_r4b_a2.py`; `test_audit.py` §§20–25 |
| **Observation** | The auditor's `A₂` intervals **contain the prover's entirely** at every entry tested, using a tail derivation that shares no step with the prover's. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | The independence is mathematical, not merely organisational. The prover bounds the tail through the *asymptotics of the entries* — `\|Ci(x)\| ≤ 2/x`, then `\|A_km\| ≤ (8m/3πk)(ln(k/m)+D_m)` for `k ≥ 2m`, then three `∫ln^p(x)/x⁴` moments. The auditor uses **none** of it, going instead through HTW's own smoothing estimate: `Σ_k A_ki² = ‖M s_i‖²_{Ḣ²} ≤ ‖s_i‖²_{Ḣ¹} = (iπ)²` (R2-T), then (R2-D) and Cauchy–Schwarz (R2-O). Convergence therefore follows from a **finite analytic bound**, not a decay rate. The auditor's tail falls like `K⁻²` against the prover's `K⁻³` — 20–38× blunter, which is the expected direction. All five contract pillars pass, including the dynamic test in which every prover routine is replaced by a raising stub and the auditor's **complete finding list** is unchanged. |
| **Resulting commit** | (this commit) |

### AL-006 — the contract's majorant example does not apply; instantiated, not changed

| | |
|---|---|
| **Commit** | (this commit) |
| **Rung / test** | 2 — `R2-AUDIT-CONTRACT.md` §3 |
| **Observation** | The frozen contract offers a geometric majorant `M_k ≤ Cq^k` as its example of an analytic convergence proof. **No geometric majorant exists here** — the entries decay algebraically, `A_km ~ ln k / k`. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | Recorded as an **instantiation** of the contract's requirement rather than a change to it: the requirement is an analytically justified majorant, and (R2-T) is one — a finite bound from an imported hypothesis plus Parseval, which discharges convergence more cleanly than a decay estimate would. Logged rather than silently substituted, because quietly swapping the example for a different argument is exactly the drift the freeze exists to prevent. |
| **Resulting commit** | (this commit) |

### AL-007 — the frozen statement's audit row is superseded by this log

| | |
|---|---|
| **Commit** | (this commit) |
| **Rung / test** | — |
| **Observation** | The status box in the statement at `r4b-statement-v1` reads *"Partial … does not yet reach `A₂`"*. That was accurate at the tag and is now out of date. |
| **Changes the theorem?** | No. |
| **Changes the certificate?** | No. |
| **Resolution** | **The frozen document is deliberately not edited.** A snapshot that keeps being corrected is not a snapshot. Audit status is live information and lives here; the statement's row should be read as accurate *as at the tag*. Current status: **Rungs 1 and 2 audited; Rungs 3 and 4 open.** |
| **Resulting commit** | (this commit) |

---

*The mathematical claim under audit is fixed at tag `r4b-statement-v1`. Nothing in this log is a claim about the
Navier–Stokes or De Gregorio equations.*
