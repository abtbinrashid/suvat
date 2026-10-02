// scene.js — the side-on view.
//
// Colour carries meaning and nothing else does: velocity is one hue,
// acceleration another, displacement a third. Horizontal and vertical
// components share their quantity's hue and are told apart by a dashed stroke.

import { fitCanvas, palette, stroke, arrow, dot, fmt, niceStep, clamp, labels } from './util.js';
import { drawGrid2D, drawGrid3D, makeView3D, createCamera3D, fit3D } from './grid.js';

export { createCamera3D };

export function createCamera() { return { cx: 0, cy: 0, scale: 10, auto: true }; }

function autoFit(cam, flights, markers, w, h) {
  let maxX = 10, maxY = 5;
  for (const f of flights) {
    if (!f) continue;
    // Sample the real path: with bounces the object travels far past the
    // first flight's range, and `range` only describes that first arc.
    const end = f.pos(f.tMax);
    maxX = Math.max(maxX, isFinite(end.x) ? end.x : f.horiz * f.tMax,
                    isFinite(f.range) ? f.range : 0);
    maxY = Math.max(maxY, f.apexHeight, f.params.h);
  }
  if (markers?.obstacle) { maxX = Math.max(maxX, markers.obstacle.x * 1.15); maxY = Math.max(maxY, markers.obstacle.height); }
  if (markers?.target)   { maxX = Math.max(maxX, markers.target.x * 1.1);   maxY = Math.max(maxY, markers.target.y); }
  if (markers?.heightLine != null) maxY = Math.max(maxY, markers.heightLine);

  const spanX = maxX * 1.16 + 4;
  const spanY = maxY * 1.22 + 4;
  cam.scale = Math.max(0.02, Math.min((w - 96) / spanX, (h - 110) / spanY));
  cam.cx = maxX / 2;

  // Where the ground sits depends on how tall the flight actually is.
  //
  // A tall trajectory should be pinned near the bottom: nothing in this model
  // goes below the ground, so centring would waste a third of the canvas.
  // A wide, flat one — a bouncing ball especially — is the opposite case: pin
  // it low and the whole thing hugs the bottom edge under an empty sky. So the
  // ground is placed to centre the content, then clamped so it never sits
  // closer to the bottom than the range bar needs.
  const BOTTOM = 86;                      // room for the range bar and axis numbers
  const contentPx = maxY * cam.scale;
  const groundY = Math.min(h - BOTTOM, h / 2 + contentPx / 2);
  cam.cy = (groundY - h / 2) / cam.scale;
}

export function render(canvas, cam, o) {
  const { traj: f, second, ghost, t, show, markers = {}, scenario, fired = true } = o;
  if (!f) { return null; }
  const { ctx, w, h } = fitCanvas(canvas);
  const P = palette();
  const L = labels();
  const list = [f, second].filter(Boolean);
  if (cam.auto) autoFit(cam, list, markers, w, h);

  const sx = (x) => w / 2 + (x - cam.cx) * cam.scale;
  const sy = (y) => h / 2 - (y - cam.cy) * cam.scale;
  const px = (X) => (X - w / 2) / cam.scale + cam.cx;
  const py = (Y) => (h / 2 - Y) / cam.scale + cam.cy;
  const M = (p) => ({ x: sx(p.x), y: sy(p.y) });
  const groundY = sy(0);

  if (show.grid) drawGrid2D(ctx, P, L, { w, h, sx, sy, px, py, cam });

  /* ── ground ───────────────────────────────────────────────────────── */
  ctx.save();
  ctx.strokeStyle = P.axis; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, Math.round(groundY) + 0.5); ctx.lineTo(w, Math.round(groundY) + 0.5); ctx.stroke();
  ctx.restore();

  /* ── height line, fence, target ───────────────────────────────────── */
  if (markers.heightLine != null) {
    const Y = sy(markers.heightLine);
    stroke(ctx, [{ x: 0, y: Y }, { x: w, y: Y }], { color: P.mark, width: 2.8, dash: [10, 7], alpha: .9 });
    L.add(`${fmt(markers.heightLine, 1)} m${fired ? '' : ' — drag me'}`, w - 12, Y,
          { color: P.mark, align: 'right', pri: 6, size: 17 });
    dot(ctx, 40, Y, 8, { fill: P.surface, stroke: P.mark, width: 3 });

    const band = fired ? timeAbove(f, markers.heightLine) : null;
    if (band) {
      ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = P.mark;
      ctx.fillRect(sx(f.horiz * band.t1), sy(f.apexHeight), (band.t2 - band.t1) * f.horiz * cam.scale, sy(markers.heightLine) - sy(f.apexHeight));
      ctx.restore();
      L.add(`above for ${fmt(band.t2 - band.t1, 2)} s`, sx(f.horiz * (band.t1 + band.t2) / 2), sy(markers.heightLine) - 24,
            { color: P.mark, align: 'center', pri: 7, size: 18 });
    }
  }

  if (markers.obstacle) {
    const X = sx(markers.obstacle.x), Yt = sy(markers.obstacle.height);
    stroke(ctx, [{ x: X, y: groundY }, { x: X, y: Yt }], { color: P.strong, width: 8 });
    dot(ctx, X, Yt, 7, { fill: P.surface, stroke: P.strong, width: 2.5 });
    const clears = clearsObstacle(f, markers.obstacle);
    if (!fired) L.add('drag me', X, Yt - 26, { color: P.muted, align: 'center', pri: 5, size: 16 });
    else L.add(clears ? 'clears it' : 'hits it', X, Yt - 26,
      { color: clears ? P.good : P.bad, align: 'center', pri: 9, weight: 600, size: 19 });
  }

  if (markers.target) {
    const p = M(markers.target);
    const hit = fired ? passesThrough(f, markers.target) : null;
    const col = hit == null ? P.mark : hit ? P.good : P.mark;
    dot(ctx, p.x, p.y, 13, { stroke: col, width: 3 });
    dot(ctx, p.x, p.y, 4, { fill: col });
    L.add(hit == null ? 'target — drag me' : hit ? 'hit' : 'missed',
          p.x, p.y - 28, { color: hit ? P.good : col, align: 'center', pri: 9, size: 18, weight: 600 });
  }

  /* ── second object ────────────────────────────────────────────────── */
  if (second) {
    const delay = o.secondDelay || 0;
    stroke(ctx, second.path(200).map(M), { color: P.second, width: 3.4, dash: [9, 6], alpha: .9 });
    const t2 = clamp(t - delay, 0, second.tMax);
    if (t >= delay) {
      const q = M(second.pos(t2));
      dot(ctx, q.x, q.y, 7, { fill: P.second });
    }
    L.add(o.secondLabel || 'second object', sx(second.range), sy(0) - 22,
          { color: P.second, align: 'center', pri: 3, size: 17 });
  }

  /* ── the path ─────────────────────────────────────────────────────── */
  // The previous run, if there was one. This is the only path ever drawn
  // ahead of the object, and it only exists from the second fire onwards.
  if (ghost && show.path) {
    stroke(ctx, ghost.map(M), { color: P.faint, width: 2.8 });
  }

  // The path is TRACED behind the object as it goes. Nothing is drawn ahead of
  // it, so the student watches the shape appear rather than reading it off.
  if (show.path && fired) {
    const flown = f.path(260, t).concat([{ t, ...f.pos(t) }]);
    stroke(ctx, flown.map(M), { color: P.vel, width: 4.6 });
  }

  /* ── markers at equal time steps ──────────────────────────────────── */
  if (fired && show.ticks) {
    const n = scenario?.secondMarks ? Math.min(12, Math.max(2, Math.floor(f.tMax))) : 10;
    const marks = scenario?.secondMarks
      ? Array.from({ length: n + 1 }, (_, i) => ({ t: i, ...f.pos(i) })).filter((m) => m.t <= f.tMax)
      : f.ticks(n);
    for (const k of marks) {
      const p = M(k);
      dot(ctx, p.x, p.y, 3.5, { fill: P.surface, stroke: P.strong, width: 1.8 });
    }
    if (marks.length > 2) {
      const p = M(marks[1]);
      L.add(scenario?.secondMarks ? 'every 1 s' : 'equal time steps', p.x, p.y - 20,
            { color: P.muted, align: 'center', pri: 2, size: 16 });
    }
  }

  /* ── greatest height and range ────────────────────────────────────── */
  if (show.apex && f.apexInFlight) {
    const a = M({ x: f.horiz * f.tApex, y: f.apexHeight });
    dot(ctx, a.x, a.y, 4.5, { fill: P.ink });
    L.add(`greatest height ${fmt(f.apexHeight, 2)} m`, a.x, a.y - 26, { color: P.ink, align: 'center', pri: 8, size: 19, weight: 600 });
  }

  if (show.range && isFinite(f.tFlight)) {
    const y = groundY + 32, x0 = sx(0), x1 = sx(f.range);
    stroke(ctx, [{ x: x0, y }, { x: x1, y }], { color: P.muted, width: 2.2 });
    for (const X of [x0, x1]) stroke(ctx, [{ x: X, y: y - 6 }, { x: X, y: y + 6 }], { color: P.muted, width: 2.2 });
    L.add(`horizontal displacement ${fmt(f.range, 2)} m`, (x0 + x1) / 2, y + 18,
          { color: P.muted, align: 'center', pri: 7, push: 'down', size: 18 });
  }

  /* ── where the velocity turns 90° from the launch ─────────────────── */
  if (scenario?.showPerpendicular) {
    const tp = perpendicularTime(f);
    if (tp != null && tp <= f.tMax) {
      const p = M(f.pos(tp));
      dot(ctx, p.x, p.y, 6, { stroke: P.acc, width: 2.5 });
      L.add(`90° to launch at t = ${fmt(tp, 2)} s`, p.x, p.y - 22, { color: P.acc, align: 'center', pri: 8, size: 18 });
    }
  }

  /* ── the object, and its velocity now ─────────────────────────────── */
  const now = f.pos(fired ? t : 0), v = f.vel(fired ? t : 0), p = M(now);
  const vScale = clamp(cam.scale * 0.5, 1.1, 7);

  if (fired && show.components) {
    const hx = p.x + v.x * vScale, vy = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, hx, p.y, { color: P.vel, width: 2.4, head: 10, dash: [6, 5] });
    arrow(ctx, p.x, p.y, p.x, vy,  { color: P.vel, width: 2.4, head: 10, dash: [6, 5] });
    L.add(`horizontal ${fmt(v.x, 1)}`, hx + 8, p.y + 16, { color: P.vel, pri: 4, maxPush: 40, size: 17 });
    L.add(`vertical ${fmt(v.y, 1)}`, p.x + 10, vy - 14, { color: P.vel, pri: 4, maxPush: 40, size: 17 });
  }
  if (fired && show.velocity) {
    const ex = p.x + v.x * vScale, ey = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, ex, ey, { color: P.vel, width: 4, head: 16 });
    L.add(`velocity ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, ex + 12, ey - 12, { color: P.vel, pri: 10, weight: 600, size: 19 });
  }
  if (fired && show.acceleration && f.params.g > 0) {
    const len = clamp(f.params.g * vScale * 0.5, 14, 60);
    arrow(ctx, p.x, p.y, p.x, p.y + len, { color: P.acc, width: 3.4, head: 13 });
    L.add(`g ${fmt(f.params.g, 2)} m s⁻²`, p.x - 10, p.y + len + 4, { color: P.acc, align: 'right', pri: 5, size: 17 });
  }

  dot(ctx, p.x, p.y, fired ? 7 : 6, { fill: P.vel });
  if (fired) dot(ctx, p.x, p.y, 12, { stroke: P.vel, width: 1.6 });

  /* ── launch point ─────────────────────────────────────────────────── */
  const lp = M({ x: 0, y: f.params.h });
  if (f.params.h > 0) {
    stroke(ctx, [{ x: lp.x, y: lp.y }, { x: lp.x, y: groundY }], { color: P.strong, width: 3.4 });
    L.add(`${fmt(f.params.h, 1)} m`, lp.x - 12, (lp.y + groundY) / 2, { color: P.strong, align: 'right', pri: 6, size: 18 });
  }
  dot(ctx, lp.x, lp.y, 3.5, { fill: P.strong });

  L.draw(ctx, w, h);
  cam._map = { sx, sy, px, py };
  return { sx, sy };
}

/* ── small geometric questions the scene needs answered ─────────────── */

function timeAbove(f, height) {
  const { h, g } = f.params, uy = f.uy;
  if (g <= 1e-9) return null;
  const disc = uy * uy - 2 * g * (height - h);
  if (disc <= 0) return null;
  const r = Math.sqrt(disc);
  const t1 = (uy - r) / g, t2 = (uy + r) / g;
  const a = Math.max(0, Math.min(t1, t2)), b = Math.min(f.tMax, Math.max(t1, t2));
  return b > a ? { t1: a, t2: b } : null;
}

function clearsObstacle(f, ob) {
  if (f.horiz <= 1e-9) return false;
  const t = ob.x / f.horiz;
  if (t > f.tMax) return false;
  return f.pos(t).y > ob.height;
}

/** Does the path pass within a small radius of the target? */
function passesThrough(f, target) {
  const tol = Math.max(0.6, target.x * 0.02);
  let best = Infinity;
  for (let i = 0; i <= 400; i++) {
    const p = f.pos((i / 400) * f.tMax);
    best = Math.min(best, Math.hypot(p.x - target.x, p.y - target.y));
  }
  return best <= tol;
}

/** The instant the velocity is perpendicular to the launch velocity: u·v = 0. */
function perpendicularTime(f) {
  const { g } = f.params;
  if (g <= 1e-9 || f.uy <= 0) return null;
  const t = (f.horiz * f.horiz + f.uy * f.uy) / (g * f.uy);
  return t > 0 ? t : null;
}

export function attachControls(canvas, cam, onChange, getScene, onMarkerMove) {
  let drag = false, lx = 0, ly = 0, dragging = null;

  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    const m = cam._map;
    if (!m) return null;
    return { x: m.px(e.clientX - r.left), y: m.py(e.clientY - r.top), sxp: e.clientX - r.left, syp: e.clientY - r.top };
  };

  /** Which draggable handle, if any, is under the pointer. */
  const pick = (e) => {
    if (!getScene) return null;
    const { markers, scenario } = getScene() || {};
    const m = cam._map;
    if (!markers || !m) return null;
    const w = toWorld(e);
    const near = (px, py) => Math.hypot(w.sxp - px, w.syp - py) < 24;
    if (scenario?.dragTarget && markers.target && near(m.sx(markers.target.x), m.sy(markers.target.y))) return 'target';
    if (scenario?.dragObstacle && markers.obstacle && near(m.sx(markers.obstacle.x), m.sy(markers.obstacle.height))) return 'obstacle';
    if (scenario?.dragLine && markers.heightLine != null && Math.abs(w.syp - m.sy(markers.heightLine)) < 18) return 'heightLine';
    return null;
  };

  canvas.addEventListener('pointermove', (e) => {
    if (!drag && !dragging) { canvas.style.cursor = pick(e) ? 'grab' : 'grab'; }
  });

  canvas.addEventListener('pointerdown', (e) => {
    dragging = pick(e);
    if (dragging) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; return; }
    drag = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { const w = toWorld(e); if (w && onMarkerMove) onMarkerMove(dragging, w); return; }
    if (!drag) return;
    cam.auto = false;
    cam.cx -= (e.clientX - lx) / cam.scale;
    cam.cy += (e.clientY - ly) / cam.scale;
    lx = e.clientX; ly = e.clientY; onChange();
  });
  const end = (e) => {
    drag = false; dragging = null; canvas.style.cursor = 'grab';
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); cam.auto = false;
    cam.scale = clamp(cam.scale * Math.exp(-e.deltaY * 0.0014), 0.02, 500);
    onChange();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam.auto = true; onChange(); });
  canvas.style.cursor = 'grab';
}
