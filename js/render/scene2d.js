// scene2d.js — the side-on view. This is the picture in the textbook, made live.
//
// The vertical and horizontal scales are deliberately EQUAL. A projectile
// launched at 45° must look like 45° on screen, otherwise the picture teaches
// the wrong thing.

import {
  fitCanvas, palette, strokePath, arrow, label, dot, fmt, niceStep, clamp, createLabels,
} from './util.js';

const MARGIN = { x: 40, top: 26, bottom: 46 };   // bottom leaves room for the range bar

export function createCamera2D() {
  return { cx: 0, cy: 0, scale: 10, auto: true };
}

function autoFit(cam, flights, w, h) {
  let maxX = 1, maxY = 1;
  for (const f of flights) {
    if (!f) continue;
    maxX = Math.max(maxX, isFinite(f.range) ? f.range : f.horiz * f.tMax);
    maxY = Math.max(maxY, f.apexHeight);
  }
  const spanX = maxX * 1.14 + 2;
  const spanY = maxY * 1.14 + 3;
  const scale = Math.min(
    (w - MARGIN.x * 2) / spanX,
    (h - MARGIN.top - MARGIN.bottom) / spanY,
  );
  cam.scale = Math.max(0.02, scale);
  cam.cx = maxX / 2;
  // Bias the centre upwards so the ground sits above the bottom margin,
  // leaving the range bar somewhere to live.
  cam.cy = maxY / 2 - (MARGIN.bottom - MARGIN.top) / (2 * cam.scale);
}

export function render(canvas, cam, opts) {
  const { flight: f, compare, t, show } = opts;
  const { ctx, w, h } = fitCanvas(canvas);
  const P = palette();
  const labels = createLabels();
  const flights = [f, compare].filter(Boolean);

  if (cam.auto) autoFit(cam, flights, w, h);

  // world → screen. y is flipped because canvas y grows downwards.
  const sx = (x) => w / 2 + (x - cam.cx) * cam.scale;
  const sy = (y) => h / 2 - (y - cam.cy) * cam.scale;
  const px = (X) => (X - w / 2) / cam.scale + cam.cx;
  const py = (Y) => (h / 2 - Y) / cam.scale + cam.cy;
  const map = (p) => ({ x: sx(p.x), y: sy(p.y) });
  const groundY = sy(0);

  // ── grid ────────────────────────────────────────────────────────────────
  if (show.grid) {
    const stepX = niceStep(w / cam.scale, 8);
    const stepY = niceStep(h / cam.scale, 5);
    ctx.save();
    ctx.strokeStyle = P.faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.ceil(px(0) / stepX) * stepX;
    for (let x = x0; x <= px(w); x += stepX) {
      const X = Math.round(sx(x)) + 0.5;
      ctx.moveTo(X, 0); ctx.lineTo(X, h);
    }
    const y0 = Math.ceil(py(h) / stepY) * stepY;
    for (let y = y0; y <= py(0); y += stepY) {
      const Y = Math.round(sy(y)) + 0.5;
      ctx.moveTo(0, Y); ctx.lineTo(w, Y);
    }
    ctx.stroke();
    ctx.restore();

    for (let x = x0; x <= px(w); x += stepX) {
      if (Math.abs(x) < 1e-9 || sx(x) < 30 || sx(x) > w - 24) continue;
      label(ctx, fmt(x, stepX < 1 ? 1 : 0), sx(x), groundY + 12,
        { color: P.ink3, size: 9.5, align: 'center' });
    }
    for (let y = y0; y <= py(0); y += stepY) {
      if (Math.abs(y) < 1e-9 || sy(y) < 16 || sy(y) > h - 16) continue;
      label(ctx, fmt(y, stepY < 1 ? 1 : 0), 5, sy(y), { color: P.ink3, size: 9.5 });
    }
  }

  // ── ground ──────────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = P.ink2;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(groundY) + 0.5);
  ctx.lineTo(w, Math.round(groundY) + 0.5);
  ctx.stroke();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let X = -10; X < w + 10; X += 9) {
    ctx.moveTo(X, groundY + 1);
    ctx.lineTo(X + 7, groundY + 8);
  }
  ctx.stroke();
  ctx.restore();

  // ── comparison trajectory (always the dashed one) ───────────────────────
  if (compare) {
    strokePath(ctx, compare.path(200).map(map), { color: P.ink2, width: 1.25, dash: [5, 4], alpha: 0.8 });
    const apexT = compare.tApex;
    const capex = map({ x: compare.horiz * apexT, y: compare.apexHeight });
    labels.add(`θ₂ = ${fmt(compare.params.theta, 0)}°  R = ${fmt(compare.range, 1)} m`,
      capex.x, capex.y - 12, { color: P.ink2, bg: P.bg, size: 10, align: 'center', pri: 5 });
  }

  // ── main trajectory ─────────────────────────────────────────────────────
  const full = f.path(240);
  if (show.trace) {
    strokePath(ctx, full.map(map), { color: P.ink3, width: 1, dash: [2, 4], alpha: 0.9 });
    const flown = full.filter((p) => p.t <= t);
    flown.push({ t, ...f.pos(t) });
    strokePath(ctx, flown.map(map), { color: P.accent, width: 2.2 });
  }

  // ── equal time intervals — the spacing IS the lesson ─────────────────────
  if (show.ticks) {
    const marks = f.ticks(10);
    for (const k of marks) {
      const p = map(k);
      dot(ctx, p.x, p.y, 2.4, { fill: P.bg, stroke: P.ink2, width: 1.1 });
    }
    const m = map(marks[1]);
    labels.add('equal Δt', m.x, m.y - 13, { color: P.ink3, bg: P.bg, size: 9.5, align: 'center', pri: 2 });
  }

  // ── apex ────────────────────────────────────────────────────────────────
  if (show.apex && f.apexInFlight) {
    const ap = map({ x: f.horiz * f.tApex, y: f.apexHeight });
    strokePath(ctx, [{ x: ap.x, y: ap.y }, { x: ap.x, y: groundY }], { color: P.ink3, width: 1, dash: [3, 3] });
    strokePath(ctx, [{ x: sx(0), y: ap.y }, { x: ap.x, y: ap.y }], { color: P.ink3, width: 1, dash: [3, 3] });
    dot(ctx, ap.x, ap.y, 3, { fill: P.ink });
    labels.add(`H = ${fmt(f.apexHeight, 2)} m`, ap.x, ap.y - 14, { color: P.ink, bg: P.bg, size: 10.5, align: 'center', pri: 8 });
    labels.add('v_y = 0', ap.x, ap.y - 28, { color: P.ink3, bg: P.bg, size: 9.5, align: 'center', pri: 3 });
  }

  // ── range ───────────────────────────────────────────────────────────────
  if (show.range && isFinite(f.tFlight)) {
    const rx = sx(f.range);
    const y = Math.min(groundY + 24, h - 18);
    strokePath(ctx, [{ x: sx(0), y }, { x: rx, y }], { color: P.ink2, width: 1 });
    for (const X of [sx(0), rx]) strokePath(ctx, [{ x: X, y: y - 4 }, { x: X, y: y + 4 }], { color: P.ink2, width: 1 });
    labels.add(`R = ${fmt(f.range, 2)} m`, (sx(0) + rx) / 2, y + 11,
      { color: P.ink2, bg: P.bg, size: 10.5, align: 'center', push: 'down', pri: 8 });
  }

  // ── the projectile, and its velocity right now ──────────────────────────
  const now = f.pos(t);
  const v = f.vel(t);
  const p = map(now);
  const vScale = clamp(cam.scale * 0.42, 0.9, 6.5);

  if (show.components) {
    const hx = p.x + v.x * vScale, hy = p.y;
    const vy2 = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, hx, hy, { color: P.ink2, width: 1.3, head: 7, dash: [4, 3] });
    arrow(ctx, p.x, p.y, p.x, vy2, { color: P.ink2, width: 1.3, head: 7, dash: [4, 3] });
    strokePath(ctx, [{ x: hx, y: hy }, { x: hx, y: vy2 }, { x: p.x, y: vy2 }], { color: P.line, width: 1, dash: [2, 3] });
    labels.add(`vₓ ${fmt(v.x, 1)}`, hx + 5, hy + 11, { color: P.ink3, bg: P.bg, size: 9.5, push: 'down', pri: 5 });
    labels.add(`v_y ${fmt(v.y, 1)}`, p.x - 6, vy2 - 2, { color: P.ink3, bg: P.bg, size: 9.5, align: 'right', pri: 5 });
  }
  if (show.gravity) {
    const gLen = clamp(f.params.g * vScale * 0.55, 0, 46);
    if (gLen > 6) {
      arrow(ctx, p.x, p.y, p.x, p.y + gLen, { color: P.ink3, width: 1.4, head: 7 });
      labels.add(`g ${fmt(f.params.g, 2)}`, p.x - 6, p.y + gLen + 3, { color: P.ink3, bg: P.bg, size: 9.5, align: 'right', push: 'down', pri: 4 });
    }
  }
  if (show.velocity) {
    const ex = p.x + v.x * vScale, ey = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, ex, ey, { color: P.accent, width: 2.2, head: 10 });
    // Sit the readout on the far side of the arrow tip from the apex text.
    labels.add(`v = ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, ex + 9, ey + (v.y > 0 ? 12 : -11),
      { color: P.accent, bg: P.bg, size: 10.5, push: v.y > 0 ? 'down' : 'up', pri: 10 });
  }

  dot(ctx, p.x, p.y, 5, { fill: P.accent });
  dot(ctx, p.x, p.y, 9, { stroke: P.accent, width: 1.2 });

  // launch marker
  const lp = map({ x: 0, y: f.params.h });
  if (f.params.h > 0) {
    strokePath(ctx, [{ x: lp.x, y: lp.y }, { x: lp.x, y: groundY }], { color: P.ink2, width: 1.5 });
    labels.add(`h = ${fmt(f.params.h, 1)} m`, lp.x - 7, (lp.y + groundY) / 2,
      { color: P.ink2, bg: P.bg, size: 10, align: 'right', pri: 6 });
  }
  dot(ctx, lp.x, lp.y, 2.5, { fill: P.ink2 });

  labels.add('side elevation · x–y plane', w - 8, 13,
    { color: P.ink3, size: 10, align: 'right', mono: false, pri: 9 });

  labels.draw(ctx, w, h);
  return { sx, sy, px, py };
}

/** Wire zoom + pan. Double-click restores auto-fit. */
export function attachControls2D(canvas, cam, onChange) {
  let dragging = false, lx = 0, ly = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cam.auto = false;
    cam.cx -= (e.clientX - lx) / cam.scale;
    cam.cy += (e.clientY - ly) / cam.scale;
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
    cam.scale = clamp(cam.scale * Math.exp(-e.deltaY * 0.0014), 0.02, 400);
    onChange();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam.auto = true; onChange(); });
  canvas.style.cursor = 'grab';
}
