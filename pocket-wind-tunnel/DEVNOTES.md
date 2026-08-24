# Pocket Wind Tunnel — developer notes

Everything a future session needs to extend this tool without re-deriving it. Written for a reader who has the
source but none of the conversation that produced it.

---

## 1. Architecture

Single deliverable: **`Pocket Wind Tunnel.html`** (~375 kB), built by `node build.js`, which inlines every file in
`src/` into one self-contained page. **Never edit the built HTML** — edit `src/` and rebuild. `node build.js --verify`
runs the four fast suites first and refuses to build if one fails; the build stamps `window.PWT_BUILD`
(`{version, date, nslab}`) into the page, and every NSLab dossier records it.

```
src/solver.js      subsonic core: NACA/coordinate geometry, Hess–Smith panel method, integral BL, ISA,
                   Prandtl–Glauert, + tunnel-wall image system (buildSystem(geo, {walls}))
src/hyper.js       hypersonic core: US76 atmosphere, exact shock/PM relations, shock-expansion, Newtonian,
                   Eckert reference-temperature heating, Sutton–Graves, Billig
src/cfd.js         2D compressible Navier–Stokes/RANS finite-volume solver (SA or k-ω SST) + O-mesh generator
src/cfd-worker.js  Web Worker entry for the CFD solver (solver.js + cfd.js are prepended at build time)
src/nslab.js       NSLab core: mixed-radix FFT, 3D real transforms, pseudo-spectral incompressible NS (RK4),
                   diagnostics, health report, refinement-study summary, evidence dossier
src/nslab-worker.js Web Worker entry for NSLab (nslab.js prepended); runs single cases and refinement ladders
src/worker.js      Web Worker entry for the subsonic velocity field
src/app.js         shell: state, canvas, view, plots, tiles, mode switching, AppAPI (the assistant's tool surface)
src/app-hyper.js   hypersonic mode UI      src/app-cfd.js     CFD mode UI
src/app-tunnel.js  test-section mode UI    src/app-assist.js  local-LLM assistant panel
src/app-nslab.js   NSLab mode UI (slices, histories, budget, spectrum, refinement, alignment, health report)
gpu/nslab_gpu.py   CuPy/cuFFT port of nslab.js for batch runs (float64; same JSON output) — see gpu/README.md
src/index.html     page template with <!-- INLINE:xxx --> markers    src/style.css
```

**Module pattern.** Physics cores are IIFEs exporting a global (`WT`, `HT`, `CFD`, `NS`) *and* `module.exports`, so the
same code runs in the browser and under Node for the test suites. UI modules are IIFEs exporting a `*UI` object with
a common shape: `init(shared)`, `TILES`, `tabsHtml()`, `draw(ctx)`, `drawCp()`, `drawPolar()`, `hover()`,
`exportData(kind)`, plus mode-specific bits. `app.js` owns the shared helpers object passed to `init`.

**Adding a mode** — the five wiring points (all in `src/app.js` unless noted):
1. `build.js` — add an `INLINE:` marker and the `put(...)` call.
2. `src/index.html` — add the mode button to `#modeSwitch`, a `<section data-mode="yourmode">` control panel, and the
   `<!-- INLINE:appyourmode -->` marker. Sections can list several modes: `data-mode="sub tunnel"`.
3. `setMode()` — tiles, polar tabs, polar note.
4. The `drawCp()` / `drawPolar()` / `draw()` / `updateTiles()` / `doExport()` dispatch lines (each starts with a
   `if (state.mode === '...') return XxxUI...`).
5. `AppAPI` — `getState()` branch and `setConditions()` branch, so the assistant can drive it. Then add the mode to
   the `set_mode` enum and the `set_conditions` description in `src/app-assist.js`.

---

## 2. Numerical lessons (each of these cost real debugging time)

### Subsonic panel method
- Panel ordering is **clockwise**: TE → lower → LE → upper → TE, with node `iLE` at the leading edge. Outward normal
  is `(-sin, cos)` for that ordering. Getting this backwards silently flips lift.
- `Cm` is returned **negated** from the raw integral: the integral is anticlockwise-positive about c/4, the aero
  convention is nose-up positive.
- Head's entrainment equation needs the `/θ` on the entrainment term (`0.0306 (H1-3)^-0.6169 / θ`). Omitting it made
  Cd ~2× low and looked plausible.
- `shapeFactor()` returns **negated** doublet strength: sources are positive where the stream enters the body.

### Tunnel walls (method of images)
- Two infinite image rows per singularity, period 2h, summed in closed form via `cot(iπ(z−z₀)/2h)` kernels.
  Closed walls: sources keep sign, vortices flip in the odd row. Open jet: the opposite.
- 3-point Gauss quadrature per panel is enough for machine-precision wall tangency (< 1e-14).

### CFD (the expensive ones)
- **Entropy fix on acoustic waves only.** Applying Harten's fix to the *convective* eigenvalue adds O(0.05·a)
  artificial diffusion normal to the wall; at M 0.15 that is ~25× the physical viscosity and destroys the boundary
  layer. Use `l2 = max(|un|, 1e-4·a)`.
- **Low-Mach fix required.** Scale the velocity jumps in the Roe dissipation by the local Mach number
  (Rieper/Thornber). Without it, spurious nose drag ~0.005 and stagnation Cp 1.12 instead of 1.00.
- **ν̃ must be convected with the discrete mass flux** (`FF[4] = FF[0] · ν̃/ρ`, upwind), not with an independent
  Roe scalar flux — otherwise mass and turbulence convection disagree and ν̃ oscillates cell-to-cell.
- **The SA equation needs its own implicit operator.** Sharing the mean-flow LU-SGS diagonal (which carries acoustic
  eigenvalues) starves it: ν̃ never develops. Use convective + diffusive speeds only (`lamIs/lamJs/diagS`), keep both
  production and destruction Jacobians on the diagonal, and bound the update to ±50 % of the local value.
- **LU-SGS: one symmetric pass only.** A second pass over the Jameson–Yoon operator diverges (`cond.sweeps` exists
  but leave it at 1).
- **Initialise from the panel method.** `cond.velocityFn` + an analytic BL and log-law ν̃ profile cuts the transient
  by ~10×. Without it the RANS cases need 3–4× the iterations.
- Wall pressure: first-order (`p[k0]`) by default. Linear extrapolation to the wall was worse on every case tested.
- Convergence: the residual plateaus around 2–3 orders on RANS cases; the worker also stops on **force stability**
  (Cl, Cd flat over 500 iterations), which is the meaningful criterion here.
- **Attached-flow envelope ends near α 12°** on the 128×48 / 192×64 meshes: at α 15° both SA and SST fall into a
  massively separated state (Cl ≈ 0.6–0.9, Cd ≈ 0.2, μt/μ > 20 000) at CFL 20 and 50, while the TMR references are
  attached (Cl 1.55 / 1.50). Pseudo-time marching from the potential-flow start is the limitation, not the models.

### k-ω SST (second turbulence model, same machinery)
- `cfd.js` now carries NT turbulence scalars (`TQ = [rn]` for SA, `[rn, rw]` for SST; `nut` is ν̃ or k, `tw` is ω).
  Flux, LU-SGS and update loops run to `NEQ = 4 + NT`; `diagS[m]`/`diagSrc[m]` are per scalar. SA results are
  bit-identical to before the refactor (suite numbers unchanged).
- Menter 2003 constants from the TMR; μt = ρa₁k / max(a₁ω, S·F2) with S = √(2SᵢⱼSᵢⱼ); production limiter
  10β*ρωk in the k equation; ω production γρS² (unlimited); cross-diffusion only in the outer branch.
- **μt and F1 need the strain rate**, so they are computed in `sstClosure()` *after* `gradients()`, not in
  `primitives()` like SA. Wall ghosts get μt = 0, F1 = 1.
- **ω wall condition**: ghost = max(2ω_w − ω_cell, ω_w) with ω_w = 60ν/(β₁d₁²), d₁ = first cell-centre distance.
  This puts ω_w on the wall face and makes the one-sided gradient in `viscFlux` exact. First-cell ω then lands at
  0.86× the analytic 6ν/(β₁d²) (checked in the suite).
- **k update limiter must not reference k∞**: k∞ = 9e-9 is so small that a ±50 % bound relative to it freezes k at
  zero. It is referenced to 1e-5·V∞² instead; ω is referenced to ω∞ and floored at 1e-4·ω∞.
- Negative cross-diffusion goes on the ω diagonal; destruction Jacobians β*ω and 2βω on both diagonals; the k
  production Jacobian is added (not subtracted) for damping, as with SA.
- Free stream per TMR: k∞ = 9e-9 a∞², ω∞ = 1e-6 ρ∞a∞²/μ∞ (μt∞/μ∞ = 0.009). Both decay along the inflow; harmless.
- Initial k/ω profiles: k = u_τ²/√β* · min(1, (d⁺/8)²) · (1 − d/1.2δ), ω = √(ω_vis² + ω_log²) with
  ω_vis = 6ν/(β₁d²), ω_log = u_τ/(√β* κ d). Without them the k equation needs several thousand more iterations.
- On the same mesh SA and SST give near-identical attached-flow results (α 10°, 128×48, 4000 it: Cl 1.107 / 1.106,
  Cd 0.0179 / 0.0184). The models only separate near stall — which is exactly where the solver cannot converge yet.

### Hypersonic
- Blunt-nose hand-off must use the **exact sonic point**: modified Newtonian holds while θ > θ\*, where
  p\* = p₀₂·(2/(γ+1))^(γ/(γ−1)); downstream, expand isentropically from M = 1 with p₀ = p₀₂. An iterative
  "switch when M ≥ 1" test made Cl–α jagged (2nd differences 3e-2 → 3.5e-5 after the fix).
- Flat-plate heating correlations are singular at x → 0; exclude the first 1 % chord from the q̇max scale and use
  Sutton–Graves for the nose.

### NSLab (3D periodic-box Navier–Stokes, pseudo-spectral)
- **Pseudo-spectral, not finite volume.** For the periodic box the Fourier method is exact in incompressibility,
  gives E(k) for free and beats a second-order scheme with 4× the points per direction. Deriving the 3D solver from
  the compressible FV core would have been the wrong tool for the Taylor–Green / regularity questions.
- **FFT is home-grown** (mixed radix 2/3/4 Stockham, real-to-complex by packing two real lines into one complex
  line, Hermitian half-spectrum in y/z). Grid sizes must be 2^a·3^b. The radix-3 butterfly sign was wrong on the
  first attempt — `validate-ns.js` compares every radix combination against a direct DFT; keep that check.
- **Project the 6-array set, not (re, im) pairs.** `project(U)` takes `[xr, xi, yr, yi, zr, zi]`; an earlier call
  passed the same array twice and silently used real parts as imaginary parts → ∇·u ≠ 0 and energy blow-up.
- **Budget checks must be RK4-consistent.** Comparing E(t+Δt) − E(t) with −∫ε dt by trapezoid shows O(Δt²)
  error of the *check*, not the scheme. Simpson weights (1, 2, 2, 1)/6 over ε at the four RK4 stage states give
  residuals ~1e-9 on resolved runs (PASS ≤ 1e-5). Same for the enstrophy budget with ⟨ω·S·ω⟩ − 2νP.
- The nonlinear energy transfer Re Σ û*·P[(u×ω)^] is exactly zero for *any* dealiasing because u·(u×ω) = 0
  pointwise and Parseval is exact on the grid; it is a round-off check (1e-19), not a dealiasing check.
  Dealiasing shows up in the enstrophy budget and in spectral-vs-physical ⟨ω·S·ω⟩ (identical while resolved,
  diverging by 30 % when not).
- **μt-style gotchas do not apply, but the diagnostics have their own:** Q = ¼|ω|² − ½‖∇u‖² lets Q accumulate
  per velocity component without storing the full gradient tensor; ω·S·ω = Σ ω_i ω_j ∂_j u_i likewise.
  Strain eigenvectors use the trigonometric 3×3 solver + row cross products (no iteration).
- **Taylor–Green symmetry:** the direct velocity-derivative skewness ⟨(∂ₓu)³⟩ is zero for TGV by the x → π − x
  reflection the equations preserve — use Brachet's enstrophy-production form S = −(6√15/7)⟨ω·S·ω⟩/⟨ω²⟩^{3/2}
  (reaches −0.65 near t 2.4 on 32³, then relaxes). A nonzero direct skewness would mean broken symmetry = bug.
- Adaptive Δt: min(CFL·Δx/u_max, 2.5/(3ν kc²)) with CFL 0.4 (RK4 imaginary-axis limit gives CFL ≈ 0.78).
- Cost: 32³ ≈ 35 ms/step, 64³ ≈ 0.3 s/step, 96³ ≈ 1+ s/step (Node 24 and Chrome alike). 36 half-transforms per
  step (4 stages × (6 inverse + 3 forward)); `diagnose()` adds 15 more and is only run at snapshot times.
- Resolution grading uses the standard kmax·η ≥ 1 (PASS), ≥ 0.5 (WARN) and the spectral tail E(kmax)/E(peak)
  ≤ 1e-4 (PASS), ≤ 1e-2 (WARN). At Re 1600 even 64³ is FAIL (kmax·η 0.43) although its ε_max is within 1 % of the
  512³ reference — the grade is about trust, not luck: 96³ then *overshoots* (0.0139) because the undecayed tail
  piles energy at the cutoff. max|ω| is nowhere near converged (21.9 → 37.0 from 64³ to 96³).

### Local-LLM assistant
- **Phi-4 Mini ignores API-native `tools`.** It was trained on Microsoft's format: a simplified spec inside
  `<|tool|>…<|/tool|>` in the system prompt, calls emitted as `functools[{"name":…,"arguments":{…}}]` parsed from
  text. `toolMode()` picks this automatically for model names matching /phi/.
- Small-model guardrails that proved necessary: pre-digest tool results (best L/D, stall onset) rather than making it
  scan tables; put live state in the system prompt; re-prompt once if an action verb produced no tool call; and
  **audit every number in the answer against the computed results** — it invents percentages otherwise.

---

## 3. Validation reference values

Run all: `node test/validate.js && node test/validate-hyper.js && node test/validate-tunnel.js && node test/validate-ns.js && node test/validate-cfd.js`
(the first three are < 1 s; NSLab ~13 s; CFD ~50 s). `test/bench-cfd.js` holds the longer TMR runs, `test/bench-ns.js`
the Taylor–Green refinement ladders (results archived under `research/nslab/`).

| Case | Value | Source |
|---|---|---|
| NACA 0012, α 5°, inviscid | Cl 0.602 | panel-method reference ≈ 0.60 |
| NACA 2412 / 4412, α 0 | α₀ −2.11° / −4.21°, Cm −0.054 / −0.108 | Abbott & von Doenhoff −2.0/−4.0, −0.05/−0.10 |
| NACA 0012, Re 3×10⁶, α 0 | Cd 0.0064 | wind tunnel ≈ 0.0060 |
| ISA 11 km / US76 30, 50, 80 km | 22 632 Pa / 1197, 79.8, 1.05 Pa | standard atmosphere tables |
| Oblique shock M2 θ10°, M3 θ20° | β 39.31°, 37.76°; p₂/p₁ 1.707, 3.771 | NACA Report 1135 |
| Prandtl–Meyer ν(2), ν(3); pitot M5 | 26.38°, 49.76°; 32.65 | NACA 1135 |
| Newtonian flat plate | Cl = 2sin²α·cosα, L/D = cot α | exact |
| Euler NACA 0012 M 0.3 α 2° | Cl within 1 % of panel+PG, Cd < 0.002 | self-consistency |
| Transonic AGARD M 0.8 α 1.25° | Cl 0.347, Cd 0.0226 | reference 0.35, 0.022 |
| **SA NACA 0012, M 0.15, Re 6×10⁶** | **α 10°: Cl 1.12 (TMR 1.091); α 0: Cd 0.0092 (TMR 0.0082)** | **NASA TMR (CFL3D/FUN3D)** |
| **SST NACA 0012, M 0.15, Re 6×10⁶** | **α 10°: Cl 1.15 @1500 it, 1.107 @4000 (TMR 1.080); Cd 0.0179 (TMR 0.0126), 0.0147 on 192×64; α 0: Cd 0.0090 (TMR ≈ 0.0081)** | **NASA TMR** |
| SST wall/blending checks | first-cell ω = 0.86 × 6ν/(β₁d²); F1 = 1 at wall, < 0.05 outer; k ≥ 0 | analytic near-wall solution |
| Laminar NACA 0012, Re 5000, M 0.5 | Cd 0.0614 | Swanson & Langer ≈ 0.055 |
| Tunnel: wall normal velocity | < 1e-14 | exactness of the image system |
| Tunnel: cylinder blockage | within 3 % of (π²/12)(d/h)² | doublet-row theory |
| Tunnel: Λ cylinder / NACA 0012 | 4.03 / 0.235 | exact 4 / charts 0.2–0.3 |
| Tunnel: corrected vs free air | within 0.3–0.6 % | Barlow–Rae–Pope |
| NSLab FFT / 3D round trip | 7e-12 / 1e-15 | direct DFT |
| NSLab ABC exact solution, t = 1 | L∞ 3e-12; RK4 order 4.01 / 3.99 | u ∝ e^{−νt} exactly |
| NSLab 2D Taylor–Green | L∞ 2e-9 | u ∝ e^{−2νt} exactly |
| **NSLab TGV Re 1600 ε_max** | **32³ 0.0078, 48³ 0.0119, 64³ 0.0134, 96³ 0.0139 (overshoot), 192³ 0.01314, 256³ 0.01291 at t 8.9** | **Brachet 1983 0.0126 at t ≈ 9; 512³ spectral ≈ 0.013** |
| NSLab TGV Re 1600 max\|ω\| peak | 64³ 21.9, 96³ 37.0, 192³ 55.1, 256³ 74.3 — not converged; ∫max\|ω\|dt to t 10: 160 / 223 / 250 | (no reference; the quantity regularity must control) |
| NSLab CPU vs GPU, 192³ | 3e-13 over 770 steps | same equations, two instruments |
| NSLab TGV diagnostics | E₀ 1/8, Z₀ 3/8, initial ⟨ω·S·ω⟩ 0, direct skewness 0, e₂ alignment | exact / symmetry / Ashurst et al. 1987 |

**NASA TMR reference numbers** (2D NACA 0012, M 0.15, Re 6×10⁶, 897×257 grid, CFL3D SA):
Cd 0.00819 at α 0; Cl 1.0909 / Cd 0.01231 at α 10°; Cl 1.5461 / Cd 0.02124 at α 15°.
SST: Cl 1.080 / Cd 0.01256 at 10°; Cl 1.502 / Cd 0.0230 at 15°. Neither 15° case is reachable here (see the envelope
note in §2); `node test/bench-cfd.js stall` reproduces the collapse, `… sst` runs the TMR α 0 / α 10 SST cases.

---

## 4. Where the persistent context lives

- `Build Me Anything/CLAUDE.md` — auto-loads every session: standing preferences and the build/test workflow.
- `pocket-wind-tunnel/DEVNOTES.md` — this file: the deep context.
- `~/.claude/skills/pocket-wind-tunnel/SKILL.md` — the `pocket-wind-tunnel` skill (user-level; skills in a project
  `.claude/skills` folder are **not** discovered on this setup).

**Keep them current.** When a new numerical pitfall, reference value or preference is learned, write it here — not
only into conversation memory, which does not survive a context clear.

## 5. Environment quirks (this machine)

- **Screenshots:** the in-app Browser pane cannot screenshot (not compositing). Use `puppeteer-core` installed in the
  scratchpad with `executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'`, `headless: 'new'`.
  `file://` URLs work, including Blob-URL Web Workers.
- **Multi-line edits:** write a Python script to the scratchpad and run it. Bash heredocs mangle Unicode and long JS.
  They also mangle backslashes (a `\|` written through a heredoc arrived as `\|`): write scripts with the Write tool,
  then run them. Markdown tables: escape `|` inside cells (`max\|w\|`) or md2docx and GitHub split the cell.
- **Instrument parity, 2026-08-24 (app 0.5.1, NSLab 0.1.1, GPU runner 0.1.2):** the four NS-003 diagnostics now exist
  in `src/nslab.js` as well as the GPU runner, plus two new ones in both — the **cutoff pile-up**
  `max E(k)/E(0.8·kmax)` over the top of the spectrum (a fit-free truncation-bottleneck signature: > 1 means energy is
  accumulating at the dealiasing edge even when the E(kmax)/E(peak) tail check passes; graded 1.2 / 2.0) and
  **‖u‖_L³** (the Escauriaza–Seregin–Šverák continuation quantity). `interpMax()` in JS uses staged contractions
  (kx → ky → kz) so each evaluation is O(N³); it is gated to N ≤ 128 inside `diagnose()` and prunes start nodes whose
  grid value is below 0.85× the best found. Start nodes must be **the largest grid values ∪ the largest grid local
  maxima** — local maxima alone miss the true peak (both implementations had this bug; the tubes 24³ test catches it).
  CPU and GPU agree to 1e-6 on the interpolated maximum (`validate-ns.js`, 12 new checks). An analyticity-strip width
  δ(t) was tried in `analyse.js` but is not reportable below kc ≈ 120 (n and δ trade off on a short window).
- **`setTile` guarded (2026-08-24):** a mode updating a tile the current layout does not render threw
  `Cannot set properties of null` — five per NSLab run, present since before this session. Now skipped silently.
- **Mode keys are `sub|tunnel|cfd|hyper|ns`** — `setMode('nslab')` silently does nothing; the headless recipe should
  click `#modeSwitch button[data-mode="ns"]`.
- **GPU runner 0.1.1 (NS-003):** spectrally interpolated max|ω| (`Solver.interpMax`, exact trigonometric interpolant +
  safeguarded Newton from top values ∪ top local maxima; reported beside the grid max, never instead), periodic-image
  diagnostic (z-extent / image gap / circular centroid of the enstrophy band), worst-instant health verdict
  (`worst` includes the worst snapshot, `worstEnd` is the old end-of-run grade), x = π slices, `peakTrack`. Lessons:
  a per-step tracker firing on every new grid record made 256³ 7× slower during the laminar rise — fire on 2 %
  increments; `np.load` on an `.npz` keeps the file open (Windows `os.replace` then fails) — use `with`; never alias
  `outs` to `st['outputs']` (duplicated snapshots after a resume). Details in `gpu/README.md`.
- **PowerShell launcher scripts must be ASCII** (or UTF-8 *with* BOM). Windows PowerShell 5.1 reads a BOM-less UTF-8
  `.ps1` as ANSI: an em dash's 0x94 byte becomes a smart quote and the script fails to parse — silently when launched
  with `Start-Process -WindowStyle Hidden`. Check with `[Management.Automation.Language.Parser]::ParseFile` before
  launching; redirect the child's stderr to a file to see the error. Python child output: set `PYTHONIOENCODING=utf-8`
  and `[Console]::OutputEncoding = UTF8` in the launcher so `Out-File` gets the Unicode log lines intact.
- **Ollama:** installed, tray app on :11434, RTX 3060 6 GB. `ollama pull` fails (registry resolves to IPv6, blocked)
  — fetch manifest+blobs with `curl -4` from `registry.ollama.ai/v2/library/<model>/…` and `ollama create -f`.
  Ollama 403s `Origin: null` (what `file://` sends); `OLLAMA_ORIGINS=*` fixes it (`=null` panics). For testing:
  `OLLAMA_HOST=127.0.0.1:11435 OLLAMA_ORIGINS=* ollama serve`.
- Node 24, Python 3.14 available. No IPv6 from the shell sandbox; IPv4 HTTPS is fine.
- **GPU:** RTX 3060 Laptop 6 GB, driver 610.62; CuPy 14.2 + nvidia cu12 wheels installed (`gpu/README.md`). Ollama keeps
  ~3.7 GB of VRAM while a model is loaded — `curl -d '{"model":"phi4-mini","keep_alive":0}' localhost:11434/api/generate`
  frees it before a big GPU run. Python console is cp1252: scripts printing Unicode must reconfigure stdout.
- **Blender 5.2** at `C:\Program Files\Blender Foundation\Blender 5.2lender.exe`; run headless with `-b -P script.py -- args`
  (the MCP add-on is normally not running). API moves vs 4.x: the compositor is `scene.compositing_node_group`
  (a CompositorNodeTree ending in a NodeGroupOutput with an Image socket; `Scene.node_tree` is gone), Glare settings are
  input sockets ('Type', 'Threshold', 'Strength', 'Size'), `use_nodes` is deprecated. Logo pipeline: `research/tools/`
  (`logo-streamlines.js` -> `logo-svg.py` -> `logo-blender.py`), assets in `research/tools/logo/`.

---

## 5b. Documents, branding, research archive

- Every `.md` gets a `.docx` twin: `node research/tools/md2docx.js <files>` (docx-js in the scratchpad node_modules; set
  `DOCX_MODULE` to its path). Cover sheet: `research/tools/cover-sheet.js` (Word) + `cover-sheet.html` (PNG preview via
  puppeteer). Logo set: `research/tools/logo/` (README there); pipeline `logo-streamlines.js` (panel-method geometry) ->
  `logo-svg.py` (vector, fontTools wordmark) -> `logo-blender.py` (Blender 5.2 headless, Cycles CPU, light/dark/mark).
- Research archive: `research/nslab/README.md` (gate table, run rows), `analyse.js <run-dir>` (peak tables, level
  comparison incl. archived long runs, analysis.md/.svg), run folders with final.json/slices/checkpoints.
- Research report: `research/nslab/NSLab Research Report.md` (v1.1) - update it, the README and the cover sheet together.

## 6. Known gaps / candidate next steps

**NSLab programme (the Navier–Stokes research line — see `research/nslab/README.md` for the gates):**
- **GPU batch runner** `gpu/nslab_gpu.py` (CuPy, float64): validated against the CPU solver to 3e-15 on TGV, ABC and
  vortex tubes; 192³ at 0.84 s/step (17 min to t = 16 vs 3.2 h on one CPU core), 256³ at 1.9 s/step but 5.98 GB — the
  6 GB card's limit. float32 is 4× faster again but exploration-only. Install: `pip install cupy-cuda12x` **plus** the
  `nvidia-*-cu12` library wheels (CuPy's wheel does not carry cuFFT); the runner adds their DLL dirs itself.
- `test/run-ns-long.js` is the CPU batch runner (checkpoint/resume, partial JSON every snapshot, slices as .f32);
  `research/nslab/run-192.ps1` launches it detached and keeps the machine awake via SetThreadExecutionState.
  192³: 9.3 s/step, 1.94 GB RSS, ~3.2 h to t = 16 on the Ryzen 9 5900HX laptop.
- Real-to-complex FFT along x only saves 2×; a radix-8/split-radix kernel or Float32 physical-space products would
  make 96³–128³ browser runs practical (128³ currently ~3 s/step in Node).
- Resolved Re 1600 TGV needs N ≳ 150 by kmax·η ≥ 1 — a Node batch job, not a browser run; archive it.
- Next research experiments: antiparallel vortex tubes (Kerr 1993) with the ladder — does max|ω| growth survive
  refinement?; random-field decay for E(k) inertial range; time-step ladders at fixed N.
- AnalysisCore (scaling fits between max|ω|, Z, ⟨ω·S·ω⟩, ε across runs) is not built; the dossier JSON is its input.
- Walls / non-periodic boundaries need a different discretisation (Chebyshev or the FV core); out of scope for v0.1.

- **Near-stall convergence** (α ≥ 13° on NACA 0012 at Re 6×10⁶): the attached TMR solution exists but the pseudo-time
  march from the potential-flow start falls into a separated state with both turbulence models. Candidates: α
  continuation (restart from a converged lower-α field), a CFL ramp tied to the turbulence residual, or dual-time
  stepping so the separated state is at least time-accurate.
- Transition modelling (γ–Re_θ, or Menter's 2015 one-equation γ model) on top of SST — SST is the natural host.
- Kármán–Tsien / Laitone compressibility (better than Prandtl–Glauert above M 0.5).
- Prandtl lifting-line finite-wing mode (3D Cl, induced drag, Oswald efficiency).
- Unsteady dual-time CFD (vortex shedding, pitching aerofoils).
- 3D / Maskell blockage corrections for the tunnel mode.
- Real-gas equilibrium air (Tannehill curve fits) for the hypersonic mode above M 10.
