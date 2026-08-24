#!/usr/bin/env node
/*
 * assets.js — render the images used by the GitHub org profile and the repository README.
 *
 *   node assets.js
 *
 * Writes PNGs into outreach/github/assets/:
 *   hero.png                 2560x720 (2x)  masthead, built around the Blender render of the mark
 *   peaks-light/-dark.png    the peak-vs-resolution figure, from the blog's own generated SVG
 *   bridge.png               the reconnection bridge at three resolutions, from the run archive
 *
 * The masthead uses research/tools/logo/pwt-logo-mark-3d.png — Cycles, emissive cyan on gunmetal. That render
 * has a near-black ground rather than an alpha channel, so it is composited with mix-blend-mode: screen over
 * the hero's own dark gradient: black contributes nothing, the glow survives, and no rectangle shows.
 *
 * One masthead serves both GitHub themes deliberately. It is a self-contained dark card with its own border
 * and rounded corners, which reads as designed on a light page; a washed-out light twin of a glowing render
 * would not. The figure, which is line art on a panel, does get both variants.
 *
 * Needs puppeteer-core (not a project dependency): set PUPPETEER_MODULE if it is not resolvable.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const OUT = path.join(DIR, 'assets');
const BLOG = path.join(ROOT, 'outreach', 'blog');

const dataUri = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const MARK3D = dataUri(path.join(ROOT, 'research', 'tools', 'logo', 'pwt-logo-mark-3d.png'));
const SLICES = dataUri(path.join(ROOT, 'research', 'nslab', 'ns003-ladder-vort-xmid-t8.5.png'));
const THEME = fs.readFileSync(path.join(BLOG, 'theme.css'), 'utf8');
const FIG = fs.readFileSync(path.join(BLOG, 'assets', 'figures', 'peak-vs-n.svg'), 'utf8');

const hero = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>
body { margin: 0; background: #05080c; }
#hero {
  width: 1280px; height: 360px; box-sizing: border-box; position: relative; overflow: hidden;
  border-radius: 16px; border: 1px solid #1d2937;
  background:
    radial-gradient(ellipse 60% 120% at 18% 50%, #12202c 0%, transparent 62%),
    linear-gradient(102deg, #070b10 0%, #0c131b 46%, #111b25 100%);
  font-family: "Segoe UI", system-ui, Arial, sans-serif;
  display: flex; align-items: center;
}
/* faint horizontal streamlines across the whole card, echoing the mark */
#hero .flow { position: absolute; inset: 0; opacity: .5;
  background: repeating-linear-gradient(to bottom, rgba(76,201,240,.055) 0 1px, transparent 1px 13px); }
#hero .vig { position: absolute; inset: 0;
  background: radial-gradient(ellipse 78% 130% at 50% 50%, transparent 40%, rgba(0,0,0,.55) 100%); }
#hero .render {
  position: absolute; left: -26px; top: 50%; transform: translateY(-50%);
  width: 400px; height: 400px; mix-blend-mode: screen; filter: saturate(1.05) contrast(1.04);
}
#hero .words { position: relative; z-index: 2; margin-left: 396px; padding-right: 64px; }
#hero .kicker { font-family: ui-monospace, Consolas, monospace; font-size: 12px; letter-spacing: .26em;
  text-transform: uppercase; color: #4cc9f0; margin-bottom: 14px; opacity: .95; }
#hero h1 { margin: 0; font-size: 60px; font-weight: 680; letter-spacing: -0.8px; color: #eef4f9; line-height: 1.02;
  text-shadow: 0 2px 30px rgba(0,0,0,.6); }
#hero h1 em { font-style: normal; color: #4cc9f0; text-shadow: 0 0 34px rgba(76,201,240,.45); }
#hero p { margin: 18px 0 0; font-size: 20.5px; line-height: 1.45; color: #94a7bb; max-width: 700px; }
#hero .strip { position: absolute; left: 396px; bottom: 34px; display: flex; gap: 26px; z-index: 2;
  font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #6d8299; letter-spacing: .04em; }
#hero .strip b { color: #cfe2ee; font-weight: 600; }
</style></head><body>
<div id="hero">
  <div class="flow"></div>
  <img class="render" src="${MARK3D}" alt="">
  <div class="vig"></div>
  <div class="words">
    <div class="kicker">The Pocket Wind Tunnel &middot; NSLab</div>
    <h1>Build Me <em>Anything</em></h1>
    <p>An offline wind tunnel that grew a verified Navier&ndash;Stokes laboratory.</p>
  </div>
  <div class="strip">
    <span><b>376 kB</b> single file</span>
    <span><b>3</b> implementations, agreeing to <b>4&middot;10&#8315;&#185;&#178;</b></span>
    <span><b>3</b> studies, graded</span>
    <span>evidence, <b>never a proof</b></span>
  </div>
</div></body></html>`;

const figure = dark => `<!doctype html><html${dark ? ' data-theme="dark"' : ' data-theme="light"'}><head><meta charset="utf-8"><style>
${THEME}
body { margin: 0; background: ${dark ? '#0a0e14' : '#f4f7fa'}; font-family: "Segoe UI", system-ui, Arial, sans-serif; }
#wrap { width: 1200px; padding: 26px 30px 22px; box-sizing: border-box;
  background: ${dark ? '#111821' : '#ffffff'}; border: 1px solid ${dark ? '#223040' : '#d7e0ea'}; border-radius: 14px; }
#wrap h2 { margin: 0 0 4px; font-size: 21px; color: ${dark ? '#e6edf3' : '#14202e'}; font-weight: 650; }
#wrap p { margin: 0 0 18px; font-size: 14.5px; line-height: 1.5; color: ${dark ? '#8a9bb0' : '#5b6b80'}; }
svg.fig { border: 0; background: none; }
</style></head><body>
<div id="wrap">
  <h2>The quantity a regularity argument would need does not converge</h2>
  <p>Peak maximum vorticity against grid resolution, log&ndash;log, for the three studies. A converged quantity
     would be flat. Every number is generated from the archived runs, not drawn by hand.</p>
  ${FIG}
</div></body></html>`;

const bridge = `<!doctype html><html><head><meta charset="utf-8"><style>
body { margin: 0; background: #05080c; }
#wrap { width: 1280px; box-sizing: border-box; padding: 24px 26px 20px; border-radius: 14px;
  border: 1px solid #1d2937; background: linear-gradient(180deg, #0b1119 0%, #070b10 100%);
  font-family: "Segoe UI", system-ui, Arial, sans-serif; }
#wrap h2 { margin: 0 0 4px; font-size: 19px; color: #e6edf3; font-weight: 650; }
#wrap p { margin: 0 0 16px; font-size: 13.5px; line-height: 1.5; color: #8a9bb0; }
#wrap img { width: 100%; display: block; border-radius: 8px; }
#wrap .labels { display: flex; margin-top: 10px; font-family: ui-monospace, Consolas, monospace;
  font-size: 12.5px; color: #6d8299; }
#wrap .labels span { flex: 1; text-align: center; }
#wrap .labels b { color: #4cc9f0; font-weight: 600; }
</style></head><body>
<div id="wrap">
  <h2>What the ladder is actually looking at</h2>
  <p>Vorticity magnitude on the plane x = &pi; at t = 8.5 &mdash; the reconnection bridge, at three grid
     resolutions. It is a sheet one or two cells thick at <em>every</em> level: the grid gets finer, the sheet
     gets thinner, and the peak never converges.</p>
  <img src="${SLICES}" alt="Vorticity on the plane x = pi at three grid resolutions">
  <div class="labels"><span><b>96&sup3;</b></span><span><b>192&sup3;</b></span><span><b>256&sup3;</b></span></div>
</div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

  for (const [name, html, sel] of [
    ['hero', hero, '#hero'],
    ['peaks-light', figure(false), '#wrap'], ['peaks-dark', figure(true), '#wrap'],
    ['bridge', bridge, '#wrap'],
  ]) {
    await page.setContent(html, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 250));
    const el = await page.$(sel);
    const file = path.join(OUT, name + '.png');
    await el.screenshot({ path: file });
    console.log(`${(name + '.png').padEnd(18)} ${(fs.statSync(file).size / 1024).toFixed(0)} kB`);
  }
  await browser.close();
})();
