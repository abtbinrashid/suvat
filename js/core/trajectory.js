// trajectory.js — a flight, optionally with bounces.
//
// ON MASS. Mass does NOT change any of this. The acceleration is g whatever
// the object weighs, so the path, the time of flight and the bounce height are
// all independent of mass — which is exactly the point A-level keeps testing.
// Mass is carried here because it determines kinetic energy and momentum, and
// those are worth showing. It is deliberately not wired into the geometry.
//
// Bounce height is set by the COEFFICIENT OF RESTITUTION e, not by mass:
//   vertical velocity after = −e × vertical velocity before
//   horizontal velocity is unchanged (smooth, level ground)
// So each bounce reaches e² times the previous height.

import { flight } from './projectile.js';

const DEG = 180 / Math.PI;

export function trajectory(p) {
  const { u, theta, h, g, restitution = 0, maxBounces = 0, mass = 1 } = p;
  const first = flight({ u, theta, h, g });

  const segments = [{ f: first, t0: 0, x0: 0 }];

  if (restitution > 0 && maxBounces > 0 && isFinite(first.tFlight) && g > 1e-9) {
    let prev = first, t0 = first.tFlight, x0 = first.range;
    for (let i = 0; i < maxBounces; i++) {
      const vIn = prev.vel(prev.tFlight);
      const vy = -restitution * vIn.y;             // reverse and damp
      const vx = vIn.x;                            // smooth ground, so unchanged
      if (vy < 0.05) break;                        // it has stopped bouncing
      const speed = Math.hypot(vx, vy);
      const ang = Math.atan2(vy, vx) * DEG;
      const f = flight({ u: speed, theta: ang, h: 0, g });
      if (!isFinite(f.tFlight) || f.tFlight < 1e-4) break;
      segments.push({ f, t0, x0 });
      t0 += f.tFlight;
      x0 += f.range;
      prev = f;
    }
  }

  const tMax = segments.reduce((acc, s) => Math.max(acc, s.t0 + s.f.tMax), 0);

  const seg = (t) => {
    for (let i = segments.length - 1; i >= 0; i--) if (t >= segments[i].t0 - 1e-12) return segments[i];
    return segments[0];
  };

  const pos = (t) => {
    const s = seg(Math.max(0, Math.min(t, tMax)));
    const local = Math.min(Math.max(0, t - s.t0), s.f.tMax);
    const q = s.f.pos(local);
    return { x: s.x0 + q.x, y: q.y };
  };
  const vel = (t) => {
    const s = seg(Math.max(0, Math.min(t, tMax)));
    return s.f.vel(Math.min(Math.max(0, t - s.t0), s.f.tMax));
  };
  const speed = (t) => { const v = vel(t); return Math.hypot(v.x, v.y); };

  return {
    params: { ...first.params, mass, restitution },
    segments, bounces: segments.length - 1,
    // the first flight's quantities are the ones the working refers to
    ux: first.ux, uy: first.uy, horiz: first.horiz,
    tFlight: first.tFlight, tApex: first.tApex, apexHeight: first.apexHeight,
    apexInFlight: first.apexInFlight, range: first.range, vLanding: first.vLanding,
    tMax, pos, vel, speed,
    /** Kinetic energy and momentum — the only places mass actually appears. */
    kineticEnergy: (t) => 0.5 * mass * speed(t) ** 2,
    momentum: (t) => mass * speed(t),
    path(nPts = 260, tEnd = tMax) {
      const out = [];
      for (let i = 0; i <= nPts; i++) {
        const t = (i / nPts) * tEnd;
        out.push({ t, ...pos(t) });
      }
      return out;
    },
    ticks(count = 10, tEnd = tMax) {
      const out = [];
      for (let i = 0; i <= count; i++) {
        const t = (i / count) * tEnd;
        out.push({ t, ...pos(t), v: vel(t) });
      }
      return out;
    },
  };
}
