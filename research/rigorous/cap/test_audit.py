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
                  'problem_clm_fourier', 'problem_degregorio', 'problem_burgers', 'mpmath', 'certificate'}
src = open(os.path.join(HERE, 'auditor.py'), encoding='utf-8').read()
imported = set()
for node in ast.walk(ast.parse(src)):
    if isinstance(node, ast.Import):
        imported.update(a.name.split('.')[0] for a in node.names)
    elif isinstance(node, ast.ImportFrom) and node.module:
        imported.add(node.module.split('.')[0])
overlap = imported & PROVER_MODULES
check('shares no module with the prover', not overlap, f'imports {sorted(imported)}')

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

print('\n' + ('AUDIT: ALL PASS' if not FAILS else f'AUDIT: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
