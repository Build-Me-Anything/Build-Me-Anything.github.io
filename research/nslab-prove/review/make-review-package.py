"""Assemble the external-review package: everything a hostile reviewer needs, nothing they must ask for.

    python make-review-package.py        ->  builds/refreshes  review/package/

Contents: the cover sheet (the question at the top), the frozen statement + audit contracts, the internal
proof audit (the attack map), the audit log and completion bridge, the literature check, the certification
status, the sanity report — and the complete clean-room reproduction package nested as repro-package/ so the
computational evidence runs standalone. MANIFEST + PROVENANCE as in the repro builder.
"""
import hashlib
import io
import os
import shutil
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
NSP = os.path.dirname(HERE)
PKG = os.path.join(HERE, 'package')

DOCS_ROOT = ['PROOF-AUDIT.md', 'AUDIT-LOG.md', 'AUDIT-COMPLETION.md', 'LITERATURE-CHECK.md',
             'CERTIFICATION-STATUS.md', 'POST-AUDIT-ROADMAP.md']
DOCS_STATEMENT = ['Certified Spectral Enclosure for the De Gregorio Profile Operator — Statement.md',
                  'R2-AUDIT-CONTRACT.md', 'R3-AUDIT-CONTRACT.md', 'R4-AUDIT-CONTRACT.md']


def _clear(pkg):
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


def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True, text=True, cwd=NSP).stdout.strip()


def main():
    repro_pkg = os.path.join(NSP, 'repro', 'package')
    assert os.path.isfile(os.path.join(repro_pkg, 'MANIFEST.sha256')), 'build repro/package first'

    _clear(PKG)
    os.makedirs(os.path.join(PKG, 'statement'), exist_ok=True)
    shutil.copy2(os.path.join(HERE, 'REVIEW-COVER.md'), os.path.join(PKG, 'REVIEW-COVER.md'))
    for d in DOCS_ROOT:
        shutil.copy2(os.path.join(NSP, d), os.path.join(PKG, d))
    for d in DOCS_STATEMENT:
        shutil.copy2(os.path.join(NSP, d), os.path.join(PKG, 'statement', d))
    shutil.copy2(os.path.join(NSP, 'sanity', 'REPORT.md'), os.path.join(PKG, 'SANITY-REPORT.md'))
    shutil.copytree(repro_pkg, os.path.join(PKG, 'repro-package'))

    head = git('rev-parse', '--short', 'HEAD')
    with io.open(os.path.join(PKG, 'PROVENANCE.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Provenance\n\nAssembled from https://github.com/Build-Me-Anything/'
                'Build-Me-Anything.github.io\n(`research/nslab-prove/`), commit `%s`.\n\n' % head)
        f.write('Frozen statement: tag `r4b-statement-v1` = `0d7c663` (label errata: AL-018).\n')
        f.write('Audit complete: tag `r4b-audit-complete-v1` = `8ccecac`.\n')
        f.write('Certification status frozen: tag `r4b-certification-complete-v1` (this assembly).\n\n')
        f.write('Every file other than the cover sheet, this file and MANIFEST.sha256 is byte-identical\n')
        f.write('to the repository at the commit above; the nested repro-package/ carries its own manifest.\n')

    io.open(os.path.join(PKG, '.gitattributes'), 'w', encoding='utf-8', newline='\n').write('* -text\n')

    lines = ['# SHA-256 manifest of the review package']
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
    n = sum(len(f) for _r, _d, f in os.walk(PKG))
    print('review package assembled at', PKG, 'from commit', head, '-', n, 'files')


if __name__ == '__main__':
    main()
