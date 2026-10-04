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
    blurb: 'The object starts at ground level. The path is symmetrical, because it lands at the height it left.' },
  { id: 'platform', label: 'From a platform',
    blurb: 'Same platform, four ways off it. Every one of these lands below where it started, so none of them is symmetrical.' },
  { id: 'look',     label: 'Interesting ones',
    blurb: 'Questions that ask about a moment in the middle of the flight rather than the end of it.' },
];

export const SCENARIOS = [

  /* ── from the ground ──────────────────────────────────────────────── */
  { id: 'up', group: 'ground', name: 'Thrown straight up',
    sub: 'no angle to enter',
    note: 'Straight up, straight back down. The velocity falls to zero at the top and reverses, and it returns at exactly the speed it left. Use it to see why the way up and the way down take the same time.',
    params: { u: 14, theta: 90, h: 0, g: 9.81 }, lockAngle: true },

  { id: 'arc', group: 'ground', name: 'Simple arc',
    sub: 'at an angle',
    note: 'Launched at an angle and landing at the same level. This is the one that gives you range and greatest height, and the only setup where the path is a perfect mirror about its apex.',
    params: { u: 25, theta: 45, h: 0, g: 9.81 } },

  /* ── from a platform ──────────────────────────────────────────────── */
  { id: 'dropped', group: 'platform', name: 'Dropped',
    sub: 'straight down, from rest',
    note: 'Released, not thrown. There is no angle and no launch speed — the height and g are the whole question. Everything else here is this, with a push added.',
    params: { u: 0, theta: -90, h: 80, g: 9.81 }, noAngle: true, fixedU: 0 },

  { id: 'down', group: 'platform', name: 'Thrown straight down',
    sub: 'straight down, with a push',
    note: 'A drop with a head start. It arrives sooner and faster than it would if released, and comparing the two is the point.',
    params: { u: 10, theta: -90, h: 45, g: 9.81 }, lockAngle: true },

  { id: 'platform', group: 'platform', name: 'Off a platform',
    sub: 'thrown flat',
    note: 'Projected horizontally. It falls in exactly the same time as if it had simply been dropped — the sideways push buys no extra hang time at all. If you only try one thing here, try this against Dropped.',
    params: { u: 20, theta: 0, h: 25, g: 9.81 }, lockAngle: true },

  { id: 'platform-angle', group: 'platform', name: 'Up and off a platform',
    sub: 'thrown up, at an angle',
    note: 'Thrown upwards from a height and landing below where it started, so the two halves of the flight are different lengths. This is the setup papers examine more than any other.',
    params: { u: 28, theta: 45, h: 25, g: 9.81 } },

  /* ── interesting ones ─────────────────────────────────────────────── */
  { id: 'target', group: 'look', name: 'Throw at a target',
    sub: 'hit a point, not a place',
    note: 'The path has to pass THROUGH the target, not merely land near it — so you are solving for a moment in the middle of the flight. Drag the target anywhere and watch which launches still reach it.',
    params: { u: 14, theta: 40, h: 1, g: 9.81 },
    markers: { target: { x: 16.5, y: 2.44 } }, dragTarget: true },

  { id: 'time-above', group: 'look', name: 'Time above a line',
    sub: 'how long is it up there?',
    note: 'The path crosses the line twice, and the gap between those two times is the answer. Drag the line to see the gap shrink to nothing as it reaches the apex. This is how every "how long is it above 6 m" question works.',
    params: { u: 24, theta: 40, h: 0.9, g: 9.81 },
    markers: { heightLine: 6 }, dragLine: true },

  { id: 'collide', group: 'look', name: 'Two that collide',
    sub: 'they always meet',
    note: 'One thrown flat off the platform, one thrown up from the foot of it at the same instant. Both have the same horizontal speed, so they stay in line and the only question is height — and height closes at a steady rate, because gravity pulls on both equally. Change the numbers however you like: they still meet.',
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
