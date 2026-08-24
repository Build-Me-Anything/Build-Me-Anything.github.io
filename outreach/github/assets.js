#!/usr/bin/env node
/*
 * assets.js — render the images used by the GitHub org profile and the repository README.
 *
 *   node assets.js
 *
 * Writes PNGs into outreach/github/assets/:
 *   hero-light.png / hero-dark.png     1280x320  masthead
 *   peaks-light.png / peaks-dark.png   1200x520  the peak-vs-resolution figure, from the blog's own SVG
 *
 * Both come in a light and a dark variant so the README can use <picture> with prefers-color-scheme and look
 * deliberate on either GitHub theme. The figure is the blog's generated SVG (assets/figures/peak-vs-n.svg)
 * rendered against the site's own stylesheet, so the numbers on the landing page are the archive's numbers.
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

const MARK = fs.readFileSync(path.join(ROOT, 'research', 'tools', 'logo', 'pwt-logo-mark-reverse.svg'), 'utf8')
  .replace(/^<\?xml[^>]*>\s*/, '').replace(/<svg /, '<svg class="mark" ');
const THEME = fs.readFileSync(path.join(BLOG, 'theme.css'), 'utf8');
const FIG = fs.readFileSync(path.join(BLOG, 'assets', 'figures', 'peak-vs-n.svg'), 'utf8');

const hero = dark => `<!doctype html><html${dark ? ' data-theme="dark"' : ' data-theme="light"'}><head><meta charset="utf-8">
<style>
${THEME}
body { margin: 0; background: ${dark ? '#0a0e14' : '#f4f7fa'}; }
#hero {
  width: 1280px; height: 320px; display: flex; align-items: center; gap: 44px; padding: 0 64px;
  box-sizing: border-box; position: relative; overflow: hidden;
  background: ${dark
    ? 'linear-gradient(105deg, #0a0e14 0%, #111821 48%, #16202c 100%)'
    : 'linear-gradient(105deg, #eef2f7 0%, #f7f9fc 48%, #ffffff 100%)'};
  border: 1px solid ${dark ? '#223040' : '#d7e0ea'}; border-radius: 14px;
  font-family: "Segoe UI", system-ui, Arial, sans-serif;
}
#hero::after { content:""; position:absolute; inset:0;
  background: radial-gradient(ellipse 42% 88% at 12% 50%, ${dark ? 'rgba(76,201,240,.13)' : 'rgba(28,143,181,.10)'}, transparent 70%); }
#hero .mark { width: 196px; height: 196px; flex: none; position: relative; z-index: 1;
  color: ${dark ? '#e6edf3' : '#1f3a5f'}; }
#hero .mark [stroke="#4cc9f0"] { stroke: ${dark ? '#4cc9f0' : '#1c8fb5'}; }
#hero .words { position: relative; z-index: 1; }
#hero .rule { width: 76px; height: 4px; background: ${dark ? '#4cc9f0' : '#1c8fb5'}; border-radius: 2px; margin-bottom: 22px; }
#hero h1 { margin: 0; font-size: 54px; font-weight: 680; letter-spacing: -0.6px;
  color: ${dark ? '#e6edf3' : '#14202e'}; line-height: 1.04; }
#hero h1 em { font-style: normal; color: ${dark ? '#4cc9f0' : '#17708f'}; }
#hero p { margin: 15px 0 0; font-size: 21px; line-height: 1.4; color: ${dark ? '#8a9bb0' : '#5b6b80'}; max-width: 820px; }
#hero .kicker { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; letter-spacing: .2em;
  text-transform: uppercase; color: ${dark ? '#4cc9f0' : '#17708f'}; margin-bottom: 10px; }
</style></head><body>
<div id="hero">${MARK}<div class="words">
  <div class="rule"></div>
  <div class="kicker">The Pocket Wind Tunnel &middot; NSLab</div>
  <h1>Build Me <em>Anything</em></h1>
  <p>An offline wind tunnel that grew a verified Navier&ndash;Stokes laboratory.<br>Numerical evidence, graded before it is believed.</p>
</div></div></body></html>`;

const figure = dark => `<!doctype html><html${dark ? ' data-theme="dark"' : ' data-theme="light"'}><head><meta charset="utf-8">
<style>
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

  for (const [name, html, sel] of [
    ['hero-light', hero(false), '#hero'], ['hero-dark', hero(true), '#hero'],
    ['peaks-light', figure(false), '#wrap'], ['peaks-dark', figure(true), '#wrap'],
  ]) {
    await page.setContent(html, { waitUntil: 'load' });
    const el = await page.$(sel);
    const file = path.join(OUT, name + '.png');
    await el.screenshot({ path: file });
    console.log(`${(name + '.png').padEnd(18)} ${(fs.statSync(file).size / 1024).toFixed(0)} kB`);
  }
  await browser.close();
})();
