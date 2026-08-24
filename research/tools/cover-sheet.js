// Builds the designed Word cover sheet for The Pocket Wind Tunnel (docx-js). Usage: node research/tools/cover-sheet.js
const fs = require('fs'), path = require('path');
const docx = require(process.env.DOCX_MODULE || 'docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle, PageBreak, Footer, PageNumber, LevelFormat, HeadingLevel, ImageRun } = docx;
const MARK = fs.readFileSync(path.join(__dirname, 'logo', 'pwt-logo-mark.png'));
const FONT = 'Calibri', PAGE_W = 11906, MARGIN = 1134, CW = PAGE_W - 2 * MARGIN;
const NAVY = '1F3A5F', BLUE = '2E5C8A', CYAN = '1C8FB5', GREY = '666666', LIGHT = 'EEF3F8';
const run = (text, o = {}) => new TextRun(Object.assign({ text, font: FONT }, o));
const para = (children, o = {}) => new Paragraph(Object.assign({ children: Array.isArray(children) ? children : [children] }, o));
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const rule = (color = NAVY, size = 12) => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } }, spacing: { before: 60, after: 160 } });
function kvTable(rows, w1 = 3000) {
  return new Table({ columnWidths: [w1, CW - w1], width: { size: CW, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' }, insideVertical: none },
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: w1, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 0, right: 120 }, children: [para(run(k, { bold: true, size: 19, color: NAVY }))] }),
      new TableCell({ width: { size: CW - w1, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 120, right: 0 }, children: [para(run(v, { size: 19 }))] })] })) });
}
function gridTable(header, rows, widths) {
  const mk = (cells, head) => new TableRow({ tableHeader: head, children: cells.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: head ? { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: [para(run(c, { size: 18, bold: head, color: head ? NAVY : '000000' }))] })) });
  return new Table({ columnWidths: widths, width: { size: CW, type: WidthType.DXA }, rows: [mk(header, true), ...rows.map(r => mk(r, false))] });
}
const spacer = (after = 120) => new Paragraph({ spacing: { before: 0, after } });

const cover = [
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 600, after: 0 }, children: [new ImageRun({ type: 'png', data: MARK, transformation: { width: 150, height: 150 } })] }),
  new Paragraph({ spacing: { before: 900, after: 0 }, children: [run('PROJECT COVER SHEET', { size: 20, color: GREY, characterSpacing: 60 })] }),
  rule(CYAN, 18),
  para(run('THE POCKET WIND TUNNEL', { size: 64, bold: true, color: NAVY }), { spacing: { before: 200, after: 120 } }),
  para(run('An offline aerodynamics toolkit that grew a verified Navier–Stokes laboratory', { size: 28, color: BLUE, italics: true }), { spacing: { after: 360 } }),
  rule(NAVY, 6),
  kvTable([
    ['Project', 'The Pocket Wind Tunnel (PWT)'],
    ['Research programme', 'NSLab — the Navier–Stokes Regularity Laboratory'],
    ['First study', 'NS-001 — Taylor–Green vortex resolution study, Re = 1600'],
    ['Second study', 'NS-002 — antiparallel vortex-tube reconnection, Re = 4000 (Re_Γ ≈ 16 000), 96³ → 256³ on the GPU'],
    ['Third study', 'NS-003 — the same reconnection at Re = 2000 (Re_Γ ≈ 8 000), with interpolated maxima, image diagnostic and worst-instant verdicts'],
    ['Principal investigator', 'Michael — aeronautical engineer'],
    ['Instrument, verification & analysis', 'Claude (Anthropic)'],
    ['Deliverable', 'Pocket Wind Tunnel.html — one 376 kB file; runs from disk, no network, no dependencies'],
    ['Batch layer', 'run-ns-long.js (CPU, Node) · nslab_gpu.py (CuPy float64, RTX 3060)'],
    ['Evidence archive', 'research/nslab/ — build-stamped runs, ladders, dossiers, analyses'],
    ['Versions', 'Pocket Wind Tunnel 0.5.0 · NSLab 0.1.0 · GPU runner 0.1.1'],
    ['Verification', 'five suites ALL PASS; node build.js --verify refuses to build otherwise'],
    ['Date', '23 August 2026'],
  ]),
  new Paragraph({ spacing: { before: 600, after: 0 }, children: [run('Numerical evidence only. Nothing in this project is a proof of global regularity or of finite-time breakdown of the Navier–Stokes equations.', { size: 17, italics: true, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
];
const page2 = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run('What it is', { size: 28, bold: true, color: NAVY })], spacing: { before: 0, after: 120 } }),
  para(run('A single self-contained web page that carries five analysis modes — four engineering methods for two-dimensional aerofoils and one research instrument for the three-dimensional incompressible Navier–Stokes equations — each validated against published data, with a tool-bound local language model as an experiment assistant. Everything runs on the machine in front of you; nothing leaves it.', { size: 20 }), { spacing: { after: 160 } }),
  gridTable(['Mode', 'Physics', 'Validated against'], [
    ['Subsonic', 'Hess–Smith panel method + Thwaites / Michel / Head integral boundary layer', 'Abbott & von Doenhoff; wind-tunnel Cd'],
    ['Tunnel', 'Same section between walls (method of images) + Barlow–Rae–Pope corrections', 'exact image theory; blockage charts'],
    ['CFD', '2D compressible RANS, Spalart–Allmaras or k-ω SST, Roe/MUSCL finite volume, LU-SGS', 'NASA Turbulence Modeling Resource; AGARD 211'],
    ['Hypersonic', 'US76 atmosphere, exact oblique shock / Prandtl–Meyer, shock-expansion, Newtonian, aerothermal', 'NACA Report 1135'],
    ['NSLab', '3D periodic-box Navier–Stokes, Fourier pseudo-spectral, RK4, health report, refinement ladders', 'exact solutions; Brachet et al. 1983; 512³ spectral DNS'],
  ], [1500, 4800, 3338]),
  spacer(240),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run('The research programme', { size: 28, bold: true, color: NAVY })], spacing: { before: 120, after: 120 } }),
  para(run('NSLab is stage one of a programme aimed, in the long run, at the Clay Millennium problem on the existence and smoothness of Navier–Stokes solutions:', { size: 20 }), { spacing: { after: 100 } }),
  para(run('numerical evidence → verified numerics → resolution-independent pattern → conjecture → inequality → proof', { size: 20, bold: true, color: BLUE }), { alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
  para(run('The instrument can supply the first two arrows. It produces evidence and conjectures; it cannot produce proofs, and nothing it outputs is presented as one.', { size: 20 }), { spacing: { after: 160 } }),
  gridTable(['Gate', 'Requirement', 'Status'], [
    ['G0', 'Engineering solvers regression-tested, baseline frozen', 'done'],
    ['G1', '3D discretisation verified (exact solutions 3×10⁻¹², RK4 order 4.0, ∇·u 10⁻¹⁶)', 'done'],
    ['G2', 'Taylor–Green reproduced (ε_max within 1 % of the 512³ reference at 192³)', 'done for the energetics; max|ω| not converged'],
    ['G3', 'Grid / time-step refinement automated with verdicts', 'done'],
    ['G4', 'Vorticity / stretching diagnostics validated', 'done'],
    ['G5', 'Reproducible long-time experiments archived', 'done for NS-001 (24³ … 256³), NS-002 and NS-003 (96³ … 256³)'],
    ['G6–G9', 'Resolution-independent phenomenon → inequality → proof', 'not started'],
  ], [900, 5800, 2938]),
  spacer(240),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run('Headline numbers', { size: 28, bold: true, color: NAVY })], spacing: { before: 120, after: 120 } }),
  ...[
    'NACA 0012, M 0.15, Re 6×10⁶, α 10°: Cl 1.107 (Spalart–Allmaras) / 1.107 (k-ω SST) against NASA TMR 1.091 / 1.080.',
    'Taylor–Green, Re 1600, 256³: ε_max = 0.01291 at t = 8.88 — Brachet 0.0126, 512³ spectral ≈ 0.013; CPU and GPU implementations agree to 3×10⁻¹³.',
    'Maximum vorticity: 37.0 → 55.1 → 74.3 from 96³ to 256³ — the quantity the Beale–Kato–Majda criterion controls is the one that has not converged.',
    'Antiparallel tubes, Re 4000, 96³ → 256³ on the GPU: ε_max and Z_max converge to 1 % while max|ω| climbs 61 → 109 → 139 (∝ N^0.85) and the stretching term triples — a reconnection bridge thinner than the grid at kmax·η = 1.8. Evidence about the instrument\'s reach, not about the equations.',
    'The same reconnection at Re 2000: energetics converged by 192³; max|ω| 52 → 92 → 109 with falling exponents; a float32 extension to 288³/320³ (float64-anchored) then flattens the peak at ≈ 130 (0.4 % at the last rung) — the programme\'s first observed convergence of a pointwise maximum, at exploration grade.',
  ].map(t => new Paragraph({ children: [run(t, { size: 20 })], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 } })),
  spacer(200),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run('Document set', { size: 28, bold: true, color: NAVY })], spacing: { before: 120, after: 120 } }),
  gridTable(['Document', 'Location'], [
    ['NSLab Research Report (academic structure)', 'research/nslab/NSLab Research Report.md / .docx'],
    ['Research archive and gate table', 'research/nslab/README.md / .docx'],
    ['NS-001 analyses (192³, 256³)', 'research/nslab/tgv-Re1600-N{192,256}-gpu/analysis.md / .docx'],
    ['NS-002 analyses and slice figures', 'research/nslab/tubes-Re4000-N{96,192,256}-gpu/analysis.md / .docx, slices-vort-*.png'],
    ['GPU runner', 'pocket-wind-tunnel/gpu/README.md / .docx'],
    ['Developer notes', 'pocket-wind-tunnel/DEVNOTES.md / .docx'],
    ['Working agreement', 'CLAUDE.md'],
  ], [4400, 5238]),
];
const doc = new Document({
  creator: 'Pocket Wind Tunnel research programme', title: 'The Pocket Wind Tunnel — Project Cover Sheet',
  styles: { default: { document: { run: { font: FONT, size: 20 } } }, paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 28, bold: true, font: FONT, color: NAVY }, paragraph: { outlineLevel: 0 } }] },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] }] },
  sections: [{ properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run('The Pocket Wind Tunnel · project cover sheet · 23 August 2026 · page ', { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: FONT })] })] }) },
    children: [...cover, ...page2] }],
});
(async () => {
  const out = path.join(__dirname, '..', '..', 'Pocket Wind Tunnel — Cover Sheet.docx');
  fs.writeFileSync(out, await Packer.toBuffer(doc)); console.log('wrote', out);
})();
