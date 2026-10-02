// scene3d.js — the same flight, seen in perspective.
//
// The motion is identical to the 2D view. What changes is only the camera:
// the ground becomes a plane you look across rather than a line you look at,
// and the flight stands in a vertical plane on it. Drag to orbit.

import { fitCanvas, palette, stroke, arrow, dot, fmt, clamp, labels } from './util.js';
import { drawGrid3D, makeView3D, fit3D } from './grid.js';

export function render(canvas, cam3, o) {
  const { traj: f, second, ghost, t, show, fired = true, markers = {} } = o;
  const { ctx, w, h } = fitCanvas(canvas);
  if (!f) return;
  const P = palette();
  const L = labels();

  const end = f.pos(f.tMax);
  const reach = Math.max(10, isFinite(end.x) ? end.x : f.horiz * f.tMax);
  if (cam3.auto) fit3D(cam3, reach, Math.max(f.apexHeight, f.params.h, 5), w, h);

  const V = makeView3D(cam3, w, h);
  const poly = (pts, st) => { for (const run of V.polyline(pts)) stroke(ctx, run, st); };
  const seg = (a, b, st) => { const q = V.segment(a, b); if (q) stroke(ctx, q, st); };
  const P3 = (p) => ({ x: p.x, y: p.y, z: 0 });

  if (show.grid) drawGrid3D(ctx, P, L, V, { reach, w, h });

  if (ghost && show.path) poly(ghost.map(P3), { color: P.faint, width: 2.8 });

  if (second) {
    poly(second.path(200).map(P3), { color: P.second, width: 3.2, dash: [9, 6], alpha: .9 });
  }

  if (show.path && fired) {
    poly(f.path(260, t).concat([{ t, ...f.pos(t) }]).map(P3), { color: P.vel, width: 4.2 });
  }

  // launch mast
  if (f.params.h > 0) seg({ x: 0, y: 0, z: 0 }, { x: 0, y: f.params.h, z: 0 }, { color: P.strong, width: 3.4 });

  const now = f.pos(fired ? t : 0), v = f.vel(fired ? t : 0);
  const p = V.point(P3(now));
  if (p) {
    // a dropped line to the ground is what makes the height readable in 3D
    seg(P3(now), { x: now.x, y: 0, z: 0 }, { color: P.disp, width: 2.2, dash: [6, 6] });
    const sh = V.point({ x: now.x, y: 0, z: 0 });
    if (sh) dot(ctx, sh.x, sh.y, 4, { fill: P.disp });

    if (fired && show.velocity) {
      const e = V.point({ x: now.x + v.x * 0.55, y: now.y + v.y * 0.55, z: 0 });
      if (e) {
        arrow(ctx, p.x, p.y, e.x, e.y, { color: P.vel, width: 3.8, head: 15 });
        L.add(`velocity ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, e.x + 12, e.y - 12,
              { color: P.vel, pri: 10, size: 19, weight: 600 });
      }
    }
    if (fired && show.acceleration && f.params.g > 0) {
      const e = V.point({ x: now.x, y: now.y - f.params.g * 0.4, z: 0 });
      if (e) arrow(ctx, p.x, p.y, e.x, e.y, { color: P.acc, width: 3.2, head: 13 });
    }

    const r = clamp(V.f / Math.max(1, V.point(P3(now))?.z ?? 50) * 0.5, 5, 11);
    dot(ctx, p.x, p.y, r, { fill: P.vel });
    if (fired) dot(ctx, p.x, p.y, r + 6, { stroke: P.vel, width: 1.8 });
  }

  L.add('drag to orbit · scroll to zoom', w - 12, h - 14,
        { color: P.faint, align: 'right', pri: 4, size: 15, bg: false });
  L.draw(ctx, w, h);
}

export function attachControls3D(canvas, cam3, onChange) {
  let drag = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cam3.yaw += (e.clientX - lx) * 0.008;
    cam3.pitch = clamp(cam3.pitch - (e.clientY - ly) * 0.006, 0.05, 1.4);
    lx = e.clientX; ly = e.clientY; onChange();
  });
  const end = (e) => {
    drag = false; canvas.style.cursor = 'grab';
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); cam3.auto = false;
    cam3.dist = clamp(cam3.dist * Math.exp(e.deltaY * 0.0012), 6, 5000);
    onChange();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam3.auto = true; onChange(); });
}
