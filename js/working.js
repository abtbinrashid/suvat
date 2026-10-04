// working.js — the working out, with the student's own numbers substituted.
//
// Written the way it would be written in an exam: name the equation, state the
// rearrangement, substitute, give the result. No invented steps, and nothing
// claimed that the engine did not actually compute.
//
// Vocabulary is A-level throughout: initial velocity, angle of projection,
// vertical component, horizontal displacement. Not "sx" and "sy".
//
// NOTATION. Every formula and every substitution goes through M`` — see
// js/notation.js. Write the source the easy way, `(v^2 - u^2)/(2a)`, and it
// reaches the screen as a stacked fraction with a real minus sign. Nothing in
// this file decides what a symbol looks like, and nothing here may ship a
// programmer's / ^ sqrt or * to a student.

import { M, num, signed } from './notation.js';

const d = (x, p = 2) => num(x, p, { trim: true });
const sub = (x, p = 2) => signed(x, p, { trim: true });

export function buildWorking(f, t) {
  const { u, theta, h, g } = f.params;
  const steps = [];
  const vertical = Math.abs(Math.cos((theta * Math.PI) / 180)) < 1e-9;

  /* 1 — resolve */
  if (!vertical && u > 0) {
    steps.push({
      title: 'Resolve the initial velocity',
      rows: [
        { f: M`"horizontal component" = u cos theta`,
          s: M`${d(u)} * cos ${sub(theta, 1)}° = ${d(f.horiz)} [m s^-1]` },
        { f: M`"vertical component" = u sin theta`,
          s: M`${d(u)} * sin ${sub(theta, 1)}° = ${d(f.uy)} [m s^-1]` },
      ],
      note: 'Horizontal and vertical motion are now independent. They share only the time.',
    });
  } else if (vertical) {
    steps.push({
      title: 'Resolve the initial velocity',
      rows: [{ f: 'Motion is vertical only',
               s: M`"horizontal component" = 0, "vertical component" = ${d(f.uy)} [m s^-1]` }],
      note: 'There is no horizontal motion, so this is a one-dimensional problem.',
    });
  }

  /* 2 — time of flight, from the vertical equation */
  if (g > 1e-9) {
    const disc = f.uy * f.uy + 2 * g * h;
    steps.push({
      title: `Time of flight — vertical, ${M`s = ut + ½at^2`}`,
      rows: [
        { f: `Taking up as positive, ${M`s = -h`} at landing`,
          s: M`-${d(h)} = ${sub(f.uy)}t - ½ * ${d(g)}t^2` },
        { f: M`t = (u sin theta + sqrt((u sin theta)^2 + 2gh))/g`,
          s: M`(${d(f.uy)} + sqrt(${d(f.uy * f.uy)} + ${d(2 * g * h)}))/${d(g)} = ${d(f.tFlight, 3)} [s]`,
          r: M`t = ${d(f.tFlight, 3)} [s]` },
      ],
      note: h > 0
        ? 'Launched above the ground, so the flight is not symmetrical — it spends longer coming down than going up.'
        : 'Level ground, so the time up equals the time down.',
      skip: disc < 0,
    });
  } else {
    steps.push({
      title: 'Time of flight',
      rows: [{ f: `${M`g = 0`}, so there is no vertical acceleration`,
               s: f.uy >= 0
                 ? 'The object never returns to the ground'
                 : M`t = h/abs(u sin theta) = ${d(f.tFlight, 3)} [s]` }],
      note: 'With no gravitational field the velocity is constant and the path is a straight line.',
    });
  }

  /* 3 — greatest height */
  if (g > 1e-9 && f.uy > 0) {
    steps.push({
      title: `Greatest height — vertical, ${M`v^2 = u^2 + 2as`}`,
      rows: [
        { f: 'At the highest point the vertical velocity is zero',
          s: M`0 = ${sub(f.uy)}^2 - 2 * ${d(g)} * s` },
        { f: M`"rise above the launch point" = (u sin theta)^2/(2g)`,
          s: M`${d(f.uy * f.uy)}/${d(2 * g)} = ${d(f.apexHeight - h, 2)} [m]`,
          r: `${M`"greatest height above the ground" = ${d(f.apexHeight, 2)} [m]`} at ${M`t = ${d(f.tApex, 3)} [s]`}` },
      ],
      note: 'Only vertical quantities appear — the horizontal motion is irrelevant here.',
    });
  }

  /* 4 — horizontal displacement */
  if (!vertical && isFinite(f.tFlight)) {
    steps.push({
      title: `Horizontal displacement — ${M`a = 0`}, so ${M`s = ut`}`,
      rows: [
        { f: M`s = u cos theta * t`,
          s: M`${d(f.horiz)} * ${d(f.tFlight, 3)} = ${d(f.range, 2)} [m]`,
          r: M`"horizontal displacement" = ${d(f.range, 2)} [m]` },
      ],
      note: 'There is no horizontal acceleration, so the horizontal velocity never changes.',
    });
  }

  /* 5 — this instant */
  const p = f.pos(t), v = f.vel(t);
  steps.push({
    title: `At ${M`t = ${d(t, 2)} [s]`}`,
    rows: [
      { f: M`"horizontal displacement" = u cos theta * t`,
        s: M`${d(f.horiz)} * ${d(t, 2)} = ${d(p.x, 2)} [m]` },
      { f: M`"height" = h + u sin theta * t - ½gt^2`,
        s: M`${d(h)} + ${sub(f.uy)} * ${d(t, 2)} - ½ * ${d(g)} * ${d(t, 2)}^2 = ${d(p.y, 2)} [m]` },
      { f: M`"vertical velocity" = u sin theta - gt`,
        s: M`${sub(f.uy)} - ${d(g)} * ${d(t, 2)} = ${d(v.y, 2)} [m s^-1]` },
      { f: M`"speed" = sqrt("horizontal"^2 + "vertical"^2)`,
        s: M`sqrt(${sub(v.x)}^2 + ${sub(v.y)}^2) = ${d(Math.hypot(v.x, v.y), 2)} [m s^-1]`,
        r: M`"speed" = ${d(Math.hypot(v.x, v.y), 2)} [m s^-1]` },
    ],
    note: null,
  });

  return steps.filter((s) => !s.skip);
}

/** Does it clear an obstacle? Stated the way the mark scheme wants it. */
export function obstacleCheck(f, ob) {
  if (f.horiz <= 1e-9) return { ok: false, text: 'The launch is vertical, so it never reaches the fence.' };
  const t = ob.x / f.horiz;
  if (t > f.tMax) return { ok: false, text: `It lands after ${d(f.range, 2)} m, short of the fence at ${d(ob.x, 1)} m.` };
  const y = f.pos(t).y;
  const clear = y - ob.height;
  return {
    ok: clear > 0,
    text: clear > 0
      ? `At a horizontal displacement of ${d(ob.x, 1)} m the height is ${d(y, 2)} m — it clears the fence by ${d(clear, 2)} m.`
      : `At a horizontal displacement of ${d(ob.x, 1)} m the height is only ${d(y, 2)} m — it is ${d(-clear, 2)} m too low.`,
  };
}

/* ── resolving at one instant ───────────────────────────────────────────
   The first line of every projectile answer: split the vector into a
   horizontal part and a vertical part. The horizontal part never changes,
   because there is no horizontal acceleration. The vertical part changes at
   g. That is why two separate 1D problems are easier than one 2D one.

   Up is positive here, and the diagram is drawn the same way, so a negative
   vertical component always means "downwards" and nothing else. */

const DIR = (x) => (x > 1e-9 ? 'upwards' : x < -1e-9 ? 'downwards' : 'neither up nor down');

export function resolveAt(f, t) {
  const { u, theta, h, g } = f.params;
  const p = f.pos(t), v = f.vel(t);
  const vx = v.x, vy = v.y;
  const speed = Math.hypot(vx, vy);
  const sx = p.x, sy = p.y - h;            // measured from the launch point
  const dist = Math.hypot(sx, sy);

  // A vertical launch or a drop has no horizontal part to resolve, so there is
  // no triangle — saying so is more use than drawing one with no width.
  const vertical = Math.abs(f.horiz) < 1e-6;

  // After a bounce, u and θ belong to the launch and not to this part of the
  // flight, so quoting them would be wrong. The numbers are still right.
  const after = (f.bounces || 0) > 0 && t > f.tFlight + 1e-9;

  const angleOf = (y, x) => (Math.abs(x) < 1e-9 ? 90 : Math.abs(Math.atan2(y, x) * 180 / Math.PI));
  const vAngle = angleOf(vy, vx), sAngle = angleOf(sy, sx);
  const belowAbove = (y) => (y < -1e-9 ? 'below the horizontal' : y > 1e-9 ? 'above the horizontal' : 'horizontal');

  const velocity = {
    name: 'Velocity',
    hue: 'vel',
    x: {
      name: 'Horizontal component',
      formula: after ? 'Unchanged by the bounce' : M`u cos theta`,
      sub: after ? null : M`${d(u)} * cos ${sub(theta, 1)}° = ${d(vx)}`,
      value: vx, unit: 'm s⁻¹',
      note: 'constant — there is no horizontal acceleration',
    },
    y: {
      name: 'Vertical component',
      formula: after ? `${M`u + at`}, timed from the bounce` : M`u sin theta - gt`,
      sub: after ? null : M`${sub(f.uy)} - ${d(g)} * ${d(t, 2)} = ${d(vy)}`,
      value: vy, unit: 'm s⁻¹',
      note: g <= 1e-9
        ? 'constant — with no gravitational field there is no acceleration at all'
        : Math.abs(vy) < 0.05
          ? 'momentarily zero — this is the top of the flight'
          : `${DIR(vy)}, changing by ${M`${d(g)} [m s^-1]`} every second`,
    },
    r: {
      name: 'Resultant speed',
      formula: M`sqrt("horizontal"^2 + "vertical"^2)`,
      sub: M`sqrt(${sub(vx)}^2 + ${sub(vy)}^2) = ${d(speed)}`,
      value: speed, unit: 'm s⁻¹',
      note: belowAbove(vy) === 'horizontal' ? 'horizontal' : `${M`${d(vAngle, 1)}°`} ${belowAbove(vy)}`,
    },
    angle: vAngle, dir: belowAbove(vy),
  };

  const displacement = {
    name: 'Displacement',
    hue: 'disp',
    x: {
      name: 'Horizontal displacement',
      formula: after ? M`"horizontal velocity" * t` : M`u cos theta * t`,
      sub: after ? null : M`${d(f.horiz)} * ${d(t, 2)} = ${d(sx)}`,
      value: sx, unit: 'm',
      note: `${M`a = 0`} horizontally, so ${M`s = ut`}`,
    },
    y: {
      name: 'Vertical displacement',
      formula: after ? `${M`ut + ½at^2`}, timed from the bounce` : M`u sin theta * t - ½gt^2`,
      sub: after ? null : M`${sub(f.uy)} * ${d(t, 2)} - ½ * ${d(g)} * ${d(t, 2)}^2 = ${d(sy)}`,
      value: sy, unit: 'm',
      note: `${M`${d(p.y)} [m]`} above the ground`,
    },
    r: {
      name: 'Distance from the launch',
      formula: M`sqrt("horizontal"^2 + "vertical"^2)`,
      sub: M`sqrt(${sub(sx)}^2 + ${sub(sy)}^2) = ${d(dist)}`,
      value: dist, unit: 'm',
      note: belowAbove(sy) === 'horizontal' ? 'horizontal' : `${M`${d(sAngle, 1)}°`} ${belowAbove(sy)}`,
    },
    angle: sAngle, dir: belowAbove(sy),
  };

  return {
    t, vertical, after,
    vx, vy, speed, sx, sy, dist,
    height: p.y,
    velocity, displacement,
    convention: 'Taking upwards as positive, so a negative vertical value means downwards.',
  };
}
