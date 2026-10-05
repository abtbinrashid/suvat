// world2d.js — the cross-section, painted.
//
// A side-on cut through the stadium along the plane the flight happens in.
// Everything is drawn in world metres and scaled by the camera, so nothing
// here can be accidentally out of scale: a 1.8 m person is 1.8 tall because
// 1.8 is the number that goes in.
//
// THE SCENERY IS STATIC, so all of it is painted once into an offscreen
// canvas and blitted after that. It is only repainted when the camera, the
// size, the theme or the cutting plane changes — never during a flight.

import { cssVar, clamp, fmt, niceStep } from './util.js';
import { deckProfile, slice } from '../world/world.js';
import { D } from '../world/dims.js';

/* ── scenery colours, cached per theme ──────────────────────────────── */
let TONE = null, TONE_KEY = '';
const KEYS = {
  skyTop: '--sky-top', skyMid: '--sky-mid', skyBottom: '--sky-bottom', haze: '--haze',
  sun: '--sun', sunGlow: '--sun-glow', shadow: '--shadow', skyFill: '--sky-fill',
  render: '--render', panel: '--panel', roofingAlt: '--roofing-alt',
  seatHi: '--seat-hi', parkAlt: '--park-alt',
  carA: '--car-a', carB: '--car-b', carC: '--car-c', carD: '--car-d', carE: '--car-e',
  grass: '--grass', grassAlt: '--grass-alt', runoff: '--runoff',
  pitchline: '--pitchline', concrete: '--concrete', paving: '--paving',
  asphalt: '--asphalt', roadline: '--roadline', ballast: '--ballast',
  brick: '--brick', roofing: '--roofing', window: '--window',
  glass: '--glass', metal: '--metal', net: '--net',
  seat: '--seat', seatAlt: '--seat-alt', board: '--board',
  structure: '--structure', structureDark: '--structure-dark',
  roofTop: '--roof-top', roofUnder: '--roof-under',
  prop: '--prop', water: '--water', park: '--park', parkDeep: '--park-deep',
  trunk: '--trunk', tyre: '--tyre',
  flood: '--flood', farGrid: '--far-grid',
  earth: '--earth', interior: '--interior', terrain: '--terrain',
  ground: '--terrain', white: '--pitchline',
};
export function tones() {
  const k = document.documentElement.dataset.theme || 'dark';
  if (TONE && TONE_KEY === k) return TONE;
  TONE = {}; TONE_KEY = k;
  for (const [name, v] of Object.entries(KEYS)) TONE[name] = cssVar(v, '#888');
  return TONE;
}
export const dropToneCache = () => { TONE = null; MIX.clear(); };

/* ── light, in a flat drawing ──────────────────────────────────────────
   A section has no normals to shade, so the light has to be put in by hand:
   surfaces facing the low sun take a warm lift, surfaces turned away take
   the cool of the sky, and the volume behind the cut graduates from light at
   the top to shadow at the bottom. It is the difference between a drawing
   of a building and a diagram of one. */
const MIX = new Map();
const rgbOf = (c) => {
  const x = c.trim();
  if (x.startsWith('#')) {
    const h = x.slice(1);
    return h.length === 3 ? h.split('').map((d) => parseInt(d + d, 16))
                          : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = x.match(/-?[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
};
export function mixTone(a, b, t) {
  const key = `${a}|${b}|${t.toFixed(3)}`;
  if (MIX.has(key)) return MIX.get(key);
  const A = rgbOf(a), B = rgbOf(b);
  const out = `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  MIX.set(key, out);
  return out;
}
/** Warm if the surface turns towards the sun, cool if it turns away. */
const sunward = (tn, tone, facing) =>
  facing > 0 ? mixTone(tone, tn.sun, 0.17) : mixTone(tone, tn.skyFill, 0.14);

/* ── level of detail ────────────────────────────────────────────────── */
/** 1 well inside the limit, 0 past it, a ramp over the last quarter. */
export function fade(span, limit) {
  if (span <= limit * 0.72) return 1;
  if (span >= limit) return 0;
  return 1 - (span - limit * 0.72) / (limit * 0.28);
}
export function zoomBand(span) {
  const b = D.lod.bands;
  return span < b.pitch ? 'pitch' : span < b.stadium ? 'stadium' : 'district';
}
export const BAND_LABEL = { pitch: 'Pitch level', stadium: 'Stadium', district: 'District' };

/* ── an offscreen layer, reused ─────────────────────────────────────── */
const layers = new Map();
export function layer(name, w, h, key, draw) {
  let L = layers.get(name);
  if (!L) { L = { c: document.createElement('canvas'), key: null, w: 0, h: 0 }; layers.set(name, L); }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (L.key !== key || L.w !== w || L.h !== h) {
    L.c.width = Math.max(1, Math.round(w * dpr));
    L.c.height = Math.max(1, Math.round(h * dpr));
    const g = L.c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g);
    L.key = key; L.w = w; L.h = h;
  }
  return L.c;
}

/* ── small painters ─────────────────────────────────────────────────── */
const rect = (ctx, x0, y0, x1, y1, fill) => {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
};
const poly = (ctx, pts, fill, line, lw = 1) => {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
};

/**
 * Paint one cross-section.
 * A = { ctx, w, h, span, sx, sy, groundY, section, tn, mpp }
 *   sx(u) → screen x for a section coordinate, sy(y) → screen y for a height
 */
export function drawSection(A) {
  const { ctx, w, h, span, sx, sy, section: S, tn } = A;
  const uMin = A.px(-20), uMax = A.px(w + 20);
  const vis = (u0, u1) => Math.max(u0, u1) > uMin && Math.min(u0, u1) < uMax;
  const mpp = 1 / A.scale;                      // metres per pixel
  A.vis = vis; A.mpp = mpp; A.uMin = uMin; A.uMax = uMax;

  // while the camera is moving, the expensive layers are the ones nobody is
  // reading: props, house windows, individual seats
  if (A.moving) { A.span = Math.max(A.span, D.lod.people + 1); }
  sky(A);
  nightGlow(A);
  farField(A);
  strata(A);
  foundations(A);
  surfaces(A);
  groundShade(A);
  groundMarks(A);
  beyond(A);
  blocks(A);
  decks(A);
  roofSection(A);
  props(A);
  datumLine(A);
}

/* ── sky ────────────────────────────────────────────────────────────── */
/* The sun sits low in the west, which is the left of every section drawn
   along the pitch and the far side of every section drawn across it. Its
   position is fixed in the world, not on the screen, so it stays put while
   the camera moves — a sun that slides with the viewport is a sticker. */
const SUN_U = -260, SUN_Y = 34;

function sky(A) {
  const { ctx, w, h, sy, sx, tn } = A;
  const gy = sy(0);
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(gy, 1));
  g.addColorStop(0, tn.skyTop);
  g.addColorStop(0.74, tn.skyMid);
  g.addColorStop(1, tn.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // the sun, and the light it throws along the horizon. After dark there is
  // no sun, and a warm smear in the sky at midnight is just a bug with a
  // gradient on it — the only glow at night comes off the bowl.
  const sunX = sx(SUN_U), sunY = sy(SUN_Y);
  if (TONE_KEY === 'light') {
    const far = Math.max(w, h) * 0.9;
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, far);
    glow.addColorStop(0, tn.sunGlow);
    glow.addColorStop(0.35, 'rgba(255,206,138,0.14)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, Math.max(0, gy)); ctx.restore();
  }
  if (TONE_KEY === 'light' && sunX > -200 && sunX < w + 200) {
    ctx.save(); ctx.fillStyle = tn.sun; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(sunX, sunY, Math.max(7, 9 * Math.min(2, A.scale / 6)), 0, 7); ctx.fill();
    ctx.restore();
  }
  clouds(A, gy);
  // A section has no atmosphere in it, so the haze is a hint and no more:
  // just enough to stop the far district cutting the sky like a blade. At
  // pitch level there is no distance to haze, so there is none.
  if (A.span > 60 && gy > 0 && gy < h) {
    const top = Math.max(0, gy - 34);
    const band = ctx.createLinearGradient(0, top, 0, gy);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(1, tn.haze);
    ctx.globalAlpha = 0.14; ctx.fillStyle = band;
    ctx.fillRect(0, top, w, gy - top);
    ctx.globalAlpha = 1;
  }
  // Below the datum is ground, and ground is solid. Saying so is what makes
  // the flat plane the model assumes look like a plane rather than a line.
  if (gy < h) {
    const e = ctx.createLinearGradient(0, Math.max(0, gy), 0, h);
    e.addColorStop(0, tn.earth);
    e.addColorStop(1, TONE_KEY === 'light' ? '#574f45' : '#111118');
    ctx.fillStyle = e; ctx.fillRect(0, Math.max(0, gy), w, h - Math.max(0, gy));
  }
}

/* Cloud banks, fixed in the world so they give the sky somewhere to be. */
function clouds(A, gy) {
  const { ctx, w, sx, sy, tn } = A;
  if (gy < 60) return;
  const band = TONE_KEY === 'light' ? 'rgba(255,255,255,0.40)' : 'rgba(150,170,205,0.07)';
  ctx.save(); ctx.fillStyle = band;
  for (let i = 0; i < 14; i++) {
    const u = -1800 + i * 310 + (i % 3) * 90;
    const y = 90 + ((i * 37) % 9) * 13;
    const X = sx(u), Y = sy(y);
    const rx = Math.max(40, 120 * Math.min(3, A.scale / 4)), ry = rx * 0.17;
    if (X < -rx * 2 || X > w + rx * 2 || Y > gy - 10) continue;
    ctx.globalAlpha = 0.5 + ((i * 13) % 5) / 14;
    ctx.beginPath(); ctx.ellipse(X, Y, rx, ry, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(X + rx * 0.45, Y - ry * 0.7, rx * 0.5, ry * 0.8, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* The glow over the bowl. At district range the floodlights themselves are
   below the level of detail, and the bowl was going dark while the houses
   kept their lit windows — exactly backwards. This is the one night effect
   that gets STRONGER as you pull away, because that is how it works. */
function nightGlow(A) {
  const { ctx, sy, sx, tn, section, span } = A;
  if (TONE_KEY === 'light' || span < 110) return;
  const wings = section.roof.wings;
  if (wings.length !== 2) return;
  const u0 = Math.min(wings[0].inner, wings[1].inner), u1 = Math.max(wings[0].inner, wings[1].inner);
  const cx = sx((u0 + u1) / 2), base = sy(D.roof.fasciaTop);
  const r = Math.max(110, Math.abs(sx(u1) - sx(u0)) * 1.3);
  const g = ctx.createRadialGradient(cx, base, 0, cx, base, r);
  g.addColorStop(0, tn.flood); g.addColorStop(0.45, 'rgba(255,238,194,0.30)');
  g.addColorStop(1, 'rgba(255,238,194,0)');
  ctx.save();
  ctx.globalAlpha = clamp((span - 110) / 420, 0, 1) * 0.40;
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, base - r, r * 2, r * 2);
  ctx.restore();
}

/* ── beyond the district: a labelled distance grid, not a hard edge ─── */
function farField(A) {
  const { ctx, w, h, sx, sy, tn, span } = A;
  const F = D.far;
  if (A.uMax < F.fadeFrom && A.uMin > -F.fadeFrom) return;
  ctx.save();
  ctx.strokeStyle = tn.farGrid; ctx.lineWidth = 1.2;
  const step = Math.max(F.gridStep, niceStep(span, 8));
  for (let u = Math.ceil(A.uMin / step) * step; u <= A.uMax; u += step) {
    if (Math.abs(u) < F.fadeFrom * 0.9) continue;
    const X = Math.round(sx(u)) + 0.5;
    ctx.globalAlpha = clamp((Math.abs(u) - F.fadeFrom * 0.9) / (F.gridStep * 1.5), 0, 1) * 0.9;
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, sy(0)); ctx.stroke();
    // Drawn straight to the canvas: this runs inside the cached scenery
    // layer, and the label queue belongs to the live frame.
    ctx.font = `500 13px ${cssVar('--font', 'system-ui, sans-serif')}`;
    ctx.fillStyle = tn.prop; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${(Math.abs(u) / 1000).toFixed(1)} km`, X, sy(0) - 16);
  }
  ctx.restore();
}

/* ── the ground, in section ─────────────────────────────────────────────
   Below the datum is not simply "not sky". This is a SECTION: it has been
   cut through the ground as much as through the building, and what a cut
   through ground shows is what the ground is made of. A flat slab of brown
   says nothing, and it was a quarter of the frame saying it.

   Two strata and a hatch. Topsoil and subsoil are drawn in METRES like
   everything else in this world, so at pitch level they are the depth they
   really are and at district zoom they are the two pixels they should be.
   The hatch below them is spaced in PIXELS on purpose: it is the drawing
   convention for "ground, continuing", not a thing with a size, and a hatch
   measured in metres would either vanish or turn into fence posts. */
function strata(A) {
  const { ctx, w, h, sy, tn } = A;
  const gy = sy(0);
  if (gy >= h) return;
  const top = Math.max(0, gy);
  ctx.save();
  const soil = [[0.4, mixTone(tn.earth, tn.terrain, 0.5)],
                [2.6, mixTone(tn.earth, tn.terrain, 0.18)]];
  let prev = 0;
  for (const [d, tone] of soil) {
    const y0 = Math.max(top, sy(-prev)), y1 = Math.min(h, sy(-d));
    if (y1 - y0 > 0.6) { ctx.fillStyle = tone; ctx.fillRect(0, y0, w, y1 - y0); }
    prev = d;
  }
  ctx.strokeStyle = tn.structureDark; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [d] of soil) {
    const y = Math.round(sy(-d)) + 0.5;
    if (y > top + 1 && y < h) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  }
  ctx.stroke();
  const yH = Math.max(top, sy(-2.6));
  if (h - yH > 10) {
    ctx.globalAlpha = 0.15; ctx.strokeStyle = tn.structure;
    ctx.beginPath();
    for (let x = -h; x < w + h; x += 26) { ctx.moveTo(x, h); ctx.lineTo(x + (h - yH), yH); }
    ctx.stroke();
  }
  ctx.restore();
}

/* Nothing this heavy stands on turf. Every stand, and every building above
   about three metres, gets the raft it would really need, sized off its own
   height — which is also the cue that says the dark wedge above the datum is
   a BUILDING and not a hill. */
function foundations(A) {
  const { ctx, sx, sy, tn, section, span } = A;
  if (span > 1100) return;
  const gy = sy(0);
  if (gy > A.h) return;
  ctx.save();
  ctx.fillStyle = tn.structureDark; ctx.globalAlpha = 0.92;
  const pad = (u0, u1, depth) => {
    const x0 = Math.min(sx(u0), sx(u1)), x1 = Math.max(sx(u0), sx(u1));
    if (x1 - x0 < 2 || x1 < 0 || x0 > A.w) return;
    ctx.fillRect(x0, gy, x1 - x0, Math.max(2, sy(-depth) - gy));
  };
  for (const deck of section.decks || []) {
    const prof = deckProfile(deck);
    if (!prof.length) continue;
    const us = prof.flatMap((q) => [q.u0, q.u1]);
    const top = Math.max(...prof.map((q) => Math.max(q.y0, q.y1)));
    pad(Math.min(...us), Math.max(...us), 1.2 + top / 14);
  }
  for (const b of section.blocks) {
    if (b.y1 - b.y0 < 3 || b.tag === 'goal net') continue;
    pad(b.u0, b.u1, 0.5 + (b.y1 - b.y0) / 16);
  }
  ctx.restore();
}

/* ── flat surfaces ──────────────────────────────────────────────────── */
function surfaces(A) {
  const { ctx, sx, sy, h, tn, span, section } = A;
  const stripeF = fade(span, D.lod.grassStripes);
  for (const s of section.surfaces) {
    if (!A.vis(s.u0, s.u1)) continue;
    if (s.tag === 'mowing stripe' && stripeF <= 0) continue;
    const y = sy(s.y), x0 = sx(s.u0), x1 = sx(s.u1);
    ctx.globalAlpha = s.tag === 'mowing stripe' ? 0.6 * stripeF : 1;
    // A flat surface seen edge-on is a line. Giving it 0.4 m of body — the
    // real depth of turf or blacktop — is what lets you tell grass from
    // tarmac in a section, and it is a thickness, not an exaggeration.
    const body = Math.max(s.tag === 'pitch' || s.tag === 'mowing stripe' ? 4 : 3, 0.5 * A.scale);
    if (s.y > 0.2) rect(ctx, x0, y, x1, sy(0), tn.concrete);   // the face it stands on
    rect(ctx, x0, y, x1, y + body, tn[s.tone] || tn.ground);
    // a kerb, so tarmac stops being paving stops being turf when the band is
    // only three pixels deep
    if (Math.abs(x1 - x0) > 3) {
      ctx.globalAlpha *= 0.5; ctx.fillStyle = tn.structureDark;
      ctx.fillRect(Math.min(x0, x1), y + body, Math.abs(x1 - x0), 1);
      ctx.globalAlpha = s.tag === 'mowing stripe' ? 0.6 * stripeF : 1;
    }
    // Under floodlights the turf is the brightest surface in the stadium, so
    // at night it gets a lit top edge. In daylight it does not need one.
    if (TONE_KEY !== 'light' && (s.tag === 'pitch' || s.tag === 'run-off')) {
      ctx.globalAlpha = s.tag === 'pitch' ? 0.5 : 0.25;
      rect(ctx, x0, y, x1, y + Math.max(1.4, body * 0.3), tn.flood);
      ctx.globalAlpha = 1;
    }
  }
}

/* ── what the stands throw across the ground ────────────────────────────
   Late afternoon, the sun 28° up in the west: a 35 m stand lays 66 m of
   shadow across the pitch. It is the one cue that tells you, in a flat
   drawing with no perspective in it, that the thing on the left is tall and
   the thing in the middle is not. */
const SUN_ELEV = 28 * Math.PI / 180;
const SHADOW_RUN = 1 / Math.tan(SUN_ELEV);        // metres of shadow per metre

function groundShade(A) {
  const { ctx, sx, sy, tn, section, span } = A;
  if (span > 1400) return;
  // the sun's component IN the cutting plane: along the pitch it is the full
  // westerly cast, across the pitch only the part of it that points that way
  const inPlane = section.axis === 'x' ? -0.74 : 0.28;
  const dir = Math.sign(section.dir * inPlane) || 1;
  const casters = [];
  for (const deck of section.decks) {
    const prof = deckProfile(deck);
    const us = prof.flatMap((q) => [q.u0, q.u1]);
    const hTop = Math.max(...prof.map((q) => Math.max(q.y0, q.y1)));
    casters.push({ edge: dir > 0 ? Math.max(...us) : Math.min(...us), h: hTop });
  }
  for (const b of section.blocks) {
    if (b.y1 - b.y0 < 2.5) continue;
    casters.push({ edge: dir > 0 ? Math.max(b.u0, b.u1) : Math.min(b.u0, b.u1), h: b.y1 });
  }
  ctx.save();
  ctx.fillStyle = tn.shadow;
  const gy = sy(0), thick = Math.max(2.5, 0.5 * A.scale);
  for (const c of casters) {
    const run = c.h * SHADOW_RUN * Math.abs(inPlane);
    if (run < 2) continue;
    const x0 = sx(c.edge), x1 = sx(c.edge + dir * run);
    if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > A.w) continue;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, tn.shadow);
    g.addColorStop(0.72, tn.shadow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), gy - thick, Math.abs(x1 - x0), thick + 2);
  }
  ctx.restore();
}

/* ── markings on those surfaces ─────────────────────────────────────── */
function groundMarks(A) {
  const { ctx, sx, sy, tn, span, section } = A;
  const pf = fade(span, D.lod.pitchLines), rf = fade(span, D.lod.roadLines);
  for (const m of section.marks) {
    const isRoad = m.tone === 'roadline' || m.tone === 'metal';
    const f = isRoad ? rf : pf;
    if (f <= 0) continue;
    ctx.globalAlpha = f;
    ctx.fillStyle = tn[m.tone] || tn.pitchline;
    // Drawn ABOVE the datum, not straddling it: half of every pitch line used
    // to be buried under the turf body painted downward from y = 0.
    const yTop = sy(0) - 3.4;
    if (m.run) {
      // The cutting plane lying ALONG a painted line sees it end-on. Drawn
      // three pixels deep on a four-pixel turf band it painted the whole
      // pitch white, which is not what a 0.12 m line looks like.
      if (!A.vis(m.u0, m.u1)) continue;
      ctx.fillRect(sx(m.u0), yTop + 1.4, sx(m.u1) - sx(m.u0), 1.8);
    } else {
      if (!A.vis(m.u, m.u)) continue;
      const wpx = Math.max(2, m.w * A.scale);
      ctx.fillRect(sx(m.u) - wpx / 2, yTop, wpx, 3.4);
    }
    ctx.globalAlpha = 1;
  }
}

/** Built things the plane misses but that stand just beyond it. Drawn first,
    lighter, and with no detail: present, but never mistaken for the cut. */
function beyond(A) {
  const { ctx, sx, sy, tn, section } = A;
  for (const b of section.behind || []) {
    if (!A.vis(b.u0, b.u1)) continue;
    const yT = sy(b.y1), yB = sy(b.y0);
    if (Math.abs(yB - yT) < 1.2) continue;
    ctx.save();
    // Distance is haze. Fading everything behind the cut by one flat alpha
    // made the near ones weak and the far ones no further away; mixing each
    // towards the sky instead is what the air actually does, and it is the
    // only depth cue a drawing with no perspective in it can have.
    const t = clamp(b.off, 0, 1);
    ctx.globalAlpha = 0.58 * (1 - t * 0.42);
    rect(ctx, sx(b.u0), yT, sx(b.u1), yB,
         mixTone(tn[b.tone] || tn.structure, tn.haze, 0.26 + 0.46 * t));
    ctx.restore();
  }
}

/* ── boxes: houses, station, hoardings, goals ───────────────────────── */
function blocks(A) {
  const { ctx, sx, sy, tn, span, section } = A;
  const list = section.blocks.slice().sort((a, b) => Math.abs(b.u0) - Math.abs(a.u0));
  const houseF = fade(span, D.lod.houseBlock), detF = fade(span, D.lod.houseDetail);
  for (const b of list) {
    if (!A.vis(b.u0, b.u1)) continue;
    const x0 = sx(b.u0), x1 = sx(b.u1), yT = sy(b.y1), yB = sy(b.y0);
    const wpx = Math.abs(x1 - x0), hpx = Math.abs(yB - yT);
    if (hpx < 0.6 && wpx < 0.6) continue;

    if (b.tag === 'terrace') {
      if (houseF <= 0) continue;
      ctx.globalAlpha = houseF;
      const eavesY = sy(b.eaves);
      // Streets are not built from one material. Wall and roof come from the
      // row's own position, so a district has brick, render and panel in it
      // rather than one repeated house.
      const hsh = Math.abs(Math.round(b.u0 * 3 + b.y0 * 11));
      const wall = [tn.brick, tn.render, tn.brick, tn.panel][hsh % 4];
      const roofT = hsh % 3 ? tn.roofing : tn.roofingAlt;
      const face = SUN_U - (b.u0 + b.u1) / 2 > 0 ? 1 : -1;
      if (b.gable) {
        // cut across a row: the gable end, so the ridge shows as a peak
        poly(ctx, [{ x: x0, y: yB }, { x: x0, y: eavesY }, { x: (x0 + x1) / 2, y: yT },
                   { x: x1, y: eavesY }, { x: x1, y: yB }], sunward(tn, wall, face));
        poly(ctx, [{ x: x0 - 1, y: eavesY }, { x: (x0 + x1) / 2, y: yT }, { x: x1 + 1, y: eavesY }],
             mixTone(roofT, tn.sun, 0.22));
      } else {
        // cut along a row: a long wall under a ridge seen end-on
        rect(ctx, x0, eavesY, x1, yB, sunward(tn, wall, face));
        rect(ctx, x0, yT, x1, eavesY, mixTone(roofT, tn.sun, 0.22));
        if (detF > 0) windowsAlong(A, b, eavesY, yB, detF * houseF, hsh);
      }
      ctx.globalAlpha = 1; continue;
    }

    if (b.net) { goalNet(A, b); continue; }
    if (b.tag === 'hoarding') { hoarding(A, b); continue; }

    ctx.globalAlpha = 1;
    const fill = b.glazed ? tn.glass : (tn[b.tone] || tn.structure);
    rect(ctx, x0, yT, x1, yB, b.glazed ? tn.structureDark : fill);
    if (b.glazed) {
      rect(ctx, x0, yT, x1, yB, tn.glass);
      ctx.strokeStyle = tn.metal; ctx.lineWidth = 1;
      const step = Math.max(6, 4 * A.scale);
      for (let X = Math.min(x0, x1); X < Math.max(x0, x1); X += step) {
        ctx.beginPath(); ctx.moveTo(Math.round(X) + .5, yT); ctx.lineTo(Math.round(X) + .5, yB); ctx.stroke();
      }
      if (TONE_KEY !== 'light' && hpx > 6) {
        ctx.globalAlpha = 0.5; rect(ctx, x0, yT + hpx * 0.25, x1, yT + hpx * 0.45, tn.window); ctx.globalAlpha = 1;
      }
    }
    if (hpx > 2.5 && wpx > 2.5) { ctx.strokeStyle = tn.structureDark; ctx.lineWidth = 1; ctx.strokeRect(Math.min(x0, x1) + .5, yT + .5, wpx - 1, hpx - 1); }
  }
}

/** The 5.5 m frontage rhythm of a terrace row, once it is big enough to see. */
function windowsAlong(A, b, eavesY, yB, alpha, hsh = 0) {
  const { ctx, sx, tn } = A;
  const n = Math.floor(Math.abs(b.u1 - b.u0) / D.house.front);
  if (n < 1 || n > 400) return;
  const wpx = D.house.front * A.scale;
  if (wpx < 7) return;
  ctx.globalAlpha = alpha;
  const hgt = yB - eavesY;
  for (let i = 0; i < n; i++) {
    const X = sx(Math.min(b.u0, b.u1) + (i + 0.5) * D.house.front);
    const lit = TONE_KEY !== 'light' && ((i * 7 + hsh) % 5 < 2);
    ctx.fillStyle = lit ? tn.window : tn.structureDark;
    ctx.globalAlpha = alpha * (lit ? 0.85 : 0.5);
    ctx.fillRect(X - wpx * 0.18, eavesY + hgt * 0.18, wpx * 0.36, hgt * 0.26);
    ctx.fillRect(X - wpx * 0.18, eavesY + hgt * 0.56, wpx * 0.36, hgt * 0.24);
  }
  ctx.globalAlpha = 1;
}

function hoarding(A, b) {
  const { ctx, sx, sy, tn, span } = A;
  const x0 = sx(b.u0), x1 = sx(b.u1), yT = sy(b.y1), yB = sy(b.y0);
  rect(ctx, x0, yT, x1, yB, tn.board);
  if (fade(span, D.lod.boardPanels) > 0 && Math.abs(b.panel * A.scale) > 5) {
    ctx.strokeStyle = tn.structureDark; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    const lo = Math.min(b.u0, b.u1), hi = Math.max(b.u0, b.u1);
    for (let u = Math.ceil(lo / b.panel) * b.panel; u < hi; u += b.panel) {
      const X = Math.round(sx(u)) + .5;
      ctx.beginPath(); ctx.moveTo(X, yT); ctx.lineTo(X, yB); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function goalNet(A, b) {
  const { ctx, sx, sy, tn, span } = A;
  const x0 = sx(b.u0), x1 = sx(b.u1), yT = sy(b.y1), yB = sy(b.y0);
  ctx.save();
  ctx.globalAlpha = 0.35; rect(ctx, x0, yT, x1, yB, tn.net); ctx.globalAlpha = 1;
  // A 0.12 m mesh is finer than a pixel long before the goal stops mattering,
  // so below that the mesh coarsens rather than vanishing: the point is that
  // it reads as netting, not that you can count the squares.
  if (fade(span, D.lod.netMesh) > 0) {
    const step = Math.max(b.mesh * A.scale, 3.2);
    ctx.globalAlpha = 0.75; ctx.strokeStyle = tn.net; ctx.lineWidth = 0.8;
    ctx.beginPath();
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (let X = lo; X <= hi; X += step) { ctx.moveTo(X, yT); ctx.lineTo(X, yB); }
    for (let Y = yT; Y <= yB; Y += step) { ctx.moveTo(lo, Y); ctx.lineTo(hi, Y); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  // the frame: crossbar and post, which is what makes it a goal and not a box
  ctx.strokeStyle = tn.white; ctx.lineWidth = Math.max(2, D.goal.postR * 2 * A.scale);
  ctx.beginPath();
  ctx.moveTo(x0, yB); ctx.lineTo(x0, yT); ctx.lineTo(x1, yT);
  ctx.stroke();
  ctx.restore();
}

/* ── the seating decks, as a real building section ──────────────────────
   A section through a stand cuts the raking slabs, the floor decks, the rear
   wall and the parapets. Everything else is the concourse volume BEHIND the
   cut. Drawing cut material dark and the space behind it light is the oldest
   convention in architectural drawing, and it is the only thing that makes a
   three-tier stand legible at a glance. */
const SLAB = 1.0, DECK_T = 0.4, WALL_T = 0.7, SEAT_BAND = 0.45;

function decks(A) {
  const { ctx, sx, sy, tn, span, section } = A;
  for (const deck of section.decks) {
    const prof = deckProfile(deck);
    const us = prof.flatMap((p) => [p.u0, p.u1]);
    const lo = Math.min(...us), hi = Math.max(...us);
    if (!A.vis(lo, hi)) continue;
    const s = prof[0].s;                       // +1 or −1: which way is outward

    /* 1 · the volume behind the cut */
    const N = clamp(Math.round(Math.abs(hi - lo) * A.scale / 4), 40, 400);
    const top = [];
    for (let i = 0; i <= N; i++) {
      const u = lo + ((hi - lo) * i) / N;
      let y = 0;
      for (const p of prof) {
        const a = Math.min(p.u0, p.u1), b = Math.max(p.u0, p.u1);
        if (u < a - 1e-9 || u > b + 1e-9) continue;
        const k = b - a < 1e-9 ? 0 : (u - a) / (b - a);
        y = Math.max(y, p.u0 <= p.u1 ? p.y0 + (p.y1 - p.y0) * k : p.y1 + (p.y0 - p.y1) * k);
      }
      top.push({ x: sx(u), y: sy(y) });
    }
    // Outlined in the poché tone, not the light one: the interior fill is
    // within 1.2:1 of the sky in both themes, so the silhouette is carried by
    // the line, not by the fill.
    const shell = [{ x: sx(lo), y: sy(0) }, ...top, { x: sx(hi), y: sy(0) }];
    const topY = Math.min(...top.map((q) => q.y));
    const grad = ctx.createLinearGradient(0, topY, 0, sy(0));
    grad.addColorStop(0, mixTone(tn.interior, tn.sun, 0.20));
    grad.addColorStop(1, mixTone(tn.interior, tn.skyFill, 0.16));
    poly(ctx, shell, grad, tn.structureDark, 1.8);
    // A section shows you inside a building. From nine hundred metres away
    // you cannot see inside a building, and a stand that stays pale at that
    // distance reads as a hole in the district rather than a mass in it — so
    // the cut convention fades out and the building closes up.
    // the roof keeps the back of every stand in shade
    if (TONE_KEY === 'light') {
      const topY = Math.min(...top.map((q) => q.y));
      const sh = ctx.createLinearGradient(0, sy(D.roof.fasciaBottom), 0, sy(D.roof.fasciaBottom - 22));
      sh.addColorStop(0, tn.shadow); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.beginPath(); ctx.moveTo(shell[0].x, shell[0].y);
      for (const q of shell.slice(1)) ctx.lineTo(q.x, q.y);
      ctx.closePath(); ctx.clip();
      ctx.globalAlpha = 0.55; ctx.fillStyle = sh;
      ctx.fillRect(0, Math.min(topY, sy(D.roof.fasciaBottom)), A.w, Math.abs(sy(D.roof.fasciaBottom - 22) - sy(D.roof.fasciaBottom)) + 40);
      ctx.restore();
    }
    const open = fade(span, D.lod.seatTexture);
    if (open < 1) { ctx.save(); ctx.globalAlpha = (1 - open) * 0.85; poly(ctx, shell, tn.structureDark); ctx.restore(); }
    if (open > 0.02) interiorStructure(A, deck, prof, lo, hi, open);

    /* 2 · each cut element, in the order it is built */
    let below = 0;
    for (const p of prof) {
      if (p.t === 'tier') {
        const steps = stepPts(p);
        // EVERY tier is a raking slab, the lowest one included. It used to be
        // filled solid from the back row all the way down to the pitch, which
        // put a twenty-metre triangle of the darkest tone in the drawing — a
        // third of the frame, and an embankment rather than a building. No
        // bowl is built that way: the lower tier sits on a slab with the
        // lower concourse under it, which is where everyone stands at half
        // time. Flooring the underside at zero keeps the front rows on solid
        // fill, where they really do sit, and opens the void only as the rake
        // climbs away from the pitch.
        const under = [{ u: p.u1, y: Math.max(0, p.y1 - SLAB) },
                       { u: p.u0, y: Math.max(0, p.y0 - SLAB) }];
        poly(ctx, [...steps, ...under].map((q) => ({ x: sx(q.u), y: sy(q.y) })),
             tn.structureDark, tn.structure, 1.1);
        {
          // what holds it up: a rear wall, and one raking prop
          band(A, p.u1 - s * WALL_T, p.u1, below, p.y1 - SLAB, tn.structureDark);
          // a raking prop drawn as a solid member rather than a wire
          const mid = (p.u0 + p.u1) / 2;
          const topY = (p.y0 + p.y1) / 2 - SLAB, thick = 0.9;
          poly(ctx, [
            { x: sx(mid), y: sy(topY) }, { x: sx(mid + s * thick), y: sy(topY) },
            { x: sx(p.u1 - s * WALL_T), y: sy(below) },
            { x: sx(p.u1 - s * WALL_T - s * thick), y: sy(below) },
          ], tn.structureDark);
        }
        seating(A, p);
        below = Math.max(below, p.y1);
      } else if (p.t === 'deck') {
        band(A, p.u0, p.u1, p.y0 - DECK_T, p.y0, tn.concrete);
        below = Math.max(below, p.y0);
      } else if (p.t === 'rail') {
        band(A, p.u0 - s * 0.06, p.u0 + s * 0.06, p.y0, p.y1, tn.metal);
      } else if (p.t === 'glassWall') {
        // the glazed front of the hospitality boxes: a VERTICAL face, which is
        // what a box front is. Sloping it turned the whole band into a streak.
        band(A, p.u0, p.u1, p.y0, p.y1, tn.structureDark);
        band(A, p.u0, p.u1, p.y0, p.y1, tn.glass);
        glazingBars(A, p);
        below = Math.max(below, p.y1);
      } else if (p.t === 'wall') {
        band(A, p.u0, p.u0 + s * WALL_T, Math.min(p.y0, below), p.y1, tn.structureDark);
        below = Math.max(below, p.y1);
      }
    }

    /* 3 · the rear facade, and the mast that carries the roof above it */
    const last = prof[prof.length - 1];
    const rearU = last.u1, rearY = Math.max(last.y0, last.y1);
    band(A, rearU - s * WALL_T, rearU, 0, rearY, tn.structureDark);
    if (D.roof.fasciaBottom > rearY) {
      ctx.save();
      ctx.strokeStyle = tn.metal; ctx.lineWidth = Math.max(2, 0.8 * A.scale);
      ctx.beginPath();
      ctx.moveTo(sx(rearU - s * WALL_T / 2), sy(rearY));
      ctx.lineTo(sx(rearU - s * WALL_T / 2), sy(D.roof.fasciaBottom));
      ctx.stroke();
      // the raking tie back into the bowl, so the roof is held up by something
      // The back-stay has to terminate on real structure. It used to end at a
      // point nine metres inboard in open air, which is exactly the sort of
      // thing that makes a drawing stop being believable.
      const lastTier = [...prof].reverse().find((q) => q.t === 'tier');
      const footU = lastTier ? lastTier.u1 : rearU - s * 4;
      const footY = lastTier ? lastTier.y1 : rearY;
      ctx.lineWidth = Math.max(1.4, 0.4 * A.scale); ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(sx(rearU - s * WALL_T / 2), sy(D.roof.fasciaBottom));
      ctx.lineTo(sx(footU), sy(footY));
      ctx.lineTo(sx(rearU - s * WALL_T / 2), sy(rearY));
      ctx.stroke(); ctx.restore();
    }
  }
}

/** What is actually behind the cut: concourse floors, a column grid and a
    stair core. A hundred-metre-deep stand filled with one flat tone is an
    embankment, not a building. */
function interiorStructure(A, deck, prof, lo, hi, open = 1) {
  const { ctx, sx, sy, tn } = A;
  const sgn = prof[0].s;
  const floors = [];
  for (const p of prof) {
    if (p.t === 'deck') floors.push({ y: p.y0, u0: p.u0, u1: Math.max(p.u1, p.u0 + sgn * 26) });
    if (p.t === 'tier' && p !== prof[0]) floors.push({ y: p.y0 - SLAB - 2.6, u0: p.u0, u1: p.u1 });
  }
  ctx.save();
  ctx.globalAlpha = 0.62 * open; ctx.strokeStyle = tn.structure;
  ctx.lineWidth = Math.max(1, 0.55 * A.scale);
  const colStep = 8;
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  if (colStep * A.scale > 5) {
    ctx.beginPath();
    for (let u = Math.ceil(a / colStep) * colStep; u < b; u += colStep) {
      let yTop = 0;
      for (const p of prof) {
        const p0 = Math.min(p.u0, p.u1), p1 = Math.max(p.u0, p.u1);
        if (u < p0 || u > p1) continue;
        const k = p1 - p0 < 1e-9 ? 0 : (u - p0) / (p1 - p0);
        yTop = Math.max(yTop, (p.u0 <= p.u1 ? p.y0 + (p.y1 - p.y0) * k : p.y1 + (p.y0 - p.y1) * k));
      }
      if (yTop < 2) continue;
      ctx.moveTo(Math.round(sx(u)) + .5, sy(0));
      ctx.lineTo(Math.round(sx(u)) + .5, sy(yTop - SLAB));
    }
    ctx.stroke();
  }
  // the concourse floors
  ctx.globalAlpha = 0.85 * open; ctx.fillStyle = tn.concrete;
  for (const f of floors) {
    const y = sy(f.y);
    if (f.y < 1) continue;
    ctx.fillRect(Math.min(sx(f.u0), sx(f.u1)), y, Math.abs(sx(f.u1) - sx(f.u0)), Math.max(1.5, 0.35 * A.scale));
  }
  // a stair core: the one piece of a stand you can always find in a section
  const coreU = lo + (hi - lo) * 0.62, coreW = 5.5;
  const coreTop = Math.max(...prof.map((p) => Math.max(p.y0, p.y1))) * 0.62;
  if (coreTop * A.scale > 24) {
    ctx.globalAlpha = 0.3 * open; ctx.strokeStyle = tn.structure;
    ctx.lineWidth = Math.max(1, 0.22 * A.scale);
    ctx.beginPath();
    for (let y = 2.8; y < coreTop; y += 2.8) {
      ctx.moveTo(sx(coreU), sy(y - 2.8)); ctx.lineTo(sx(coreU + sgn * coreW), sy(y));
      ctx.moveTo(sx(coreU + sgn * coreW), sy(y)); ctx.lineTo(sx(coreU), sy(y + 2.8));
    }
    ctx.stroke();
  }
  ctx.restore();
}

const stepPts = (p) => {
  const out = [{ u: p.u0, y: p.y0 }];
  for (let i = 1; i <= p.rows; i++) {
    const k = i / p.rows;
    const u = p.u0 + (p.u1 - p.u0) * k, y = p.y0 + (p.y1 - p.y0) * k;
    out.push({ u, y: y - p.rise }, { u, y });
  }
  return out;
};

function band(A, u0, u1, y0, y1, fill) {
  const { ctx, sx, sy } = A;
  if (Math.abs(y1 - y0) < 1e-6) return;
  rect(ctx, sx(u0), sy(y0), sx(u1), sy(y1), fill);
}

/** Transoms across a glazed face — and at night, the light behind it. */
function glazingBars(A, p) {
  const { ctx, sx, sy, tn } = A;
  const hpx = Math.abs(sy(p.y0) - sy(p.y1));
  if (TONE_KEY !== 'light' && hpx > 4) {
    ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = tn.window;
    const x0 = sx(p.u0), x1 = sx(p.u1);
    rect(ctx, x0 - 1, sy(p.y1) + hpx * 0.12, x1 + 1, sy(p.y1) + hpx * 0.78, tn.window);
    ctx.restore();
  }
  if (hpx < 10) return;
  ctx.save(); ctx.strokeStyle = tn.metal; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let k = 1; k < 3; k++) {
    const y = p.y0 + ((p.y1 - p.y0) * k) / 3;
    ctx.moveTo(sx(p.u0) - 1, sy(y)); ctx.lineTo(sx(p.u1) + 1, sy(y));
  }
  ctx.stroke(); ctx.restore();
}

/* A section cuts through ONE spectator per row, which is what makes a crowd
   the best ruler in the building: a seated person is 0.85 m above the seat and
   the rows are 0.80 m apart, so the stand is measured in people. */
const occupied = (i, seed) => {
  let x = (i * 374761393 + seed * 668265263) | 0;
  x = (x ^ (x >>> 13)) * 1274126177 | 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

function crowd(A, p, f) {
  const { ctx, sx, sy, tn } = A;
  if (f <= 0) return;
  const seed = Math.round(Math.abs(p.u0) * 7 + p.y0 * 13);
  const stepPx = Math.abs(p.rowD * A.scale);
  const H = 0.85, headR = 0.105;
  ctx.save();
  if (stepPx > 5) {
    ctx.globalAlpha = f * 0.95;
    for (let i = 0; i < p.rows; i++) {
      const r = occupied(i, seed);
      if (r > 0.86) continue;                        // an empty seat
      const k = (i + 0.5) / p.rows;
      const u = p.u0 + (p.u1 - p.u0) * k, y = p.y0 + (p.y1 - p.y0) * k + SEAT_BAND;
      const X = sx(u), Y = sy(y), hpx = Math.abs(sy(y + H) - Y);
      ctx.fillStyle = r < 0.45 ? tn.prop : tn.seatAlt;
      // Shoulders, then a head on top of them. A bar with a dot over it is a
      // peg; what makes a crowd legible as PEOPLE — and so usable as the
      // ruler it is — is that the silhouette narrows at the neck. The lean
      // is deterministic, so the same spectator leans the same way forever.
      const bw = Math.max(2.8, 0.44 * A.scale);
      const lean = (r - 0.5) * bw * 0.34;
      const hr = Math.max(1, headR * A.scale);
      ctx.beginPath();
      ctx.moveTo(X - bw / 2, Y);
      ctx.lineTo(X + bw / 2, Y);
      ctx.lineTo(X + bw * 0.42 + lean, Y - hpx * 0.60);
      ctx.lineTo(X + bw * 0.22 + lean, Y - hpx * 0.70);
      ctx.lineTo(X - bw * 0.22 + lean, Y - hpx * 0.70);
      ctx.lineTo(X - bw * 0.42 + lean, Y - hpx * 0.60);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.arc(X + lean, Y - hpx * 0.70 - hr * 0.86, hr, 0, 7); ctx.fill();
    }
  } else if (stepPx > 0.85) {
    // the same people, too far off to resolve: a stippled band along the rake
    ctx.globalAlpha = f * 0.85; ctx.fillStyle = tn.prop;
    const n = Math.min(p.rows, 300);
    for (let i = 0; i < n; i++) {
      if (occupied(i, seed) > 0.86) continue;
      const k = (i + 0.5) / n;
      const u = p.u0 + (p.u1 - p.u0) * k, y = p.y0 + (p.y1 - p.y0) * k + SEAT_BAND;
      ctx.fillRect(sx(u) - 0.6, sy(y + H * 0.8), 1.3, Math.max(1.1, H * 0.8 * A.scale));
    }
  }
  ctx.restore();
}

/** Seats: a continuous band of them at any zoom, resolved into rows up close. */
function seating(A, p) {
  const { ctx, sx, sy, tn, span } = A;
  const rowF = fade(span, D.lod.seatRows), texF = fade(span, D.lod.seatTexture);
  const stepPx = Math.abs(p.rowD * A.scale);

  // The band is drawn at every zoom. Without it a stand is a grey wedge, and
  // a grey wedge tells you nothing about how many people it holds.
  const steps = stepPts(p);
  const up = steps.map((q) => ({ x: sx(q.u), y: sy(q.y + SEAT_BAND) }));
  // a rake that climbs away from the sun is in its own shadow
  const facing = (p.u1 - p.u0) * (SUN_U - p.u0) > 0 ? 1 : -1;
  poly(ctx, [...up, ...steps.slice().reverse().map((q) => ({ x: sx(q.u), y: sy(q.y) }))],
       sunward(tn, tn.seat, facing));

  if (rowF > 0 && stepPx > 4) {
    ctx.save(); ctx.globalAlpha = rowF;
    for (let i = 0; i < p.rows; i++) {
      const k = (i + 0.5) / p.rows;
      const u = p.u0 + (p.u1 - p.u0) * k, y = p.y0 + (p.y1 - p.y0) * k;
      // seat back, then the tread it stands on
      rect(ctx, sx(u - p.s * 0.21), sy(y), sx(u + p.s * 0.21), sy(y + SEAT_BAND),
           i % 2 ? tn.seatAlt : tn.seat);
      ctx.strokeStyle = tn.structure; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx(u + p.s * p.rowD / 2), sy(y));
      ctx.lineTo(sx(u + p.s * p.rowD / 2), sy(y + SEAT_BAND)); ctx.stroke();
    }
    ctx.restore();
    crowd(A, p, rowF);
  } else if (texF > 0 && stepPx > 1.1) {
    ctx.save(); ctx.globalAlpha = 0.65 * texF;
    ctx.strokeStyle = tn.seatAlt; ctx.lineWidth = Math.max(0.8, Math.min(2.4, stepPx * 0.45));
    ctx.beginPath();
    const n = Math.min(p.rows, 200);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const u = p.u0 + (p.u1 - p.u0) * k, y = p.y0 + (p.y1 - p.y0) * k;
      ctx.moveTo(sx(u), sy(y)); ctx.lineTo(sx(u), sy(y + SEAT_BAND));
    }
    ctx.stroke(); ctx.restore();
  }
}

/* ── the roof, in section ───────────────────────────────────────────── */
function roofSection(A) {
  const { ctx, sx, sy, tn, span, section } = A;
  const R = section.roof;
  // Light only reaches what the opening lets it reach. The beams used to be
  // drawn after the stands with no clip, so they fell straight through ten
  // metres of solid bank — the most visible lie in the dark theme.
  const open = R.wings.length === 2
    ? [Math.min(R.wings[0].inner, R.wings[1].inner), Math.max(R.wings[0].inner, R.wings[1].inner)]
    : null;
  A.lightClip = open;
  for (const wing of R.wings) {
    const inner = wing.inner, outer = wing.outerU;
    if (!A.vis(inner, outer)) continue;
    const sgn = Math.sign(outer - inner) || 1;
    // the structural wedge: up from the compression ring to the outer rim
    poly(ctx, [
      { x: sx(inner), y: sy(R.ringTop) },
      { x: sx(outer), y: sy(R.outerStructure) },
      { x: sx(outer), y: sy(R.fasciaBottom) },
      { x: sx(inner), y: sy(R.ringBottom) },
    ], tn.roofUnder, tn.metal, 1.2);
    // the top skin, a touch lighter so the slope reads
    ctx.strokeStyle = mixTone(tn.roofTop, tn.sun, 0.3); ctx.lineWidth = Math.max(2.4, 0.7 * A.scale);
    ctx.beginPath(); ctx.moveTo(sx(inner), sy(R.ringTop)); ctx.lineTo(sx(outer), sy(R.outerStructure)); ctx.stroke();
    // the outer fascia blade, whose top is 48 m — the highest thing there is
    rect(ctx, sx(outer), sy(R.fasciaTop), sx(outer + sgn * 0.9), sy(R.fasciaBottom),
         sunward(tn, tn.roofTop, SUN_U - outer > 0 ? 1 : -1));
    // the compression ring, in section
    rect(ctx, sx(inner), sy(R.ringTop), sx(inner + sgn * 2.5), sy(R.ringBottom), tn.metal);
    // (the shade the roof keeps over the seats is drawn with the decks, where
    //  there is something to shade — over the open pitch it was a blue pane
    //  hanging in the air)
    // The cable itself, as the catenary it is, with the hoop cables as nodes
    // on it. Three dots under a beam said nothing about a cable net.
    if (fade(span, D.lod.roofCables) > 0) {
      const sagMax = 1.4;
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        const u = inner + (outer - inner) * k;
        const y = R.ringBottom + (R.fasciaBottom - R.ringBottom) * k - sagMax * Math.sin(Math.PI * k);
        pts.push({ x: sx(u), y: sy(y) });
      }
      ctx.save(); ctx.strokeStyle = tn.metal; ctx.lineWidth = Math.max(1, 0.12 * A.scale);
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.fillStyle = tn.metal;
      for (let k = 1; k <= R.hoopCables; k++) {
        const q = pts[Math.round((k / (R.hoopCables + 1)) * 20)];
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.4, 0.25 * A.scale), 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // floodlighting under the inner ring
    if (fade(span, D.lod.floodDetail) > 0) {
      // By day a floodlight is a dark box bolted to the ring, not a glowing
      // white bar floating under it.
      rect(ctx, sx(inner), sy(R.ringBottom), sx(inner + sgn * R.lightStripW * 6), sy(R.lightStripY - 0.1),
           TONE_KEY === 'light' ? tn.metal : tn.flood);
      if (TONE_KEY !== 'light') {
        // A floodlight that only glows around itself lights nothing. The beam
        // is drawn going DOWN to the pitch, because that is where it points
        // and the lit pitch is what makes a night match a night match.
        const lx = sx(inner), ly = sy(R.lightStripY);
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 60);
        g.addColorStop(0, tn.flood); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.3; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, 60, 0, 7); ctx.fill();
        ctx.save();
        if (A.lightClip) {
          ctx.beginPath();
          ctx.rect(Math.min(sx(A.lightClip[0]), sx(A.lightClip[1])), 0,
                   Math.abs(sx(A.lightClip[1]) - sx(A.lightClip[0])), sy(0) + 1);
          ctx.clip();
        }
        const far = sx(inner - sgn * Math.abs(inner) * 1.55), gy = sy(0);
        const beam = ctx.createLinearGradient(0, ly, 0, gy);
        beam.addColorStop(0, tn.flood);
        beam.addColorStop(0.75, 'rgba(255,238,194,0.35)');
        beam.addColorStop(1, 'rgba(255,238,194,0.22)');
        ctx.globalAlpha = 0.1; ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(lx - 6, ly); ctx.lineTo(lx + 6, ly); ctx.lineTo(far, gy); ctx.lineTo(lx - (far - lx) * 0.1, gy);
        ctx.closePath(); ctx.fill();
        // and where it lands. A beam that fades out before the ground lights
        // nothing, and a night match is lit turf before it is anything else.
        const pool = ctx.createLinearGradient(lx, 0, far, 0);
        pool.addColorStop(0, 'rgba(255,238,194,0.55)');
        pool.addColorStop(1, 'rgba(255,238,194,0)');
        ctx.globalAlpha = 0.5; ctx.fillStyle = pool;
        ctx.fillRect(Math.min(lx, far), gy - Math.max(2.5, 0.6 * A.scale), Math.abs(far - lx), Math.max(2.5, 0.6 * A.scale));
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }
}

/* ── the scale references ───────────────────────────────────────────── */
function props(A) {
  const { ctx, span, section } = A;
  const peopleF = fade(span, D.lod.people), carF = fade(span, D.lod.cars);
  const treeF = fade(span, D.lod.treeBlob), detTreeF = fade(span, D.lod.treeDetail);
  for (const p of section.props) {
    if (!A.vis(p.u, p.u)) continue;
    const a = 1 - p.off * 0.55;
    switch (p.type) {
      case 'person': if (peopleF > 0) person(A, p, peopleF * a); break;
      case 'car':    if (carF > 0) car(A, p, carF * a); break;
      case 'bus':    if (carF > 0) bus(A, p, carF * a); break;
      case 'tree':   if (treeF > 0) tree(A, p, treeF * a, detTreeF, D.prop.treeMature); break;
      case 'treeYoung': if (treeF > 0) tree(A, p, treeF * a, detTreeF, D.prop.treeYoung); break;
      case 'lamp':   if (carF > 0) lamp(A, p, carF * a); break;
      case 'flag':   if (peopleF > 0) flag(A, p, peopleF * a); break;
      case 'lightCluster': lightCluster(A, p); break;
    }
  }
}

/** Contact with the ground. Without it everything looks pasted on. */
function footing(A, X, Y, wpx, alpha) {
  const { ctx, tn } = A;
  if (wpx < 3) return;
  ctx.save(); ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = tn.earth;
  ctx.beginPath(); ctx.ellipse(X, Y + 1, wpx * 0.75, Math.max(1, wpx * 0.22), 0, 0, 7);
  ctx.fill(); ctx.restore();
}

function person(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const P = D.prop.person, base = p.y || 0;
  const X = sx(p.u), Y0 = sy(base), Y1 = sy(base + P.h);
  const hpx = Y0 - Y1;
  footing(A, X, Y0, Math.max(2.4, P.w * A.scale), alpha);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = p.role === 'referee' ? tn.structureDark : tn.prop;
  if (hpx < 3.5) { ctx.fillRect(X - 1, Y1, 2, hpx); ctx.restore(); return; }
  const wpx = Math.max(2.4, P.w * A.scale);
  ctx.beginPath();                                // head
  ctx.arc(X, Y1 + hpx * 0.1, Math.max(1, hpx * 0.085), 0, 7); ctx.fill();
  ctx.fillRect(X - wpx / 2, Y1 + hpx * 0.18, wpx, hpx * 0.44);     // torso
  ctx.fillRect(X - wpx * 0.42, Y1 + hpx * 0.6, wpx * 0.3, hpx * 0.4);
  ctx.fillRect(X + wpx * 0.12, Y1 + hpx * 0.6, wpx * 0.3, hpx * 0.4);
  ctx.restore();
}

const CAR_TONES = ['carA', 'carB', 'carC', 'carD', 'carE'];
const carTone = (tn, v) => tn[CAR_TONES[Math.floor((v || 0) * CAR_TONES.length) % CAR_TONES.length]] || tn.prop;

function car(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const C = D.prop.car, base = p.y || 0;
  // a car seen across the section is 1.8 m wide, along it 4.5 m long
  const L = Math.abs(Math.cos((p.rot * Math.PI) / 180)) > 0.5 ? C.w : C.l;
  const X = sx(p.u), Y0 = sy(base), Y1 = sy(base + C.h);
  const wpx = Math.max(2, L * A.scale), hpx = Math.max(1.5, Y0 - Y1);
  footing(A, X, Y0, wpx, alpha);
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = carTone(tn, p.v);
  if (hpx < 3) { ctx.fillRect(X - wpx / 2, Y1, wpx, hpx); ctx.restore(); return; }
  ctx.beginPath();
  ctx.moveTo(X - wpx / 2, Y0); ctx.lineTo(X - wpx / 2, Y1 + hpx * 0.45);
  ctx.lineTo(X - wpx * 0.22, Y1); ctx.lineTo(X + wpx * 0.18, Y1);
  ctx.lineTo(X + wpx / 2, Y1 + hpx * 0.45); ctx.lineTo(X + wpx / 2, Y0);
  ctx.closePath(); ctx.fill();
  if (wpx > 10) {
    // glazing, then the wheels: a car is a shape, not a lozenge
    ctx.fillStyle = TONE_KEY === 'light' ? 'rgba(40,52,64,0.42)' : 'rgba(150,180,210,0.22)';
    ctx.beginPath();
    ctx.moveTo(X - wpx * 0.30, Y1 + hpx * 0.42); ctx.lineTo(X - wpx * 0.17, Y1 + hpx * 0.08);
    ctx.lineTo(X + wpx * 0.14, Y1 + hpx * 0.08); ctx.lineTo(X + wpx * 0.30, Y1 + hpx * 0.42);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2a2c';
    for (const s of [-0.3, 0.3]) { ctx.beginPath(); ctx.arc(X + s * wpx, Y0 - hpx * 0.12, hpx * 0.17, 0, 7); ctx.fill(); }
    if (TONE_KEY !== 'light') {
      ctx.fillStyle = tn.window; ctx.globalAlpha = alpha * 0.9;
      ctx.fillRect(X + wpx * 0.40, Y0 - hpx * 0.5, wpx * 0.1, hpx * 0.18);
    }
  }
  ctx.restore();
}

function bus(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const B = D.prop.bus, base = p.y || 0;
  const L = Math.abs(Math.cos((p.rot * Math.PI) / 180)) > 0.5 ? B.w : B.l;
  const X = sx(p.u), Y0 = sy(base), Y1 = sy(base + B.h);
  const wpx = Math.max(2.5, L * A.scale), hpx = Math.max(2, Y0 - Y1);
  ctx.save(); ctx.globalAlpha = alpha;
  rect(ctx, X - wpx / 2, Y1, X + wpx / 2, Y0, tn.prop);
  if (hpx > 8 && wpx > 8) {
    ctx.globalAlpha = alpha * 0.8;
    rect(ctx, X - wpx * 0.44, Y1 + hpx * 0.1, X + wpx * 0.44, Y1 + hpx * 0.33, tn.window);
    rect(ctx, X - wpx * 0.44, Y1 + hpx * 0.5, X + wpx * 0.44, Y1 + hpx * 0.72, tn.window);
  }
  ctx.restore();
}

function tree(A, p, alpha, detail, T) {
  const { ctx, sx, sy, tn } = A;
  const base = p.y || 0, v = 0.85 + (p.v || 0.5) * 0.3;
  const hh = T.h * v, X = sx(p.u), Y0 = sy(base), Y1 = sy(base + hh);
  const hpx = Y0 - Y1;
  ctx.save(); ctx.globalAlpha = alpha;
  if (hpx < 4) { ctx.fillStyle = tn.park; ctx.fillRect(X - 1.5, Y1, 3, hpx); ctx.restore(); return; }
  footing(A, X, Y0, Math.max(3, T.canopyR * 0.7 * A.scale), alpha);
  ctx.strokeStyle = tn.trunk; ctx.lineWidth = Math.max(1, T.trunkR * 2 * A.scale);
  ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, sy(base + hh * 0.42)); ctx.stroke();
  const r = T.canopyR * v * A.scale;
  ctx.fillStyle = (p.v || 0) > 0.72 ? tn.parkAlt : tn.park;
  if (detail > 0 && r > 8) {
    for (const [dx, dy, k] of [[0, 0, 1], [-0.55, 0.3, 0.68], [0.55, 0.28, 0.66], [0, -0.45, 0.6]]) {
      ctx.beginPath(); ctx.arc(X + dx * r, sy(base + hh * 0.72) + dy * r, r * k, 0, 7); ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.arc(X, sy(base + hh * 0.72), r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function lamp(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const hh = p.h || D.prop.lamp.h, base = p.y || 0;
  const X = sx(p.u), Y0 = sy(base), Y1 = sy(base + hh);
  if (Y0 - Y1 < 7) return;              // the head alone is a speck of dust
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = tn.metal; ctx.lineWidth = Math.max(1, 0.2 * A.scale);
  ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, Y1);
  ctx.lineTo(X + D.prop.lamp.armL * A.scale, Y1); ctx.stroke();
  if (TONE_KEY !== 'light') {
    ctx.fillStyle = tn.flood; ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath(); ctx.arc(X + D.prop.lamp.armL * A.scale, Y1 + 2, Math.max(1.5, 0.3 * A.scale), 0, 7); ctx.fill();
  }
  ctx.restore();
}

function flag(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const X = sx(p.u), Y0 = sy(0), Y1 = sy(1.5);
  if (Y0 - Y1 < 4) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = tn.prop; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, Y1); ctx.stroke();
  ctx.fillStyle = tn.pitchline;
  ctx.fillRect(X, Y1, Math.max(2, 0.4 * A.scale), Math.max(2, 0.3 * A.scale));
  ctx.restore();
}

function lightCluster(A, p) {
  const { ctx, sx, sy, tn, span } = A;
  if (fade(span, D.lod.floodDetail) <= 0) return;
  const X = sx(p.u), Y = sy(p.y || D.roof.ringBottom);
  ctx.save();
  rect(ctx, X - 1.5 * A.scale, Y - 0.8 * A.scale, X + 1.5 * A.scale, Y, tn.metal);
  if (TONE_KEY !== 'light') {
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, 120);
    g.addColorStop(0, tn.flood); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(X, Y, 120, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ── the model's flat ground, stated outright ───────────────────────────
   The idealised projectile lands on a flat plane at y = 0 that runs under
   everything, stands included. Hiding that would be a lie, so it is drawn:
   solid where the ground really is open, a hairline where scenery sits over it. */
function datumLine(A) {
  const { ctx, w, sx, sy, tn, section } = A;
  const Y = Math.round(sy(0)) + 0.5;
  // Where the ground really is open the datum is solid; where scenery stands
  // over it the same plane continues as a hairline, because the model's flat
  // ground runs under the stands whether or not the building does.
  const covered = [];
  for (const b of section.blocks) {
    if (b.y1 - b.y0 < 1.5) continue;
    covered.push([Math.min(sx(b.u0), sx(b.u1)), Math.max(sx(b.u0), sx(b.u1))]);
  }
  for (const d of section.decks) {
    const prof = deckProfile(d);
    const us = prof.flatMap((q) => [q.u0, q.u1]);
    covered.push([sx(Math.min(...us)), sx(Math.max(...us))]);
  }
  covered.sort((a, b) => a[0] - b[0]);
  ctx.save();
  ctx.strokeStyle = cssVar('--axis', tn.prop);
  let x = 0;
  for (const [a, b] of covered) {
    if (b < 0 || a > w) continue;
    if (a > x) { ctx.setLineDash([]); ctx.lineWidth = 2; line(ctx, x, Math.min(a, w), Y); }
    ctx.setLineDash([3, 7]); ctx.lineWidth = 1;
    line(ctx, Math.max(x, a), Math.min(b, w), Y);
    x = Math.max(x, b);
  }
  if (x < w) { ctx.setLineDash([]); ctx.lineWidth = 2; line(ctx, x, w, Y); }
  ctx.restore();
}
const line = (ctx, x0, x1, y) => {
  if (x1 <= x0) return;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
};

/* ── readability chrome ─────────────────────────────────────────────── */

/** A bar whose length is a round number of metres. */
const BAR_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
export function scaleBar(A, x, y) {
  const { ctx, tn } = A;
  // The largest round number that still FITS. Rounding to a nice step and
  // hoping was how a 5 m bar came to be 256 px long and off the canvas.
  let step = BAR_STEPS[0];
  for (const c of BAR_STEPS) { if (c * A.scale <= 175) step = c; }
  const px = step * A.scale;
  ctx.save();
  ctx.strokeStyle = cssVar('--ink-strong', tn.prop); ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
  ctx.moveTo(x, y); ctx.lineTo(x + px, y);
  ctx.moveTo(x + px, y - 5); ctx.lineTo(x + px, y + 5);
  ctx.moveTo(x + px / 2, y - 3); ctx.lineTo(x + px / 2, y + 3);
  ctx.stroke(); ctx.restore();
  return { px, step, label: step >= 1000 ? `${step / 1000} km` : `${step} m` };
}

/** Heights up the left edge, labelled against things you can see. */
export function heightRuler(A, L, contentTop = Infinity) {
  const { ctx, h, sy, tn } = A;
  // Graduating to 300 m for a world 48 m tall is a ruler measuring the sky.
  const top = Math.min(A.py(0), Math.max(contentTop * 1.12, 12));
  const bottom = A.py(h);
  const step = niceStep(top - bottom, 6);
  const X = 54;
  const lo = Math.max(0, Math.floor(bottom / step) * step);
  let hi = lo;
  for (let y = lo; y <= top; y += step) { const Y = sy(y); if (Y >= 10 && Y <= h - 10) hi = y; }
  const hiY = sy(hi);
  ctx.save();
  ctx.strokeStyle = cssVar('--border', tn.prop); ctx.lineWidth = 1;
  ctx.beginPath();
  // minor graduations at a fifth of the step, so the ruler is a ruler
  for (let y = lo; y <= hi; y += step / 5) {
    const Y = Math.round(sy(y)) + 0.5;
    if (Y < 10 || Y > h - 10) continue;
    ctx.moveTo(X - 4, Y); ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.lineWidth = 1.6;
  for (let y = lo; y <= hi; y += step) {
    const Y = Math.round(sy(y)) + 0.5;
    if (Y < 10 || Y > h - 10) continue;
    ctx.moveTo(X - 9, Y); ctx.lineTo(X, Y);
    L.add(`${fmt(y, step < 1 ? 1 : 0)}`, X - 13, Y,
          { color: cssVar('--ink-muted', tn.prop), align: 'right', pri: -1, size: 13, bg: false });
  }
  // the stem stops at the topmost tick; above that it was a stray line
  ctx.moveTo(X + .5, Math.round(hiY) + .5); ctx.lineTo(X + .5, Math.min(h - 8, sy(0)));
  ctx.stroke(); ctx.restore();
}

/** Heights worth naming, each anchored to the thing in THIS cut that has it.
    A label for a crossbar the cutting plane never touches is a label pointing
    at nothing, so nothing comes back unless the object is actually here. */
export function landmarksIn(section, uMin, uMax) {
  const out = [];
  const vis = (u) => u > uMin && u < uMax;
  const R = section.roof;
  for (const wing of R.wings) {
    if (vis(wing.outerU)) { out.push({ y: R.fasciaTop, u: wing.outerU, name: `roof rim ${R.fasciaTop} m` }); break; }
  }
  for (const wing of R.wings) {
    if (wing.open && vis(wing.inner)) { out.push({ y: R.ringTop, u: wing.inner, name: `roof over the pitch ${R.ringTop} m` }); break; }
  }
  for (const deck of section.decks) {
    for (const el of deckProfile(deck)) {
      if (el.t !== 'tier') continue;
      if (/upper tier/.test(el.name) && vis(el.u0)) out.push({ y: el.y0, u: el.u0, name: `upper tier front ${fmt(el.y0, 0)} m` });
      if (/^lower tier$|^tier 1$/.test(el.name) && vis(el.u1)) out.push({ y: el.y1, u: el.u1, name: `back of the lower tier ${fmt(el.y1, 0)} m` });
    }
  }
  for (const b of section.blocks) {
    if (b.tag === 'crossbar' && vis(b.u0)) { out.push({ y: b.y1, u: Math.max(b.u0, b.u1), name: `crossbar ${fmt(b.y1, 2)} m` }); break; }
  }
  const byY = new Map();
  for (const m of out) if (!byY.has(m.y)) byY.set(m.y, m);
  return [...byY.values()];
}
