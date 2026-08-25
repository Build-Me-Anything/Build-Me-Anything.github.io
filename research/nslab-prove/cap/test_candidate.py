"""candidate.json test suite — does the schema actually refuse, or is it decoration?

A file format only prevents a mistake if it declines to represent it. So most of this suite is malformed and
incoherent candidates that must be REFUSED. The ones that matter most are not the obviously broken ones but the
plausible ones: a C^alpha profile in an analyticity-encoding norm looks perfectly reasonable and would produce a
certificate about a different function than the one intended.

Run:  python test_candidate.py
"""
import os
import sys
from fractions import Fraction

import candidate as C
from candidate import Refusal

FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


def refuses(name, fn, expect_fragment=None):
    try:
        fn()
    except Refusal as e:
        ok = expect_fragment is None or expect_fragment.lower() in str(e).lower()
        check(name, ok, str(e)[:105])
        return
    check(name, False, 'NO REFUSAL - the schema represented something it should not')


def good_profile(n):
    return [(Fraction(1, 2 ** (k + 1)), Fraction(0)) for k in range(n)]


def good(**over):
    kw = dict(
        problem='degregorio_circle',
        ansatz={'c_omega': Fraction(-1), 'c_l': Fraction(-1)},
        params={'a': 1},
        discretisation={'basis': 'sine', 'modes': 8, 'precision_bits': 200, 'regularity': 'analytic'},
        profile=good_profile(8),
        operator={'norm': 'ell1_nu', 'weight': Fraction(3, 2)},
        proposed_r=Fraction(1, 1000),
    )
    kw.update(over)
    return C.build(**kw)


# --------------------------------------------------------------------------------------------------------
print('\n[1] a well-formed candidate round-trips')
doc = good()
check('build produces a candidate', doc['kind'] == 'candidate')
check('every number is an exact rational string, not a decimal', doc['operator']['weight'] == '3/2')
check('the profile is hashed', len(doc['profile_sha256']) == 64)
check('validate accepts it', C.validate(doc) is None)

HERE = os.path.dirname(os.path.abspath(__file__))
tmp = os.path.join(HERE, '_candidate_roundtrip.json')
try:
    C.write(tmp, doc)
    back = C.read(tmp)
    check('write/read round-trips unchanged', back == doc)
finally:
    if os.path.exists(tmp):
        os.remove(tmp)

# --------------------------------------------------------------------------------------------------------
print('\n[2] RULE 3: the norm must be compatible with the declared regularity')
# The one that motivated the module. ell1_nu with nu > 1 asserts analyticity in a strip of half-width log(nu),
# so a Holder profile graded there would yield a certificate about a function with smoothness it does not have.
refuses('C^alpha profile in ell1_nu with nu > 1 is refused',
        lambda: good(discretisation={'basis': 'sine', 'modes': 8, 'precision_bits': 200,
                                     'regularity': 'holder', 'alpha': Fraction(1, 3)}),
        'analytic')
refuses('C^alpha with alpha <= 1/2 is refused even at nu = 1',
        lambda: good(discretisation={'basis': 'sine', 'modes': 8, 'precision_bits': 200,
                                     'regularity': 'holder', 'alpha': Fraction(1, 3)},
                     operator={'norm': 'ell1_nu', 'weight': Fraction(1)}),
        'summable')
d_holder_ok = {'basis': 'sine', 'modes': 8, 'precision_bits': 200,
               'regularity': 'holder', 'alpha': Fraction(3, 4)}
ok = good(discretisation=d_holder_ok, operator={'norm': 'ell1_nu', 'weight': Fraction(1)})
check('C^alpha with alpha > 1/2 IS accepted at nu = 1 (Bernstein)', ok['discretisation']['alpha'] == '3/4')
ok2 = good(discretisation=d_holder_ok, operator={'norm': 'sobolev', 'weight': Fraction(1, 2)})
check('a Sobolev norm accepts a Holder profile', ok2['operator']['norm'] == 'sobolev')
refuses('regularity "holder" without alpha is refused',
        lambda: good(discretisation={'basis': 'sine', 'modes': 8, 'precision_bits': 200,
                                     'regularity': 'holder'},
                     operator={'norm': 'sobolev', 'weight': Fraction(1, 2)}),
        'alpha')
refuses('an unknown norm is refused', lambda: good(operator={'norm': 'quantum', 'weight': Fraction(1)}),
        'unknown norm')
refuses('nu < 1 is refused', lambda: good(operator={'norm': 'ell1_nu', 'weight': Fraction(1, 2)}))

# --------------------------------------------------------------------------------------------------------
print('\n[3] RULE 2: a candidate carries NO verdict')
for key in ('status', 'verdict', 'proved', 'closed', 'certificate', 'accepted'):
    d = good()
    d[key] = 'CLOSED'
    refuses(f'a candidate carrying {key!r} is refused', lambda d=d: C.validate(d), 'no verdict')

# --------------------------------------------------------------------------------------------------------
print('\n[4] RULE 1: floats are refused outright, not silently converted')
# Fraction(0.1) yields the binary double, not one tenth - exactly the ambiguity that cost an R4 certificate a
# REJECT on 2026-08-25 when 2^-26 was written as a 17-digit decimal string.
refuses('a float radius is refused', lambda: good(proposed_r=0.001), 'float')
refuses('a float in the profile is refused',
        lambda: good(profile=[(0.5, Fraction(0))] + good_profile(7)), 'float')
check('a decimal STRING is accepted and stored exactly',
      good(proposed_r='0.001')['proposed']['r'] == '1/1000')

# --------------------------------------------------------------------------------------------------------
print('\n[5] structural coherence')
refuses('modes disagreeing with the profile length is refused',
        lambda: good(discretisation={'basis': 'sine', 'modes': 12, 'precision_bits': 200,
                                     'regularity': 'analytic'}))
refuses('a missing discretisation field is refused',
        lambda: good(discretisation={'basis': 'sine', 'modes': 8, 'regularity': 'analytic'}),
        'precision_bits')
refuses('a missing operator field is refused', lambda: good(operator={'norm': 'ell1_nu'}), 'weight')
refuses('a non-positive radius is refused', lambda: good(proposed_r=Fraction(0)))

d = good()
d['profile'][2] = ['999/1000', '0']
refuses('a tampered profile is caught by the hash', lambda: C.validate(d), 'hash')

d2 = good()
d2['kind'] = 'certificate'
refuses('a certificate submitted as a candidate is refused', lambda: C.validate(d2), 'not a candidate')

d3 = good()
d3['contract'] = '0.9'
refuses('a wrong contract version is refused', lambda: C.validate(d3), 'contract')

# --------------------------------------------------------------------------------------------------------
print('\n[6] a hopeless candidate is still a VALID candidate')
# The architecture is explicit that a bad candidate costs electricity and never correctness. The schema checks
# well-formedness, never closeness - refusing "bad" profiles here would quietly move judgement out of B.
hopeless = good(profile=[(Fraction(10 ** 6), Fraction(0))] + good_profile(7), proposed_r=Fraction(999))
check('an absurd profile with an absurd radius is accepted as well-formed',
      C.validate(hopeless) is None)

print('\n' + ('CANDIDATE: ALL PASS' if not FAILS else f'CANDIDATE: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
