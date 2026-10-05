// backdrops.js — the places the two staged scenarios happen in.
//
// These are drawn onto the exhibit PLATE (see exhibit.js), not onto the themed
// canvas, so they take their colours from the plate rather than from
// css/tokens.css. The plate is dark in both themes because both scenarios are
// photographs: a strobe lamp firing in a blacked-out range, and a beach at
// dusk. Light mode changes the page around the plate, not the plate.
//
// Everything here is background. If you notice it before you notice the
// trajectory, it is wrong — so it is held to low chroma, and the only warm
// saturated thing on the plate is the projectile itself.

/**
 * The box each place wants kept in frame, in metres.
 *
 * `yTop` is doing real work. A bullet dropping 1.5 m sets a vertical scale at
 * which the fall is a scratch; asking for 2.2 m of headroom sets one at which
 * it is a readable curve. The flight is never cropped — this only ever widens
 * the frame.
 */
export const EXTENT = {
  warehouse: { x0: -2.2, x1: 9, yTop: 2.4 },
  beach:     { x0: -3, x1: 16, yTop: 13 },
};

/* ── shared marks ──────────────────────────────────────────────────────── */

const grad = (g, x0, y0, x1, y1, stops) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [at, col] of stops) gr.addColorStop(at, col);
  return gr;
};

/** Deterministic jitter — the same pebble is the same pebble on every repaint. */
const rnd = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

/* ══ the range ══════════════════════════════════════════════════════════
   Almost nothing: a floor, a barrel and the clamp that lets the second round
   go. A test range is a dark room with one lamp, and every object that is not
   the two bullets is competition. */

export function warehouseBack(g, S, box, o) {
  const { PLATE } = o;
  const gy = S.groundY;

  // the floor, catching a little of the flash
  g.fillStyle = grad(g, 0, gy, 0, box.y + box.h, [[0, 'rgba(255,255,255,0.055)'], [1, 'rgba(255,255,255,0.012)']]);
  g.fillRect(box.x, gy, box.w, box.y + box.h - gy);

  // range markers along the floor, every metre, labelled every five
  const stepX = S.xHi > 140 ? 20 : S.xHi > 60 ? 10 : S.xHi > 18 ? 5 : 1;
  g.save();
  for (let x = 0; x <= S.xHi * 1.02; x += stepX) {
    const X = S.X(x);
    if (X < box.x || X > box.x + box.w) continue;
    g.strokeStyle = PLATE.ruleFaint; g.lineWidth = 1;
    g.beginPath(); g.moveTo(X, gy); g.lineTo(X, gy + 9); g.stroke();
  }
  g.restore();

  // the back wall, a hair lighter than the air so the barrel has something
  // to sit against
  const wx = S.X(EXTENT.warehouse.x0 + 0.5);
  g.fillStyle = 'rgba(255,255,255,0.028)';
  g.fillRect(box.x, box.y, Math.max(0, wx - box.x), gy - box.y);

  rig(g, S, o, PLATE);
}

/** The barrel, the bench and the release clamp — all at the launch height. */
function rig(g, S, o, PLATE) {
  const y = S.Y(o.launchY), x = S.X(0);
  const m = (v) => Math.max(1, S.m(v));                 // metres → px, vertically
  const bore = Math.max(3, m(0.09));

  // bench leg down to the floor
  // The post stands BEHIND and to one side: a dropped round falls through the
  // bore line, and a bar drawn there is read as part of the experiment.
  g.fillStyle = 'rgba(255,255,255,0.035)';
  const px0 = x - Math.max(16, m(0.45));
  g.fillRect(px0 - m(0.04), y, m(0.08), S.groundY - y);
  g.fillRect(px0 - m(0.26), S.groundY - m(0.05), m(0.52), m(0.05));

  // barrel, running back off the left edge of the plate
  const bar = grad(g, 0, y - bore, 0, y + bore,
    [[0, PLATE.leadHi], [0.3, PLATE.lead], [1, PLATE.leadLo]]);
  g.fillStyle = bar;
  g.fillRect(x - m(3.4), y - bore * 0.5, m(3.4), bore);
  // muzzle brake: three ports and a crown
  g.fillStyle = PLATE.leadLo;
  for (let i = 1; i <= 3; i++) g.fillRect(x - m(0.12) * i * 2.2, y - bore * 0.5, m(0.07), bore * 0.42);
  g.fillStyle = PLATE.lead;
  g.fillRect(x - m(0.1), y - bore * 0.78, m(0.12), bore * 1.56);

  // the clamp that holds the dropped round, directly above the bore line
  const cy = y - m(0.55);
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = Math.max(1.2, m(0.03));
  g.beginPath(); g.moveTo(x, cy); g.lineTo(x, y - bore * 0.7); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(x - m(0.16), cy - m(0.1), m(0.32), m(0.1));

  // MUZZLE FLASH — two frames at 60 fps, which is all a real one lasts.
  if (o.fired && o.t < 0.1) {
    const k = 1 - o.t / 0.1, r = bore * (2 + 7 * k);
    g.save(); g.globalAlpha = k;
    const gl = g.createRadialGradient(x, y, 0, x, y, r * 3.4);
    gl.addColorStop(0, 'rgba(255,244,214,0.95)');
    gl.addColorStop(0.35, 'rgba(255,214,128,0.42)');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,248,226,0.92)';
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = (i % 2 ? r * 0.34 : r * (0.75 + rnd(i) * 0.55)) * (i < 4 || i > 8 ? 1.5 : 0.8);
      const px = x + Math.cos(a) * rr * 1.6, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill(); g.restore();
  }
}

/* ══ the beach ══════════════════════════════════════════════════════════
   Dusk. One palm, drawn properly, standing exactly where the monkey is —
   drag the monkey and the tree goes with it, because a monkey that lets go
   has to have been holding something. */

export function beachBack(g, S, box, o) {
  const { PLATE, markers } = o;
  const gy = S.groundY;
  const horizon = S.Y(Math.max(0.6, S.yHi * 0.055));

  // sky: deep indigo above, a last band of warmth at the waterline
  g.fillStyle = grad(g, 0, box.y, 0, horizon,
    [[0, '#141d2e'], [0.55, '#243246'], [1, '#55506a']]);
  g.fillRect(box.x, box.y, box.w, horizon - box.y);
  g.fillStyle = grad(g, 0, horizon - S.m(2.2), 0, horizon,
    [[0, 'rgba(226,150,96,0)'], [1, 'rgba(232,160,96,0.42)']]);
  g.fillRect(box.x, horizon - S.m(2.2), box.w, S.m(2.2));

  // sea
  g.fillStyle = grad(g, 0, horizon, 0, gy, [[0, '#1b3140'], [1, '#12222d']]);
  g.fillRect(box.x, horizon, box.w, gy - horizon);
  g.save(); g.strokeStyle = 'rgba(214,180,150,0.20)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = horizon + (gy - horizon) * (0.1 + rnd(i) * 0.82);
    const x = box.x + rnd(i + 40) * box.w, len = 14 + rnd(i + 11) * 46;
    g.globalAlpha = 0.5 - (y - horizon) / (gy - horizon) * 0.3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(236,214,190,0.34)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(box.x, gy - 1); g.lineTo(box.x + box.w, gy - 1); g.stroke();

  // sand
  g.fillStyle = grad(g, 0, gy, 0, box.y + box.h,
    [[0, 'rgba(214,180,138,0.30)'], [1, 'rgba(120,96,70,0.22)']]);
  g.fillRect(box.x, gy, box.w, box.y + box.h - gy);
  g.save(); g.strokeStyle = 'rgba(255,236,206,0.10)'; g.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const y = gy + (box.y + box.h - gy) * (0.12 + rnd(i + 3) * 0.8);
    const x = box.x + rnd(i + 70) * box.w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd(i) * 60, y); g.stroke();
  }
  g.restore();

  // two low rocks, for something to judge the sand against
  for (const [u, s] of [[-1.6, 0.5], [S.xHi * 0.62, 0.34]]) {
    const X = S.X(u), r = Math.max(3, S.m(s));
    g.fillStyle = 'rgba(166,150,132,0.30)';
    g.beginPath(); g.ellipse(X, gy - r * 0.35, r, r * 0.62, 0, 0, Math.PI * 2); g.fill();
  }

  // THE TREE, at the monkey. It is the thing the monkey lets go of, so it
  // follows the marker rather than standing in a fixed spot.
  if (markers?.target) palm(g, S, markers.target, PLATE);
  hunter(g, S, o, PLATE);
}

/** One palm: a leaning trunk with ring scars, a crown, and three coconuts. */
function palm(g, S, target, PLATE) {
  const m = (v) => Math.max(1, S.m(v));
  const H = target.y + 1.6;                  // the crown; the monkey hangs under it
  const CX = target.x + 1.5;                 // and OFF to one side, so the fall
                                             // is seen against sky, not bark
  const botX = S.X(target.x + 3.1), botY = S.groundY;
  const topX = S.X(CX), topY = S.Y(H);
  const lw = Math.max(2.4, m(0.42));

  // trunk
  g.save();
  g.beginPath(); g.moveTo(botX, botY);
  g.quadraticCurveTo(S.X(CX + 1.5), S.Y(H * 0.5), topX, topY);
  g.strokeStyle = '#4a3a2a'; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
  g.strokeStyle = 'rgba(214,180,138,0.22)'; g.lineWidth = lw * 0.26;
  g.beginPath(); g.moveTo(botX - lw * 0.3, botY);
  g.quadraticCurveTo(S.X(CX + 1.5) - lw * 0.3, S.Y(H * 0.5), topX - lw * 0.3, topY);
  g.stroke();                                           // rim light down one side
  g.restore();
  for (let k = 0.12; k < 0.92; k += 0.16) {             // ring scars
    const tx = botX + (topX - botX) * k * k * 0.85 + (S.X(CX + 1.5) - botX) * 2 * k * (1 - k);
    const ty = botY + (topY - botY) * k;
    g.strokeStyle = 'rgba(0,0,0,0.20)'; g.lineWidth = Math.max(0.7, lw * 0.09);
    g.beginPath(); g.moveTo(tx - lw * 0.42, ty); g.lineTo(tx + lw * 0.42, ty); g.stroke();
  }

  // crown: nine fronds, the back ones darker
  for (let i = 0; i < 9; i++) {
    const a = (-168 + (i * 336) / 8 + (rnd(i * 5) - 0.5) * 12) * Math.PI / 180;
    const Lf = m(2.6 + rnd(i) * 1.5);
    const ex = topX + Math.cos(a) * Lf, ey = topY + Math.sin(a) * Lf * 0.6 + Lf * 0.4;
    const mx = topX + Math.cos(a) * Lf * 0.56, my = topY + Math.sin(a) * Lf * 0.48 - Lf * 0.17;
    const back = i % 3 === 2;
    g.strokeStyle = back ? '#1d3a2b' : '#2d5c3f';
    g.lineWidth = Math.max(1.6, m(0.2)); g.lineCap = 'round';
    g.beginPath(); g.moveTo(topX, topY); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
    for (let k = 0.26; k < 1; k += 0.12) {              // leaflets
      const px = topX + (mx - topX) * 2 * k * (1 - k) + (ex - topX) * k * k;
      const py = topY + (my - topY) * 2 * k * (1 - k) + (ey - topY) * k * k;
      const s = m(0.5) * (1 - k * 0.45);
      g.lineWidth = Math.max(0.9, m(0.075));
      g.beginPath(); g.moveTo(px, py);
      g.lineTo(px - Math.cos(a) * s * 0.45, py + s); g.stroke();
    }
  }
  // the frond it is holding — short, and on the side the monkey hangs from
  g.strokeStyle = '#2d5c3f'; g.lineWidth = Math.max(1.6, m(0.17)); g.lineCap = 'round';
  g.beginPath(); g.moveTo(topX, topY);
  g.quadraticCurveTo(S.X(CX - 1.2), S.Y(target.y + 1.5), S.X(target.x), S.Y(target.y + 0.3));
  g.stroke();

  // coconuts
  for (let i = 0; i < 3; i++) {
    const r = Math.max(1.6, m(0.16));
    g.fillStyle = '#3a2d20';
    g.beginPath(); g.arc(topX + (i - 1) * r * 2.1, topY + r * 1.9, r, 0, Math.PI * 2); g.fill();
  }
}

/** The hunter, and the dead-straight line of the aim. */
function hunter(g, S, o, PLATE) {
  const m = (v) => Math.max(1, S.m(v));
  const X0 = S.X(0), gy = S.groundY, mz = S.Y(o.launchY);
  const a = -(o.theta || 0) * Math.PI / 180;

  // the aim, before the shot. This dashed line IS the lesson: it points at
  // where the monkey IS, not at where it will be, and it still connects.
  if (o.markers?.target && !o.fired) {
    g.save(); g.setLineDash([5, 5]); g.globalAlpha = 0.5;
    g.strokeStyle = PLATE.ink; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(X0, mz);
    g.lineTo(S.X(o.markers.target.x), S.Y(o.markers.target.y)); g.stroke();
    g.restore();
  }

  const hip = gy - m(0.95), head = m(0.115);
  g.save();
  g.strokeStyle = '#0d1016'; g.lineWidth = Math.max(2, m(0.11)); g.lineCap = 'round';
  g.beginPath();
  g.moveTo(X0 - m(0.24), gy); g.lineTo(X0, hip); g.lineTo(X0 + m(0.22), gy);
  g.moveTo(X0, hip); g.lineTo(X0, gy - m(1.5));
  g.stroke();
  g.fillStyle = '#0d1016';
  g.beginPath(); g.arc(X0, gy - m(1.5) - head, head, 0, Math.PI * 2); g.fill();
  // the launcher along the aim
  const sx0 = X0, sy0 = gy - m(1.38), Lb = m(1.05);
  g.strokeStyle = '#0d1016'; g.lineWidth = Math.max(2.2, m(0.09));
  g.beginPath();
  g.moveTo(sx0 - Math.cos(a) * m(0.28), sy0 - Math.sin(a) * m(0.28));
  g.lineTo(sx0 + Math.cos(a) * Lb, sy0 + Math.sin(a) * Lb); g.stroke();
  g.lineWidth = Math.max(1.6, m(0.07));
  g.beginPath(); g.moveTo(X0, gy - m(1.3));
  g.lineTo(sx0 + Math.cos(a) * m(0.62), sy0 + Math.sin(a) * m(0.62)); g.stroke();
  // a thin rim light so the silhouette does not vanish into the sand
  g.strokeStyle = 'rgba(232,180,128,0.45)'; g.lineWidth = Math.max(0.8, m(0.035));
  g.beginPath(); g.moveTo(X0 - head * 0.6, gy - m(1.5) - head * 1.2);
  g.lineTo(X0 - head * 0.9, gy - m(0.9)); g.stroke();
  g.restore();
}
