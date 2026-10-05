// world3d.js — the same stadium, extruded instead of cut.
//
// WHY NOT WebGL.  The decision turns on one fact: the camera is fixed during
// a flight. Everything expensive in this scene — the bowl, the roof, the
// district — is static, so it is projected once into an offscreen bitmap and
// blitted every frame after that. What actually runs per frame is the ball,
// its trail and a dozen arrows: tens of draw calls, not thousands. WebGL
// would buy fast re-projection we only need while someone is dragging the
// camera, and would cost a shader pipeline, a second colour path for the
// theme tokens, and a context that can be lost. So the hand-written
// projection stays, and gets what it was missing: polygon clipping, a
// painter's-algorithm depth sort, back-face culling, flat shading and LOD.
//
// The budget: ~2600 faces at full detail, ~700 while the camera is moving.

import { cssVar, clamp, stroke, fmt } from './util.js';
import { world } from '../world/world.js';
import { D, tierSteps } from '../world/dims.js';
import { tones, fade, zoomBand } from './world2d.js';

/* ── colour, so faces can be shaded ─────────────────────────────────── */
const rgbCache = new Map();
function toRGB(c) {
  if (rgbCache.has(c)) return rgbCache.get(c);
  let out = [128, 128, 128, 1];
  if (c.startsWith('#')) {
    const x = c.slice(1);
    const n = x.length === 3 ? x.split('').map((d) => parseInt(d + d, 16)) : [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
    out = [n[0], n[1], n[2], 1];
  } else {
    const m = c.match(/-?[\d.]+/g);
    if (m) out = [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1];
  }
  rgbCache.set(c, out);
  return out;
}
/** Flat shading. k below 1 darkens, above 1 lifts. */
function shade(c, k, alpha = 1) {
  const [r, g, b, a] = toRGB(c);
  const f = (v) => Math.round(clamp(v * k, 0, 255));
  return `rgba(${f(r)},${f(g)},${f(b)},${(a * alpha).toFixed(3)})`;
}

/* TWO LIGHTS, because one makes everything a shade of the same grey. A warm
   key from the low sun and a cool fill from the sky: a surface turned to the
   sun goes warm, a surface turned away goes blue, and the difference between
   them is what gives a grey building its form. */
const tintCache = new Map();
/** A tint normalised to mean 1, so it shifts hue and never brightness. */
function tintOf(c) {
  if (tintCache.has(c)) return tintCache.get(c);
  const [r, g, b] = toRGB(c);
  const m = (r + g + b) / 3 || 1;
  const t = [r / m, g / m, b / m];
  tintCache.set(c, t);
  return t;
}
// A shadowed face is lit by the sky, not black. At night there is far less
// sky-light to go round, so the bowl sits back and the lit pitch wins.
let AMB = 0.56, KEY = 0.56;
export function setExposure(amb, key) { AMB = amb; KEY = key; }

function light2(c, kKey, kFill, warm, cool, alpha = 1) {
  const [r, g, b, a] = toRGB(c);
  const W = tintOf(warm), C = tintOf(cool);
  const key = KEY * clamp(kKey, 0, 1);
  const amb = AMB * (0.72 + 0.28 * clamp(kFill, 0, 1));
  const ch = (base, i) => Math.round(clamp(base * (amb * C[i] + key * W[i]), 0, 255));
  return `rgba(${ch(r, 0)},${ch(g, 1)},${ch(b, 2)},${(a * alpha).toFixed(3)})`;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const nrm = (a) => { const L = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; };

/* ── the face list ──────────────────────────────────────────────────── */
class Faces {
  constructor(V, w, h, light, opt = {}) {
    this.V = V; this.w = w; this.h = h; this.light = light;
    this.warm = opt.warm || '#ffffff'; this.cool = opt.cool || '#ffffff';
    this.xray = opt.xray || 0;              // depth inside which faces go glassy
    this.q = []; this.g = [];
  }
  /** Add one convex polygon, given in world coordinates. */
  add(pts, tone, { cull = true, lift = 0, alpha = 1, line = null, lw = 1, flat = false, back = null, ground = false } = {}) {
    if (pts.length < 3) return;
    let n = nrm(crs(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    const toEye = sub(this.V.eye, pts[0]);
    const facing = n.x * toEye.x + n.y * toEye.y + n.z * toEye.z;
    if (cull && facing < 0) return;
    // A stand seen from inside is seating; the same surface seen from outside
    // is the back of the stand. One quad, two materials — which is also what
    // stops the bowl reading as a smooth funnel.
    if (facing < 0) { n = { x: -n.x, y: -n.y, z: -n.z }; if (back) tone = back; }
    const scr = this.V.clipPoly(pts);
    if (!scr || scr.length < 3) return;
    // Sort on the CENTROID depth, not the far corner. A long roof strip runs
    // fifty metres away from the camera, so its far corner makes it sort as
    // though the whole strip were distant — and the stand underneath it then
    // paints straight over the top. Long pieces are also subdivided; between
    // them that is what keeps the painter's algorithm honest here.
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, depth = 0, minZ = 1e9;
    for (const p of scr) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      depth += p.z;
    }
    depth /= scr.length;
    if (maxX < -4 || minX > this.w + 4 || maxY < -4 || minY > this.h + 4) return;
    // A face the camera is practically inside projects to something the size
    // of a county and swallows the frame. Every piece of this scene is
    // subdivided, so a legitimately visible face is never both that close and
    // that large; one that is, is a clipping artefact.
    if (minZ < 1.6 && (maxX - minX > this.w * 2.2 || maxY - minY > this.h * 2.2)) return;
    if (maxX - minX < 0.35 && maxY - minY < 0.35) return;
    // key from the sun, fill from the sky dome straight up
    const nk = Math.max(0, n.x * this.light.x + n.y * this.light.y + n.z * this.light.z);
    const nf = 0.5 + 0.5 * n.y;
    let a2 = alpha;
    // SEE THROUGH THE NEAR WALL. A camera inside the bowl has a stand between
    // it and the pitch; making that stand glassy shows the pitch AND the
    // building, which is what you want from a cutaway and what a solid wall
    // can never give you.
    if (this.xray && depth < this.xray) {
      // Several layers stack between the eye and the pitch — facade, rake,
      // roof skin, roof soffit — so each one has to be very light for the
      // pitch to survive all four of them.
      a2 *= clamp(0.13 + 0.87 * (depth / this.xray) ** 1.45, 0.13, 1);
    }
    const fill = flat
      ? shade(tone, 1 + lift, a2)
      : light2(tone, nk + lift, nf, this.warm, this.cool, a2);
    const face = { scr, fill, line, lw, depth };
    if (ground) this.g.push(face); else this.q.push(face);
  }
  /** A line in space — cables, kerbs, pitch markings. */
  addLine(pts, tone, lw = 1.4, alpha = 1, ground = false) {
    for (const run of this.V.polyline(pts)) {
      let depth = 0;
      for (const p of run) depth += p.z;
      depth = depth / run.length - 0.6;              // a hair in front of its surface
      (ground ? this.g : this.q).push({ scr: run, open: true, line: shade(tone, 1, alpha), lw, depth });
    }
  }
  draw(ctx) {
    // Ground first, in a fixed big-to-small order. Every flat surface sits at
    // the same height, so depth-sorting them against each other is a coin
    // toss; everything with height sits ON them, so order settles it instead.
    this.q.sort((a, b) => b.depth - a.depth);
    for (const f of this.g.concat(this.q)) {
      ctx.beginPath();
      ctx.moveTo(f.scr[0].x, f.scr[0].y);
      for (let i = 1; i < f.scr.length; i++) ctx.lineTo(f.scr[i].x, f.scr[i].y);
      if (!f.open) {
        ctx.closePath();
        ctx.fillStyle = f.fill; ctx.fill();
      }
      if (f.line) { ctx.strokeStyle = f.line; ctx.lineWidth = f.lw; ctx.lineJoin = 'round'; ctx.stroke(); }
    }
    return this.q.length;
  }
}

const quad = (a, b, c, d) => [a, b, c, d];
const CAR_TONES = ['carA', 'carB', 'carC', 'carD', 'carE'];
const carTone = (tn, v) => tn[CAR_TONES[Math.floor((v || 0) * CAR_TONES.length) % CAR_TONES.length]] || tn.prop;
const wallTone = (tn, h) => [tn.brick, tn.render, tn.brick, tn.panel][h % 4];
const P = (x, y, z) => ({ x, y, z });

/* A quad longer than this gets split. Painter's algorithm orders whole
   polygons, so one 280 m slab can sort "far" on its centroid and still have a
   near end that paints over a building — which is exactly how the podium
   came to be drawn across the far side of the bowl. */
const MAX_QUAD = 45;

/** Add a quad, subdividing it until no piece is big enough to break the sort. */
function bigQuad(F, a, b, c, d, tone, opts) {
  const len = Math.max(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
                       Math.hypot(d.x - a.x, d.y - a.y, d.z - a.z));
  const n = clamp(Math.ceil(len / MAX_QUAD), 1, 12);
  if (n === 1) { F.add(quad(a, b, c, d), tone, opts); return; }
  const lerp = (p, q, t) => P(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, p.z + (q.z - p.z) * t);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t0 = i / n, t1 = (i + 1) / n, u0 = j / n, u1 = (j + 1) / n;
      const e0 = lerp(lerp(a, b, t0), lerp(d, c, t0), u0);
      const e1 = lerp(lerp(a, b, t1), lerp(d, c, t1), u0);
      const e2 = lerp(lerp(a, b, t1), lerp(d, c, t1), u1);
      const e3 = lerp(lerp(a, b, t0), lerp(d, c, t0), u1);
      F.add(quad(e0, e1, e2, e3), tone, opts);
    }
  }
}

/** The five visible faces of an axis-aligned box. */
function boxFaces(F, s, tone, alpha = 1, noTop = false) {
  const { x0, x1, z0, z1, y0, y1 } = s;
  if (!noTop) bigQuad(F, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), tone, { cull: false, lift: 0.1, alpha });
  bigQuad(F, P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), tone, { alpha });
  bigQuad(F, P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), tone, { alpha });
  bigQuad(F, P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), tone, { alpha });
  bigQuad(F, P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), tone, { alpha });
}

/** A terraced row: two pitched planes and two gable ends. */
/** A terraced row: two pitched planes, two gable ends, and — because a row is
    not one building — a party-wall rhythm at the real 5.5 m frontage. */
function ridgeFaces(F, s, tone, roofTone, alpha = 1, detail = true) {
  const { x0, x1, z0, z1, y1 } = s, e = s.eaves;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  boxFaces(F, { ...s, y1: e }, tone, alpha);
  if (s.ridge === 'x') {                            // ridge runs along x
    bigQuad(F, P(x0, e, z0), P(x1, e, z0), P(x1, y1, mz), P(x0, y1, mz), roofTone, { cull: false, alpha });
    bigQuad(F, P(x1, e, z1), P(x0, e, z1), P(x0, y1, mz), P(x1, y1, mz), roofTone, { cull: false, alpha });
    F.add([P(x0, e, z0), P(x0, y1, mz), P(x0, e, z1)], tone, { alpha });
    F.add([P(x1, e, z1), P(x1, y1, mz), P(x1, e, z0)], tone, { alpha });
  } else {
    bigQuad(F, P(x0, e, z0), P(x0, e, z1), P(mx, y1, z1), P(mx, y1, z0), roofTone, { cull: false, alpha });
    bigQuad(F, P(x1, e, z1), P(x1, e, z0), P(mx, y1, z0), P(mx, y1, z1), roofTone, { cull: false, alpha });
    F.add([P(x0, e, z0), P(mx, y1, z0), P(x1, e, z0)], tone, { alpha });
    F.add([P(x1, e, z1), P(mx, y1, z1), P(x0, e, z1)], tone, { alpha });
  }
  if (!detail) return;
  // the party walls: a 600 m ribbon of roof with no joints reads as a furrow
  const along = s.ridge === 'x' ? 'x' : 'z';
  const a0 = along === 'x' ? x0 : z0, a1 = along === 'x' ? x1 : z1;
  const n = Math.round(Math.abs(a1 - a0) / D.house.front);
  if (n < 2 || n > 220) return;
  for (let i = 1; i < n; i++) {
    const v = a0 + ((a1 - a0) * i) / n;
    const p = along === 'x'
      ? [P(v, e, z0), P(v, y1, mz), P(v, e, z1)]
      : [P(x0, e, v), P(mx, y1, v), P(x1, e, v)];
    F.addLine(p, tone, 1, 0.5 * alpha);
  }
}

/* ── the bowl, as a surface over (angle, outward distance) ──────────────
   The plan is a rounded rectangle; offsetting it outward by d gives another
   rounded rectangle with every radius larger by d, which is what makes the
   bowl generable at all. Each of the four sides contributes its own section,
   and the corners blend smoothly between the two sides they join — exactly
   what the corner infill of a real bowl does. */

const FRONT_L = D.bowl.frontL, FRONT_W = D.bowl.frontW, FRONT_R = D.bowl.frontR;

/** How far the bowl's plan reaches in direction (ca, sa), d metres outward
    from the front row. One function, used by the stands AND by the roof. */
export function planRadius(ca, sa, d) {
  const hl = FRONT_L + d, hw = FRONT_W + d, r = FRONT_R + d;
  let lo = 0, hi = Math.hypot(hl, hw) + 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2, x = ca * m, z = sa * m;
    const qx = Math.max(Math.abs(x) - (hl - r), 0), qz = Math.max(Math.abs(z) - (hw - r), 0);
    const sd = Math.hypot(qx, qz) + Math.min(Math.max(qx, qz), 0) - r;
    if (sd < 0) lo = m; else hi = m;
  }
  return lo;
}

function envelope(spec, n = 42) {
  // the upper surface of one side, resampled as height against distance
  const out = [];
  for (let i = 0; i <= n; i++) {
    const d = (spec.out * i) / n;
    let y = 0;
    for (const el of spec.el) {
      if (d < Math.min(el.d0, el.d1) - 1e-9 || d > Math.max(el.d0, el.d1) + 1e-9) continue;
      const k = Math.abs(el.d1 - el.d0) < 1e-9 ? 0 : (d - el.d0) / (el.d1 - el.d0);
      y = Math.max(y, el.y0 + (el.y1 - el.y0) * k);
    }
    out.push(y);
  }
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);

function bowlSurface(F, tn, detail) {
  // While the camera travels, the bowl is a massing model. Sixty frames a
  // second of a coarse stadium beats twelve frames a second of a fine one.
  const NT = detail ? 84 : 30, ND = detail ? 26 : 9;
  const envNS = envelope(D.sides.NS, ND), envW = envelope(D.sides.W, ND), envE = envelope(D.sides.E, ND);
  const outNS = D.sides.NS.out, outW = D.sides.W.out, outE = D.sides.E.out;

  // plan point and its blended section at parameter t around the bowl
  const at = (t, d) => {
    const a = t * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const r = planRadius(ca, sa, d);
    return { x: ca * r, z: sa * r };
  };

  // which side owns this angle, and how much
  const sideMix = (t) => {
    const a = t * Math.PI * 2;
    const x = Math.cos(a) * FRONT_L, z = Math.sin(a) * FRONT_W;
    const ax = Math.abs(x) / FRONT_L, az = Math.abs(z) / FRONT_W;
    const wEW = smooth(clamp((ax - 0.52) / 0.42, 0, 1));
    const wNS = smooth(clamp((az - 0.52) / 0.42, 0, 1));
    const tot = wEW + wNS || 1;
    return { ew: (x >= 0 ? 'E' : 'W'), kEW: wEW / tot, kNS: wNS / tot };
  };

  const envAt = (t) => {
    const m = sideMix(t);
    const e = m.ew === 'E' ? envE : envW;
    const o = m.ew === 'E' ? outE : outW;
    return { env: (i) => e[i] * m.kEW + envNS[i] * m.kNS, out: o * m.kEW + outNS * m.kNS };
  };

  const grid = [];
  for (let i = 0; i <= NT; i++) {
    const t = i / NT, E = envAt(t), col = [];
    for (let j = 0; j <= ND; j++) {
      const d = (E.out * j) / ND;
      const p = at(t, d);
      col.push(P(p.x, E.env(j), p.z));
    }
    grid.push(col);
  }
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < ND; j++) {
      const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d2 = grid[i][j + 1];
      // the raking surface, tinted as seating where it is actually raked
      const rise = Math.abs(d2.y - a.y), run = Math.hypot(d2.x - a.x, d2.z - a.z);
      const seated = run > 0.2 && rise / run > 0.28;
      // A bowl of 55 000 people is not one flat tone. Each quad covers a few
      // rows, so it takes a deterministic nudge in value: from a distance
      // that is exactly what a crowd looks like, and it costs nothing.
      let hsh = (i * 374761393 + j * 668265263) | 0;
      hsh = (hsh ^ (hsh >>> 13)) * 1274126177 | 0;
      const r01 = (((hsh ^ (hsh >>> 16)) >>> 0) % 1000) / 1000;
      // Two seat greys in soft bands, never a club's colours — and a speckle
      // on top, because a full stand is not a flat surface.
      // Two seat greys in broad horizontal bands — never a club's colours —
      // with a whisper of speckle so a full stand is not a flat surface.
      const seatTone = seated ? (j % 14 < 5 ? tn.seatHi : tn.seat) : tn.concrete;
      F.add(quad(a, b, c, d2), seatTone,
            { cull: false, back: seated ? tn.structure : tn.structureDark, lift: (r01 - 0.5) * 0.035 });
    }
    // Wherever the section jumps — the void between one tier's back and the
    // next tier's front — the surface gets a vertical face instead of a ramp.
    for (let j = 0; j < ND; j++) {
      const a = grid[i][j], d2 = grid[i][j + 1], b = grid[i + 1][j], c = grid[i + 1][j + 1];
      if (Math.abs(d2.y - a.y) < 2.2) continue;
      F.add(quad(P(a.x, a.y, a.z), P(b.x, b.y, b.z), P(c.x, c.y, c.z), P(d2.x, d2.y, d2.z)),
            tn.structureDark, { cull: false, back: tn.concrete });
    }
    // the front face down to the pitch, and the rear wall down to the ground
    const f0 = grid[i][0], f1 = grid[i + 1][0];
    F.add(quad(P(f0.x, 0, f0.z), P(f1.x, 0, f1.z), f1, f0), tn.structureDark,
          { cull: false, back: tn.concrete });
    // The OUTSIDE of the stadium is a facade, not poché: the dark tone is for
    // cut material in the section drawing, and using it here turned the
    // building into a black drum.
    const r0 = grid[i][ND], r1 = grid[i + 1][ND];
    F.add(quad(r1, r0, P(r0.x, 0, r0.z), P(r1.x, 0, r1.z)), tn.concrete,
          { cull: false, back: tn.structure });
  }
}

/* ── the roof ───────────────────────────────────────────────────────── */
function roof3D(F, tn, detail) {
  const R = D.roof, B = D.bowl;
  const N = detail ? 72 : 30;
  const inner = [], outer = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const ri = planRadius(ca, sa, -R.ringInset);
    inner.push(P(ri * ca, R.ringTop, ri * sa));
    // The outer edge is the SAME offset rounded rectangle the bowl itself is
    // built from. Generated from a different one, the roof and the stands
    // missed each other in the corners and the district showed through.
    outer.push(P(ca * planRadius(ca, sa, B.depth), R.outerStructure, sa * planRadius(ca, sa, B.depth)));
  }
  const RINGS = detail ? 7 : 2;
  const lerpP = (a, b, t, y0, y1) => P(a.x + (b.x - a.x) * t, y0 + (y1 - y0) * t, a.z + (b.z - a.z) * t);
  for (let i = 0; i < N; i++) {
    const a = inner[i], b = inner[i + 1], c = outer[i + 1], d = outer[i];
    for (let k = 0; k < RINGS; k++) {
      const t0 = k / RINGS, t1 = (k + 1) / RINGS;
      F.add(quad(lerpP(a, d, t0, R.ringTop, R.outerStructure), lerpP(b, c, t0, R.ringTop, R.outerStructure),
                 lerpP(b, c, t1, R.ringTop, R.outerStructure), lerpP(a, d, t1, R.ringTop, R.outerStructure)),
            tn.roofTop, { cull: false });
      F.add(quad(lerpP(a, d, t0, R.ringBottom, R.fasciaBottom), lerpP(a, d, t1, R.ringBottom, R.fasciaBottom),
                 lerpP(b, c, t1, R.ringBottom, R.fasciaBottom), lerpP(b, c, t0, R.ringBottom, R.fasciaBottom)),
            tn.roofUnder, { cull: false });
    }
    // the fascia blade: its top edge at 48 m is the highest thing in the world
    F.add(quad(P(d.x, R.fasciaTop, d.z), P(c.x, R.fasciaTop, c.z),
               P(c.x, R.fasciaBottom, c.z), P(d.x, R.fasciaBottom, d.z)), tn.roofTop, { cull: false, lift: 0.08 });
    // the compression ring
    F.add(quad(P(a.x, R.ringTop, a.z), P(b.x, R.ringTop, b.z),
               P(b.x, R.ringBottom, b.z), P(a.x, R.ringBottom, a.z)), tn.metal, { cull: false });
  }
  if (detail) {
    const step = Math.max(1, Math.round(N / R.radialCables));
    for (let i = 0; i < N; i += step) {
      F.addLine([P(inner[i].x, R.ringBottom, inner[i].z), P(outer[i].x, R.fasciaBottom, outer[i].z)], tn.metal, 1.1, 0.8);
    }
    for (let i = 0; i < N; i += Math.max(1, Math.round(N / 72))) {
      F.addLine([P(inner[i].x, R.ringTop + 0.06, inner[i].z),
                 P(outer[i].x, R.outerStructure + 0.06, outer[i].z)], tn.structureDark, 1.4, 0.5);
    }
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, ring = [];
      for (let i = 0; i <= N; i++) {
        ring.push(P(inner[i].x + (outer[i].x - inner[i].x) * t,
                    R.ringTop + (R.outerStructure - R.ringTop) * t + 0.05,
                    inner[i].z + (outer[i].z - inner[i].z) * t));
      }
      F.addLine(ring, tn.metal, 1, 0.3);
    }
    for (let k = 1; k <= R.hoopCables; k++) {
      const t = k / (R.hoopCables + 1), ring = [];
      for (let i = 0; i <= N; i++) {
        ring.push(P(inner[i].x + (outer[i].x - inner[i].x) * t,
                    R.ringBottom + (R.fasciaBottom - R.ringBottom) * t,
                    inner[i].z + (outer[i].z - inner[i].z) * t));
      }
      F.addLine(ring, tn.metal, 1, 0.55);
    }
    // floodlighting, as a bright ring under the compression ring
    const lit = inner.map((p) => P(p.x, R.lightStripY, p.z));
    F.addLine(lit, tn.flood, 3, 0.9);
  }
}

/* ── the whole scenery pass ─────────────────────────────────────────── */
export function drawScenery3D(ctx, V, { w, h, span, detail = true, xray = 0 }) {
  const tn = tones();
  const dark = (document.documentElement.dataset.theme || 'dark') !== 'light';
  // A low western sun by day; a near-vertical floodlit wash by night.
  const light = nrm(dark ? { x: 0.08, y: 1, z: 0.14 } : { x: -0.74, y: 0.42, z: 0.28 });
  setExposure(dark ? 0.34 : 0.56, dark ? 0.44 : 0.56);
  const F = new Faces(V, w, h, light, {
    warm: dark ? '#dde4ee' : '#ffe6c8',
    cool: dark ? '#8da2c4' : '#aac6e6',
    xray,
  });
  const Wd = world();

  /* ground, from the far district inwards so near things land on top */
  const order = Wd.ground.slice().sort((a, b) => area(b) - area(a));
  for (const g of order) {
    if (!detail && area(g) < 3000 && g.tag !== 'pitch') continue;   // coarse while travelling
    tile(F, g.x0, g.x1, g.z0, g.z1, g.y, tn[g.tone] || tn.ground);
  }

  /* pitch markings */
  if (fade(span, D.lod.pitchLines) > 0) {
    for (const m of Wd.paint) {
      const tone = tn[m.tone] || tn.pitchline;
      if (m.kind === 'line' || m.kind === 'dashed') {
        const a = m.axis === 'x' ? [P(m.a[0], 0.02, m.p), P(m.a[1], 0.02, m.p)] : [P(m.p, 0.02, m.a[0]), P(m.p, 0.02, m.a[1])];
        F.addLine(a, tone, Math.max(1, m.w * V.f / Math.max(20, V.distTo(a[0]))), 0.95, true);
      } else if (m.kind === 'circle' || m.kind === 'arc') {
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const ang = (i / 48) * Math.PI * 2;
          const x = m.x + m.r * Math.cos(ang), z = m.z + m.r * Math.sin(ang);
          if (m.clipX && ((m.clipX.max != null && x > m.clipX.max) || (m.clipX.min != null && x < m.clipX.min))) { if (pts.length > 1) F.addLine(pts.slice(), tone, 1.6, 0.95, true); pts.length = 0; continue; }
          pts.push(P(x, 0.02, z));
        }
        if (pts.length > 1) F.addLine(pts, tone, 1.6, 0.95, true);
      }
    }
  }

  /* the bowl and the roof */
  bowlSurface(F, tn, detail);
  roof3D(F, tn, detail);

  /* the shadows everything casts, before anything is built on top of them */
  if (detail) castShadows(F, tn, Wd, light, span, V);

  /* boxes */
  const houseF = fade(span, D.lod.houseBlock);
  for (const s of Wd.solids) {
    if (s.tag === 'terrace') {
      if (houseF <= 0) continue;
      // while moving, only the terraces you could actually pick out
      if (!detail && V.distTo(P((s.x0 + s.x1) / 2, s.y1, (s.z0 + s.z1) / 2)) > 650) continue;
      const hsh = Math.abs(Math.round(s.x0 * 3 + s.z0 * 7));
      const wall = wallTone(tn, hsh), roofT = hsh % 3 ? tn.roofing : tn.roofingAlt;
      if (detail) ridgeFaces(F, s, wall, roofT, houseF, true);
      else boxFaces(F, { ...s, y1: (s.eaves + s.y1) / 2 }, wall, houseF);
      continue;
    }
    if (s.net) { boxFaces(F, s, tn.net, 0.4); continue; }
    if (s.tag === 'podium') {
      // the face is a solid, but the deck is a flat surface and belongs with
      // the other flat surfaces — a 250 × 40 m quad in the sorted pass paints
      // over whole buildings
      boxFaces(F, s, tn.concrete, 1, true);        // sides only
      tile(F, s.x0, s.x1, s.z0, s.z1, s.y1, tn.paving);
      continue;
    }
    boxFaces(F, s, tn[s.tone] || tn.structure, s.glazed ? 0.85 : 1);
  }

  /* the scale references */
  props3D(F, V, tn, span, Wd, detail);

  const n = F.draw(ctx);
  if (dark) nightWash(ctx, V, tn);
  return n;
}

/* A floodlit night is a lit pitch inside a dark bowl. In three dimensions
   that cannot come from tokens alone: the turf needs a pool of light on it and
   the bowl needs to glow above the rim, or the dark theme is just the day one
   with the lamps off. Drawn after the depth sort, over the pitch only. */
function nightWash(ctx, V, tn) {
  const P2 = D.pitch;
  const corners = [[-P2.halfL, -P2.halfW], [P2.halfL, -P2.halfW], [P2.halfL, P2.halfW], [-P2.halfL, P2.halfW]]
    .map(([x, z]) => V.point({ x, y: 0.08, z }));
  if (corners.some((c) => !c)) return;
  let cx = 0, cy = 0, r = 0;
  for (const c of corners) { cx += c.x / 4; cy += c.y / 4; }
  for (const c of corners) r = Math.max(r, Math.hypot(c.x - cx, c.y - cy));
  ctx.save();
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath(); ctx.clip();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, tn.flood); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.16; ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  // the glow the bowl throws into the sky, which is how you find a night
  // match from a mile away
  const rim = V.point({ x: 0, y: D.roof.fasciaTop, z: 0 });
  if (!rim) return;
  const gg = ctx.createRadialGradient(rim.x, rim.y, 0, rim.x, rim.y, r * 1.5);
  gg.addColorStop(0, tn.flood); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = gg;
  ctx.fillRect(rim.x - r * 1.5, rim.y - r * 1.5, r * 3, r * 3);
  ctx.restore();
}

/* Shadows on the ground. Nothing here is a shadow map: each box and each
   prop is projected along the light onto y = 0 as one dark quad. It costs a
   few hundred polygons and it is the single biggest thing separating a model
   that sits on the ground from one that floats above it. */
function castShadows(F, tn, Wd, light, span, V) {
  if (Math.abs(light.y) < 0.05) return;
  const kx = -light.x / light.y, kz = -light.z / light.y;
  const drop = (x, z, y) => P(x + kx * y, 0.03, z + kz * y);
  const dark = shadowTone(tn);
  for (const s of Wd.solids) {
    if (s.tag === 'podium' || s.tag === 'goal net') continue;
    const y = s.ridge ? (s.eaves + s.y1) / 2 : s.y1;
    if (y < 1.2) continue;
    F.add([drop(s.x0, s.z0, y), drop(s.x1, s.z0, y), drop(s.x1, s.z1, y), drop(s.x0, s.z1, y)],
          dark, { cull: false, flat: true, ground: true });
  }
  // the bowl's own shadow: the biggest object in the world casting the
  // biggest shadow in it, which is most of what puts it ON the ground
  {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const r = planRadius(ca, sa, D.bowl.depth);
      pts.push(drop(ca * r, sa * r, D.roof.fasciaTop * 0.72));
    }
    F.add(pts, dark, { cull: false, flat: true, ground: true });
  }
  const carF = fade(span, D.lod.cars), treeF = fade(span, D.lod.treeBlob);
  for (const p of Wd.props) {
    const base = p.y || 0;
    // a shadow smaller than a pixel is a wasted polygon
    if (V.distTo(P(p.x, base, p.z)) > 950) continue;
    if (p.type === 'car' || p.type === 'bus') {
      if (carF <= 0) continue;
      const B = p.type === 'bus' ? D.prop.bus : D.prop.car;
      const along = Math.abs(Math.cos((p.rot * Math.PI) / 180)) > 0.5;
      const lx = (along ? B.w : B.l) / 2, lz = (along ? B.l : B.w) / 2;
      F.add([drop(p.x - lx, p.z - lz, base + B.h), drop(p.x + lx, p.z - lz, base + B.h),
             drop(p.x + lx, p.z + lz, base + B.h), drop(p.x - lx, p.z + lz, base + B.h)],
            dark, { cull: false, flat: true, ground: true });
    } else if (p.type === 'tree' || p.type === 'treeYoung') {
      if (treeF <= 0) continue;
      const T = p.type === 'tree' ? D.prop.treeMature : D.prop.treeYoung;
      const v = 0.85 + (p.v || 0.5) * 0.3, r = T.canopyR * v * 0.85;
      const c = drop(p.x, p.z, base + T.h * v * 0.7);
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        pts.push(P(c.x + Math.cos(a) * r, 0.03, c.z + Math.sin(a) * r * 0.9));
      }
      F.add(pts, dark, { cull: false, flat: true, ground: true });
    }
  }
}
function shadowTone(tn) {
  return (document.documentElement.dataset.theme || 'dark') === 'light'
    ? 'rgba(56,44,32,0.26)' : 'rgba(0,0,0,0.42)';
}

const area = (g) => Math.abs((g.x1 - g.x0) * (g.z1 - g.z0));

/* A flat surface is laid down as overlapping tiles. Tiling keeps any one
   polygon small enough for the depth sort to place it sensibly; the overlap
   is what stops the tile edges showing as a debug grid, because a canvas
   antialiases every polygon edge against whatever is behind it. */
function tile(F, x0, x1, z0, z1, y, tone) {
  const LX = Math.abs(x1 - x0), LZ = Math.abs(z1 - z0);
  const nx = clamp(Math.ceil(LX / 400), 1, 10), nz = clamp(Math.ceil(LZ / 400), 1, 10);
  const ox = (LX / nx) * 0.004, oz = (LZ / nz) * 0.004;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = x0 + ((x1 - x0) * i) / nx - ox, b = x0 + ((x1 - x0) * (i + 1)) / nx + ox;
      const c = z0 + ((z1 - z0) * j) / nz - oz, d = z0 + ((z1 - z0) * (j + 1)) / nz + oz;
      F.add(quad(P(a, y, c), P(b, y, c), P(b, y, d), P(a, y, d)), tone,
            { cull: false, flat: true, ground: true });
    }
  }
}

/* ── props, as camera-facing cards ──────────────────────────────────── */
function props3D(F, V, tn, span, Wd, detail) {
  const peopleF = fade(span, D.lod.people), carF = fade(span, D.lod.cars), treeF = fade(span, D.lod.treeBlob);
  // A card built from the camera's right vector alone lies down the moment
  // the camera looks down at it: trees became green lozenges painted on the
  // grass. The horizontal component of `right` keeps the card vertical.
  const r0 = V.right;
  const rl = Math.hypot(r0.x, r0.z) || 1;
  const right = { x: r0.x / rl, y: 0, z: r0.z / rl };
  // Three thousand props is a lot of polygons to throw at a clipper for the
  // sake of marks two pixels tall. Anything that small is dropped before it
  // costs anything, and while the camera is moving the bar is higher still.
  const MIN_PX = detail ? 2.2 : 14;
  const tooSmall = (x, z, y, hM) => (hM * V.f) / V.distTo({ x, y, z }) < MIN_PX;
  const card = (x, z, y0, wM, hM, tone, alpha) => {
    const hx = (right.x * wM) / 2, hz = (right.z * wM) / 2;
    F.add(quad(P(x - hx, y0, z - hz), P(x + hx, y0, z + hz),
               P(x + hx, y0 + hM, z + hz), P(x - hx, y0 + hM, z - hz)), tone, { cull: false, flat: true, alpha });
  };
  /** A canopy, as a blob in the upright plane rather than a 10 m square. */
  const canopy = (x, z, y0, rM, hM, tone, alpha) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const wob = 0.82 + 0.18 * Math.cos(a * 3 + x);
      const ox = Math.cos(a) * rM * wob, oy = Math.sin(a) * (hM / 2) * wob;
      pts.push(P(x + right.x * ox, y0 + hM / 2 + oy, z + right.z * ox));
    }
    F.add(pts, tone, { cull: false, flat: true, alpha });
  };
  // Looking nearly straight down, an upright card is edge-on and invisible.
  // A canopy seen from above is a disc, so that is what it becomes.
  const steep = Math.abs(V.fwd.y) > 0.72;
  const disc = (x, z, y, rM, tone, alpha) => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(P(x + Math.cos(a) * rM, y, z + Math.sin(a) * rM));
    }
    F.add(pts, tone, { cull: false, flat: true, alpha });
  };
  for (const p of Wd.props) {
    const y = p.y || 0;
    switch (p.type) {
      case 'person':
        if (peopleF > 0 && !tooSmall(p.x, p.z, y, D.prop.person.h)) {
          if (steep) disc(p.x, p.z, y + 0.05, D.prop.person.w * 0.8, tn.prop, peopleF);
          else card(p.x, p.z, y, D.prop.person.w, D.prop.person.h, tn.prop, peopleF);
        }
        break;
      case 'car': case 'bus': if (carF > 0) {
        const B = p.type === 'bus' ? D.prop.bus : D.prop.car;
        if (tooSmall(p.x, p.z, y, B.h)) break;
        const along = Math.abs(Math.cos((p.rot * Math.PI) / 180)) > 0.5;
        const lx = along ? B.w : B.l, lz = along ? B.l : B.w;
        // Five faces each, times a thousand parked cars, is the single
        // biggest cost in the scene — so a distant car is one card.
        const big = detail && (B.h * V.f) / V.distTo({ x: p.x, y, z: p.z }) > 9;
        const paint = p.type === 'bus' ? tn.panel : carTone(tn, p.v);
        if (big) {
          boxFaces(F, { x0: p.x - lx / 2, x1: p.x + lx / 2, z0: p.z - lz / 2, z1: p.z + lz / 2,
                        y0: y, y1: y + B.h * 0.62 }, paint, carF);
          // the glasshouse, set in from the body, so a car has a shape
          const i = 0.17;
          boxFaces(F, { x0: p.x - lx / 2 + lx * i, x1: p.x + lx / 2 - lx * i,
                        z0: p.z - lz / 2 + lz * i, z1: p.z + lz / 2 - lz * i,
                        y0: y + B.h * 0.6, y1: y + B.h }, tn.glass, carF);
        } else {
          card(p.x, p.z, y, Math.max(lx, lz) * 0.8, B.h, paint, carF);
        }
      } break;
      case 'tree': case 'treeYoung': if (treeF > 0) {
        const T = p.type === 'tree' ? D.prop.treeMature : D.prop.treeYoung;
        const v = 0.85 + (p.v || 0.5) * 0.3;
        if (tooSmall(p.x, p.z, y, T.h * v)) break;
        const leaf = (p.v || 0) > 0.72 ? tn.parkAlt : tn.park;
        if (steep) { disc(p.x, p.z, y + T.h * v * 0.72, T.canopyR * v, leaf, treeF); break; }
        if (detail) card(p.x, p.z, y, T.trunkR * 2.4, T.h * v * 0.45, tn.roofingAlt, treeF);
        canopy(p.x, p.z, y + T.h * v * 0.3, T.canopyR * v, T.h * v * 0.72, leaf, treeF);
      } break;
      case 'lamp':
        if (carF > 0 && detail && !tooSmall(p.x, p.z, y, p.h || D.prop.lamp.h))
          card(p.x, p.z, y, 0.22, p.h || D.prop.lamp.h, tn.metal, carF);
        break;
      case 'flag': card(p.x, p.z, y, 0.1, 1.5, tn.prop, 1); break;
      default: break;
    }
  }
}

/** Beyond the district: labelled distance rings, so a flight that never comes
    back has something to be measured against instead of a blank plane. */
export function farRings3D(ctx, V, tn, span) {
  if (span < 900) return;
  const F = D.far;
  ctx.save();
  let lastY = -1e9, lastX = -1e9;
  for (let r = F.gridStep; r <= Math.min(F.gridTo, span * 1.6); r += F.gridStep) {
    if (r < F.gridStep) continue;
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * r, y: 0.3, z: Math.sin(a) * r });
    }
    ctx.globalAlpha = clamp(1 - Math.abs(span - r * 1.4) / (r * 2.2), 0.12, 0.6);
    ctx.strokeStyle = tn.farGrid; ctx.lineWidth = 1.2;
    for (const run of V.polyline(pts)) {
      ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
      ctx.stroke();
    }
    // Drawn straight to the canvas, not queued: this runs inside the cached
    // scenery layer, and the label queue belongs to the live frame.
    // In perspective, fourteen concentric rings put fourteen labels inside
    // sixty pixels. One label per ring, and only if it has room to be read.
    const lab = V.point({ x: 0, y: 0.3, z: -r });
    if (lab && lab.x > 8 && Math.hypot(lab.x - lastX, lab.y - lastY) > 30) {
      lastX = lab.x; lastY = lab.y;
      ctx.globalAlpha = 1;
      ctx.font = `600 13px ${cssVar('--font', 'system-ui, sans-serif')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 4;
      ctx.strokeStyle = cssVar('--surface', '#131210');
      ctx.strokeText(`${(r / 1000).toFixed(1)} km`, lab.x, lab.y);
      ctx.fillStyle = cssVar('--ink-muted', '#888');
      ctx.fillText(`${(r / 1000).toFixed(1)} km`, lab.x, lab.y);
    }
  }
  ctx.restore();
}

/* Orientation without floating labels. A label pinned to a point in the world
   has no way of knowing a roof is in front of it — there is no depth buffer —
   so the bearing is reported as text instead of drawn into the scene. */
const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
export function bearingName(yaw) {
  // the camera looks from eye towards the target, i.e. back along yaw
  const a = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return COMPASS[Math.round(a / (Math.PI / 4)) % 8];
}
