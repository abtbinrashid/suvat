// solve.js — work out the motion from whatever the student actually knows.
//
// THE PROMISE THIS FILE KEEPS
//   Any three of s, u, v, a, t determine the other two. That is the whole of
//   SUVAT, and it does not need an angle of projection. So:
//
//     • angle given, or findable       → a two-dimensional arc
//     • angle unknown and unfindable   → straight-line motion, said out loud
//     • fewer than three values        → refuse, and name what is missing
//
//   It never guesses silently. Every assumption it makes lands in `notes`,
//   every value it works out lands in `derived`, and when it cannot proceed
//   `reason` says what to add. The Launch button is wired to `ok`.
//
// ON SIGNS. A-level solutions always open by choosing a positive direction;
// this engine chooses the same way a student should — the direction of travel
// if the object is moving, otherwise the direction gravity pulls — and then
// signs the acceleration itself. The `a` box therefore takes the MAGNITUDE of
// the field; entering 9.81 for a ball thrown upwards gives a = −9.81 m s⁻²,
// and the convention used is reported back.

import { solve as solveFive } from './suvat.js';
import { flight } from './projectile.js';

const DEG = Math.PI / 180;
const EPS = 1e-9;
const have = (x) => typeof x === 'number' && isFinite(x);
const n = (x, p = 2) => Number(x.toFixed(p));
const d = (x, p = 2) => String(n(x, p));

/** The five, in the order the engine prefers to lean on them. */
const FIVE = ['s', 'u', 'v', 'g', 't'];
const PREFER = ['a', 'u', 't', 's', 'v'];
const WORD = ['none', 'one', 'two', 'three', 'four', 'five'];

/**
 * @param {Object} input  anything unknown is simply absent / null / NaN
 *   s      displacement — horizontal when it lands (2D) or along the line (1D)
 *   u      launch speed
 *   v      speed when it lands
 *   g      the `a` box: magnitude of the gravitational field
 *   t      time
 *   theta  angle of projection (degrees) — OPTIONAL, that is the point
 *   h      launch height above the ground
 * @param {Object} opts  { noAngle, lockAngle, theta } scenario constraints
 */
export function solveLaunch(input = {}, opts = {}) {
  const k = {};
  for (const key of ['s', 'u', 'v', 'g', 't', 'theta', 'h']) if (have(input[key])) k[key] = input[key];

  // A dropped object has no angle of projection and no launch speed to enter;
  // a vertical throw has a fixed one.
  if (opts.noAngle) { k.theta = -90; k.u = 0; }
  else if (opts.lockAngle && have(opts.theta)) k.theta = opts.theta;

  const ctx = newCtx(new Set(Object.keys(k)));

  /* ── 1 · gravity, because everything else leans on it ─────────────── */
  let g;
  if (have(k.g)) {
    g = Math.abs(k.g);
    if (k.g < -EPS) ctx.notes.push('The acceleration was entered as a negative number. Its size is what is used — the sign comes from the direction convention below.');
  } else if (have(k.u) && have(k.v) && have(k.h) && Math.abs(k.h) > EPS) {
    // v² = u² + 2gh is true at any angle, because it is really conservation of energy.
    g = (k.v * k.v - k.u * k.u) / (2 * k.h);
    if (g < -EPS) return fail('The landing speed is below the launch speed, which gravity alone cannot do. Check u, v and the launch height.', ctx);
    g = Math.max(0, g);
    ctx.add('g', `a = (v² − u²) / 2h = ${d(g)} m s⁻²`);
  } else {
    return fail('Enter the acceleration — pick a gravitational field below, or give u, v and the launch height so it can be worked out.', ctx);
  }

  /* ── 2 · which picture is this? ───────────────────────────────────── */
  const angleGiven = have(k.theta);
  const vertical = angleGiven && Math.abs(Math.abs(k.theta) - 90) < 1e-6;
  const atRest = have(k.u) && Math.abs(k.u) < EPS;

  if (vertical || atRest) return asLine(k, g, ctx, true);
  if (angleGiven) return asArc(k, g, ctx);

  // No angle. Try to find one first — a two-dimensional answer says more.
  const arc = asArc(k, g, newCtx(ctx.given, ctx));
  // An arc that had to invent BOTH the angle and the launch height is two
  // assumptions deep. Straight-line motion is one, so it wins that contest —
  // but only if it actually works.
  const twoDeep = arc.ok && arc.filled.theta && arc.assumedH;
  if (arc.ok && !twoDeep) return arc;

  // Still no angle, and that is fine: three of the five never needed one.
  const line = asLine(k, g, newCtx(ctx.given, ctx), false);
  if (line.ok) return line;
  if (arc.ok) return arc;

  // Neither worked. Give whichever shortfall is the more useful to hear.
  // A launch height is worth one of the five: it says where the motion ends.
  const count = FIVE.filter((x) => have(k[x])).length
    + (!have(k.s) && have(k.h) ? 1 : 0);
  if (count < 3) {
    const short = 3 - count;
    return fail(`Three of the five pin down the other two — you have ${WORD[count]}. Add ${short === 1 ? 'one more value' : `${WORD[short]} more values`}, or give the angle of projection.`, ctx);
  }
  // Both failed. A student who gave a horizontal displacement is picturing an
  // arc, so the arc's reason is the one that will mean something to them.
  const prefer = have(k.s) ? (arc.reason || line.reason) : (line.reason || arc.reason);
  return fail(prefer, ctx);
}

/* ── bookkeeping ───────────────────────────────────────────────────── */
function newCtx(given, from) {
  return {
    given,
    derived: from ? [...from.derived] : [],
    filled: from ? { ...from.filled } : {},
    notes: from ? [...from.notes] : [],
    add(key, how) { this.derived.push(how); this.filled[key] = how; },
  };
}
function fail(reason, ctx) {
  return { ok: false, reason, derived: ctx.derived, notes: ctx.notes, filled: ctx.filled };
}

/* ══ the arc — two dimensions, an angle of projection ═══════════════ */
function asArc(k, g, ctx) {
  let { s, u, v, t, h, theta } = k;

  /* the landing speed pins height against speed, whatever the angle */
  if (!have(h) && have(u) && have(v) && g > EPS) {
    const H = (v * v - u * u) / (2 * g);
    if (H < -1e-6) return fail('Those values give a negative launch height — the landing speed is below the launch speed, which cannot happen under gravity alone.', ctx);
    h = Math.max(0, H);
    ctx.add('h', `h = (v² − u²) / 2g = ${d(h)} m`);
  }
  if (!have(u) && have(v) && have(h) && g > EPS) {
    const sq = v * v - 2 * g * h;
    if (sq < 0) return fail(`Nothing launched from ${d(h)} m lands at only ${d(v)} m s⁻¹ — it arrives faster than that however gently it is thrown.`, ctx);
    u = Math.sqrt(sq);
    ctx.add('u', `u = √(v² − 2gh) = ${d(u)} m s⁻¹`);
  }

  /* s and t together give BOTH components, so both u and θ at once —
     the single most examined way of getting an unknown angle */
  if (!have(theta) && !have(u) && have(s) && have(t) && t > EPS && have(h)) {
    const ux = s / t;                             // horizontal: a = 0, so s = uₓt
    const uy = (0.5 * g * t * t - h) / t;         // vertical:   0 = h + u_y t − ½gt²
    u = Math.hypot(ux, uy);
    theta = Math.atan2(uy, ux) / DEG;
    ctx.add('u', `uₓ = s/t = ${d(ux)} and u_y = (½gt² − h)/t = ${d(uy)}, so u = √(uₓ² + u_y²) = ${d(u)} m s⁻¹`);
    ctx.add('theta', `tan θ = u_y / uₓ, so θ = ${d(theta, 1)}°`);
  }

  /* speed from the landing speed and the time, at a known angle */
  if (!have(u) && !have(h) && have(v) && have(t) && t > EPS && have(theta)) {
    // v² = u² − 2gt·u sin θ + g²t²  →  u² − (2gt sin θ)u + (g²t² − v²) = 0
    const sn = Math.sin(theta * DEG);
    const B = -2 * g * t * sn, C = g * g * t * t - v * v;
    const disc = B * B - 4 * C;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      const fits = [(-B - r) / 2, (-B + r) / 2]
        .filter((x) => x > EPS && 0.5 * g * t * t - x * sn * t > -1e-6);
      if (fits.length) {
        u = fits[0];
        ctx.add('u', `u² − (2gt sin θ)u + (g²t² − v²) = 0, so u = ${d(u)} m s⁻¹`);
      }
    }
  }

  /* the launch height, from the time of flight or from where it lands */
  if (!have(h) && have(u) && have(theta)) {
    const th = theta * DEG, c = Math.cos(th), sn = Math.sin(th);
    if (have(t) && t > EPS) {
      const H = 0.5 * g * t * t - u * sn * t;     // 0 = h + u sin θ t − ½gt²
      if (H < -1e-6) return fail(`It cannot stay in the air for ${d(t)} s when launched at ${d(u)} m s⁻¹ and ${d(theta, 1)}° — it would have to start below the ground.`, ctx);
      h = Math.max(0, H);
      ctx.add('h', `h = ½gt² − u sin θ · t = ${d(h)} m`);
    } else if (have(s) && Math.abs(c) > EPS) {
      const H = (g * s * s) / (2 * u * u * c * c) - s * Math.tan(th);
      if (H < -1e-6) return fail(`Launched at ${d(u)} m s⁻¹ and ${d(theta, 1)}° it already passes ${d(s)} m before coming down to the launch level, so no launch height fits.`, ctx);
      h = Math.max(0, H);
      ctx.add('h', `h = gs² / (2u²cos²θ) − s tan θ = ${d(h)} m`);
    }
  }

  if (!have(h)) {
    h = 0;
    ctx.assumedH = true;
    ctx.notes.push('No launch height given, so it is taken as 0 m — launched from the ground.');
  }

  /* the last gap among u and θ */
  if (!have(u) && !have(theta)) {
    return fail('The launch speed and the angle of projection are both unknown. Give one of them — or give the horizontal displacement and the time of flight together, which pin down both.', ctx);
  }
  if (!have(u)) {
    const r = findU(theta, h, g, s, t, v);
    if (!r.ok) return fail(r.reason, ctx);
    u = r.u; ctx.add('u', r.how);
  }
  if (!have(theta)) {
    const r = findTheta(u, h, g, s, t);
    if (!r.ok) return fail(r.reason, ctx);
    theta = r.theta; ctx.add('theta', r.how);
    if (r.alt != null) {
      ctx.notes.push(`A second angle works just as well: ${d(r.alt, 1)}°. This is the shallower of the two — the steeper one gets there later.`);
      ctx.altTheta = r.alt;
    }
  }

  if (u < -EPS) return fail('The launch speed cannot be negative. Use the angle of projection to set the direction.', ctx);
  return finish({ u: Math.abs(u), theta, h, g }, '2d', k, ctx, null);
}

/* ── find the launch speed, angle known ───────────────────────────── */
function findU(theta, h, g, s, t, v) {
  const th = theta * DEG, c = Math.cos(th), sn = Math.sin(th);

  if (have(t) && t > EPS) {
    // 0 = h + u sin θ t − ½gt²  →  u = (½gt² − h) / (t sin θ)
    if (Math.abs(sn) < EPS) return { ok: false, reason: 'A horizontal launch falls for a time set only by the height, so the time of flight cannot give the speed. Give the horizontal displacement instead.' };
    const u = (0.5 * g * t * t - h) / (t * sn);
    if (!isFinite(u) || u < 0) return { ok: false, reason: `No launch speed keeps it in the air for ${d(t)} s at ${d(theta, 1)}° from ${d(h)} m.` };
    return { ok: true, u, how: `u = (½gt² − h) / (t sin θ) = ${d(u)} m s⁻¹` };
  }

  if (have(s)) {
    if (Math.abs(c) < EPS) return { ok: false, reason: 'A vertical launch has no horizontal displacement, so it cannot be used to find the speed.' };
    const denom = 2 * c * c * (h + s * Math.tan(th));
    if (denom <= 0) return { ok: false, reason: `Nothing launched at ${d(theta, 1)}° from ${d(h)} m lands ${d(s)} m away — the geometry does not allow it.` };
    const u = s * Math.sqrt(g / denom);
    if (!isFinite(u) || u <= 0) return { ok: false, reason: 'No launch speed fits those values.' };
    return { ok: true, u, how: `from s = ${d(s)} m at θ = ${d(theta, 1)}°, u = ${d(u)} m s⁻¹` };
  }

  if (have(v)) {
    const sq = v * v - 2 * g * h;
    if (sq < 0) return { ok: false, reason: `Nothing launched from ${d(h)} m lands at only ${d(v)} m s⁻¹.` };
    const u = Math.sqrt(sq);
    return { ok: true, u, how: `u = √(v² − 2gh) = ${d(u)} m s⁻¹` };
  }

  return { ok: false, reason: 'To find the launch speed, also give where it lands, the time of flight, or the landing speed.' };
}

/* ── find the angle of projection ─────────────────────────────────── */
function findTheta(u, h, g, s, t) {
  if (have(t) && t > EPS && u > EPS) {
    // sin θ = (½gt² − h) / ut
    const sn = (0.5 * g * t * t - h) / (u * t);
    if (Math.abs(sn) > 1) return { ok: false, reason: `No angle keeps it up for ${d(t)} s at ${d(u)} m s⁻¹ — ${sn > 1 ? 'even straight up is not enough' : 'even straight down takes longer than that'}.` };
    const theta = Math.asin(sn) / DEG;
    return { ok: true, theta, how: `sin θ = (½gt² − h) / ut, so θ = ${d(theta, 1)}°` };
  }

  if (have(s) && u > EPS && g > EPS) {
    // The trajectory equation at the landing point, with T = tan θ:
    //   (gs²/2u²)T² − sT + (gs²/2u² − h) = 0
    const A = (g * s * s) / (2 * u * u);
    const B = -s;
    const C = A - h;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return { ok: false, reason: `No angle reaches ${d(s)} m at ${d(u)} m s⁻¹ — the launch speed is too small. ${d(maxRange(u, h, g))} m is as far as it can go.` };
    const r = Math.sqrt(disc);
    const angles = [Math.atan((-B + r) / (2 * A)) / DEG, Math.atan((-B - r) / (2 * A)) / DEG].sort((a, b) => a - b);
    return {
      ok: true, theta: angles[0],
      alt: Math.abs(angles[0] - angles[1]) > 0.05 ? angles[1] : null,
      how: `from s = ${d(s)} m at u = ${d(u)} m s⁻¹, θ = ${d(angles[0], 1)}°`,
    };
  }

  return { ok: false, reason: 'To find the angle of projection, also give where it lands or the time of flight.' };
}

/** Furthest it can possibly go, at the best angle — used to explain refusals. */
function maxRange(u, h, g) {
  if (g <= EPS) return Infinity;
  return (u / g) * Math.sqrt(u * u + 2 * g * h);
}

/* ══ the line — one dimension, no angle needed ══════════════════════ */
function asLine(k, g, ctx, angleKnown) {
  // Choose a positive direction the way a student is taught to: the way it is
  // travelling, or — starting from rest — the way gravity pulls.
  const up = have(k.theta) ? k.theta > EPS : (have(k.u) && Math.abs(k.u) > EPS);
  const a = up ? -g : g;

  const known = { a };
  if (have(k.u)) known.u = Math.abs(k.u);
  if (have(k.t)) known.t = k.t;
  if (have(k.s)) known.s = k.s;

  // It finishes on the ground. If the displacement was not given but the launch
  // height was, then the displacement to landing is already known.
  // A launch height of 0 counts: it means it lands back where it started.
  // It is ranked last, though — a figure the student typed always outranks one
  // inferred from a height the scenario happened to pre-fill.
  let sFromHeight = false;
  if (!have(k.s) && have(k.h)) {
    known.s = k.h > EPS ? (up ? -k.h : k.h) : 0;
    sFromHeight = true;
    ctx.add('s', k.h > EPS
      ? `it lands on the ground ${d(k.h)} m below the launch point, so s = ${d(known.s)} m`
      : 'it lands back at the level it was launched from, so s = 0 m');
  }

  // A displacement beyond the turning point simply never happens. Say so,
  // rather than letting the quadratic report a negative discriminant.
  if (have(known.s) && have(known.u) && Math.abs(a) > EPS && known.u * a < 0) {
    const sTurn = -(known.u * known.u) / (2 * a);
    if (known.s > sTurn + 1e-6) {
      return fail(`At ${d(Math.abs(known.u))} m s\u207b\u00b9 it only reaches ${d(sTurn)} m before turning back, so a displacement of ${d(known.s)} m never happens.`, ctx);
    }
  }

  // The landing speed is usually quoted as a speed, not a signed velocity. Try
  // it both ways round and keep whichever runs forwards in time.
  const vTries = have(k.v)
    ? (Math.abs(k.v) < EPS ? [0] : [Math.abs(k.v), -Math.abs(k.v)])
    : [null];

  // Pick the sign that both runs forwards in time AND leaves nothing in
  // conflict — a landing speed quoted as +14 when it is really −14 must not be
  // reported as a contradiction when flipping it resolves everything.
  let clean = null, forwards = null, firstOk = null, firstFail = null;
  for (const vTry of vTries) {
    const trial = { ...known };
    if (vTry !== null) trial.v = vTry;
    const r = runLine(trial, sFromHeight ? 's' : null);
    if (!r.ok) { firstFail = firstFail || r; continue; }
    r.known = trial;                      // the figures this answer actually used
    firstOk = firstOk || r;
    if (r.values.t <= EPS) continue;
    forwards = forwards || r;
    if (!r.clash.length) { clean = r; break; }
  }
  let best = clean || forwards || firstOk;
  if (!best) {
    if (firstFail?.short) {
      const count = 3 - firstFail.short;   // already counts the height, via s
      return fail(`Three of the five pin down the other two — you have ${WORD[count]}. Add ${firstFail.short === 1 ? 'one more value' : `${WORD[firstFail.short]} more values`}.`, ctx);
    }
    return fail(firstFail?.reason || 'Those values do not pin down the motion — try a different combination.', ctx);
  }

  const vals = best.values;
  if (!isFinite(vals.t) || vals.t < -EPS) {
    return fail('Those values only work going backwards in time. Check the signs — displacement is measured in the direction of travel.', ctx);
  }

  // The guess about which way is positive can turn out backwards — ask for a
  // 3-second flight with no speed and the answer is an UPWARD throw. Flipping
  // every sign is the same physics relabelled, and it reads the right way up.
  let positiveUp = up;
  if (vals.u < -EPS) {
    positiveUp = !up;
    for (const key of ['s', 'u', 'v', 'a']) if (have(vals[key])) vals[key] = -vals[key];
    for (const key of ['s', 'u', 'v']) if (have(known[key])) known[key] = -known[key];
  }

  // Report what the five equations gave, and in what direction.
  ctx.convention = positiveUp ? 'Taking upwards as positive.' : 'Taking downwards as positive.';
  for (const key of ['s', 'u', 'v', 't']) {
    if (!have(known[key]) && have(vals[key])) {
      const step = best.steps.find((st) => st.target === key);
      ctx.add(key === 'u' ? 'u' : key, step ? `${step.rearranged} → ${key} = ${d(vals[key])}` : `${key} = ${d(vals[key])}`);
    }
  }
  // Values that genuinely contradict each other must not be drawn — the
  // diagram would disagree with the numbers beside it. Refuse, and say which.
  // (`vals` may have been relabelled above, so quote sizes, not signs.)
  if (best.clash.length) {
    const others = best.used.map((x) => x.toUpperCase()).join(', ');
    if (best.clash.includes('s') && sFromHeight) {
      const needed = positiveUp ? -vals.s : vals.s;
      return fail(`A launch height of ${d(k.h)} m does not fit the rest — ${others} need it to be ${d(Math.abs(needed))} m. Clear the launch height, or change one of the five.`, ctx);
    }
    const c = best.clash[0];
    const asGiven = best.known[c];
    return fail(`These do not all fit together: ${c.toUpperCase()} was given as ${d(Math.abs(asGiven))}, but ${others} make it ${d(Math.abs(vals[c]))}. Clear one of them, or check the signs.`, ctx);
  }

  /* turn it back into something that can be drawn */
  const movingUp = Math.abs(vals.u) < EPS ? false : (vals.u > 0) === positiveUp;
  const theta = movingUp ? 90 : -90;
  const uMag = Math.abs(vals.u);

  let h = have(k.h) ? k.h : null;
  if (h === null) {
    // It has to fall from somewhere: far enough up that this displacement
    // brings it to the ground.
    const drop = positiveUp ? Math.max(0, -vals.s) : Math.max(0, vals.s);
    h = drop;
    if (drop > EPS) ctx.notes.push(`No launch height given, so it starts ${d(h)} m up — the height a displacement of ${d(vals.s)} m needs in order to reach the ground.`);
    else ctx.notes.push('No launch height given, so it is taken as 0 m — launched from the ground.');
  }

  if (!angleKnown) {
    ctx.notes.unshift('No angle of projection given, so this is worked out as motion in a straight line — straight up and down. For an arc, add the angle, or give where it lands together with the time of flight.');
  }
  return finish({ u: uMag, theta, h, g }, '1d', k, ctx, { up: positiveUp, vals, steps: best.steps });
}

/**
 * Pick three of the five, solve, then check anything left over.
 * @param inferred  a key that was not typed but worked out — it goes last, so
 *                  the three the engine leans on are the student's own.
 */
function runLine(known, inferred) {
  const typed = PREFER.filter((x) => have(known[x]) && x !== inferred);
  const present = inferred && have(known[inferred]) ? [...typed, inferred] : typed;
  if (present.length < 3) return { ok: false, short: 3 - present.length };

  const use = {};
  for (const key of present.slice(0, 3)) use[key] = known[key];
  const r = solveFive(use);
  // suvat.js keeps the real physical reason in `detail` and falls back to a
  // generic message; the real one is what the student needs to read.
  if (!r.ok) return { ok: false, reason: (r.detail && r.detail[0]) || r.error };

  // Anything spare has to agree. The tolerance is loose enough for a textbook's
  // rounded answer and tight enough to catch values that genuinely conflict.
  const spare = present.slice(3);
  const clash = spare.filter((key) => {
    const tol = Math.max(0.1, Math.abs(known[key]) * 0.03);
    return Math.abs(r.values[key] - known[key]) > tol;
  });
  return { ok: true, values: { ...r.values }, steps: r.steps, used: present.slice(0, 3), clash };
}

/* ══ assemble the answer ════════════════════════════════════════════ */
function finish(params, mode, k, ctx, lineInfo) {
  const f = flight(params);
  const g = params.g;
  const landed = f.vel(f.tMax);

  // The five quantities of the flight that is about to be drawn.
  let five;
  if (mode === '2d') {
    five = {
      s: { value: f.range,    label: 'horizontal displacement', unit: 'm' },
      u: { value: params.u,   label: 'launch speed',            unit: 'm s⁻¹' },
      v: { value: f.vLanding, label: 'landing speed',           unit: 'm s⁻¹' },
      a: { value: g,          label: 'acceleration',            unit: 'm s⁻²' },
      t: { value: f.tFlight,  label: 'time of flight',          unit: 's' },
    };
    ctx.convention = 'Displacement is measured horizontally from the launch point; u and v are speeds.';
  } else {
    const up = lineInfo.up;
    const toAxis = (y) => (up ? y : -y);
    // When the solve describes the whole flight, quote the solve — otherwise
    // the derivation on screen and the figure in the box can disagree by 0.01.
    const whole = Math.abs(lineInfo.vals.t - f.tFlight) <= 1e-6;
    const q = lineInfo.vals;
    five = {
      s: { value: whole ? q.s : toAxis(0 - params.h), label: 'displacement',     unit: 'm' },
      u: { value: whole ? q.u : toAxis(f.uy),         label: 'initial velocity', unit: 'm s⁻¹' },
      v: { value: whole ? q.v : toAxis(landed.y),     label: 'final velocity',   unit: 'm s⁻¹' },
      a: { value: up ? -g : g,                        label: 'acceleration',     unit: 'm s⁻²' },
      t: { value: f.tFlight,                          label: 'time of flight',   unit: 's' },
    };
  }

  // Which of them the student supplied, and which the engine found. A box only
  // counts as given when the figure shown really is the one that was typed —
  // ask for the height at 3 s of a 4-second flight and t is NOT your 3.
  const givenFive = { s: 's', u: 'u', v: 'v', a: 'g', t: 't' };
  for (const [slot, inputKey] of Object.entries(givenFive)) {
    const raw = k[inputKey];
    const shown = five[slot].value;
    const tol = Math.max(0.02, Math.abs(shown) * 0.01);
    // compare sizes, so a landing speed quoted as 14 still matches v = -14
    const same = have(raw) && Math.abs(Math.abs(raw) - Math.abs(shown)) <= tol;
    five[slot].given = ctx.given.has(inputKey) && same;
    five[slot].how = ctx.filled[inputKey] || null;
  }

  // Worth knowing beyond the five.
  const extras = [
    { key: 'apex',  label: 'greatest height',    value: f.apexHeight, unit: 'm' },
    { key: 'tApex', label: 'time to the top',    value: f.tApex,      unit: 's' },
    { key: 'h',     label: 'launch height',      value: params.h,     unit: 'm' },
    { key: 'theta', label: 'angle of projection', value: params.theta, unit: '°' },
    { key: 'land',  label: 'angle on landing',   value: f.landingAngle, unit: '°' },
  ].filter((x) => isFinite(x.value));

  // If the student's own question was about a moment mid-flight, say when it
  // happens — that is the answer they were after, not the whole flight.
  let moment = null, answer = null;
  if (lineInfo && isFinite(lineInfo.vals.t) && lineInfo.vals.t > EPS
      && Math.abs(lineInfo.vals.t - f.tFlight) > 0.02) {
    const q = lineInfo.vals;
    const whole = `The whole flight lasts ${d(f.tFlight)} s.`;
    let text;
    if (ctx.given.has('t')) {
      // they asked about an instant, so answer at that instant
      text = `After ${d(q.t)} s the displacement is ${d(q.s)} m and the velocity is ${d(q.v)} m s\u207b\u00b9. ${whole}`;
    } else {
      const times = crossingTimes(lineInfo, f, params);
      text = times.length > 1
        ? `A displacement of ${d(q.s)} m happens twice: at ${d(times[0])} s on the way up and again at ${d(times[1])} s coming back down. ${whole}`
        : `It reaches a displacement of ${d(q.s)} m after ${d(q.t)} s. ${whole}`;
    }
    moment = { t: q.t, s: q.s, v: q.v, text };

    // The five as they stand at that moment — this is the answer to the
    // question actually asked, as distinct from the whole flight below.
    const up = lineInfo.up;
    answer = {
      s: { value: q.s, label: 'displacement',     unit: 'm' },
      u: { value: q.u, label: 'initial velocity', unit: 'm s⁻¹' },
      v: { value: q.v, label: 'final velocity',   unit: 'm s⁻¹' },
      a: { value: q.a, label: 'acceleration',     unit: 'm s⁻²' },
      t: { value: q.t, label: 'time',             unit: 's' },
    };
    for (const [slot, inputKey] of Object.entries({ s: 's', u: 'u', v: 'v', a: 'g', t: 't' })) {
      const raw = k[inputKey];
      const tol = Math.max(0.02, Math.abs(answer[slot].value) * 0.01);
      answer[slot].given = ctx.given.has(inputKey)
        && have(raw) && Math.abs(Math.abs(raw) - Math.abs(answer[slot].value)) <= tol;
    }
  }

  return {
    ok: true, mode, params, f,
    axis: mode === '1d' ? (lineInfo.up ? 'up' : 'down') : null,
    derived: ctx.derived, filled: ctx.filled, notes: ctx.notes,
    convention: ctx.convention, altTheta: ctx.altTheta ?? null,
    assumedH: ctx.assumedH === true,
    five, extras, moment, answer,
  };
}

/** Every time during the flight at which it is at that displacement, in order. */
function crossingTimes(lineInfo, f, params) {
  const { up, vals } = lineInfo;
  const g = params.g;
  if (g <= EPS) return [vals.t];
  const sWorld = up ? vals.s : -vals.s;        // displacement in world-up terms
  const disc = f.uy * f.uy + 2 * g * -sWorld;
  if (disc < 0) return [vals.t];
  const r = Math.sqrt(disc);
  const roots = [(f.uy - r) / g, (f.uy + r) / g]
    .filter((t) => t > EPS && t <= f.tMax + 1e-9)
    .sort((a, b) => a - b);
  return roots.length ? roots : [vals.t];
}
