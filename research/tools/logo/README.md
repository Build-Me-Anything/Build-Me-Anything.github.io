# The Pocket Wind Tunnel — logo files

The mark is the physics: a NACA 2412 section at 4° inside the tunnel ring, with ten streamlines integrated through
the tool's own Hess–Smith panel-method velocity field (`../logo-streamlines.js` → `../logo-geometry.json`). The
flat set is true vector (wordmark converted to paths, no font dependency); the 3D set is rendered in Blender 5.2
(Cycles) in the same studio language as the author's other product renders — gunmetal section, cyan emissive glyph.

## Which file do I use?

| Situation | File |
|---|---|
| **Default for documents** — Word, web, anything that takes vector, on a light page | `pwt-logo.svg` |
| Light page, no vector support (email signatures, older Word, Canva) | `pwt-logo.png` (transparent) |
| On a **dark** background | `pwt-logo-reverse.svg` / `pwt-logo-reverse.png` |
| **Tight spaces** — favicon, app icon, footer, avatar (mark only) | `pwt-logo-mark.svg` / `pwt-logo-mark.png`; dark: `-reverse` |
| **Feature / cover page**, full 3D treatment on a dark page | `pwt-logo-3d-dark.png` (2000×1000) |
| Feature page on a light page | `pwt-logo-3d.png` (2000×1000) |
| 3D mark alone, transparent (badges, hero corners) | `pwt-logo-mark-3d.png` (1200²) |

## Notes

- Colours: ink `#1f3a5f`, cyan `#1c8fb5` (flat, light page); reverse ink `#f1f4f8`, cyan `#4cc9f0`. The 3D renders use
  emissive cyan (0.16, 0.72, 0.92) on gunmetal (0.050, 0.062, 0.080).
- The two 3D PNGs are lit differently, not recoloured — use the one that matches the page.
- Regenerate everything: `node ../logo-streamlines.js`, `python ../logo-svg.py`, then
  `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P ../logo-blender.py -- all 160` (CPU Cycles,
  a few minutes per view). `pwt-logo.blend` is saved for hand adjustments in Blender.
- The geometry is the tool's, so the logo can be regenerated for any section or angle by editing two lines in
  `logo-streamlines.js`.
