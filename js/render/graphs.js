// graphs.js — displacement–time, velocity–time and acceleration–time,
// all sharing one time cursor with the animation.
//
// In a strictly black-and-white palette you cannot tell series apart by colour,
// so they are told apart by LINE STYLE: solid for vertical, dashed for
// horizontal, dotted for resultant. The legend uses the same strokes.

import { fitCanvas, palette, strokePath, label, dot, fmt, niceStep, clamp } from './util.js';

const PAD = { l: 44, r: 12, t: 20, b: 26 };

/**
 * @param {Object} spec
 *   series  [{ label, fn(t)->number, dash, width }]
 *   tMax    end of the time axis
 *   t       cursor position
 *   title   heading drawn top-left
 *   unit    y-axis unit string
 *   shade   optional { index, label } — shades ∫ of that series up to t
 */
export function drawGraph(canvas, spec) {
  const { ctx, w, h } = fitCanvas(canvas);
  const P = palette();
  const { series, tMax, t, title, unit, shade } = spec;
  const gw = w - PAD.l - PAD.r;
  const gh = h - PAD.t - PAD.b;
  if (gw < 30 || gh < 24) return;

  // ── y range across every series ─────────────────────────────────────────
  let lo = Infinity, hi = -Infinity;
  const N = 160;
  for (const s of series) {
    for (let i = 0; i <= N; i++) {
      const y = s.fn((i / N) * tMax);
      if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    }
  }
  if (!isFinite(lo) || !isFinite(hi)) { lo = -1; hi = 1; }
  if (Math.abs(hi - lo) < 1e-6) { hi += 1; lo -= 1; }
  const padY = (hi - lo) * 0.12;
  lo -= padY; hi += padY;
  if (lo > 0) lo = 0;
  if (hi < 0) hi = 0;

  const X = (tt) => PAD.l + (tt / (tMax || 1)) * gw;
  const Y = (yy) => PAD.t + gh - ((yy - lo) / (hi - lo)) * gh;

  // ── frame + gridlines ───────────────────────────────────────────────────
  const stepY = niceStep(hi - lo, 4);
  ctx.save();
  ctx.strokeStyle = P.faint; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = Math.ceil(lo / stepY) * stepY; y <= hi; y += stepY) {
    const py = Math.round(Y(y)) + 0.5;
    ctx.moveTo(PAD.l, py); ctx.lineTo(PAD.l + gw, py);
  }
  ctx.stroke();
  ctx.restore();

  for (let y = Math.ceil(lo / stepY) * stepY; y <= hi; y += stepY) {
    label(ctx, fmt(y, stepY < 1 ? 1 : 0), PAD.l - 6, Y(y), { color: P.ink3, size: 9.5, align: 'right' });
  }

  const stepT = niceStep(tMax, 5);
  for (let tt = 0; tt <= tMax + 1e-9; tt += stepT) {
    const px = Math.round(X(tt)) + 0.5;
    strokePath(ctx, [{ x: px, y: PAD.t + gh }, { x: px, y: PAD.t + gh + 3 }], { color: P.ink3, width: 1 });
    label(ctx, fmt(tt, stepT < 1 ? 1 : 0), px, PAD.t + gh + 13, { color: P.ink3, size: 9.5, align: 'center' });
  }

  // zero line and axes
  strokePath(ctx, [{ x: PAD.l, y: Y(0) }, { x: PAD.l + gw, y: Y(0) }], { color: P.ink2, width: 1.1 });
  strokePath(ctx, [{ x: PAD.l + 0.5, y: PAD.t }, { x: PAD.l + 0.5, y: PAD.t + gh }], { color: P.ink2, width: 1.1 });

  // ── area under the curve, up to the cursor ──────────────────────────────
  if (shade && series[shade.index]) {
    const s = series[shade.index];
    const pts = [];
    const M = 120;
    for (let i = 0; i <= M; i++) pts.push({ x: X((i / M) * t), y: Y(s.fn((i / M) * t)) });
    if (pts.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      for (const q of pts) ctx.lineTo(q.x, q.y);
      ctx.lineTo(X(t), Y(0));
      ctx.closePath();
      // diagonal hatch — a greyscale way to fill without muddying the lines
      ctx.clip();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = P.ink3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -h; k < w + h; k += 6) { ctx.moveTo(k, PAD.t); ctx.lineTo(k + h, PAD.t + gh); }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── series ──────────────────────────────────────────────────────────────
  for (const s of series) {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const tt = (i / 200) * tMax;
      const y = s.fn(tt);
      if (isFinite(y)) pts.push({ x: X(tt), y: Y(y) });
    }
    strokePath(ctx, pts, { color: s.faint ? P.ink3 : P.ink, width: s.width || 1.7, dash: s.dash || null });
  }

  // ── time cursor ─────────────────────────────────────────────────────────
  const cx = X(clamp(t, 0, tMax));
  strokePath(ctx, [{ x: cx, y: PAD.t }, { x: cx, y: PAD.t + gh }], { color: P.accent, width: 1.1, dash: [3, 3] });
  for (const s of series) {
    const y = s.fn(t);
    if (!isFinite(y)) continue;
    dot(ctx, cx, Y(y), 3.2, { fill: P.bg, stroke: P.accent, width: 1.8 });
  }

  // ── heading, legend, readouts ───────────────────────────────────────────
  label(ctx, title, PAD.l, 9, { color: P.ink, size: 10.5, align: 'left', mono: false, weight: 600 });
  label(ctx, unit, PAD.l - 6, 9, { color: P.ink3, size: 9, align: 'right' });
  label(ctx, 't / s', PAD.l + gw, PAD.t + gh + 13, { color: P.ink3, size: 9.5, align: 'right' });

  let lx = PAD.l + 4;
  const ly = PAD.t + gh - 6;
  for (const s of series) {
    const val = s.fn(t);
    const txt = `${s.label} ${fmt(val, 1)}`;
    ctx.save();
    ctx.font = '9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tw = ctx.measureText(txt).width;
    ctx.restore();
    if (lx + tw + 22 > PAD.l + gw) break;
    strokePath(ctx, [{ x: lx, y: ly }, { x: lx + 14, y: ly }], { color: s.faint ? P.ink3 : P.ink, width: s.width || 1.7, dash: s.dash || null });
    label(ctx, txt, lx + 18, ly, { color: P.ink2, bg: P.bg, size: 9.5 });
    lx += tw + 28;
  }

  if (shade) {
    label(ctx, shade.label, PAD.l + gw - 4, PAD.t + 8, { color: P.ink3, bg: P.bg, size: 9.5, align: 'right', mono: false });
  }
}

/** The three standard graph specs for a given flight. */
export function graphSpecs(f, t) {
  const tMax = f.tMax;
  return [
    {
      canvas: 'graph-s',
      title: 'Displacement–time',
      unit: 'm',
      tMax, t,
      series: [
        { label: 'y', fn: (tt) => f.pos(tt).y, dash: null },
        { label: 'x', fn: (tt) => f.pos(tt).x, dash: [5, 4], faint: true },
      ],
    },
    {
      canvas: 'graph-v',
      title: 'Velocity–time',
      unit: 'm s⁻¹',
      tMax, t,
      series: [
        { label: 'v_y', fn: (tt) => f.vel(tt).y, dash: null },
        { label: 'vₓ', fn: () => f.horiz, dash: [5, 4], faint: true },
        { label: '|v|', fn: (tt) => f.speed(tt), dash: [1, 3], faint: true },
      ],
      shade: { index: 0, label: 'shaded area = vertical displacement' },
    },
    {
      canvas: 'graph-a',
      title: 'Acceleration–time',
      unit: 'm s⁻²',
      tMax, t,
      series: [
        { label: 'a_y', fn: () => -f.params.g, dash: null },
        { label: 'aₓ', fn: () => 0, dash: [5, 4], faint: true },
      ],
      shade: { index: 0, label: 'shaded area = change in v_y' },
    },
  ];
}
