// scene3d.js — a small perspective wireframe renderer.
//
// No 3D library. The whole thing is: put the point in camera space, divide by
// depth, draw a line. Written out longhand because that projection is itself
// A-level maths (vectors, dot products, similar triangles).
//
// World axes: x and z lie in the ground plane, y is vertically up.

import { fitCanvas, palette, strokePath, arrow, label, dot, fmt, clamp, createLabels } from './util.js';

const NEAR = 0.35;

export function createCamera3D() {
  // `userRotated` latches once the viewer drags, after which auto-framing stops
  // touching the angle and only keeps distance and target sensible.
  return {
    yaw: Math.PI / 2, pitch: 0.30, dist: 60,
    target: { x: 0, y: 0, z: 0 }, auto: true, userRotated: false, fov: 52,
  };
}

const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm3 = (a) => {
  const L = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / L, y: a.y / L, z: a.z / L };
};

/** Build the view basis and a world→screen pipeline for this frame. */
function makeView(cam, w, h) {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const eye = {
    x: cam.target.x + cam.dist * cp * Math.cos(cam.yaw),
    y: cam.target.y + cam.dist * sp,
    z: cam.target.z + cam.dist * cp * Math.sin(cam.yaw),
  };
  const forward = norm3(sub3(cam.target, eye));
  const right = norm3(cross3(forward, { x: 0, y: 1, z: 0 }));
  const up = cross3(right, forward);
  const f = (h / 2) / Math.tan((cam.fov * Math.PI) / 360);

  // world point → camera space (z is depth along the view direction)
  const toCam = (p) => {
    const r = sub3(p, eye);
    return { x: dot3(r, right), y: dot3(r, up), z: dot3(r, forward) };
  };
  const projCam = (c) => ({ x: w / 2 + (f * c.x) / c.z, y: h / 2 - (f * c.y) / c.z, z: c.z });
  const project = (p) => {
    const c = toCam(p);
    return c.z < NEAR ? null : projCam(c);
  };
  /** Clip a segment against the near plane so lines behind the camera vanish cleanly. */
  const segment = (a, b) => {
    let ca = toCam(a), cb = toCam(b);
    if (ca.z < NEAR && cb.z < NEAR) return null;
    if (ca.z < NEAR || cb.z < NEAR) {
      const k = (NEAR - ca.z) / (cb.z - ca.z);
      const mid = { x: ca.x + (cb.x - ca.x) * k, y: ca.y + (cb.y - ca.y) * k, z: NEAR };
      if (ca.z < NEAR) ca = mid; else cb = mid;
    }
    return [projCam(ca), projCam(cb)];
  };
  /** Project a polyline, splitting it wherever it crosses behind the camera. */
  const polyline = (pts) => {
    const runs = [];
    let run = [];
    for (const p of pts) {
      const c = toCam(p);
      if (c.z < NEAR) { if (run.length > 1) runs.push(run); run = []; continue; }
      run.push(projCam(c));
    }
    if (run.length > 1) runs.push(run);
    return runs;
  };
  return { eye, project, segment, polyline, f };
}

function autoFit(cam, flights, w, h) {
  // Bound the flights, then choose a distance that frames them in BOTH axes.
  // The stage canvas is much wider than it is tall, so the horizontal fit is
  // usually the binding constraint — fitting on height alone leaves the
  // trajectory as a speck in the middle.
  let lo = { x: 0, y: 0, z: 0 }, hi = { x: 0, y: 0, z: 0 };
  let any = false;
  for (const f of flights) {
    if (!f) continue;
    for (const p of f.path(40)) {
      if (!any) { lo = { ...p }; hi = { ...p }; any = true; continue; }
      lo.x = Math.min(lo.x, p.x); hi.x = Math.max(hi.x, p.x);
      lo.y = Math.min(lo.y, p.y); hi.y = Math.max(hi.y, p.y);
      lo.z = Math.min(lo.z, p.z); hi.z = Math.max(hi.z, p.z);
    }
  }
  if (!any) return;

  const centre = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };
  cam.target = { x: centre.x, y: Math.max(centre.y, (hi.y - lo.y) * 0.35), z: centre.z };

  // Radius across the ground plane, and vertically.
  const rGround = Math.max(2, 0.5 * Math.hypot(hi.x - lo.x, hi.z - lo.z));
  const rVert = Math.max(1.5, 0.5 * (hi.y - lo.y));

  const tanV = Math.tan((cam.fov * Math.PI) / 360);
  const aspect = Math.max(0.35, w / h);
  const distForWidth = (rGround * 1.22) / (tanV * aspect);
  const distForHeight = (rVert * 1.5 + rGround * 0.18) / tanV;
  cam.dist = clamp(Math.max(distForWidth, distForHeight, 12), 6, 4000);

  // Point the camera side-on to the launch bearing so the flight reads
  // left-to-right, unless the viewer has taken over the rotation.
  if (!cam.userRotated) {
    const az = ((flights[0]?.params.azimuth ?? 0) * Math.PI) / 180;
    cam.yaw = az + Math.PI / 2;
  }
}

export function render(canvas, cam, opts) {
  const { flight: f, compare, t, show } = opts;
  const { ctx, w, h } = fitCanvas(canvas);
  const P = palette();
  const labels = createLabels();
  const flights = [f, compare].filter(Boolean);
  if (cam.auto) autoFit(cam, flights, w, h);

  const V = makeView(cam, w, h);
  const line = (a, b, style) => {
    const s = V.segment(a, b);
    if (s) strokePath(ctx, s, style);
  };
  const poly = (pts, style) => { for (const run of V.polyline(pts)) strokePath(ctx, run, style); };

  // ── ground grid ─────────────────────────────────────────────────────────
  if (show.grid) {
    const reach = Math.max(f.range, compare ? compare.range : 0, 20);
    const raw = reach / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = (raw / mag >= 5 ? 10 : raw / mag >= 2 ? 5 : 1) * mag;
    // Extend past the landing point so the projectile never flies off the grid.
    const n = Math.min(18, Math.ceil((reach * 1.1) / step));
    const lim = n * step;
    for (let i = -n; i <= n; i++) {
      const c = i * step;
      const major = i === 0;
      // The ground plane needs to READ as a plane, so the minor lines use
      // --line rather than the near-invisible --faint used for the 2D grid.
      const st = major
        ? { color: P.ink3, width: 1.2, alpha: 0.9 }
        : { color: P.line, width: 1, alpha: 0.85 };
      line({ x: -lim, y: 0, z: c }, { x: lim, y: 0, z: c }, st);
      line({ x: c, y: 0, z: -lim }, { x: c, y: 0, z: lim }, st);
    }
  }

  // ── axes ────────────────────────────────────────────────────────────────
  if (show.axes) {
    const axLen = Math.max(f.range * 0.34, 8);
    const axis = (v, name) => {
      line({ x: 0, y: 0, z: 0 }, v, { color: P.ink2, width: 1.4 });
      const p = V.project(v);
      if (p) labels.add(name, p.x + 6, p.y - 6, { color: P.ink2, bg: P.bg, size: 10.5, pri: 6 });
    };
    axis({ x: axLen, y: 0, z: 0 }, 'x');
    axis({ x: 0, y: axLen * 0.75, z: 0 }, 'y');
    axis({ x: 0, y: 0, z: axLen }, 'z');
  }

  // ── comparison flight ───────────────────────────────────────────────────
  if (compare) {
    poly(compare.path(200), { color: P.ink2, width: 1.2, dash: [5, 4], alpha: 0.7 });
  }

  // ── the shadow on the ground: the horizontal motion, isolated ───────────
  const full = f.path(200);
  if (show.shadow) {
    poly(full.map((p) => ({ x: p.x, y: 0, z: p.z })), { color: P.ink3, width: 1.2, dash: [4, 4], alpha: 0.8 });
    const sh = V.project({ x: f.pos(t).x, y: 0, z: f.pos(t).z });
    if (sh) {
      dot(ctx, sh.x, sh.y, 3, { fill: P.ink3 });
      labels.add('ground track — constant speed', sh.x + 9, sh.y + 12,
        { color: P.ink3, bg: P.bg, size: 9.5, mono: false, push: 'down', pri: 3 });
    }
  }

  // ── drop lines: height above the ground at equal time steps ─────────────
  if (show.ticks) {
    for (const k of f.ticks(10)) {
      line({ x: k.x, y: k.y, z: k.z }, { x: k.x, y: 0, z: k.z }, { color: P.line, width: 1, dash: [2, 3] });
      const p = V.project(k);
      if (p) dot(ctx, p.x, p.y, 2.2, { fill: P.bg, stroke: P.ink2, width: 1 });
    }
  }

  // ── trajectory ──────────────────────────────────────────────────────────
  if (show.trace) {
    poly(full, { color: P.ink3, width: 1, dash: [2, 4], alpha: 0.8 });
    const flown = full.filter((p) => p.t <= t).concat([{ t, ...f.pos(t) }]);
    poly(flown, { color: P.accent, width: 2.3 });
  }

  // ── projectile + vectors ────────────────────────────────────────────────
  const now = f.pos(t);
  const v = f.vel(t);
  const p = V.project(now);
  if (p) {
    const depthScale = clamp(V.f / p.z, 0.4, 14);
    const vs = depthScale * 0.45;
    if (show.components) {
      const hEnd = { x: now.x + v.x * 0.55, y: now.y, z: now.z + v.z * 0.55 };
      const vEnd = { x: now.x, y: now.y + v.y * 0.55, z: now.z };
      for (const [e, nm] of [[hEnd, 'horizontal'], [vEnd, 'vertical']]) {
        const q = V.project(e);
        if (q) arrow(ctx, p.x, p.y, q.x, q.y, { color: P.ink2, width: 1.25, head: 7, dash: [4, 3] });
      }
    }
    if (show.velocity) {
      const e = V.project({ x: now.x + v.x * 0.55, y: now.y + v.y * 0.55, z: now.z + v.z * 0.55 });
      if (e) {
        arrow(ctx, p.x, p.y, e.x, e.y, { color: P.accent, width: 2.2, head: 10 });
        labels.add(`v = ${fmt(Math.hypot(v.x, v.y, v.z), 2)} m s⁻¹`, e.x + 9, e.y - 8,
          { color: P.accent, bg: P.bg, size: 10.5, pri: 10 });
      }
    }
    // vertical drop line to the ground under the projectile
    line(now, { x: now.x, y: 0, z: now.z }, { color: P.ink2, width: 1.1, dash: [3, 3] });
    dot(ctx, p.x, p.y, clamp(depthScale * 0.55, 3.5, 8), { fill: P.accent });
  }

  // ── launch point and bearing ────────────────────────────────────────────
  const launch = V.project({ x: 0, y: f.params.h, z: 0 });
  if (launch) {
    if (f.params.h > 0) line({ x: 0, y: f.params.h, z: 0 }, { x: 0, y: 0, z: 0 }, { color: P.ink2, width: 1.5 });
    dot(ctx, launch.x, launch.y, 3, { fill: P.ink2 });
  }

  labels.add(`bearing ${fmt(f.params.azimuth, 0)}°  ·  drag to orbit, scroll to zoom`, w - 8, h - 11,
    { color: P.ink3, bg: P.bg, size: 10, align: 'right', mono: false, pri: 7 });
  labels.add('perspective view · x–y–z', w - 8, 13,
    { color: P.ink3, bg: P.bg, size: 10, align: 'right', mono: false, pri: 9 });

  labels.draw(ctx, w, h);
}

export function attachControls3D(canvas, cam, onChange) {
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cam.userRotated = true;
    cam.yaw += (e.clientX - lx) * 0.007;
    cam.pitch = clamp(cam.pitch - (e.clientY - ly) * 0.006, -0.22, 1.45);
    lx = e.clientX; ly = e.clientY;
    onChange();
  });
  const end = (e) => {
    dragging = false;
    canvas.style.cursor = 'grab';
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.auto = false;
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 4, 4000);
    onChange();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam.auto = true; cam.userRotated = false; onChange(); });
  canvas.style.cursor = 'grab';
}
