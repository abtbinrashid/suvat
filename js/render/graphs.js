// graphs.js — displacement, velocity and acceleration against time,
// sharing the animation's time cursor.
//
// Series are told apart by hue (the quantity) and stroke (the component):
// solid is vertical, dashed is horizontal. That keeps the rule consistent with
// the main scene — colour is the quantity, dash is the direction.

import { fitCanvas, palette, stroke, dot, fmt, niceStep, clamp, labels } from './util.js';

const PAD = { l: 52, r: 16, t: 28, b: 34 };

export function drawGraph(canvas, spec) {
  const { ctx, w, h } = fitCanvas(canvas);
  if (w < 60 || h < 60) return;
  const P = palette();
  const L = labels();
  const { series, tMax, t, title, unit, shade } = spec;
  const gw = w - PAD.l - PAD.r, gh = h - PAD.t - PAD.b;

  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    for (let i = 0; i <= 120; i++) {
      const y = s.fn((i / 120) * tMax);
      if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    }
  }
  if (!isFinite(lo)) { lo = -1; hi = 1; }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.14;
  lo = Math.min(0, lo - pad); hi = Math.max(0, hi + pad);

  const X = (tt) => PAD.l + (tt / (tMax || 1)) * gw;
  const Y = (yy) => PAD.t + gh - ((yy - lo) / (hi - lo)) * gh;

  // gridlines
  const stepY = niceStep(hi - lo, 3);
  ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = Math.ceil(lo / stepY) * stepY; y <= hi; y += stepY) {
    const py = Math.round(Y(y)) + 0.5; ctx.moveTo(PAD.l, py); ctx.lineTo(PAD.l + gw, py);
  }
  ctx.stroke(); ctx.restore();
  for (let y = Math.ceil(lo / stepY) * stepY; y <= hi; y += stepY) {
    L.add(fmt(y, stepY < 1 ? 1 : 0), PAD.l - 7, Y(y), { color: P.faint, align: 'right', pri: 1, bg: false, size: 15 });
  }

  const stepT = niceStep(tMax, 4);
  for (let tt = 0; tt <= tMax + 1e-9; tt += stepT) {
    L.add(fmt(tt, stepT < 1 ? 1 : 0), X(tt), PAD.t + gh + 15, { color: P.faint, align: 'center', pri: 1, bg: false, size: 15 });
  }

  // zero line and axes
  stroke(ctx, [{ x: PAD.l, y: Y(0) }, { x: PAD.l + gw, y: Y(0) }], { color: P.axis, width: 1.3 });
  stroke(ctx, [{ x: PAD.l + .5, y: PAD.t }, { x: PAD.l + .5, y: PAD.t + gh }], { color: P.axis, width: 1.3 });

  // area under the curve up to the cursor
  if (shade && series[shade.index]) {
    const s = series[shade.index];
    ctx.save(); ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    for (let i = 0; i <= 90; i++) ctx.lineTo(X((i / 90) * t), Y(s.fn((i / 90) * t)));
    ctx.lineTo(X(t), Y(0)); ctx.closePath();
    ctx.globalAlpha = 0.16; ctx.fillStyle = s.color; ctx.fill(); ctx.restore();
  }

  for (const s of series) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const tt = (i / 160) * tMax, y = s.fn(tt);
      if (isFinite(y)) pts.push({ x: X(tt), y: Y(y) });
    }
    stroke(ctx, pts, { color: s.color, width: 2.2, dash: s.dash });
  }

  // time cursor
  const cx = X(clamp(t, 0, tMax));
  stroke(ctx, [{ x: cx, y: PAD.t }, { x: cx, y: PAD.t + gh }], { color: P.muted, width: 1.2, dash: [4, 4] });
  for (const s of series) {
    const y = s.fn(t);
    if (isFinite(y)) dot(ctx, cx, Y(y), 4, { fill: P.surface, stroke: s.color, width: 2.2 });
  }

  L.add(title, PAD.l, 14, { color: P.ink, pri: 9, weight: 600, size: 17 });
  L.add(unit, w - 12, 14, { color: P.faint, align: 'right', pri: 8, bg: false, size: 15 });
  if (shade) L.add(shade.label, PAD.l + gw - 4, PAD.t + 10, { color: P.muted, align: 'right', pri: 5, size: 15 });
  L.draw(ctx, w, h);
}

export function graphSpecs(f, t, P) {
  const tMax = f.tMax;
  return [
    { canvas: 'g-s', title: 'Displacement–time', unit: 'm', tMax, t,
      series: [
        { label: 'height',     fn: (tt) => f.pos(tt).y, color: P.disp, dash: null },
        { label: 'horizontal', fn: (tt) => f.pos(tt).x, color: P.disp, dash: [6, 4] },
      ] },
    { canvas: 'g-v', title: 'Velocity–time', unit: 'm s⁻¹', tMax, t,
      series: [
        { label: 'vertical',   fn: (tt) => f.vel(tt).y, color: P.vel, dash: null },
        { label: 'horizontal', fn: () => f.horiz,       color: P.vel, dash: [6, 4] },
      ],
      shade: { index: 0, label: 'area = vertical displacement' } },
    { canvas: 'g-a', title: 'Acceleration–time', unit: 'm s⁻²', tMax, t,
      series: [
        { label: 'vertical',   fn: () => -f.params.g, color: P.acc, dash: null },
        { label: 'horizontal', fn: () => 0,           color: P.acc, dash: [6, 4] },
      ],
      shade: { index: 0, label: 'area = change in vertical velocity' } },
  ];
}
