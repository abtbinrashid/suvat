// world.js — the stadium and the district around it, built once.
//
// ONE MODEL, TWO PROJECTIONS. Everything below is stored in world metres and
// nothing is stored twice. The 2D view takes a CROSS-SECTION of it; the 3D view
// EXTRUDES the same records. That is the only way the two views can be
// guaranteed to show identical geometry at identical positions, so it is worth
// the indirection.
//
// Record kinds:
//   ground   a flat surface at one height          {x0,x1,z0,z1,y,tone}
//   solid    an axis-aligned box, optional ridge   {x0,x1,z0,z1,y0,y1,tone}
//   paint    a marking lying on a surface          {kind,...,tone}
//   prop     a point instance of a scale reference {type,x,z,rot}
//   sides    the four seating decks, as sections
//   roof     the cable net on its elliptical ring
//
// Positions are deterministic: every "random" placement comes from a hash of
// its own index, so the 2D slice and the 3D extrusion agree exactly.

import { D, tierSteps } from './dims.js';

/* ── a hash that stands in for randomness ───────────────────────────── */
function h2(i, j, salt = 0) {
  let x = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  x = (x ^ (x >>> 13)) * 1274126177 | 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const jitter = (i, j, s, amt) => (h2(i, j, s) - 0.5) * 2 * amt;

/* ── plan helpers ───────────────────────────────────────────────────── */

/** Half-extent of a rounded rectangle along `axis`, at perpendicular p. */
export function roundedHalf(halfAlong, halfPerp, r, p) {
  const a = Math.abs(p);
  if (a <= halfPerp - r) return halfAlong;
  const d = a - (halfPerp - r);
  if (d >= r) return null;                       // the cut misses this side
  return halfAlong - r + Math.sqrt(r * r - d * d);
}

/** Outline of a rounded rectangle, for the 3D view and for plan maps. */
export function roundedRect(halfL, halfW, r, n = 10) {
  const pts = [];
  const corner = (cx, cz, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
    }
  };
  corner(halfL - r, halfW - r, 0);
  corner(-(halfL - r), halfW - r, Math.PI / 2);
  corner(-(halfL - r), -(halfW - r), Math.PI);
  corner(halfL - r, -(halfW - r), -Math.PI / 2);
  return pts;
}

/* ── the build ──────────────────────────────────────────────────────── */
let WORLD = null;
export function world() { return WORLD || (WORLD = build()); }

function build() {
  const ground = [], solids = [], paint = [], props = [], bayRows = [], rowsOfHouses = [];
  const G = (x0, x1, z0, z1, y, tone, tag) => ground.push({ x0, x1, z0, z1, y, tone, tag });
  const S = (x0, x1, z0, z1, y0, y1, tone, tag, extra) =>
    solids.push({ x0, x1, z0, z1, y0, y1, tone, tag, ...extra });
  const PR = (type, x, z, rot = 0, extra) => props.push({ type, x, z, rot, ...extra });

  /* ── the district floor, outward in ───────────────────────────────── */
  const FAR = 9000;
  G(-FAR, FAR, -FAR, FAR, 0, 'ground', 'district');

  for (const p of D.parks) {
    G(p.x[0], p.x[1], p.z[0], p.z[1], 0, 'park', 'park:' + p.id);
    if (p.pond) G(p.pond.x[0], p.pond.x[1], p.pond.z[0], p.pond.z[1], 0, 'water', 'pond');
    // a path through the middle, and mature trees on a jittered grid
    G(p.x[0], p.x[1], (p.z[0] + p.z[1]) / 2 - 1.5, (p.z[0] + p.z[1]) / 2 + 1.5, 0, 'paving', 'path');
    const step = 22;
    const ni = Math.floor((p.x[1] - p.x[0]) / step), nj = Math.floor((p.z[1] - p.z[0]) / step);
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      if (h2(i, j, 7) < 0.42) continue;
      const x = p.x[0] + (i + 0.5) * step + jitter(i, j, 11, 7);
      const z = p.z[0] + (j + 0.5) * step + jitter(i, j, 13, 7);
      if (p.pond && x > p.pond.x[0] - 8 && x < p.pond.x[1] + 8 && z > p.pond.z[0] - 8 && z < p.pond.z[1] + 8) continue;
      if (Math.abs(z - (p.z[0] + p.z[1]) / 2) < 5) continue;
      PR(h2(i, j, 17) > 0.25 ? 'tree' : 'treeYoung', x, z, 0, { v: h2(i, j, 19) });
    }
  }

  /* terraced streets — stored as ROWS, not as 1700 separate houses. The
     renderer draws the 5.5 m frontage rhythm along a row when zoomed in and
     one long block when it is not. */
  const H = D.house;
  const MOD = H.street + H.depth + H.garden * 2 + H.depth;   // 48 m
  for (const t of D.terraces) {
    const along = t.along;                            // houses run along this axis
    const per = along === 'x' ? t.z : t.x;            // modules stack across it
    const run = along === 'x' ? t.x : t.z;
    G(t.x[0], t.x[1], t.z[0], t.z[1], 0, 'paving', 'streets');
    for (let m = 0; (m + 1) * MOD <= per[1] - per[0] + 1e-6; m++) {
      const base = per[0] + m * MOD;
      const street = [base, base + H.street];
      const a = [base + H.street, base + H.street + H.depth];
      const b = [base + MOD - H.depth, base + MOD];
      if (along === 'x') {
        G(t.x[0], t.x[1], street[0], street[1], 0, 'asphalt', 'street');
        rowsOfHouses.push({ along, run, perp: a, face: +1, seed: m * 3 + 1 });
        rowsOfHouses.push({ along, run, perp: b, face: -1, seed: m * 3 + 2 });
      } else {
        G(street[0], street[1], t.z[0], t.z[1], 0, 'asphalt', 'street');
        rowsOfHouses.push({ along, run, perp: a, face: +1, seed: m * 3 + 1 });
        rowsOfHouses.push({ along, run, perp: b, face: -1, seed: m * 3 + 2 });
      }
    }
  }
  for (const r of rowsOfHouses) {
    const [p0, p1] = r.perp;
    if (r.along === 'x') S(r.run[0], r.run[1], p0, p1, 0, H.ridge, 'brick', 'terrace', { ridge: 'z', eaves: H.eaves, row: r });
    else S(p0, p1, r.run[0], r.run[1], 0, H.ridge, 'brick', 'terrace', { ridge: 'x', eaves: H.eaves, row: r });
  }

  /* car parks — stored as rows of bays */
  for (const p of D.carParks) {
    G(p.x[0], p.x[1], p.z[0], p.z[1], 0, 'asphalt', 'carpark:' + p.id);
    const CP = D.carPark, mod = CP.bayL * 2 + CP.aisle;      // 15.6
    const across = p.along === 'x' ? p.z : p.x;
    const run = p.along === 'x' ? p.x : p.z;
    const n = Math.floor((across[1] - across[0]) / mod);
    for (let k = 0; k < n; k++) {
      const b0 = across[0] + k * mod;
      for (const [edge, face] of [[b0, +1], [b0 + CP.bayL * 2, -1]]) {
        bayRows.push({ along: p.along, run, edge, face, seed: k * 5 + (face > 0 ? 1 : 2), park: p.id });
      }
    }
    for (let k = 0; k <= n; k++) {
      const yv = across[0] + k * mod + CP.bayL;
      if (p.along === 'x') PR('lamp', p.x[0] + 14 + ((k * 53) % Math.max(1, p.x[1] - p.x[0] - 28)), yv, 0, { h: CP.lampH });
      else PR('lamp', yv, p.z[0] + 14 + ((k * 53) % Math.max(1, p.z[1] - p.z[0] - 28)), 0, { h: CP.lampH });
    }
  }
  // the cars themselves, from the bay rows
  for (const r of bayRows) {
    const CP = D.carPark;
    const n = Math.floor((r.run[1] - r.run[0]) / CP.bayW);
    for (let i = 0; i < n; i++) {
      if (h2(i, r.seed, 23) > CP.fill) continue;
      const along = r.run[0] + (i + 0.5) * CP.bayW;
      const perp = r.edge + r.face * CP.bayL * 0.5;
      if (r.along === 'x') PR('car', along, perp, 90, { v: h2(i, r.seed, 29) });
      else PR('car', perp, along, 0, { v: h2(i, r.seed, 29) });
    }
  }

  /* ── the main road, north side ───────────────────────────────────── */
  const R = D.road, RX = [-1200, 1200];
  const strip = (zz, tone, tag) => G(RX[0], RX[1], zz[0], zz[1], 0, tone, tag);
  strip(R.pavement, 'paving', 'pavement');
  strip(R.carriagewayB, 'asphalt', 'carriageway');
  strip(R.median, 'park', 'median');
  strip(R.carriagewayA, 'asphalt', 'carriageway');
  strip(R.pavementWide, 'paving', 'wide pavement');
  strip(R.forecourt, 'paving', 'forecourt');
  for (const cw of [R.carriagewayA, R.carriagewayB]) {
    const mid = (cw[0] + cw[1]) / 2;
    paint.push({ kind: 'dashed', axis: 'x', a: RX, p: mid, w: 0.15, dash: [4, 8], tone: 'roadline', tag: 'lane line' });
    paint.push({ kind: 'line', axis: 'x', a: RX, p: cw[0] + 0.3, w: 0.15, tone: 'roadline' });
    paint.push({ kind: 'line', axis: 'x', a: RX, p: cw[1] - 0.3, w: 0.15, tone: 'roadline' });
  }
  for (let x = RX[0]; x <= RX[1]; x += R.lampEvery) PR('lamp', x, R.median[0] + 1.2, 0, { h: R.lampH });
  for (let x = RX[0]; x <= RX[1]; x += R.treeEvery) {
    if (Math.abs(x) < 70) continue;
    PR('tree', x + jitter(x, 0, 31, 2), (R.pavementWide[0] + R.pavementWide[1]) / 2 - 3.5, 0, { v: h2(x, 1, 37) });
  }
  // traffic: parked and moving, laid out so the 4.5 m car and the 4.4 m bus
  // sit side by side as a scale pair near the halfway line.
  for (let i = 0; i < 160; i++) {
    const x = -1180 + i * 14.8 + jitter(i, 0, 41, 3);
    const lane = i % 4;
    const cw = lane < 2 ? R.carriagewayA : R.carriagewayB;
    const z = cw[0] + 1.75 + (lane % 2) * 3.5;
    if (h2(i, 0, 43) < 0.45) continue;
    PR(h2(i, 0, 47) > 0.86 ? 'bus' : 'car', x, z, lane < 2 ? 90 : -90, { v: h2(i, 0, 53) });
  }

  /* west-side street, so the long-axis section has a road in it too */
  const RW = D.roadW, RZ = [-900, 900];
  G(RW.x[0] - RW.pavement, RW.x[1] + RW.pavement, RZ[0], RZ[1], 0, 'paving', 'pavement');
  G(RW.x[0], RW.x[1], RZ[0], RZ[1], 0, 'asphalt', 'carriageway');
  paint.push({ kind: 'dashed', axis: 'z', a: RZ, p: (RW.x[0] + RW.x[1]) / 2, w: 0.15, dash: [4, 8], tone: 'roadline' });
  for (let z = RZ[0]; z <= RZ[1]; z += RW.lampEvery) PR('lamp', RW.x[1] + 2, z, 0, { h: R.lampH });
  for (let i = 0; i < 90; i++) {
    const z = RZ[0] + i * 20 + jitter(i, 2, 59, 3);
    if (h2(i, 2, 61) < 0.55) continue;
    PR('car', RW.x[0] + 4 + (i % 2) * 8, z, 0, { v: h2(i, 2, 67) });
  }

  /* ── the station ─────────────────────────────────────────────────── */
  const ST = D.station;
  G(ST.x[0] - 30, ST.x[1] + 30, ST.z[0] - 40, R.pavement[0], 0, 'paving', 'station forecourt');
  S(ST.x[0], ST.x[1], ST.z[0], ST.z[1], 0, ST.roofY, 'glass', 'station', { glazed: true });
  S(ST.x[0] - 4, ST.x[1] + 4, ST.canopy.z[0], ST.canopy.z[1], ST.canopy.y - 0.5, ST.canopy.y, 'metal', 'platform canopy', { canopy: true });
  for (let k = 0; k < ST.tracks.n; k++) {
    const z = ST.tracks.z[0] + 2 + k * ST.tracks.spacing;
    G(ST.x[0] - 160, ST.x[1] + 160, z - 1.6, z + 1.6, 0, 'ballast', 'track bed');
    paint.push({ kind: 'line', axis: 'x', a: [ST.x[0] - 160, ST.x[1] + 160], p: z - ST.tracks.gauge / 2, w: 0.12, tone: 'metal' });
    paint.push({ kind: 'line', axis: 'x', a: [ST.x[0] - 160, ST.x[1] + 160], p: z + ST.tracks.gauge / 2, w: 0.12, tone: 'metal' });
  }
  for (let i = 0; i < 40; i++) PR('person', ST.x[0] + 6 + i * 2.9, ST.z[1] + 6 + jitter(i, 3, 71, 9), 0, { v: h2(i, 3, 73) });

  /* ── podium plaza ────────────────────────────────────────────────── */
  // The plaza is a RING round the bowl, not a disc under it. Drawn as a disc
  // it paves over the pitch, which is exactly the sort of thing that only
  // shows up when the same record has to serve a section and a bird's eye.
  const PD = D.podium, BW = D.bowl;
  S(-PD.halfL, -BW.halfL, -PD.halfW, PD.halfW, 0, PD.y, 'concrete', 'podium');
  S(BW.halfL, PD.halfL, -PD.halfW, PD.halfW, 0, PD.y, 'concrete', 'podium');
  S(-BW.halfL, BW.halfL, -PD.halfW, -BW.halfW, 0, PD.y, 'concrete', 'podium');
  S(-BW.halfL, BW.halfL, BW.halfW, PD.halfW, 0, PD.y, 'concrete', 'podium');
  // steps down to the forecourt and to the south
  for (let i = 0; i < PD.stepN; i++) {
    const t = i / PD.stepN, y = PD.y * (1 - t);
    S(-70, 70, -PD.halfW - (i + 1) * 0.9, -PD.halfW - i * 0.9, 0, y, 'concrete', 'steps');
    S(-70, 70, PD.halfW + i * 0.9, PD.halfW + (i + 1) * 0.9, 0, y, 'concrete', 'steps');
  }
  // people on the plaza, in the ring and never on the pitch
  for (let i = 0; i < 180; i++) {
    const a = h2(i, 5, 79) * Math.PI * 2, k = h2(i, 5, 83);
    const x = Math.cos(a), z = Math.sin(a);
    const r0 = Math.min(BW.halfL / Math.max(0.08, Math.abs(x)), BW.halfW / Math.max(0.08, Math.abs(z)));
    const r1 = Math.min(PD.halfL / Math.max(0.08, Math.abs(x)), PD.halfW / Math.max(0.08, Math.abs(z)));
    const r = r0 + 4 + k * Math.max(2, r1 - r0 - 8);
    PR('person', x * r, z * r, 0, { v: h2(i, 5, 89), y: PD.y });
  }
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const x = Math.cos(a), z = Math.sin(a);
    const r1 = Math.min(PD.halfL / Math.max(0.08, Math.abs(x)), PD.halfW / Math.max(0.08, Math.abs(z)));
    PR('treeYoung', x * (r1 - 7), z * (r1 - 7), 0, { v: h2(i, 6, 97), y: PD.y });
  }

  /* ── the grass, the lines, the goals, the hoardings ──────────────── */
  const P = D.pitch, SU = D.surface;
  G(-SU.halfL, SU.halfL, -SU.halfW, SU.halfW, 0, 'runoff', 'run-off');
  G(-P.halfL, P.halfL, -P.halfW, P.halfW, 0, 'grass', 'pitch');
  for (let i = 0; i < P.stripes; i++) {
    if (i % 2) continue;
    G(-P.halfL + i * P.stripeW, -P.halfL + (i + 1) * P.stripeW, -P.halfW, P.halfW, 0, 'grassAlt', 'mowing stripe');
  }
  const L = P.lineW;
  const box = (x0, x1, z0, z1) => {
    paint.push({ kind: 'line', axis: 'x', a: [x0, x1], p: z0, w: L, tone: 'pitchline' });
    paint.push({ kind: 'line', axis: 'x', a: [x0, x1], p: z1, w: L, tone: 'pitchline' });
    paint.push({ kind: 'line', axis: 'z', a: [z0, z1], p: x0, w: L, tone: 'pitchline' });
    paint.push({ kind: 'line', axis: 'z', a: [z0, z1], p: x1, w: L, tone: 'pitchline' });
  };
  box(-P.halfL, P.halfL, -P.halfW, P.halfW);                      // touch and goal lines
  paint.push({ kind: 'line', axis: 'z', a: [-P.halfW, P.halfW], p: 0, w: L, tone: 'pitchline', tag: 'halfway' });
  paint.push({ kind: 'circle', x: 0, z: 0, r: P.centreCircleR, w: L, tone: 'pitchline', tag: 'centre circle' });
  paint.push({ kind: 'disc', x: 0, z: 0, r: P.centreSpotR, tone: 'pitchline', tag: 'centre spot' });
  for (const s of [-1, 1]) {
    const gl = s * P.halfL;
    box(gl, gl - s * P.penaltyDepth, -P.penaltyHalfW, P.penaltyHalfW);
    box(gl, gl - s * P.goalAreaDepth, -P.goalAreaHalfW, P.goalAreaHalfW);
    paint.push({ kind: 'disc', x: gl - s * P.penaltySpot, z: 0, r: P.centreSpotR, tone: 'pitchline' });
    paint.push({ kind: 'arc', x: gl - s * P.penaltySpot, z: 0, r: P.penaltyArcR, w: L, tone: 'pitchline',
                 clipX: s > 0 ? { max: gl - s * P.penaltyDepth } : { min: gl - s * P.penaltyDepth } });
    for (const t of [-1, 1]) paint.push({ kind: 'arc', x: gl, z: t * P.halfW, r: P.cornerArcR, w: L, tone: 'pitchline' });
    // the goal
    const gw = D.goal.width / 2, gh = D.goal.height, pr = D.goal.postR;
    for (const t of [-1, 1]) S(gl - s * pr, gl + s * pr, t * gw - pr, t * gw + pr, 0, gh, 'white', 'goalpost');
    S(gl - s * pr, gl + s * pr, -gw, gw, gh - pr * 2, gh, 'white', 'crossbar');
    S(gl, gl + s * D.goal.netDepth, -gw - 0.1, gw + 0.1, 0, gh, 'net', 'goal net', { net: true, mesh: D.goal.netMesh });
    PR('person', gl - s * 1.6, 0, 0, { v: 0.5, role: 'keeper' });
    PR('flag', gl, P.halfW, 0); PR('flag', gl, -P.halfW, 0);
  }
  // hoardings all the way round, in 2.4 m panels
  const B = D.boards;
  for (const s of [-1, 1]) {
    S(-B.atX, B.atX, s * B.atZ, s * B.atZ + s * B.depth, 0, B.height, 'board', 'hoarding', { panel: B.panel, axis: 'x' });
    S(s * B.atX, s * B.atX + s * B.depth, -B.atZ, B.atZ, 0, B.height, 'board', 'hoarding', { panel: B.panel, axis: 'z' });
  }
  S(-D.bench.length / 2, D.bench.length / 2, D.bench.atZ - D.bench.depth, D.bench.atZ, 0, D.bench.roofH, 'glass', 'technical area');

  /* the twenty-two, plus the referee: a kick-off shape, fixed forever */
  const FORM = [
    [-46, 0], [-34, -20], [-34, -7], [-34, 7], [-34, 20], [-20, -14], [-20, 0], [-20, 14],
    [-8, -22], [-8, 0], [-8, 22], [-2, -4],
    [46, 0], [34, 20], [34, 7], [34, -7], [34, -20], [20, 14], [20, 0], [20, -14],
    [8, 22], [8, 0], [8, -22], [3, 5],
  ];
  FORM.forEach(([x, z], i) => PR('person', x, z, 0, { v: (i % 7) / 7, role: i < 12 ? 'homeTeam' : 'awayTeam' }));
  PR('person', -4, -9, 0, { v: 0.3, role: 'referee' });

  /* ── the bowl: four sides, each a section swept along its front ───── */
  const sides = [
    { id: 'N', axis: 'z', sign: -1, spec: D.sides.NS },
    { id: 'S', axis: 'z', sign: +1, spec: D.sides.NS },
    { id: 'W', axis: 'x', sign: -1, spec: D.sides.W },
    { id: 'E', axis: 'x', sign: +1, spec: D.sides.E },
  ];

  /* ── the roof ────────────────────────────────────────────────────── */
  const roof = { ...D.roof, bowl: D.bowl };

  /* floodlighting: a continuous strip under the inner ring, plus corners */
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 4) + (i * Math.PI) / 2;
    PR('lightCluster', Math.cos(a) * D.roof.ringA * 0.96, Math.sin(a) * D.roof.ringB * 0.96, 0, { y: D.roof.ringBottom });
  }

  return { dims: D, ground, solids, paint, props, sides, roof, bayRows, rowsOfHouses,
           counts: { ground: ground.length, solids: solids.length, paint: paint.length, props: props.length } };
}

/* ── the cross-section ───────────────────────────────────────────────── */

/**
 * Cut the world along one axis and return everything the 2D view needs, all of
 * it already in section coordinates: u runs along the cut, y is height.
 *
 *   u = dir × (world coordinate along `axis`)
 *
 * so `dir = -1` simply mirrors the section, which is what a free kick shooting
 * west needs. `at` is the perpendicular coordinate of the cutting plane.
 */
export function slice({ axis, at, dir = 1, band = 9 }) {
  const W = world();
  const perpAxis = axis === 'x' ? 'z' : 'x';
  const U = (v) => dir * v;
  const span = (r) => {                                   // the cut's interval, or null
    const lo = r[axis + '0'], hi = r[axis + '1'];
    const p0 = r[perpAxis + '0'], p1 = r[perpAxis + '1'];
    if (at < Math.min(p0, p1) || at > Math.max(p0, p1)) return null;
    const a = U(lo), b = U(hi);
    return a <= b ? [a, b] : [b, a];
  };

  const surfaces = [];
  for (const g of W.ground) { const s = span(g); if (s) surfaces.push({ u0: s[0], u1: s[1], y: g.y, tone: g.tone, tag: g.tag }); }

  const blocks = [];
  for (const s of W.solids) {
    const iv = span(s);
    if (!iv) continue;
    blocks.push({ u0: iv[0], u1: iv[1], y0: s.y0, y1: s.y1, tone: s.tone, tag: s.tag,
                  ridge: s.ridge, eaves: s.eaves, net: s.net, mesh: s.mesh, glazed: s.glazed,
                  panel: s.panel, panelAxis: s.axis, canopy: s.canopy, row: s.row,
                  // a house row cut ACROSS shows its gable; cut ALONG shows the eaves
                  gable: s.ridge ? s.ridge !== axis : false });
  }

  const marks = [];
  for (const m of W.paint) {
    if (m.kind === 'line' || m.kind === 'dashed') {
      if (m.axis === axis) {                              // parallel: a long run at p
        if (Math.abs(at - m.p) > m.w / 2 + 1e-9) continue;
        marks.push({ u0: U(m.a[0]), u1: U(m.a[1]), tone: m.tone, run: true, tag: m.tag });
      } else {                                            // perpendicular: a single tick
        if (at < Math.min(...m.a) || at > Math.max(...m.a)) continue;
        marks.push({ u: U(m.p), w: m.w, tone: m.tone, tag: m.tag });
      }
    } else if (m.kind === 'circle' || m.kind === 'arc') {
      const d = at - m[perpAxis];
      if (Math.abs(d) > m.r) continue;
      const q = Math.sqrt(m.r * m.r - d * d);
      for (const sgn of [-1, 1]) {
        const v = m[axis] + sgn * q;
        if (m.clipX && ((m.clipX.max != null && v > m.clipX.max) || (m.clipX.min != null && v < m.clipX.min))) continue;
        marks.push({ u: U(v), w: m.w ?? 0.12, tone: m.tone, tag: m.tag });
      }
    } else if (m.kind === 'disc') {
      if (Math.abs(at - m[perpAxis]) > m.r) continue;
      marks.push({ u: U(m[axis]), w: m.r * 2, tone: m.tone, tag: m.tag });
    }
  }

  const near = [];
  for (const p of W.props) {
    const off = p[perpAxis] - at;
    if (Math.abs(off) > band) continue;
    near.push({ ...p, u: U(p[axis]), off: Math.abs(off) / band });
  }
  near.sort((a, b) => b.off - a.off);                     // far from the plane first

  /* the bowl sides this cut actually crosses, as (u,y) profiles */
  const decks = [];
  for (const s of W.sides) {
    if (s.axis !== axis) continue;                        // parallel to the cut: not crossed
    const half = roundedHalf(s.spec.front, axis === 'x' ? D.bowl.halfW : D.bowl.halfL,
                            0, at);                       // fronts are straight in the middle
    if (half == null) continue;
    decks.push({ id: s.id, sign: s.sign, dirSign: U(s.sign) >= 0 ? 1 : -1,
                 u0: U(s.sign * s.spec.front), spec: s.spec });
  }

  /* the roof, as a section: two wings unless the cut misses the opening */
  const R = W.roof, bw = D.bowl;
  // the same offset rounded rectangle the bowl is generated from
  const outer = roundedHalf(axis === 'x' ? bw.frontL + bw.depth : bw.frontW + bw.depth,
                            axis === 'x' ? bw.frontW + bw.depth : bw.frontL + bw.depth,
                            bw.frontR + bw.depth, at);
  const ringHalf = (() => {
    const a = axis === 'x' ? R.ringA : R.ringB, b = axis === 'x' ? R.ringB : R.ringA;
    if (Math.abs(at) >= b) return 0;                      // the cut misses the opening
    return a * Math.sqrt(1 - (at / b) ** 2);
  })();
  const wings = outer == null ? [] : [-1, 1].map((sgn) => ({
    inner: U(sgn * ringHalf), outerU: U(sgn * outer), open: ringHalf > 0,
  }));

  return { axis, at, dir, band, surfaces, blocks, marks, props: near, decks,
           roof: { wings, ...R }, dims: D };
}

/** The stepped (u,y) polyline of one deck, outward from its front. */
export function deckProfile(deck) {
  const out = [];
  const s = deck.dirSign;                                 // which way "outward" is in u
  const u = (d) => deck.u0 + s * d;
  for (const el of deck.spec.el) {
    if (el.t === 'tier') {
      const steps = tierSteps(el);
      const pts = [{ u: u(el.d0), y: el.y0 }];
      for (const st of steps) { pts.push({ u: u(st.d2), y: st.y }); pts.push({ u: u(st.d2), y: st.y2 }); }
      out.push({ t: 'tier', el, pts, u0: u(el.d0), u1: u(el.d1), y0: el.y0, y1: el.y1, rows: el.rows,
                 rowD: el.rowD, rise: el.rise, name: el.name, s });
    } else {
      out.push({ t: el.t, el, u0: u(el.d0), u1: u(el.d1), y0: el.y0, y1: el.y1, name: el.name, s });
    }
  }
  return out;
}

/* ── where every scenario launches from ──────────────────────────────── */
//
// `axis`/`at` choose the cutting plane, `dir` which way the section reads, and
// `origin` is the launch point in world metres. Flight x maps to
//   u = dir·origin[axis] + x
// which is why a free kick shooting west can share one world with a goal kick
// shooting east without either of them being drawn backwards.

export const SITES = {
  dropped: { axis: 'z', at: 0, dir: 1, origin: { x: 0, z: 0 },
    place: 'A camera drone, 80 m above the centre circle', view: 'across the pitch' },

  up: { axis: 'z', at: 0, dir: 1, origin: { x: 0, z: 0 },
    place: 'The centre spot', view: 'across the pitch',
    note: '14 m s⁻¹ reaches 9.99 m — level with the back of the lower tier.' },

  down: { axis: 'z', at: 0, dir: 1, origin: { x: 0, z: -41 },
    place: 'The roof edge, at the inner compression ring', view: 'across the pitch' },

  platform: { axis: 'z', at: 0, dir: 1, origin: { x: 0, z: -78 },
    place: 'Front row of the north upper tier, 25 m up', view: 'across the pitch',
    note: 'Lands 45.2 m out, just inside the touchline.' },

  arc: { axis: 'x', at: 0, dir: 1, origin: { x: -52.5, z: 0 },
    place: 'A goal kick from the west goal line', view: 'along the pitch' },

  'platform-angle': { axis: 'z', at: 0, dir: 1, origin: { x: 0, z: -78 },
    place: 'Front row of the north upper tier, 25 m up', view: 'across the pitch',
    note: 'Peaks at 45.0 m, three metres under the roof.' },

  target: { axis: 'x', at: 0, dir: -1, origin: { x: -36, z: 0 },
    place: 'A shot from the edge of the penalty area', view: 'along the pitch',
    note: 'The target starts on the top corner of the goal: 16.5 m away, 2.44 m up.' },

  collide: { axis: 'x', at: 0, dir: 1, origin: { x: -52.5, z: 0 },
    place: 'A drone 73.5 m up, and a kick from the goal line below it', view: 'along the pitch' },

  'time-above': { axis: 'x', at: 0, dir: 1, origin: { x: -52.5, z: 0 },
    place: 'A clearance from the west goal line', view: 'along the pitch',
    note: 'The line snaps to the crossbar at 2.44 m and the roof at 48 m.' },
};

export const siteFor = (id) => SITES[id] || SITES.arc;

/** Flight x → section u, and back. */
export function siteMap(site) {
  const u0 = site.dir * site.origin[site.axis];
  return { u0, toU: (x) => u0 + x, toX: (u) => u - u0 };
}

/** Flight (x, y) → world (x, y, z). The flight plane is the cutting plane. */
export function siteWorld(site) {
  const { axis, dir, origin } = site;
  return (x, y) => (axis === 'x'
    ? { x: origin.x + dir * x, y, z: origin.z }
    : { x: origin.x, y, z: origin.z + dir * x });
}
