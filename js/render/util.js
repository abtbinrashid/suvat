// util.js — canvas plumbing. No physics here.

export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cssVar('--surface', '#131210');
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h };
}

export function cssVar(name, fallback) {
  return (getComputedStyle(document.documentElement).getPropertyValue(name) || fallback).trim();
}

export function palette() {
  const v = cssVar;
  return {
    surface: v('--surface', '#131210'),
    card:    v('--card', '#1c1a17'),
    ink:     v('--ink', '#fff'),
    strong:  v('--ink-strong', 'rgba(255,255,255,.8)'),
    muted:   v('--ink-muted', 'rgba(255,255,255,.6)'),
    faint:   v('--ink-faint', 'rgba(255,255,255,.4)'),
    grid:    v('--grid', 'rgba(255,255,255,.07)'),
    axis:    v('--axis', 'rgba(255,255,255,.22)'),
    vel:     v('--vel', '#ea580c'),
    disp:    v('--disp', '#0d9488'),
    acc:     v('--acc', '#8b5cf6'),
    good:    v('--good', '#34d399'),
    bad:     v('--bad', '#fb7185'),
  };
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function fmt(x, dp = 1) {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) >= 100000) return x.toExponential(1);
  return x.toFixed(dp);
}

export function niceStep(span, target = 6) {
  if (span <= 0) return 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
}

export function stroke(ctx, pts, { color, width = 2, dash = null, alpha = 1 } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke(); ctx.restore();
}

export function arrow(ctx, x0, y0, x1, y1, { color, width = 2.4, head = 11, dash = null }) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, hl = Math.min(head, len * 0.5);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.9, y1 - uy * hl * 0.9); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hl - uy * hl * 0.38, y1 - uy * hl + ux * hl * 0.38);
  ctx.lineTo(x1 - ux * hl + uy * hl * 0.38, y1 - uy * hl - ux * hl * 0.38);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

export function dot(ctx, x, y, r, { fill, stroke: st, width = 2 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (st) { ctx.strokeStyle = st; ctx.lineWidth = width; ctx.stroke(); }
  ctx.restore();
}

/* ── labels ────────────────────────────────────────────────────────────
   13px is the floor everywhere on this site, and canvas text ignores CSS,
   so the floor is enforced here by hand. Labels are queued with a priority
   and placed in one pass; anything that cannot find clear space is dropped,
   because a missing label reads better than two printed on top of each other. */

// Canvas text ignores CSS, so the floor is enforced here. 13 was too small to
// read on a 1100px canvas — and a teacher at the back of a room is the test.
const MIN_SIZE = 15;
const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function labels() {
  const q = [];
  return {
    add(text, x, y, o = {}) { q.push({ text, x, y, o, pri: o.pri ?? 0 }); },
    draw(ctx, w, h) {
      q.sort((a, b) => b.pri - a.pri);
      const placed = [];
      for (const it of q) {
        const o = it.o;
        const size = Math.max(MIN_SIZE, o.size ?? MIN_SIZE);
        const weight = o.weight || 500;
        ctx.save();
        ctx.font = `${weight} ${size}px ${cssVar('--font', 'system-ui, sans-serif')}`;
        const tw = ctx.measureText(it.text).width;
        ctx.restore();

        const align = o.align || 'left';
        const off = align === 'center' ? -tw / 2 : align === 'right' ? -tw : 0;
        const bh = size + 10;
        let ax = it.x;
        const left = (a) => a + off - 5;
        if (left(ax) < 3) ax += 3 - left(ax);
        if (left(ax) + tw + 10 > w - 3) ax -= left(ax) + tw + 10 - (w - 3);

        let y = null;
        const bias = o.push === 'down' ? 1 : -1;
        // A label that has to travel a long way to find space is no longer
        // attached to the thing it names, so some labels cap how far they move.
        const ladder = [0, 20, 40, 60, 80].filter((d) => d <= (o.maxPush ?? Infinity));
        outer:
        for (const step of ladder) {
          for (const d of (step === 0 ? [0] : [bias, -bias])) {
            const cy = it.y + d * step;
            const box = { x: left(ax), y: cy - bh / 2, w: tw + 10, h: bh };
            if (box.y < 2 || box.y + box.h > h - 2) continue;
            if (placed.some((p) => hits(p, box))) continue;
            placed.push(box); y = cy; break outer;
          }
        }
        if (y === null) continue;

        ctx.save();
        ctx.font = `${weight} ${size}px ${cssVar('--font', 'system-ui, sans-serif')}`;
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        if (o.bg !== false) {
          ctx.fillStyle = cssVar('--surface', '#131210');
          ctx.globalAlpha = 0.9;
          ctx.fillRect(ax + off - 5, y - bh / 2, tw + 10, bh);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = o.color || cssVar('--ink', '#fff');
        ctx.fillText(it.text, ax, y);
        ctx.restore();
      }
      q.length = 0;
    },
  };
}
