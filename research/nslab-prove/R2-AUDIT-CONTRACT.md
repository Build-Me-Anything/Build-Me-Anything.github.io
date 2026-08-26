# Rung 2 audit contract — `A₂ = AᵀB⁻¹A` and its tail

**Status: FROZEN before implementation.** Any later change is an `AUDIT-LOG.md` event, not an implementation
convenience. Subordinate to the frozen mathematical statement at tag `r4b-statement-v1` (`0d7c663`).

**Authority order.** (1) frozen statement → (2) this contract → (3) `AUDIT-LOG.md` → (4) implementation →
(5) tests. Tests demonstrate compliance; they do not define the mathematics after the fact.

---

## 1. The object

    (A₂)_ij = Σ_{k≥1} A_ki A_kj / (k²π²) = S_ij(K) + R_ij(K),   S_ij(K) := Σ_{k≤K} A_ki A_kj/(k²π²)

and the auditor establishes, with **both** sources of uncertainty tracked separately,

    (A₂)_ij ∈ [ S̲_ij(K) + R̲_ij(K) ,  S̄_ij(K) + R̄_ij(K) ].

`S̲ ≤ S ≤ S̄` from outward-rounded certified arithmetic on the finite sum; `R̲ ≤ R ≤ R̄` from §3.

## 2. Independence contract

> The auditor shall not import, call, or depend upon the prover's moment-integral, tail, truncation-error, or
> interval-construction routines. Shared foundational mathematical constants may be independently reconstructed
> or cross-checked, but **no prover implementation responsible for establishing the R2 certificate may be an
> auditor dependency.**

**Forbidden:** `problem_dg_profile._log_moment_integrals`, `A_entry_abs_bound`, `A2_tail_bound`,
`A2_enclosure`, `A_entry_enclosure*`, `sici.*`, `ivutil.*`, `mpmath`.
**Permitted:** `fractions`, `json`, `math`; `auditor_r01.pi_interval` (π by Machin, an auditor's own
construction); `auditor_r4b`'s own `RI` and Gram entries, which are Rung 1 and already audited.

## 3. Exact tail mathematics — and it is **not** the prover's

The prover bounds the tail through the *asymptotics of the entries*: `|Ci(x)| ≤ 2/x`, then
`|A_km| ≤ (8m/3πk)(ln(k/m) + D_m)` for `k ≥ 2m`, then three `∫ln^p(x)/x⁴` moments. **The auditor uses none of
that.** Its route goes through the operator's own smoothing estimate.

**Lemma R2-T (majorant).** In the `s`-basis, `⟨s_n, s_m⟩_{L²([−1,1])} = δ_{nm}`, hence for `g = Σ c_k s_k`,

    ‖g‖²_{Ḣ¹} = Σ c_k²(kπ)²,        ‖g‖²_{Ḣ²} = Σ c_k²(kπ)⁴.

With `M s_i = Σ_k c_ki s_k` and `c_ki = A_ki/(kπ)²` (Lemma 2 of the statement),

    ‖M s_i‖²_{Ḣ²} = Σ_k c_ki²(kπ)⁴ = Σ_k A_ki².

HTW's compactness estimate **(H3)** — `‖M f‖_{Ḣ²([−1,1])} ≤ ‖f‖_{Ḣ¹}` — with `‖s_i‖²_{Ḣ¹} = (iπ)²` gives

    **Σ_{k≥1} A_ki² ≤ (iπ)².**                                                              (R2-T)

**Corollary R2-D (diagonal tail).** Since `1/(kπ)² ≤ 1/((K+1)π)²` for `k > K`,

    0 ≤ T_i(K) := Σ_{k>K} A_ki²/(kπ)² ≤ [ (iπ)² − Σ_{k≤K} A_ki² ] / ((K+1)π)².              (R2-D)

**Corollary R2-O (off-diagonal tail).** By Cauchy–Schwarz on the tail,

    | R_ij(K) | ≤ √( T_i(K) · T_j(K) ),        so   R̲_ij = −√(T_iT_j),  R̄_ij = +√(T_iT_j).   (R2-O)

### Why this satisfies the contract's convergence obligation *better* than the example it gives

The frozen contract offers a geometric majorant `M_k ≤ Cq^k` as its example. **That example does not apply here:**
the entries decay algebraically (`A_km ~ ln k / k`), so no geometric majorant exists. This is an instantiation of
the contract, not a change to it — but it is recorded because the example is inapplicable and silently
substituting a different one would be exactly the kind of drift the freeze exists to prevent.

The route above is in fact *stronger* than a decay estimate: convergence follows from (R2-T), a **finite analytic
bound**, so the contract's two obligations separate completely —

    convergence:  established by (R2-T), an imported hypothesis plus Parseval. No numerics involved.
    enclosure:    (R2-D)/(R2-O) evaluated in outward-rounded rational arithmetic.

`√` is enclosed by integer square roots rounded outward, never by a floating-point `sqrt`.

**Measured behaviour** (prover's values, for scale only — the auditor recomputes): `T_1(K)` falls
`7.2e-5 → 7.5e-6 → 6.4e-7` for `K = 40, 120, 400`, i.e. like `K⁻²`, and is 20–38× weaker than the prover's bound.
Blunter is expected and is the point.

## 4. Refusal conditions

`ACCEPT ⟺ finite contribution certified ∧ tail certified ∧ convergence certified ∧ all arithmetic certified`.
Anything else is `REFUSE`. There is no third state.

**The interval invariant, stated precisely.** Sign-indefiniteness is *not* itself a fault — `[−2, 3]` is a
perfectly good interval, and `A_km` genuinely changes sign. What triggers `REFUSE` is the inability to establish
the property required at that point:

> An interval is acceptable only when its endpoints are finite, ordered, correctly directed, and certified to
> enclose the quantity claimed. Any operation for which those conditions cannot be established causes `REFUSE`.

Concrete refusal triggers: a divisor interval straddling zero; a Leibniz remainder invoked before its hypothesis
holds; a first-omitted term above tolerance (sound but vacuous); `Σ_{k≤K} A_ki² > (iπ)²`, which would falsify
(R2-T) and means something upstream is wrong; a non-finite endpoint; endpoints out of order.

## 5. Test suite — five pillars, five distinct failure classes

| # | test | protects against |
|---|---|---|
| 1 | **Algebraic validation** — `AᵀB⁻¹A` against a case with a known closed form | incorrect construction |
| 2 | **Tail stress / refusal** — degenerate and inflated tails must `REFUSE` | unsound remainder certification |
| 3 | **Static dependency audit** — AST check for zero forbidden imports | accidental shared implementation |
| 4 | **Dynamic independence** — corrupt every prover artefact; output must be bit-identical | hidden runtime dependence |
| 5 | **AL-002 regression** — the ambient-precision arithmetic-contract failure | arithmetic-contract drift |

Test 4 compares the **complete** certified output — bounds, verdict, and refusal reasons — not merely the matrix.

## 6. Implementation directive

**Do not optimise the first implementation.** Explicit rational arithmetic; transparent data structures; small
independently testable functions; deterministic output; no cache shared with the prover; no numerical shortcuts.
Optimisation may be considered only once a reference certificate exists, and only if the optimised version is
itself audited against the reference.

---

## 7. What a successful R2 run does and does not establish

It establishes that an independently implemented certification machine, sharing no relevant code with the prover,
accepts the frozen certificate. **It does not establish the underlying theorem** — that is the statement document
at `r4b-statement-v1`, and §7 there draws the same line.

---

*Nothing in this contract is a claim about the Navier–Stokes or De Gregorio equations.*
