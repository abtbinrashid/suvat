// scenarios.js — the situations the playground can set up.
//
// A scenario chooses the SITUATION and nothing else. It decides which boxes
// apply, which markers appear and what the card says it is for. Every number
// is typed by the student; nothing here is pre-filled.
//
// Three groups, by where the object starts:
//   from the ground · from a platform · and the ones worth a detour.

export const GROUPS = [
  { id: 'ground',   label: 'From the ground',
    blurb: 'Starts and lands at the same level, so the path is symmetrical.' },
  { id: 'platform', label: 'From a platform',
    blurb: 'One platform, four ways off it. All land lower than they started, so none is symmetrical.' },
  { id: 'look',     label: 'Interesting ones',
    blurb: 'Questions about a moment mid-flight, not the end of it.' },
];

export const SCENARIOS = [

  /* ── from the ground ──────────────────────────────────────────────── */
  { id: 'up', group: 'ground', name: 'Thrown straight up',
    sub: 'no angle to enter',
    note: 'Up, stops, back down at the speed it left. Time up equals time down.',
    params: { u: 14, theta: 90, h: 0, g: 9.81 }, lockAngle: true },

  { id: 'arc', group: 'ground', name: 'Simple arc',
    sub: 'at an angle',
    note: 'An angle, landing at the same level. Gives you range and greatest height.',
    params: { u: 25, theta: 45, h: 0, g: 9.81 } },

  /* ── from a platform ──────────────────────────────────────────────── */
  { id: 'dropped', group: 'platform', name: 'Dropped',
    sub: 'straight down, from rest',
    note: 'Released, not thrown. No angle, no launch speed — height and g are the whole question.',
    params: { u: 0, theta: -90, h: 80, g: 9.81 }, noAngle: true, fixedU: 0 },

  { id: 'down', group: 'platform', name: 'Thrown straight down',
    sub: 'straight down, with a push',
    note: 'A drop with a head start. Lands sooner and faster than if released.',
    params: { u: 10, theta: -90, h: 45, g: 9.81 }, lockAngle: true },

  { id: 'platform', group: 'platform', name: 'Off a platform',
    sub: 'thrown flat',
    note: 'Thrown flat. Falls in the same time as if dropped — try it against Dropped.',
    params: { u: 20, theta: 0, h: 25, g: 9.81 }, lockAngle: true },

  { id: 'platform-angle', group: 'platform', name: 'Up and off a platform',
    sub: 'thrown up, at an angle',
    note: 'Thrown up, lands lower, so the two halves differ. The commonest exam setup.',
    params: { u: 28, theta: 45, h: 25, g: 9.81 } },

  /* ── interesting ones ─────────────────────────────────────────────── */
  { id: 'target', group: 'look', name: 'Throw at a target',
    sub: 'hit a point, not a place',
    note: 'The path must pass through the target, not land near it. Drag it anywhere.',
    params: { u: 14, theta: 40, h: 1, g: 9.81 },
    markers: { target: { x: 16.5, y: 2.44 } }, dragTarget: true },

  { id: 'time-above', group: 'look', name: 'Time above a line',
    sub: 'how long is it up there?',
    note: 'It crosses the line twice. The gap between those times is the answer. Drag the line.',
    params: { u: 24, theta: 40, h: 0.9, g: 9.81 },
    markers: { heightLine: 6 }, dragLine: true },

  { id: 'collide', group: 'look', name: 'Two that collide',
    sub: 'they always meet',
    note: 'Same horizontal speed, so they stay in line and always meet. Change any number — they still meet.',
    params: { u: 28, theta: 0, h: 73.5, g: 9.81 }, lockAngle: true,
    second: {
      label: 'from the foot of the platform',
      /**
       * Aim the second object so the two ALWAYS meet, whatever is typed.
       * Give it the same horizontal speed, so they stay on one vertical line,
       * and a vertical speed that closes the height h by the chosen moment:
       *   they meet when  h − ½gt² = u_y t − ½gt²,  i.e. when  u_y = h / t.
       * The ½gt² cancels — that is the whole trick, and why it cannot miss.
       */
      from(p) {
        if (!(p.g > 1e-6) || !(p.h > 1)) return null;   // needs a real drop
        const fall = Math.sqrt((2 * p.h) / p.g);
        const meet = 0.9 * fall;                        // just before it lands
        const uy = p.h / meet;
        const ux = Math.max(p.u, 1e-6);
        return { u: Math.hypot(ux, uy), theta: (Math.atan2(uy, ux) * 180) / Math.PI, h: 0 };
      },
    } },
];

export const byId = (id) => SCENARIOS.find((s) => s.id === id);
export const DEFAULT_SCENARIO = 'platform-angle';

/** Only three fields, as asked: Earth, the Moon, and none at all. */
export const GRAVITY = [
  { label: 'Earth', g: 9.81 },
  { label: 'Moon',  g: 1.62 },
  { label: 'None',  g: 0 },
];
