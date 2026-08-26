# The CAP machinery — R0 to R4b, and Machine C

Working code for the rigorous-numerics line described in
[`../Certified Blow-Up — System Architecture.md`](../Certified%20Blow-Up%20—%20System%20Architecture.md). This is
**Machine B**, the Verifier: it takes a candidate and either closes a proof or refuses. It has no tolerance to
tune and no third answer.

```bash
cd research/nslab-prove/cap
python run-all.py          # all nine suites, 406 checks, ~7 minutes (R1b and the audit are most of it)
```

Requires `mpmath` only (already present with sympy). Pure Python, arbitrary precision, outward-rounding interval
arithmetic — slow, and deliberately so: at this scale a reader auditing every line is worth more than speed.

## What is here

| file | rung | what it does |
|---|---|---|
| `ivutil.py` | — | interval helpers: endpoints as plain floats, strict containment, intersection, interval matrices |
| `ell1.py` | — | the sequence space ℓ¹_ν: complex-interval Fourier sequences, convolution, Hilbert transform, derivative, **upper-bound** norms |
| `radiipoly.py` | — | the radii polynomial: three bounds in, a theorem or a refusal out |
| `krawczyk.py` | **R0** | the Krawczyk operator — certified existence *and uniqueness* of a zero in a box, plus interval-Newton sharpening |
| `clm.py` | **R1a** | CLM via the closed form: complete zero-set search, certified blow-up time |
| `problem_quadratic.py` | **R1b** | quadratic convolution equation with the exact Catalan solution — the only problem with Z₂ > 0 |
| `problem_clm_fourier.py` | **R1b** | CLM as a fixed point in ℓ¹_ν; certified lower bound on T |
| `problem_degregorio.py` | **R2** | De Gregorio steady state, Galerkin certificate, and where the single-space formulation stops |
| `problem_burgers.py` | **R3** | the derivative-loss cure by analytic preconditioning, and the measured point where it fails |
| `problem_eigen.py` | **R4** | certified eigenpairs of a **compact** operator — the route the literature actually uses, graded against exact eigenpairs |
| `problem_dg_profile.py` | **R4b** | the Huang–Tong–Wei De Gregorio profile operator, made concrete: exact identities, the published bracket, and an unrigorous Galerkin reproduction |
| `certificate.py` | contract | writes `certificate.json` with **exact rational** data, so the auditor recomputes rather than re-parses |
| `auditor.py` | **Machine C** | independent re-check of the radii-polynomial certificates (R1b), exact rationals |
| `auditor_r23.py` | **Machine C** | R2 and R3: exact rational **interval** arithmetic for the Krawczyk verdict, and the preconditioned Burgers bounds |
| `auditor_r01.py` | **Machine C** | R0 enclosures and R1a's completeness check, with its own π, sin and cos from series with proved remainders |
| `auditor_r4b.py` | **Machine C** | R4b Rung 1 — the Gram matrix in exact rationals: evaluates the **Cin** form, so it needs neither γ nor a logarithm, and takes π from Machin rather than mpmath |
| `auditor_r4b_a2.py` | **Machine C** | R4b Rung 2 — `A₂` and its tail via HTW's smoothing estimate `Σ A_ki² ≤ (iπ)²`, sharing **no step** with the prover's asymptotic route. Contract in `../R2-AUDIT-CONTRACT.md` |
| `auditor_r4b_lehmann.py` | **Machine C** | R4b Rung 3 — the Lehmann pencil: vector form of the (R2-T) tail (no `Ksum ≥ 2K` hypothesis), inertia by **Jacobi's division-free minor rule** rather than LDLᵀ pivots, `R ≻ 0` checked by Sylvester's criterion, the τ→bound step redone in exact rationals. Contract in `../R3-AUDIT-CONTRACT.md` |
| `auditor_r4.py` | **Machine C** | R4 eigenpairs: rebuilds the operator from the parameters and recomputes Y₀ exactly — forms no matrix and inverts nothing |
| `lehmann.py` | **R4b** | Lehmann-Maehly upper bounds by Sylvester inertia counting - no eigensolver, and it refuses when a pivot cannot be signed |
| `sici.py` | **R4b** | rigorous enclosures of Si and Ci by convergent series with a **proved** Leibniz remainder; refuses where the hypothesis is unmet |
| `emit_certs.py` | contract | runs the provers and writes their certificates into `certs/` |
| `run-all.py` | | one command, nine suites, and it fails loudly — the `build.js --verify` of this line |
| `test_r0/r1/r1b/r2/r3/r4/r4b/audit/candidate.py` | | 11 / 25 / 22 / 18 / 17 / 18 / 143 / 123 / 29 checks — **406** in total |

## Status

| rung | target | status |
|---|---|---|
| **R0** | certified root enclosure | **ALL PASS** — √2 enclosed to half-width 3.4e-41 |
| **R1a** | CLM blow-up time, closed form | **ALL PASS** — T = 2 enclosed to width 4.6e-41 |
| **R1b** | radii polynomials in ℓ¹_ν | **ALL PASS** — certified **T ≥ 2**, sharp; enclosure radius within 0.0001 % of the true distance |
| **R2** | De Gregorio steady state | **ALL PASS** for the Galerkin truncation; the PDE statement is not claimed, see below |
| **R3** | the derivative-loss cure | **ALL PASS** — preconditioned Burgers certified against the exact u = sin x, and the failure boundary measured. **Sound, and aimed at the wrong door** |
| **R4** | compact-operator eigenpairs | **ALL PASS** — certified against `λ = 1 + ρ` and `λ = (13 ± √73)/8`; a merely *bounded* operator is refused |
| **R4b** | the De Gregorio profile operator | **ALL PASS** — the matrix entries are **closed forms in Si and Ci**, and the suite carries the line's headline: a **certified two-sided enclosure** of λ₁…λ₃ (Courant–Fischer below, Lehmann above), e.g. λ₁ ∈ [0.2895674, 0.2895979]. A statement about the **spectrum of M**, never about a profile or a PDE |
| **Machine C** | independent audit | **ALL PASS** — audits certificates across R0/R1a/R1b/R2/R3/**R4** and R4b's Gram matrix, `A₂` and **Lehmann pencil**; rejects every tampered one; agrees with the prover to **6.4e-23** (quadratic) and 3.4e-21 (CLM); at the pencil its τ₁ bracket came out **sharper** than the prover's (AL-010) |
| R5 | 2D Boussinesq / axisymmetric Euler | out of reach alone, and §R3 now says *why* with a number |

**The gap that remains:** Machine C now climbs three of R4b's four audit rungs — the **Gram matrix**
(`auditor_r4b.py`), **`A₂` and its tail** (`auditor_r4b_a2.py`, contract `../R2-AUDIT-CONTRACT.md`), and the
**Lehmann pencil** (`auditor_r4b_lehmann.py`, contract `../R3-AUDIT-CONTRACT.md`). What it does **not** yet reach
is Rung 4: the final two-sided enclosures `λ_j ∈ [L_j, U_j]` as assembled objects — the Courant–Fischer lower
halves are audited only in `L_J`'s role inside the Lehmann shift window. Until Rung 4 closes, the *assembled*
table in the statement document still rests on a single implementation, and that is the correct description of
its status rather than a defect to hide.

**What that gap now costs has fallen sharply.** The R4b matrix entries were an improper oscillatory integral
evaluated by quadrature. They have a **closed form** in Si and Ci (below), `sici.py` encloses those
**rigorously**, and `certified_bracket` turns them into a genuine two-sided bracket on λ₁…λ₆ — for example
`λ₁ ∈ [0.2895674, 0.3183099)`, whose lower end beats the published lower bound by ×1.43.

**The two halves of that bracket are not the same kind of thing, and the difference is the whole point.** The
lower half is ours and needs **no truncation estimate at all**: Courant–Fischer says any j-dimensional trial
subspace of V bounds λ_j from below, so certified entries plus Gershgorin deliver it — that is exactly why
Rayleigh–Ritz converges from below. The upper half of *that* bracket is **Corollary 3.7 of the source, used as a
citation** — and the **Lehmann–Maehly** route to a self-derived upper bound (which consumes exactly the a priori
separation Corollary 3.7 provides, as an input rather than as the answer) is now implemented in `lehmann.py` and
`certified_upper_bounds`, giving the far tighter enclosures in the frozen statement document — for example
`λ₁ ∈ [0.2895674, 0.2895979]`. See the statement document and `../AUDIT-LOG.md` for what is and is not audited.

## What R1b establishes, and why it is the one that matters

R1a uses CLM's closed-form solution — legitimate, but it uses the answer as the method and none of it transfers.
R1b redoes R1 the way R2 and R3 would have to be done, and it is graded twice over:

* On the **quadratic** problem, whose solution is the Catalan sequence exactly, the certified radius is within
  **0.0001 %** of the true distance ‖exact − ā‖. The bound is not merely sound, it is essentially sharp.
* On **CLM**, the tail estimate yields Z₁ = (t/2)·ν, so the contraction closes exactly when t < 2/ν. At ν = 1 that
  certifies **T ≥ 2**, and the exact answer is T = 2 — the threshold coincides with the true radius of
  convergence. Two independent routes (R1a's supremum, R1b's contraction) agree on T.
* With ν > 1 the same certificate states that ω(·,t) is **analytic in a strip of half-width log ν**. The weight is
  a result, not bookkeeping.

**Failure to close for t > 2/ν proves nothing.** Only existence, and hence a lower bound on T, is established.

## Where R2 stops — a real obstruction, and a prognosis that was wrong

The De Gregorio residual of the exact steady state ω = A·sin x is **identically zero** in interval arithmetic, so
the Fourier / Hilbert / derivative / product pipeline is verified end to end against a known answer. The Galerkin
truncation carries a rigorous Krawczyk certificate. But the **PDE** statement does not follow, and more modes will
not fix it:

F contains the transport term u·ω_x, and ‖D a‖_ν = Σ|m||a_m|ν^{|m|} is not bounded by ‖a‖_ν — multiplication by m
is unbounded on ℓ¹_ν for every ν. So F maps a stronger space into a weaker one, losing a derivative, and the
single-space radii-polynomial argument used at R1b does not apply.

**That diagnosis is confirmed. The prognosis this file used to give was refuted.** Earlier drafts said the fix is
a two-space Newton–Kantorovich with an approximate inverse that *gains* the derivative the transport term loses.
The `oracle-hunter` run recorded in [`../LITERATURE-CHECK.md`](../LITERATURE-CHECK.md) established that **no
published proof in this family does that.** The routes actually used are:

* **dynamic rescaling with weighted energy estimates**, where the transport term is never inverted — it is
  integrated by parts and absorbed; and
* **reformulation of the profile equation as a compact-operator eigenproblem** (Huang, Tong & Wei, CMP 2023,
  arXiv:2209.08232) — which lives in a *single* space and needs no derivative-gaining machinery at all. That is
  **R4**, and it is built.

And the sharpest correction: Chen, Hou & Huang proved finite-time blow-up for De Gregorio **on the real line**,
from smooth compactly supported data, by computer-assisted interval arithmetic, in 2019. Derivative loss did not
stop them, because they did not stand where R2 stands.

**Never write "De Gregorio blow-up" without the domain.** The status is domain-dependent: proved on ℝ from smooth
data; **open and conjectured globally regular on the circle** for the smooth data in question; proved on the
circle only from C^α data. R2 is posed on the circle.

R2 therefore reports what it can prove — the Galerkin truncation has exactly this one solution in this box — and
locates its own obstruction precisely. What it no longer does is claim to know the way around it.

## R3 — the cure for derivative loss, and the measured reason it does not reach Euler

R2's obstruction is that the transport term loses a derivative while multiplication by m is unbounded on
ℓ¹_ν. The standard cure is **analytic preconditioning**: find a leading operator L whose inverse gains more
derivatives than the nonlinearity loses, and solve the fixed point of L⁻¹ applied to the rest.

R3 implements that cure on the smallest problem that genuinely needs it — steady viscous Burgers,
`u·u_x = μ·u_xx + f`, whose nonlinearity loses exactly one derivative — with the forcing chosen so that
**u = sin x is the exact solution**. With `L = μ∂_xx`, the operator

    K = L⁻¹ ∘ ∂_x,   symbol −i/(μ·m),   |symbol| ≤ 1/μ

is **bounded**, the derivative is absorbed, and every bound from R1b applies unchanged. The certificate closes and
its ball contains sin x.

**Then the interesting part.** The tail bound is `‖ū‖/(μ·(|n|−N))`, so:

| n | Burgers bound | De Gregorio bound |
|---|---|---|
| 9 | 0.500 | 9 |
| 16 | 0.0625 | 16 |
| 32 | 0.0208 | 32 |
| 64 | 0.00893 | 64 |

Z₁ is a **supremum over columns**. A decaying sequence has one; a growing sequence does not. And sweeping μ
downward toward the inviscid limit, the verifier refuses exactly when it should:

    mu=4.0 closes (Z1=0.255)   mu=2.0 closes (0.51)   mu=1.5 closes (0.68)
    mu=1.0 REFUSED (1.02)      mu=0.5 REFUSED (2.04)  mu=0.25 REFUSED (4.08)

Z₁ = ‖ū‖/μ crosses 1 at μ = 1 and nothing closes below it. **Euler and De Gregorio sit at μ = 0.** The obstruction
is therefore not a tuning problem, a precision problem or a coding problem: there is no dissipative operator to
invert, and the method has no purchase at all. That is why Chen and Hou needed a bespoke framework and years of
analysis for Euler with boundary, and it is why R3 proper is not reachable by extending this file.

Stating it with a number beats asserting it in prose, which is what the earlier drafts did.

## R4 — the compact-operator route, and why it is numbered after the rung that worked

R3 succeeded and was still the wrong door. The literature check found that profile equations in this family are
not handled by inverting the transport term but by **reformulating so the loss disappears** — Huang, Tong & Wei
obtain De Gregorio self-similar profiles as eigenfunctions of a compact self-adjoint operator. A compact-operator
eigenproblem is exactly what a radii-polynomial argument handles **in one space**.

An eigenvector is defined only up to scale, so `T v = λ v` alone has a one-parameter family of solutions and a
singular linearisation along it — the same degeneracy that forced a phase condition at R2. Appending a
normalisation makes it square:

    F(v, λ) = ( T v − λ v ,  ⟨v, w⟩ − 1 ),    unknowns (v, λ) ∈ ℓ¹_ν × ℝ

The second derivative is *constant*, so in the product norm `Z₂ = ‖A‖` falls out with no problem-specific work.

**The tail estimate is the whole point.** Take `A` to be the exact inverse of the finite block on `|m| ≤ N` and
`−1/λ̄` times the identity outside it. With `τ(n) := ‖T e_n‖_ν / ν^{|n|}` the tail column collapses to

    Z₁ tail ≤ ( ‖A_fin‖ + 1/|λ̄| ) · sup_{|n|>N} τ(n)

and `τ(n) → 0` **is** compactness. So the suite's discriminating test is not that the certificate closes — it is
that a merely **bounded** operator, identical in every other respect, **fails**. Measured side by side:

| N | compact `T`: Z₁ | τ, and `1/(N+1)²` | bounded-not-compact `T`: Z₁ |
|---|---|---|---|
| 8 | 0.035993 | 0.0123457 = 0.0123457 | **6.026** (τ stays at 1.0) |
| 16 | 0.01015 | 0.00346021 = 0.00346021 | **6.129** (τ stays at 1.0) |
| 24 | — | — | **6.131** (τ stays at 1.0) |

The compact case's tail matches `1/(N+1)²` to the printed digits and `Z₁` falls with `N`; the bounded case's `Z₁`
does not move at all, because refining a truncation cannot make a non-decaying tail decay. A test that only ever
passes would not have told us which property was doing the work.

Graded against two exactly known eigenpairs, both closed forms rather than reference numbers:

* `T = D + u⟨·, e₁⟩` with `d_m = 1/m²`, `u_m = ρ^m` → **λ = 1 + ρ exactly**, eigenvector
  `v_m = ρ^m/(1 + ρ − 1/m²)`. Infinitely supported with geometric decay, so the tail bound is genuinely
  exercised, and `‖v‖_ν < ∞` iff `ρν < 1`.
* `u = w = e₁ + e₂` → the secular equation `λ² − (13/4)λ + 3/2 = 0`, so **λ = (13 ± √73)/8, exactly algebraic**,
  with a finitely supported eigenvector.

And the refusals, each for a *stated* reason rather than a failed assertion: a phase vector `w` that may be
orthogonal to `v̄` (the finite block is singular); a badly perturbed eigenvector, where the discriminant
`(1 − Z₁)² − 4·Z₂·Y₀ = −65.6` shows the residual is simply too large; and `ν` past the radius of convergence,
where `ρν = 1.2 ≥ 1` so the exact eigenvector has infinite norm and no certificate about it could be true.

## R4b — the De Gregorio profile operator, made concrete and deliberately not certified

**Domain: the real line.** The relevant blowup is *expanding* (`c_l < 0`), which the source calls clearly
incompatible with the periodic setting. On `V := { f odd, f ∈ H¹₀([−1,1]) }` with the plain `Ḣ¹` inner product:

    M(f) := χ_{[−1,1]} ( (−Δ)^{−1/2} f − c(f)·x ),    c(f) := (−Δ)^{−1/2} f (1)

The `−c(f)x` term is exactly what makes `M(f)(1) = 0`, so `M` maps `V` into itself. It is self-adjoint and
positive semi-definite, satisfies `⟨f, M(g)⟩_{Ḣ¹} = ⟨f, g⟩_{Ḣ^{1/2}(ℝ)}`, and is **compact** because
`‖M(f)‖_{Ḣ²([−1,1])} ≤ ‖f‖_{Ḣ¹}` with `Ḣ² ↪ Ḣ¹` compact on a bounded interval. That compactness is the entire
reason this route works where R3's preconditioning could not.

**The eigenvalue is not the blow-up rate.** `λ` is a rescaling-invariant shape label; the rate is `c_ω = c(f)`, a
separate functional. Since `M` is linear, `λ` is unchanged under `f ↦ αf` while `c(f) ↦ α c(f)`.

Four things in the source are exactly known, and are therefore what this module grades against:

1. a **comparison operator with closed-form spectrum** — `λ̃_n = 1/(nπ)`, `f̃_n = χ sin(nπx)/(nπ)`, in the same
   space with the same inner product, so the R4 machinery certifies its eigenpairs directly;
2. a **rigorous two-sided bracket**, `(2/π²)·λ̃_n ≤ λ_n < λ̃_n`, used here as an acceptance gate — the upper bound
   is strict;
3. an **exact operator identity** — Castro's `Ω₀(x) = −χ x/√(1−x²)` has `M(Ω₀) = 0`, because
   `(−Δ)^{−1/2}Ω₀ = −x` on `[−1,1]` and `c(Ω₀) = −1`. `Ω₀ ∉ V` (too little regularity, which is why the paper
   calls it illegal), but it grades an implementation of `(−Δ)^{−1/2}` and `c(·)` perfectly;
4. **six published eigenvalues**, λ₁…λ₆ = 0.2896, 0.1509, 0.1022, 0.0773, 0.0622, 0.0520.

**What the source does not contain, and is therefore not claimed here:** no closed form for any `λ_n`, no
numerical value of `c_ω`, no profile point values, **no Fourier or Chebyshev matrix representation**, and **no
interval arithmetic or CAP content whatsoever** — their proof is analytic. The sine-basis Galerkin discretisation
here is *ours*.

**The matrix entries have a closed form, and finding it corrected the quadrature it replaced.** From
`ŝ_n(ξ) = 2i(−1)ⁿ nπ sin ξ/(n²π²−ξ²)`, the entry is `4π(−1)^{n+m} nm · I(n,m)` with `I` an improper oscillatory
integral. Partial fractions plus the fact that `a = nπ` makes `cos(2(u ∓ a)) = cos 2u` collapses the two divergent
pieces onto the *same* integral, so they cancel and leave something finite:

    A_{nn} = 2n·Si(2nπ)
    A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ ln(m/n) − Ci(2mπ) + Ci(2nπ) ]      (n ≠ m)

The quadrature these replace truncated the tail at `(4·max(n,m)+5)π`, and that tail is `~1/(4Ξ²)`, so every entry
carried a **relative error of order 1e-4** — the same order as the 2e-4 tolerance the published-eigenvalue check
was using. The grading test is that extending the truncation walks the quadrature *onto* the closed form:
1.1e-4 → 1.5e-5 → 1.5e-6 at n=1, m=2 as the breaks go 13 → 120 → 600. Both routes are kept, because two
implementations sharing no derivation is what established which one was wrong.

With exact entries, at K = 8:

| n | ours (K = 8) | published | difference |
|---|---|---|---|
| 1 | 0.2895376 | 0.2896 | 6.2e-5 |
| 2 | 0.15080864 | 0.1509 | 9.1e-5 |
| 3 | 0.10214551 | 0.1022 | 5.5e-5 |
| 4 | 0.077248866 | 0.0773 | 5.1e-5 |
| 5 | 0.062107676 | 0.0622 | 9.2e-5 |
| 6 | 0.051917606 | 0.0520 | 8.2e-5 |

Every value also passes the Corollary 3.7 bracket, and K = 4 lies below K = 8 which lies below the upper bracket —
monotone from below, as a projected supremum must be.

And the check that only became available once the entries were exact: at **K = 24 every one of the six lies inside
the rounding interval of the published four-figure value** — 0.2896 means [0.28955, 0.28965], and ours is
0.2895723. That is a far stronger statement than agreeing to 2e-4, and it is the one that would catch a
transcription error the loose tolerance would not. (K = 16 clears the tightest interval by only 7e-9; K = 24 by
6.9e-6, which is why the suite uses 24.) All of which remains a check on the **transcription**, not a certificate. The suite additionally requires the bracket to *reject* `λ̃_n` itself, because its upper bound is
strict — a theorem, not a convenience, and a gate that accepted the endpoint would be a weaker gate for no reason.

**The honest state of the certified step.** Certifying `λf = M(f)` needs exactly two things: rigorous enclosures
of `A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}`, which are improper integrals currently computed by ordinary quadrature,
and a proven bound on their tail. Neither exists yet; the machinery that would consume both is built and graded at
R4. The suite prints this scope statement itself on every run, so the limitation cannot be lost by someone reading
the output instead of the file.

## Machine C — the auditor, and why it is the most valuable thing here

Every suite above shares an author *and an implementation* with the code it tests, so a shared misconception
passes silently through both. That is not a hypothetical: this project has already shipped a norm that rounded to
nearest while being used as an upper bound, and every certificate would still have printed CLOSED.

`auditor.py` imports **`fractions`, `json` and `math`. Nothing else** — a structural test asserts it. It
re-derives Y₀, Z₁ and Z₂ from the problem definition and ā alone, in **exact rational arithmetic**, using a
different data structure (sparse dict versus dense array) and a separately written convolution. It cannot have a
rounding bug, because it does no rounding.

It checks three things, and only rejects in one direction:

1. **the claimed bounds are not under-estimates** — a bound larger than necessary is blunt, a bound smaller than
   the truth is fatal, and only the second is refused;
2. **p(r) < 0 at the claimed radius**, in exact arithmetic;
3. **Z₁ < 1**.

### R2 and R3 are audited too, and R2 needed a different instrument

R2 is not a radii polynomial. It is a **Krawczyk verdict** — *K(X) lies strictly inside X* — so re-checking it
means recomputing an interval operator, not evaluating a polynomial. `auditor_r23.py` therefore carries a small
**exact rational interval arithmetic**: endpoints are `Fraction`s and every operation is exact, so unlike the
prover there is no outward rounding at all.

Two things make that audit genuinely independent rather than a re-run:

* **The certificate carries no preconditioner.** A Krawczyk verdict is a statement about the box, and *any* valid
  Y establishes it — Y affects whether the test closes, never whether its conclusion is true. So the auditor
  builds its own by exact rational Gauss–Jordan. Confirming the same containment with a different Y is a
  materially stronger check than re-running the prover's.
* **The De Gregorio residual is re-derived from scratch** in real sine-coefficient form,
  `F_n = -½ Σ b_j b_k (1 - k/j)([j+k=n] + [j-k=n] - [k-j=n])`, rather than through the prover's complex-Fourier
  convolution. A shared algebra slip would otherwise pass through both.

The R2 tamper cases: box widened 1000× until K(X) escapes, box moved off the solution, box given the wrong
dimension, and N made even — the last with a correctly sized box, so the rejection comes from the genuinely
singular Jacobian and not from a size check. (An earlier version of that test left the box at its N=7 length and
was caught by the dimension check instead: a pass for the wrong reason, which is a failed test wearing a passing
one's clothes.)

R3's tamper set adds one the others cannot have: **μ reduced toward the inviscid limit**. The auditor recomputes
the tail bound `‖ū‖/μ`, finds the certificate's Z₁ now below it, and rejects — the failure boundary of §R3
showing up as an audit failure rather than as a claim.

### R4 is audited without forming a matrix — and the audit caught a real defect on its first run

The prover reaches Y₀ by building `DF(v̄, λ̄)` as an (N+1)² matrix, inverting it numerically, and pushing the
residual through interval arithmetic. `auditor_r4.py` reproduces none of that: it **forms no matrix and inverts
nothing.** It rebuilds the operator from the certificate's parameters, computes the residual of the certificate's
own ā in exact rationals, and uses the one part of A that is known in closed form — `−1/λ̄` times the identity
above mode N — to reach Y₀ directly.

Two choices in `emit_certs.emit_eigen` are what make that possible, and both are load-bearing:

* **A dyadic instance, not the geometric one.** The R4 suite's headline problem has `v_m = ρ^m/(λ̄ − 1/m²)`, whose
  denominator carries `11m² − 8` and is therefore not a power of two — mpf rounds every entry, the residual is
  ~1e-45 instead of 0, and an exact-rational auditor could never tell a real disagreement from a rounding
  artefact. So `problem_eigen.dyadic_instance` builds the problem the other way round: fix `v_m = 2^−m` and
  `d_m = 4^−m`, then *define* `u_m := v_m(λ̄ − d_m)`. The eigen relation then holds identically for any λ̄, and
  every number in sight is dyadic. Same move as μ = 1/8 keeping the Catalan coefficients dyadic at R1b.
* **The perturbation sits above N.** A is the exact inverse of the finite block below N and `−1/λ̄·I` above it, so
  a residual confined above N is mapped by the closed-form half. Perturb below N and only the prover could ever
  check its own Y₀.

**What it caught.** On its first run against a genuine certificate the auditor returned REJECT: Y₀ understated by
a relative **1.7e-17**. That is 28 orders of magnitude above the prover's own roundoff at 45 digits, so it was not
noise. The cause was in the emitter: the perturbation constant was written as the decimal string
`'1.4901161193847656e-08'`, meaning 2⁻²⁶ — and that string is 2⁻²⁶ **truncated at 17 digits**. The prover
perturbed by one number while the certificate recorded another, so every bound described a slightly different ā
than an auditor would read. `prove_dyadic` now takes the *exponent* rather than a decimal string, which removes
the possibility instead of documenting it.

This is exactly the failure `emit_certs.py`'s own docstring warns about for μ = 1/10, committed anyway, in a file
that warns about it — and caught within seconds by the first instrument with no shared implementation. It is the
best argument for Machine C the project has produced, because unlike the tamper cases nobody planted it.

Its tamper set is thirteen: Y₀ halved; Z₂ zeroed; Z₂ a hair below `1/λ̄`; Z₁ pushed above 1; Z₁ below the tail
contribution compactness alone forces; r shrunk until p(r) ≥ 0; ā altered **above** N so the residual and Y₀ move;
ā altered **below** N so the residual escapes the tail and Y₀ stops being auditable at all; the phase condition
broken; ν raised past the eigenvector's radius of convergence; the problem renamed; ā truncated so it disagrees
with M; and Y₀ doubled. That last one is instructive: doubling is *blunt*, which the auditor does not mind, but it
also pushes p(r) above zero, so the certificate stops closing at the radius it quotes. Bluntness is free only
while the polynomial survives it, and the suite asserts both directions so the asymmetry cannot be read as
leniency.

### R0 and R1a are audited by a third instrument, which had to build its own transcendentals

`auditor_r01.py` re-checks the root enclosures and — the one that matters — R1a's **completeness** claim, that the
quoted zero set of ω₀ is the whole of it. A blow-up time computed from an incomplete zero set is too *large*,
which is the dangerous direction and invisible afterwards.

Two design points make it independent rather than a re-run:

* **It never constructs the irrational.** Confirming `√2 ∈ [a, b]` in exact rationals is `a² ≤ 2 ≤ b²`, with no
  root extraction anywhere — so the auditor cannot inherit the prover's root-finding at all.
* **It proves completeness by different arguments** — monotone collars plus range enclosure over the remaining
  regions, where the prover used Krawczyk. Its π, sin and cos come from series with **proved remainders**, so
  even the transcendentals are its own; the suite checks its π against the classical `333/106 < π < 355/113` and
  `cos² + sin² = 1` in exact interval arithmetic.

Its tamper set is the sharpest of the three, because dropping evidence is subtler than corrupting it: one zero
dropped from the list, *all* zeros dropped, an enclosure moved off its root, T falsified outright, and ω₀ quietly
changed to `sin x` so that the quoted zeros are no longer its zeros. All five rejected, each with a stated reason
rather than a failed assertion — "could not prove ω is non-zero on 1 region(s) outside the claimed zeros".

Most of its suite is tampering, because an auditor that accepts everything is worse than none — it converts an
unchecked claim into an apparently checked one. Y₀ halved, Z₁ halved, Z₁ pushed above 1, Z₂ zeroed, r shrunk until
the polynomial is positive, the problem renamed, and — the one that proves it recomputes rather than re-reads — a
single coefficient of ā altered. **All eleven are rejected** — and across the four auditors, **all 44** tampered
certificates are (11 at R1b, 4 at R2, 6 at R3, 5 at R0, 5 at R1a, 13 at R4).

And the number worth keeping: on Y₀ the two implementations, one in interval floating point and one in exact
rationals, sharing no code, agree to **6.4e-23** (quadratic) and **3.4e-21** (CLM) relative.

**And it caught nothing.** That is worth stating plainly, because it is the only honest summary: the auditor has
never rejected a genuine certificate from this project. That result means something only because 31 tampered ones
are rejected — an auditor that accepts everything converts an unchecked claim into an apparently checked one,
which is worse than no auditor at all.

Parameters are chosen exactly representable in both binary and rational form — mu = 1/8, nu = 3/2, q = 1/2 — so
a disagreement can never be a formatting artefact. With mu = 1/10 the prover's `mpf('0.1')` is the nearest double
rather than one tenth, and the two would differ at 1e-40 for no interesting reason.

## The four failures worth keeping

Every suite is built so that a large share of its checks demand a **refusal**. That is where the defects turned up
— the first three of them. The fourth could not have been caught by any refusal, which is the point of it.

**1. The dyadic-boundary trap (R1).** Bisecting `[0, 2π]` puts box boundaries at `2π·k/2^d`. The zeros of
`cos x` are at `π/2` and `3π/2` — exactly `2π/4` and `3·2π/4`. A zero on a shared boundary lies on the *endpoint*
of both neighbouring boxes, so `K(X)` can never be strictly inside `X` (uniqueness fails) and the box is never
provably empty either. Bisection cannot escape it at any depth.

The search behaved correctly: it spent its whole budget and then reported that it could **not** prove the zero set
complete, rather than returning the two zeros it had nearly found. Had it returned a partial list, the supremum
would have been silently too small and the blow-up time too large — an error in the dangerous direction, and
invisible afterwards.

What makes this worth recording is *which* case broke. The clean one with the exact answer (`ω₀ = cos x`,
`T = 2`) failed; the untidy one with non-dyadic roots passed. A suite of only realistic-looking cases would have
shipped the bug. Fixed by splitting at the golden-ratio conjugate instead of the midpoint.

**2. Norms were not upper bounds (R1b).** The ℓ¹_ν norm accumulated in ordinary `mpf`, which rounds to nearest —
so a quantity used as an *upper* bound could land a fraction below the truth. Every bound feeding the radii
polynomial must be an upper bound or the certificate is worthless, and nothing downstream would have noticed:
every certificate would still have printed CLOSED. It was caught by `banach_algebra_witness`, because for
all-positive coefficients ‖a*b‖ = ‖a‖‖b‖ holds *exactly* and the two sides disagreed in the last bits. Norms now
accumulate in interval arithmetic and return the upper endpoint.

**3. A singular preconditioner is a failure of the test, not an error.** The first version raised an exception
when the midpoint Jacobian was singular. But a double root and a badly centred box both land there, and the honest
answer to both is INCONCLUSIVE — a statement about the test, never about the function. Raising threw away the only
correct answer available.

**4. R3 was correct, graded, audited — and pointed at a door nobody uses.** Every check passed, the certificate
closed against an exact solution, the failure boundary at μ = 0 was measured rather than asserted, and the whole
rung answered a question the literature does not ask. The claim that derivative loss is cured by a two-space
derivative-gaining inverse was **refuted** by the first `oracle-hunter` run; the real routes are weighted energy
estimates or the compact-operator reformulation of R4, and Chen–Hou–Huang had already proved De Gregorio blow-up
on ℝ with interval arithmetic in 2019.

This is the failure with no internal defence. Suites catch arithmetic that is wrong; nothing inside `cap/` could
have caught arithmetic that is right about the wrong thing. Every check here shares an author with the code it
tests, and a shared misconception about the *field* passes through all of them silently — the same argument that
justifies Machine C, one level up. Hence the fleet, and hence the rule that an agent emits an artefact that can
fail — a citation, a counterexample, code — and never a verdict.

## Design rules, inherited from the architecture document

- **`Verdict` is not a boolean.** A verifier usable as a truthy value invites `if verify(...)`, which silently
  treats INCONCLUSIVE as "no zero". It is not the same thing.
- **A bad preconditioner can waste time; it can never produce a false theorem.** Test 7 of the R0 suite feeds a
  deliberately terrible `Y` and requires the enclosure to stay sound. This is the property that lets Machine A be
  fast and unrigorous.
- **Shrinking a box on failure is allowed. Loosening the acceptance condition is not.** The frozen contract.
- **Completeness failures return no answer**, not an answer with a caveat.

## What these certificates do and do not establish

A closed R1 certificate says: *for this initial datum, the CLM equation blows up at a time inside this enclosure*
(R1a), or *the solution exists at this time and is analytic in this strip, so T is at least this large* (R1b). An
R2 certificate says: *the Galerkin truncation has exactly this one solution in this box.* An R3 certificate says:
*the preconditioned Burgers fixed point has a solution within this radius of the computed one.* An R4 certificate
says: *this compact operator has an eigenpair within this radius of the computed pair, and it is the only one in
that ball.*

**R4b says nothing at all in this sense, by construction.** It establishes that the operator is transcribed
correctly and that our discretisation reproduces the published spectrum. Those are checks on us, not theorems
about De Gregorio.

None of them says anything whatever about Navier–Stokes, or about Euler. CLM and De Gregorio are one-dimensional
models, chosen because they have answers to grade the machinery against — the same role Taylor–Green Re 1600 plays
for the DNS instrument. A certificate about CLM is a certificate about CLM.

And one more limit, learned the hard way at R3: **a certificate cannot vouch for its own relevance.** Soundness is
machine-checkable; whether the theorem is the one the problem needs is not, and only an external check against the
literature caught it. That is what the agent fleet in [`../agents/`](../agents/) is for.
