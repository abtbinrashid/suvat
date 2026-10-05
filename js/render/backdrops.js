// backdrops.js — the two places that are not the stadium.
//
// A scenario that carries `backdrop` is drawn from here instead of from the
// stadium section. Everything is in METRES, like the rest of the app, so the
// scale bar and the height ruler mean the same thing in all three worlds.
//
// The palettes live here rather than in css/tokens.css. They are scenery, and
// scenery has exactly one job: to be legible without competing. So both sets
// are held to low chroma and a narrow lightness band, well clear of the five
// physics hues — orange velocity, cyan displacement, violet acceleration,
// magenta second object, green markers. If you can see the backdrop before you
// see the trajectory, the backdrop is wrong.

const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ══ palettes ═══════════════════════════════════════════════════════════
   Each is a complete set in both themes. Light is a working day; dark is the
   same place after hours — the warehouse on its night lighting, the beach at
   dusk. Nothing is merely inverted: the sand keeps its warmth and the steel
   keeps its coolness, because a beach that goes grey at night stops being a
   beach. */

const PALETTES = {
  warehouse: {
    light: {
      air: '#dcdcdd', airTop: '#cdd0d3',
      floor: '#c6c3bd', floorLine: 'rgba(40,40,44,0.16)', skirt: '#a8a7a3',
      wall: '#b6babe', rib: '#a3a8ad', panel: '#c0c4c8',
      steel: '#8e949b', steelDark: '#6f757c', truss: '#9aa0a7',
      door: '#9ba1a7', doorSlat: '#8b9197',
      rack: '#7f858c', crate: '#ab9070', crateDark: '#8e7557',
      lamp: '#fff6dd', lampGlow: 'rgba(255,246,221,0.30)',
      hazard: '#b08a2e', dust: 'rgba(255,255,255,0.07)',
      ink: 'rgba(32,33,36,0.55)',
    },
    dark: {
      air: '#171a1d', airTop: '#101316',
      floor: '#26272b', floorLine: 'rgba(255,255,255,0.10)', skirt: '#1b1c1f',
      wall: '#2c3136', rib: '#232830', panel: '#313740',
      steel: '#454b53', steelDark: '#2f343a', truss: '#3c424a',
      door: '#363c43', doorSlat: '#2a3037',
      rack: '#4a5058', crate: '#6a5540', crateDark: '#4e3f30',
      lamp: '#ffeeba', lampGlow: 'rgba(255,238,186,0.16)',
      hazard: '#8a6d24', dust: 'rgba(255,255,255,0.05)',
      ink: 'rgba(255,255,255,0.50)',
    },
  },
  beach: {
    light: {
      air: '#cfe7f2', airTop: '#9ec9e4',
      sun: '#fff3c4', sunGlow: 'rgba(255,243,196,0.42)',
      sea: '#5a9fa8', seaFar: '#7bb6bb', foam: '#e7f3f1',
      sand: '#ddc9a0', sandWet: '#c3ab80', sandLine: 'rgba(90,70,40,0.13)',
      trunk: '#7d6044', trunkDark: '#5f4731',
      frond: '#3b7f55', frondDark: '#2b6040', frondLight: '#4f9565',
      shrub: '#5d8a5a', rock: '#9a9288', shell: '#efe4cf',
      ink: 'rgba(42,36,26,0.55)',
    },
    dark: {
      air: '#15283b', airTop: '#0b1724',
      sun: '#ffd79a', sunGlow: 'rgba(255,215,154,0.20)',
      sea: '#15424b', seaFar: '#1b5059', foam: '#3d6f72',
      sand: '#453b2c', sandWet: '#342d22', sandLine: 'rgba(255,255,255,0.07)',
      trunk: '#3d2f22', trunkDark: '#2a2018',
      frond: '#1f4d33', frondDark: '#163827', frondLight: '#2a6342',
      shrub: '#24452c', rock: '#3a382f', shell: '#5a5244',
      ink: 'rgba(255,255,255,0.50)',
    },
  },
};

/**
 * The box each place wants kept in frame, in metres. A bullet dropping 1.6 m
 * over sixty metres fits the flight into a sliver and gives the rest of the
 * canvas to empty air; the shed around it is what makes the sliver legible.
 */
export const EXTENT = {
  warehouse: { x0: -8, x1: 30, yTop: 13.5 },
  beach:     { x0: -10, x1: 30, yTop: 17 },
};

export function backdropTones(id) {
  const set = PALETTES[id];
  if (!set) return null;
  return document.documentElement.dataset.theme === 'dark' ? set.dark : set.light;
}

/* ── small helpers ─────────────────────────────────────────────────────── */
const fillRect = (g, x0, y0, x1, y1, col) => {
  g.fillStyle = col;
  g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
};
const poly = (g, pts, col) => {
  if (pts.length < 3) return;
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.fillStyle = col; g.fill();
};
const line = (g, x0, y0, x1, y1, col, lw = 1) => {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
};
/** Deterministic jitter — the same plank is the same plank on every repaint. */
const rnd = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

/* ══ the warehouse ══════════════════════════════════════════════════════
   A test range at one end of a distribution shed. The point of the scenario
   is that two bullets land together, so the floor runs flat and unbroken for
   the whole flight and nothing is allowed to sit on it. */

const WH = {
  floorY: 0, eaves: 11, ridge: 13.5, gunWall: -6,
  back: -70,                    // runs well past the frame; the void is worse
  far: 150,                     // how far the shed runs
  bayStep: 7.5,                 // column spacing
  doorX: [96, 108], doorTop: 6.2,
  rackX: [34, 86], rackTop: 7.4, rackBays: 5,
};

function warehouse(g, tn, V) {
  const { sx, sy, w, h, span, moving } = V;
  const near = span < 70, mid = span < 260;

  // air, lit from the roof lights down
  const sky = g.createLinearGradient(0, sy(WH.ridge + 6), 0, sy(0));
  sky.addColorStop(0, tn.airTop); sky.addColorStop(1, tn.air);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  const Y0 = sy(0), YE = sy(WH.eaves), YR = sy(WH.ridge);
  const X = (u) => sx(u);

  // ── the shell: back wall, side wall, roof ───────────────────────────
  fillRect(g, X(WH.back), YE, X(WH.far), Y0, tn.wall);
  // corrugated ribs, dropped while panning because they are the expensive part
  if (!moving && span < 420) {
    const step = near ? 0.75 : mid ? 1.5 : 3;
    for (let u = WH.back; u <= WH.far; u += step) {
      line(g, X(u), YE, X(u), Y0, tn.rib, Math.max(0.6, 0.06 * V.scale));
    }
  }
  // a band of high windows, the only daylight in here
  const winY0 = sy(WH.eaves - 1.6), winY1 = sy(WH.eaves - 0.4);
  fillRect(g, X(WH.back), winY0, X(WH.far), winY1, tn.panel);

  // roof: a shallow pitch, drawn as one long slab
  poly(g, [{ x: X(WH.back), y: YE }, { x: X(WH.far), y: YE },
           { x: X(WH.far), y: YR }, { x: X(WH.back), y: YR }], tn.steelDark);

  // ── structure: columns and trusses on a 7.5 m grid ──────────────────
  const lw = Math.max(1.2, 0.22 * V.scale);
  for (let u = WH.back; u <= WH.far; u += WH.bayStep) {
    line(g, X(u), Y0, X(u), YE, tn.steel, lw);
    if (span < 320) {
      // a truss is a top chord, a bottom chord and a zigzag between them
      const top = sy(WH.eaves + 1.1);
      line(g, X(u), YE, X(u + WH.bayStep), YE, tn.truss, lw * 0.7);
      line(g, X(u), top, X(u + WH.bayStep), top, tn.truss, lw * 0.7);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a = u + (i / n) * WH.bayStep, b = u + ((i + 1) / n) * WH.bayStep;
        line(g, X(a), YE, X(b), top, tn.truss, lw * 0.5);
        line(g, X(b), top, X(b), YE, tn.truss, lw * 0.5);
      }
    }
    // the lamp hanging under every other truss
    if (span < 200 && Math.round((u - WH.back) / WH.bayStep) % 2 === 0) {
      const lx = X(u + WH.bayStep / 2), ly = sy(WH.eaves - 0.9);
      line(g, lx, YE, lx, ly, tn.steelDark, Math.max(0.8, 0.06 * V.scale));
      const r = Math.max(2, 0.45 * V.scale);
      g.beginPath(); g.arc(lx, ly, r, 0, Math.PI, false);
      g.fillStyle = tn.lamp; g.fill();
      if (span < 110) {
        const gl = g.createRadialGradient(lx, ly, r * 0.4, lx, ly, r * 9);
        gl.addColorStop(0, tn.lampGlow); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(lx, ly, r * 9, 0, Math.PI * 2); g.fill();
      }
    }
  }

  // the end wall behind the firing point
  line(g, X(WH.gunWall), Y0, X(WH.gunWall), YE, tn.steelDark, Math.max(1.6, 0.3 * V.scale));

  // ── the roller door, well past where anything lands ─────────────────
  const [d0, d1] = WH.doorX, YD = sy(WH.doorTop);
  fillRect(g, X(d0), YD, X(d1), Y0, tn.door);
  if (span < 260) {
    for (let y = 0.35; y < WH.doorTop; y += 0.55) {
      line(g, X(d0), sy(y), X(d1), sy(y), tn.doorSlat, Math.max(0.7, 0.05 * V.scale));
    }
  }

  // ── pallet racking along the back, so the depth reads ───────────────
  const [r0, r1] = WH.rackX, bayW = (r1 - r0) / WH.rackBays;
  for (let i = 0; i <= WH.rackBays; i++) line(g, X(r0 + i * bayW), Y0, X(r0 + i * bayW), sy(WH.rackTop), tn.rack, lw);
  for (let lvl = 1; lvl <= 3; lvl++) {
    const y = sy((WH.rackTop / 3) * lvl);
    line(g, X(r0), y, X(r1), y, tn.rack, lw * 0.9);
    if (span < 240) {
      for (let i = 0; i < WH.rackBays; i++) {
        if (rnd(i * 7 + lvl * 13) < 0.3) continue;            // some bays empty
        const bx = r0 + i * bayW + 0.35, bw = bayW - 0.7;
        const bh = (WH.rackTop / 3) * 0.72;
        fillRect(g, X(bx), y, X(bx + bw), sy((WH.rackTop / 3) * lvl + bh), tn.crate);
        line(g, X(bx + bw / 2), y, X(bx + bw / 2), sy((WH.rackTop / 3) * lvl + bh), tn.crateDark, lw * 0.6);
      }
    }
  }

  // ── floor ───────────────────────────────────────────────────────────
  fillRect(g, 0, Y0, w, h, tn.floor);
  fillRect(g, 0, Y0, w, sy(-0.18), tn.skirt);
  if (span < 300) {
    const step = near ? 2.5 : 5;                                // slab joints
    for (let u = Math.floor(WH.back / step) * step; u < WH.far + 40; u += step) {
      line(g, X(u), Y0, X(u), h, tn.floorLine, 1);
    }
  }
  // the hazard stripe that marks the range
  const hz = sy(-0.55);
  line(g, X(0), hz, X(WH.far), hz, tn.hazard, Math.max(1.4, 0.1 * V.scale));
}

/* ══ the beach ══════════════════════════════════════════════════════════
   Sea behind, sand underfoot, and a stand of palms for the monkey to sit in.
   The trees are placed off the flight line on purpose: nothing may be drawn
   between the hunter and the monkey, because the whole lesson is the straight
   line between them. */

const BE = {
  waterline: -0.02, horizon: 0.0,
  palms: [-7.5, -3.4, 46, 58, 72, 91],   // trunk positions, metres
};

function beach(g, tn, V) {
  const { sx, sy, w, h, span, moving } = V;
  const X = (u) => sx(u);
  const Y0 = sy(0);

  // sky
  const sky = g.createLinearGradient(0, 0, 0, Y0);
  sky.addColorStop(0, tn.airTop); sky.addColorStop(1, tn.air);
  g.fillStyle = sky; g.fillRect(0, 0, w, Math.max(0, Y0));

  // sun, low and to the left so the palms cast the right way
  const sunX = sx(-30), sunY = sy(34), sr = Math.max(6, 2.2 * V.scale);
  if (sunX > -sr * 10 && sunX < w + sr * 10) {
    const gl = g.createRadialGradient(sunX, sunY, sr * 0.3, sunX, sunY, sr * 7);
    gl.addColorStop(0, tn.sunGlow); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(sunX, sunY, sr * 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = tn.sun; g.beginPath(); g.arc(sunX, sunY, sr, 0, Math.PI * 2); g.fill();
  }

  // sea: a band behind the sand, with the far water paler
  const seaTop = sy(0.9), seaBot = sy(0.12);
  fillRect(g, 0, seaTop, w, seaBot, tn.seaFar);
  fillRect(g, 0, sy(0.55), w, seaBot, tn.sea);
  if (!moving && span < 320) {
    for (let i = 0; i < 70; i++) {
      const u = -60 + rnd(i) * 320, y = 0.14 + rnd(i + 99) * 0.4;
      const len = 0.8 + rnd(i + 31) * 2.4;
      line(g, X(u), sy(y), X(u + len), sy(y), tn.foam, Math.max(0.8, 0.05 * V.scale));
    }
  }
  // surf line
  line(g, 0, sy(0.1), w, sy(0.1), tn.foam, Math.max(1.4, 0.12 * V.scale));

  // sand
  fillRect(g, 0, Y0, w, h, tn.sand);
  fillRect(g, 0, Y0, w, sy(-0.5), tn.sandWet);
  if (!moving && span < 200) {
    for (let i = 0; i < 90; i++) {                      // ripples and shells
      const u = -60 + rnd(i + 7) * 320, y = -0.3 - rnd(i + 51) * 3.2;
      const len = 1.2 + rnd(i + 17) * 3;
      line(g, X(u), sy(y), X(u + len), sy(y), tn.sandLine, 1);
    }
    for (let i = 0; i < 16; i++) {
      const u = -40 + rnd(i + 3) * 260, y = -0.6 - rnd(i + 61) * 2.4;
      const r = Math.max(1, 0.1 * V.scale);
      g.fillStyle = tn.shell; g.beginPath(); g.arc(X(u), sy(y), r, 0, Math.PI * 2); g.fill();
    }
  }

  // palms
  for (let i = 0; i < BE.palms.length; i++) palm(g, tn, V, BE.palms[i], i);

  // a low scrub line at the back, to stop the sand reading as a void
  if (span < 400) {
    for (let i = 0; i < 40; i++) {
      const u = -70 + rnd(i + 23) * 340;
      const r = (0.5 + rnd(i + 5) * 0.9) * V.scale;
      g.fillStyle = tn.shrub;
      g.beginPath(); g.ellipse(X(u), sy(0.25), r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

/** One palm: a leaning trunk with a ring of fronds and a few coconuts. */
function palm(g, tn, V, u, seed) {
  const { sx, sy, span, scale } = V;
  const H = 11 + rnd(seed) * 5.5;                       // 11–16.5 m, a mature tree
  const lean = (rnd(seed + 9) - 0.5) * 3.2;
  const topX = sx(u + lean), topY = sy(H), botX = sx(u), botY = sy(0);
  const lw = Math.max(1.6, 0.42 * scale);

  // trunk, curved and tapering
  g.beginPath(); g.moveTo(botX, botY);
  g.quadraticCurveTo(sx(u + lean * 0.25), sy(H * 0.55), topX, topY);
  g.strokeStyle = tn.trunk; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
  if (span < 90) {                                      // ring scars
    for (let k = 0.1; k < 0.95; k += 0.09) {
      const tx = sx(u + lean * 0.25 * k * 2), ty = sy(H * k);
      line(g, tx - lw * 0.4, ty, tx + lw * 0.4, ty, tn.trunkDark, Math.max(0.7, 0.05 * scale));
    }
  }

  // fronds: eight ribs, each a drooping quadratic with a leaf body
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (-150 + (i * 300) / (n - 1) + (rnd(seed * 3 + i) - 0.5) * 16) * DEG;
    const L = (3.4 + rnd(seed + i) * 1.8) * scale;
    const ex = topX + Math.cos(a) * L, ey = topY + Math.sin(a) * L * 0.62 + L * 0.42;
    const mx = topX + Math.cos(a) * L * 0.55, my = topY + Math.sin(a) * L * 0.5 - L * 0.16;
    const tone = i % 3 === 0 ? tn.frondLight : i % 3 === 1 ? tn.frond : tn.frondDark;
    g.beginPath(); g.moveTo(topX, topY); g.quadraticCurveTo(mx, my, ex, ey);
    g.strokeStyle = tone; g.lineWidth = Math.max(1.4, 0.3 * scale); g.lineCap = 'round'; g.stroke();
    if (span < 120) {                                   // leaflets
      for (let k = 0.3; k < 1; k += 0.14) {
        const px = topX + (mx - topX) * 2 * k * (1 - k) + (ex - topX) * k * k;
        const py = topY + (my - topY) * 2 * k * (1 - k) + (ey - topY) * k * k;
        const s = 0.5 * scale * (1 - k * 0.5);
        line(g, px, py, px - Math.cos(a) * s * 0.4, py + s, tone, Math.max(0.7, 0.08 * scale));
      }
    }
  }
  // coconuts
  if (span < 140) {
    for (let i = 0; i < 3; i++) {
      const r = Math.max(1.4, 0.26 * scale);
      g.fillStyle = tn.trunkDark;
      g.beginPath(); g.arc(topX + (i - 1) * r * 1.9, topY + r * 1.4, r, 0, Math.PI * 2); g.fill();
    }
  }
}

/* ══ entry point ════════════════════════════════════════════════════════ */

const DRAW = { warehouse, beach };

/**
 * @param id    'warehouse' | 'beach'
 * @param view  { ctx, w, h, sx, sy, scale, span, moving }  sx/sy take METRES
 */
export function drawBackdrop(id, view) {
  const fn = DRAW[id];
  const tn = backdropTones(id);
  if (!fn || !tn) return false;
  const g = view.ctx;
  g.save();
  fn(g, tn, view);
  g.restore();
  return true;
}

/* ══ props ══════════════════════════════════════════════════════════════
   Drawn live rather than into the cached layer, because the muzzle flash and
   the monkey both move. They are cheap: a rifle, a figure and an animal.

   Everything here is to scale. The rifle is 1.1 m, the hunter 1.8 m and the
   monkey 0.5 m, so if the ball looks tiny beside them, that is because a
   football IS tiny beside them. */

const PROPS = {};

/** A rifle on a bench rest, with the drop clamp beside it. */
PROPS.warehouse = (g, tn, V, o) => {
  const { sx, sy, scale } = V;
  const h = o.launchY, X0 = sx(0), Y0 = sy(h);
  const m = (v) => v * scale;                            // metres → pixels

  // bench: a post up from the floor to the barrel line
  g.fillStyle = tn.steelDark;
  g.fillRect(X0 - m(0.18), Y0, m(0.36), sy(0) - Y0);
  g.fillRect(X0 - m(0.55), sy(0) - m(0.12), m(1.1), m(0.12));

  // barrel and receiver, pointing along +x
  g.fillStyle = tn.steel;
  g.fillRect(X0 - m(0.75), Y0 - m(0.045), m(0.95), m(0.09));   // barrel
  g.fillStyle = tn.steelDark;
  g.fillRect(X0 - m(1.05), Y0 - m(0.11), m(0.34), m(0.22));    // receiver
  g.beginPath();                                               // stock
  g.moveTo(X0 - m(1.05), Y0 - m(0.1));
  g.lineTo(X0 - m(1.55), Y0 + m(0.16));
  g.lineTo(X0 - m(1.5), Y0 + m(0.3));
  g.lineTo(X0 - m(1.0), Y0 + m(0.11));
  g.closePath(); g.fillStyle = tn.crateDark; g.fill();

  // the clamp that lets the second bullet go, directly above the muzzle line
  g.strokeStyle = tn.steel; g.lineWidth = Math.max(1.2, m(0.05));
  g.beginPath();
  g.moveTo(X0, Y0 - m(0.9)); g.lineTo(X0, Y0 - m(0.16));
  g.stroke();
  g.fillStyle = tn.steelDark;
  g.fillRect(X0 - m(0.16), Y0 - m(1.0), m(0.32), m(0.12));

  // The round that was released rather than fired, drawn where it is now.
  if (o.secondNow) {
    const bx = sx(o.secondNow.x), by = sy(o.secondNow.y);
    g.fillStyle = tn.hazard;
    g.fillRect(bx - m(0.03), by - m(0.07), m(0.06), m(0.14));
    ring(g, bx, by, m(0.07), tn.ink);
  }

  // MUZZLE FLASH. Three frames' worth, then gone — long enough to read as a
  // shot, short enough that it never competes with the trajectory.
  if (o.fired && o.t < 0.14) {
    const k = 1 - o.t / 0.14;
    const r = m(0.18) + m(0.55) * k;
    g.save(); g.globalAlpha = k;
    const gl = g.createRadialGradient(X0 + m(0.22), Y0, 0, X0 + m(0.22), Y0, r * 3);
    gl.addColorStop(0, tn.lamp); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(X0 + m(0.22), Y0, r * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = tn.lamp;
    g.beginPath();
    for (let i = 0; i < 10; i++) {                       // a ragged star
      const a = (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r * 0.42 : r * (0.8 + rnd(i) * 0.5);
      const px = X0 + m(0.22) + Math.cos(a) * rr * 1.5, py = Y0 + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill(); g.restore();
  }
};

/** The hunter, and the monkey that lets go the moment the shot is fired. */
PROPS.beach = (g, tn, V, o) => {
  const { sx, sy, scale } = V;
  const m = (v) => v * scale;
  const X0 = sx(0), Yg = sy(0), Y0 = sy(o.launchY);

  /* ── the hunter: 1.8 m, aiming along the launch angle ─────────────── */
  const a = -(o.theta || 0) * DEG;                       // screen y grows down
  const hipY = Yg - m(0.95), headR = m(0.115);
  g.strokeStyle = tn.ink; g.lineWidth = Math.max(1.6, m(0.1)); g.lineCap = 'round';
  g.beginPath();                                          // legs
  g.moveTo(X0 - m(0.22), Yg); g.lineTo(X0, hipY); g.lineTo(X0 + m(0.2), Yg);
  g.moveTo(X0, hipY); g.lineTo(X0, Yg - m(1.52));         // torso
  g.stroke();
  g.fillStyle = tn.ink;
  g.beginPath(); g.arc(X0, Yg - m(1.52) - headR, headR, 0, Math.PI * 2); g.fill();

  // the launcher, lying along the aim line out of the shoulder
  const sX = X0, sY = Yg - m(1.4);
  const L = m(1.0);
  g.strokeStyle = tn.trunkDark; g.lineWidth = Math.max(1.8, m(0.08));
  g.beginPath(); g.moveTo(sX - Math.cos(a) * m(0.25), sY - Math.sin(a) * m(0.25));
  g.lineTo(sX + Math.cos(a) * L, sY + Math.sin(a) * L); g.stroke();
  g.strokeStyle = tn.ink; g.lineWidth = Math.max(1.4, m(0.07));
  g.beginPath();                                          // arms to the launcher
  g.moveTo(X0, Yg - m(1.35));
  g.lineTo(sX + Math.cos(a) * m(0.62), sY + Math.sin(a) * m(0.62));
  g.stroke();

  // the aim line, dead straight at the monkey — the whole lesson in one dash
  if (o.monkey && !o.fired) {
    g.save(); g.setLineDash([m(0.55), m(0.45)]);
    g.strokeStyle = tn.ink; g.lineWidth = Math.max(1, m(0.04)); g.globalAlpha = 0.65;
    g.beginPath(); g.moveTo(X0, Y0); g.lineTo(sx(o.monkey.x), sy(o.monkey.y)); g.stroke();
    g.restore();
  }

  /* ── the monkey ───────────────────────────────────────────────────── */
  if (!o.monkey) return;
  const pos = o.monkeyNow || o.monkey;
  const mx = sx(pos.x), my = sy(pos.y);
  // the branch it was hanging from stays where it was
  if (!o.fired || o.t < 0.05) {
    line(g, sx(o.monkey.x) - m(1.1), sy(o.monkey.y) + m(0.12),
            sx(o.monkey.x) + m(0.7), sy(o.monkey.y) + m(0.02), tn.trunk, Math.max(1.4, m(0.09)));
  }
  monkey(g, tn, mx, my, m, o.fired && o.t > 0.05);
  ring(g, mx, my - m(0.18), m(0.45), tn.ink);
}

/**
 * A thin ring, drawn only when the thing inside it is too small to find. The
 * prop keeps its true size — 0.5 m of monkey stays 0.5 m — and the ring grows
 * to a readable minimum instead, which is the same device the ball uses.
 */
function ring(g, x, y, r, col) {
  const R = Math.max(r, 9);
  if (R <= r * 1.05) return;
  g.save(); g.globalAlpha = 0.55; g.strokeStyle = col; g.lineWidth = 1.4;
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke(); g.restore();
};

/** 0.5 m of monkey: body, head, limbs, tail. Arms up until it lets go. */
function monkey(g, tn, x, y, m, falling) {
  const body = m(0.16), head = m(0.11);
  g.save();
  g.fillStyle = tn.trunkDark;
  g.beginPath(); g.ellipse(x, y, body * 0.8, body, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x, y - body - head * 0.7, head, 0, Math.PI * 2); g.fill();
  // ears
  g.beginPath(); g.arc(x - head * 0.95, y - body - head * 0.8, head * 0.42, 0, Math.PI * 2);
  g.arc(x + head * 0.95, y - body - head * 0.8, head * 0.42, 0, Math.PI * 2); g.fill();
  // face
  g.fillStyle = tn.sand;
  g.beginPath(); g.ellipse(x, y - body - head * 0.55, head * 0.62, head * 0.5, 0, 0, Math.PI * 2); g.fill();

  g.strokeStyle = tn.trunkDark; g.lineWidth = Math.max(1.3, m(0.045)); g.lineCap = 'round';
  const up = falling ? 1 : -1;                   // arms shoot up as it drops
  g.beginPath();
  g.moveTo(x - body * 0.6, y - body * 0.3); g.lineTo(x - body * 1.7, y + up * body * 1.2);
  g.moveTo(x + body * 0.6, y - body * 0.3); g.lineTo(x + body * 1.7, y + up * body * 1.2);
  g.moveTo(x - body * 0.4, y + body * 0.8); g.lineTo(x - body * 0.9, y + body * 1.9);
  g.moveTo(x + body * 0.4, y + body * 0.8); g.lineTo(x + body * 0.9, y + body * 1.9);
  g.stroke();
  // tail
  g.beginPath(); g.moveTo(x + body * 0.7, y + body * 0.5);
  g.quadraticCurveTo(x + body * 2.4, y + body * (falling ? 1.6 : 0.2), x + body * 2.1, y - body * (falling ? 0.2 : 1.4));
  g.stroke();
  g.restore();
}

/**
 * @param o { t, fired, theta, launchY, monkey, monkeyNow }
 *   monkey    where it started, in metres
 *   monkeyNow where it is now — the second object's position
 */
export function drawProps(id, view, o) {
  const fn = PROPS[id];
  const tn = backdropTones(id);
  if (!fn || !tn) return false;
  view.ctx.save();
  fn(view.ctx, tn, view, o);
  view.ctx.restore();
  return true;
}
