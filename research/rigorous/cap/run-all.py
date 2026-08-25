"""Run every CAP suite in ladder order and refuse to report success unless all of them pass.

Same role as `node build.js --verify` on the tool side: one command, and it fails loudly.
"""
import subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
SUITES = [('R0   Krawczyk root enclosure', 'test_r0.py'),
          ('R1a  Constantin-Lax-Majda, closed-form route', 'test_r1.py'),
          ('R1b  radii polynomials in ell^1_nu (the route that transfers)', 'test_r1b.py'),
          ('R2   De Gregorio steady state, Galerkin', 'test_r2.py'),
          ('R3   preconditioned Burgers: the derivative-loss cure, and its limit', 'test_r3.py'),
          ('C    Machine C: independent audit in exact rational arithmetic', 'test_audit.py')]

# Machine C audits certificates, so they have to exist. Emitting them here rather than inside the audit
# suite keeps the auditor free of any dependency on the prover - including the dependency of having
# imported it to generate its own input.
print('=' * 96)
print('emitting certificates for the auditor')
print('=' * 96)
subprocess.run([sys.executable, 'emit_certs.py', 'certs'], cwd=HERE)

failed = []
for label, script in SUITES:
    print('=' * 96)
    print(label)
    print('=' * 96)
    r = subprocess.run([sys.executable, script], cwd=HERE)
    if r.returncode != 0:
        failed.append(label)

print('=' * 96)
if failed:
    print('CAP SUITES: FAILURE in -> ' + '; '.join(failed))
    sys.exit(1)
print(f'CAP SUITES: ALL PASS ({len(SUITES)} suites)')
