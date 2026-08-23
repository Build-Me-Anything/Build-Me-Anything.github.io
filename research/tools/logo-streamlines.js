// Computes the geometry for the Pocket Wind Tunnel logo from the tool's own panel method:
// NACA 2412 at α = 4° and a fan of streamlines integrated through the Hess–Smith velocity field.
// Output: research/tools/logo-geometry.json  { airfoil: [[x,y],…], streamlines: [[[x,y],…],…], alpha }
const fs = require('fs'), path = require('path');
const WT = require(path.join(__dirname, '..', '..', 'pocket-wind-tunnel', 'src', 'solver.js'));
const alpha = 4, geo = WT.naca4(0.02, 0.4, 0.12, 160);
const sys = WT.buildSystem(geo), sol = WT.solveInviscid(sys, alpha);
const vel = (x, y) => WT.velocityAt(sys, sol, x, y);
// is (x,y) inside the section? ray-cast against the closed polygon
const inside = (x, y) => { let c = false; const n = geo.x.length - 1; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = geo.x[i], yi = geo.y[i], xj = geo.x[j], yj = geo.y[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const streamlines = [];
for (const y0 of [-0.42, -0.30, -0.19, -0.10, -0.035, 0.035, 0.10, 0.19, 0.30, 0.42]) {
  let x = -1.1, y = y0, pts = [[x, y]]; const h = 0.01;
  for (let k = 0; k < 400 && x < 2.1; k++) {   // RK4 in the velocity field
    const k1 = vel(x, y), k2 = vel(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1]), k3 = vel(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1]), k4 = vel(x + h * k3[0], y + h * k3[1]);
    const nx = x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), ny = y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (inside(nx, ny) || !Number.isFinite(nx + ny)) break;
    x = nx; y = ny; pts.push([x, y]);
  }
  streamlines.push(pts.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]));
}
const out = { alpha, Cl: +sol.Cl.toFixed(4), airfoil: Array.from(geo.x, (x, i) => [+x.toFixed(5), +geo.y[i].toFixed(5)]), streamlines };
fs.writeFileSync(path.join(__dirname, 'logo-geometry.json'), JSON.stringify(out));
console.log(`NACA 2412 α ${alpha}°: Cl ${out.Cl}; ${streamlines.length} streamlines, ${streamlines.map(s => s.length).join('/')} points; ${geo.x.length} surface nodes`);
