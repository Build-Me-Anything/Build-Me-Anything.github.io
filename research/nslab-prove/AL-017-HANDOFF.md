# AL-017 handoff — MathSciNet / historical full-text check (one page)

**Objective.** Close the last gate on a novelty claim. A certified spectral-enclosure construction claims, as
its only potentially new content, this **combination**: for a compact self-adjoint *nonlocal integral*
operator `M` with `M(V) ⊆ V` for the trial space's ambient space `V`, the Lehmann second matrix collapses to
`A₂ = AᵀB⁻¹A` (an **infinite** series — `M` is *not* finite-rank), its certified tail bound **simultaneously**
serves as the Galerkin truncation enclosure, and the eigenvalues are certified two-sided by Lehmann + Sylvester
inertia. Four open databases (zbMATH Open, arXiv, Semantic Scholar, the full citation set of Huang–Tong–Wei,
Comm. Math. Phys. 402 (2023), **MR4581109**) found prior art for the *components* but no instance of the
*combination*. You have the two coverages we lack: MathSciNet reviews and historical full texts.

## The two questions — everything reduces to these

1. **Q1 (invariance collapse):** Does any historical construction exploit a trial/ambient space *invariant
   under the operator* to make the second-moment matrix `[⟨Tφᵢ, Tφⱼ⟩]` exactly computable from the first —
   an equivalent of `M(V) ⊆ V ⇒ A₂ = AᵀB⁻¹A` — for an operator that is **not** finite-rank?
2. **Q2 (tail = truncation certificate):** Does any construction use a *single* infinite-tail estimate
   simultaneously as the rigorous enclosure of the truncated spectral problem — the tail being part of the
   certificate, not an approximation error?

## Priority full texts (examine for Q1/Q2; titles/abstracts already checked and silent)

**Fichera school (orthogonal invariants — rigorous two-sided bounds for compact positive operators):**
Fichera 1965 *Sul calcolo degli autovalori*; Fichera 1965 *Linear elliptic differential systems and eigenvalue
problems* (Springer LNM 8, the method's exposition); Fichera 1975 *Osservazioni e risultati… taluni operatori
positivi*; Fichera 1976 *Approximation of the eigenvectors of a positive compact operator*; Fichera 1982
*Upper and lower bounds to eigenvalues*; Fichera–Sneider 1975 (Ostrowski's kernel); Dirschmid 1970 *Zur
Einschließung der Eigenwerte vollstetiger positiver Operatoren… I*; Bassotti 2000 (method survey); Leuzzi 1981
(Fredholm kernel); Noschese–Ricci 1999; Natalini–Noschese–Ricci 1999.

**Goerisch/Albrecht German corpus (Lehmann-type machinery):** Goerisch 1980 *Eine Verallgemeinerung eines
Verfahrens von N. J. Lehmann…*; Goerisch–Albrecht 1984 & 1986 *Eine einheitliche Herleitung von
Einschließungssätzen für Eigenwerte*; Behnke–Goerisch 1994 *Inclusions for eigenvalues of selfadjoint
problems* (in Herzberger, *Topics in Validated Computations*).

## If the papers leave time — the eight-query core battery (Anywhere/All fields)

`"Lehmann" AND "integral operator" AND "eigenvalue bounds"` · `"Goerisch" AND "integral operator" AND
eigenvalue` · `"spectral enclosure" AND "integral operator"` · `"rigorous eigenvalue bounds" AND "integral
operator"` · `"Lehmann" AND "compact operator" AND spectrum` · `"De Gregorio" AND "eigenvalue bounds"` ·
`"De Gregorio" AND "spectral enclosure"` · `"Huang" AND "Tong" AND "Wei" AND spectrum`

**Ignore these known collisions:** Beattie–Greenlee's "Corollary 3.7" (label only); the physics "Lehmann
representation" (Green's functions); "spectral enclosure" in the block-operator-matrix literature (Langer,
Trunk — analytic, different sense); G. De Gregorio (nuclear physicist); separable/degenerate-kernel
reductions (finite-rank — the exact finite reduction is trivial there and is not the claim).

## Evidence to return

- **Per priority paper:** MR number; **Q1 yes/no** and **Q2 yes/no**; if *yes*, the quoted sentence or
  numbered equation that shows it. Title-level impressions are not evidence either way.
- **Per query:** exact query string, result count, closest paper (full citation + MR number), and a
  one-sentence reason for exclusion. **"Nothing found" is a result — report it as flatly as a find.**
- **If you find the complete combination in one paper: stop and send it immediately** — full citation, MR
  number, and the passage. Do not weigh it against the negative searches; one genuine instance outweighs all
  of them. Classification and any change to the claim happen on our side, on the record.

*Search date and your name on everything, so the search is reproducible. Nothing here concerns Navier–Stokes
or De Gregorio blow-up; the claim under test is about the spectrum of one compact operator.*
