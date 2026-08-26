# A Certified Spectral Enclosure for the Huang–Tong–Wei Profile Operator

**Statement document, NSLab-Prove line.** Written 2026-08-26.

**Purpose.** To fix the mathematics of R4b as a single auditable object, so that its novelty can be assessed
against a *stated theorem* rather than inferred backwards from code. Nothing below is refereed. Every lemma is
graded numerically against an independent route, and each such grading is named where it applies.

> ## RESULT STATUS — read before anything else
>
> | | |
> |---|---|
> | **Certified** | Rigorous two-sided spectral enclosures for selected eigenvalues of `M`, e.g. `λ₁ ∈ [0.2895674, 0.2895979]`. |
> | **NOT certified** | Eigenfunctions. The functional `c(f)`. The self-similar profile. Any PDE blow-up conclusion. |
> | **Novelty status** | *Potentially novel* operator-specific certification construction. Prior art has **not** been exhaustively checked — MathSciNet and zbMATH have not been consulted. The correct status is **no identified prior art**, which is not the same as novel. |
> | **Classical components** | Lehmann / intermediate-problem theory, Galerkin truncation, Courant–Fischer, Sylvester inertia counting, interval arithmetic — and their historical lineage. No novelty is claimed for any of it. |
> | **Independent audit** | **Partial.** Machine C now re-derives the **Gram matrix** (Lemma 1′) in exact rationals via the `Cin` form, with π from Machin — 6 tamper cases rejected. It does **not** yet reach `A₂`, the Lehmann step, or the enclosures themselves. |
>
> **This document is not a blow-up proof and contains none.** If you read only the first two pages, read this box.

**One-line summary.** For Huang–Tong–Wei's compact profile operator `M`, in the sine basis of its own comparison
operator, we derive closed forms for the Gram matrix, prove that the Lehmann `A₂` term reduces to `AᵀB⁻¹A`, bound
the resulting tail explicitly, and obtain certified two-sided enclosures of the leading eigenvalues — for example
`λ₁ ∈ [0.2895674, 0.2895979]`. **This is a statement about the spectrum of `M`. It is not a statement about a
self-similar profile, and not a statement about the De Gregorio equation.**

---

## 1. Setting and hypotheses

Everything in this section is **imported**, from De Huang, Jiajun Tong and Dongyi Wei, *On self-similar
finite-time blowups of the De Gregorio model on the real line*, Comm. Math. Phys. (2023), arXiv:2209.08232,
DOI 10.1007/s00220-023-04784-9 (hereafter **HTW**). Nothing here is claimed as new.

**(H1) The space.** `V := { f : f odd, f ∈ H¹₀([−1,1]) }`, with the plain `Ḣ¹` inner product
`⟨f, g⟩_{Ḣ¹} = ∫₋₁¹ f′g′`. No weight — unlike Chen–Hou–Huang, who use weighted `L^∞` and weighted `C^{1/2}`.

**(H2) The operator.**

    M(f) := χ_{[−1,1]} ( (−Δ)^{−1/2} f − c(f)·x ),        c(f) := (−Δ)^{−1/2} f (1),
    (−Δ)^{−1/2} f (x) = −(1/π) ∫_ℝ f(y) ln|x−y| dy.

The `−c(f)x` term is what makes `M(f)(1) = 0`, so **`M(V) ⊆ V`**. HTW's working identity (their 3.3) is
`∂ₓ M(f) = −χ_{[−1,1]}( H(f) + c(f) )`.

**(H3) Properties of `M`.** Self-adjoint and positive semi-definite on `V`; **compact**, because
`‖M(f)‖_{Ḣ²([−1,1])} ≤ ‖f‖_{Ḣ¹}` and `Ḣ²([−1,1]) ↪ Ḣ¹` compactly on a bounded interval. Write its eigenvalues
`λ₁ ≥ λ₂ ≥ … > 0`, accumulating only at `0`.

**(H4) The bridging identity.** `⟨f, M(g)⟩_{Ḣ¹} = ⟨f, g⟩_{Ḣ^{1/2}(ℝ)}`.

**(H5) The comparison operator.** HTW §3.2: the Dirichlet inverse Laplacian to the half power on the same space,
with exactly known spectrum `λ̃_n = 1/(nπ)` and eigenfunctions `f̃_n = χ_{[−1,1]} sin(nπx)/(nπ)`.

**(H6) The published spectral separation — HTW Corollary 3.7.**

    (2/π²)·λ̃_n  ≤  λ_n  <  λ̃_n = 1/(nπ),        the upper bound strict.

**This is an input to the theorem below, not a consequence of it, and not the result being reported.** It enters
at exactly one place: fixing the Lehmann shift (§5, H12).

### 1.1 The basis, which is ours only in the sense of being a choice

    s_n := χ_{[−1,1]} sin(nπx),        n = 1, 2, …

so `s_n = (nπ)·f̃_n`, i.e. the comparison operator's eigenfunctions up to scale. `{s_n}` is an orthogonal basis of
`V`, and

    ⟨s_n, s_m⟩_{Ḣ¹} = n²π² δ_{nm},        B := diag(n²π²).                                    (1.1)

Define the **Gram matrix in the bridging inner product**

    A_{nm} := ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)} = ⟨s_n, M s_m⟩_{Ḣ¹}   by (H4).                          (1.2)

`A` is symmetric and **positive definite** — it is a Gram matrix of an inner product on a linearly independent
set — which is used in §4.

> **Not in HTW.** The paper gives no Fourier or Chebyshev matrix representation, no closed form for any `λ_n`, no
> numerical value of `c_ω`, and **no interval-arithmetic or computer-assisted content of any kind**; its proof is
> analytic. Everything from §2 onward is therefore ours, and is stated as such.

---

## 2. Lemma 1 — closed forms for the Gram matrix

**Lemma 1.** With `a = nπ`, `b = mπ`,

    A_{nn} = 2n · Si(2nπ),
    A_{nm} = − ( 2nm(−1)^{n+m} / (π(m² − n²)) ) · [ ln(m/n) − Ci(2mπ) + Ci(2nπ) ],     n ≠ m.   (2.1)

*Proof.* The Fourier transform of `s_n` is `ŝ_n(ξ) = 2i(−1)^n nπ sin ξ /(n²π² − ξ²)`, so by (1.2) and the
`Ḣ^{1/2}` pairing,

    A_{nm} = 4π(−1)^{n+m} nm · I(n,m),     I(n,m) = ∫₀^∞ ξ sin²ξ / ((a²−ξ²)(b²−ξ²)) dξ.        (2.2)

All singularities are removable: `sin²ξ` has a double zero at every `ξ = kπ`.

*Off-diagonal.* Partial fractions in `ξ²` give `I = [J(a) − J(b)]/(b²−a²)` with
`J(a) = ∫₀^∞ ξ sin²ξ/(a²−ξ²) dξ`. Writing `ξ/(ξ²−a²) = ½[1/(ξ−a) + 1/(ξ+a)]` and `sin²ξ = (1−cos 2ξ)/2`, the
substitutions `t = ξ−a` and `s = ξ+a` **both** yield `∫_a^∞ (1−cos 2u)/u du`, because `a = nπ` makes
`cos(2(u ∓ a)) = cos 2u`; the first additionally uses that `(1−cos 2t)/t` is **odd**, so its integral over
`[−a, a]` vanishes. Each `J` diverges logarithmically, the two divergences are *identical*, and they cancel in
the difference, leaving the **finite** integral

    I(n,m) = − (1/(2(b²−a²))) ∫_a^b (1−cos 2u)/u du
           = − (1/(2(b²−a²))) · [ ln(b/a) − Ci(2b) + Ci(2a) ].

*Diagonal.* `ξ/(ξ²−a²)² = −½ d/dξ[1/(ξ²−a²)]`, so integrating (2.2) by parts — both boundary terms vanish,
`sin²0 = 0` at the left and decay at the right — gives `I(n,n) = ½ ∫₀^∞ sin 2ξ/(ξ²−a²) dξ`. The same two
substitutions give `(π/2 + Si(2a))` and `(π/2 − Si(2a))`, here using that `sin 2t/t` is **even**, and their
difference is `2 Si(2a)`. Hence `I(n,n) = Si(2a)/(2a)`. ∎

**Lemma 1′ (the auditable form).** Substituting `Ci(x) = γ + ln x − Cin(x)` into (2.1), the Euler–Mascheroni
constant **and** the logarithm both cancel:

    A_{nm} = − ( 2nm(−1)^{n+m} / (π(m² − n²)) ) · [ Cin(2mπ) − Cin(2nπ) ],        n ≠ m.        (2.3)

*Proof.* `−Ci(2mπ) + Ci(2nπ) = ln(n/m) + Cin(2mπ) − Cin(2nπ)`; adding the leading `ln(m/n)` cancels the
logarithm, and `γ` cancels between the two `Ci` terms. ∎

`Si` and `Cin` are **entire**, with pure alternating power series. So the whole Gram matrix requires `π` and two
convergent series — no `γ`, no logarithm. §7 explains why that is the load-bearing fact for certification rather
than for the mathematics.

> **Grading.** (2.1) is checked against direct numerical quadrature of (2.2), which shares no derivation with it.
> The quadrature converges *onto* the closed form as its truncation is extended — relative error
> `1.1e-4 → 1.5e-5 → 1.5e-6` at `n=1, m=2` for 13 → 120 → 600 break points. In the process this established that
> the quadrature itself carried a systematic relative error of order `1e-4` from tail truncation. (2.1) and (2.3)
> agree to `6e-21`, an independent consistency check on the cancellation.

---

## 3. Lemma 2 — the `A₂` reduction

For the Lehmann construction of §5 one needs `A₂ := [⟨M w_i, M w_j⟩_{Ḣ¹}]`. Naively this requires `M` **applied**
to a trial function rather than merely tested against one; via (H2)'s identity it is
`∫₋₁¹ (H w_i + c(w_i))(H w_j + c(w_j)) dx`, wanting the Hilbert transform of a truncated sine.

**Lemma 2.** It requires no such thing:

    A₂ = Aᵀ B⁻¹ A,        (A₂)_{ij} = Σ_{k≥1} A_{ki} A_{kj} / (k²π²).                          (3.1)

*Proof.* By (H2), `M(V) ⊆ V`, and by §1.1 `{s_k}` is a basis of `V`. Hence `M s_m = Σ_k c_{km} s_k` with the
series converging in `Ḣ¹`. Testing with `s_n` in `Ḣ¹` and using (1.1),

    ⟨s_n, M s_m⟩_{Ḣ¹} = c_{nm} · n²π²,      and the left side is `A_{nm}` by (1.2),

so `c_{nm} = A_{nm}/(n²π²)`. Therefore, again by (1.1),

    ⟨M s_i, M s_j⟩_{Ḣ¹} = Σ_k c_{ki} c_{kj} k²π² = Σ_k A_{ki} A_{kj}/(k²π²).

Convergence is inherited: `M s_i ∈ V ⊂ Ḣ¹`, so `‖M s_i‖²_{Ḣ¹} < ∞`, which is (3.1) at `i = j`. ∎

**Remark 3.1 — the two obligations are one object.** Truncating (3.1) at `k ≤ K_sum` leaves a remainder `R_K`.
That same `R_K` is simultaneously (i) the uncertified part of `A₂` and (ii) the Galerkin truncation enclosure the
certification separately required. Bounding it once discharges both. This is the observation flagged for novelty
testing in §8; it is a statement about *this* operator in *this* basis, not a general principle — truncation of
intermediate problems has been a named subject since Bazley–Fox (1961), §7.

> **Grading.** (3.1) is checked against the Hilbert-transform route it replaces — `A₂` computed *through the
> operator*, using `∂ₓM(f) = −χ(H f + c(f))` together with `c(f) = −½∫₋₁¹ H f`, by nested principal-value
> quadrature. The certified interval contains that independently computed value at every entry tested.

---

## 4. Lemma 3 — the explicit tail enclosure

**Lemma 3.0 (elementary).** `|Ci(x)| ≤ 2/x` for `x > 0`.
*Proof.* `Ci(x) = −∫_x^∞ cos t/t dt`; by parts, `Ci(x) = sin(x)/x − ∫_x^∞ sin t/t² dt`, so
`|Ci(x)| ≤ 1/x + ∫_x^∞ dt/t² = 2/x`. ∎

**Lemma 3.1 (entry bound).** For `k ≥ 2m`, with `D_m := |Ci(2mπ)| + 1/π`,

    |A_{km}| ≤ (8m / (3πk)) · ( ln(k/m) + D_m ).                                                (4.1)

*Proof.* From (2.1), `|A_{km}| = (2km/(π(k²−m²)))·| ln(m/k) − Ci(2mπ) + Ci(2kπ) |`. For `k ≥ 2m`,
`k² − m² ≥ (3/4)k²`, so the prefactor is at most `8m/(3πk)`. By Lemma 3.0, `|Ci(2kπ)| ≤ 1/(kπ) ≤ 1/π`. ∎

**Lemma 3.2 (tail).** For `K ≥ 2·max(i,j)`,

    | Σ_{k>K} A_{ki} A_{kj}/(k²π²) |  ≤  (64 i j / (9π⁴)) · ∫_K^∞ (ln(x/i) + D_i)(ln(x/j) + D_j) / x⁴ dx,   (4.2)

and the integral is elementary:

    ∫_K^∞ x^{−4} dx = 1/(3K³),
    ∫_K^∞ ln(x) x^{−4} dx = (ln K + 1/3)/(3K³),
    ∫_K^∞ ln²(x) x^{−4} dx = (ln²K + (2/3)ln K + 2/9)/(3K³).

*Proof.* Substitute (4.1) for both factors; the summand is decreasing in `k` for `k ≥ K` (numerator `~ln²k`,
denominator `k⁴`), so the sum is bounded by the integral, and expanding the product in powers of `ln x` gives the
three moments. ∎

The bound falls like `K^{−3}`; measured, `7.28e-6` at `K = 40` and `1.97e-7` at `K = 160`.

**(H_K) The hypothesis `K_sum ≥ 2K` is part of the theorem, not an implementation detail.** Below it, (4.1) does
not hold for every term of the tail and (4.2) is void. The implementation therefore **refuses** rather than
returning a bound: the refusal asserts that *the conditions under which a certificate would be valid have not been
established*, which is a statement about the test and not about the operator.

**Lemma 3.3 (vector form).** For trial vectors `w_a = Σ_{l≤K} v_a[l] s_l`, the same argument with
`p_a[k] := Σ_{l≤K} A_{kl} v_a[l]` and `S1_a := Σ_l l|v_a[l]|`, `S2_a := Σ_l l|v_a[l]|(D_l − ln l)` gives

    | Σ_{k>K_sum} p_a[k] p_b[k]/(k²π²) | ≤ (64/(9π⁴)) · [ S1_a S1_b M₂ + (S1_a S2_b + S2_a S1_b) M₁ + S2_a S2_b M₀ ]

with `M₀, M₁, M₂` the three moments of Lemma 3.2 at `K_sum`. This is the form the theorem uses, and it carries the
same hypothesis `K_sum ≥ 2K`.

---

## 5. The theorem

**(H7)–(H11)** are Lemmas 1, 1′, 2, 3.2, 3.3 with hypothesis (H_K).

**(H12) Shift admissibility.** Let `L_J` be a certified lower bound for `λ_J`, obtained by Courant–Fischer:
for any `J`-dimensional trial subspace `S ⊆ V`,

    λ_J = max_{dim S = J} min_{0≠f∈S} ⟨f, Mf⟩_{Ḣ¹}/⟨f,f⟩_{Ḣ¹} ≥ λ_min(G_A)/λ_max(G_B),
    G_A = VᵀAV,  G_B = VᵀBV,

the last step valid because `A ⪰ 0` (§1.1); both quantities are bounded below/above by Gershgorin in interval
arithmetic. **No truncation estimate is needed for this half** — which is exactly why Rayleigh–Ritz converges from
below. Let `U_{J+1} := 1/((J+1)π)`, which bounds `λ_{J+1}` strictly by **(H6)**. Require

    U_{J+1} < L_J,        and choose ρ with  −ρ ∈ [U_{J+1}, L_J).                               (5.1)

Then `T := −M` has **exactly `J`** eigenvalues below `ρ`, which is the Lehmann hypothesis.

> **(H6) enters here and only here.** It is used to establish a spectral *separation*, not to supply a value. The
> enclosure returned is independent of it beyond this role.

**Theorem.** Assume (H1)–(H6) from HTW, the basis of §1.1, Lemmas 1–3 with `K_sum ≥ 2K`, and shift admissibility
(5.1). Form

    A₀ = [⟨w_a, w_b⟩_{Ḣ¹}],   A₁ = [⟨T w_a, w_b⟩_{Ḣ¹}] = −VᵀAV,   A₂ = [⟨T w_a, T w_b⟩_{Ḣ¹}]  by Lemma 2,

each entry a certified interval. Put `L = A₁ − ρA₀` and `R = A₂ − 2ρA₁ + ρ²A₀ ≻ 0`. Then the negative eigenvalues
`τ₁ ≤ … ≤ τ_J < 0` of the pencil `Lx = τRx` — each isolated rigorously by **Sylvester inertia counting**, since
`R ≻ 0` makes the count of pencil eigenvalues below `t` equal to the number of negative pivots of `L − tR` —
yield, after negating and reversing,

    λ_j ≤ −(ρ + 1/τ_{J+1−j}),        j = 1, …, J,

and together with `L_j ≤ λ_j` from (H12) this gives certified two-sided enclosures.

**Computed instance** (`K = 8`, `J = 3`, `K_sum = 80`; `K = 16` for the lower bounds):

| j | certified enclosure | width | (H6)'s a priori bound |
|---|---|---|---|
| 1 | `[0.2895674, 0.2895979]` | 3.0e-5 | `λ₁ < 0.3183099` |
| 2 | `[0.1508500, 0.1509279]` | 7.8e-5 | `λ₂ < 0.1591549` |
| 3 | `[0.1021951, 0.1028375]` | 6.4e-4 | `λ₃ < 0.1061033` |

**Refusal behaviour is part of the statement.** If a pivot's enclosure straddles zero the inertia count is
undecidable and the procedure returns *no bound*; likewise if `K_sum < 2K`, or if (5.1) is empty. In each case the
output is a statement about the test, never about `M`.

---

## 6. What is not claimed

Stated flatly, because the chain is easy to slide down:

    certified enclosure of σ(M)   ⇏   certified eigenfunction
    certified eigenfunction       ⇏   certified self-similar profile
    certified self-similar profile ⇏  certified De Gregorio blow-up

**This work ends at the first line.** The self-similar profile statement additionally requires control of the
eigen*function* and of the functional `c(f)` — HTW's Theorem 3.5 guarantees `c(f) ≠ 0` for every eigenfunction,
which is what makes the normalisation `α = −1/c(f)` legal — and neither is enclosed here.

Nor does anything here bear on the De Gregorio equation's blow-up status, which is **domain- and data-dependent**:
proved on `ℝ` from smooth compactly supported data (Chen–Hou–Huang, computer-assisted); proved on `S¹` only from
`C^α` data (Chen, arXiv:2107.04777); **open and conjectured globally regular on `S¹` from smooth data**. HTW's
operator concerns the real line, where the relevant blowup is *expanding* and, in the paper's words, incompatible
with the periodic setting.

Finally: `λ̃_n = 1/(nπ)` is an a priori **upper bound**, not an estimate of `λ_n`; HTW's Appendix-A values
(`0.2896, 0.1509, …`) **are** estimates, printed to four decimals. The certified width of `3.0e-5` on `λ₁` is
below the `±5e-5` those four decimals imply — a statement about display precision, **not** a claim to have refined
HTW's mathematics.

---

## 7. What is classical, and certification architecture

**No novelty is claimed for any of the following**, and the enclosure machinery is entirely standard:

- Galerkin approximation and Rayleigh–Ritz; Courant–Fischer min–max.
- Lower bounds by **intermediate problems**: Weinstein → Aronszajn → **Bazley–Fox** → Temple–Lehmann → Goerisch →
  Beattie–Greenlee.
- **Truncation** of those constructions, a named subject since Bazley & Fox, *Truncations in the Method of
  Intermediate Problems for Lower Bounds to Eigenvalues*, J. Res. National Bureau of Standards **65B**(2) (1961)
  105–111, which already reduces the computation to matrix problems.
- Lehmann–Maehly enclosure; Goerisch's extension for an unavailable `A₂`; Beattie & Greenlee, *Convergence
  theorems for intermediate problems. II* (2002) for convergence theory.
- Sylvester's law of inertia, and interval arithmetic.

> **A recorded false match.** Beattie–Greenlee also contains a "Corollary 3.7" — that if `span{s_i}` is a core,
> the right-definite Temple–Lehmann method gives convergent lower bounds. It is **not** HTW's Corollary 3.7 (H6),
> which is a numeric spectral bracket. Same number, unrelated theorems; a prior-art search matched on the label
> rather than the statement. Recorded because the next search will hit the same collision.

**Certification architecture.** Three representations of the same object, deliberately kept distinct:

    Ci derivation (2.1)  ⟷  Si/Cin evaluation (2.3)  ⟷  interval certificate

The `Ci` form is how the derivation reads; the `Cin` form is what an exact-rational auditor can reach, since it
needs `π` and two entire series but neither `γ` nor `log`; the interval certificate is what the verifier emits.
Their `6e-21` agreement is an **independent consistency check**, not evidence for the theorem.

**Independent audit status: partial, and the boundary matters.** `auditor_r4b.py` imports `fractions`, `json`,
`math` and `auditor_r01` (for π by Machin) — a structural test asserts it — and re-derives the **Gram matrix** of
Lemma 1′ in rational arithmetic rounded outward. It is an audit rather than a re-run on three counts: a different
*representation* (`Cin`, not `Ci`), different *arithmetic* (rational endpoints, not interval floats), and a
different *constant* (Machin's π, not `iv.pi`). It accepts the emitted certificate, rejects six tampered variants,
and accepts a blunt one — only disjointness is fatal.

**It stops at the Gram matrix.** `A₂` (Lemma 2), the tail (Lemma 3), the Lehmann step and the enclosures of §5 are
**not** independently re-derived. So the certified numbers in the table above still rest on a single
implementation. That should weigh against the claim rather than for it, and the honest reading is that the audit
has climbed one rung of four.

---

## 8. The novelty claim, stated so it can be attacked

**Claim to be tested.** *For the Huang–Tong–Wei operator `M` and the trial basis `s_n = χ sin(nπx)`, the
invariance `M(V) ⊆ V` permits the Lehmann `A₂` contribution to be represented as `AᵀB⁻¹A` (Lemma 2), with the
same explicit matrix tail (Lemma 3) simultaneously providing the Galerkin truncation enclosure (Remark 3.1);
together with the closed forms of Lemma 1, this yields certified two-sided spectral enclosures.*

**This is a claim of absence of identified prior art, not a claim of mathematical priority.**

Searches to date have found no paper combining these ingredients in this way, but they were web searches against
strings and titles, and one produced a false positive on a label collision (§7). **A definitive check requires
MathSciNet or zbMATH**, which have not been consulted. The productive query is conceptual rather than literal —
notation will differ:

> Has a finite-dimensional Lehmann/inertia certificate been used where the operator maps the Galerkin trial space
> into itself, so that the inverse-operator contribution collapses to a Gram-type matrix `AᵀB⁻¹A` with an explicit
> analytic tail serving simultaneously as the truncation bound?

Searching for the literal expression `AᵀB⁻¹A` is not sufficient and has already been tried.

---

## 9. Reproduction

```bash
cd research/nslab-prove/cap && python run-all.py        # 9 suites, 350 checks
```

`problem_dg_profile.py` — `A_entry` (2.1), `A_entry_via_cin` (2.3), `A2_enclosure` (Lemma 2 + 3.2),
`certified_bracket` (H12 lower half), `lehmann_matrices` / `certified_upper_bounds` (the Theorem).
`sici.py` — certified `Si`, `Ci`, `Cin`. `lehmann.py` — inertia counting and the enclosure.

---

*Numerical evidence and certified arithmetic only. Nothing in this document proves regularity or blow-up of the
Navier–Stokes equations, or of the De Gregorio equation on any domain, and no claim here should be read as one.*
