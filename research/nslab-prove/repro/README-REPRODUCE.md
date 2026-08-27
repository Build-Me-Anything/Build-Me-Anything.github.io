# Clean-room reproduction package — the R4b certified spectral enclosure

**What this is.** A self-contained package for reproducing, on your machine, the independent audit of a
computer-assisted result: certified two-sided enclosures of the three leading eigenvalues of a compact
self-adjoint integral operator (the Huang–Tong–Wei De Gregorio profile operator),

    λ₁ ∈ [0.2895674, 0.2895979]   λ₂ ∈ [0.1508500, 0.1509279]   λ₃ ∈ [0.1021951, 0.1028375]

You receive the **certificates** (JSON, exact rational endpoints), the **auditor source** (seven Python
files, standard library only), the **frozen mathematical statement**, and the **audit contracts** the
auditors implement. You do **not** receive the prover — the code that generated the certificates — nor any
of its intermediate data, nor guidance about which implementation decisions matter. That is the point: the
question this package answers is whether a competent third party can reproduce `ACCEPT` **without knowing
how the prover works**, on a different machine.

## How to run it

```bash
python reproduce.py
```

Requirements: **Python 3.9 or later, standard library only.** No packages, no compiler, no network.
Measured under twenty seconds on a 2024 laptop (the rungs share one series cache); allow a few minutes on
older hardware — the arithmetic is exact rationals with ~1000-bit outward-rounded endpoints, deliberately
unoptimised.

The runner first checks every file against `MANIFEST.sha256` and refuses to run a tampered package; then it
verifies no prover module is present or loaded; then it runs the four audits in ladder order and prints one
verdict per rung. Exit code 0 means `ACCEPT` at every rung.

## What is in the box

| path | contents |
|---|---|
| `reproduce.py` | the runner (this package's only new code — everything else ships verbatim from the repository) |
| `auditors/` | Machine C: `auditor_r4b.py` (Rung 1, Gram matrix), `auditor_r4b_a2.py` (Rung 2, `A₂` + tail), `auditor_r4b_lehmann.py` (Rung 3, pencil + inertia), `auditor_r4b_final.py` (Rung 4, assembled enclosures), plus their in-package dependencies `auditor.py`, `auditor_r23.py`, `auditor_r01.py` (π by Machin, exact-rational intervals) |
| `certificates/` | the four audited objects: `certificate-r4b-{gram,a2,lehmann,final}.json` — exact rational endpoints throughout |
| `statement/` | the frozen mathematical claim (tag `r4b-statement-v1`) and the three audit contracts (`R2/R3/R4-AUDIT-CONTRACT.md`; Rung 1 predates the contract discipline and is specified in the statement + auditor docstrings) |
| `MANIFEST.sha256` | SHA-256 of every shipped file; `PROVENANCE.md` pins the source repository commits and tags |

## What a successful run establishes — and what it does not

`ACCEPT` at all four rungs means: an independently implemented certification machine — different
representation (`Cin`, not `Ci`), different arithmetic (exact rationals rounded outward, not interval
floats), different constants (Machin's π), different tail mathematics, different inertia rule — re-derives
every certified object from the certificate's own data and finds every claimed interval consistent with its
own, **on your machine, with no prover present**.

It does **not** establish the underlying theorem. The mathematical proof is the statement document in
`statement/`; the audit ladder is computational evidence that the certificate machinery was implemented
correctly. *Independently audited certificate ≠ independently proved theorem.* And nothing here is a claim
about the Navier–Stokes or De Gregorio equations: the certificates bound the spectrum of one compact
operator, full stop — the statement's §6 lists explicitly what is not claimed, and the chain
`σ(M) → eigenfunction → profile → blow-up` breaks at the first arrow.

## What to report back

Either way, the complete stdout of `reproduce.py` (it includes your Python version and platform), plus
anything you changed to make it run (which should be nothing — if you had to change anything, that is a
finding). **A failed reproduction is a result**, and exactly what this package exists to detect: please do
not debug it into passing — report it as it fell.

Two honest notes for the clean-room reading. First, the auditor files ship **verbatim** from the audited
repository, docstrings included; some docstrings mention, at a conceptual level, how the prover's route
differs (that is what their independence contracts require them to state). No prover code, data, or cache
ships. Second, the auditors were written by the same project that wrote the prover — this package tests
machine-and-environment independence and freedom from hidden runtime dependence, not sociological
independence; that is what external review is for.
