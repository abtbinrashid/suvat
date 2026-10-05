// grid.js — the ground the motion happens on, in two dimensions or three.
//
// The 2D grid is a plain x–y plane seen side on: the axes a textbook draws.
// The 3D grid is the same ground plane seen in perspective, with the flight
// in a vertical plane standing on it. The physics is identical either way —
// the 3D view exists to make "height above the ground" a thing you can see
// rather than a number on an axis.

import { stroke, fmt, niceStep } from './util.js';

/* ── 2D ─────────────────────────────────────────────────────────────── */
export function drawGrid2D(ctx, P, L, { w, h, sx, sy, px, py, cam }) {
  const stepX = niceStep(w / cam.scale, 10);
  const stepY = niceStep(h / cam.scale, 6);

  ctx.save();
  ctx.lineWidth = 1.4;
  // minor lines
  ctx.strokeStyle = P.grid;
  ctx.beginPath();
  for (let x = Math.floor(px(0) / stepX) * stepX; x <= px(w); x += stepX) {
    const X = Math.round(sx(x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, h);
  }
  for (let y = Math.floor(py(h) / stepY) * stepY; y <= py(0); y += stepY) {
    const Y = Math.round(sy(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(w, Y);
  }
  ctx.stroke();

  // the axes themselves, heavier
  ctx.strokeStyle = P.gridMajor; ctx.lineWidth = 2.2;
  ctx.beginPath();
  const X0 = Math.round(sx(0)) + 0.5;
  if (X0 > 0 && X0 < w) { ctx.moveTo(X0, 0); ctx.lineTo(X0, h); }
  ctx.stroke();
  ctx.restore();

  for (let x = Math.floor(px(0) / stepX) * stepX; x <= px(w); x += stepX) {
    if (Math.abs(x) < 1e-9 || sx(x) < 34 || sx(x) > w - 26) continue;
    L.add(fmt(x, stepX < 1 ? 1 : 0), sx(x), Math.min(h - 14, sy(0) + 20),
          { color: P.faint, align: 'center', pri: -1, bg: false, size: 15 });
  }
  for (let y = Math.floor(py(h) / stepY) * stepY; y <= py(0); y += stepY) {
    if (Math.abs(y) < 1e-9 || sy(y) < 18 || sy(y) > h - 18) continue;
    L.add(fmt(y, stepY < 1 ? 1 : 0), 10, sy(y), { color: P.faint, pri: -1, bg: false, size: 15 });
  }
}

/* ── 3D ─────────────────────────────────────────────────────────────────
   A small perspective projector. No library: a point goes into camera space,
   gets divided by its depth, and comes out on screen. That division is the
   whole of perspective. */

export function createCamera3D() {
  return { yaw: 1.95, pitch: 0.42, dist: 120, target: { x: 0, y: 0, z: 0 }, fov: 50,
           fit: true, touched: false };
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const L = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; };
// A near plane of 0.4 m divides by 0.4 and multiplies screen coordinates by
// ~1900, flinging a clipped vertex thousands of pixels off-canvas — and a
// polygon that spans the whole canvas is a polygon no bounding-box reject can
// catch. One metre, plus a guard band on the projected result, keeps a quad
// that straddles the camera from smearing across the frame.
const NEAR = 1.0;
const GUARD = 12000;

export function makeView3D(cam, w, h) {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const eye = {
    x: cam.target.x + cam.dist * cp * Math.cos(cam.yaw),
    y: cam.target.y + cam.dist * sp,
    z: cam.target.z + cam.dist * cp * Math.sin(cam.yaw),
  };
  const fwd = norm(sub(cam.target, eye));
  const right = norm(cross(fwd, { x: 0, y: 1, z: 0 }));
  const up = cross(right, fwd);
  const f = (h / 2) / Math.tan((cam.fov * Math.PI) / 360);

  const toCam = (p) => { const r = sub(p, eye); return { x: dot(r, right), y: dot(r, up), z: dot(r, fwd) }; };
  const clampG = (v, mid) => (v > mid + GUARD ? mid + GUARD : v < mid - GUARD ? mid - GUARD : v);
  const proj = (c) => ({ x: clampG(w / 2 + (f * c.x) / c.z, w / 2),
                         y: clampG(h / 2 - (f * c.y) / c.z, h / 2), z: c.z });
  const point = (p) => { const c = toCam(p); return c.z < NEAR ? null : proj(c); };
  const segment = (a, b) => {
    let ca = toCam(a), cb = toCam(b);
    if (ca.z < NEAR && cb.z < NEAR) return null;
    if (ca.z < NEAR || cb.z < NEAR) {
      const k = (NEAR - ca.z) / (cb.z - ca.z);
      const m = { x: ca.x + (cb.x - ca.x) * k, y: ca.y + (cb.y - ca.y) * k, z: NEAR };
      if (ca.z < NEAR) ca = m; else cb = m;
    }
    return [proj(ca), proj(cb)];
  };
  const polyline = (pts) => {
    const runs = []; let run = [];
    for (const p of pts) {
      const c = toCam(p);
      if (c.z < NEAR) { if (run.length > 1) runs.push(run); run = []; continue; }
      run.push(proj(c));
    }
    if (run.length > 1) runs.push(run);
    return runs;
  };

  /* Sutherland–Hodgman against the near plane, then project. A polygon that
     straddles the camera must be cut, not dropped: the ground plane you are
     standing on is exactly such a polygon, and dropping it loses the world. */
  const clipPoly = (pts) => {
    let cam = pts.map(toCam);
    const out = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i], b = cam[(i + 1) % cam.length];
      const ain = a.z >= NEAR, bin = b.z >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const k = (NEAR - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: NEAR });
      }
    }
    return out.length < 3 ? null : out.map(proj);
  };
  const distTo = (p) => { const c = toCam(p); return Math.max(1, c.z); };

  return { eye, point, segment, polyline, clipPoly, distTo, right, up, fwd, f };
}

/** Frame the flight once, in world coordinates, and then leave it alone. */
export function fit3D(cam, reach, height, w, h, centre = { x: 0, z: 0 }, dirVec = { x: 1, z: 0 }) {
  cam.target = { x: centre.x + dirVec.x * reach / 2, y: height * 0.45, z: centre.z + dirVec.z * reach / 2 };
  // The camera looks along a diagonal, so the flight's projected width is
  // larger than its extent in x — and perspective makes the near end bigger
  // still. Both want a good deal more margin than a flat fit would suggest.
  const rG = Math.max(reach / 2, 6);
  const rV = Math.max(height * 0.6, 4);
  const tanV = Math.tan((cam.fov * Math.PI) / 360);
  const aspect = w / h;
  cam.dist = Math.max(18, Math.max((rG * 2.1) / (tanV * aspect), (rV * 2.4) / tanV));
  cam.fit = false;
}

export function drawGrid3D(ctx, P, L, V, { reach, w, h }) {
  const step = niceStep(Math.max(reach, 10), 8);
  const n = Math.min(20, Math.ceil((reach * 1.2) / step) + 1);
  const lim = n * step;

  const line = (a, b, st) => { const s = V.segment(a, b); if (s) stroke(ctx, s, st); };

  for (let i = -n; i <= n; i++) {
    const c = i * step;
    const major = i === 0;
    const st = major ? { color: P.gridMajor, width: 2.4 } : { color: P.grid, width: 1.4 };
    line({ x: -lim, y: 0, z: c }, { x: lim, y: 0, z: c }, st);
    line({ x: c, y: 0, z: -lim }, { x: c, y: 0, z: lim }, st);
  }

  // vertical scale, drawn in the plane the flight happens in
  const vTop = Math.max(step, Math.ceil(reach / 4 / step) * step);
  for (let y = step; y <= vTop; y += step) {
    line({ x: 0, y, z: 0 }, { x: lim * 0.22, y, z: 0 }, { color: P.grid, width: 1.4 });
    const p = V.point({ x: 0, y, z: 0 });
    if (p) L.add(fmt(y, 0), p.x - 8, p.y, { color: P.faint, align: 'right', pri: -1, size: 15 });
  }
  line({ x: 0, y: 0, z: 0 }, { x: 0, y: vTop, z: 0 }, { color: P.gridMajor, width: 2.4 });

  for (let i = 1; i <= n; i++) {
    const p = V.point({ x: i * step, y: 0, z: 0 });
    if (p && p.x > 20 && p.x < w - 20) L.add(fmt(i * step, 0), p.x, p.y + 16, { color: P.faint, align: 'center', pri: -2, size: 15 });
  }

  for (const [v, name] of [[{ x: lim * 0.3, y: 0, z: 0 }, 'x'], [{ x: 0, y: vTop, z: 0 }, 'y'], [{ x: 0, y: 0, z: lim * 0.3 }, 'z']]) {
    const p = V.point(v);
    if (p) L.add(name, p.x + 10, p.y - 10, { color: P.muted, pri: 5, size: 17, weight: 600 });
  }
}
