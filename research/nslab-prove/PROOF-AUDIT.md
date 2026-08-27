# Proof audit — the mathematical argument, implication by implication

**NSLab-Prove line, opened 2026-08-27. Roadmap stage 4.** The computational audit (R1–R4) established that the
implementation correctly certifies the stated inequalities. This document audits the **other** question, kept
deliberately separate: **are the inequalities and reductions used by the certificate actually sufficient to
establish the theorem?** The object is the frozen statement at tag `r4b-statement-v1` (`0d7c663`), which does
not change under this audit; a material finding would go to `AUDIT-LOG.md` as its own entry.

**Method.** Every implication in the statement is numbered (P-xx), classified, and — where the statement
asserts without proof — either proved here in compact form or listed as open. The most dangerous remaining
possibility is not an interval-arithmetic bug but a correctly implemented certificate proving the wrong
implication; this pass therefore re-derives rather than re-reads.

**Classification legend.**

| tag | meaning |
|---|---|
| `DEF` | definition — nothing to prove |
| `ANALYTIC` | proved analytically — in the statement, or completed here (marked *[completed here]*) |
| `STANDARD` | standard theorem, named |
| `CITE` | requires external citation — verification against the cited source is an open item unless marked closed |
| `CERT` | computer-certified — the interval-arithmetic layer, audited by R1–R4 |
| `DEP` | depends on a previous item |
| `GAP` | gap / unresolved |

**First-pass verdict, stated up front:** 28 implications classified; **no `GAP`**; four `CITE` items remain
open (§6), all against Huang–Tong–Wei's published text or Lehmann's — none of them findings, all of them
unfinished verifications. Three glosses in the frozen statement were completed here (P-14, P-17, P-24), and
one runtime guard was found to be **load-bearing for a hypothesis, not cosmetic** (P-21).

---

## 1. Hypotheses and setting (§1 of the statement)

- **P-01** (H1) the space `V`, the `Ḣ¹` product — `DEF`.
- **P-02** (H2) the operator `M`, `c(f)` — `DEF` (imported construction).
- **P-03** (H3) `M` self-adjoint, positive semi-definite, **compact** on `V` — `CITE` (HTW). Open item C-1:
  verify the exact statement in HTW, *including the constant* in `‖Mf‖_{Ḣ²} ≤ ‖f‖_{Ḣ¹}`. The statement's own
  chain needs only compactness and self-adjointness; **the constant 1 is load-bearing only for the R2/R3
  audit tails** (R2-T, R3-T) — an asymmetry worth knowing: if the true constant were `C > 1`, the theorem
  would stand while the *audit* tails would need repair (and the auditor would have REFUSED had partial sums
  crossed `(iπ)²`; measured, they never did).
- **P-04** (H4) the bridging identity `⟨f, Mg⟩_{Ḣ¹} = ⟨f, g⟩_{Ḣ^{1/2}(ℝ)}` — `ANALYTIC` *[completed here]*,
  upgraded from an import. Derivation: `⟨f, Mg⟩_{Ḣ¹} = ∫ f′(Mg)′ = −∫_ℝ f′(Hg + c(g))` (boundary term dies
  since `f ∈ H¹₀`; the `c(g)` term dies since `∫f′ = 0`), and in Fourier with `Ĥ = −i sgn ξ`,
  `f̂′ = iξf̂`: `−(1/2π)∫(iξf̂)(i sgn ξ · conj ĝ) = (1/2π)∫|ξ| f̂ conj ĝ = ⟨f,g⟩_{Ḣ^{1/2}}`. **This closes the
  Fourier-convention concern analytically**: the same `1/2π` pairing is used in P-10, so the constants in
  Lemma 1 and the identity (H4) are consistent by derivation, not merely by numerical grading. Residual
  `CITE` (item C-2): the ingredient `∂ₓM(f) = −χ(Hf + c(f))` is HTW's (3.3) — itself one line from
  `∂ₓ(−Δ)^{−1/2} = −H`, but verify their sign convention for `H` matches `−i sgn ξ`.
- **P-05** (H5) the comparison operator, `λ̃_n = 1/(nπ)` — `CITE` (HTW §3.2); uncontroversial, spectrum of an
  explicit operator.
- **P-06** (H6) `(2/π²)λ̃_n ≤ λ_n < λ̃_n` — `CITE` (HTW Cor 3.7). Open item C-3, already flagged in
  `LITERATURE-CHECK`: an internal inconsistency was previously noticed between a prose constant (`0.2026/n`,
  i.e. `(2/π²)/n`) and the coded constant (`2/(nπ³) = (2/π²)λ̃_n`). **The weaker (coded) constant is the one
  used everywhere** — in the shift window only the *upper* half of H6 enters (P-22), and the Rung 4 envelope
  uses the weak lower constant — so soundness is safe under either reading; still, pin HTW's actual constant.
- **P-07** `M(V) ⊆ V` — `ANALYTIC` *[assembled here; the statement gives the key point only]*. Three parts:
  (i) parity — `(−Δ)^{−1/2}` is an even Fourier multiplier, so it preserves oddness, and `c(f)x` is odd;
  (ii) endpoints — `M(f)(1) = (−Δ)^{−1/2}f(1) − c(f) = 0` by the definition of `c(f)`, and at `−1` by
  oddness; (iii) regularity — `(Mf)′ = −χ(Hf + c(f)) ∈ L²` since `H` is bounded on `L²`. Hence `Mf` is odd,
  `H¹` on `[−1,1]`, vanishing at `±1`: `Mf ∈ V`. This is roadmap stage 5(A)'s symbolic verification, done.
- **P-08** `{s_n}` is an orthogonal basis of `V`, `⟨s_n, s_m⟩_{Ḣ¹} = n²π²δ_{nm}` — `ANALYTIC`
  *[completed here; the statement asserts it]*. Orthogonality/normalisation: `s_n′ = nπ cos(nπx)` and
  `∫₋₁¹ cos(nπx)cos(mπx) = δ_{nm}`. Completeness: `f ∈ V ⇒ f′` is even, `L²`, with `∫₋₁¹ f′ = f(1) − f(−1)
  = 0`; even zero-mean `L²` functions are spanned by `{cos(nπx)}_{n≥1}`; integrating term by term and using
  `f(1) = 0` kills the constant, giving `f = Σ (b_n/nπ) s_n` in `H¹`.
- **P-09** `A ≻ 0` (positive definite Gram) — `ANALYTIC`: `cᵀAc = ‖Σc_ns_n‖²_{Ḣ^{1/2}}`, and a compactly
  supported `L²` function with vanishing `Ḣ^{1/2}` norm has `f̂ = 0` a.e., hence is zero; `{s_n}` independent.

## 2. Lemma 1 / 1′ — the closed forms (§2)

- **P-10** `ŝ_n(ξ) = 2i(−1)^n nπ sinξ/(n²π²−ξ²)` and `A_{nm} = 4π(−1)^{n+m}nm·I(n,m)` — `ANALYTIC`
  *[re-derived here]*: the elementary sine integral gives the transform; the pairing constant matches the
  `1/2π` convention proved in P-04. Singularities of `I` removable (double zeros of `sin²ξ` at `ξ = kπ`).
- **P-11** off-diagonal evaluation via partial fractions and the shift `cos(2(u∓nπ)) = cos 2u` — `ANALYTIC`,
  with a **presentational caveat**: the intermediate `J(a)` diverges; rigorously one works with the cutoff
  difference `[J_R(a) − J_R(b)]/(b²−a²)` and lets `R → ∞`, the mismatched upper limits contributing
  `O((a−b)/R) → 0`. The statement says the divergences "cancel in the difference", which is the same fact
  stated loosely. The `6e-21` agreement between the `Ci` and `Cin` forms and the convergence of quadrature
  onto the closed form grade the outcome.
- **P-12** diagonal evaluation, `I(n,n) = Si(2a)/(2a)` — `ANALYTIC` *[re-derived]*: parts (both boundary
  terms vanish), removable singularity at `ξ = a` since `sin 2a = 0`, and `∫₀^∞ sin t/t = π/2` (`STANDARD`).
- **P-13** Lemma 1′, `γ` and `log` cancel in the `Cin` form — `ANALYTIC`: two-line algebra, graded to 6e-21.

## 3. Lemma 2 — the invariance collapse (§3); roadmap stage 5(B)

- **P-14** `A₂ = AᵀB⁻¹A`, i.e. `(A₂)_{ij} = Σ_k A_{ki}A_{kj}/(k²π²)` — `ANALYTIC` *[independently
  re-derived here, conventions checked]*. Chain: `Ms_m ∈ V` (P-07) expands in the basis (P-08) as
  `Σ c_{km}s_k` convergent in `Ḣ¹`; testing with `s_n` gives `c_{nm}·n²π² = ⟨s_n, Ms_m⟩_{Ḣ¹} = A_{nm}` by
  (H4)+(1.2); Parseval in the orthogonal basis gives `⟨Ms_i, Ms_j⟩_{Ḣ¹} = Σ_k c_{ki}c_{kj}k²π²
  = Σ_k A_{ki}A_{kj}/(k²π²)`. Conventions: `A` real symmetric (real inner products), `B = diag(n²π²)`
  from P-08, no conjugation issues, index order immaterial by symmetry. Convergence: `‖Ms_i‖²_{Ḣ¹} < ∞`
  gives the diagonal; Cauchy–Schwarz the off-diagonal. `DEP`: P-04, P-07, P-08.
- **P-15** Remark 3.1, tail = Galerkin truncation enclosure — `DEF` + `DEP` (it names the same remainder
  object twice; the mathematical content is P-14 plus P-18).

## 4. Lemma 3 — the explicit tail (§4); roadmap stage 5(C), severest scrutiny

- **P-16** `|Ci(x)| ≤ 2/x` — `ANALYTIC` (one integration by parts, checked).
- **P-17** entry bound (4.1) — `ANALYTIC` *[checked]*: `k ≥ 2m ⇒ k²−m² ≥ (3/4)k²`; bracket bounded by
  `ln(k/m) + |Ci(2mπ)| + |Ci(2kπ)|` with `|Ci(2kπ)| ≤ 1/(kπ) ≤ 1/π`.
- **P-18** tail bound (4.2): sum ≤ integral — `ANALYTIC` *[completed here — the statement's "numerator
  ~ln²k, denominator k⁴" gloss is replaced by the actual condition]*. With `a = ln(x/i)+D_i`,
  `b = ln(x/j)+D_j`, the integrand `ab/x⁴` is decreasing iff `x·(ab)′ < 4ab` iff **`1/a + 1/b < 4`**; under
  (H_K), `x ≥ K ≥ 2max(i,j)` gives `a, b ≥ ln 2 + 1/π ≈ 1.01`, so `1/a + 1/b ≤ 1.98 < 4`. Decreasing summand
  gives `Σ_{k>K} g(k) ≤ ∫_K^∞ g`. The three moments are elementary and were re-integrated by hand.
- **P-19** the moment identities — `ANALYTIC` (verified by direct integration).
- **P-20** Lemma 3.3, the vector form — `ANALYTIC` *[completed here; two subtleties the statement's "the
  same argument" hides]*. (i) `S2_a` can be **negative** (`D_l − ln l < 0` for `l ≥ 2`); the bound survives
  because `|p_a[k]| ≤ (8/(3πk))(S1_a ln k + S2_a)` holds **termwise** — each `l|v_a[l]|(ln(k/l)+D_l)` is
  positive for `k ≥ 2l` — and the product `(S1_a ln x + S2_a)(S1_b ln x + S2_b)` is expanded **exactly** into
  the three moments, so no term-sign issue arises. (ii) Monotonicity for sum ≤ integral: the linear factors
  `ln x + S2/S1` satisfy `ln x + S2_a/S1_a ≥ ln 2 + min_l D_l > 1/2` at `x ≥ 2K` (the weighted mean of
  `D_l − ln l` is at worst its minimum, at `l = K`), so P-18's criterion `1/α + 1/β < 4` again holds. `(H_K)`
  is used exactly where the statement says it is.

## 5. The theorem (§5); roadmap stage 5(D)

- **P-21** H12 lower half: `λ_j ≥ λ_min(G_A)/λ_max(G_B)` — `STANDARD` (Courant–Fischer) + `ANALYTIC` for the
  last step (`A ⪰ 0` from P-09, `G_B ≻ 0` from `B ≻ 0`). **One non-cosmetic observation:** min–max requires
  `dim S = j`, i.e. the trial vectors independent — and the runtime guard `gmin(G_A) > 0` **certifies
  exactly that**: `cᵀG_Ac = ‖Σ(Vc)_ns_n‖²_{Ḣ^{1/2}} = 0 ⟺ Vc = 0` (P-09), so a certified positive Gershgorin
  lower bound on `G_A` proves full rank. The guard in `certified_bracket` (and the auditor's refusal in
  `gershgorin_readings`) is therefore load-bearing for a *hypothesis*, not just numerics. Classified
  `ANALYTIC` + `CERT`.
- **P-22** shift admissibility (5.1) — `ANALYTIC` *[sign bookkeeping re-done]*: eigenvalues of `T = −M`
  below `ρ` are `{−λ_k : λ_k > −ρ}`; exactly `J` of them ⟺ `λ_J > −ρ ≥ λ_{J+1}`, delivered strictly by
  `−ρ ∈ [U_{J+1}, L_J)` with `U_{J+1} > λ_{J+1}` (H6, strict) and `L_J ≤ λ_J`. A pleasant corollary
  *[noted here]*: a non-empty window **certifies the spectral gap** `λ_{J+1} < λ_J` — if `λ_J = λ_{J+1}` the
  window is provably empty. Compactness (P-03) confines the essential spectrum to `{0}`, safely above `ρ < 0`.
  `DEP`: P-03, P-06, P-21.
- **P-23** `R = [⟨(T−ρ)w_a, (T−ρ)w_b⟩] ≻ 0` — `ANALYTIC` (`ρ ∉ σ(T)` from P-22 makes `T−ρ` injective, so
  the Gram is definite for independent `w_a`) **and** `CERT` (the implementation never assumes it: Sylvester
  criterion / pivots certify it at runtime, refusing otherwise).
- **P-24** the Lehmann bound `λ_j ≤ −(ρ + 1/τ_{J+1−j})` — `STANDARD` + `CITE` (open item C-4, the most
  important one) + `ANALYTIC` for the pairing *[derived here, replacing "fixed by experiment"]*: Lehmann's
  right-definite theorem gives, for each `k` with `τ_k < 0`, **at least `k` eigenvalues of `T` in
  `[ρ + 1/τ_k, ρ)`**; the `k`-th eigenvalue counting *down* from `ρ` is `−λ_{J+1−k}` (P-22's ordering), so
  `−λ_{J+1−k} ≥ ρ + 1/τ_k`, i.e. `λ_{J+1−k} ≤ −ρ − 1/τ_k`; substituting `j = J+1−k` gives the statement's
  indexing exactly. What remains for C-4 is pinning the theorem to a precise published formulation
  (Lehmann 1949/50; Maehly 1952; the matrix form as in Zimmermann–Mertins 1995 or Behnke–Goerisch 1994) and
  checking its hypotheses term for term — self-adjointness (P-03), `R ≻ 0` (P-23), the count (P-22), all
  present; the verification is that the *cited* form needs nothing more.
- **P-25** inertia counting: `#{pencil eigenvalues < t} = n₋(L − tR)` given `R ≻ 0` — `ANALYTIC`
  *[one line, supplied]*: pencil eigenvalues are eigenvalues of `R^{−1/2}LR^{−1/2}`, and
  `L − tR = R^{1/2}(R^{−1/2}LR^{−1/2} − t)R^{1/2}` is a congruence; Sylvester's law (`STANDARD`) preserves
  inertia.
- **P-26** interval soundness: enclosures of `A₀, A₁, A₂` + certified counts bracket the **true** `τ` —
  `CERT` + `ANALYTIC` remark: a count certified over interval matrices holds for every member of the
  intervals, the true matrices included; hence the bisection brackets contain the true pencil eigenvalues,
  and the exact sup `−ρ − 1/b` bounds the true bound. This is the R1–R4-audited layer.
- **P-27** `A₁ = −VᵀAV`, `A₀ = VᵀBV`, `A₂` by the vector form — `ANALYTIC` (bilinearity of (H4) over finite
  spans; signs checked: `⟨Tw,w′⟩ = −⟨Mw,w′⟩`). `DEP`: P-04, P-14, P-20.
- **P-28** refusal semantics ("a refusal is a statement about the test") — `DEF` (a property of the
  procedure, not a mathematical claim).

## 6. Open items — all `CITE`, none a finding

| id | what must be checked | against | risk if wrong |
|---|---|---|---|
| C-1 | (H3): exact statement and **constant** of the smoothing estimate | HTW, arXiv:2209.08232 | theorem unaffected (needs only compactness); **R2/R3 audit tails** would need a constant |
| C-2 | the identity `∂ₓM(f) = −χ(Hf + c(f))` and HTW's `H` sign convention | HTW (3.3) | P-04's derivation would need a sign audit; graded numerically already |
| C-3 | (H6) Cor 3.7's exact lower constant (`2/π³` vs `2/π²` per `n`) | HTW Cor 3.7 | none for soundness (weaker constant in use; only the upper half enters the shift) |
| C-4 | the precise published Lehmann formulation whose hypotheses P-22/P-23 discharge | Lehmann 1949/50; Zimmermann–Mertins 1995; Behnke–Goerisch 1994 | the pairing and count are re-derived here (P-24), but the citation must carry the theorem |

**These four are reading tasks against specific sources, not open mathematics.** C-4 is the priority; C-1–C-3
are single-page checks of HTW.

## 7. Summary

| class | count | items |
|---|---|---|
| `DEF` | 4 | P-01, P-02, P-15, P-28 |
| `ANALYTIC` (statement) | 8 | P-09, P-11, P-12, P-13, P-16, P-17, P-23, P-27 |
| `ANALYTIC` *[completed here]* | 10 | P-04, P-07, P-08, P-10, P-14, P-18, P-20, P-22, P-24 (pairing), P-25 |
| `STANDARD` | 3 | Courant–Fischer (P-21), Sylvester (P-25), `∫sinc = π/2` (P-12) |
| `CITE` open | 4 | C-1 … C-4 (P-03, P-04 part, P-06, P-24 part) |
| `CERT` | 3 | P-21 guard, P-23 runtime, P-26 |
| `GAP` | **0** | — |

**First-pass conclusion.** No unresolved gap was found. The chain from hypotheses to the certified table is
complete given the four citations, and the three most dangerous steps — the invariance collapse (P-07/P-14),
the tail's hidden monotonicity and sign conditions (P-18/P-20), and the Lehmann pairing (P-24) — now have
independent derivations *in this document* rather than resting on the statement's prose or on experiment.
What this pass cannot supply is what stage 8 exists for: hostile eyes that did not write any of it. The
standing instruction for that review is unchanged — *find the first invalid implication.*

---

*This audit classifies the argument of the frozen statement; it does not change it. Nothing here is a claim
about the Navier–Stokes or De Gregorio equations.*
