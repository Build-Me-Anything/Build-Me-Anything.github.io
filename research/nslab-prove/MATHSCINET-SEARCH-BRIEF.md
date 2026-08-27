# MathSciNet search brief — the final prior-art check

**NSLab-Prove line, written 2026-08-27.** A self-contained hand-off: everything a person with MathSciNet
access needs to run the remaining prior-art check, with no other knowledge of this project required. The
zbMATH Open half of the check is already done (`LITERATURE-CHECK.md`, fifth check; `AUDIT-LOG.md` AL-013) and
found nothing; MathSciNet is the half that needs a subscription.

**What this is for.** A frozen mathematical claim (tag `r4b-statement-v1`) currently carries the status
**"no identified prior art"** — deliberately *not* "novel" — and this search is what would either upgrade the
basis of that status or refute it. Either outcome is a good outcome; refutation goes into the audit log, not
into a drawer.

---

## 1. The claim being tested (what a "hit" must actually contain)

> For a compact self-adjoint operator `M` and a Galerkin trial basis `{s_n}` such that **`M` maps the trial
> space's ambient space into itself** (`M(V) ⊆ V`), the Lehmann–Maehly second matrix
> `A₂ = [⟨M s_i, M s_j⟩]` collapses to **`AᵀB⁻¹A`** — computable from the already-certified first matrix with
> no application of `M` to any function — and the **same explicit tail bound** on that series simultaneously
> supplies the Galerkin truncation enclosure. Combined with Sylvester/inertia counting this yields certified
> two-sided eigenvalue enclosures for a **nonlocal integral operator**.

A genuine hit needs the *structure*, not the words: (i) Lehmann-type (or Temple/intermediate-problems-type)
certified bounds applied to a **nonlocal/integral** operator; (ii) the second-moment matrix obtained by an
**invariance collapse** rather than by applying the operator or by Goerisch's substitute; (iii) one tail bound
doing double duty as the truncation enclosure. Any *one* of those found alone is worth recording; all three
together is prior art.

**Not hits** (all already conceded as classical, no need to report): Lehmann/Maehly/Temple theory itself;
Goerisch's method; Bazley–Fox truncation of intermediate problems (J. Res. NBS 65B, 1961); Rayleigh–Ritz /
Courant–Fischer lower bounds; Sylvester inertia; interval arithmetic; FEM eigenvalue enclosures for
differential operators (Behnke, Plum, Mertins, Boulton, Liu, Vejchodský, Carstensen …).

## 2. The searches to run

MathSciNet full-text/review search, roughly in this order:

1. `"Lehmann" AND "integral operator"` — on zbMATH Open this returns **zero** relevant items; the MathSciNet
   review corpus is older and deeper, especially for 1960s–80s German work.
2. `"eigenvalue" AND ("enclosure" OR "inclusion" OR "Einschließung") AND ("integral operator" OR "integral equation")`.
3. `"intermediate problems" AND ("integral operator" OR "compact operator")` — the Weinstein–Aronszajn–Bazley–Fox
   line *did* treat integral operators in the 1960s; the question is whether any instance certified two-sided
   bounds with an invariance-collapsed second moment.
4. `"Temple" AND "lower bound" AND "integral equation"`.
5. Author sweeps where a full-text remark could hide: **Goerisch, Albrecht, Behnke, Maehly, Bazley, Fox,
   Weinberger, Fichera** — Fichera in particular wrote on eigenvalue bounds for integral equations
   (linear elasticity, potential theory); check whether any construction computes `⟨Tφᵢ, Tφⱼ⟩` via an
   invariance of the trial space.
6. MSC-classified browse: **65N25** ∩ **45C05** (eigenvalue problems for integral equations), and
   **47A75** ∩ **65G20/65G30** (validated numerics).
7. Citation search on **Huang–Tong–Wei**, *On self-similar finite-time blowups of the De Gregorio model on
   the real line*, Comm. Math. Phys. 402 (2023), MR4581109 / Zbl 1529.35388, DOI 10.1007/s00220-023-04784-9 —
   the open-web citation sweep found 8 citing papers, all analytic; MathSciNet's reference matching sometimes
   finds others.

## 3. Known false positives — do not chase these

- **Beattie–Greenlee's "Corollary 3.7"** (*Convergence theorems for intermediate problems. II*): a
  Temple–Lehmann convergence result under a core condition. It shares only a label with Huang–Tong–Wei's
  Corollary 3.7 (a numeric spectral bracket). Two unrelated theorems.
- **The "Lehmann representation"** of Green's functions in many-body physics: a name collision, no relation
  to Lehmann's eigenvalue bounds. Any hit whose context is Dyson equations or spectral functions is this.

## 4. What to report back

For each candidate: full citation, and one sentence on **which of the three ingredients of §1 it contains**.
"Nothing found" is a result and should be stated as flatly as a find. The outcome — either way — is recorded
as the sixth check in `LITERATURE-CHECK.md` and as entry AL-014 in `AUDIT-LOG.md`; the frozen statement
changes only if genuine prior art appears, and then by a recorded reopening, not a silent edit.

---

*This brief tests the provenance of a claim about the spectrum of one compact operator. Nothing in it, and
nothing in the claim, concerns the Navier–Stokes or De Gregorio equations' regularity or blow-up.*
