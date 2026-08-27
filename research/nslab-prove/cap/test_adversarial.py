"""Stage 7 — adversarial theorem tests: the hypothesis-removal matrix.

The 433-check ladder attacks implementation integrity. This suite attacks the MATHEMATICAL ASSUMPTIONS:
remove or falsify exactly one hypothesis of the frozen statement at a time, and require the certification
architecture to REFUSE. The desired property, per the roadmap:

    invalid mathematical premise  =>  REFUSE

Rows overlap deliberately with tamper cases elsewhere in the ladder; the difference is the framing — each
check here names the HYPOTHESIS it falsifies, so the matrix demonstrates that the architecture enforces the
mathematics it claims to enforce, not merely that it notices corrupted files. Positive controls (valid
premise => ACCEPT) bracket the matrix so a suite that refuses everything cannot pass either.

Run:  python test_adversarial.py
"""
import json
import os
import sys
from fractions import Fraction

import auditor_r4b as R1
import auditor_r4b_a2 as R2
import auditor_r4b_lehmann as R3L
import auditor_r4b_final as R4
from auditor_r4b import ACCEPT, REJECT

HERE = os.path.dirname(os.path.abspath(__file__))
CERTS = os.path.join(HERE, 'certs')
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


def load(which):
    with open(os.path.join(CERTS, 'certificate-%s.json' % which), encoding='utf-8') as f:
        return json.load(f)


def refuses(fn):
    try:
        fn()
    except (R2.Refusal, ValueError):
        return True
    return False


print('\n[1] POSITIVE CONTROLS — every hypothesis intact must give ACCEPT')
v1, _ = R1.audit_doc(load('r4b-gram'))
check('valid premises, Rung 1 (Gram): ACCEPT', v1 == ACCEPT)
v4, _ = R4.audit_doc(load('r4b-final'))
check('valid premises, Rung 4 (assembled enclosures): ACCEPT', v4 == ACCEPT)

print('\n[2] HYPOTHESIS (H3) — the smoothing estimate sum_k A_ki^2 <= (i pi)^2')
# Falsify the imported inequality itself: hand the tail machinery a partial sum EXCEEDING the (R3-T)
# majorant. Clamping it to zero would silently convert a falsified hypothesis into a valid bound.
check('partial sums exceeding the H3 majorant REFUSE (never clamped)',
      refuses(lambda: R3L.vector_tail_from_parts(R3L.RI(1), R3L.RI(2), 40)),
      'the tail bound is derived FROM (H3); its falsification must be fatal, not absorbed')

print('\n[3] HYPOTHESIS M(V) in V — the invariance collapse A2 = A^T B^-1 A')
# If the invariance failed, the true A2 would differ from A^T B^-1 A. Simulate exactly that: a certificate
# whose A2 disagrees with the collapse by more than every tail. The auditor recomputes THROUGH the collapse
# and must refuse the non-collapse value.
doc = load('r4b-a2')
lo, hi = doc['a2']['1,1']
doc['a2']['1,1'] = [str(Fraction(lo) + Fraction(1, 100)), str(Fraction(hi) + Fraction(1, 100))]
v, f = R2.audit_doc(doc)
check('an A2 inconsistent with the collapse is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[4] BASIS ORDERING — the entries must be the entries of THIS basis, in THIS order')
doc = load('r4b-gram')
g = doc['gram']
g['1,2'], g['2,3'] = g['2,3'], g['1,2']              # relabel: data of one pair claimed for another
v, f = R1.audit_doc(doc)
check('permuted basis labelling is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[5] MIN-MAX RANK — Courant-Fischer needs dim S = j, certified by gmin(G_A) > 0')
# Falsify the hypothesis, not the data: duplicate a trial vector, so the span has dimension j-1 and the
# lower half's min-max argument is void. The Gershgorin guard must refuse, because c^T G_A c = 0 for the
# difference vector makes a certified-positive lower bound impossible.
doc = load('r4b-final')
doc['V_lower'][1] = list(doc['V_lower'][0])
v, f = R4.audit_doc(doc)
check('a rank-deficient trial family is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[6] LEHMANN APPLICABILITY — R = [<(T-rho)w_a,(T-rho)w_b>] must be positive definite')
# R > 0 is what makes inertia counting count PENCIL eigenvalues. Hand the machinery an indefinite R and a
# zero R; both must refuse rather than count.
ind = [[R3L.RI(1), R3L.RI(2)], [R3L.RI(2), R3L.RI(1)]]
check('an indefinite R refuses Sylvester certification', refuses(lambda: R3L.certify_posdef(ind, 2)))
check('a zero R refuses Sylvester certification', refuses(lambda: R3L.certify_posdef([[R3L.RI(0)]], 1)))

print('\n[7] SHIFT HYPOTHESIS (H12) — exactly J eigenvalues of T below rho')
doc = load('r4b-lehmann')
doc['rho'] = '-1/20'                                  # -rho below 1/((J+1)pi): the count hypothesis fails
v, f = R3L.audit_doc(doc)
check('a shift violating the count hypothesis is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[8] THE PAIRING — tau_{J+1-j} bounds lambda_j, and no other assignment does')
# Recompute the claimed uppers with the pairing shifted by one (U_j from tau_{J-j}); the exact-rational
# support check must notice that a claimed bound is below the sup its own bracket supports.
doc = load('r4b-lehmann')
rho = Fraction(doc['rho'])
J = int(doc['params']['J'])
wrong = []
for j in range(1, J + 1):
    k = J - j if J - j >= 1 else J                    # off-by-one pairing (wrap the last)
    b = Fraction(doc['tau'][k - 1][1])
    wrong.append(str(-rho - 1 / b))
doc['upper'] = wrong
v, f = R3L.audit_doc(doc)
check('an off-by-one eigenvalue pairing is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[9] IMPORTED BRACKET (H6) — the published envelope is enforced, not decorative')
doc = load('r4b-final')
doc['enclosures'][0][1] = '7/20'                      # 0.35 > 1/pi: violates H6's strict upper bound
v, f = R4.audit_doc(doc)
check('an enclosure violating the H6 envelope is REJECTED', v == REJECT,
      next((x for x in f if x.startswith('REJECT')), '')[:100])

print('\n[10] HYPOTHESIS (H_K) — Ksum >= 2K, and who carries it')
# The prover's tail is valid only under (H_K) and must refuse below it; the auditor's tail (R3-T route)
# carries no such hypothesis and must keep working there. Falsifying (H_K) therefore refuses on one side
# and is provably irrelevant on the other — the asymmetry is the point of the independent tail.
import problem_dg_profile as P
check('the prover refuses its tail below Ksum = 2K',
      refuses(lambda: P._vector_tail_bound([1] + [0] * 7, [1] + [0] * 7, 8, 12)))
R3L.prepare(16)
t = R3L.vector_tail_from_parts(R3L.RI(64) * R3L.pi_ri() * R3L.pi_ri(), R3L.RI(0), 12)
check('the auditor tail needs no (H_K) at all — valid bound below 2K', t > 0,
      'auditor bound %.3g with Ksum=12 < 2K=16' % float(t))

print('\n' + ('ADVERSARIAL: ALL PASS' if not FAILS
              else f'ADVERSARIAL: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
