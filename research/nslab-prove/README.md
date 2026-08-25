# NSLab-Prove — the certificate line

NSLab produces **evidence**. This line produces **certificates**. That is a difference in kind, not in rigour:
a DNS run is a measurement with error bars that shrink if you spend more, and a closed certificate is a finite
list of inequalities that is either true or refused. No quantity of the first becomes the second.

```bash
cd research/nslab-prove/cap && python run-all.py     # 8 suites, 243 checks, ~4.5 min, mpmath only
```

It prints `CAP SUITES: ALL PASS (8 suites)` or it fails loudly. There is no third answer and no tolerance to tune.

## Read in this order

| | |
|---|---|
| [`LITERATURE-CHECK.md`](LITERATURE-CHECK.md) | **Start here.** Four claims of mine that the agent fleet refuted, and what each correction changed. Reading the code first means reading the corrections without knowing they were corrections. |
| [`Certified Blow-Up — System Architecture.md`](Certified%20Blow-Up%20—%20System%20Architecture.md) | Why a CAP is the only architecture on which a computer contributes to a proof here; the five layers; the three machines and the **frozen contract** between them. |
| [`cap/README.md`](cap/README.md) | The working code, rung by rung, with the numbers each one is graded against and the four failures worth keeping. |
| [`agents/README.md`](agents/README.md) | The verification fleet: three agents that emit artefacts, never verdicts. |

## The ladder

| rung | status |
|---|---|
| **R0** Krawczyk root enclosure | certificate — √2 to half-width 3.4e-41 |
| **R1a** CLM from the closed form | certificate — `T = 2` to width 4.6e-41 |
| **R1b** radii polynomials in `ℓ¹_ν` | certificate — `T ≥ 2`, sharp; radius within 0.0001 % of truth on the Catalan problem |
| **R2** De Gregorio steady state | certificate **for the Galerkin truncation only**; the PDE statement is not claimed |
| **R3** preconditioning cure for derivative loss | certificate — and **the wrong door**, see the literature check |
| **R4** compact-operator eigenpairs | certificate — the route the literature actually uses |
| **R4b** the De Gregorio profile operator | **not a certificate** — but entries are closed forms in Si and Ci, and `sici.py` encloses those rigorously; only the Galerkin truncation bound is missing |
| **R5** 2D Boussinesq / axisymmetric Euler | out of reach alone, and `cap/README.md` §R3 says *why* with a number |
| **Machine C** the auditor | audits R0/R1a/R1b/R2/R3/**R4** in exact rationals — 44 tampered certificates rejected; **not R4b**, which is not a certificate to audit |

## What is proved, and what is not

A certificate here says something about **CLM**, or about **De Gregorio**, or about a **finite Galerkin
truncation** of one of them. None of them says anything whatever about Navier–Stokes, or about Euler. Those two
models are the Taylor–Green Re 1600 of this world: chosen because they have known answers to grade machinery
against, and a certificate about CLM is a certificate about CLM.

De Gregorio's blow-up status is **domain-dependent** — proved on ℝ from smooth compactly supported data, open and
conjectured globally regular on the circle, proved on the circle only from C^α data. Never write "De Gregorio
blow-up" without the domain.

## The rules this line runs on

- **The acceptance condition is frozen.** The Verifier's test is fixed mathematics; a search may vary only its
  inputs. Shrinking a box on failure is allowed; loosening the acceptance condition is not. That inversion is why
  search volume is free here and expensive in DNS — a closed contraction is a proof, not a statistic.
- **`Verdict` is not a boolean.** INCONCLUSIVE is a statement about the test, never about the function, and a
  verifier usable as a truthy value invites `if verify(...)`, which silently reads it as "no".
- **An agent emits an artefact that can fail** — code, a counterexample, a citation. Never a verdict. No panel,
  no vote, no consensus step; agents sharing a model share blind spots, so their agreement is weak evidence.
- **Certificates cannot vouch for their own relevance.** Soundness is machine-checkable. Whether the theorem is
  the one the problem needs is not — that is what R3 cost, and what the fleet exists to catch.

## The next task, and it just got smaller

Certifying `λf = M(f)` at R4b needed rigorous enclosures of `A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}` — improper
oscillatory integrals — plus a proven bound on the truncation. **Those integrals turn out to have a closed form:**

    A_{nn} = 2n·Si(2nπ)
    A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ ln(m/n) − Ci(2mπ) + Ci(2nπ) ]      (n ≠ m)

The improper integral is gone, and of the two pieces that replaced it, **the first is done.** `sici.py` encloses
Si and Ci rigorously by their convergent Maclaurin series with a proved Leibniz remainder — the hypothesis is the
elementary `2k+3 > x`, and the module *refuses* rather than applying the bound where it is unmet — so
`A_entry_enclosure(n, m)` returns a certified interval for every matrix entry, graded against mpmath's
independently implemented `si`/`ci`.

**What remains is one thing: a proven bound on the Galerkin truncation error.** Certified entries of a finite
section say nothing about the operator's spectrum until that exists, and the suite prints that on every run.

Finding the closed form also corrected the quadrature it replaced, which carried a relative error of order 1e-4
from truncating its tail — the same order as the tolerance the published-eigenvalue check was using. With exact
entries all six eigenvalues land inside the *rounding intervals* of the published four-figure values.

The auditor gap is closed: `emit_certs.py` emits an R4 certificate on a dyadic instance and `auditor_r4.py`
re-derives it in exact rationals, forming no matrix and inverting nothing. It rejected a genuine certificate on
its first run — the perturbation constant had been written as a decimal string that was 2⁻²⁶ truncated at 17
digits, so prover and certificate denoted different numbers — which is the clearest demonstration this project
has that an independent implementation earns its keep.

---

*Numerical evidence and certified arithmetic are different things, and neither proves regularity or blow-up of
the Navier–Stokes equations. Nothing in the NSLab programme, including anything here, makes a claim about the
Clay problem.*
