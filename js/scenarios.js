// scenarios.js — the situations the playground can set up.
//
// A scenario chooses the SITUATION and sensible starting numbers. Every value
// stays editable, and anything left blank the engine will try to work out.

export const GROUPS = [
  { id: 'vertical', label: 'Straight up and down' },
  { id: 'flat',     label: 'Thrown flat' },
  { id: 'ground',   label: 'At an angle, from the ground' },
  { id: 'height',   label: 'At an angle, from a height' },
  { id: 'pair',     label: 'Two objects' },
  { id: 'look',     label: 'Worth looking at' },
];

export const SCENARIOS = [
  { id: 'dropped', group: 'vertical', name: 'Dropped',
    note: 'Released from rest, so there is no angle of projection and no initial velocity to enter.',
    params: { u: 0, theta: -90, h: 80, g: 9.81 }, noAngle: true, fixedU: 0 },

  { id: 'up', group: 'vertical', name: 'Thrown straight up',
    note: 'The vertical velocity reaches zero at the top and then reverses. The angle is fixed at 90°.',
    params: { u: 14, theta: 90, h: 0, g: 9.81 }, lockAngle: true },

  { id: 'down', group: 'vertical', name: 'Thrown straight down',
    note: 'Projected downwards, so the initial vertical velocity is negative from the start.',
    params: { u: 10, theta: -90, h: 45, g: 9.81 }, lockAngle: true },

  { id: 'platform', group: 'flat', name: 'Off a platform',
    note: 'Projected horizontally from a height — a table, a roof or a cliff are all the same problem. It falls in exactly the time it would if it had simply been dropped.',
    params: { u: 20, theta: 0, h: 25, g: 9.81 }, lockAngle: true },

  { id: 'arc', group: 'ground', name: 'Simple arc',
    note: 'Launched and landing at the same level, so the path is symmetrical.',
    params: { u: 25, theta: 45, h: 0, g: 9.81 } },

  { id: 'fence', group: 'ground', name: 'Over a fence',
    note: 'Drag the fence to move it. It clears if the height at that horizontal displacement is greater than the fence.',
    params: { u: 14, theta: 45, h: 0, g: 9.81 },
    markers: { obstacle: { x: 10, height: 2 } }, dragObstacle: true },

  { id: 'complementary', group: 'ground', name: 'Two angles, same landing',
    note: 'θ and (90° − θ) give the same horizontal displacement over level ground. The steeper one simply takes longer.',
    params: { u: 28, theta: 30, h: 0, g: 9.81 },
    second: { thetaFrom: (t) => 90 - t, label: 'complementary angle' } },

  { id: 'cliff-angle', group: 'height', name: 'Up and off a cliff',
    note: 'The most examined setup of all. It is not symmetrical, because it lands below where it started.',
    params: { u: 28, theta: 45, h: 25, g: 9.81 } },

  { id: 'down-angle', group: 'height', name: 'Downwards off a height',
    note: 'Projected below the horizontal, so the vertical component of the initial velocity is negative throughout.',
    params: { u: 25, theta: -30, h: 12, g: 9.81 } },

  { id: 'cricket', group: 'height', name: 'Hit from just above the ground',
    note: 'The launch height is small but not zero, so the flight is very slightly asymmetrical.',
    params: { u: 24, theta: 36.87, h: 0.9, g: 9.81 } },

  { id: 'target', group: 'height', name: 'Throw at a target',
    note: 'Drag the target anywhere. The path has to pass through it, not simply land somewhere.',
    params: { u: 14, theta: 40, h: 1, g: 9.81 },
    markers: { target: { x: 15, y: 4 } }, dragTarget: true },

  { id: 'collide', group: 'pair', name: 'Two that collide',
    note: 'Both projected at the same instant from different places. They meet where the two displacements agree.',
    params: { u: 28, theta: 0, h: 73.5, g: 9.81 }, lockAngle: true,
    second: { u: 35, theta: 36.87, h: 0, label: 'from the foot of the cliff' } },

  { id: 'time-above', group: 'look', name: 'Time above a line',
    note: 'Drag the line up or down. It crosses twice, and the gap between those two times is the answer.',
    params: { u: 24, theta: 40, h: 0.9, g: 9.81 },
    markers: { heightLine: 6 }, dragLine: true },
];

export const byId = (id) => SCENARIOS.find((s) => s.id === id);
export const DEFAULT_SCENARIO = 'cliff-angle';

/** Only three fields, as asked: Earth, the Moon, and none at all. */
export const GRAVITY = [
  { label: 'Earth', g: 9.81 },
  { label: 'Moon',  g: 1.62 },
  { label: 'None',  g: 0 },
];
