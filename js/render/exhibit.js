// exhibit.js — the two scenarios that are staged rather than surveyed.
//
// WHY THIS IS NOT scene.js. Everywhere else, one unit is one metre on both
// axes: 45° looks like 45°, and it has to, because reading an angle off the
// screen is half the point. These two are different. A bullet leaving a barrel
// at 360 m s⁻¹ falls 1.5 m while it travels 180 — at true scale that is a
// horizontal scratch, and the thing you are meant to see (two bullets at the
// same height at every instant) is invisible.
//
// So the sideways axis is COMPRESSED, and the plate says so, every time, with
// the real distance written out. The vertical axis is never touched, the
// engine never knows, and the numbers on screen are the numbers the engine
// produced. A squeezed picture that admits it beats a true one nobody can read.
//
// The stage itself is a dark plate in both themes, because this is a
// photograph: a strobe lamp firing every 50 ms in a blacked-out room. Light
// mode changes the page around it, not the plate.

import { fitCanvas, palette, fmt, clamp, labels } from './util.js';
import { warehouseBack, beachBack, EXTENT } from './backdrops.js';

export const PALM_H = 12.5;      // the tree is a tree, not a function of the monkey

const PLATE = {
  ink: '#f2efe9', inkMid: 'rgba(242,239,233,0.62)', inkFaint: 'rgba(242,239,233,0.34)',
  bg0: '#1c1b18', bg1: '#0e0e0c',
  rule: 'rgba(242,239,233,0.26)', ruleFaint: 'rgba(242,239,233,0.13)',
  brass: '#c6a02e', brassHi: '#f3dd96', brassLo: '#6d5415',
  lead: '#a8adb2', leadHi: '#e7ebee', leadLo: '#4a4f54',
  glow: 'rgba(255,238,196,0.17)',
  pill: '#f6f3ec', pillInk: '#17160f',
};

const round = (g, x, y, w, h, r) => {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
};

/* ── the mapping ────────────────────────────────────────────────────────
   One scale for height, another for distance. `kx` is how badly the sideways
   axis had to be squeezed to make the flight fit, and it is the only number
   in this file that is allowed to lie — which is why it is printed. */
function stage(o, w, h, pad) {
  const { traj: f, second, markers, scenario } = o;
  const ex = EXTENT[scenario.backdrop] || { x0: 0, x1: 10, yTop: 10 };

  let xHi = Math.max(ex.x1, isFinite(f.range) ? f.range : f.horiz * f.tMax);
  let yHi = Math.max(ex.yTop, f.apexHeight, f.params.h);
  if (second) xHi = Math.max(xHi, second.range ?? 0);
  // the tree stands beside the monkey, so the frame has to hold it too
  if (markers?.target) {
    xHi = Math.max(xHi, markers.target.x + 4.5);
    // the palm is a fixed object; the frame holds it and little else above
    yHi = Math.max(f.apexHeight, f.params.h, markers.target.y + 2.2, PALM_H + 1.4);
  }
  const xLo = Math.min(0, ex.x0);

  const bw = w - pad.l - pad.r, bh = h - pad.t - pad.b;
  const sy = (bh * 0.92) / (yHi * 1.1);               // height is never distorted
  const sxRaw = (bw * 0.93) / (xHi - xLo);
  // Never STRETCH sideways: a squeeze is a reading aid, a stretch is a lie
  // with no upside. Beyond that, the sideways scale is whatever fits.
  const sx = Math.min(sxRaw, sy);
  const kx = sx / sy;

  const originX = pad.l + bw * 0.035 - xLo * sx;
  const groundY = pad.t + bh * 0.92;
  return {
    sx, sy, kx, xHi, yHi, groundY,
    X: (x) => originX + x * sx,
    Y: (y) => groundY - y * sy,
    m: (v) => v * sy,                                  // metres → px, vertically
  };
}

/* ── the plate ─────────────────────────────────────────────────────────── */
function plate(g, w, h, pad) {
  const x = pad.l - 18, y = pad.t - 18, pw = w - x - (pad.r - 18), ph = h - y - (pad.b - 18);
  g.save();
  round(g, x, y, pw, ph, 14); g.clip();
  const bg = g.createLinearGradient(0, y, 0, y + ph);
  bg.addColorStop(0, PLATE.bg0); bg.addColorStop(1, PLATE.bg1);
  g.fillStyle = bg; g.fillRect(x, y, pw, ph);
  // a soft vignette, so the corners fall away like a real exposure
  const v = g.createRadialGradient(x + pw * 0.42, y + ph * 0.42, 0, x + pw * 0.5, y + ph * 0.5, pw * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = v; g.fillRect(x, y, pw, ph);
  return { x, y, w: pw, h: ph };
}

/* ── sprites ───────────────────────────────────────────────────────────── */

/** A round, drawn along its own velocity so it reads as a bullet, not a dot. */
function bullet(g, x, y, L, ang, lit) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const W = Math.max(2.6, L * 0.40);
  const body = g.createLinearGradient(0, -W / 2, 0, W / 2);
  body.addColorStop(0, PLATE.brassHi); body.addColorStop(0.45, PLATE.brass); body.addColorStop(1, PLATE.brassLo);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(L * 0.5, 0);                                 // ogive nose
  g.quadraticCurveTo(L * 0.16, -W / 2, -L * 0.22, -W / 2);
  g.lineTo(-L * 0.5, -W * 0.42);
  g.lineTo(-L * 0.5, W * 0.42);
  g.lineTo(-L * 0.22, W / 2);
  g.quadraticCurveTo(L * 0.16, W / 2, L * 0.5, 0);
  g.closePath(); g.fill();
  if (lit) {                                            // a cannelure and a highlight
    g.strokeStyle = PLATE.brassLo; g.lineWidth = Math.max(0.7, L * 0.045);
    g.beginPath(); g.moveTo(-L * 0.2, -W * 0.46); g.lineTo(-L * 0.2, W * 0.46); g.stroke();
    g.strokeStyle = PLATE.brassHi; g.lineWidth = Math.max(0.6, L * 0.05); g.globalAlpha = 0.9;
    g.beginPath(); g.moveTo(L * 0.3, -W * 0.2); g.lineTo(-L * 0.36, -W * 0.3); g.stroke();
  }
  g.restore();
}

/** The flash halo. This is what makes it read as a photograph. */
function halo(g, x, y, r) {
  const gl = g.createRadialGradient(x, y, 0, x, y, r);
  gl.addColorStop(0, PLATE.glow); gl.addColorStop(0.55, 'rgba(255,238,196,0.06)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function pill(g, x, y, text, size = 14) {
  g.save();
  g.font = `600 ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--font') || 'system-ui'}`;
  const tw = g.measureText(text).width, pw = tw + 22, ph = size + 15;
  round(g, x - pw / 2, y - ph / 2, pw, ph, ph / 2);
  g.fillStyle = PLATE.pill; g.fill();
  g.fillStyle = PLATE.pillInk; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x, y + 0.5);
  g.restore();
}

function text(g, x, y, s, { col = PLATE.inkMid, size = 13, align = 'left', weight = 500 } = {}) {
  g.save();
  g.font = `${weight} ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--font') || 'system-ui'}`;
  g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y); g.restore();
}

/* ── the strobe ─────────────────────────────────────────────────────────
   A flash every `dt` seconds, every exposure kept. Equal time steps are the
   whole argument: the sideways gaps stay constant because nothing accelerates
   sideways, and the vertical gaps grow as 1, 3, 5, 7 — and the two bullets
   share every one of those vertical gaps. */
function strobeTimes(tMax) {
  for (const dt of [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1]) {
    if (tMax / dt <= 14) return { dt, n: Math.floor(tMax / dt) };
  }
  return { dt: tMax / 12, n: 12 };
}

/* ══ the renderer ═══════════════════════════════════════════════════════ */
export function render(canvas, cam, o) {
  const { traj: f, second, t, show, markers = {}, scenario, fired = true, verdict = null } = o;
  if (!f) return null;
  const { ctx: g, w, h } = fitCanvas(canvas);
  const P = palette();
  const L = labels();
  const pad = { l: 34, r: 34, t: 30, b: 54 };
  const box = plate(g, w, h, pad);
  const S = stage(o, w, h, pad);

  const back = scenario.backdrop === 'beach' ? beachBack : warehouseBack;
  back(g, S, box, { t, fired, markers, second, PLATE,
                    launchY: f.params.h, theta: f.params.theta });

  /* ── ground line ──────────────────────────────────────────────────── */
  g.strokeStyle = PLATE.rule; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(box.x, S.groundY + 3.5); g.lineTo(box.x + box.w, S.groundY + 3.5); g.stroke();

  /* ── height rule down the right ───────────────────────────────────── */
  const rx = box.x + box.w - 30;
  g.strokeStyle = PLATE.ruleFaint; g.lineWidth = 1;
  g.beginPath(); g.moveTo(rx, S.Y(S.yHi * 1.02)); g.lineTo(rx, S.groundY); g.stroke();
  const stepY = S.yHi > 24 ? 10 : S.yHi > 9 ? 5 : S.yHi > 3.5 ? 1 : 0.5;
  for (let y = 0; y <= S.yHi * 1.02; y += stepY / 2) {
    const major = Math.abs(y / stepY - Math.round(y / stepY)) < 1e-9;
    g.beginPath(); g.moveTo(rx - (major ? 9 : 5), S.Y(y)); g.lineTo(rx, S.Y(y)); g.stroke();
    if (major && y > 0) text(g, rx - 13, S.Y(y), `${fmt(y, stepY < 1 ? 1 : 0)} m`,
                            { align: 'right', size: 13, col: PLATE.inkMid });
  }

  /* ── the exposures ────────────────────────────────────────────────── */
  // Run to whichever finishes last. When the banana lands short, the monkey
  // is still falling, and freezing it in mid-air reads as a rendering fault
  // rather than as the thing that actually happened.
  const tEnd = Math.max(f.tMax, second?.tMax ?? 0);
  const tNow = fired ? Math.min(t, tEnd) : 0;
  const { dt, n } = strobeTimes(tEnd);
  const dt0 = dt;
  const shots = [];
  for (let i = 0; i <= n; i++) {
    const ti = i * dt;
    if (ti > tNow + 1e-9) break;
    shots.push(ti);
  }
  if (!shots.length || shots[shots.length - 1] < tNow - 1e-9) shots.push(tNow);

  // Size the sprite against the GAP between exposures, not against the metre.
  // A round drawn bigger than the distance it moves between flashes paints a
  // smear instead of a sequence, and the sequence is the entire argument.
  const gapPx = Math.max(6, Math.abs(S.Y(f.pos(dt0).y) - S.Y(f.params.h)) || 0,
                         Math.abs(S.X(f.pos(dt0).x) - S.X(0)));
  const Lbul = clamp(gapPx * 0.72, 9, scenario.backdrop === 'beach' ? 30 : 20);
  const pair = [];                                      // [firedPos, droppedPos] per flash

  // THINNING MUST NOT FLATTEN THE ACCELERATION.
  //
  // Dropping exposures that fall within some distance of the last one drawn
  // produces a column of EVENLY spaced images — which is a picture of
  // constant velocity, and a lie about the one thing the plate is for. Thin
  // by taking every k-th flash instead: gaps under free fall go as 1, 3, 5, 7
  // and a stride multiplies them all by k², so the signature survives intact.
  const firstDrop = second
    ? Math.abs(S.Y(second.pos(Math.min(dt, second.tMax)).y) - S.Y(second.pos(0).y))
    : Infinity;
  let stride = 1;
  while (stride < 8 && firstDrop * stride * stride < 7 && shots.length / (stride + 1) > 4) stride++;

  for (let i = 0; i < shots.length; i++) {
    const ti = shots[i];
    const last = i === shots.length - 1;
    const age = shots.length > 1 ? i / (shots.length - 1) : 1;
    const a = fired ? 0.28 + 0.72 * age : 1;

    const tA = Math.min(ti, f.tMax);
    const p = f.pos(tA), v = f.pos(Math.min(tA + 0.004, f.tMax));
    const px = S.X(p.x), py = S.Y(p.y);
    const ang = Math.atan2(-(S.Y(v.y) - py), S.X(v.x) - px);

    const showA = last || i % stride === 0;
    if (showA) {
      g.save(); g.globalAlpha = a;
      halo(g, px, py, Lbul * (last ? 1.7 : 1.1));
      if (scenario.backdrop === 'beach') bananaOrMonkey(g, px, py, Lbul, ang, last, true);
      else bullet(g, px, py, Lbul, ang, last);
      g.restore();
    }

    let qp = null, drewB = false;
    if (second) {   // drawn second, so it sits in front of the tree behind it
      const q = second.pos(Math.min(ti, second.tMax));
      const qx = S.X(q.x), qy = S.Y(q.y);
      const Lsec = scenario.backdrop === 'beach' ? Math.max(Lbul, 26) : Lbul;
      if (last || i % stride === 0) {
        drewB = true;
        g.save(); g.globalAlpha = a;
        halo(g, qx, qy, Lsec * (last ? 1.7 : 1.1));
        if (scenario.backdrop === 'beach') bananaOrMonkey(g, qx, qy, Lsec, Math.PI / 2, last, false);
        else bullet(g, qx, qy, Lsec, Math.PI / 2, last);
        g.restore();
      }
      qp = { x: qx, y: qy };
    }
    pair.push({ a: { x: px, y: py }, b: qp, i, last, drawn: showA && drewB });
  }

  /* ── the height lines: the argument, drawn ────────────────────────── */
  if (show.heightLines !== false && second) {
    g.save();
    g.setLineDash([2.5, 5]); g.lineWidth = 1.2;
    const grounded = second && isFinite(second.tFlight) ? second.tFlight : Infinity;
    for (const s of pair) {
      if (!s.b) continue;
      if (shots[s.i] > grounded + 1e-9) continue;       // it has landed; no shared fall left
      if (!s.drawn && !s.last) continue;                // no line to an exposure nobody can see
      g.globalAlpha = s.last ? 0.95 : 0.6;
      g.strokeStyle = PLATE.ink;                       // near-white: this is the point
      g.beginPath(); g.moveTo(s.b.x, s.b.y); g.lineTo(s.a.x, s.a.y); g.stroke();
    }
    g.restore();
    const last = pair[pair.length - 1];
    const gap = last?.b ? Math.hypot(last.a.x - last.b.x, last.a.y - last.b.y) : Infinity;
    const done = fired && t >= f.tMax - 1e-6;
    if (verdict?.kind === 'short' && done) {
      // It fell short. Saying "same fall" here would be a lie: the monkey
      // stopped falling the moment it hit the sand.
      labelPair(g, pair, last, scenario, box);          // the lines still mean something
      pill(g, box.x + box.w / 2, box.y + 56, verdict.text, 14);
    } else if (last?.b && gap > 90) {
      labelPair(g, pair, last, scenario, box);
    } else if (last?.b && gap < 14 && done) {
      // they have met. Say so where it happened, not in a corner.
      const cx = (last.a.x + last.b.x) / 2, cy = (last.a.y + last.b.y) / 2;
      halo(g, cx, cy, 34);
      // offset the label clear of the catch itself — a pill over the moment it
      // is naming hides the only thing worth looking at
      const side = cx > box.x + box.w * 0.55 ? -1 : 1;
      const lx = clamp(cx + side * 150, box.x + 90, box.x + box.w - 90);
      g.save(); g.globalAlpha = 0.5; g.strokeStyle = PLATE.ink; g.lineWidth = 1.1;
      g.setLineDash([3, 4]);
      g.beginPath(); g.moveTo(cx + side * 26, cy); g.lineTo(lx - side * 60, cy); g.stroke();
      g.restore();
      pill(g, lx, cy, scenario.caughtLabel || 'caught');
    }
  }

  /* ── what the plate is not telling you straight ───────────────────── */
  const real = isFinite(f.range) ? f.range : f.horiz * f.tMax;
  const foot = S.kx < 0.92
    ? `Sideways squeezed ${fmt(1 / S.kx, 1)}× to fit — the real path is far flatter than this · range ${fmt(real, 0)} m`
    : `No squeeze — 1 m is 1 m both ways · range ${fmt(real, 1)} m`;
  text(g, box.x + box.w - 14, box.y + box.h - 16, foot, { align: 'right', size: 13, col: PLATE.inkMid });
  text(g, box.x + box.w - 14, box.y + 18, `Flash every ${fmt(dt * stride, dt * stride < 0.1 ? 3 : 2)} s`,
       { align: 'right', size: 13, col: PLATE.inkFaint });

  g.restore();                                          // the plate clip
  cam._map = { sx: S.X, sy: S.Y, px: (X) => X, py: (Y) => Y, su: S.X, pu: (X) => X, u0: 0 };
  cam._stage = S;
  L.draw(g, w, h);
  return { sx: S.X, sy: S.Y };
}

/** Put the pair label on a mid-flight pair, on a leader, clear of the lines. */
function labelPair(g, pair, last, scenario, box) {
  const mid = pair.filter((s) => s.b && s.drawn && Math.abs(s.a.x - s.b.x) > 110);
  const s = mid.length ? mid[Math.floor(mid.length * 0.45)] : last;
  if (!s?.b) return;
  const cx = (s.a.x + s.b.x) / 2, cy = s.a.y;
  const ly = clamp(cy - 46, box.y + 30, box.y + box.h - 30);
  g.save(); g.globalAlpha = 0.55; g.strokeStyle = PLATE.ink; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, ly + 13); g.stroke(); g.restore();
  pill(g, cx, ly, scenario.pairLabel || 'same height');
}

/** On the beach the projectile is a banana and the second object is a monkey. */
function bananaOrMonkey(g, x, y, L, ang, lit, isBanana) {
  if (isBanana) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath();
    g.moveTo(-L * 0.5, L * 0.16);
    g.quadraticCurveTo(0, -L * 0.42, L * 0.5, L * 0.1);
    g.quadraticCurveTo(0, -L * 0.1, -L * 0.5, L * 0.16);
    g.closePath();
    const gr = g.createLinearGradient(0, -L * 0.3, 0, L * 0.2);
    gr.addColorStop(0, PLATE.brassHi); gr.addColorStop(1, PLATE.brass);
    g.fillStyle = gr; g.fill();
    if (lit) { g.strokeStyle = PLATE.brassLo; g.lineWidth = Math.max(0.6, L * 0.05); g.stroke(); }
    g.restore();
    return;
  }
  monkeyGlyph(g, x, y, L * 0.95, lit);
}

/** A monkey, at a size you can actually see. */
export function monkeyGlyph(g, x, y, s, lit) {
  const b = s * 0.34, hd = s * 0.26;
  g.save();
  // a dark edge first, so the shape survives whatever it is drawn over
  g.strokeStyle = 'rgba(12,10,8,0.85)'; g.lineWidth = Math.max(2, s * 0.14);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.ellipse(x, y, b * 0.82, b, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y - b - hd * 0.6, hd, 0, Math.PI * 2); g.stroke();
  g.fillStyle = lit ? '#9aa7b4' : '#6f7985';
  g.beginPath(); g.ellipse(x, y, b * 0.82, b, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x, y - b - hd * 0.6, hd, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x - hd, y - b - hd * 0.75, hd * 0.44, 0, Math.PI * 2);
  g.arc(x + hd, y - b - hd * 0.75, hd * 0.44, 0, Math.PI * 2); g.fill();
  g.fillStyle = lit ? '#d9e2ea' : '#9aa4af';
  g.beginPath(); g.ellipse(x, y - b - hd * 0.45, hd * 0.6, hd * 0.48, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = lit ? '#9aa7b4' : '#6f7985';
  g.lineWidth = Math.max(1.4, s * 0.1); g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - b * 0.6, y - b * 0.2); g.lineTo(x - b * 1.6, y - b * 1.3);
  g.moveTo(x + b * 0.6, y - b * 0.2); g.lineTo(x + b * 1.6, y - b * 1.3);
  g.moveTo(x - b * 0.4, y + b * 0.8); g.lineTo(x - b * 0.8, y + b * 1.8);
  g.moveTo(x + b * 0.4, y + b * 0.8); g.lineTo(x + b * 0.8, y + b * 1.8);
  g.stroke();
  g.restore();
}
