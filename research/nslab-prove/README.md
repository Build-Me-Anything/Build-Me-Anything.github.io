# NSLab-Prove — the certificate line

NSLab produces **evidence**. This line produces **certificates**. That is a difference in kind, not in rigour:
a DNS run is a measurement with error bars that shrink if you spend more, and a closed certificate is a finite
list of inequalities that is either true or refused. No quantity of the first becomes the second.

```bash
cd research/nslab-prove/cap && python run-all.py     # 9 suites, 325 checks, ~4.5 min, mpmath only
```

It prints `CAP SUITES: ALL PASS (9 suites)` or it fails loudly. There is no third answer and no tolerance to tune.

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

**And there is now a certified two-sided bracket** — `certified_bracket` — on the six leading eigenvalues:

| j | certified bracket | published | vs the published lower bound |
|---|---|---|---|
| 1 | [0.2895674, 0.3183099) | 0.2896 | ×1.43 |
| 2 | [0.1508500, 0.1591549) | 0.1509 | ×1.49 |
| 6 | [0.0519998, 0.0530516) | 0.0520 | ×1.54 |

**Read the halves separately, because they are not the same kind of thing.** The **lower** half is ours and needs
no truncation estimate at all: by Courant–Fischer on `V`, *any* j-dimensional trial subspace bounds `λ_j` from
below, so certified entries plus Gershgorin give it directly — which is why Rayleigh–Ritz converges from below.
The **upper** half is Corollary 3.7 of the source, used as a **citation**. Nothing here derives an upper bound.

So the Galerkin truncation error is *bounded* by the bracket width, but not by an argument of ours.

**`lehmann.py` is the machinery that would replace the citation** — Lehmann–Maehly, which bounds the eigenvalues
of `T = −M` below a shift from below, i.e. `λ_j` from **above**. It is certified without an eigensolver: since
`R ≻ 0`, Sylvester's law of inertia turns "how many eigenvalues below `t`" into a count of negative pivots in an
interval LDLᵀ, and a pivot whose enclosure straddles zero returns `None` rather than a guess. Graded on the
source's comparison operator, where `M̃ s_n = λ̃_n s_n` makes every Lehmann matrix exact: bounds valid at every
trial space tried, and the worst relative gap falls **0.153 → 0.0056 → 6.0e-5** as the trial space improves —
the quadratic convergence Lehmann predicts.

**`A₂` was the blocker, and it dissolved.** It looked as though it needed M *applied* to a trial function — by the
source's identity, `∫₋₁¹ (H w_i + c(w_i))(H w_j + c(w_j)) dx`, wanting the Hilbert transform of a truncated sine.
It does not. M maps V into V and `{s_k}` is a basis of V, so `M s_m = Σ_k c_{km} s_k`; testing with `s_n` in `Ḣ¹`
and using `⟨s_n, s_m⟩_{Ḣ¹} = n²π²δ_{nm}` gives `c_{nm} = A_{nm}/(n²π²)`, hence

    A₂ = Aᵀ B⁻¹ A,    A₂_{ij} = Σ_k A_{ki} A_{kj} / (k²π²),   B = diag(k²π²)

**no Hilbert transform anywhere** — just the matrix already certified, plus a tail. And **the tail bound on that
sum *is* the Galerkin truncation bound this rung was missing.** The two open problems were one problem. Both are
now in `A2_enclosure`, with the tail bounded in closed form from `|Ci(x)| ≤ 2/x` and three elementary
`∫ln^p(x)/x⁴` moments. Verified against the Hilbert-transform route — computed independently, through the
operator — which the certified interval contains at every entry tested.

**What remains before Lehmann is instantiated on M** is wiring `A₂` through and re-checking the shift hypothesis
`λ_{J+1} < −ρ < λ_J` for M itself. And **Lehmann still does not remove the dependence on Corollary 3.7**: it
converts it from *the answer* into an *a priori input* for choosing that shift — a real improvement, not an
elimination.

One thing to resolve first: `problem_dg_profile.bracket`'s prose and its own formula **disagree** about
Corollary 3.7 — 0.2026/n as written, 0.06450/n as coded. Both upper bounds agree and every computed eigenvalue
satisfies both lower bounds, so nothing is unsound; the code keeps the weaker one deliberately, and the table
above quotes the improvement against the *tighter* reading. Flagged for the `oracle-hunter`.

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
