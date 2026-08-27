"""Assemble the clean-room reproduction package deterministically from the repository.

    python make-package.py            ->  builds/refreshes  repro/package/

Copies the auditor closure, the four certificates, the frozen statement and the contracts, plus the runner
and reviewer README from this directory; writes PROVENANCE.md (git commits/tags) and MANIFEST.sha256 over
everything. Refuses to include any prover file, and asserts the auditor closure imports nothing banned.
"""
import ast
import hashlib
import io
import os
import shutil
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
NSP = os.path.dirname(HERE)
CAP = os.path.join(NSP, 'cap')
PKG = os.path.join(HERE, 'package')

AUDITORS = ['auditor.py', 'auditor_r23.py', 'auditor_r01.py', 'auditor_r4b.py',
            'auditor_r4b_a2.py', 'auditor_r4b_lehmann.py', 'auditor_r4b_final.py']
CERTS = ['certificate-r4b-gram.json', 'certificate-r4b-a2.json',
         'certificate-r4b-lehmann.json', 'certificate-r4b-final.json']
DOCS = ['Certified Spectral Enclosure for the De Gregorio Profile Operator — Statement.md',
        'R2-AUDIT-CONTRACT.md', 'R3-AUDIT-CONTRACT.md', 'R4-AUDIT-CONTRACT.md']
BANNED_IMPORTS = {'mpmath', 'sici', 'ivutil', 'problem_dg_profile', 'lehmann', 'problem_eigen',
                  'problem_degregorio', 'problem_burgers', 'problem_quadratic', 'problem_clm_fourier',
                  'clm', 'ell1', 'radiipoly', 'krawczyk', 'certificate', 'emit_certs'}
STDLIB_OK = {'json', 'math', 'fractions', 'os', 'sys', 'io', 'time', 'hashlib', 'platform'}


def check_closure():
    names = {os.path.splitext(a)[0] for a in AUDITORS}
    for a in AUDITORS:
        src = io.open(os.path.join(CAP, a), encoding='utf-8').read()
        imported = set()
        for node in ast.walk(ast.parse(src)):
            if isinstance(node, ast.Import):
                imported.update(x.name.split('.')[0] for x in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split('.')[0])
        bad = imported & BANNED_IMPORTS
        assert not bad, '%s imports banned module(s): %s' % (a, sorted(bad))
        outside = imported - names - STDLIB_OK
        assert not outside, '%s imports outside the closure: %s' % (a, sorted(outside))
    print('closure ok — %d auditor files, stdlib + each other only' % len(AUDITORS))


def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True, text=True,
                          cwd=NSP).stdout.strip()


def _clear(pkg):
    """Empty the package dir. OneDrive holds transient locks on fresh directories, so retry, then fall back
    to deleting files in place — stale files are the hazard, stale empty directories are not."""
    if not os.path.isdir(pkg):
        return
    for _ in range(5):
        try:
            shutil.rmtree(pkg)
            return
        except PermissionError:
            time.sleep(1.0)
    for root, _dirs, files in os.walk(pkg):
        for fn in files:
            os.remove(os.path.join(root, fn))


def main():
    check_closure()
    _clear(PKG)
    os.makedirs(os.path.join(PKG, 'auditors'), exist_ok=True)
    os.makedirs(os.path.join(PKG, 'certificates'), exist_ok=True)
    os.makedirs(os.path.join(PKG, 'statement'), exist_ok=True)

    for a in AUDITORS:
        shutil.copy2(os.path.join(CAP, a), os.path.join(PKG, 'auditors', a))
    for c in CERTS:
        shutil.copy2(os.path.join(CAP, 'certs', c), os.path.join(PKG, 'certificates', c))
    for d in DOCS:
        shutil.copy2(os.path.join(NSP, d), os.path.join(PKG, 'statement', d))
    shutil.copy2(os.path.join(HERE, 'reproduce.py'), os.path.join(PKG, 'reproduce.py'))
    shutil.copy2(os.path.join(HERE, 'README-REPRODUCE.md'), os.path.join(PKG, 'README-REPRODUCE.md'))

    head = git('rev-parse', '--short', 'HEAD')
    tags = git('tag', '-l')
    prov = io.open(os.path.join(PKG, 'PROVENANCE.md'), 'w', encoding='utf-8', newline='\n')
    prov.write('# Provenance\n\n')
    prov.write('Assembled from https://github.com/Build-Me-Anything/Build-Me-Anything.github.io\n')
    prov.write('(`research/nslab-prove/`), commit `%s`.\n\n' % head)
    prov.write('The frozen statement is tag `r4b-statement-v1` = `0d7c663`; the completed audit is tag\n')
    prov.write('`r4b-audit-complete-v1` = `8ccecac`. Tags present at assembly: %s.\n\n' % ', '.join(tags.split()))
    prov.write('Known statement errata (labels only, mathematics unaffected — AUDIT-LOG AL-018): the\n')
    prov.write('eigenvalue bracket cited as "HTW Corollary 3.7" is their **Corollary 3.9**; the `c(f) != 0`\n')
    prov.write('result cited as "Theorem 3.5" is their **Theorem 3.7**. The frozen document is deliberately\n')
    prov.write('not edited; the log entry is the correction of record.\n\n')
    prov.write('Every file in this package other than `reproduce.py`, `README-REPRODUCE.md`, this file and\n')
    prov.write('`MANIFEST.sha256` is byte-identical to the repository at the commit above.\n')
    prov.close()

    lines = ['# SHA-256 manifest — verified by reproduce.py before anything runs']
    for root, _dirs, files in os.walk(PKG):
        for fn in sorted(files):
            if fn == 'MANIFEST.sha256':
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, PKG).replace(os.sep, '/')
            with open(p, 'rb') as f:
                lines.append('%s  %s' % (hashlib.sha256(f.read()).hexdigest(), rel))
    io.open(os.path.join(PKG, 'MANIFEST.sha256'), 'w', encoding='utf-8', newline='\n').write(
        '\n'.join(sorted(lines)) + '\n')
    print('package assembled at', PKG, 'from commit', head)
    print('files:', sum(len(f) for _r, _d, f in os.walk(PKG)))


if __name__ == '__main__':
    main()
