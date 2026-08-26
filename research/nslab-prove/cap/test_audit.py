"""Machine C test suite — does the Auditor actually audit, or does it rubber-stamp?

An auditor that accepts everything is worse than no auditor, because it converts an unchecked claim into an
apparently checked one. So most of this suite is **tampering**: a genuine certificate is taken, one field is
falsified, and the auditor is required to REJECT. If any of those passes, the ACCEPTs mean nothing.

The tamper cases are chosen to cover the ways a certificate can be wrong:

  * Y0 understated  - claiming the approximate solution is better than it is
  * Z1 understated  - the classic one: the infinite tail is not actually covered
  * Z1 >= 1         - no radius can work, but the polynomial might still look negative at a chosen r
  * Z2 understated  - the nonlinearity is stronger than claimed
  * r falsified     - the contraction does not close at the radius quoted
  * abar tampered   - proves the auditor RECOMPUTES from the data rather than trusting the numbers

Plus a structural check that the auditor imports nothing from the prover, since an auditor sharing the prover's
convolution would inherit the prover's bugs and the independence would be fictional.

Run:  python test_audit.py
"""
import ast
import json
import os
import sys
from fractions import Fraction

import auditor
import auditor_r23
import auditor_r01
import auditor_r4
import auditor_r4b
from auditor import ACCEPT, REJECT

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


# --------------------------------------------------------------------------------------------------------
print('\n[1] the auditor is independent: it imports nothing from the prover')
PROVER_MODULES = {'ell1', 'ivutil', 'radiipoly', 'krawczyk', 'clm', 'problem_quadratic',
                  'problem_clm_fourier', 'problem_degregorio', 'problem_burgers', 'problem_eigen',
                   'mpmath', 'certificate'}
for mod in ('auditor.py', 'auditor_r23.py', 'auditor_r01.py', 'auditor_r4.py', 'auditor_r4b.py'):
    src = open(os.path.join(HERE, mod), encoding='utf-8').read()
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            imported.update(a.name.split('.')[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split('.')[0])
    overlap = imported & PROVER_MODULES
    check(f'{mod} shares no module with the prover', not overlap, f'imports {sorted(imported)}')

# --------------------------------------------------------------------------------------------------------
print('\n[2] genuine certificates are accepted')
if not os.path.isdir(CERTS) or not os.listdir(CERTS):
    print('  (no certificates found - run "python emit_certs.py certs" first)')
    sys.exit(1)
for which in ('quadratic', 'clm'):
    v, notes = auditor.audit(load(which))
    check(f'{which}: ACCEPT', v == ACCEPT, '; '.join(n for n in notes if n.startswith('REJECT'))[:80])

# --------------------------------------------------------------------------------------------------------
print('\n[3] TAMPERING must be rejected')


def tampered(which, mutate, label):
    d = load(which)
    mutate(d)
    v, notes = auditor.audit(d)
    reason = next((n for n in notes if n.startswith('REJECT')), '')
    check(label, v == REJECT, reason[7:100] if reason else 'ACCEPTED - the auditor missed it')


def halve(d, field):
    d['bounds'][field] = str(Fraction(d['bounds'][field]) / 2)


tampered('quadratic', lambda d: halve(d, 'Y0'), 'quadratic: Y0 halved')
tampered('clm', lambda d: halve(d, 'Y0'), 'clm: Y0 halved')
tampered('quadratic', lambda d: halve(d, 'Z1'), 'quadratic: Z1 halved (tail not covered)')
tampered('clm', lambda d: halve(d, 'Z1'), 'clm: Z1 halved (tail not covered)')
tampered('quadratic', lambda d: d['bounds'].__setitem__('Z2', '0'), 'quadratic: Z2 zeroed')
tampered('quadratic', lambda d: d['bounds'].__setitem__('Z1', '3/2'), 'quadratic: Z1 set above 1')
tampered('quadratic', lambda d: d.__setitem__('r', str(Fraction(d['r']) / 1000)),
         'quadratic: r shrunk so p(r) >= 0')
tampered('clm', lambda d: d.__setitem__('r', str(Fraction(d['r']) / 1000)), 'clm: r shrunk so p(r) >= 0')
tampered('quadratic', lambda d: d.__setitem__('problem', 'something_else'), 'unknown problem is refused')


def bump_abar(d):
    """Change one coefficient of abar. The residual then grows, so the unchanged Y0 becomes an under-estimate.
    An auditor that trusted the quoted numbers would not notice."""
    d['abar'][3][0] = str(Fraction(d['abar'][3][0]) + Fraction(1, 100))


tampered('quadratic', bump_abar, 'quadratic: abar coefficient altered')
tampered('clm', lambda d: d['abar'][2].__setitem__(1, str(Fraction(d['abar'][2][1]) + Fraction(1, 100))),
         'clm: abar coefficient altered')

# --------------------------------------------------------------------------------------------------------
print('\n[4] a blunt certificate is accepted - only under-estimates are fatal')
# Doubling Y0 and Z2 makes the claim weaker, not wrong. The polynomial may or may not still close; if it does,
# the auditor must accept. This distinguishes "checks the direction of the inequality" from "checks equality".
d = load('quadratic')
d['bounds']['Y0'] = str(Fraction(d['bounds']['Y0']) * 2)
d['r'] = str(Fraction(d['r']) * 4)
v, notes = auditor.audit(d)
check('loosened-but-valid certificate still accepted', v == ACCEPT,
      '; '.join(n for n in notes if n.startswith('REJECT'))[:80])

# --------------------------------------------------------------------------------------------------------
print('\n[5] the auditor\'s exact arithmetic agrees with the prover to the printed digits')
for which in ('quadratic', 'clm'):
    d = load(which)
    ref = auditor.RECOMPUTE[d['problem']](d['params'], [(auditor.F(a), auditor.F(b)) for a, b in d['abar']])
    claimed = auditor.F(d['bounds']['Y0'])
    lo_, hi_ = ref['Y0']
    rel = abs(claimed - hi_) / hi_ if hi_ > 0 else Fraction(0)
    check(f'{which}: Y0 agrees to better than 1e-6 relative', rel < Fraction(1, 10 ** 6),
          f'relative difference {float(rel):.3e}')


# --------------------------------------------------------------------------------------------------------
print('\n[6] R2 and R3 certificates are accepted')
for which in ('degregorio', 'burgers'):
    d = load(which)
    v, notes = auditor_r23.audit(d)
    check(f'{which}: ACCEPT', v == ACCEPT, '; '.join(n for n in notes if n.startswith('REJECT'))[:90])

print('\n[7] R2 (Krawczyk) tampering must be rejected')


def tampered23(which, mutate, label):
    d = load(which)
    mutate(d)
    v, notes = auditor_r23.audit(d)
    reason = next((n for n in notes if n.startswith('REJECT')), '')
    check(label, v == REJECT, reason[8:105] if reason else 'ACCEPTED - the auditor missed it')


def widen(d, factor):
    d['box'] = [[str(Fraction(a) * factor), str(Fraction(b) * factor)] for a, b in d['box']]


tampered23('degregorio', lambda d: widen(d, 1000), 'degregorio: box widened 1000x (K(X) escapes)')
tampered23('degregorio',
           lambda d: d.__setitem__('box', [[str(Fraction(1, 100)), str(Fraction(2, 100))] for _ in d['box']]),
           'degregorio: box moved off the solution')
def make_even(d):
    """N=6 with a correctly sized box, so the rejection has to come from the SINGULAR JACOBIAN rather than
    from a dimension mismatch. An earlier version of this test left the box at its N=7 length and was caught by
    the size check instead - a pass for the wrong reason, which is a failed test dressed as a passing one."""
    d['params']['N'] = 6
    d['box'] = d['box'][:5]


tampered23('degregorio', make_even, 'degregorio: N made even (Jacobian genuinely singular)')
tampered23('degregorio', lambda d: d.__setitem__('box', d['box'][:-1]),
           'degregorio: box has the wrong dimension')

print('\n[8] R3 (preconditioned Burgers) tampering must be rejected')
tampered23('burgers', lambda d: halve(d, 'Y0'), 'burgers: Y0 halved')
tampered23('burgers', lambda d: halve(d, 'Z1'), 'burgers: Z1 halved (tail not covered)')
tampered23('burgers', lambda d: halve(d, 'Z2'), 'burgers: Z2 halved')
tampered23('burgers', lambda d: d.__setitem__('r', str(Fraction(d['r']) / 10000)),
           'burgers: r shrunk so p(r) >= 0')
tampered23('burgers',
           lambda d: d['ubar_sine'].__setitem__(2, str(Fraction(1, 20))),
           'burgers: ubar coefficient altered')
tampered23('burgers', lambda d: d['params'].__setitem__('mu', str(Fraction(1, 4))),
           'burgers: mu reduced toward the inviscid limit')

print('\n[9] the R2 audit uses its OWN preconditioner, so it confirms rather than re-runs')
# The certificate carries no Y at all - a Krawczyk verdict is a statement about the box, and any valid
# preconditioner establishes it. The auditor builds one by exact rational Gauss-Jordan.
d = load('degregorio')
check('certificate carries no preconditioner', 'Y' not in d and 'preconditioner' not in d,
      'the auditor must supply its own')
v, notes = auditor_r23.audit(d)
check('and still closes the containment', v == ACCEPT,
      next((n for n in notes if 'K(X)' in n), '')[:90])


# --------------------------------------------------------------------------------------------------------
print('\n[10] R0 enclosures are accepted, and verified WITHOUT constructing any irrational')
for case in ('sqrt2', 'system2d', 'dottie'):
    d = load('r0-' + case)
    v, notes = auditor_r01.audit(d)
    check(f'r0-{case}: ACCEPT', v == ACCEPT, next((n for n in notes if not n.startswith('REJECT')), '')[:88])


def tampered01(which, mutate, label):
    d = load(which)
    mutate(d)
    v, notes = auditor_r01.audit(d)
    reason = next((n for n in notes if n.startswith('REJECT')), '')
    check(label, v == REJECT, reason[8:105] if reason else 'ACCEPTED - the auditor missed it')


print('\n[11] R0 tampering must be rejected')
tampered01('r0-sqrt2', lambda d: d.__setitem__('box', [['1', '13/10']]),
           'r0: box that does not bracket sqrt(2)')
tampered01('r0-sqrt2', lambda d: d.__setitem__('box', [['3/2', '2']]),
           'r0: box entirely above sqrt(2)')
tampered01('r0-dottie', lambda d: d.__setitem__('box', [['0', '1/10']]),
           'r0: dottie box with no sign change')
tampered01('r0-system2d', lambda d: d['box'].__setitem__(1, ['0', '1/10']),
           'r0: one component of the 2D system moved off the root')
tampered01('r0-sqrt2', lambda d: d.__setitem__('case', 'not_a_case'), 'r0: unknown case refused')

print('\n[12] R1a: the completeness check, which is the one that matters')
d = load('r1a-clm')
v, notes = auditor_r01.audit(d)
check('r1a: ACCEPT with the full zero set', v == ACCEPT,
      next((n for n in notes if 'completeness' in n), '')[:95])

# THE test. The dyadic-boundary bug threatened exactly this: a zero list that is missing an entry. A short list
# makes the supremum too small and therefore the blow-up time too LARGE - the dangerous direction, and invisible
# once the number is written down. The auditor must catch it by its own completeness argument.
tampered01('r1a-clm', lambda d: d.__setitem__('zeros', d['zeros'][:1]),
           'r1a: one zero DROPPED from the list')
tampered01('r1a-clm', lambda d: d.__setitem__('zeros', []), 'r1a: all zeros dropped')
tampered01('r1a-clm', lambda d: d['zeros'].__setitem__(0, ['1/2', '6/10']),
           'r1a: a zero enclosure moved off the root')
tampered01('r1a-clm', lambda d: d.__setitem__('T', ['3', '4']), 'r1a: T falsified')
tampered01('r1a-clm', lambda d: d.__setitem__('omega0', [[1, '0', '1']]),
           'r1a: omega0 changed to sin x, so the quoted zeros are no longer its zeros')

print('\n[13] the transcendental machinery is self-contained and correct')
from fractions import Fraction as _Fr
PI = auditor_r01.pi_interval()
# 333/106 < pi < 355/113 are classical bounds; an independent check on the Machin computation.
check('pi bracket agrees with the classical 333/106 < pi < 355/113',
      PI.lo > _Fr(333, 106) and PI.hi < _Fr(355, 113),
      f'width {float(PI.width()):.2e}')
c1 = auditor_r01.cos_bracket(_Fr(1))
# cos(1) = 0.54030230586813971740... The bracket here is narrower than 1e-80, so a 16-digit ROUNDED literal
# lies outside it - correctly. An earlier version of this test asserted the rounded value was inside and failed;
# the defect was the test's, not the series'. The right assertion is a genuine two-sided bracket.
check('cos(1) is bracketed strictly between consecutive 16-digit decimals',
      _Fr(5403023058681397, 10 ** 16) < c1.lo and c1.hi < _Fr(5403023058681398, 10 ** 16),
      f'width {float(c1.width()):.2e}')
s0 = auditor_r01.sin_bracket(_Fr(0))
check('sin(0) = 0 exactly', s0.lo <= 0 <= s0.hi)
# cos^2 + sin^2 = 1 at a rational point, as an independent consistency check on both series
q = _Fr(7, 5)
cc, ss = auditor_r01.cos_bracket(q), auditor_r01.sin_bracket(q)
tot = cc * cc + ss * ss
check('cos^2 + sin^2 = 1 at q = 7/5', tot.lo <= 1 <= tot.hi, f'{tot}')

# --------------------------------------------------------------------------------------------------------
print('\n[14] R4: the compact-operator eigenpair certificate is accepted')
r4 = load('r4-eigen')
v, f = auditor_r4.audit(r4)
check('genuine R4 certificate ACCEPTed', v == ACCEPT, '; '.join(f) if v != ACCEPT else '')
check('the audit recomputed Y0 rather than re-reading it', any('recomputed exactly' in x for x in f))


def r4_tamper(name, mutate, expect=REJECT):
    """Falsify one field of the R4 certificate and require the stated verdict."""
    doc = load('r4-eigen')
    mutate(doc)
    v, f = auditor_r4.audit(doc)
    detail = next((x for x in f if x.startswith('REJECT')), '')
    check(name, v == expect, detail[:110])


def _setb(doc, k, val):
    doc['bounds'][k] = str(val)


print('\n[15] R4 tampering must be rejected')
r4_tamper('r4: Y0 halved', lambda d: _setb(d, 'Y0', Fraction(d['bounds']['Y0']) / 2))
r4_tamper('r4: Z2 zeroed', lambda d: _setb(d, 'Z2', Fraction(0)))
r4_tamper('r4: Z2 just below 1/lambda', lambda d: _setb(d, 'Z2', Fraction(8, 11) - Fraction(1, 10 ** 6)))
r4_tamper('r4: Z1 pushed above 1', lambda d: _setb(d, 'Z1', Fraction(3, 2)))
r4_tamper('r4: Z1 below the tail minimum compactness forces',
          lambda d: _setb(d, 'Z1', Fraction(1, 10 ** 30)))
r4_tamper('r4: r shrunk so p(r) >= 0', lambda d: d.__setitem__('r', str(Fraction(d['r']) / 1000)))
r4_tamper('r4: abar altered ABOVE N, so the residual and Y0 move',
          lambda d: d['abar'].__setitem__(24, [str(Fraction(d['abar'][24][0]) + Fraction(1, 2 ** 30)), '0']))
r4_tamper('r4: abar altered BELOW N, so the residual escapes the tail',
          lambda d: d['abar'].__setitem__(5, [str(Fraction(d['abar'][5][0]) + Fraction(1, 2 ** 30)), '0']))
r4_tamper('r4: the phase condition broken at mode 1',
          lambda d: d['abar'].__setitem__(0, [str(Fraction(d['abar'][0][0]) * 2), '0']))
r4_tamper('r4: nu raised past the eigenvector radius of convergence',
          lambda d: d['params'].__setitem__('nu', '5/2'))
r4_tamper('r4: the problem renamed', lambda d: d.__setitem__('problem', 'something_else'))
r4_tamper('r4: abar truncated so it disagrees with M',
          lambda d: d.__setitem__('abar', d['abar'][:-1]))

print('\n[16] R4: a blunt certificate is accepted - but bluntness is only free while p(r) < 0 survives')
# The auditor rejects only UNDER-estimates, so an overstated bound must still be accepted. It is accepted by the
# bound checks, not by the polynomial: p(r) at the claimed r has slack ~5e-11 here, so a bound raised within that
# slack still closes, and one raised past it does not. Doubling Y0 or Z2 lands far outside and is correctly
# refused - not because the auditor minds a blunt bound, but because the contraction genuinely stops closing at
# the radius quoted. Both directions are asserted so the asymmetry cannot be mistaken for leniency.
r4_tamper('r4: Y0 raised within the slack (blunt, still closes)',
          lambda d: _setb(d, 'Y0', Fraction(d['bounds']['Y0']) * (1 + Fraction(1, 10 ** 9))), expect=ACCEPT)
r4_tamper('r4: Z2 raised within the slack (blunt, still closes)',
          lambda d: _setb(d, 'Z2', Fraction(d['bounds']['Z2']) * (1 + Fraction(1, 10 ** 6))), expect=ACCEPT)
r4_tamper('r4: Y0 doubled - blunt AND p(r) no longer negative, so refused',
          lambda d: _setb(d, 'Y0', Fraction(d['bounds']['Y0']) * 2))


# --------------------------------------------------------------------------------------------------------
print('\n[17] R4b: the Gram matrix re-derived in exact rationals, with no special functions')
# The tightest result in this line was, until now, its least independently checked. The prover reaches the Gram
# matrix through Ci, which needs gamma and a logarithm - neither available to an auditor restricted to
# fractions/json/math. Lemma 1' removes both: gamma cancels between the two Ci terms and the log cancels against
# ln(m/n), leaving the ENTIRE functions Si and Cin. So this auditor evaluates a DIFFERENT representation of the
# same object, in rational arithmetic rounded outward, with pi from Machin rather than from mpmath.
r4b = load('r4b-gram')
v, f = auditor_r4b.audit_doc(r4b)
check('the genuine R4b Gram certificate is ACCEPTed', v == ACCEPT, '; '.join(f[:1]) if v != ACCEPT else '')
check('the auditor actually recomputed (it reports its own widths)', any('auditor width' in x for x in f))


def r4b_tamper(name, mutate, expect=REJECT):
    doc = json.loads(json.dumps(r4b))
    mutate(doc)
    v, f = auditor_r4b.audit_doc(doc)
    detail = next((x for x in f if x.startswith('REJECT')), '')
    check(name, v == expect, detail[:112])


def _shift(doc, key, delta):
    lo_, hi_ = doc['gram'][key]
    doc['gram'][key] = [str(Fraction(lo_) + delta), str(Fraction(hi_) + delta)]


print('\n[18] R4b tampering must be rejected')
r4b_tamper('r4b: A_1,1 shifted off the true value', lambda d: _shift(d, '1,1', Fraction(1, 1000)))
r4b_tamper('r4b: A_2,3 shifted off the true value', lambda d: _shift(d, '2,3', Fraction(-1, 10 ** 6)))
r4b_tamper('r4b: A_1,2 sign flipped',
           lambda d: d['gram'].__setitem__('1,2', [str(-Fraction(d['gram']['1,2'][1])),
                                                   str(-Fraction(d['gram']['1,2'][0]))]))
r4b_tamper('r4b: A_5,5 collapsed to a wrong point',
           lambda d: d['gram'].__setitem__('5,5', ['15', '15']))
r4b_tamper('r4b: an off-diagonal given the diagonal entry value',
           lambda d: d['gram'].__setitem__('1,2', d['gram']['1,1']))
r4b_tamper('r4b: the problem renamed', lambda d: d.__setitem__('problem', 'something_else'))

print('\n[19] R4b: a blunt certificate is still accepted - only disjointness is fatal')
r4b_tamper('r4b: every entry widened a thousandfold (blunt, not wrong)',
           lambda d: [d['gram'].__setitem__(k, [str(Fraction(a) - Fraction(1, 1000)),
                                                str(Fraction(b) + Fraction(1, 1000))])
                      for k, (a, b) in list(d['gram'].items())], expect=ACCEPT)



# --------------------------------------------------------------------------------------------------------
print('\n[20] RUNG 2: A2 re-derived by a tail argument that shares nothing with the prover')
# Contract: ../R2-AUDIT-CONTRACT.md, frozen before implementation. The prover bounds the tail through the
# ASYMPTOTICS OF THE ENTRIES (|Ci|<=2/x, then |A_km| <= (8m/3 pi k)(ln(k/m)+D_m), then three log-moment
# integrals). The auditor uses none of it: it goes through HTW's own smoothing estimate,
#     sum_k A_ki^2 = ||M s_i||^2_{Hdot2} <= ||s_i||^2_{Hdot1} = (i pi)^2                    (R2-T)
# so convergence follows from a FINITE analytic bound rather than a decay rate.
import auditor_r4b_a2 as R2
r2doc = load('r4b-a2')
v, f = R2.audit_doc(r2doc)
check('the genuine A2 certificate is ACCEPTed by the independent tail route', v == ACCEPT,
      '; '.join(x for x in f if x.startswith('REJECT'))[:110])
check('the auditor recomputed and reports its own tail', any('tail' in x for x in f))

print('\n[21] PILLAR 1 - algebraic validation: (R2-T) and symmetry')
K_T = 60
R2.prepare(K_T)
for i in (1, 2, 3):
    S = R2.partial_sum_sq(i, K_T)
    bound = (R2.RI(i * i) * (R2.pi_ri() * R2.pi_ri())).hi
    check(f'(R2-T) holds at i={i}: sum_k A_ki^2 <= (i pi)^2', S.hi <= bound,
          f'{float(S.hi):.6f} <= {float(bound):.6f}')
aij, _, _ = R2.a2_enclosure(1, 2, K_T)
aji, _, _ = R2.a2_enclosure(2, 1, K_T)
check('A2 is symmetric', aij.overlaps(aji))

print('\n[22] PILLAR 2 - tail stress and refusal')
refused = False
try:
    R2.sqrt_upper(Fraction(-1))
except R2.Refusal:
    refused = True
check('sqrt_upper refuses a negative argument rather than returning a complex or clamped value', refused)
# A grid too coarse for the cancellation must REFUSE, not return a sound-but-vacuous interval. This is AL-004:
# a width of 1e7 around a value of 0.04 was initially misread as a tail-bound failure.
import auditor_r4b as R1
R1.set_precision_for(1)          # deliberately far too coarse for k = 60
vacuous_refused = False
try:
    R1.A_entry(60, 1)
except ValueError as e:
    vacuous_refused = 'vacuous' in str(e)
check('a grid too coarse for the cancellation REFUSES rather than returning a vacuous enclosure',
      vacuous_refused)
R2.prepare(K_T)                  # restore

print('\n[23] PILLAR 3 - static dependency audit')
FORBIDDEN = {'mpmath', 'ivutil', 'sici', 'problem_dg_profile', 'problem_eigen', 'lehmann', 'ell1', 'radiipoly'}
for mod in ('auditor_r4b.py', 'auditor_r4b_a2.py'):
    src = open(os.path.join(HERE, mod), encoding='utf-8').read()
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            imported.update(a.name.split('.')[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split('.')[0])
    check(f'{mod} imports no prover module', not (imported & FORBIDDEN), f'imports {sorted(imported)}')

print('\n[24] PILLAR 4 - dynamic independence: corrupt the prover, output must not move')
clean_v, clean_f = R2.audit_doc(r2doc)
import problem_dg_profile as _prover
_saved = {}
for name in ('A_entry', 'A_entry_enclosure', 'A2_enclosure', 'A2_tail_bound', '_log_moment_integrals',
             'A_entry_abs_bound'):
    _saved[name] = getattr(_prover, name, None)
    setattr(_prover, name, lambda *a, **k: (_ for _ in ()).throw(RuntimeError('prover artefact corrupted')))
try:
    dirty_v, dirty_f = R2.audit_doc(r2doc)
finally:
    for name, fn in _saved.items():
        if fn is not None:
            setattr(_prover, name, fn)
check('the verdict is unchanged when every prover routine is corrupted', clean_v == dirty_v)
check('the complete finding list is unchanged, not merely the verdict', clean_f == dirty_f)

print('\n[25] PILLAR 5 - AL-002 regression: ambient state must not change the answer')
# AL-002 was an apparent 25-orders-of-magnitude discrepancy caused by an ambient precision setting, not by the
# mathematics. The auditor's grid is sized deterministically from K, so ambient state cannot move its output.
from mpmath import mp as _mp
_dps = _mp.dps
try:
    _mp.dps = 5
    low_v, low_f = R2.audit_doc(r2doc)
    _mp.dps = 200
    high_v, high_f = R2.audit_doc(r2doc)
finally:
    _mp.dps = _dps
check('changing ambient mpmath precision does not change the verdict', low_v == high_v == clean_v)
check('changing ambient mpmath precision does not change the findings', low_f == high_f == clean_f)


# --------------------------------------------------------------------------------------------------------
print('\n[26] RUNG 3: the Lehmann pencil re-derived by routes that share nothing with the prover')
# Contract: ../R3-AUDIT-CONTRACT.md, frozen before implementation. Four separations: (a) the A2 tail is the
# vector form of (R2-T) - no Ksum >= 2K hypothesis at all, where the prover's entry-asymptotics tail must
# refuse below 2K; (b) inertia by Jacobi's division-free minor rule, not LDL^T pivots, with R > 0 CHECKED by
# Sylvester's criterion rather than asserted from the Gram form; (c) resolution-limited bisection that stops
# where the widths stop certifying; (d) the tau -> bound step redone in exact rationals (the certificate's
# endpoints are dyadic, so 1/b is exact), and the shift window re-derived from the auditor's own Machin pi
# and its own Gershgorin bound.
import auditor_r4b_lehmann as R3
r3doc = load('r4b-lehmann')
v, f = R3.audit_doc(r3doc)
check('the genuine Lehmann certificate is ACCEPTed', v == ACCEPT,
      '; '.join(x for x in f if x.startswith('REJECT'))[:110])
check('the auditor produced its own tau brackets', any('own bracket' in x for x in f))
check('the shift window was re-derived, not trusted', any('shift window ok' in x for x in f))
check('R was certified positive definite, not asserted', any('Sylvester' in x for x in f))
check('every claimed bound survived the exact-rational recheck', any('exact recheck ok' in x for x in f))

print('\n[27] PILLAR 1 - algebraic validation: the diagonal pencil with a closed form')
# T diagonal with eigenvalues t_i, trial space the eigenvectors themselves: A0 = I, A1 = diag(t_i),
# A2 = diag(t_i^2), so L = diag(t_i - rho), R = diag((t_i - rho)^2) and the pencil eigenvalues are exactly
# tau_i = 1/(t_i - rho). With t = (-1/2, -1/4, -1/8) and rho = -1/16 (all dyadic): tau = -16/7, -16/3, -16,
# and the recovered bounds must be exactly -t = 1/2, 1/4, 1/8.
from fractions import Fraction as _F3
R3.prepare(2)          # tiny grid; nothing here needs the series
_t = [_F3(-1, 2), _F3(-1, 4), _F3(-1, 8)]
_rho3 = _F3(-1, 16)
_I3 = [[R3.RI(1 if i == j else 0) for j in range(3)] for i in range(3)]
_D1 = [[R3.RI(_t[i] if i == j else 0) for j in range(3)] for i in range(3)]
_D2 = [[R3.RI(_t[i] * _t[i] if i == j else 0) for j in range(3)] for i in range(3)]
_rr = R3.RI(_rho3, raw=True)
_L3 = [[_D1[i][j] - _rr * _I3[i][j] for j in range(3)] for i in range(3)]
_R3m = [[_D2[i][j] - R3.RI(2) * _rr * _D1[i][j] + _rr * _rr * _I3[i][j] for j in range(3)] for i in range(3)]
_exact_tau = sorted(_F3(1, 1) / (ti - _rho3) for ti in _t)          # -16, -16/3, -16/7
R3.certify_posdef(_R3m, 3)
check('R > 0 certified on the closed-form pencil', True)
check('inertia counts step 0/1/2/3 across the exact taus',
      [R3.inertia_below(_L3, _R3m, _F3(x), 3) for x in (-20, -10, -4, -1)] == [0, 1, 2, 3])
ok = True
for k in range(1, 4):
    a, b = R3.bracket_tau(_L3, _R3m, 3, k)
    ok = ok and (a <= _exact_tau[k - 1] <= b)
check('bracket_tau encloses each exact pencil eigenvalue', ok)
_a3, _b3 = R3.bracket_tau(_L3, _R3m, 3, 3)                          # encloses -16/7; bounds lambda_1 = 1/2
check('the recovered upper bound is exact where the bracket is a point',
      R3.upper_bound_from_bracket(_rho3, _F3(-16, 7), _F3(-16, 7)) == _F3(1, 2))
check('and >= 1/2 on the certified bracket (sup at the right endpoint)',
      R3.upper_bound_from_bracket(_rho3, _a3, _b3) >= _F3(1, 2))
# a non-diagonal 2x2: L = [[0,1],[1,0]], R = I, pencil eigenvalues -1 and +1
_L2 = [[R3.RI(0), R3.RI(1)], [R3.RI(1), R3.RI(0)]]
_I2 = [[R3.RI(1), R3.RI(0)], [R3.RI(0), R3.RI(1)]]
check('off-diagonal case: count below -3/2, -1/2, 3/2 is 0, 1, 2',
      [R3.inertia_below(_L2, _I2, _F3(x, 2), 2) for x in (-3, -1, 3)] == [0, 1, 2])
check('a minor that is exactly zero refuses rather than guessing (t = 0: D1 = 0)',
      R3.inertia_below(_L2, _I2, _F3(0), 2) is None)

print('\n[28] PILLAR 2 - refusal stress: every undecided sign is a refusal, never a number')
def _refuses(fn):
    try:
        fn()
    except R3.Refusal:
        return True
    return False
check('(R3-T) falsified by its parts refuses rather than clamping',
      _refuses(lambda: R3.vector_tail_from_parts(R3.RI(1), R3.RI(2), 40)))
check('a zero R fails Sylvester certification',
      _refuses(lambda: R3.certify_posdef([[R3.RI(0)]], 1)))
check('an indefinite R fails Sylvester certification',
      _refuses(lambda: R3.certify_posdef([[R3.RI(1), R3.RI(2)], [R3.RI(2), R3.RI(1)]], 2)))
check('a bracket whose upper endpoint is not negative refuses',
      _refuses(lambda: R3.upper_bound_from_bracket(_rho3, _F3(-1), _F3(1))))
check('endpoints out of order refuse',
      _refuses(lambda: R3.upper_bound_from_bracket(_rho3, _F3(-1), _F3(-2))))
check('a sound-but-vacuous bound (above 1 = above every eigenvalue) refuses',
      _refuses(lambda: R3.upper_bound_from_bracket(_rho3, _F3(-10 ** 6), _F3(-1, 10 ** 6))))

print('\n[29] R3 tampering must be rejected - and a blunt-but-consistent certificate accepted')
def r3_tamper(name, mutate, expect=REJECT):
    doc = json.loads(json.dumps(r3doc))
    mutate(doc)
    v, f = R3.audit_doc(doc)
    detail = next((x for x in f if x.startswith('REJECT')), '')
    check(name, v == expect, detail[:112])

r3_tamper('r3: the problem renamed', lambda d: d.__setitem__('problem', 'something_else'))
r3_tamper('r3: U_1 understated below the sup its own bracket supports',
          lambda d: d['upper'].__setitem__(0, str(Fraction(d['upper'][0]) - Fraction(1, 10 ** 12))))
r3_tamper('r3: the shift moved outside its window (-rho below 1/((J+1)pi))',
          lambda d: d.__setitem__('rho', '-1/20'))
r3_tamper('r3: tau_2 bracket shifted to a disjoint range',
          lambda d: (d['tau'].__setitem__(1, ['-200', '-150']),
                     d['upper'].__setitem__(1, str(-Fraction(d['rho']) + Fraction(1, 150)))))
r3_tamper('r3: A2_0,0 shifted off the true value',
          lambda d: d['matrices']['A2'][0].__setitem__(0, [str(Fraction(d['matrices']['A2'][0][0][0]) + Fraction(1, 1000)),
                                                           str(Fraction(d['matrices']['A2'][0][0][1]) + Fraction(1, 1000))]))
r3_tamper('r3: a trial vector doubled (the auditor recomputes from the data, so everything moves)',
          lambda d: d['V'][0].__setitem__(0, str(Fraction(d['V'][0][0]) * 2)))
def _blunt(d):
    for k in range(3):
        a, b = Fraction(d['tau'][k][0]), Fraction(d['tau'][k][1])
        w = (b - a) + Fraction(1, 100)
        d['tau'][k] = [str(a - w), str(b + w)]
        d['upper'][2 - k] = str(-Fraction(d['rho']) - Fraction(1, 1) / (b + w))
r3_tamper('r3: brackets widened and bounds recomputed from them (blunt, not wrong)', _blunt, expect=ACCEPT)

print('\n[30] PILLAR 3 - static dependency audit for the Rung 3 auditor')
for mod in ('auditor_r4b_lehmann.py',):
    src = open(os.path.join(HERE, mod), encoding='utf-8').read()
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            imported.update(a.name.split('.')[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split('.')[0])
    check(f'{mod} imports no prover module', not (imported & FORBIDDEN), f'imports {sorted(imported)}')

print('\n[31] PILLAR 4 - dynamic independence: corrupt the prover AND the pencil module, output must not move')
clean3_v, clean3_f = R3.audit_doc(r3doc)
import lehmann as _lehmann
_saved3 = {}
for _m, _names in ((_prover, ('A_entry', 'A_entry_enclosure', 'A2_enclosure', 'A2_tail_bound',
                              '_vector_tail_bound', 'lehmann_matrices', 'certified_bracket',
                              'certified_upper_bounds')),
                   (_lehmann, ('inertia_below', 'bracket_tau', 'upper_bounds'))):
    for name in _names:
        _saved3[(_m, name)] = getattr(_m, name, None)
        setattr(_m, name, lambda *a, **k: (_ for _ in ()).throw(RuntimeError('prover artefact corrupted')))
try:
    dirty3_v, dirty3_f = R3.audit_doc(r3doc)
finally:
    for (_m, name), fn in _saved3.items():
        if fn is not None:
            setattr(_m, name, fn)
check('the verdict is unchanged when prover and pencil routines are corrupted', clean3_v == dirty3_v)
check('the complete finding list is unchanged, not merely the verdict', clean3_f == dirty3_f)

print('\n[32] PILLAR 5 - AL-002/AL-004 regression: ambient state must not change the answer')
_dps = _mp.dps
try:
    _mp.dps = 5
    low3_v, low3_f = R3.audit_doc(r3doc)
    _mp.dps = 200
    high3_v, high3_f = R3.audit_doc(r3doc)
finally:
    _mp.dps = _dps
check('changing ambient mpmath precision does not change the verdict', low3_v == high3_v == clean3_v)
check('changing ambient mpmath precision does not change the findings', low3_f == high3_f == clean3_f)


print('\n' + ('AUDIT: ALL PASS' if not FAILS else f'AUDIT: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
