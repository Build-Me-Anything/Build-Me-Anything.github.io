#!/usr/bin/env node
/*
 * reddit.js — a zero-dependency Reddit client for the NSLab outreach drafts.
 *
 * Runs on your machine (Reddit is unreachable from Claude's sandbox, so none of this can be done for you).
 * No packages: Node's own https module, nothing else.
 *
 *   node reddit.js me                          who am I, how old is the account, what karma
 *   node reddit.js rules CFD                   the subreddit's actual rules, verbatim
 *   node reddit.js flairs CFD                  link flairs and their ids (many subs require one)
 *   node reddit.js requirements CFD            title/body length limits, flair required, karma gates
 *   node reddit.js check CFD                   all of the above in one go, before you post
 *   node reddit.js preview 01-r-CFD.md --title 1
 *   node reddit.js post 01-r-CFD.md --sub CFD --title 1 [--flair <id>] --confirm
 *
 * Nothing is submitted without --confirm. Without it, `post` prints exactly what would be sent and stops.
 *
 * ---------------------------------------------------------------------------------------------------------
 * CREDENTIALS — never paste these into a chat, and never commit them.
 *
 * 1. Go to https://www.reddit.com/prefs/apps  (logged in as the account that will post)
 * 2. "create another app..." -> type: **script** -> name: nslab-logbook
 *    redirect uri: http://localhost:8080  (unused by a script app, but the form demands one)
 * 3. The id under the app name is the client id; the "secret" field is the client secret.
 * 4. Put them in outreach/reddit/.reddit-credentials.json (already gitignored):
 *
 *      {
 *        "clientId": "...",
 *        "clientSecret": "...",
 *        "username": "your_reddit_username",
 *        "password": "your_reddit_password"
 *      }
 *
 *    or set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USERNAME / REDDIT_PASSWORD in the environment.
 *
 * If the account has 2FA, the password field must be "password:123456" with a current code — which expires in
 * 30 seconds and makes scripted posting painful. Reading (rules, flairs, requirements) does not need 2FA to be
 * disabled; only posting does. Consider posting the first one by hand.
 * ---------------------------------------------------------------------------------------------------------
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DIR = __dirname;
const UA = 'windows:nslab-logbook:0.1.0 (by /u/%USER%)';

/* ------------------------------------------------------------------ creds ---- */

function credentials() {
  const file = path.join(DIR, '.reddit-credentials.json');
  const c = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const out = {
    clientId: process.env.REDDIT_CLIENT_ID || c.clientId,
    clientSecret: process.env.REDDIT_CLIENT_SECRET || c.clientSecret,
    username: process.env.REDDIT_USERNAME || c.username,
    password: process.env.REDDIT_PASSWORD || c.password,
  };
  const missing = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing credentials: ${missing.join(', ')}`);
    console.error(`Put them in ${path.relative(process.cwd(), file)} or the environment — see the header of this file.`);
    process.exit(1);
  }
  return out;
}

/* ------------------------------------------------------------------- http ---- */

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* some endpoints return html on error */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let TOKEN = null;
async function token() {
  if (TOKEN) return TOKEN;
  const c = credentials();
  const body = new URLSearchParams({
    grant_type: 'password', username: c.username, password: c.password,
  }).toString();
  const res = await request({
    hostname: 'www.reddit.com', path: '/api/v1/access_token', method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': UA.replace('%USER%', c.username),
    },
  }, body);

  if (res.status !== 200 || !res.json || !res.json.access_token) {
    console.error(`Token request failed (HTTP ${res.status}).`);
    if (res.json && res.json.error) console.error(`Reddit says: ${res.json.error}`);
    console.error('Common causes: wrong client id/secret; the app is not of type "script"; the account has 2FA');
    console.error('(then the password must be "password:123456" with a live code); or the account is rate limited.');
    process.exit(1);
  }
  TOKEN = { value: res.json.access_token, user: c.username };
  return TOKEN;
}

async function api(method, endpoint, form) {
  const t = await token();
  const body = form ? new URLSearchParams(form).toString() : null;
  const u = new URL('https://oauth.reddit.com' + endpoint);
  const res = await request({
    hostname: u.hostname, path: u.pathname + u.search, method,
    headers: Object.assign({
      'Authorization': 'Bearer ' + t.value,
      'User-Agent': UA.replace('%USER%', t.user),
    }, body ? {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    } : {}),
  }, body);
  if (res.status === 403) {
    console.error(`HTTP 403 on ${endpoint} — the token lacks the scope, or the subreddit is private/quarantined.`);
  }
  return res;
}

/* -------------------------------------------------------------- commands ---- */

const wrap = (s, w = 96, indent = '    ') => {
  const words = String(s || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = []; let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > w) { lines.push(line.trim()); line = word; }
    else line += ' ' + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.map(l => indent + l).join('\n');
};

async function cmdMe() {
  const res = await api('GET', '/api/v1/me');
  const m = res.json || {};
  const ageDays = m.created_utc ? Math.floor((Date.now() / 1000 - m.created_utc) / 86400) : null;
  console.log(`user            /u/${m.name}`);
  console.log(`account age     ${ageDays} days`);
  console.log(`link karma      ${m.link_karma}`);
  console.log(`comment karma   ${m.comment_karma}`);
  console.log(`verified email  ${m.has_verified_email}`);
  if ((m.link_karma + m.comment_karma) < 50 || ageDays < 30) {
    console.log('');
    console.log('WARNING: low karma or a young account. Many technical subreddits auto-filter these, and the');
    console.log('post will look fine to you while being invisible to everyone else. After posting, open the');
    console.log('thread in a logged-out browser window to check it is actually there.');
  }
}

async function cmdRules(sub) {
  const res = await api('GET', `/r/${sub}/about/rules`);
  const rules = (res.json && res.json.rules) || [];
  if (!rules.length) return console.log(`No rules returned for r/${sub} (HTTP ${res.status}).`);
  console.log(`r/${sub} — ${rules.length} rules\n`);
  rules.forEach((r, i) => {
    console.log(`${i + 1}. ${r.short_name}${r.kind ? `  [${r.kind}]` : ''}`);
    if (r.description) console.log(wrap(r.description));
    console.log('');
  });
}

async function cmdFlairs(sub) {
  const res = await api('GET', `/r/${sub}/api/link_flair_v2`);
  const flairs = Array.isArray(res.json) ? res.json : [];
  if (!flairs.length) return console.log(`No link flairs available on r/${sub} (HTTP ${res.status}).`);
  console.log(`r/${sub} — link flairs\n`);
  for (const f of flairs) console.log(`  ${f.text.padEnd(28)}  --flair ${f.id}`);
}

async function cmdRequirements(sub) {
  const res = await api('GET', `/api/v1/${sub}/post_requirements`);
  const r = res.json || {};
  console.log(`r/${sub} — posting requirements\n`);
  const show = (label, v) => { if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) console.log(`  ${label.padEnd(34)} ${JSON.stringify(v)}`); };
  show('flair required', r.is_flair_required);
  show('title min / max length', [r.title_text_min_length, r.title_text_max_length]);
  show('body restriction', r.body_restriction_policy);
  show('title required strings', r.title_required_strings);
  show('title blacklisted strings', r.title_blacklisted_strings);
  show('body blacklisted strings', r.body_blacklisted_strings);
  show('domain whitelist', r.domain_whitelist);
  show('domain blacklist', r.domain_blacklist);
  show('guidelines', r.guidelines_text ? r.guidelines_text.slice(0, 400) : null);
}

async function cmdCheck(sub) {
  await cmdMe(); console.log('\n' + '-'.repeat(96) + '\n');
  await cmdRules(sub); console.log('-'.repeat(96) + '\n');
  await cmdFlairs(sub); console.log('\n' + '-'.repeat(96) + '\n');
  await cmdRequirements(sub);
}

/* ---------------------------------------------------------------- drafts ---- */

// Pull the chosen title and the body out of one of the draft files in this folder.
function parseDraft(file, titleIndex, blogUrl) {
  const p = path.isAbsolute(file) ? file : path.join(DIR, file);
  const src = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  const titles = [];
  const tSection = /## Title options\n([\s\S]*?)\n## /.exec(src);
  if (tSection) {
    for (const m of tSection[1].matchAll(/^\d+\.\s+(.*)$/gm)) titles.push(m[1].replace(/\*\*/g, '').trim());
  }
  const title = titles[titleIndex - 1];
  if (!title) throw new Error(`Draft has ${titles.length} title options; --title ${titleIndex} is out of range.`);

  // The body runs from "## Body" to the next section, a horizontal rule, or the end of the file —
  // drafts that carry no "First comment" or "Notes" section end at EOF.
  // The Show HN draft has no body — the submission is a URL, and the text lives in the first comment.
  const start = /\n## Body\n/.exec(src) || /\n## First comment[^\n]*\n/.exec(src);
  if (!start) throw new Error('Draft has neither a "## Body" nor a "## First comment" section.');
  const rest = src.slice(start.index + start[0].length);
  const end = /\n---\n|\n## /.exec(rest);
  let body = (end ? rest.slice(0, end.index) : rest).trim();

  if (body.includes('[BLOG URL]')) {
    if (!blogUrl) throw new Error('The draft still contains [BLOG URL]. Pass --url https://... (or set NSLAB_BLOG_URL).');
    body = body.split('[BLOG URL]').join(blogUrl);
  }
  return { title, body, titles };
}

async function cmdPreview(file, opts) {
  const { title, body, titles } = parseDraft(file, opts.title, opts.url);
  console.log('available titles:');
  titles.forEach((t, i) => console.log(`  ${i + 1}${i + 1 === opts.title ? ' *' : '  '} ${t}`));
  console.log('\n' + '='.repeat(96));
  console.log(title);
  console.log(`  (${title.length} characters — Reddit's limit is 300)`);
  console.log('='.repeat(96) + '\n');
  console.log(body);
  console.log('\n' + '='.repeat(96));
  console.log(`body: ${body.length} characters, ${body.split(/\s+/).length} words`);
  if (/\[BLOG URL\]/.test(body)) console.log('WARNING: placeholder [BLOG URL] still present');
}

async function cmdPost(file, opts) {
  if (!opts.sub) throw new Error('--sub is required, e.g. --sub CFD');
  const { title, body } = parseDraft(file, opts.title, opts.url);

  console.log(`subreddit  r/${opts.sub}`);
  console.log(`title      ${title}`);
  console.log(`body       ${body.length} characters`);
  console.log(`flair      ${opts.flair || '(none)'}`);
  console.log('');

  if (!opts.confirm) {
    console.log('DRY RUN — nothing was submitted. Re-run with --confirm to post it for real.');
    console.log('Before you do: node reddit.js check ' + opts.sub);
    return;
  }

  const form = {
    api_type: 'json', sr: opts.sub, kind: 'self', title, text: body,
    sendreplies: 'true', nsfw: 'false', spoiler: 'false',
  };
  if (opts.flair) form.flair_id = opts.flair;

  const res = await api('POST', '/api/submit', form);
  const errs = res.json && res.json.json && res.json.json.errors;
  if (errs && errs.length) {
    console.error('Reddit rejected the submission:');
    for (const e of errs) console.error('  ' + e.join(' | '));
    process.exit(1);
  }
  const data = res.json && res.json.json && res.json.json.data;
  console.log('posted.');
  if (data && data.url) console.log('  ' + data.url);
  console.log('');
  console.log('Now open that URL in a logged-out browser window. If it 404s or the post is missing from the');
  console.log('subreddit listing, it was caught by a spam filter or a karma gate — message the moderators');
  console.log('politely rather than reposting.');
}

/* ------------------------------------------------------------------ main ---- */

function parseArgs(argv) {
  const out = { _: [], title: 1, url: process.env.NSLAB_BLOG_URL || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') out.confirm = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  out.title = Number(out.title) || 1;
  return out;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const [cmd, arg] = opts._;
  try {
    switch (cmd) {
      case 'me': await cmdMe(); break;
      case 'rules': await cmdRules(arg); break;
      case 'flairs': await cmdFlairs(arg); break;
      case 'requirements': await cmdRequirements(arg); break;
      case 'check': await cmdCheck(arg); break;
      case 'preview': await cmdPreview(arg, opts); break;
      case 'post': await cmdPost(arg, opts); break;
      default:
        // the file header is the help text: drop the shebang and the opening /*
        console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(2)
          .map(l => l.replace(/^ \* ?/, '')).join('\n'));
    }
  } catch (e) {
    console.error('Error: ' + e.message);
    process.exit(1);
  }
})();
