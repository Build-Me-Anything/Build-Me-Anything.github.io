"""Stage 6 — the numerical sanity layer. Deliberately NON-RIGOROUS, and an attack instrument only.

    python sanity_check.py            # ~10 s with numpy

Purpose: try to FALSIFY the certified enclosures by wholly conventional means. A high-precision-adjacent
float64 computation of the eigenvalues of M must land inside the certified intervals read from the Rung 4
certificate; if it lands outside, THE PROJECT STOPS AND INVESTIGATES. Nothing here is allowed to repair,
widen, or feed back into the certificate machinery — this file reads the certificate JSON and writes only
its own report.

Independence of route (not of author): no closed forms, no Si/Ci/Cin, no exact rationals, no interval
arithmetic, no prover or auditor module — the import gate below enforces it. The Gram entries are computed
by direct numerical quadrature of the defining oscillatory integral

    A_nm = 4 pi (-1)^(n+m) n m * I(n,m),   I(n,m) = int_0^inf  xi sin^2(xi) / ((n^2pi^2-xi^2)(m^2pi^2-xi^2)) dxi

split at every multiple of pi (each removable singularity is an interval endpoint, so every open panel is
smooth), composite Gauss-Legendre per panel, truncated at R = N_PANELS*pi with the O(1/R^2) truncation noted
in the report. The eigenvalues come from numpy's symmetric eigensolver on B^(-1/2) A B^(-1/2) at three
Galerkin sizes, so the Galerkin convergence direction (from below) is visible rather than assumed.
"""
import json
import os
import sys

FORBIDDEN = ('mpmath', 'sici', 'ivutil', 'problem_dg_profile', 'lehmann', 'auditor_r4b', 'auditor')
for name in FORBIDDEN:
    if name in sys.modules:
        raise SystemExit('sanity layer contaminated: %s already imported' % name)

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CERT = os.path.join(HERE, '..', 'repro', 'package', 'certificates', 'certificate-r4b-final.json')

N_PANELS = 4000          # integrate to R = 4000*pi; tail ~ 1/(4R^2) ~ 1.6e-9 relative-ish
GL_NODES = 24            # Gauss-Legendre nodes per panel: smooth panels, so this is far beyond float64 needs
K_LADDER = (16, 20, 24)  # Galerkin sizes; convergence is from below and should be visibly settled


def gram_entries(kmax):
    """A_nm for 1 <= n, m <= kmax by composite GL quadrature of the defining integral. Vectorised."""
    x, w = np.polynomial.legendre.leggauss(GL_NODES)          # nodes on [-1, 1]
    starts = np.arange(N_PANELS) * np.pi
    mid, half = starts + np.pi / 2, np.pi / 2
    xi = (mid[:, None] + half * x[None, :]).ravel()           # all quadrature points
    wt = np.tile(w * half, N_PANELS)
    s2 = np.sin(xi) ** 2
    base = xi * s2 * wt                                       # shared factor of every integrand

    denoms = {n: (n * np.pi) ** 2 - xi ** 2 for n in range(1, kmax + 1)}
    A = np.empty((kmax, kmax))
    for n in range(1, kmax + 1):
        for m in range(n, kmax + 1):
            I = np.sum(base / (denoms[n] * denoms[m]))
            A[n - 1, m - 1] = A[m - 1, n - 1] = 4 * np.pi * ((-1) ** (n + m)) * n * m * I
    return A


def eigenvalues(A, k):
    n = np.arange(1, k + 1)
    scale = 1.0 / (n * np.pi)                                 # B^(-1/2), B = diag((n pi)^2)
    C = A[:k, :k] * scale[:, None] * scale[None, :]
    return np.sort(np.linalg.eigvalsh(C))[::-1]


def main():
    with open(CERT, encoding='utf-8') as f:
        doc = json.load(f)
    from fractions import Fraction
    enclosures = [(float(Fraction(a)), float(Fraction(b))) for a, b in doc['enclosures']]

    A = gram_entries(max(K_LADDER))
    print('conventional route: %d GL points, panels to R = %d*pi, float64 throughout' %
          (N_PANELS * GL_NODES, N_PANELS))
    ladder = {k: eigenvalues(A, k) for k in K_LADDER}
    for k in K_LADDER:
        print('  K = %2d : ' % k + '  '.join('%.9f' % v for v in ladder[k][:3]))

    lam = ladder[max(K_LADDER)]
    print()
    verdict_ok = True
    report = []
    for j, (L, U) in enumerate(enclosures, 1):
        v = lam[j - 1]
        inside = L <= v <= U
        verdict_ok = verdict_ok and inside
        margin = min(v - L, U - v)
        line = 'lambda_%d = %.9f  vs  [%.7f, %.7f]  -> %s (margin %.2e)' % (
            j, v, L, U, 'INSIDE' if inside else 'OUTSIDE', margin)
        print(line)
        report.append(line)

    print()
    if verdict_ok:
        print('SANITY: PASS — the conventional computation lands inside every certified interval.')
        print('This proves nothing (float64, truncated quadrature, finite Galerkin); it merely FAILED')
        print('TO FALSIFY the certificate. That is all it is for.')
    else:
        print('SANITY: STOP — a conventional value lies OUTSIDE a certified interval.')
        print('Do not touch the certificate. Investigate before anything else happens in this line.')

    with open(os.path.join(HERE, 'REPORT.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Stage 6 numerical sanity report\n\n')
        f.write('Route: float64 composite Gauss-Legendre (%d nodes/panel, %d panels to R = %d*pi) on the\n'
                'defining oscillatory integral; numpy eigvalsh on B^(-1/2)AB^(-1/2); Galerkin K = %s.\n'
                'No closed forms, no special functions, no interval arithmetic, no prover/auditor code.\n\n'
                % (GL_NODES, N_PANELS, N_PANELS, list(K_LADDER)))
        f.write('Known non-rigorous error sources: quadrature truncation ~1/(4R^2) ~ %.1e; float64\n'
                'roundoff; Galerkin truncation (from below - the K-ladder above shows its size).\n\n'
                % (1.0 / (4 * (N_PANELS * np.pi) ** 2)))
        for k in K_LADDER:
            f.write('    K = %2d : %s\n' % (k, '  '.join('%.9f' % v for v in ladder[k][:3])))
        f.write('\n')
        for line in report:
            f.write(line + '\n')
        f.write('\nVERDICT: %s\n' % ('PASS — failed to falsify' if verdict_ok else 'STOP — investigate'))
        f.write('\nThe one-way valve: this layer reads the certificate and writes only this report. It can\n')
        f.write('stop the project; it can never repair the certificate.\n')
    print('\nwrote REPORT.md')
    return 0 if verdict_ok else 1


if __name__ == '__main__':
    sys.exit(main())
