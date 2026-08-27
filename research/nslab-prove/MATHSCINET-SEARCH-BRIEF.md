# MathSciNet search brief — the final prior-art check

**NSLab-Prove line, written 2026-08-27 (supersedes the 2026-08-26 draft).** A self-contained hand-off:
everything a person with MathSciNet access needs to run the remaining prior-art check, with no other knowledge
of this project required. Four open mirrors are done — zbMATH Open, the HTW citation graph, arXiv metadata + full text, and
Semantic Scholar (`LITERATURE-CHECK.md`, fifth check and its addenda; `AUDIT-LOG.md` AL-013 through AL-016) —
and found no prior art for the combination — and one important *category*
correction: the Fichera school (§3 below). **The open-source search is closed** (commit `4f390e1`); this
remaining check is **targeted, not exploratory** — its job is the two questions in §3, not accumulating more
papers containing the word "eigenvalue". Record every query result as a *database result*; the *literature
conclusion* is drawn only after the classification of §1. **Hand the researcher `AL-017-HANDOFF.md` first** — the
one-page distillation (objective, the two questions, priority full texts, core queries, evidence format);
this document is the reference behind it. MathSciNet is the half that needs a subscription, and its older
review corpus is precisely where a full-text remark could hide.

**What this is for.** A frozen mathematical claim (tag `r4b-statement-v1`) carries the status **"no identified
prior art"** — deliberately *not* "novel". This search either upgrades the basis of that status or refutes it.
Either outcome is a good outcome; refutation goes into the audit log, not into a drawer.

---

## 1. The claim being tested (what a "hit" must actually contain)

> For a compact self-adjoint operator `M` and a Galerkin trial basis `{s_n}` such that **`M` maps the trial
> space's ambient space into itself** (`M(V) ⊆ V`), the Lehmann–Maehly second matrix
> `A₂ = [⟨M s_i, M s_j⟩]` collapses to **`AᵀB⁻¹A`** — computable from the already-certified first matrix with
> no application of `M` to any function — and the **same explicit tail bound** on that series simultaneously
> supplies the Galerkin truncation enclosure. Combined with Sylvester/inertia counting this yields certified
> two-sided eigenvalue enclosures for a **nonlocal integral operator**.

A genuine hit needs the *structure*, not the words. Classify every candidate against five questions:

    same operator?   same reduction (invariance collapse)?   same tail-as-truncation certification?
    same Lehmann/inertia construction?   same combination?

**A paper containing one ingredient is not prior art against the combined claim** — record it, but do not
stop. **One paper containing the complete combination is enough to stop and reassess the novelty language,
regardless of how many negative searches preceded it.** If a genuine candidate appears, do not change any
claim yourself: classify it on the five questions and report.

**Not hits** (already conceded as classical): Lehmann/Maehly/Temple theory; Goerisch's method; Bazley–Fox
truncation of intermediate problems (1961); Rayleigh–Ritz/Courant–Fischer; Sylvester inertia; interval
arithmetic; FEM eigenvalue enclosures for differential operators (Behnke, Plum, Mertins, Boulton, Liu,
Vejchodský, Carstensen …); the classical **degenerate/separable-kernel reduction** (a finite-rank kernel
reduces exactly to a matrix — `M` here is not finite-rank, and the certified *infinite* tail is the point);
and — added 2026-08-27 — **Fichera's orthogonal-invariants school** (§3).

## 2. The query battery

Search **Anywhere / All Fields** first; narrow to Title/Abstract/Review where the result set is large. The
batteries test the three novelty components independently, then their intersections.

**If time is short, run the core battery first — these eight are the minimum defensible pass:**

    "Lehmann" AND "integral operator" AND "eigenvalue bounds"
    "Goerisch" AND "integral operator" AND eigenvalue
    "spectral enclosure" AND "integral operator"
    "rigorous eigenvalue bounds" AND "integral operator"
    "Lehmann" AND "compact operator" AND spectrum
    "De Gregorio" AND "eigenvalue bounds"
    "De Gregorio" AND "spectral enclosure"
    "Huang" AND "Tong" AND "Wei" AND spectrum

**Battery A — exact HTW / De Gregorio baseline.** Establishes whether MathSciNet holds material missing from
the zbMATH corpus and the 8-paper citation sweep.

    "De Gregorio" AND {operator | spectral | eigenvalue | spectrum | "integral operator" | "compact operator"}
    "Huang" AND "Tong" AND "Wei" AND {"De Gregorio" | blowup | spectrum | eigenvalue}

**Battery B — the operator structure.** Prior work where an invariant subspace collapses an
infinite-dimensional operator problem to a finite matrix problem.

    "invariant subspace" AND "integral operator" AND eigenvalue
    "invariant subspace" AND {"compact integral operator" | "nonlocal operator" AND spectrum | "integral operator" AND "Galerkin"}
    "invariant subspace" AND "Schur complement" AND {operator | eigenvalue}
    "finite-dimensional invariant subspace" AND {"integral operator" | spectrum}
    "operator invariance" AND "Galerkin" AND eigenvalue
    "invariance" AND "Galerkin truncation" AND "integral operator"

**Battery C — the `AᵀB⁻¹A` / Gram reduction under other names.**

    {"A^T B^-1 A" | "A transpose B inverse A"} AND eigenvalue
    "Gram matrix" AND {"Schur complement" AND eigenvalue | "integral operator" AND spectrum | "compact operator" AND "eigenvalue enclosure"}
    "Schur complement" AND {"compact integral operator" | "integral operator" AND spectral | "Galerkin" AND "integral operator"}
    "generalized eigenvalue" AND "Gram matrix" AND "integral operator"
    "generalized eigenvalue problem" AND "compact integral operator"

**Battery D — rigorous eigenvalue enclosure of integral operators.** One of the most important searches.

    {"eigenvalue enclosure" | "eigenvalue bounds" | "rigorous eigenvalue bounds" | "verified eigenvalues" | "verified eigenvalue bounds"} AND "integral operator"
    {"computer-assisted" AND eigenvalue | "computer assisted" AND spectrum | "validated numerics" AND eigenvalue | "interval arithmetic" AND eigenvalue} AND "integral operator"
    "interval arithmetic" AND "compact operator" AND spectrum

**Battery E — Lehmann/Goerisch machinery, all variants.** The direct machinery axis.

    "Lehmann" AND {"eigenvalue bounds" | "interval arithmetic" | "verified eigenvalues" | "integral operator" | "compact operator" | "nonlocal operator"}
    {"Lehmann method" | "Lehmann-Maehly"} AND eigenvalue
    "Goerisch" AND {"integral operator" | "compact operator" | "nonlocal operator" | "integral equation"}
    {"Zimmermann" AND "Mertins" | "Zimmermann Mertins" | "Zimmermann-Mertins"} AND {"integral operator" | "compact operator" | eigenvalue AND integral}

**Battery F — Lehmann terminology without the name.** Authors do not necessarily call it "Lehmann".

    "complementary variational principle" AND {"eigenvalue bounds" | "integral operator"}
    "variational principle" AND "rigorous eigenvalue bounds" AND integral
    {"two-sided eigenvalue bounds" | "certified spectral bounds" | "spectral enclosure" | "verified spectral enclosure"} AND "integral operator"
    {"two-sided eigenvalue estimates" | "spectral enclosures"} AND "compact operator"
    "rigorous spectral enclosure" AND "nonlocal operator"

**Battery G — tail/truncation certification.** Has anyone combined operator truncation with a rigorous
spectral enclosure, the tail being part of the certificate rather than an approximation error?

    {"truncation error" | "truncation bound"} AND "integral operator" AND eigenvalue
    {"tail estimate" AND spectrum | "tail bound" AND eigenvalue} AND {"integral operator" | "compact operator"}
    "rigorous truncation" AND "integral operator"
    "Galerkin truncation" AND "integral operator" AND "eigenvalue bounds"
    "Galerkin error" AND "compact integral operator" AND spectrum
    "Galerkin approximation" AND "rigorous eigenvalue bounds" AND integral
    {"finite section" AND eigenvalue | "finite section method" AND "spectral bounds"} AND "integral operator"

**Battery H — the exact combination.** The highest-value queries: they test the intersection.

    "Lehmann" AND {"integral operator" AND "eigenvalue bounds" | "compact integral operator" AND spectrum | "nonlocal operator" AND eigenvalue}
    "Goerisch" AND {"integral operator" AND eigenvalue | "compact integral operator" AND spectrum}
    "verified eigenvalues" AND "compact integral operator" AND interval
    "spectral enclosure" AND {"Lehmann" | "Galerkin" AND "integral operator"}
    {"eigenvalue enclosure" | "rigorous eigenvalue bounds"} AND "Galerkin" AND "integral operator"

**Battery I — the De Gregorio + certification intersection.** Any substantive hit deserves immediate manual
inspection.

    "De Gregorio" AND {"Lehmann" | "Goerisch" | "eigenvalue bounds" | "verified eigenvalues" | "spectral enclosure" | "interval arithmetic" | "computer-assisted" | "Galerkin" | "invariant subspace" | "finite-dimensional"}
    "Huang" AND "Tong" AND "Wei" AND {"Lehmann" | "Goerisch" | "eigenvalue bounds" | "spectral enclosure" | "interval arithmetic"}

**Battery J — nearest-neighbour machinery.** Do not assume Boulton–Winklmeier is the closest possible result.

    "Lehmann" AND {"Dirac operator" | "Maxwell operator" | "Schrödinger" AND "nonlocal" | "pseudodifferential operator" | "boundary integral operator" | "integral equation"}
    "Goerisch" AND {"boundary integral" | "integral equation"}
    "Zimmermann Mertins" AND {"Dirac" | "nonlocal"}

**Battery K — synonyms for "integral operator".** Terminology varies; this battery already earned its place
(it is how the Fichera school surfaced on zbMATH).

    "integral equation" AND {"eigenvalue bounds" AND Lehmann | "spectral enclosure"}
    "kernel operator" AND {"eigenvalue bounds" | "spectral enclosure" | "verified eigenvalues"}
    "Fredholm operator" AND {"eigenvalue bounds" | "Lehmann"}
    "compact kernel" AND "rigorous eigenvalue"
    {"nonlocal integral operator" AND "verified eigenvalues" | "nonlocal integral equation" AND "spectral enclosure"}
    "orthogonal invariants" AND eigenvalue        ← the Fichera school's own vocabulary; see §3
    {autovalori | Einschließung AND Eigenwerte} AND {integral | Integralgleichung}

**Author sweeps** where a full-text remark could hide: **Goerisch, Albrecht, Behnke, Maehly, Bazley, Fox,
Weinberger, Fichera, Sneider, Ricci, Dirschmid**. For the Fichera school the task is specific — see §3.

## 3. The Fichera school — a category correction found on zbMATH, and what to look for inside it

The 2026-08-26 zbMATH pass reported two zero-hit queries (`Lehmann + integral operator + bounds`,
`eigenvalue enclosure + integral operator`) — both true, and both **phrase artifacts**: the battery mirror of
2026-08-27 found a whole classical school of **rigorous two-sided eigenvalue bounds for compact positive
(integral) operators** under different vocabulary — Fichera's **method of orthogonal invariants** (Fichera,
*Sul calcolo degli autovalori*, 1965; *Upper and lower bounds to eigenvalues*, 1982; Dirschmid, *Zur
Einschließung der Eigenwerte vollstetiger positiver Operatoren…*, 1970; Fichera–Sneider on Ostrowski's kernel,
1975; Noschese–Ricci 1999; ~26 papers on zbMATH).

Classified on the five questions: different operators, **trace-based invariants** rather than an invariance
collapse, no tail-as-truncation duality, no Lehmann/inertia construction, not the combination. So the claim
did not move — but the school is now **conceded as classical** for the *category* "rigorous two-sided bounds
for compact integral operators", and any write-up must cite it when claiming anything about integral operators.

**The MathSciNet task for this school:** MathSciNet's reviews of the Italian/German corpus are fuller than
zbMATH's. Look *inside* the orthogonal-invariants papers (and their citing literature) for either (a) a trial
space invariant under the operator used to make a second-moment/Gram matrix exactly computable, or (b) a tail
bound doing double duty as the truncation enclosure. Those are the two ingredients a full text could contain
that a title/abstract cannot rule out.

## 4. Known false positives — do not chase these

- **Beattie–Greenlee's "Corollary 3.7"** (*Convergence theorems for intermediate problems. II*): shares only a
  label with what our earlier documents mislabelled as the HTW bracket (their **Corollary 3.9**; AL-018)
  — and with HTW’s actual Theorem 3.7, the `c(f) ≠ 0` result. Three unrelated results, one label.
- **The "Lehmann representation"** of Green's functions in many-body physics (Dyson equations, spectral
  functions): a name collision with Lehmann's eigenvalue bounds.
- **"De Gregorio" as an author name**: G. De Gregorio (nuclear multiphonon spectroscopy) floods
  `"De Gregorio" + eigenvalue` queries on arXiv and possibly MathSciNet.
- **"Spectral enclosure" in the operator-matrix literature** (Langer, Trunk, et al., block operator matrices):
  analytic enclosures of essential/point spectra for non-self-adjoint operator matrices — not certified
  computation, different sense of the word.

## 5. How to record the results

Do not record merely "0 results". For **every query**, record:

| field | record |
|---|---|
| Query | the exact MathSciNet query string |
| Date / Database / Reviewer | search date; "MathSciNet"; person performing the search |
| Result count | exact number |
| Relevant results | yes/no |
| Closest paper | full citation **with MR number** if applicable |
| Operator | differential / integral / nonlocal / other |
| Method | Lehmann / Goerisch / orthogonal invariants / FEM / Galerkin / other |
| Rigorous? Enclosure? Relevant to claim? | yes/no each |
| Reason excluded | one sentence |

The MR numbers make the search reproducible: another person must be able to retrieve the same records.

## 6. Where the outcome goes

Either outcome is recorded as the **sixth check** in `LITERATURE-CHECK.md` and as entry **AL-017** in
`AUDIT-LOG.md` (AL-013 the zbMATH pass, AL-014 the battery mirror and Fichera correction, AL-015 the arXiv
mirror and the standing novelty formulation, AL-016 the Semantic Scholar mirror). "Nothing found"
is a result and is stated as flatly as a find. The frozen statement changes **only** if a candidate survives
the five-question classification as the complete combination — and then by a recorded reopening under a new
tag, never a silent edit.

---

*This brief tests the provenance of a claim about the spectrum of one compact operator. Nothing in it, and
nothing in the claim, concerns the Navier–Stokes or De Gregorio equations' regularity or blow-up.*
