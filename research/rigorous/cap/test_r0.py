"""R0 test suite — grade the verifier before trusting it.

The instrument here is the Krawczyk test, and it is graded the same way the rented A100 was: against answers that
are already known. Two kinds of test matter, and the second kind matters more:

  1. **Does it close when it should**, and does the enclosure actually contain the true root?
  2. **Does it refuse when it should?** A verifier that always says UNIQUE is worthless. The tests below hand it a
     box with two roots, a box with none, and a box where the Jacobian vanishes, and require it to decline.

Run:  python test_r0.py
"""
import sys
from mpmath import mp, mpf, sqrt as msqrt, findroot, cos as mcos
from mpmath import iv
from ivutil import ival, setprec, mag, lo, hi, width
from krawczyk import verify_zero, refine, UNIQUE, NO_ZERO, INCONCLUSIVE

setprec(40)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


# --------------------------------------------------------------------------------------------------------
# 1. sqrt(2) as the root of x^2 - 2, against mpmath's own high-precision value
# --------------------------------------------------------------------------------------------------------
print('\n[1] x^2 - 2 = 0 on [1, 2]')
f = lambda X: [X[0] * X[0] - ival(2)]
Df = lambda X: [[ival(2) * X[0]]]

v = refine(f, Df, [ival(1, 2)])
check('closes to UNIQUE', v.status == UNIQUE, v.reason)
if v.proved:
    true = msqrt(mpf(2))
    a, b = lo(v.box[0]), hi(v.box[0])
    check('enclosure contains the true sqrt(2)', a <= true <= b,
          f'[{mp.nstr(a, 25)}, {mp.nstr(b, 25)}]')
    check('enclosure is tight (half-width < 1e-20)', (b - a) / 2 < mpf('1e-20'),
          f'half-width {mp.nstr((b - a) / 2, 5)}')

# --------------------------------------------------------------------------------------------------------
# 2. It must REFUSE a box holding two roots. This is the test that matters.
# --------------------------------------------------------------------------------------------------------
print('\n[2] the same equation on [-2, 2], which contains BOTH roots')
v2 = verify_zero(f, Df, [ival(-2, 2)])
check('does not claim UNIQUE', v2.status != UNIQUE, f'{v2.status}: {v2.reason}')

# --------------------------------------------------------------------------------------------------------
# 3. It must prove absence where there is no root
# --------------------------------------------------------------------------------------------------------
print('\n[3] x^2 - 2 = 0 on [5, 6], which contains no root')
v3 = verify_zero(f, Df, [ival(5, 6)])
check('returns NO_ZERO', v3.status == NO_ZERO, v3.reason)

# --------------------------------------------------------------------------------------------------------
# 4. A degenerate root, where the Jacobian vanishes: x^2 = 0. Uniqueness is genuinely unprovable by this test,
#    because Df(X) straddles zero, so no Y preconditions it. The right behaviour is to decline, forever.
# --------------------------------------------------------------------------------------------------------
print('\n[4] x^2 = 0 on [-1, 1] — a double root, Jacobian vanishes')
g = lambda X: [X[0] * X[0]]
Dg = lambda X: [[ival(2) * X[0]]]
v4 = refine(g, Dg, [ival(-1, 1)], shrinks=6)
check('does not claim UNIQUE for a degenerate root', v4.status != UNIQUE, f'{v4.status}: {v4.reason}'[:90])

# --------------------------------------------------------------------------------------------------------
# 5. A transcendental root: cos(x) - x = 0, the Dottie number
# --------------------------------------------------------------------------------------------------------
print('\n[5] cos(x) - x = 0 on [0, 1]')
h = lambda X: [iv.cos(X[0]) - X[0]]
Dh = lambda X: [[-iv.sin(X[0]) - ival(1)]]
v5 = refine(h, Dh, [ival(0, 1)])
check('closes to UNIQUE', v5.status == UNIQUE, v5.reason)
if v5.proved:
    true = findroot(lambda x: mcos(x) - x, mpf('0.739'))
    a, b = lo(v5.box[0]), hi(v5.box[0])
    check('enclosure contains the true root', a <= true <= b, f'[{mp.nstr(a, 25)}, {mp.nstr(b, 25)}]')

# --------------------------------------------------------------------------------------------------------
# 6. A 2-dimensional system with an exactly known solution:
#       x^2 + y^2 = 4,   x - y = 0     ->   x = y = sqrt(2)
# --------------------------------------------------------------------------------------------------------
print('\n[6] 2D: x^2 + y^2 - 4 = 0, x - y = 0 on [1,2]x[1,2]')
F = lambda X: [X[0] * X[0] + X[1] * X[1] - ival(4), X[0] - X[1]]
DF = lambda X: [[ival(2) * X[0], ival(2) * X[1]], [ival(1), ival(-1)]]
v6 = refine(F, DF, [ival(1, 2), ival(1, 2)])
check('closes to UNIQUE', v6.status == UNIQUE, v6.reason)
if v6.proved:
    true = msqrt(mpf(2))
    ok = all(lo(c) <= true <= hi(c) for c in v6.box)
    check('both components enclose sqrt(2)', ok,
          f'x in [{mp.nstr(lo(v6.box[0]), 20)}, {mp.nstr(hi(v6.box[0]), 20)}]')

# --------------------------------------------------------------------------------------------------------
# 7. Soundness under a deliberately terrible preconditioner. A bad Y must never produce a WRONG theorem - at
#    worst it fails to close. This is the property that lets the search half of the system be unrigorous.
# --------------------------------------------------------------------------------------------------------
print('\n[7] soundness with a deliberately bad Y')
badY = [[ival('0.01')]]
v7 = verify_zero(f, Df, [ival(1, 2)], Y=badY)
ok = v7.status != UNIQUE or (lo(v7.box[0]) <= msqrt(mpf(2)) <= hi(v7.box[0]))
check('a bad Y never yields a false enclosure', ok, f'{v7.status}')

print('\n' + ('R0: ALL PASS' if not FAILS else f'R0: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
