"""
Flat vector logo set for The Pocket Wind Tunnel, built from the same panel-method geometry as the 3D renders.
Writes research/tools/logo/: pwt-logo.svg (ink on transparent), pwt-logo-reverse.svg (for dark backgrounds),
pwt-logo-mark.svg (mark only), pwt-logo-mark-reverse.svg. The wordmark is converted to paths (fontTools, Segoe UI
Semibold) so the files are true vector with no font dependency.
"""
import json, os, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = json.load(open(os.path.join(HERE, 'logo-geometry.json'), encoding='utf-8'))
OUT = os.path.join(HERE, 'logo'); os.makedirs(OUT, exist_ok=True)
FONT = r'C:\Windows\Fonts\seguisb.ttf'
INK, CYAN, REV = '#1f3a5f', '#1c8fb5', '#f1f4f8'
CX, R = 0.45, 1.62          # ring centre and radius in chord units (same as the 3D build)
S = 100.0                   # px per chord unit

def P(x, y):                # chord units → SVG px (y up → y down), ring centred at (0,0) in a local group
    return f'{(x - CX) * S:.2f},{-y * S:.2f}'

def mark_paths(ink, cyan, stroke_w=2.2):
    parts = []
    parts.append(f'<circle cx="0" cy="0" r="{R * S:.1f}" fill="none" stroke="{cyan}" stroke-width="{stroke_w * 1.9:.2f}"/>')
    parts.append(f'<circle cx="0" cy="0" r="{(R + 0.075) * S:.1f}" fill="none" stroke="{ink}" stroke-width="{stroke_w * 0.55:.2f}" opacity="0.55"/>')
    rmax = R - 0.06
    for line in GEO['streamlines']:
        pts = [(x, y) for x, y in line if (x - CX) ** 2 + y ** 2 < rmax ** 2]
        if len(pts) < 4: continue
        d = 'M ' + ' L '.join(P(x, y) for x, y in pts[::2])
        parts.append(f'<path d="{d}" fill="none" stroke="{cyan}" stroke-width="{stroke_w:.2f}" stroke-linecap="round"/>')
    af = 'M ' + ' L '.join(P(x, y) for x, y in GEO['airfoil']) + ' Z'
    parts.append(f'<path d="{af}" fill="{ink}"/>')
    return '\n'.join(parts)

def text_paths(text, font, size_px, letter_space=0.08):
    """Glyph outlines as SVG path data, advancing along x. Returns (path_d, width_px)."""
    glyphs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; sc = size_px / upm
    x = 0.0; ds = []
    for ch in text:
        if ch == ' ': x += 0.34 * size_px; continue
        g = cmap.get(ord(ch));
        if g is None: continue
        pen = SVGPathPen(glyphs); glyphs[g].draw(pen); d = pen.getCommands()
        if d: ds.append(f'<path transform="translate({x:.2f},0) scale({sc:.6f},{-sc:.6f})" d="{d}"/>')
        x += glyphs[g].width * sc + letter_space * size_px
    return '\n'.join(ds), x - letter_space * size_px

def write(name, ink, cyan, with_text):
    font = TTFont(FONT)
    mark = mark_paths(ink, cyan)
    mr = (R + 0.12) * S
    if with_text:
        t1, w1 = text_paths('THE', font, 28, 0.22); t2, w2 = text_paths('POCKET', font, 78); t3, w3 = text_paths('WIND TUNNEL', font, 78)
        tx = 2 * mr + 20 + 64; W = tx + max(w1, w2, w3) + 40; H = 2 * mr + 40
        body = (f'<g transform="translate({mr + 20:.1f},{mr + 20:.1f})">{mark}</g>'
                f'<g transform="translate({tx:.1f},{mr + 20 - 82:.1f})" fill="{cyan}">{t1}</g>'
                f'<g transform="translate({tx:.1f},{mr + 20 - 6:.1f})" fill="{ink}">{t2}</g>'
                f'<g transform="translate({tx:.1f},{mr + 20 + 82:.1f})" fill="{ink}">{t3}</g>')
    else:
        W = H = 2 * mr + 40
        body = f'<g transform="translate({mr + 20:.1f},{mr + 20:.1f})">{mark}</g>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W:.0f}" height="{H:.0f}">'
           f'<title>The Pocket Wind Tunnel</title><desc>NACA 2412 section at 4 degrees with streamlines from the tool\'s own panel method, inside the tunnel ring.</desc>{body}</svg>')
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(svg); print('wrote', name, f'{W:.0f}x{H:.0f}')

write('pwt-logo.svg', INK, CYAN, True)
write('pwt-logo-reverse.svg', REV, '#4cc9f0', True)
write('pwt-logo-mark.svg', INK, CYAN, False)
write('pwt-logo-mark-reverse.svg', REV, '#4cc9f0', False)
