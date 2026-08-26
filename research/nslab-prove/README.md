# NSLab-Prove — the certificate line

NSLab produces **evidence**. This line produces **certificates**. That is a difference in kind, not in rigour:
a DNS run is a measurement with error bars that shrink if you spend more, and a closed certificate is a finite
list of inequalities that is either true or refused. No quantity of the first becomes the second.

```bash
cd research/nslab-prove/cap && python run-all.py     # 9 suites, 433 checks, ~12 min, mpmath only
```

It prints `CAP SUITES: ALL PASS (9 suites)` or it fails loudly. There is no third answer and no tolerance to tune.

## Read in this order

| | |
|---|---|
| [`LITERATURE-CHECK.md`](LITERATURE-CHECK.md) | **Start here.** Four claims of mine that the agent fleet refuted, and what each correction changed. Reading the code first means reading the corrections without knowing they were corrections. |
| [`Certified Blow-Up — System Architecture.md`](Certified%20Blow-Up%20—%20System%20Architecture.md) | Why a CAP is the only architecture on which a computer contributes to a proof here; the five layers; the three machines and the **frozen contract** between them. |
| [`Certified Spectral Enclosure … — Statement.md`](Certified%20Spectral%20Enclosure%20for%20the%20De%20Gregorio%20Profile%20Operator%20%E2%80%94%20Statement.md) | **The mathematics of R4b as one auditable object** — hypotheses imported from Huang–Tong–Wei, three lemmas that are ours, the theorem, and two sections that matter as much as the proofs: what is classical, and what is not claimed. Read this before assessing anything about novelty. |
| [`AUDIT-LOG.md`](AUDIT-LOG.md) | The statement is **frozen** at tag `r4b-statement-v1`; audit findings go here, not into the document. Four rungs, **all four audited** under contracts frozen before their implementations — Gram matrix, `A₂` + tail, Lehmann pencil, and the assembled enclosures. |
| [`AUDIT-COMPLETION.md`](AUDIT-COMPLETION.md) | **The post-audit bridge**, tagged `r4b-audit-complete-v1`: the commit chain, the verdicts, the independence structure, the three findings that matter — and the precise definition of what "independently audited certificate" does and does not claim. Cite this, not a reconstruction. |
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
| **R4b** the De Gregorio profile operator | **certified two-sided enclosure of the spectrum** — λ₁ ∈ [0.2895674, 0.2895979]; lower by Courant–Fischer, upper by Lehmann. **Not** a PDE statement; **audited on all four rungs** — Gram, `A₂`, Lehmann pencil, and the assembled enclosures |
| **R5** 2D Boussinesq / axisymmetric Euler | out of reach alone, and `cap/README.md` §R3 says *why* with a number |
| **Machine C** the auditor | audits R0/R1a/R1b/R2/R3/**R4** in exact rationals, and **all four R4b rungs** under frozen contracts — Gram matrix, **`A₂` + tail** (`R2-AUDIT-CONTRACT.md`), **Lehmann pencil** (`R3-AUDIT-CONTRACT.md`), **assembled enclosures** (`R4-AUDIT-CONTRACT.md`) — every tampered certificate rejected, and twice its own bound came out sharper than the prover's (AL-010, AL-012) |

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

## Where R4b stands: a certified two-sided enclosure, both halves ours

`A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}` were improper oscillatory integrals evaluated by quadrature. They have closed
forms —

    A_{nn} = 2n·Si(2nπ)
    A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ ln(m/n) − Ci(2mπ) + Ci(2nπ) ]      (n ≠ m)

— which `sici.py` encloses rigorously, so every matrix entry is a certified interval. From there:

| j | certified enclosure | width | Corollary 3.7's a priori bound |
|---|---|---|---|
| 1 | [0.2895674, 0.2895979] | **3.0e-5** | λ₁ < 0.3183099 |
| 2 | [0.1508500, 0.1509279] | 7.8e-5 | λ₂ < 0.1591549 |
| 3 | [0.1021951, 0.1028375] | 6.4e-4 | λ₃ < 0.1061033 |

**Lower** half: Courant–Fischer, needing no truncation estimate at all — any j-dimensional trial subspace of V
bounds λ_j from below, which is why Rayleigh–Ritz converges from below. **Upper** half: Lehmann–Maehly, certified
without an eigensolver by Sylvester inertia counting in an interval LDLᵀ, refusing when a pivot cannot be signed.

**`A₂` was the blocker and it dissolved.** It looked as though it needed M *applied* to a trial function — the
Hilbert transform of a truncated sine. It does not: M maps V into V and `{s_k}` is a basis, so `A₂ = AᵀB⁻¹A`, the
matrix already certified plus a tail. **And that tail bound *is* the Galerkin truncation bound this rung was
missing** — two obligations that were one object. The Hilbert-transform route survives as an *independent
cross-check*, which is a better use for it: the certified interval contains what it computes.

### What is borrowed, and what is not

Corollary 3.7 (Huang–Tong–Wei) is still load-bearing, but as an **input certificate**, not the answer: it supplies
`λ_{J+1} < 1/((J+1)π)`, which with our own certified lower bound on `λ_J` establishes the Lehmann shift
hypothesis. The enclosure returned is ours and is far tighter than the corollary.

Two wording traps worth keeping straight. `λ̃_n = 1/(nπ)` is an a priori **upper bound**, not an estimate of `λ_n`;
the Appendix-A values `0.2896, 0.1509, …` **are** estimates, printed to four decimals. Our certified width of
3.0e-5 on λ₁ is below the ±5e-5 implied by that printed value — a statement about display precision, **not** a
claim to have refined their mathematics.

### Prior art: the machinery is not new, and the files say so

Intermediate-problem lower bounds run Weinstein → Aronszajn → **Bazley–Fox** → Temple–Lehmann → Goerisch →
Beattie–Greenlee. Truncation of these constructions has been a named subject since Bazley & Fox (1961). Nothing in
`lehmann.py` is a new theorem. What is problem-specific is the instantiation: the `AᵀB⁻¹A` reduction for *this*
operator and basis, and the explicit certified tail. See [`LITERATURE-CHECK.md`](LITERATURE-CHECK.md), which also
records a **rejected match** — Beattie–Greenlee has its own "Corollary 3.7", and it is not this one.

**The zbMATH Open novelty check ran 2026-08-26** (LITERATURE-CHECK, fifth check; AL-013): structured field
search plus an exhaustive sweep of HTW's citations. Nothing found — including two zero-hit queries showing
zbMATH indexes no document pairing Lehmann-method bounds with an integral operator at all. The claim stays
"**no identified prior art**" on a stronger basis than before; **MathSciNet remains unconsulted**, and the
German-language 1980s corpus was checked by title and abstract only.

### What is still not claimed

None of this is a statement about the PDE. It bounds the **spectrum** of M. The self-similar profile statement
needs the eigen*function* and the functional `c(f)`, and neither is enclosed here. Machine C now reaches **all
four** of R4b's audit rungs — the Gram matrix, `A₂` with its tail, the Lehmann pencil, and the assembled
enclosures — each under a contract frozen before its implementation. What that establishes, and all that it
establishes, is that no part of the certified table rests on a single implementation any more. An
*independently audited certificate* is still not an *independently proved theorem*: the proof is the statement
document, and the ladder is computational evidence about the machinery, not a second proof.

---

*Numerical evidence and certified arithmetic are different things, and neither proves regularity or blow-up of
the Navier–Stokes equations. Nothing in the NSLab programme, including anything here, makes a claim about the
Clay problem.*
