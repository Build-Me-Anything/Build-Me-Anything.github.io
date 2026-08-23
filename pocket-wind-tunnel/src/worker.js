// Web Worker entry: the solver source is prepended to this file at build time, so `WT` is in scope.
// Computes the velocity field on a screen-aligned grid so the UI thread stays responsive.
self.onmessage = e => {
  const g = WT.fieldGrid(e.data);
  self.postMessage(g, [g.u.buffer, g.v.buffer, g.inside.buffer]);
};
