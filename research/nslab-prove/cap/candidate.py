"""`candidate.json` — the A → B half of the frozen contract, made real.

`certificate.py` implemented B → C. This is the other side: what the Conjecture Engine hands the Verifier. The
architecture document specifies its five fields (problem, discretisation, profile, operator, proposed radius);
everything below that is a design rule this file adds, and each one exists because of a specific way the pair can
go wrong.

Rule 1 — exact rationals, inherited
-----------------------------------
Same rule as the certificate, for the same reason and with the same scar behind it. Every number B needs is
carried as an exact rational, never a decimal rendering of a floating-point value. On 2026-08-25 an R4
perturbation was written as `'1.4901161193847656e-08'`, meaning 2⁻²⁶, and that string is 2⁻²⁶ truncated at 17
digits: the prover perturbed by one number while the certificate recorded another, and `auditor_r4.py` rejected a
genuine certificate over the resulting 1.7e-17. A schema that accepts decimal strings invites that again.

Rule 2 — a candidate carries **no verdict**
-------------------------------------------
Machine A makes no claims. `validate` therefore *rejects* a candidate carrying any of `status`, `verdict`,
`proved`, `closed` or `certificate`. This is a structural guard in the same spirit as the auditor's "imports
nothing from the prover" test: the frozen contract says A may never weaken the test it is judged by, and the
cheapest way for that to erode is for A to start shipping opinions that B learns to read.

Rule 3 — the norm must be compatible with the claimed regularity
----------------------------------------------------------------
This is the field-format rule that earns the module its place, and it comes from the De Gregorio-on-the-circle
target. The `ℓ¹_ν` norm is **not neutral**: R1b's own certificate states that `ν > 1` means the solution is
*analytic in a strip of half-width log ν*. So grading a **C^α** profile in `ℓ¹_ν` with `ν > 1` is not a loose
choice, it is a category error — the space asserts smoothness the object does not have, and the certificate that
came out would be about a different function than the one intended.

    ell1_nu, ν > 1   requires  regularity = analytic
    ell1_nu, ν = 1   requires  analytic, or Hölder with α > 1/2   (absolute summability, via Bernstein)
    sobolev, Ḣ^s     accepts   analytic or Hölder

A C^α self-similar profile generally carries an `|x|^α`-type cusp, whose Fourier coefficients decay
**algebraically**. Every truncation bound in `cap/` today assumes exponential decay, so this field is also the
flag telling B that its usual tail estimate does not apply. Refusing the combination here is far cheaper than
discovering it inside a tail bound that quietly closes.

Rule 4 — the profile is hashed
------------------------------
Over its canonical exact-rational rendering, so drift between the file A wrote and the file B read is detectable
rather than assumed away.

What this file does NOT do
--------------------------
It does not judge whether a candidate is any good. A hopeless profile is a valid candidate — B refuses it, that
is B's job, and the architecture is explicit that a bad candidate costs electricity and never correctness.
`validate` checks that a candidate is *well-formed and coherent*, never that it is *close*.
"""
import hashlib
import json
from fractions import Fraction

CONTRACT_VERSION = '1.0'

# A candidate that carries any of these is a candidate making a claim, which is the one thing A may never do.
FORBIDDEN_KEYS = ('status', 'verdict', 'proved', 'closed', 'certificate', 'accepted')

NORMS = ('ell1_nu', 'sobolev')
REGULARITY = ('analytic', 'holder')


class Refusal(Exception):
    """Raised when a candidate is not well-formed. Not a boolean, and not a verdict about the mathematics."""


def frac(x):
    """Coerce to an exact Fraction. Accepts int, Fraction, or a string like '3/2'.

    A float is refused outright rather than converted: `Fraction(0.1)` silently yields the binary double, which is
    exactly the ambiguity the exact-rational rule exists to remove.
    """
    if isinstance(x, Fraction):
        return x
    if isinstance(x, int):
        return Fraction(x)
    if isinstance(x, float):
        raise Refusal('float %r in a candidate: pass an exact Fraction or a string like "1/10", so that the '
                      'number in the file is the number that was meant' % x)
    return Fraction(str(x))


def _fs(x):
    return str(frac(x))


def profile_hash(coeffs):
    """SHA-256 over the canonical exact-rational rendering of the profile."""
    payload = ';'.join('%s,%s' % (_fs(re), _fs(im)) for re, im in coeffs)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def check_norm_regularity(norm, weight, regularity, alpha=None):
    """Rule 3. Returns None if the combination is coherent; raises Refusal with the reason if it is not."""
    if norm not in NORMS:
        raise Refusal('unknown norm %r; B cannot grade in a space it has not been told about' % norm)
    if regularity not in REGULARITY:
        raise Refusal('unknown regularity %r' % regularity)
    if regularity == 'holder' and alpha is None:
        raise Refusal('regularity "holder" needs its exponent alpha: the admissible norms depend on it')

    if norm == 'ell1_nu':
        w = frac(weight)
        if w < 1:
            raise Refusal('ell1_nu with nu = %s < 1 is not a Banach algebra here; nu >= 1 is required' % w)
        if w > 1 and regularity != 'analytic':
            raise Refusal(
                'ell1_nu with nu = %s > 1 asserts analyticity in a strip of half-width log(nu) - that is what '
                'the R1b certificate literally states - but the profile is declared %s. The space would be '
                'claiming smoothness the object does not have.' % (w, regularity))
        if w == 1 and regularity == 'holder' and frac(alpha) <= Fraction(1, 2):
            raise Refusal(
                'ell1_nu at nu = 1 needs absolutely summable Fourier coefficients, which C^alpha supplies only '
                'for alpha > 1/2 (Bernstein); alpha = %s does not. Use a Sobolev norm.' % frac(alpha))
    return None


def build(problem, ansatz, params, discretisation, profile, operator, proposed_r, notes=None):
    """Assemble a candidate. Raises Refusal rather than emitting something B would have to second-guess.

    problem       : str, the equation ('degregorio_circle', 'clm', 'ccf', ...)
    ansatz        : dict of exact rationals - the self-similar exponents, e.g. {'c_omega': -1, 'c_l': -1}
    params        : dict of exact rationals - equation parameters, e.g. {'a': 1} for the gCLM family
    discretisation: dict with basis (str), modes (int), precision_bits (int), regularity, and alpha if Hölder
    profile       : list of (re, im) exact rationals
    operator      : dict with norm, weight, and optionally the approximate inverse
    proposed_r    : the radius A suggests B attempt. A SUGGESTION - B decides, and may refuse it.
    """
    d = dict(discretisation)
    for req in ('basis', 'modes', 'precision_bits', 'regularity'):
        if req not in d:
            raise Refusal('discretisation is missing %r; B cannot grade what it has not been told' % req)
    o = dict(operator)
    for req in ('norm', 'weight'):
        if req not in o:
            raise Refusal('operator is missing %r' % req)

    check_norm_regularity(o['norm'], o['weight'], d['regularity'], d.get('alpha'))

    if int(d['modes']) != len(profile):
        raise Refusal('discretisation says %d modes but the profile carries %d coefficients'
                      % (int(d['modes']), len(profile)))

    doc = {
        'contract': CONTRACT_VERSION,
        'kind': 'candidate',
        'problem': problem,
        'ansatz': {k: _fs(v) for k, v in ansatz.items()},
        'params': {k: (v if isinstance(v, int) else _fs(v)) for k, v in params.items()},
        'discretisation': {
            'basis': d['basis'],
            'modes': int(d['modes']),
            'precision_bits': int(d['precision_bits']),
            'regularity': d['regularity'],
            **({'alpha': _fs(d['alpha'])} if 'alpha' in d else {}),
            # Set by A when it knows the coefficients decay only algebraically, which a C^alpha cusp does. B's
            # usual tail bounds assume exponential decay and must not be applied silently when this is true.
            **({'decay': d['decay']} if 'decay' in d else {}),
        },
        'profile': [[_fs(re), _fs(im)] for re, im in profile],
        'profile_sha256': profile_hash(profile),
        'operator': {
            'norm': o['norm'],
            'weight': _fs(o['weight']),
            **({'approx_inverse': [[_fs(v) for v in row] for row in o['approx_inverse']]}
               if 'approx_inverse' in o else {}),
        },
        'proposed': {'r': _fs(proposed_r)},
        'notes': notes or {},
    }
    validate(doc)
    return doc


def validate(doc):
    """Check a candidate is well-formed and coherent. Raises Refusal with a reason, or returns None."""
    if doc.get('kind') != 'candidate':
        raise Refusal('not a candidate document (kind = %r)' % doc.get('kind'))
    if doc.get('contract') != CONTRACT_VERSION:
        raise Refusal('contract version %r, expected %r' % (doc.get('contract'), CONTRACT_VERSION))

    for k in FORBIDDEN_KEYS:                      # Rule 2
        if k in doc:
            raise Refusal('a candidate carries no verdict, and this one has %r. Machine A proposes; only B '
                          'concludes, and the contract holds only while that stays true.' % k)

    d, o = doc['discretisation'], doc['operator']
    check_norm_regularity(o['norm'], o['weight'], d['regularity'], d.get('alpha'))

    prof = [(frac(re), frac(im)) for re, im in doc['profile']]
    if len(prof) != int(d['modes']):
        raise Refusal('modes/profile length mismatch: %d vs %d' % (int(d['modes']), len(prof)))
    if profile_hash(prof) != doc['profile_sha256']:
        raise Refusal('profile hash mismatch: the coefficients are not the ones this candidate was written with')
    if frac(doc['proposed']['r']) <= 0:
        raise Refusal('proposed radius must be positive')
    return None


def write(path, doc):
    validate(doc)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=2)
    return doc


def read(path):
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    validate(doc)
    return doc
