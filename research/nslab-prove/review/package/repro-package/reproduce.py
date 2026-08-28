"""Clean-room reproduction runner — R4b certificates vs the independent auditors.

Run:  python reproduce.py          (Python 3.9+, standard library only — no packages, no network)

This script verifies the file manifest, then runs the four independent audits against the four shipped
certificates, in ladder order. It prints one verdict per rung and exits 0 only if every rung ACCEPTs.

What ACCEPT means: an independently implemented certification machine — exact rational arithmetic, its own
pi by Machin's formula, its own tail bounds, its own inertia counting — re-derives each certified object
from the certificate's own data and finds every claimed interval consistent with its own. What it does NOT
mean: an independently proved theorem. See README-REPRODUCE.md.
"""
import hashlib
import io
import json
import os
import platform
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'auditors'))

BANNED = ('mpmath', 'sici', 'ivutil', 'problem_dg_profile', 'lehmann', 'emit_certs')


def check_manifest():
    """Every shipped file must hash to its MANIFEST entry; refuse to run on a tampered package."""
    path = os.path.join(HERE, 'MANIFEST.sha256')
    bad = 0
    for line in io.open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        want, rel = line.split(None, 1)
        with open(os.path.join(HERE, rel), 'rb') as f:
            got = hashlib.sha256(f.read()).hexdigest()
        if got != want:
            print('MANIFEST MISMATCH:', rel)
            print('  expected', want)
            print('  got     ', got)
            bad += 1
    if bad:
        print('REFUSING TO RUN: %d file(s) differ from the manifest.' % bad)
        sys.exit(2)
    print('manifest ok — every file hashes as shipped')


def demonstrate_refusal():
    """The other half of the experiment: a falsified certificate must be REJECTED.

    Each certificate is loaded, tampered IN MEMORY (the shipped files are never touched, so the manifest
    stays intact), and re-audited. One canonical corruption per rung. To see the third refusal layer, edit
    any byte of any shipped file and run `python reproduce.py` — the manifest check refuses before any
    mathematics runs.
    """
    import auditor_r4b
    import auditor_r4b_a2
    import auditor_r4b_lehmann
    import auditor_r4b_final
    from fractions import Fraction

    def load(name):
        with io.open(os.path.join(HERE, 'certificates', name), encoding='utf-8') as f:
            return json.load(f)

    def t_gram(doc):
        lo, hi = doc['gram']['1,1']
        doc['gram']['1,1'] = [str(Fraction(lo) + Fraction(1, 1000)), str(Fraction(hi) + Fraction(1, 1000))]
        return doc, 'Gram entry A_1,1 shifted by 1e-3'

    def t_a2(doc):
        lo, hi = doc['a2']['1,1']
        doc['a2']['1,1'] = [str(Fraction(lo) + Fraction(1, 1000)), str(Fraction(hi) + Fraction(1, 1000))]
        return doc, 'A2 entry shifted by 1e-3'

    def t_leh(doc):
        doc['upper'][0] = str(Fraction(doc['upper'][0]) - Fraction(1, 10 ** 12))
        return doc, 'claimed U_1 understated below the sup its own bracket supports'

    def t_fin(doc):
        doc['enclosures'][1][0], doc['enclosures'][2][0] = doc['enclosures'][2][0], doc['enclosures'][1][0]
        return doc, 'assembly corruption: L_2 and L_3 swapped'

    cases = [('Rung 1', auditor_r4b, 'certificate-r4b-gram.json', t_gram),
             ('Rung 2', auditor_r4b_a2, 'certificate-r4b-a2.json', t_a2),
             ('Rung 3', auditor_r4b_lehmann, 'certificate-r4b-lehmann.json', t_leh),
             ('Rung 4', auditor_r4b_final, 'certificate-r4b-final.json', t_fin)]
    print()
    print('refusal demonstration — every tampered certificate must be REJECTED:')
    all_ok = True
    for label, mod, cert, tamper in cases:
        doc, what = tamper(load(cert))
        verdict, _findings = mod.audit_doc(doc)
        ok = verdict == 'REJECT'
        all_ok = all_ok and ok
        print('  %s  %-58s -> %-7s %s' % (label, what, verdict, 'ok' if ok else 'PROBLEM: expected REJECT'))
    print()
    if all_ok:
        print('RESULT: every falsified certificate was refused. Together with the ACCEPT run this is the')
        print('experiment: valid -> ACCEPT, tampered -> REJECT, altered package -> manifest refusal.')
        return 0
    print('RESULT: a tampered certificate was NOT rejected — report this immediately; it is a finding')
    print('about the auditors, and a serious one.')
    return 1


def main():
    print('=' * 90)
    print('R4b clean-room reproduction')
    print('=' * 90)
    print('python %s on %s' % (platform.python_version(), platform.platform()))
    check_manifest()

    # Import AFTER the manifest check. If any auditor secretly needed prover code, these imports would
    # fail loudly here, because no prover file ships in this package.
    import auditor_r4b
    import auditor_r4b_a2
    import auditor_r4b_lehmann
    import auditor_r4b_final

    for name, mod in (('auditor_r4b', auditor_r4b), ('auditor_r4b_a2', auditor_r4b_a2),
                      ('auditor_r4b_lehmann', auditor_r4b_lehmann), ('auditor_r4b_final', auditor_r4b_final)):
        loaded = {m.split('.')[0] for m in sys.modules}
        hit = sorted(loaded & set(BANNED))
        if hit:
            print('CLEAN-ROOM VIOLATION: %s pulled in %s' % (name, hit))
            sys.exit(2)
    print('clean room ok — no prover module is loadable or loaded')
    print()

    rungs = [
        ('Rung 1  Gram matrix          ', auditor_r4b, 'certificate-r4b-gram.json'),
        ('Rung 2  A2 + tail            ', auditor_r4b_a2, 'certificate-r4b-a2.json'),
        ('Rung 3  Lehmann pencil       ', auditor_r4b_lehmann, 'certificate-r4b-lehmann.json'),
        ('Rung 4  assembled enclosures ', auditor_r4b_final, 'certificate-r4b-final.json'),
    ]
    all_ok = True
    for label, mod, cert in rungs:
        t0 = time.time()
        verdict, findings = mod.audit_file(os.path.join(HERE, 'certificates', cert))
        dt = time.time() - t0
        ok = verdict == 'ACCEPT'
        all_ok = all_ok and ok
        print('%s %-7s (%.0f s, %d findings)' % (label, verdict, dt, len(findings)))
        for f in findings:
            if f.startswith('REJECT'):
                print('    ', f)
    print()
    if all_ok and '--demonstrate-refusal' in sys.argv:
        rc = demonstrate_refusal()
        if rc:
            return rc
    if all_ok:
        print('RESULT: ACCEPT at every rung — the reproduction succeeded.')
        print('This reproduces the audit verdict. It does not, by itself, prove the theorem;')
        print('the mathematical claim is the frozen statement document, and the boundary between')
        print('"independently audited certificate" and "independently proved theorem" stands.')
        return 0
    print('RESULT: at least one rung did not ACCEPT. Please report the complete output above,')
    print('including the findings lines, your Python version, and the platform line — a failed')
    print('reproduction is a result, and exactly what this package exists to detect.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
