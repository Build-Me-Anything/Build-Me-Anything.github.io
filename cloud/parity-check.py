#!/usr/bin/env python3
"""Grade a rented GPU against an archived NSLab run before spending money on it.

A rented card is an unfamiliar instrument. Same code, same equations, different silicon, a different cuFFT plan
and possibly a different CuPy build - so it gets graded exactly as every run in this programme is graded, and the
grade is a number, not a glance at two log lines.

    python3 parity-check.py <fresh final.json> <archived final.json>

Compares the two series step for step over the overlap and fails (exit 1) if any tracked quantity has drifted
further than a float64 pseudo-spectral solver should drift in the deterministic window.

Why these thresholds. Both runs integrate the same initial condition with the same adaptive-CFL time step, so a
correct card reproduces the archive to accumulated round-off: ~1e-16 per step, a few 1e-13 by t = 2. WARN at 1e-9
is four decades of headroom; FAIL at 1e-6 means something is actually wrong - a bad wheel, a card with ECC errors,
FFT precision quietly downgraded (TF32 paths), or the wrong case. Run the comparison inside t < 8, before the
reconnection burst: NS-004 measured this flow amplifying perturbations at ~3 e-folds per time unit after t ~ 8.5,
so beyond the burst two correct cards legitimately disagree and parity means nothing.
"""
import json, sys

KEYS = [('t', 1e-12), ('E', 1e-9), ('Z', 1e-9), ('eps', 1e-9), ('omMax', 1e-8), ('Pspec', 1e-8)]
FAIL = 1e-6

def main(fresh, archived):
    a = json.load(open(fresh, encoding='utf-8'))
    b = json.load(open(archived, encoding='utf-8'))
    for f, r in (('N', 'grid'), ('Re', 'Reynolds number'), ('ic', 'initial condition'), ('cfl', 'CFL')):
        if a['case'][f] != b['case'][f]:
            print(f"PARITY FAIL: {r} differs - fresh {a['case'][f]} vs archived {b['case'][f]}"); return 1
    if a['precision'] != b['precision']:
        print(f"PARITY FAIL: precision differs - fresh {a['precision']} vs archived {b['precision']}"); return 1
    sa, sb = a['series'], b['series']
    n = min(len(sa['t']), len(sb['t']))
    if n < 10:
        print(f"PARITY FAIL: only {n} common steps - the fresh run did not get far enough to say anything"); return 1
    if sa['t'][n - 1] > 8.0:
        print(f"PARITY WARN: overlap reaches t = {sa['t'][n-1]:.2f}; past t ~ 8.5 this flow amplifies perturbations")
        print("             at ~3 e-folds per time unit (NS-004), so late-time disagreement is physics, not the card.")
    worst, bad, warn = {}, [], []
    for k, tol in KEYS:
        scale = max(abs(v) for v in sb[k][:n]) or 1.0
        w = max(abs(sa[k][i] - sb[k][i]) / scale for i in range(n))
        worst[k] = w
        if w > FAIL: bad.append((k, w, tol))
        elif w > tol: warn.append((k, w, tol))
    print(f"parity over {n} steps to t = {sa['t'][n-1]:.4f}  ({a['device']} vs archived {b['device']})")
    for k, tol in KEYS:
        mark = 'FAIL' if worst[k] > FAIL else ('warn' if worst[k] > tol else 'ok  ')
        print(f"  {k:<7} max rel diff {worst[k]:.3e}   tol {tol:.0e}   {mark}")
    if bad:
        print("PARITY FAIL: " + ', '.join(f"{k} {w:.2e} (> {FAIL:.0e})" for k, w, _ in bad))
        print("Do not start the long run. Check: the CuPy wheel matches the driver's CUDA version; the card is not")
        print("running FFTs at reduced precision; nvidia-smi -q reports no ECC errors; the case really is the same.")
        return 1
    if warn:
        print("PARITY WARN: " + ', '.join(f"{k} {w:.2e} (> {t:.0e})" for k, w, t in warn) + " - larger than round-off, but not alarming.")
    print("PARITY PASS - this card reproduces the archive.")
    return 0

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
