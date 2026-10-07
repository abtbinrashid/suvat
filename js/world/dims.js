// dims.js — the dimension sheet. One unit is one metre, everywhere.
//
// This file is the single source of truth for the whole scene. Every renderer
// and every tool reads it, so nothing can drift. Nothing here is exaggerated
// for effect: if a number looks small on screen, it is because it IS small.
//
// AXES.  Right-handed, origin at the CENTRE SPOT on the pitch surface.
//   x  along the pitch, −52.5 (West goal) … +52.5 (East goal)
//   y  up, 0 = pitch surface = the physics datum the ball lands on
//   z  across the pitch, −34 (North touchline) … +34 (South touchline)
//
// ONE DELIBERATE DISAGREEMENT WITH THE MODEL.  The idealised projectile lands
// on flat ground at y = 0. The podium plaza really is 1.5 m above that, so it
// is drawn at 1.5 m and the ball passes it rather than landing on it. Scenery
// is not allowed to lie about its size, and the physics is not allowed to
// notice the scenery. Both rules are kept; the plaza is where they meet.

export const D = {

  /* ── the playing surface ─────────────────────────────────────────── */
  pitch: {
    length: 105, width: 68,                 // x ±52.5, z ±34
    halfL: 52.5, halfW: 34,
    lineW: 0.12,
    centreCircleR: 9.15,
    centreSpotR: 0.11,
    penaltyDepth: 16.5, penaltyHalfW: 20.16,
    goalAreaDepth: 5.5, goalAreaHalfW: 9.16,
    penaltySpot: 11,                        // from the goal line
    penaltyArcR: 9.15,
    cornerArcR: 1,
    stripes: 8,                             // mowing bands along the length
    stripeW: 105 / 8,                       // 13.125
  },

  goal: {
    width: 7.32, height: 2.44,
    postR: 0.06,                            // 0.12 m diameter posts
    netDepth: 1.8, netMesh: 0.12,
  },

  /* run-off: the grass outside the lines, then the advertising ring ── */
  surface: {
    runoffSide: 5, runoffEnd: 6,            // → 117 × 78 of grass
    halfL: 58.5, halfW: 39,
  },

  boards: {
    height: 1.0, depth: 0.25, panel: 2.4,   // LED hoardings, no real brands
    atZ: 39, atX: 58.5,
  },

  bench: { length: 8, depth: 2.4, roofH: 2.2, atZ: -36.5 },

  /* ── the bowl ────────────────────────────────────────────────────── */
  // Plan is a rounded rectangle, and — this matters — it is the SAME rounded
  // rectangle as the front row, offset outward by the depth of the stand.
  // Offsetting a rounded rectangle grows every radius by the same amount, so
  // front (62 × 42, r 30) + 63 m of depth gives 125 × 105, r 93. The roof is
  // generated from that identical offset: when the two were generated from
  // different rounded rectangles, the corners did not meet and you could see
  // the district through the gap.
  bowl: { halfL: 125, halfW: 105, cornerR: 83, outerWallH: 36,
          frontL: 62, frontW: 42, frontR: 20, depth: 63 },

  // A side is a list of elements, each measured as an OUTWARD distance d from
  // that side's front line. `tier` elements are generated row by row.
  sides: {
    // North and South: three tiers, boxes between the lower and the middle.
    NS: {
      front: 42,                            // |z| of the front row's nose
      out: 63,                              // to the bowl wall at |z| = 105
      el: [
        { t: 'tier',  d0: 0,    d1: 17.6, y0: 1.2,   y1: 10.0,  rows: 22, rowD: 0.80, rise: 0.40, name: 'lower tier' },
        { t: 'deck',  d0: 17.6, d1: 20.2, y0: 10.0,  y1: 10.0,  name: 'lower concourse' },
        { t: 'rail',  d0: 20.2, d1: 20.2, y0: 10.0,  y1: 11.1,  name: 'parapet' },
        { t: 'glassWall', d0: 20.2, d1: 20.5, y0: 10.0, y1: 14.0, name: 'box glazing' },
        { t: 'deck',  d0: 20.5, d1: 30.0, y0: 14.0,  y1: 14.0,  name: 'boxes, roof deck' },
        { t: 'tier',  d0: 30.0, d1: 34.8, y0: 14.0,  y1: 16.58, rows: 6,  rowD: 0.80, rise: 0.43, name: 'middle tier' },
        { t: 'wall',  d0: 34.8, d1: 36.0, y0: 16.58, y1: 25.0,  name: 'middle rear' },
        { t: 'tier',  d0: 36.0, d1: 53.6, y0: 25.0,  y1: 34.9,  rows: 22, rowD: 0.80, rise: 0.45, name: 'upper tier' },
        { t: 'wall',  d0: 53.6, d1: 63.0, y0: 34.9,  y1: 36.0,  name: 'rear facade' },
      ],
    },
    // West: ONE steep tier. tan 34° = 0.67451, so 0.80 m treads rise 0.5396 m.
    W: {
      front: 62, out: 63,
      el: [
        { t: 'tier',  d0: 0,    d1: 24.0, y0: 1.2,   y1: 17.39, rows: 30, rowD: 0.80, rise: 0.5396, name: 'single tier, lower block' },
        { t: 'deck',  d0: 24.0, d1: 26.5, y0: 17.39, y1: 17.39, name: 'vomitory walkway' },
        { t: 'tier',  d0: 26.5, d1: 50.5, y0: 17.39, y1: 33.58, rows: 30, rowD: 0.80, rise: 0.5396, name: 'single tier, upper block' },
        { t: 'wall',  d0: 50.5, d1: 63.0, y0: 33.58, y1: 35.0,  name: 'rear facade' },
      ],
    },
    // East: four tiers.
    E: {
      front: 62, out: 63,
      el: [
        { t: 'tier',  d0: 0,    d1: 16.0, y0: 1.2,   y1: 9.2,   rows: 20, rowD: 0.80, rise: 0.40, name: 'tier 1' },
        { t: 'deck',  d0: 16.0, d1: 18.5, y0: 9.2,   y1: 9.2,   name: 'concourse' },
        { t: 'rail',  d0: 18.5, d1: 18.5, y0: 9.2,   y1: 10.3,  name: 'parapet' },
        { t: 'glassWall', d0: 18.5, d1: 18.8, y0: 9.2, y1: 13.0, name: 'box glazing' },
        { t: 'deck',  d0: 18.8, d1: 27.0, y0: 13.0,  y1: 13.0,  name: 'boxes, roof deck' },
        { t: 'tier',  d0: 27.0, d1: 35.0, y0: 13.0,  y1: 17.2,  rows: 10, rowD: 0.80, rise: 0.42, name: 'tier 2' },
        { t: 'wall',  d0: 35.0, d1: 36.0, y0: 17.2,  y1: 21.5,  name: 'tier 2 rear' },
        { t: 'tier',  d0: 36.0, d1: 45.6, y0: 21.5,  y1: 26.78, rows: 12, rowD: 0.80, rise: 0.44, name: 'tier 3' },
        { t: 'wall',  d0: 45.6, d1: 46.5, y0: 26.78, y1: 30.0,  name: 'tier 3 rear' },
        { t: 'tier',  d0: 46.5, d1: 54.5, y0: 30.0,  y1: 34.6,  rows: 10, rowD: 0.80, rise: 0.46, name: 'tier 4, gallery' },
        { t: 'wall',  d0: 54.5, d1: 63.0, y0: 34.6,  y1: 35.6,  name: 'rear facade' },
      ],
    },
  },

  /* ── the roof ────────────────────────────────────────────────────────
     A cable net on an elliptical compression ring, open over the pitch.
     48.0 m is the highest thing in the world, which is what makes
     "31 m s⁻¹ straight up just clears the roof" true: 31²/(2 × 9.81) = 49.0. */
  roof: {
    fasciaTop: 48.0, fasciaBottom: 43.0,    // the outer rim
    outerStructure: 46.5,                   // where the roof plane meets the rim
    // The opening is the front row's own plan, pulled IN by 2 m — so every
    // seat is covered and the whole playing surface is open, by construction.
    // An ellipse could not do both: a 64 × 41 ellipse covered nine metres of
    // each pitch corner while leaving the end seats open to the sky.
    ringInset: 2,                           // opening = 60 × 40, corner r 18
    ringTop: 44.0, ringBottom: 42.5,
    lightStripY: 42.0, lightStripW: 1.2,
    radialCables: 28, hoopCables: 3,
  },

  /* ── podium and district ─────────────────────────────────────────── */
  podium: { halfL: 165, halfW: 140, cornerR: 60, y: 1.5, railH: 1.1, stepN: 6 },

  // The main road, running along x on the north side. Laid out as outward
  // distances from the podium edge at z = −140.
  road: {
    axis: 'x', side: -1,
    forecourt: [-152, -140],                // 12 m drop-off
    pavementWide: [-164, -152],             // 12 m — the wide pavement
    carriagewayA: [-171, -164],             // 2 lanes of 3.5
    median: [-173.4, -171],
    carriagewayB: [-180.4, -173.4],
    pavement: [-186.4, -180.4],             // 6 m
    laneW: 3.5, lampH: 6, lampEvery: 30, treeEvery: 14,
  },

  // A secondary road running along z on the west side, so the long-axis
  // cross-section has a street in it too.
  roadW: { axis: 'z', x: [-336, -320], pavement: 4, lampEvery: 32 },

  station: {
    x: [-60, 60], z: [-250, -210], roofY: 14,
    canopy: { z: [-272, -250], y: 7.0 },
    tracks: { z: [-270, -254], n: 4, gauge: 1.435, spacing: 4.0 },
    distanceFromCentre: 210,
  },

  carPark: { bayW: 2.4, bayL: 4.8, aisle: 6.0, fill: 0.68, lampH: 8 },
  carParks: [
    { id: 'P1', x: [-210, -70], z: [150, 230], along: 'x' },
    { id: 'P2', x: [80, 215],   z: [150, 215], along: 'x' },
    { id: 'P3', x: [-450, -340], z: [-150, 150], along: 'z' },
    // P4 straddles x = 0 so the across-the-pitch section has a car park in
    // it. Seven of the nine scenarios cut that way; without this the whole
    // district band was one park and one terrace for most of the app.
    { id: 'P4', x: [-62, 62],   z: [152, 232], along: 'x' },
  ],

  house: { front: 5.5, depth: 9.0, eaves: 6.2, ridge: 9.4, garden: 10, street: 10 },
  terraces: [
    { x: [300, 900],   z: [-150, 250], along: 'x' },
    { x: [-240, 240],  z: [260, 700],  along: 'x' },
    { x: [-900, -480], z: [240, 620],  along: 'x' },
    { x: [430, 900],   z: [-640, -200], along: 'z' },
  ],
  parks: [
    { id: 'west',  x: [-900, -480], z: [-200, 180],  pond: { x: [-780, -660], z: [-80, 20] } },
    { id: 'north', x: [-300, 300],  z: [-600, -320], pond: null },
  ],

  /* ── scale references. Every one of these is a real measurement. ─── */
  prop: {
    ball: 0.22,
    person: { h: 1.8, w: 0.45 },
    car: { l: 4.5, w: 1.8, h: 1.5 },
    bus: { l: 11.2, w: 2.55, h: 4.4 },        // double-decker
    treeMature: { h: 15, canopyR: 5, trunkR: 0.35 },
    treeYoung: { h: 8, canopyR: 2.6, trunkR: 0.18 },
    lamp: { h: 6, armL: 1.5 },
    floodMast: { h: 46 },
    goalpostR: 0.06,
  },

  /* ── beyond the district ─────────────────────────────────────────── */
  far: { fadeFrom: 1500, fadeTo: 2100, gridStep: 500, gridTo: 4000 },

  /* ── level-of-detail thresholds, in metres of VISIBLE WIDTH ───────
     Each entry is the span at which that detail has fully gone. Fades run
     over the last quarter, so nothing ever pops. */
  lod: {
    bands: { pitch: 30, stadium: 300, district: 2000 },
    netMesh: 260, grassBlades: 24, people: 460, boardPanels: 260,
    pitchLines: 900, seatRows: 130, seatTexture: 440,
    roofCables: 950, floodDetail: 760, carParkBays: 950, cars: 1900,
    treeDetail: 1200, treeBlob: 3400, houseDetail: 1500, houseBlock: 4200,
    grassStripes: 1000, roadLines: 1100,
  },
};

/** Tier geometry, row by row: the stepped polyline a section would cut. */
export function tierSteps(el) {
  const out = [];
  const dx = (el.d1 - el.d0) / el.rows;
  const dy = (el.y1 - el.y0) / el.rows;
  for (let i = 0; i < el.rows; i++) {
    const d = el.d0 + i * dx, y = el.y0 + i * dy;
    out.push({ d, y, d2: d + dx, y2: y + dy });
  }
  return out;
}

/** The rake of a tier, in degrees — the number the brief quotes. */
export const rake = (el) => (Math.atan2(el.y1 - el.y0, el.d1 - el.d0) * 180) / Math.PI;

/** Highest point of a side, for sanity checks and the dimension sheet. */
export const sideTop = (side) => Math.max(...side.el.map((e) => Math.max(e.y0, e.y1)));
