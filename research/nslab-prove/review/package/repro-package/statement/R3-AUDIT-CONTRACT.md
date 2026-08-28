# Rung 3 audit contract — the Lehmann pencil and the inertia count

**Status: FROZEN before implementation.** Any later change is an `AUDIT-LOG.md` event, not an implementation
convenience. Subordinate to the frozen mathematical statement at tag `r4b-statement-v1` (`0d7c663`) and sibling
to `R2-AUDIT-CONTRACT.md`, whose independence discipline it inherits.

**Authority order.** (1) frozen statement → (2) this contract → (3) `AUDIT-LOG.md` → (4) implementation →
(5) tests. Tests demonstrate compliance; they do not define the mathematics after the fact.

---

## 1. The object

The theorem's §5 step: with trial vectors `w_a = Σ_{l≤K} v_a[l] s_l`, shift `ρ` and the matrices

    A₀ = [⟨w_a, w_b⟩_{Ḣ¹}],   A₁ = −VᵀAV,   A₂ = [⟨M w_a, M w_b⟩_{Ḣ¹}],
    L = A₁ − ρA₀,             R = A₂ − 2ρA₁ + ρ²A₀ ≻ 0,

the pencil `Lx = τRx` has negative eigenvalues `τ₁ ≤ … ≤ τ_J < 0`, isolated by inertia counting, and

    λ_j ≤ −(ρ + 1/τ_{J+1−j}),        j = 1, …, J.

The certificate claims: the shift window `−ρ ∈ [1/((J+1)π), L_J)`, the three matrices as certified intervals,
a bracket `[a_k, b_k]` for each `τ_k`, and the resulting upper bounds `U_j`. The auditor re-derives **all of
it** from the certificate's trial vectors and its own primitives, and compares.

## 2. Independence contract

> The auditor shall not import, call, or depend upon the prover's pencil, inertia, bisection, matrix-assembly,
> tail, or interval-construction routines. Shared classical mathematics (Sylvester/Jacobi inertia theory,
> Gershgorin, Cauchy–Schwarz) may be independently re-implemented, but **no prover implementation responsible
> for establishing the R3 certificate may be an auditor dependency.**

**Forbidden:** `lehmann.*` (the whole module), `problem_dg_profile.*` (in particular `lehmann_matrices`,
`_vector_tail_bound`, `certified_bracket`, `certified_upper_bounds`), `sici.*`, `ivutil.*`, `mpmath`.
**Permitted:** `fractions`, `json`, `math`; `auditor_r01.pi_interval` (π by Machin); `auditor_r4b` (`RI`,
`A_entry`, `pi_ri`, `set_precision_for` — Rung 1, audited); `auditor_r4b_a2` (`sqrt_upper`, `Refusal` — Rung 2,
audited).

## 3. The auditor's own mathematics — four separations from the prover

### (a) The A₂ tail: the vector form of (R2-T), and it needs no `Ksum ≥ 2K`

The prover's vector tail (`_vector_tail_bound`) goes through the entry asymptotics — `|Ci(x)| ≤ 2/x`, the
`|A_km|` bound, three `∫ln^p/x⁴` moments — and **requires `Ksum ≥ 2K`**. The auditor uses none of it. With
`p_a[k] := Σ_{l≤K} A_{kl} v_a[l]`, Lemma 2 of the statement gives `M w_a = Σ_k (p_a[k]/(kπ)²) s_k`, so by
Parseval in the `s`-basis and HTW's smoothing estimate (H3),

    Σ_{k≥1} p_a[k]² = ‖M w_a‖²_{Ḣ²} ≤ ‖w_a‖²_{Ḣ¹} = Σ_{l≤K} v_a[l]² (lπ)².                  (R3-T)

    T_a(Ksum) := Σ_{k>Ksum} p_a[k]²/(kπ)² ≤ [ Σ_l v_a[l]²(lπ)² − Σ_{k≤Ksum} p_a[k]² ] / ((Ksum+1)π)².  (R3-D)

    | tail of (A₂)_ab |  ≤  √( T_a(Ksum_aud) · T_b(Ksum_aud) )     by Cauchy–Schwarz.        (R3-O)

Convergence again follows from a **finite analytic bound**, not a decay rate, and the auditor's tail carries
**no hypothesis on `Ksum` at all** — where the prover must refuse below `2K`, the auditor's bound simply holds.
`Ksum_aud` is the auditor's own truncation choice, deterministic and independent of the prover's `Ksum`.

### (b) Inertia by Jacobi's minor rule, not by LDLᵀ pivots

The prover counts negative LDLᵀ pivots (Sylvester's law), refusing when a pivot cannot be signed. The auditor
uses **Jacobi's rule**: for symmetric `S` whose leading principal minors `D₁ … D_n` are all nonzero, the number
of negative eigenvalues equals the number of sign changes in the sequence `1, D₁, …, D_n` (classical; Jacobi,
via Gantmacher Ch. X). The minors are computed **division-free** by cofactor expansion in exact rational
intervals — no elimination, no quotients — so the refusal condition is *a minor's interval straddles zero*,
which is a different failure surface from a pivot's. `R ≻ 0` is **checked** by Sylvester's criterion (all
leading minors certified positive), never asserted from the Gram form.

### (c) Resolution-limited bisection: sharpness set by what the widths certify

The auditor brackets each `τ_k` by bisection on its own inertia counts, from the span `[−2⁴⁰, −2⁻⁴⁰]` (both
ends' counts must certify, `0` and `≥ J`). On an undecidable midpoint it probes the deterministic sequence
`1/2, 1/4, 3/4` of the interval; if none decides, **the bracket stops there** — the auditor cannot narrow past
its own interval widths, because every narrowing requires a certified count. No tolerance is tuned to meet the
prover's numbers.

### (d) The final arithmetic is exact, and the shift window is re-derived

`sup_{τ∈[a,b]} −(ρ + 1/τ) = −ρ − 1/b` (the sup sits at the right endpoint, since `−(ρ+1/τ)` is increasing in
τ). The certificate's endpoints are dyadic rationals, so `1/b` is **exact** — the τ→bound step is redone with
no rounding at all. Shift admissibility is re-derived: `−ρ ≥ 1/((J+1)π)` against the auditor's own Machin π,
and `−ρ < L_J` against the auditor's own Gershgorin lower bound `λ_min(VᵀAV)/λ_max(VᵀBV)` built from its own
Gram entries and the certificate's bracket trial vectors.

### Measured behaviour (calibration, recorded so the choice of `Ksum_aud` is not a tuned secret)

At `K = 8`, `J = 3`, prover `Ksum = 80`: the prover's own τ brackets have widths `3.6 / 3.6e-3 / 4.4e-4` for
`τ₁/τ₂/τ₃` — the pencil is genuinely ill-conditioned near `τ₁` because the gap `−ρ − λ₃ ≈ 0.011` is small.
Calibration of the auditor route (throwaway prototype, before this implementation was trusted):
`Ksum_aud = 80 / 200 / 400` gives auditor τ₁ widths `1 / 0.14 / 0.035` in `9.6 s / 127 s / 1002 s`, every
bracket certified and every bound non-vacuous already at 80 — so **`Ksum_aud = 80` is the standing value**,
with the deeper rungs recorded in `AUDIT-LOG.md`. One unforeseen outcome, recorded rather than smoothed over:
the auditor's τ₁ bracket `[−86, −85]` is *sharper* than the prover's `[−87.3, −83.7]`, because the
division-free minors keep deciding where an LDLᵀ pivot's interval quotient refuses and the prover's bisection
stops early. Sharper was not required and is not the criterion; only disjointness is fatal.

## 4. Refusal conditions

`ACCEPT ⟺ matrices certified ∧ R ≻ 0 certified ∧ window certified ∧ every bracket certified ∧ exact recheck
passes ∧ overlap everywhere`. Anything else is `REFUSE`/`REJECT`. There is no third state.

Concrete refusal triggers: a leading principal minor of `R` not certified strictly positive; a minor of
`L − tR` straddling zero where a count is required (span ends, final bracket endpoints); the span-end counts
not `0` and `≥ J`; `Σ_{k≤Ksum} p_a[k]²` exceeding the (R3-T) majorant, which would falsify an imported
hypothesis and means something upstream is wrong; a τ bracket whose upper endpoint is not certified negative;
an auditor upper bound above `1` (all eigenvalues of `M` lie below `1/π`, so a bound above 1 is sound but
vacuous — a resolution collapse must be reported as a refusal, never as agreement); endpoints non-finite or
out of order.

Fatal comparison outcomes (`REJECT`): a claimed matrix entry disjoint from the auditor's; a claimed τ bracket
disjoint from the auditor's; a claimed `U_j` smaller than the exact sup `−ρ − 1/b_claimed` over the
certificate's **own** bracket — the claim is then unsupported by its own data, whatever the true spectrum does.

## 5. Test suite — five pillars, five distinct failure classes

| # | test | protects against |
|---|---|---|
| 1 | **Algebraic validation** — diagonal pencil with closed form `τ_i = 1/(t_i − ρ)`, recovered exactly | incorrect construction |
| 2 | **Refusal stress** — zero `R`, inconsistent (R3-T) parts, τ touching 0 must `REFUSE` | unsound certification |
| 3 | **Static dependency audit** — AST check for zero forbidden imports | accidental shared implementation |
| 4 | **Dynamic independence** — corrupt every prover routine; output must be bit-identical | hidden runtime dependence |
| 5 | **AL-002/AL-004 regression** — ambient precision must not move the output; grid sized from `Ksum_aud` | arithmetic-contract drift |

Plus the tamper battery: a shifted τ bracket, an understated `U_j`, a shift outside its window, a shifted
matrix entry, perturbed trial vectors, a renamed problem — all `REJECT`; a blunt-but-consistent certificate
(brackets widened *and* bounds recomputed from the widened brackets) — `ACCEPT`.

Test 4 compares the **complete** certified output — bounds, verdict, and refusal reasons — not merely a verdict.

## 6. Implementation directive

**Do not optimise the first implementation.** Explicit rational arithmetic; transparent data structures; small
independently testable functions; deterministic output; no cache shared with the prover; no numerical
shortcuts. The one deliberate cost: cofactor determinants over LDLᵀ, precisely because they are division-free
and transparent at `J ≤ 4`. Optimisation may be considered only once a reference audit exists, and only if the
optimised version is itself audited against the reference.

## 7. What a successful R3 run does and does not establish

It establishes that an independently implemented certification machine, sharing no relevant code with the
prover, accepts the frozen Lehmann-step certificate: same matrices (blunter), same inertia structure (by a
different rule), same brackets (wider), and a claimed bound that survives an exact-arithmetic recheck against
its own bracket. **It does not establish the underlying theorem** — that is the statement document at
`r4b-statement-v1`, and §7 there draws the same line. And it does not audit the *lower* halves `L_j` beyond
`L_J`'s role in the shift window — the final two-sided enclosures are Rung 4's object.

---

*Nothing in this contract is a claim about the Navier–Stokes or De Gregorio equations.*
