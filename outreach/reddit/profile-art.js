#!/usr/bin/env node
/*
 * profile-art.js — render the Reddit profile picture and banner for u/Build-Me-Anything.
 *
 *   node profile-art.js
 *
 * Reads profile-art.html, inlines the project's own logo mark (reverse variant, cyan on gunmetal) into
 * both blocks, and screenshots each at its exact pixel size with headless Chrome. Same recipe as the rest
 * of the project's visual checks (DEVNOTES section 5): puppeteer-core driving the locally installed Chrome.
 *
 * Output, in this folder:
 *   profile-avatar-256.png    Reddit profile picture (square; Reddit accepts up to 1 MB)
 *   profile-banner-1920.png   Reddit profile banner (1920x384)
 *
 * puppeteer-core is not a project dependency. If it is not resolvable, set PUPPETEER_MODULE to its path,
 * e.g. a scratch install:  npm install puppeteer-core  in any folder, then
 *   PUPPETEER_MODULE=C:/path/to/node_modules/puppeteer-core node profile-art.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const MARK = fs.readFileSync(path.join(ROOT, 'research', 'tools', 'logo', 'pwt-logo-mark-reverse.svg'), 'utf8')
  .replace(/^<\?xml[^>]*>\s*/, '')
  .replace(/<svg /, '<svg class="mark" ');

const html = fs.readFileSync(path.join(DIR, 'profile-art.html'), 'utf8').split('<!--MARK-->').join(MARK);

const SHOTS = [
  { sel: '#avatar', file: 'profile-avatar-256.png', w: 256, h: 256 },
  { sel: '#banner', file: 'profile-banner-1920.png', w: 1920, h: 384 },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 900, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  for (const s of SHOTS) {
    const el = await page.$(s.sel);
    if (!el) { console.error('missing element ' + s.sel); continue; }
    const out = path.join(DIR, s.file);
    await el.screenshot({ path: out });
    const kb = (fs.statSync(out).size / 1024).toFixed(0);
    console.log(`${s.file.padEnd(26)} ${s.w}x${s.h}  ${kb} kB`);
  }
  await browser.close();
})();
