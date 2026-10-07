// projectile.js — the idealised A-level projectile.
//
// THE MODEL, stated plainly:
//   • no air resistance, no drag, no wind
//   • gravity is uniform and vertical
//   • the projectile is a point mass; it does not spin
//   • the ground is flat
// Horizontal motion therefore has a = 0 (constant velocity) and vertical
// motion has a = −g. The two are completely independent — which is the single
// most important idea in the topic, and the one this playground exists to show.

import { M, num, signed } from '../notation.js';

export const GRAVITY = {
  earth:  { g: 9.81,  label: 'Earth',   sub: '9.81' },
  moon:   { g: 1.62,  label: 'Moon',    sub: '1.62' },
  mars:   { g: 3.72,  label: 'Mars',    sub: '3.72' },
  jupiter:{ g: 24.79, label: 'Jupiter', sub: '24.79' },
  zero:   { g: 0,     label: 'Zero-g',  sub: '0' },
};

const DEG = Math.PI / 180;

/**
 * Build a full description of one projectile's flight.
 * @param {{u:number, theta:number, h:number, g:number}} p
 *   u       launch speed        (m s⁻¹)
 *   theta   angle of elevation  (degrees, may be negative for a downward throw)
 *   h       launch height       (m)
 *   g       gravitational field strength (m s⁻², positive downwards)
 */
export function flight({ u, theta, h, g }) {
  const th = theta * DEG;

  // Resolve the launch velocity into components. This is step one of every
  // projectile question and the reason cos/sin appear at all.
  const horiz = u * Math.cos(th);          // speed across the ground
  const ux = horiz;                        // the flight stays in one vertical plane
  const uy = u * Math.sin(th);             // vertical component

  // Time of flight: solve h + uy·t − ½g·t² = 0 for the positive root.
  let tFlight;
  if (g > 1e-9) {
    tFlight = (uy + Math.sqrt(Math.max(0, uy * uy + 2 * g * h))) / g;
  } else if (uy < -1e-9) {
    tFlight = h / -uy;                     // no gravity, thrown downwards
  } else {
    tFlight = Infinity;                    // no gravity, never comes back
  }

  const bounded = isFinite(tFlight) ? tFlight : Math.max(8, (2 * u) / 9.81);
  const tApex = g > 1e-9 ? uy / g : (uy > 0 ? bounded : 0);
  const apexInFlight = tApex > 0 && tApex < bounded;
  const apexHeight = g > 1e-9 ? h + (uy * uy) / (2 * g) : h + uy * bounded;
  const range = horiz * bounded;

  const pos = (t) => ({
    x: ux * t,
    y: h + uy * t - 0.5 * g * t * t,
  });
  const vel = (t) => ({ x: ux, y: uy - g * t });
  const speed = (t) => { const v = vel(t); return Math.hypot(v.x, v.y); };

  const vLanding = speed(bounded);
  const angleAt = (t) => {
    const v = vel(t);
    return (Math.atan2(v.y, Math.abs(v.x)) / DEG);
  };

  return {
    params: { u, theta, h, g },
    ux, uy, horiz,
    tFlight, tMax: bounded, infinite: !isFinite(tFlight),
    tApex: apexInFlight ? tApex : (uy > 0 ? tApex : 0),
    apexHeight: Math.max(h, apexHeight),
    apexInFlight,
    range,
    vLanding,
    landingAngle: angleAt(bounded),
    pos, vel, speed, angleAt,
    /** Sample the path as an array of points — used by every renderer. */
    path(n = 240, tEnd = bounded) {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * tEnd;
        out.push({ t, ...pos(t) });
      }
      return out;
    },
    /** Equally-spaced-in-TIME markers. Their spacing is the whole lesson:
     *  horizontal gaps stay constant, vertical gaps shrink then grow. */
    ticks(count = 10, tEnd = bounded) {
      const out = [];
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * tEnd;
        out.push({ t, ...pos(t), v: vel(t) });
      }
      return out;
    },
  };
}

/** The working, written out — shown beside the playground so the numbers are never magic. */
export function derivation(f) {
  const { u, theta, h, g } = f.params;
  const d = (x, p = 2) => num(x, p);
  const sg = (x, p = 2) => signed(x, p);
  const steps = [
    {
      title: 'Resolve the launch velocity',
      lines: [
        { tex: M`u_x = u cos theta`, sub: M`u_x = ${d(u)} * cos ${sg(theta, 1)}° = ${d(f.horiz)} [m s^-1]` },
        { tex: M`u_y = u sin theta`, sub: M`u_y = ${d(u)} * sin ${sg(theta, 1)}° = ${d(f.uy)} [m s^-1]` },
      ],
      note: 'Horizontal and vertical are now two separate 1D problems.',
    },
    {
      title: `Time of flight — vertical, ${M`s = ut + ½at^2`}`,
      lines: [
        { tex: M`0 = h + u_y t - ½g t^2`, sub: M`0 = ${d(h)} + ${sg(f.uy)}t - ½ * ${d(g)}t^2` },
        { tex: M`t = (u_y + sqrt(u_y^2 + 2gh))/g`, sub: M`t = ${d(f.tFlight, 3)} [s]` },
      ],
      note: h > 0 ? 'Launched from a height, so the flight is not symmetric.' : 'Level ground, so the path is symmetric.',
    },
    {
      title: `Greatest height — vertical, ${M`v^2 = u^2 + 2as`}`,
      lines: [
        { tex: `At the top, ${M`v_y = 0`}`, sub: M`0 = ${sg(f.uy)}^2 - 2 * ${d(g)} * (H - ${d(h)})` },
        { tex: M`H = h + u_y^2/(2g)`, sub: `${M`H = ${d(f.apexHeight, 2)} [m]`} at ${M`t = ${d(f.tApex, 3)} [s]`}` },
      ],
      note: 'Uses only vertical quantities — the horizontal motion is irrelevant here.',
    },
    {
      title: `Range — horizontal, ${M`a = 0`} so ${M`s = u_x t`}`,
      lines: [
        { tex: M`R = u_x * t_{flight}`, sub: M`R = ${d(f.horiz)} * ${d(f.tFlight, 3)} = ${d(f.range, 2)} [m]` },
      ],
      note: 'No acceleration horizontally, so distance is just speed × time.',
    },
  ];
  return steps;
}

/** The complementary-angle result: θ and (90° − θ) give the same range on level ground. */
export function complement(theta) {
  return 90 - theta;
}

/** Launch angle that maximises range from height h. Reduces to 45° when h = 0. */
export function optimumAngle(u, h, g) {
  if (g <= 1e-9 || u <= 0) return 45;
  if (h <= 0) return 45;
  const r = Math.asin(1 / Math.sqrt(2 + (2 * g * h) / (u * u)));
  return (r * 180) / Math.PI;
}
