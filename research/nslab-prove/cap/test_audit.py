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


print('\n' + ('AUDIT: ALL PASS' if not FAILS else f'AUDIT: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
