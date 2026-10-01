// scenarios.js — every situation the playground can set up.
//
// A scenario chooses the SITUATION, never the answer. The numbers below are
// starting points taken from real exam questions; everything stays editable,
// and anything the student is meant to work out is marked `unknown` so the
// site does not hand it over.

export const GROUPS = [
  { id: 'vertical',  label: 'Straight up and down' },
  { id: 'flat',      label: 'Thrown flat' },
  { id: 'ground',    label: 'At an angle, from the ground' },
  { id: 'height',    label: 'At an angle, from a height' },
  { id: 'pair',      label: 'Two objects at once' },
  { id: 'look',      label: 'Worth looking at' },
];

export const SCENARIOS = [
  /* ── straight up and down ─────────────────────────────────────────── */
  { id: 'dropped', group: 'vertical', name: 'Dropped',
    note: 'Released from rest. There is no launch angle, so the site does not ask for one.',
    params: { u: 0, theta: -90, h: 80, g: 9.8 }, noAngle: true },

  { id: 'up', group: 'vertical', name: 'Thrown straight up',
    note: 'Vertical velocity reaches zero at the top, then reverses. The angle is fixed at 90°.',
    params: { u: 14, theta: 90, h: 0, g: 9.8 }, lockAngle: true },

  { id: 'down', group: 'vertical', name: 'Thrown straight down',
    note: 'Projected downwards, so the initial vertical velocity is negative.',
    params: { u: 10, theta: -90, h: 45, g: 9.8 }, lockAngle: true },

  { id: 'balloon', group: 'vertical', name: 'Dropped from a rising balloon',
    note: 'The balloon is ascending, so the object leaves with the balloon’s upward velocity — not from rest.',
    params: { u: 8, theta: 90, h: 100, g: 9.8 }, lockAngle: true },

  /* ── thrown flat ──────────────────────────────────────────────────── */
  { id: 'table', group: 'flat', name: 'Off a table',
    note: 'Projected horizontally, so the initial vertical velocity is zero.',
    params: { u: 3, theta: 0, h: 1.2, g: 9.8 }, lockAngle: true },

  { id: 'roof', group: 'flat', name: 'Off a roof',
    params: { u: 20, theta: 0, h: 14, g: 9.8 }, lockAngle: true },

  { id: 'cliff-flat', group: 'flat', name: 'Off a cliff',
    note: 'Compare the time of flight with the dropped scenario at the same height — they are identical.',
    params: { u: 20, theta: 0, h: 80, g: 9.8 }, lockAngle: true },

  { id: 'dart', group: 'flat', name: 'Dart at a board',
    note: 'Fast and nearly flat, so the vertical drop over the flight is only a few centimetres.',
    params: { u: 12.6, theta: 0, h: 1.7, g: 9.8 }, lockAngle: true,
    markers: { target: { x: 2.4, y: 1.6 } } },

  { id: 'plane', group: 'flat', name: 'Package from a plane',
    params: { u: 40, theta: 0, h: 500, g: 9.8 }, lockAngle: true },

  /* ── angled, from the ground ──────────────────────────────────────── */
  { id: 'arc', group: 'ground', name: 'Simple arc',
    note: 'Launched and landing at the same level, so the path is symmetrical.',
    params: { u: 25, theta: 45, h: 0, g: 9.8 } },

  { id: 'fence', group: 'ground', name: 'Over a fence',
    note: 'Does it clear the fence? The check is the vertical displacement when the horizontal displacement equals the distance to the fence.',
    params: { u: 12, theta: 45, h: 0, g: 9.8 },
    markers: { obstacle: { x: 10, height: 2 } } },

  { id: 'complementary', group: 'ground', name: 'Two angles, same landing',
    note: 'θ and (90° − θ) give the same range over level ground. The steeper one simply takes longer.',
    params: { u: 28, theta: 30, h: 0, g: 9.8 },
    second: { thetaFrom: (t) => 90 - t, label: 'complementary angle' } },

  { id: 'best-angle', group: 'ground', name: 'Best angle',
    note: 'From ground level the greatest range is at 45°. Launched from a height, the best angle drops below 45°.',
    params: { u: 25, theta: 45, h: 0, g: 9.8 }, showOptimum: true },

  /* ── angled, from a height ────────────────────────────────────────── */
  { id: 'cliff-angle', group: 'height', name: 'Up and off a cliff',
    note: 'The most examined setup. The flight is not symmetrical because it lands below the launch point.',
    params: { u: 28, theta: 45, h: 25, g: 9.8 } },

  { id: 'down-angle', group: 'height', name: 'Downwards off a height',
    note: 'Projected below the horizontal, so the vertical component of the initial velocity is negative throughout.',
    params: { u: 25, theta: -30, h: 12, g: 9.8 } },

  { id: 'cricket', group: 'height', name: 'Hit from just above the ground',
    note: 'Launch height is small but not zero, so the flight is very slightly asymmetrical.',
    params: { u: 24, theta: 36.87, h: 0.9, g: 9.8 } },

  { id: 'target', group: 'height', name: 'Throw at a target',
    note: 'The path has to pass through a given point, not simply land somewhere.',
    params: { u: 11, theta: 30, h: 1, g: 9.8 },
    markers: { target: { x: 10, y: 2 } } },

  /* ── two objects ──────────────────────────────────────────────────── */
  { id: 'collide', group: 'pair', name: 'Two that collide',
    note: 'Projected at the same instant from different places. They meet where both displacements agree.',
    params: { u: 28, theta: 0, h: 73.5, g: 9.8 }, lockAngle: true,
    second: { u: 35, theta: 36.87, h: 0, label: 'from the foot of the cliff' } },

  { id: 'catch', group: 'pair', name: 'Catch it',
    note: 'A projectile and a runner moving at constant velocity. Only the time is shared.',
    params: { u: 7, theta: 45, h: 8, g: 9.8 }, runner: { speed: 4, delay: 0.4 } },

  { id: 'head-start', group: 'pair', name: 'Head start',
    note: 'Identical launches, one delayed. The paths are the same shape, separated in time.',
    params: { u: 22, theta: 40, h: 0, g: 9.8 },
    second: { sameAsFirst: true, delay: 0.8, label: 'launched 0.8 s later' } },

  /* ── worth looking at ─────────────────────────────────────────────── */
  { id: 'time-above', group: 'look', name: 'Time above a line',
    note: 'The object crosses the line twice. The time between those two roots is the answer.',
    params: { u: 24, theta: 36.87, h: 0.9, g: 9.8 },
    markers: { heightLine: 4 } },

  { id: 'perpendicular', group: 'look', name: 'Turned 90°',
    note: 'The moment the velocity is at right angles to the launch velocity.',
    params: { u: 20, theta: 60, h: 0, g: 9.8 }, showPerpendicular: true },

  { id: 'reach-height', group: 'look', name: 'Reach a given height',
    note: 'Work backwards from the greatest height to the launch angle that produces it.',
    params: { u: 40, theta: 22.54, h: 36, g: 9.8 }, showApexWorking: true },

  { id: 'per-second', group: 'look', name: 'One second at a time',
    note: 'Markers at one-second intervals. The gaps grow, because the vertical velocity is still increasing.',
    params: { u: 0, theta: -90, h: 125, g: 9.8 }, noAngle: true, secondMarks: true },

  { id: 'low-g', group: 'look', name: 'Low gravity',
    note: 'The same launch where g is smaller. The shape is unchanged; the scale is not.',
    params: { u: 25, theta: 45, h: 0, g: 1.62 } },

  { id: 'no-g', group: 'look', name: 'No gravity',
    note: 'With g = 0 there is no vertical acceleration, so the path is a straight line and it never lands.',
    params: { u: 25, theta: 45, h: 0, g: 0 } },
];

export const byId = (id) => SCENARIOS.find((s) => s.id === id);
export const DEFAULT_SCENARIO = 'cliff-angle';
