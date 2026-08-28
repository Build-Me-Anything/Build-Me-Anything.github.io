# Rung 4 audit contract — the assembled two-sided enclosures

**Status: FROZEN before implementation.** Any later change is an `AUDIT-LOG.md` event, not an implementation
convenience. Subordinate to the frozen mathematical statement at tag `r4b-statement-v1` (`0d7c663`) and sibling
to `R2-AUDIT-CONTRACT.md` and `R3-AUDIT-CONTRACT.md`, whose independence discipline it inherits.

**Authority order.** (1) frozen statement → (2) this contract → (3) `AUDIT-LOG.md` → (4) implementation →
(5) tests. Tests demonstrate compliance; they do not define the mathematics after the fact.

---

## 1. The object

The theorem's final table: the assembled two-sided enclosures

    λ_j ∈ [L_j, U_j],        j = 1, …, J,

with the lower halves from Courant–Fischer on nested trial prefixes (H12) and the upper halves from the
Lehmann step (§5). This is the **last** rung: Rungs 1–3 audited the ingredients — the Gram entries, `A₂` and
its tail, the pencil and its inertia counts — and this rung audits what is *assembled from* them. What is new
here is not machinery but **assembly**: the per-`j` lower halves (Rung 3 audited only `L_J`, in its shift-window
role), the pairing `τ_{J+1−j} ↔ λ_j` (an index slip here corrupts the final table while every earlier rung
still passes), and the claim that each pair `[L_j, U_j]` is ordered, supported by its own data, and consistent
with the auditor's independently certified two-sided enclosure.

**The certificate is self-contained.** It carries the claimed enclosures, the lower-half trial vectors
`V_lower` (exact rationals, the nested-prefix convention: `L_j` uses the first `j` vectors) with their `K_lower`,
and the complete pencil block of the Rung 3 certificate — shift, window, trial vectors, matrices, τ brackets.
The auditor re-derives everything from that data and its own primitives; it reads no other certificate and
trusts no cross-file identity.

## 2. Independence contract

> The auditor shall not import, call, or depend upon the prover's bracket-assembly, Gershgorin, pencil,
> inertia, bisection, matrix, tail, or interval-construction routines. Shared classical mathematics
> (Courant–Fischer, Gershgorin, Sylvester/Jacobi inertia theory) may be independently re-implemented, but
> **no prover implementation responsible for establishing the R4 certificate may be an auditor dependency.**

**Forbidden:** `problem_dg_profile.*` (in particular `certified_bracket`, `certified_upper_bounds`,
`lehmann_matrices`, `_gershgorin_min`, `_gershgorin_max`), `lehmann.*`, `sici.*`, `ivutil.*`, `mpmath`.
**Permitted:** `fractions`, `json`, `math`; `auditor_r01.pi_interval` (π by Machin); `auditor_r4b` (`RI`,
`A_entry`, `pi_ri`, `set_precision_for` — Rung 1, audited); `auditor_r4b_a2` (`sqrt_upper`, `Refusal` —
Rung 2, audited); `auditor_r4b_lehmann` (the pencil machinery: `build_matrices`, `certify_posdef`,
`inertia_below`, `bracket_tau`, `upper_bound_from_bracket`, `prepare` — Rung 3, audited). The audit ladder is
cumulative by construction: each rung stands on the audited rungs below it and on nothing else.

## 3. The auditor's own mathematics — what this rung adds

### (a) Per-`j` lower halves, from the certificate's own trial prefixes

For each `j = 1 … J` the auditor forms `G_A = V_jᵀ A V_j` and `G_B = V_jᵀ B V_j` from the **first `j` rows** of
`V_lower`, with its own Gram entries and its own π, and certifies

    λ_j ≥ λ_min(G_A)/λ_max(G_B) =: L_j^aud

by its own Gershgorin evaluation — every interval endpoint taken **against** the bound. Courant–Fischer makes
this a true lower bound for *any* trial prefix; the prefix quality affects only sharpness. This is the half of
the theorem that no earlier rung reached beyond `j = J`.

### (b) The support check: two Gershgorin readings, no tuned slack

The claimed `L_j` must be derivable from the certificate's **own** trial data. The auditor evaluates Gershgorin
a second time with every interval endpoint taken **in the claim's favour** — `hi` of each diagonal `G_A` entry,
the minimum magnitude of each off-diagonal, `lo`-favoured row sums for `G_B` — giving `L_j^gen`. Any sound
Gershgorin evaluation over valid enclosures of these entries lies at or below `L_j^gen`, so

    L_j (claimed)  >  L_j^gen        ⟹  the claim is unsupported by its own data ⟹ REJECT,

whatever the true spectrum does. No slack parameter appears anywhere: the two readings are the outward and
inward roundings of the same exact expression, and the gap between them is set by the entry widths alone.

### (c) Upper halves and the pairing, through the audited Rung 3 machinery

The auditor re-derives the pencil from the embedded block with `auditor_r4b_lehmann`'s primitives — own
matrices at its own `Ksum_aud`, `R ≻ 0` by Sylvester's criterion, own resolution-limited τ brackets — and forms
its own upper bounds `U_j^aud` through the pairing `τ_{J+1−j} ↔ λ_j` **computed independently at this rung**,
so an index slip in the prover's assembly and an index slip in the Rung 3 audit would have to coincide to
escape. The claimed `U_j` must additionally be ≥ the exact rational sup `−ρ − 1/b` over the certificate's own
τ bracket (Rung 3's support check, re-applied at the point of assembly).

### (d) The published envelope: H6 as an imported sanity bracket

Every enclosure — claimed and own — must sit inside HTW's a priori bracket

    (2/π²)·(1/(jπ))  ≤  λ_j  <  1/(jπ)                                            (H6)

evaluated with the auditor's own π. This is imported published mathematics used as a consistency envelope, not
as a source of bounds: a violation falsifies something upstream and is fatal, but no endpoint of the certified
enclosure is ever taken from it.

### Measured behaviour (calibration, recorded so nothing here is a tuned secret)

Throwaway prototype, before this implementation was trusted, at the frozen instance (`K = 8`, `J = 3`,
`K_lower = 16`, `Ksum_aud = 80`): the auditor's prefix-Gershgorin route reproduces the prover's lower halves to
all ten printed digits — `L_j^aud = 0.2895674364 / 0.1508500071 / 0.1021950658` against identical prover values
— which is expected (same classical inequality, different entries, different arithmetic) and is the check. The
claimed uppers are `0.2895978654 / 0.1509278593 / 0.1028374820`; every assembled pair is ordered and sits
strictly inside the H6 envelope (`[0.0645, 0.3183] / [0.0322, 0.1592] / [0.0215, 0.1061]`). Runtime is
dominated by the pencil re-derivation, ~2 min at `Ksum_aud = 80`; the lower halves cost ~1 s.

## 4. Refusal conditions

`ACCEPT ⟺ enclosures ordered ∧ lower halves certified ∧ support certified both sides ∧ pencil re-derivation
certified ∧ pairing consistent ∧ H6 envelope holds ∧ overlap everywhere`. Anything else is `REFUSE`/`REJECT`.
There is no third state, and any `Refusal` raised by the Rung 1–3 machinery propagates to `REJECT` here — the
assembly cannot be healthier than its parts.

Concrete refusal triggers: `L_j > U_j` in a claimed pair; a non-finite or malformed endpoint; a Gershgorin
lower bound not certified positive; a trial-vector shape inconsistent with the declared parameters; any
refusal condition of `R3-AUDIT-CONTRACT.md` §4 arising during the pencil re-derivation; an auditor bound that
collapses to vacuity (Rung 3's ceiling applies unchanged).

Fatal comparison outcomes (`REJECT`): a claimed `[L_j, U_j]` disjoint from the auditor's own
`[L_j^aud, U_j^aud]`; a claimed `L_j` above the generous reading `L_j^gen` of its own data; a claimed `U_j`
below the exact sup over its own τ bracket; a claimed or derived enclosure violating the H6 envelope.

## 5. Test suite — five pillars, five distinct failure classes

| # | test | protects against |
|---|---|---|
| 1 | **Algebraic validation** — the `j = 1` prefix with a single basis vector gives exactly `A₁₁/π²`; the pairing recovered exactly on the closed-form diagonal pencil | incorrect construction |
| 2 | **Refusal stress** — disordered pairs, unsupported halves, envelope violations must `REFUSE` | unsound certification |
| 3 | **Static dependency audit** — AST check for zero forbidden imports | accidental shared implementation |
| 4 | **Dynamic independence** — corrupt every prover routine; output must be bit-identical | hidden runtime dependence |
| 5 | **AL-002/AL-004 regression** — ambient precision must not move the output | arithmetic-contract drift |

Plus the tamper battery: `L_2` and `L_3` swapped (assembly corruption — the specific failure this rung
exists to catch); `L_3` inflated above the auditor's own `U_3`; `U_1` understated below the sup its own
bracket supports; a pair disordered; a trial vector perturbed; the problem renamed — all `REJECT`; a
blunt-but-consistent certificate (both halves widened outward) — `ACCEPT`.

Test 4 compares the **complete** certified output — bounds, verdict, and refusal reasons — not merely a verdict.

## 6. Implementation directive

**Do not optimise the first implementation.** Explicit rational arithmetic; transparent data structures; small
independently testable functions; deterministic output; no cache shared with the prover; no numerical
shortcuts. The pencil re-derivation deliberately re-runs the audited Rung 3 primitives rather than reading
Rung 3's conclusions out of a shared state — an audit of the assembly must re-derive the parts it assembles.
Optimisation may be considered only once a reference audit exists, and only if the optimised version is itself
audited against the reference.

## 7. What a successful R4 run does and does not establish

It establishes that an independently implemented certification machine, sharing no relevant code with the
prover, accepts the frozen final table — every lower half, every upper half, and the pairing between them —
and with it the audit ladder is **complete**: all four rungs independently re-derived under frozen contracts.

**It does not establish the underlying theorem.** That is the statement document at `r4b-statement-v1`, and §7
there draws the same line. An *independently audited certificate* is not an *independently proved theorem*.

Two standing rules survive the completion of the ladder and are restated here so finishing does not erode
them. **First:** the frozen statement does not change because the audit finished; any post-audit revision of
the displayed bounds is a deliberate, separately recorded act, never a side effect. **Second:** where the
auditor's own bounds come out sharper than the claim — as Rung 3's τ₁ already did — that is an audit finding
for `AUDIT-LOG.md`, not an invitation to strengthen the theorem in place. The audit's product is a verdict on
the claim as frozen.

---

*Nothing in this contract is a claim about the Navier–Stokes or De Gregorio equations.*
