/* Pocket Wind Tunnel — optional local-LLM assistant (Phi-4 Mini via Ollama / llama.cpp).
 * The model never computes anything: it can only act through the tools below, which call the app's own solvers,
 * and it is instructed to quote only numbers returned by those tools. Nothing is sent anywhere until you press Send,
 * and only to the server URL in the settings (localhost by default). */
const AssistUI = (() => {
'use strict';
const DEFAULTS = { url: 'http://localhost:11434', model: 'phi4-mini', temperature: 0.1, numCtx: 8192 };
const ACTION_RE = /\b(set|change|switch|run|compute|calculate|sweep|polar|make it|try|use|at \d|to \d|degrees?|mach \d)\b/i;
const RUN_RE = /\b(run|solve|simulat\w*|rans|cfd|navier)\b/i;
const cfg = Object.assign({}, DEFAULTS, load());
let S = null, api = null, kind = null, models = [], busy = false, history = [], connected = false, abort = null;

const SYSTEM = `You are the assistant built into Pocket Wind Tunnel, an offline 2D aerofoil analysis tool with three modes:
- "sub": subsonic panel method + integral boundary layer (instant results: Cl, Cd, Cm, transition, separation, critical Mach).
- "tunnel": the same section between wind-tunnel walls (closed or open jet, height h/c) solved exactly with images; reports measured values, the classical blockage/streamline-curvature corrections and the free-air comparison (instant).
- "cfd": compressible Navier-Stokes / RANS (Spalart-Allmaras or k-omega SST turbulence model) finite-volume solver; needs run_cfd and takes 10-90 s.
- "hyper": supersonic/hypersonic shock-expansion and Newtonian methods with aerothermal estimates.
- "ns" (NSLab): 3D incompressible Navier-Stokes on a periodic box (pseudo-spectral DNS) with Taylor-Green, vortex-tube and random initial conditions, energy/enstrophy/max-vorticity/stretching diagnostics, a verification health report and refinement ladders; needs run_nslab and takes 10 s to minutes.
Rules:
1. Every number you state about results MUST come from a tool result (get_state, run_cfd, run_nslab, sweep_alpha). Never estimate or invent values. If you have not called a tool, do not quote numbers.
2. To change the case use set_mode, set_geometry and set_conditions; then read results with get_state (subsonic and hypersonic update instantly) or run_cfd (CFD).
3. Tool results include summary fields (e.g. best_L_over_D, stall_onset_alpha_deg) — use them directly rather than scanning tables.
4. Answer only what was asked — do not list every field of a tool result.
5. Be concise and engineering-minded: units (SI), 3-4 significant figures, and say which mode/method produced a number. Mention limitations when relevant (inviscid lift past stall, fully turbulent RANS, perfect gas in hypersonic mode).
6. Do not do arithmetic yourself (percentages, differences, conversions) — report the computed numbers as they are.
7. When CFD and panel-method values differ, say the CFD (viscous) result is the higher-fidelity one and the panel method is inviscid; do not call either "inaccurate".
8. If the user asks something the tools cannot answer, say so plainly.
9. NSLab is a numerical laboratory. You may observe, compare, hypothesise and organise its results; you may NOT claim that any run proves regularity, blow-up, or anything about the Clay Navier-Stokes problem. Call growth of max vorticity 'numerical growth' unless the health report is PASS and a refinement study confirms it, and always report the health grade with NSLab numbers.`;

const TOOLS = [
  { type: 'function', function: { name: 'get_state', description: 'Read the current mode, aerofoil, flow conditions and the latest computed results. Call this before answering questions about results.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'set_mode', description: 'Switch analysis mode.', parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['sub', 'tunnel', 'cfd', 'hyper', 'ns'], description: 'sub = subsonic panel method, tunnel = wind-tunnel walls and blockage corrections, cfd = Navier-Stokes/RANS aerofoil solver, hyper = hypersonic, ns = NSLab 3D periodic-box Navier-Stokes laboratory' } }, required: ['mode'] } } },
  { type: 'function', function: { name: 'set_geometry', description: 'Choose the aerofoil: EITHER a NACA 4-digit code (naca) OR a named shape — never both.', parameters: { type: 'object', properties: { naca: { type: 'string', description: '4-digit NACA code such as "0012" or "4412"' }, shape: { type: 'string', enum: ['flatPlate', 'diamond', 'wedge10', 'bluntedWedge', 'bluntedPlate', 'biconvex'] }, panels: { type: 'integer', description: 'panels around the section, 60-240' } } } } },
  { type: 'function', function: { name: 'set_conditions', description: 'Change the current case (moves the app sliders) — use this whenever the user says set/change/make it/at … for angle of attack, speed, Mach, Reynolds, altitude, chord or model. Include only the keys to change. Subsonic: alpha_deg, airspeed_mps, chord_m, altitude_m. Tunnel: the subsonic keys plus tunnel_height_over_chord, test_section (closed|open), model_offset_fraction. CFD: alpha_deg, mach, reynolds, altitude_m, model (euler|laminar|sa|sst — sa = Spalart-Allmaras, sst = k-omega SST). Hypersonic: alpha_deg, mach, altitude_m, chord_m, gamma, wall_temperature_K, method (se|wedge|newton|newtonClassic). NSLab: grid_n (16|24|32|48|64|96|128), reynolds, initial_condition (tgv|tubes|random|abc|tgv2d), t_end, cfl, study (none|grid|time).', parameters: { type: 'object', properties: { alpha_deg: { type: 'number' }, airspeed_mps: { type: 'number' }, mach: { type: 'number' }, reynolds: { type: 'number' }, chord_m: { type: 'number' }, altitude_m: { type: 'number' }, model: { type: 'string' }, grid_n: { type: 'integer' }, initial_condition: { type: 'string' }, t_end: { type: 'number' }, cfl: { type: 'number' }, study: { type: 'string' }, gamma: { type: 'number' }, wall_temperature_K: { type: 'number' }, method: { type: 'string' }, tunnel_height_over_chord: { type: 'number' }, test_section: { type: 'string', enum: ['closed', 'open'] }, model_offset_fraction: { type: 'number' } } } } },
  { type: 'function', function: { name: 'run_cfd', description: 'Run the CFD solver with the current CFD settings and wait for it to finish (switches to CFD mode). Set geometry/conditions first with set_geometry and set_conditions if they must change. Returns forces, convergence and the panel-method reference Cl for comparison.', parameters: { type: 'object', properties: { wait_seconds: { type: 'integer', description: 'maximum seconds to wait (default 90)' } } } } },
  { type: 'function', function: { name: 'run_nslab', description: 'Run the NSLab 3D Navier-Stokes experiment with the current NSLab settings and wait for it (switches to ns mode). Returns energy, enstrophy, dissipation, max vorticity and its growth factor, stretching, the verification health report and refinement-study verdicts.', parameters: { type: 'object', properties: { wait_seconds: { type: 'integer', description: 'maximum seconds to wait (default 300)' } } } } },
  { type: 'function', function: { name: 'sweep_alpha', description: 'Compute a polar table over a RANGE of angles in sub or hyper mode (for best L/D, stall onset, lift slope). Does not change the current case; returns a summary with best_L_over_D and the rows.', parameters: { type: 'object', properties: { from_deg: { type: 'number' }, to_deg: { type: 'number' }, step_deg: { type: 'number' } } } } },
];

/** Phi-4 models were trained on Microsoft's function-calling format: a simplified spec inside <|tool|>…<|/tool|> in the
 *  system prompt and calls emitted as functools[{"name":…,"arguments":{…}}]. Other models get the API-native tools. */
const toolMode = () => (cfg.toolFormat === 'native' ? 'native' : cfg.toolFormat === 'phi' ? 'phi' : (/phi/i.test(cfg.model) ? 'phi' : 'native'));
const PHI_TOOLS = TOOLS.map(t => ({ name: t.function.name, description: t.function.description,
  parameters: Object.fromEntries(Object.entries(t.function.parameters.properties || {}).map(([k, v]) => [k, Object.assign({ description: v.description || k, type: v.type === 'integer' ? 'int' : v.type === 'number' ? 'float' : v.type === 'string' ? 'str' : v.type }, v.enum ? { enum: v.enum } : {})])) }));
const PHI_INSTRUCTIONS = `
In addition to plain text responses, you can call one or more of the provided functions. Call a function whenever the user asks you to change the case, run something, or compute a polar, and call get_state or run_cfd before quoting results that are not in the current state above.
If you decide to call functions:
  * prefix the call with the functools marker (no closing marker), as a single JSON list: functools[{"name": "<function name>", "arguments": {<arguments as JSON>}}]
  * output nothing else in that message; after the function results arrive, answer the user in plain text
  * follow the provided JSON schema and do not invent argument values
Available functions as JSON spec:
<|tool|>${JSON.stringify(PHI_TOOLS)}<|/tool|>`;
function load() { try { return JSON.parse(localStorage.getItem('pwt.assist') || '{}'); } catch (e) { return {}; } }
function save() { try { localStorage.setItem('pwt.assist', JSON.stringify({ url: cfg.url, model: cfg.model, temperature: cfg.temperature, toolFormat: cfg.toolFormat || 'auto' })); } catch (e) { /* ignore */ } }
const isLocal = u => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(u);

// ------------------------------------------------------------------ server
async function probe() {
  connected = false; kind = null; models = [];
  const base = cfg.url.replace(/\/+$/, '');
  try {
    const r = await fetch(base + '/api/tags', { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const j = await r.json(); kind = 'ollama'; models = (j.models || []).map(m => m.name); connected = true; }
  } catch (e) { /* try OpenAI-compatible */ }
  if (!connected) {
    try { const r = await fetch(base + '/v1/models', { signal: AbortSignal.timeout(4000) }); if (r.ok) { const j = await r.json(); kind = 'openai'; models = (j.data || []).map(m => m.id); connected = true; } }
    catch (e) { /* not reachable */ }
  }
  if (connected && models.length && !models.some(m => m === cfg.model || m.startsWith(cfg.model + ':'))) {
    const pick = models.find(m => /phi4-mini/i.test(m)) || models.find(m => /phi/i.test(m));
    if (pick) { cfg.model = pick; save(); }
  }
  renderSettings(); renderStatus();
  return connected;
}
async function chat(messages) {
  const base = cfg.url.replace(/\/+$/, '');
  abort = new AbortController();
  if (kind === 'ollama') {
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
      body: JSON.stringify(Object.assign({ model: cfg.model, messages, stream: false, options: { temperature: cfg.temperature, num_ctx: cfg.numCtx } }, toolMode() === 'native' ? { tools: TOOLS } : {})) });
    if (!r.ok) throw new Error('Ollama HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json(), m = j.message || {};
    const calls = (m.tool_calls || []).map(tc => ({ name: tc.function.name, args: tc.function.arguments || {} }));
    return { content: m.content || '', toolCalls: calls.length ? calls : parseTextCalls(m.content || ''), raw: m };
  }
  const r = await fetch(base + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
    body: JSON.stringify(Object.assign({ model: cfg.model, messages, temperature: cfg.temperature }, toolMode() === 'native' ? { tools: TOOLS } : {})) });
  if (!r.ok) throw new Error('Server HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json(), m = (j.choices && j.choices[0] && j.choices[0].message) || {};
  const calls = (m.tool_calls || []).map(tc => { let a = {}; try { a = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch (e) { a = {}; } return { id: tc.id, name: tc.function.name, args: a || {} }; });
  return { content: m.content || '', toolCalls: calls.length ? calls : parseTextCalls(m.content || ''), raw: m };
}
/** Small models sometimes emit tool calls as text ("functools[...]" or bare JSON). Recover them. */
function parseTextCalls(text) {
  const out = [];
  const isSpecEcho = o => o && (o.type === 'function' || (o.parameters && !o.arguments && typeof o.description === 'string'));
  const tryParse = s => { try { const v = JSON.parse(s); const arr = Array.isArray(v) ? v : [v]; for (const o of arr) { if (isSpecEcho(o)) continue; if (o && typeof o.name === 'string' && TOOLS.some(t => t.function.name === o.name)) { const a = o.arguments != null ? o.arguments : (o.parameters || {}); out.push({ name: o.name, args: typeof a === 'string' ? (() => { try { return JSON.parse(a); } catch (e) { return {}; } })() : a }); } } } catch (e) { /* not JSON */ } };
  const balanced = (str, from) => { let depth = 0; for (let i = from; i < str.length; i++) { const ch = str[i]; if (ch === '[' || ch === '{') depth++; else if (ch === ']' || ch === '}') { depth--; if (depth === 0) return str.slice(from, i + 1); } } return null; };
  for (const re of [/functools\s*(?=\[)/, /<\|tool_call\|>\s*(?=\[)/, /(?=\[\s*\{\s*"name")/]) {
    const m = text.match(re); if (m) { const j = balanced(text, m.index + m[0].length); if (j) tryParse(j); if (out.length) break; }
  }
  if (!out.length) { const m2 = text.match(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"[\s\S]*\}/); if (m2) { const j = balanced(text, m2.index); if (j) tryParse(j); } }
  return out;
}
/** Remove raw call/spec text a small model may leave in its prose. */
function cleanAnswer(text) {
  return text.replace(/<\|tool_call\|>[\s\S]*?(<\|\/tool_call\|>|$)/g, '').replace(/functools\s*\[[\s\S]*?\](?=\s|$)/g, '').replace(/\[\s*\{\s*"type"\s*:\s*"function"[\s\S]*\]\s*\]?/g, '').trim();
}

// ------------------------------------------------------------------ tools
async function runTool(name, args) {
  args = args || {};
  switch (name) {
    case 'get_state': return api.getState();
    case 'set_mode': return api.setMode(args.mode);
    case 'set_geometry': return api.setGeometry(args);
    case 'set_conditions': return api.setConditions(args);
    case 'run_cfd': return await api.runCfd(Math.min(300, Math.max(5, args.wait_seconds || 90)));
    case 'run_nslab': return await api.runNslab({ wait_seconds: Math.min(1800, Math.max(10, args.wait_seconds || 300)) });
    case 'sweep_alpha': return api.sweep(args.from_deg, args.to_deg, args.step_deg);
    default: return { error: 'unknown tool ' + name };
  }
}
const summarise = (name, res) => {
  if (!res || res.error) return name + ' → ' + (res && res.error ? 'error: ' + res.error : 'no result');
  if (name === 'run_cfd') return `run_cfd → ${res.status}${res.reason ? ' (' + res.reason + ')' : ''}, ${res.iterations} it, Cl ${res.Cl}, Cd ${res.Cd}`;
  if (name === 'sweep_alpha') return `sweep_alpha → ${res.rows ? res.rows.length : 0} points`;
  if (name === 'run_nslab') return `run_nslab → ${res.run_status}${res.results ? `, t ${res.results.t}, max|ω| ×${res.results.max_vorticity_growth_factor}, health ${res.results.verification ? res.results.verification.overall : '—'}` : ''}`;
  if (name === 'get_state') return `get_state → ${res.mode} · ${res.aerofoil}`;
  return name + ' → ' + (res.aerofoil || res.mode || 'ok');
};

// ------------------------------------------------------------------ chat loop
async function send(text) {
  text = (text || '').trim(); if (!text || busy) return;
  if (!connected) { const ok = await probe(); if (!ok) { addMsg('system', 'Not connected. Open ⚙ settings, check the server URL, and see the setup notes.'); return; } }
  if (!isLocal(cfg.url) && !confirm('The server URL is not on this machine — your question and the current results will be sent to ' + cfg.url + '. Continue?')) return;
  busy = true; renderStatus();
  history.push({ role: 'user', content: text }); addMsg('user', text);
  const thinking = addMsg('assistant', '…', true);
  const phi = toolMode() === 'phi';
  const state0 = api.getState(), evidence = collectNumbers(state0, []);
  const msgs = [{ role: 'system', content: SYSTEM + '\n\nCurrent state (for reference, already up to date):\n' + JSON.stringify(state0) + (phi ? '\n' + PHI_INSTRUCTIONS : '') }].concat(history.slice(-14));
  let nudged = false, usedTools = false, ranCfd = false, runNudged = false;
  try {
    let final = null;
    for (let round = 0; round < 6; round++) {
      const reply = await chat(msgs);
      if (!reply.toolCalls.length && !usedTools && !nudged && ACTION_RE.test(text)) {
        nudged = true;
        msgs.push({ role: 'assistant', content: reply.content || '' });
        msgs.push({ role: 'system', content: 'The user asked for an action (set / switch / run / sweep). You must call the appropriate function(s) now' + (phi ? ' using functools[...]' : '') + ' before answering. Do not describe results you have not computed.' });
        continue;
      }
      if (reply.toolCalls.length) {
        usedTools = true;
        const assistantMsg = phi
          ? { role: 'assistant', content: 'functools' + JSON.stringify(reply.toolCalls.map(tc => ({ name: tc.name, arguments: tc.args }))) }
          : kind === 'ollama'
          ? { role: 'assistant', content: reply.content || '', tool_calls: reply.toolCalls.map(tc => ({ function: { name: tc.name, arguments: tc.args } })) }
          : { role: 'assistant', content: reply.content || null, tool_calls: reply.toolCalls.map((tc, i) => ({ id: tc.id || 'call_' + round + '_' + i, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) };
        msgs.push(assistantMsg);
        for (let i = 0; i < reply.toolCalls.length; i++) {
          const tc = reply.toolCalls[i];
          addMsg('tool', '⚙ ' + tc.name + ' ' + JSON.stringify(tc.args));
          let res; try { res = await runTool(tc.name, tc.args); } catch (e) { res = { error: e.message }; }
          collectNumbers(res, evidence); if (tc.name === 'run_cfd') ranCfd = true;
          thinking.querySelector('.mbody').textContent = summarise(tc.name, res) + ' …';
          const content = JSON.stringify(res);
          msgs.push(phi ? { role: 'tool', content: JSON.stringify({ function: tc.name, result: res }) } : kind === 'ollama' ? { role: 'tool', content, tool_name: tc.name } : { role: 'tool', tool_call_id: assistantMsg.tool_calls[i].id, content });
        }
        continue;
      }
      if (!ranCfd && !runNudged && RUN_RE.test(text) && api.getState().mode === 'cfd' && api.getState().results == null) {
        runNudged = true;
        msgs.push({ role: 'assistant', content: reply.content || '' });
        msgs.push({ role: 'system', content: 'You have not run the solver, so there are no results for these settings. Call run_cfd now' + (phi ? ' using functools[{"name": "run_cfd", "arguments": {"wait_seconds": 120}}]' : '') + ' and then answer with the returned numbers.' });
        continue;
      }
      final = cleanAnswer(reply.content || '') || '(no answer)'; break;
    }
    if (final == null) final = 'I stopped after several tool calls without a final answer — please ask again more specifically.';
    history.push({ role: 'assistant', content: final });
    thinking.remove(); addMsg('assistant', final);
    const bad = auditNumbers(final, evidence, text);
    if (bad.length) addMsg('system', '⚠ ' + (bad.length === 1 ? 'The figure ' + bad[0] : 'The figures ' + bad.slice(0, 4).join(', ')) + ' could not be matched to any computed result — verify against the tiles before relying on it.');
  } catch (e) {
    thinking.remove();
    addMsg('system', e.name === 'AbortError' ? 'Cancelled.' : 'Error: ' + e.message + (/Failed to fetch|NetworkError/.test(e.message) ? ' — is the server running and is OLLAMA_ORIGINS set? See setup notes in ⚙.' : ''));
    history.pop();
  }
  busy = false; abort = null; renderStatus();
}

// ------------------------------------------------------------------ rendering
/** Hallucination guard: every figure in the final answer must match a number from the state or a tool result. */
function collectNumbers(v, out) {
  if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  else if (Array.isArray(v)) v.forEach(x => collectNumbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => collectNumbers(x, out));
  else if (typeof v === 'string') { const m = v.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi); if (m) m.forEach(t => { const n = parseFloat(t); if (Number.isFinite(n)) out.push(n); }); }
  return out;
}
function auditNumbers(answer, evidence, question) {
  const ev = evidence.slice(); collectNumbers(question, ev);
  const toks = answer.match(/-?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?/gi) || [];
  const bad = [];
  for (const t of toks) {
    const clean = t.replace(/,/g, ''), n = parseFloat(clean);
    if (!Number.isFinite(n)) continue;
    const sig = clean.replace(/^-?0*\.?0*/, '').replace(/[.]/g, '').replace(/e.*$/i, '').length;
    if (sig < 3 && !/\./.test(clean)) continue;                 // "4 degrees", "3 sentences", list numbers
    const ok = ev.some(e => Math.abs(e - n) <= Math.max(1e-9, 0.006 * Math.abs(e)) || Math.abs(e * 1000 - n) <= 0.006 * Math.abs(e * 1000) || Math.abs(e / 1000 - n) <= 0.006 * Math.abs(e / 1000) || Math.abs(e * 100 - n) <= 0.006 * Math.abs(e * 100));
    if (!ok && !bad.includes(t)) bad.push(t);
  }
  return bad;
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function md(text) {
  const lines = esc(text).split('\n'); let html = '', inList = null, inCode = false;
  const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*]+)\*/g, '$1<i>$2</i>');
  for (const raw of lines) {
    if (raw.startsWith('```')) { if (inCode) { html += '</pre>'; inCode = false; } else { if (inList) { html += '</' + inList + '>'; inList = null; } html += '<pre>'; inCode = true; } continue; }
    if (inCode) { html += raw + '\n'; continue; }
    const li = raw.match(/^\s*[-*•]\s+(.*)/), ol = raw.match(/^\s*\d+[.)]\s+(.*)/), h = raw.match(/^#{1,4}\s+(.*)/);
    if (li || ol) { const tag = li ? 'ul' : 'ol'; if (inList !== tag) { if (inList) html += '</' + inList + '>'; html += '<' + tag + '>'; inList = tag; } html += '<li>' + inline((li || ol)[1]) + '</li>'; continue; }
    if (inList) { html += '</' + inList + '>'; inList = null; }
    if (h) { html += '<h5>' + inline(h[1]) + '</h5>'; continue; }
    if (raw.trim() === '') { html += '<br>'; continue; }
    html += '<p>' + inline(raw) + '</p>';
  }
  if (inList) html += '</' + inList + '>'; if (inCode) html += '</pre>';
  return html;
}
function addMsg(role, text, pending) {
  const box = S.$('aMsgs'), el = document.createElement('div');
  el.className = 'amsg ' + role + (pending ? ' pending' : '');
  el.innerHTML = '<div class="mbody"></div>';
  const body = el.querySelector('.mbody');
  if (role === 'assistant' && !pending) body.innerHTML = md(text); else body.textContent = text;
  box.appendChild(el); box.scrollTop = box.scrollHeight;
  return el;
}
function renderStatus() {
  const el = S.$('aStatus'); if (!el) return;
  el.textContent = busy ? '● working…' : connected ? `● ${kind === 'ollama' ? 'Ollama' : 'server'} · ${cfg.model}` : '○ not connected';
  el.className = 'astatus ' + (busy ? 'busy' : connected ? 'ok' : 'off');
  S.$('aSend').disabled = busy; S.$('aStop').hidden = !busy;
}
function renderSettings() {
  S.$('aUrl').value = cfg.url; S.$('aTemp').value = cfg.temperature; S.$('aToolFmt').value = cfg.toolFormat || 'auto';
  const sel = S.$('aModel');
  const opts = Array.from(new Set([cfg.model].concat(models)));
  sel.innerHTML = opts.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  sel.value = cfg.model;
  S.$('aModels').textContent = connected ? (models.length ? models.length + ' model(s) available' : 'connected') : 'not reachable — check the URL and the setup notes below';
}
function toggle(show) {
  const open = show != null ? show : S.$('assist').hidden;
  S.$('assist').hidden = !open; document.querySelector('main').classList.toggle('with-assist', open);
  S.$('btnAssist').classList.toggle('active', open);
  if (open && !connected) probe();
  if (open) setTimeout(() => S.$('aText').focus(), 50);
}
function wire() {
  S.$('btnAssist').addEventListener('click', () => toggle());
  S.$('aClose').addEventListener('click', () => toggle(false));
  S.$('aSettingsBtn').addEventListener('click', () => { const p = S.$('aSettings'); p.hidden = !p.hidden; });
  S.$('aSend').addEventListener('click', () => { const t = S.$('aText'); const v = t.value; t.value = ''; send(v); });
  S.$('aStop').addEventListener('click', () => { if (abort) abort.abort(); });
  S.$('aText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); S.$('aSend').click(); } });
  S.$('aUrl').addEventListener('change', e => { cfg.url = e.target.value.trim() || DEFAULTS.url; save(); probe(); });
  S.$('aModel').addEventListener('change', e => { cfg.model = e.target.value; save(); renderStatus(); });
  S.$('aTemp').addEventListener('change', e => { cfg.temperature = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.2)); save(); });
  S.$('aToolFmt').addEventListener('change', e => { cfg.toolFormat = e.target.value; save(); });
  S.$('aTest').addEventListener('click', async () => { S.$('aModels').textContent = 'testing…'; await probe(); });
  S.$('aClear').addEventListener('click', () => { history = []; S.$('aMsgs').innerHTML = ''; });
  S.$('aChips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.dataset.q); });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); } });
}
function init(shared, appApi) { S = shared; api = appApi; wire(); renderSettings(); renderStatus(); }
return { init, toggle, send, probe, cfg, get connected() { return connected; }, get history() { return history; } };
})();
