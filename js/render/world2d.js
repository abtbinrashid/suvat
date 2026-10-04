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
  skyTop: '--sky-top', skyBottom: '--sky-bottom', haze: '--haze',
  grass: '--grass', grassAlt: '--grass-alt', runoff: '--runoff',
  pitchline: '--pitchline', concrete: '--concrete', paving: '--paving',
  asphalt: '--asphalt', roadline: '--roadline', ballast: '--ballast',
  brick: '--brick', roofing: '--roofing', window: '--window',
  glass: '--glass', metal: '--metal', net: '--net',
  seat: '--seat', seatAlt: '--seat-alt', board: '--board',
  structure: '--structure', structureDark: '--structure-dark',
  roofTop: '--roof-top', roofUnder: '--roof-under',
  prop: '--prop', water: '--water', park: '--park',
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
export const dropToneCache = () => { TONE = null; };

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

  sky(A);
  farField(A);
  surfaces(A);
  groundMarks(A);
  blocks(A);
  decks(A);
  roofSection(A);
  props(A);
  datumLine(A);
}

/* ── sky ────────────────────────────────────────────────────────────── */
function sky({ ctx, w, h, sy, tn }) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tn.skyTop);
  g.addColorStop(1, tn.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // A section has no atmosphere in it, so the haze is a hint and no more:
  // just enough to stop the far district cutting the sky like a blade.
  const gy = sy(0);
  if (gy > 0 && gy < h) {
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
  if (gy < h) { ctx.fillStyle = tn.earth; ctx.fillRect(0, Math.max(0, gy), w, h - Math.max(0, gy)); }
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
      if (!A.vis(m.u0, m.u1)) continue;
      ctx.fillRect(sx(m.u0), yTop, sx(m.u1) - sx(m.u0), 3);
    } else {
      if (!A.vis(m.u, m.u)) continue;
      const wpx = Math.max(2, m.w * A.scale);
      ctx.fillRect(sx(m.u) - wpx / 2, yTop, wpx, 3.4);
    }
    ctx.globalAlpha = 1;
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
      if (b.gable) {
        // cut across a row: the gable end, so the ridge shows as a peak
        poly(ctx, [{ x: x0, y: yB }, { x: x0, y: eavesY }, { x: (x0 + x1) / 2, y: yT },
                   { x: x1, y: eavesY }, { x: x1, y: yB }], tn.brick);
        poly(ctx, [{ x: x0 - 1, y: eavesY }, { x: (x0 + x1) / 2, y: yT }, { x: x1 + 1, y: eavesY }], tn.roofing);
      } else {
        // cut along a row: a long wall under a ridge seen end-on
        rect(ctx, x0, eavesY, x1, yB, tn.brick);
        rect(ctx, x0, yT, x1, eavesY, tn.roofing);
        if (detF > 0) windowsAlong(A, b, eavesY, yB, detF * houseF);
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
function windowsAlong(A, b, eavesY, yB, alpha) {
  const { ctx, sx, tn } = A;
  const n = Math.floor(Math.abs(b.u1 - b.u0) / D.house.front);
  if (n < 1 || n > 400) return;
  const wpx = D.house.front * A.scale;
  if (wpx < 7) return;
  ctx.globalAlpha = alpha;
  const hgt = yB - eavesY;
  for (let i = 0; i < n; i++) {
    const X = sx(Math.min(b.u0, b.u1) + (i + 0.5) * D.house.front);
    const lit = TONE_KEY !== 'light' && ((i * 7) % 5 < 2);
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
    poly(ctx, [{ x: sx(lo), y: sy(0) }, ...top, { x: sx(hi), y: sy(0) }], tn.interior);
    interiorStructure(A, deck, prof, lo, hi);

    /* 2 · each cut element, in the order it is built */
    let below = 0;
    for (const p of prof) {
      if (p.t === 'tier') {
        const steps = stepPts(p);
        const isGround = p === prof[0];
        // the raking slab — or, for the lowest tier, the solid bank it sits on
        const under = isGround
          ? [{ u: p.u1, y: 0 }, { u: p.u0, y: 0 }]
          : [{ u: p.u1, y: p.y1 - SLAB }, { u: p.u0, y: p.y0 - SLAB }];
        poly(ctx, [...steps, ...under].map((q) => ({ x: sx(q.u), y: sy(q.y) })),
             tn.structureDark, tn.structure, 1.1);
        if (!isGround) {
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
function interiorStructure(A, deck, prof, lo, hi) {
  const { ctx, sx, sy, tn } = A;
  const sgn = prof[0].s;
  const floors = [];
  for (const p of prof) {
    if (p.t === 'deck') floors.push({ y: p.y0, u0: p.u0, u1: Math.max(p.u1, p.u0 + sgn * 26) });
    if (p.t === 'tier' && p !== prof[0]) floors.push({ y: p.y0 - SLAB - 2.6, u0: p.u0, u1: p.u1 });
  }
  ctx.save();
  // the column grid, from the ground up to whatever is over it
  ctx.globalAlpha = 0.5; ctx.strokeStyle = tn.structure;
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
  ctx.globalAlpha = 0.85; ctx.fillStyle = tn.concrete;
  for (const f of floors) {
    const y = sy(f.y);
    if (f.y < 1) continue;
    ctx.fillRect(Math.min(sx(f.u0), sx(f.u1)), y, Math.abs(sx(f.u1) - sx(f.u0)), Math.max(1.5, 0.35 * A.scale));
  }
  // a stair core: the one piece of a stand you can always find in a section
  const coreU = lo + (hi - lo) * 0.62, coreW = 5.5;
  const coreTop = Math.max(...prof.map((p) => Math.max(p.y0, p.y1))) * 0.62;
  if (coreTop * A.scale > 24) {
    ctx.globalAlpha = 0.3; ctx.strokeStyle = tn.structure;
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

/** Seats: a continuous band of them at any zoom, resolved into rows up close. */
function seating(A, p) {
  const { ctx, sx, sy, tn, span } = A;
  const rowF = fade(span, D.lod.seatRows), texF = fade(span, D.lod.seatTexture);
  const stepPx = Math.abs(p.rowD * A.scale);

  // The band is drawn at every zoom. Without it a stand is a grey wedge, and
  // a grey wedge tells you nothing about how many people it holds.
  const steps = stepPts(p);
  const up = steps.map((q) => ({ x: sx(q.u), y: sy(q.y + SEAT_BAND) }));
  poly(ctx, [...up, ...steps.slice().reverse().map((q) => ({ x: sx(q.u), y: sy(q.y) }))], tn.seat);

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
    // TODO crowd(A, p, rowF) — never defined, and the call threw on every
    // 2D render at close zoom. Parked rather than invented.
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
    ctx.strokeStyle = tn.roofTop; ctx.lineWidth = Math.max(2, 0.6 * A.scale);
    ctx.beginPath(); ctx.moveTo(sx(inner), sy(R.ringTop)); ctx.lineTo(sx(outer), sy(R.outerStructure)); ctx.stroke();
    // the outer fascia blade, whose top is 48 m — the highest thing there is
    rect(ctx, sx(outer), sy(R.fasciaTop), sx(outer + sgn * 0.9), sy(R.fasciaBottom), tn.roofTop);
    // the compression ring, in section
    rect(ctx, sx(inner), sy(R.ringTop), sx(inner + sgn * 2.5), sy(R.ringBottom), tn.metal);
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
        const far = sx(inner - sgn * Math.abs(inner) * 1.9), gy = sy(0);
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

function car(A, p, alpha) {
  const { ctx, sx, sy, tn } = A;
  const C = D.prop.car, base = p.y || 0;
  // a car seen across the section is 1.8 m wide, along it 4.5 m long
  const L = Math.abs(Math.cos((p.rot * Math.PI) / 180)) > 0.5 ? C.w : C.l;
  const X = sx(p.u), Y0 = sy(base), Y1 = sy(base + C.h);
  const wpx = Math.max(2, L * A.scale), hpx = Math.max(1.5, Y0 - Y1);
  footing(A, X, Y0, wpx, alpha);
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = tn.prop;
  if (hpx < 3) { ctx.fillRect(X - wpx / 2, Y1, wpx, hpx); ctx.restore(); return; }
  ctx.beginPath();
  ctx.moveTo(X - wpx / 2, Y0); ctx.lineTo(X - wpx / 2, Y1 + hpx * 0.45);
  ctx.lineTo(X - wpx * 0.22, Y1); ctx.lineTo(X + wpx * 0.18, Y1);
  ctx.lineTo(X + wpx / 2, Y1 + hpx * 0.45); ctx.lineTo(X + wpx / 2, Y0);
  ctx.closePath(); ctx.fill();
  if (wpx > 10) {
    ctx.fillStyle = tn.structureDark;
    for (const s of [-0.3, 0.3]) { ctx.beginPath(); ctx.arc(X + s * wpx, Y0 - hpx * 0.12, hpx * 0.17, 0, 7); ctx.fill(); }
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
  ctx.strokeStyle = tn.brick; ctx.lineWidth = Math.max(1, T.trunkR * 2 * A.scale);
  ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, sy(base + hh * 0.42)); ctx.stroke();
  const r = T.canopyR * v * A.scale;
  ctx.fillStyle = tn.park;
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
export function scaleBar(A, x, y) {
  const { ctx, tn } = A;
  const want = 150 / A.scale;                           // aim for ~150 px
  const step = niceStep(want * 2, 2);
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
export function heightRuler(A, L) {
  const { ctx, h, sy, tn } = A;
  const top = A.py(0), bottom = A.py(h);
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
