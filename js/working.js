// working.js — the working out, with the student's own numbers substituted.
//
// Written the way it would be written in an exam: name the equation, state the
// rearrangement, substitute, give the result. No invented steps, and nothing
// claimed that the engine did not actually compute.
//
// Vocabulary is A-level throughout: initial velocity, angle of projection,
// vertical component, horizontal displacement. Not "sx" and "sy".

const d = (x, p = 2) => (isFinite(x) ? Number(x.toFixed(p)).toString() : '∞');
const sub = (x, p = 2) => (x < 0 ? `(${d(x, p)})` : d(x, p));

export function buildWorking(f, t) {
  const { u, theta, h, g } = f.params;
  const steps = [];
  const vertical = Math.abs(Math.cos((theta * Math.PI) / 180)) < 1e-9;

  /* 1 — resolve */
  if (!vertical && u > 0) {
    steps.push({
      title: 'Resolve the initial velocity',
      rows: [
        { f: 'horizontal component = u cos θ',
          s: `${d(u)} × cos ${d(theta, 1)}° = ${d(f.horiz)} m s⁻¹` },
        { f: 'vertical component = u sin θ',
          s: `${d(u)} × sin ${d(theta, 1)}° = ${d(f.uy)} m s⁻¹` },
      ],
      note: 'Horizontal and vertical motion are now independent. They share only the time.',
    });
  } else if (vertical) {
    steps.push({
      title: 'Resolve the initial velocity',
      rows: [{ f: 'motion is vertical only', s: `horizontal component = 0, vertical component = ${d(f.uy)} m s⁻¹` }],
      note: 'There is no horizontal motion, so this is a one-dimensional problem.',
    });
  }

  /* 2 — time of flight, from the vertical equation */
  if (g > 1e-9) {
    const disc = f.uy * f.uy + 2 * g * h;
    steps.push({
      title: 'Time of flight — vertical, s = ut + ½at²',
      rows: [
        { f: 'taking up as positive, s = −h at landing',
          s: `−${d(h)} = ${sub(f.uy)}t − ½ × ${d(g)}t²` },
        { f: 't = [u sin θ + √((u sin θ)² + 2gh)] / g',
          s: `[${d(f.uy)} + √(${d(f.uy * f.uy)} + ${d(2 * g * h)})] / ${d(g)} = ${d(f.tFlight, 3)} s`,
          r: `t = ${d(f.tFlight, 3)} s` },
      ],
      note: h > 0
        ? 'Launched above the ground, so the flight is not symmetrical — it spends longer coming down than going up.'
        : 'Level ground, so the time up equals the time down.',
      skip: disc < 0,
    });
  } else {
    steps.push({
      title: 'Time of flight',
      rows: [{ f: 'g = 0, so there is no vertical acceleration', s: f.uy >= 0 ? 'the object never returns to the ground' : `t = h / |u sin θ| = ${d(f.tFlight, 3)} s` }],
      note: 'With no gravitational field the velocity is constant and the path is a straight line.',
    });
  }

  /* 3 — greatest height */
  if (g > 1e-9 && f.uy > 0) {
    steps.push({
      title: 'Greatest height — vertical, v² = u² + 2as',
      rows: [
        { f: 'at the highest point the vertical velocity is zero',
          s: `0 = ${d(f.uy)}² − 2 × ${d(g)} × s` },
        { f: 'rise above the launch point = (u sin θ)² / 2g',
          s: `${d(f.uy * f.uy)} / ${d(2 * g)} = ${d(f.apexHeight - h, 2)} m`,
          r: `greatest height above the ground = ${d(f.apexHeight, 2)} m at t = ${d(f.tApex, 3)} s` },
      ],
      note: 'Only vertical quantities appear — the horizontal motion is irrelevant here.',
    });
  }

  /* 4 — horizontal displacement */
  if (!vertical && isFinite(f.tFlight)) {
    steps.push({
      title: 'Horizontal displacement — a = 0, so s = ut',
      rows: [
        { f: 's = u cos θ × t',
          s: `${d(f.horiz)} × ${d(f.tFlight, 3)} = ${d(f.range, 2)} m`,
          r: `horizontal displacement = ${d(f.range, 2)} m` },
      ],
      note: 'There is no horizontal acceleration, so the horizontal velocity never changes.',
    });
  }

  /* 5 — this instant */
  const p = f.pos(t), v = f.vel(t);
  steps.push({
    title: `At t = ${d(t, 2)} s`,
    rows: [
      { f: 'horizontal displacement = u cos θ × t', s: `${d(f.horiz)} × ${d(t, 2)} = ${d(p.x, 2)} m` },
      { f: 'height = h + u sin θ × t − ½gt²',
        s: `${d(h)} + ${sub(f.uy)} × ${d(t, 2)} − ½ × ${d(g)} × ${d(t, 2)}² = ${d(p.y, 2)} m` },
      { f: 'vertical velocity = u sin θ − gt',
        s: `${sub(f.uy)} − ${d(g)} × ${d(t, 2)} = ${d(v.y, 2)} m s⁻¹` },
      { f: 'speed = √(horizontal² + vertical²)',
        s: `√(${d(v.x)}² + ${d(v.y)}²) = ${d(Math.hypot(v.x, v.y), 2)} m s⁻¹`,
        r: `speed = ${d(Math.hypot(v.x, v.y), 2)} m s⁻¹` },
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
