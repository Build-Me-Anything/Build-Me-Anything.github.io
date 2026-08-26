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
| 2 | `A₂ = AᵀB⁻¹A` and its tail (Lemmas 2, 3) | not audited |
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

---

*The mathematical claim under audit is fixed at tag `r4b-statement-v1`. Nothing in this log is a claim about the
Navier–Stokes or De Gregorio equations.*
