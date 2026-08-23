// Markdown → .docx converter for the research documents (headings, paragraphs, bullet/numbered lists, pipe tables,
// fenced code, block quotes, horizontal rules, bold/italic/inline code/links). Usage:
//   node research/tools/md2docx.js <file.md> [more.md ...]     → writes <file>.docx next to each input
// Requires the `docx` npm package: set DOCX_MODULE to its path if it is not resolvable (node_modules).
const fs = require('fs'), path = require('path');
const docx = require(process.env.DOCX_MODULE || 'docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, LevelFormat, BorderStyle, ExternalHyperlink, PageNumber, Footer } = docx;

const FONT = 'Calibri', MONO = 'Consolas', PAGE_W = 11906, MARGIN = 1134;   // A4, 2 cm margins (DXA)
const CONTENT_W = PAGE_W - 2 * MARGIN;

function inline(text, base = {}) {
  // tokens: `code`, **bold**, *italic*, [text](url)
  const runs = []; const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun(Object.assign({ text: text.slice(last, m.index), font: FONT }, base)));
    if (m[1]) runs.push(new TextRun(Object.assign({ text: m[1].slice(1, -1), font: MONO, size: 19 }, base)));
    else if (m[2]) runs.push(new TextRun(Object.assign({ text: m[2].slice(2, -2), bold: true, font: FONT }, base)));
    else if (m[3]) runs.push(new TextRun(Object.assign({ text: m[3].slice(1, -1), italics: true, font: FONT }, base)));
    else if (m[4]) runs.push(new ExternalHyperlink({ link: m[6], children: [new TextRun(Object.assign({ text: m[5], style: 'Hyperlink', font: FONT }, base))] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun(Object.assign({ text: text.slice(last), font: FONT }, base)));
  return runs.length ? runs : [new TextRun(Object.assign({ text: '', font: FONT }, base))];
}
const unescapePipes = s => s.replace(/\\\|/g, '|');

function convert(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n'); const out = []; let i = 0;
  const isTableLine = l => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    let l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, spacing: { before: 120, after: 120 } })); i++; continue; }
    let h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { const lvl = h[1].length; const map = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5]; out.push(new Paragraph({ heading: map[lvl - 1], children: inline(h[2].replace(/\*\*/g, '')), spacing: { before: lvl === 1 ? 360 : 240, after: 120 } })); i++; continue; }
    if (/^```/.test(l)) { i++; const code = []; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++;
      for (const c of code) out.push(new Paragraph({ children: [new TextRun({ text: c || ' ', font: MONO, size: 17 })], shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' }, spacing: { before: 0, after: 0 }, indent: { left: 227 } }));
      out.push(new Paragraph({ spacing: { before: 0, after: 120 } })); continue; }
    if (isTableLine(l)) {
      const rows = []; while (i < lines.length && isTableLine(lines[i])) { rows.push(lines[i]); i++; }
      const cells = rows.map(r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => unescapePipes(c.trim())));
      const body = cells.filter(r => !r.every(c => /^:?-{2,}:?$/.test(c)));
      if (!body.length) continue;
      const ncol = Math.max(...body.map(r => r.length)); const cw = Math.floor(CONTENT_W / ncol); const widths = Array(ncol).fill(cw);
      const trows = body.map((r, ri) => new TableRow({ tableHeader: ri === 0, children: Array.from({ length: ncol }, (_, ci) => new TableCell({ width: { size: cw, type: WidthType.DXA }, shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'E7EEF5', color: 'auto' } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ children: inline(r[ci] || '', { size: 18, bold: ri === 0 }), spacing: { before: 0, after: 0 } })] })) }));
      out.push(new Table({ rows: trows, columnWidths: widths, width: { size: CONTENT_W, type: WidthType.DXA } }));
      out.push(new Paragraph({ spacing: { before: 0, after: 120 } })); continue;
    }
    if (/^\s*>\s?/.test(l)) { const q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); out.push(new Paragraph({ children: inline(q.join(' '), { italics: true }), indent: { left: 567 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } }, spacing: { after: 120 } })); continue; }
    let b = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if (b) {
      while (i < lines.length && (b = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lines[i]))) {
        const level = Math.min(2, Math.floor(b[1].replace(/\t/g, '  ').length / 2)); const numbered = /\d/.test(b[2]); let text = b[3]; i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !isTableLine(lines[i])) text += ' ' + lines[i++].trim();
        out.push(new Paragraph({ children: inline(text), numbering: { reference: numbered ? 'nums' : 'bullets', level }, spacing: { after: 60 } }));
      }
      continue;
    }
    // paragraph: gather continuation lines
    const p = [l.trim()]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i]) && !isTableLine(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !/^---+\s*$/.test(lines[i]) && !/^\s*>/.test(lines[i])) p.push(lines[i++].trim());
    out.push(new Paragraph({ children: inline(p.join(' ')), spacing: { after: 120 }, alignment: AlignmentType.LEFT }));
  }
  return out;
}

function build(md, title) {
  const children = convert(md);
  return new Document({
    creator: 'Pocket Wind Tunnel research programme', title,
    styles: { default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { size: 34, bold: true, font: FONT, color: '1F3A5F' }, paragraph: { spacing: { after: 200 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FONT, color: '1F3A5F' }, paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: FONT, color: '2E5C8A' }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', run: { size: 21, bold: true, italics: true, font: FONT }, paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 3 } },
      ] },
    numbering: { config: [
      { reference: 'bullets', levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.BULLET, text: ['•', '–', '·'][l], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567 + 360 * l, hanging: 283 } } } })) },
      { reference: 'nums', levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.DECIMAL, text: '%' + (l + 1) + '.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567 + 360 * l, hanging: 283 } } } })) },
    ] },
    sections: [{ properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title + '  ·  page ', size: 16, color: '777777', font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '777777', font: FONT })] })] }) },
      children }],
  });
}

(async () => {
  const files = process.argv.slice(2); if (!files.length) { console.error('usage: node md2docx.js <file.md> ...'); process.exit(1); }
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8'); const title = (md.match(/^#\s+(.*)$/m) || [])[1] || path.basename(f, '.md');
    const outPath = f.replace(/\.md$/i, '') + '.docx';
    const buf = await Packer.toBuffer(build(md, title.replace(/[*`]/g, '')));
    fs.writeFileSync(outPath, buf); console.log('wrote', outPath, (buf.length / 1024).toFixed(0) + ' kB');
  }
})().catch(e => { console.error(e); process.exit(1); });
