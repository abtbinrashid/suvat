// scene.js — the side-on view.
//
// Colour carries meaning and nothing else does: velocity is one hue,
// acceleration another, displacement a third. Horizontal and vertical
// components share their quantity's hue and are told apart by a dashed stroke.

import { fitCanvas, palette, stroke, arrow, dot, fmt, niceStep, clamp, labels } from './util.js';

export function createCamera() { return { cx: 0, cy: 0, scale: 10, auto: true }; }

function autoFit(cam, flights, markers, w, h) {
  let maxX = 10, maxY = 5;
  for (const f of flights) {
    if (!f) continue;
    maxX = Math.max(maxX, isFinite(f.range) ? f.range : f.horiz * f.tMax);
    maxY = Math.max(maxY, f.apexHeight, f.params.h);
  }
  if (markers?.obstacle) { maxX = Math.max(maxX, markers.obstacle.x * 1.15); maxY = Math.max(maxY, markers.obstacle.height); }
  if (markers?.target)   { maxX = Math.max(maxX, markers.target.x * 1.1);   maxY = Math.max(maxY, markers.target.y); }
  if (markers?.heightLine) maxY = Math.max(maxY, markers.heightLine);

  const spanX = maxX * 1.16 + 4;
  const spanY = maxY * 1.22 + 4;
  cam.scale = Math.max(0.02, Math.min((w - 96) / spanX, (h - 110) / spanY));
  cam.cx = maxX / 2;

  // Do NOT centre the content vertically. Nothing in this model goes below the
  // ground, so centring leaves a third of the canvas empty under it. Pin the
  // ground a fixed distance from the bottom instead and let every spare pixel
  // go above, which is where the trajectory actually is.
  const BOTTOM = 78;                      // room for the range bar and axis numbers
  cam.cy = (h / 2 - BOTTOM) / cam.scale;
}

export function render(canvas, cam, o) {
  const { flight: f, second, t, show, markers = {}, scenario, fired = true } = o;
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

  /* ── grid ─────────────────────────────────────────────────────────── */
  if (show.grid) {
    const stepX = niceStep(w / cam.scale, 9);
    const stepY = niceStep(h / cam.scale, 6);
    ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = Math.floor(px(0) / stepX) * stepX; x <= px(w); x += stepX) {
      const X = Math.round(sx(x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, h);
    }
    for (let y = Math.floor(py(h) / stepY) * stepY; y <= py(0); y += stepY) {
      const Y = Math.round(sy(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(w, Y);
    }
    ctx.stroke(); ctx.restore();

    for (let x = Math.floor(px(0) / stepX) * stepX; x <= px(w); x += stepX) {
      if (Math.abs(x) < 1e-9 || sx(x) < 30 || sx(x) > w - 24) continue;
      L.add(fmt(x, stepX < 1 ? 1 : 0), sx(x), Math.min(h - 12, groundY + 18),
            { color: P.faint, align: 'center', pri: -1, bg: false });
    }
    for (let y = Math.floor(py(h) / stepY) * stepY; y <= py(0); y += stepY) {
      if (Math.abs(y) < 1e-9 || sy(y) < 16 || sy(y) > h - 16) continue;
      L.add(fmt(y, stepY < 1 ? 1 : 0), 8, sy(y), { color: P.faint, pri: -1, bg: false });
    }
  }

  /* ── ground ───────────────────────────────────────────────────────── */
  ctx.save();
  ctx.strokeStyle = P.axis; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, Math.round(groundY) + 0.5); ctx.lineTo(w, Math.round(groundY) + 0.5); ctx.stroke();
  ctx.restore();

  /* ── height line, fence, target ───────────────────────────────────── */
  if (markers.heightLine != null) {
    const Y = sy(markers.heightLine);
    stroke(ctx, [{ x: 0, y: Y }, { x: w, y: Y }], { color: P.disp, width: 1.5, dash: [7, 5], alpha: .85 });
    L.add(`${fmt(markers.heightLine, 1)} m`, w - 10, Y, { color: P.disp, align: 'right', pri: 6 });

    const band = timeAbove(f, markers.heightLine);
    if (band) {
      ctx.save(); ctx.globalAlpha = .1; ctx.fillStyle = P.disp;
      ctx.fillRect(sx(f.horiz * band.t1), sy(f.apexHeight), (band.t2 - band.t1) * f.horiz * cam.scale, sy(markers.heightLine) - sy(f.apexHeight));
      ctx.restore();
      L.add(`above for ${fmt(band.t2 - band.t1, 2)} s`, sx(f.horiz * (band.t1 + band.t2) / 2), sy(markers.heightLine) - 24,
            { color: P.disp, align: 'center', pri: 7 });
    }
  }

  if (markers.obstacle) {
    const X = sx(markers.obstacle.x), Yt = sy(markers.obstacle.height);
    stroke(ctx, [{ x: X, y: groundY }, { x: X, y: Yt }], { color: P.strong, width: 5 });
    const clears = clearsObstacle(f, markers.obstacle);
    L.add(clears ? 'clears it' : 'hits it', X, Yt - 20,
          { color: clears ? P.good : P.bad, align: 'center', pri: 9, weight: 600 });
  }

  if (markers.target) {
    const p = M(markers.target);
    dot(ctx, p.x, p.y, 7, { stroke: P.disp, width: 2.5 });
    dot(ctx, p.x, p.y, 2.5, { fill: P.disp });
    L.add('target', p.x, p.y - 20, { color: P.disp, align: 'center', pri: 6 });
  }

  /* ── second object ────────────────────────────────────────────────── */
  if (second) {
    const delay = o.secondDelay || 0;
    stroke(ctx, second.path(200).map(M), { color: P.muted, width: 2, dash: [6, 5], alpha: .8 });
    const t2 = clamp(t - delay, 0, second.tMax);
    if (t >= delay) {
      const q = M(second.pos(t2));
      dot(ctx, q.x, q.y, 6, { fill: P.muted });
    }
    L.add(o.secondLabel || 'second object', sx(second.range), sy(0) - 22,
          { color: P.muted, align: 'center', pri: 3 });
  }

  /* ── the path ─────────────────────────────────────────────────────── */
  const full = f.path(260);
  if (show.path) {
    if (!fired) {
      // Before firing, the path is simply shown. One line, nothing else.
      stroke(ctx, full.map(M), { color: P.vel, width: 2.6, alpha: 0.55 });
    } else {
      // A faint solid line for the part still to come — a dashed one here was
      // just more texture on a diagram that already had too much.
      stroke(ctx, full.map(M), { color: P.faint, width: 1.6 });
      const flown = full.filter((p) => p.t <= t).concat([{ t, ...f.pos(t) }]);
      stroke(ctx, flown.map(M), { color: P.vel, width: 3.2 });
    }
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
            { color: P.muted, align: 'center', pri: 2 });
    }
  }

  /* ── greatest height and range ────────────────────────────────────── */
  if (show.apex && f.apexInFlight) {
    const a = M({ x: f.horiz * f.tApex, y: f.apexHeight });
    dot(ctx, a.x, a.y, 4.5, { fill: P.ink });
    L.add(`greatest height ${fmt(f.apexHeight, 2)} m`, a.x, a.y - 22, { color: P.ink, align: 'center', pri: 8 });
  }

  if (show.range && isFinite(f.tFlight)) {
    const y = groundY + 32, x0 = sx(0), x1 = sx(f.range);
    stroke(ctx, [{ x: x0, y }, { x: x1, y }], { color: P.muted, width: 1.5 });
    for (const X of [x0, x1]) stroke(ctx, [{ x: X, y: y - 5 }, { x: X, y: y + 5 }], { color: P.muted, width: 1.5 });
    L.add(`horizontal displacement ${fmt(f.range, 2)} m`, (x0 + x1) / 2, y + 18,
          { color: P.muted, align: 'center', pri: 7, push: 'down' });
  }

  /* ── where the velocity turns 90° from the launch ─────────────────── */
  if (scenario?.showPerpendicular) {
    const tp = perpendicularTime(f);
    if (tp != null && tp <= f.tMax) {
      const p = M(f.pos(tp));
      dot(ctx, p.x, p.y, 6, { stroke: P.acc, width: 2.5 });
      L.add(`90° to launch at t = ${fmt(tp, 2)} s`, p.x, p.y - 22, { color: P.acc, align: 'center', pri: 8 });
    }
  }

  /* ── the object, and its velocity now ─────────────────────────────── */
  const now = f.pos(fired ? t : 0), v = f.vel(fired ? t : 0), p = M(now);
  const vScale = clamp(cam.scale * 0.5, 1.1, 7);

  if (fired && show.components) {
    const hx = p.x + v.x * vScale, vy = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, hx, p.y, { color: P.vel, width: 1.8, head: 8, dash: [5, 4] });
    arrow(ctx, p.x, p.y, p.x, vy,  { color: P.vel, width: 1.8, head: 8, dash: [5, 4] });
    L.add(`horizontal ${fmt(v.x, 1)}`, hx + 8, p.y + 16, { color: P.vel, pri: 4, maxPush: 34 });
    L.add(`vertical ${fmt(v.y, 1)}`, p.x + 10, vy - 14, { color: P.vel, pri: 4, maxPush: 34 });
  }
  if (fired && show.velocity) {
    const ex = p.x + v.x * vScale, ey = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, ex, ey, { color: P.vel, width: 3, head: 12 });
    L.add(`velocity ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, ex + 10, ey - 10, { color: P.vel, pri: 10, weight: 600 });
  }
  if (fired && show.acceleration && f.params.g > 0) {
    const len = clamp(f.params.g * vScale * 0.5, 14, 60);
    arrow(ctx, p.x, p.y, p.x, p.y + len, { color: P.acc, width: 2.4, head: 10 });
    L.add(`g ${fmt(f.params.g, 2)} m s⁻²`, p.x - 10, p.y + len + 4, { color: P.acc, align: 'right', pri: 5 });
  }

  dot(ctx, p.x, p.y, fired ? 7 : 6, { fill: P.vel });
  if (fired) dot(ctx, p.x, p.y, 12, { stroke: P.vel, width: 1.6 });

  /* ── launch point ─────────────────────────────────────────────────── */
  const lp = M({ x: 0, y: f.params.h });
  if (f.params.h > 0) {
    stroke(ctx, [{ x: lp.x, y: lp.y }, { x: lp.x, y: groundY }], { color: P.strong, width: 2.5 });
    L.add(`${fmt(f.params.h, 1)} m`, lp.x - 10, (lp.y + groundY) / 2, { color: P.strong, align: 'right', pri: 6 });
  }
  dot(ctx, lp.x, lp.y, 3.5, { fill: P.strong });

  L.draw(ctx, w, h);
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

/** The instant the velocity is perpendicular to the launch velocity: u·v = 0. */
function perpendicularTime(f) {
  const { g } = f.params;
  if (g <= 1e-9 || f.uy <= 0) return null;
  const t = (f.horiz * f.horiz + f.uy * f.uy) / (g * f.uy);
  return t > 0 ? t : null;
}

export function attachControls(canvas, cam, onChange) {
  let drag = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cam.auto = false;
    cam.cx -= (e.clientX - lx) / cam.scale;
    cam.cy += (e.clientY - ly) / cam.scale;
    lx = e.clientX; ly = e.clientY; onChange();
  });
  const end = (e) => {
    drag = false; canvas.style.cursor = 'grab';
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
