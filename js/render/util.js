// util.js — shared canvas plumbing. Nothing physics-specific lives here.

/** Size a canvas to its CSS box at device pixel ratio. Returns {ctx, w, h}. */
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Paint the background rather than clearing to transparent: the canvas then
  // matches the page in any compositing context, and exports are truthful.
  ctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#ffffff').trim();
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h };
}

/** Read the active theme's ink values so canvases follow the light/dark toggle. */
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k, fallback) => (cs.getPropertyValue(k) || fallback).trim();
  return {
    ink:   v('--ink', '#020a0f'),
    ink2:  v('--ink-2', '#50565d'),
    ink3:  v('--ink-3', '#9da4ae'),
    line:  v('--line', '#e6e6eb'),
    faint: v('--faint', '#f4f4f7'),
    bg:    v('--bg', '#ffffff'),
    surface: v('--surface', '#f6f6f8'),
    // The accent marks the LIVE element only — the projectile and its
    // velocity vector. Every static mark on the canvas stays greyscale.
    accent:     v('--accent', '#ee4498'),
    accentSoft: v('--accent-soft', '#fce7f3'),
    accentLine: v('--accent-line', '#fbcfe8'),
  };
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Compact number formatting for on-canvas labels. */
export function fmt(x, dp = 1) {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) >= 10000) return x.toExponential(1);
  return x.toFixed(dp);
}

/** A "nice" axis step (1, 2, 5 × 10ⁿ) covering `span` in roughly `target` divisions. */
export function niceStep(span, target = 6) {
  if (span <= 0) return 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

/** Stroke a path from an array of {x,y} screen points. */
export function strokePath(ctx, pts, { color, width = 1.5, dash = null, alpha = 1 } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

/** An arrow with a solid head — used for every velocity vector on the site. */
export function arrow(ctx, x0, y0, x1, y1, { color, width = 1.75, head = 9, dash = null, alpha = 1 } = {}) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1.5) return;
  const ux = dx / len, uy = dy / len;
  const hl = Math.min(head, len * 0.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * hl * 0.9, y1 - uy * hl * 0.9);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hl - uy * hl * 0.36, y1 - uy * hl + ux * hl * 0.36);
  ctx.lineTo(x1 - ux * hl + uy * hl * 0.36, y1 - uy * hl - ux * hl * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text with a background knockout so labels stay readable over any line. */
export function label(ctx, text, x, y, { color, bg, align = 'left', baseline = 'middle', size = 11, pad = 3, mono = true, weight = 400 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (bg) {
    const w = ctx.measureText(text).width;
    const ox = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    const oy = baseline === 'middle' ? -size / 2 : baseline === 'bottom' ? -size : 0;
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(x + ox - pad, y + oy - pad + 1, w + pad * 2, size + pad * 2 - 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function dot(ctx, x, y, r, { fill, stroke, width = 1.5 } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  ctx.restore();
}


/* ── Label layer ────────────────────────────────────────────────────────────
   Diagram labels collide constantly: the apex marker, the live velocity
   readout and the Δt annotation all want the same few pixels. Rather than let
   them overprint, every label is queued with a priority, then placed in one
   pass — high priority first, each later label nudged vertically until it
   finds clear space. A label that cannot find space is DROPPED, because a
   missing label reads better than two on top of each other. */

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function createLabels() {
  const queue = [];
  return {
    /** @param {number} pri higher = placed first and least likely to be dropped */
    add(text, x, y, opts = {}) {
      queue.push({ text, x, y, opts, pri: opts.pri ?? 0 });
    },
    draw(ctx, w, h) {
      queue.sort((a, b) => b.pri - a.pri);
      const placed = [];

      for (const item of queue) {
        const o = item.opts;
        const size = o.size ?? 11;
        ctx.save();
        ctx.font = `${o.weight || 400} ${size}px ${o.mono === false
          ? 'system-ui, sans-serif'
          : 'ui-monospace, SFMono-Regular, Menlo, monospace'}`;
        const tw = ctx.measureText(item.text).width;
        ctx.restore();

        const align = o.align || 'left';
        const anchorOff = align === 'center' ? -tw / 2 : align === 'right' ? -tw : 0;
        const bh = size + 5;

        // Keep the box inside the canvas by shifting the anchor horizontally.
        let ax = item.x;
        const leftAt = (a) => a + anchorOff - 3;
        if (leftAt(ax) < 2) ax += 2 - leftAt(ax);
        if (leftAt(ax) + tw + 6 > w - 2) ax -= leftAt(ax) + tw + 6 - (w - 2);

        // Try the requested spot, then walk outwards.
        const bias = o.push === 'down' ? 1 : -1;
        let chosenY = null;
        search:
        for (const step of [0, 13, 26, 39, 52, 65]) {
          const dirs = step === 0 ? [0] : [bias, -bias];
          for (const d of dirs) {
            const y = item.y + d * step;
            const box = { x: leftAt(ax), y: y - bh / 2, w: tw + 6, h: bh };
            if (box.y < 1 || box.y + box.h > h - 1) continue;
            if (placed.some((p) => overlaps(p, box))) continue;
            placed.push(box);
            chosenY = y;
            break search;
          }
        }
        if (chosenY === null) continue;   // no room — drop it
        label(ctx, item.text, ax, chosenY, o);
      }
      queue.length = 0;
    },
  };
}
