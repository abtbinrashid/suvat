// solve.js — work out a launch from whatever the student actually knows.
//
// A paper rarely hands you u, θ, h and g. It gives you three of them and the
// range, or the time, or the landing speed, and expects you to find the rest.
// This does that, and refuses — with a reason — when the values given do not
// determine the motion.
//
// It never guesses. If something cannot be found, `ok` is false and `reason`
// says what is missing. The Fire button is wired to that.

const DEG = Math.PI / 180;
const EPS = 1e-9;
const n = (x, p = 2) => Number(x.toFixed(p));

/**
 * @param {Object} k   known values; anything unknown is null/undefined
 *   u      launch speed (m/s)
 *   theta  angle of projection (degrees)
 *   h      launch height (m)
 *   g      acceleration due to gravity (m/s²)
 *   s      horizontal displacement when it lands (m)
 *   t      time of flight (s)
 *   v      speed when it lands (m/s)
 * @param {Object} opts  { noAngle, lockAngle }  scenario constraints
 */
export function solveLaunch(k, opts = {}) {
  const have = (x) => typeof x === 'number' && isFinite(x);
  let { u, theta, h, g, s, t, v } = k;
  const derived = [];

  // A dropped object has no angle of projection; a vertical launch has a fixed one.
  if (opts.noAngle) theta = -90;
  if (opts.lockAngle && have(k.theta)) theta = k.theta;

  /* ── gravity first: everything else leans on it ──────────────────── */
  if (!have(g)) {
    if (have(u) && have(v) && have(h) && Math.abs(h) > EPS) {
      // v² = u² + 2gh — true whatever the angle, because it is just energy.
      g = (v * v - u * u) / (2 * h);
      derived.push(`g = (v² − u²) / 2h = ${n(g)} m s⁻²`);
    } else {
      return fail('Enter the acceleration due to gravity, or give the initial velocity, the landing speed and the launch height so it can be found.');
    }
  }
  if (g < 0) return fail('The acceleration due to gravity cannot be negative here. Take downwards as negative instead.');

  /* ── the landing speed pins height against speed, at any angle ────── */
  if (!have(h) && have(u) && have(v) && g > EPS) {
    h = (v * v - u * u) / (2 * g);
    if (h < 0) return fail('Those values give a negative launch height — the landing speed is smaller than the launch speed, which cannot happen under gravity alone.');
    derived.push(`h = (v² − u²) / 2g = ${n(h)} m`);
  }
  if (!have(u) && have(v) && have(h) && g > EPS) {
    const sq = v * v - 2 * g * h;
    if (sq < 0) return fail('No launch speed fits that landing speed and height.');
    u = Math.sqrt(sq);
    derived.push(`u = √(v² − 2gh) = ${n(u)} m s⁻¹`);
  }

  if (!have(h)) { h = 0; derived.push('Launch height taken as 0 m — launched from the ground.'); }

  /* ── fill the last gap among u, θ, t and s ───────────────────────── */
  const missing = [];
  if (!have(u)) missing.push('u');
  if (!have(theta)) missing.push('theta');

  if (missing.length === 0) {
    // nothing to do
  } else if (missing.length === 1 && missing[0] === 'u') {
    const r = findU(theta, h, g, s, t);
    if (!r.ok) return fail(r.reason);
    u = r.u; derived.push(r.how);
  } else if (missing.length === 1 && missing[0] === 'theta') {
    const r = findTheta(u, h, g, s, t);
    if (!r.ok) return fail(r.reason);
    theta = r.theta; derived.push(r.how);
    if (r.alt != null) derived.push(`There is a second angle that also works: ${n(r.alt, 1)}°.`);
  } else {
    return fail('Both the initial velocity and the angle of projection are unknown. Enter one of them, or give enough other values to find one.');
  }

  if (!have(u) || !have(theta)) return fail('Not enough information to work out the launch.');
  if (u < 0) return fail('The initial velocity cannot be negative. Use the angle to set the direction.');

  return { ok: true, params: { u, theta, h, g }, derived };
}

function fail(reason) { return { ok: false, reason }; }

/* ── find the launch speed ──────────────────────────────────────────── */
function findU(theta, h, g, s, t) {
  const have = (x) => typeof x === 'number' && isFinite(x);
  const th = theta * DEG, c = Math.cos(th), sn = Math.sin(th);

  if (have(t) && t > EPS) {
    // 0 = h + u sinθ t − ½g t²  →  u = (½g t² − h) / (t sinθ)
    if (Math.abs(sn) < EPS) return { ok: false, reason: 'With a horizontal launch the time of flight depends only on the height, so it cannot give the initial velocity. Give the horizontal displacement instead.' };
    const u = (0.5 * g * t * t - h) / (t * sn);
    if (!isFinite(u) || u < 0) return { ok: false, reason: 'No launch speed fits that time of flight.' };
    return { ok: true, u, how: `u = (½gt² − h) / (t sin θ) = ${n(u)} m s⁻¹` };
  }

  if (have(s)) {
    if (Math.abs(c) < EPS) return { ok: false, reason: 'A vertical launch has no horizontal displacement, so it cannot be used to find the speed.' };
    const denom = 2 * c * c * (h + s * Math.tan(th));
    if (denom <= 0) return { ok: false, reason: 'No launch speed fits that horizontal displacement, angle and height.' };
    const u = s * Math.sqrt(g / denom);
    if (!isFinite(u) || u <= 0) return { ok: false, reason: 'No launch speed fits those values.' };
    return { ok: true, u, how: `u from a horizontal displacement of ${n(s)} m = ${n(u)} m s⁻¹` };
  }

  return { ok: false, reason: 'To find the initial velocity, also give the horizontal displacement when it lands, the time of flight, or the landing speed.' };
}

/* ── find the angle of projection ───────────────────────────────────── */
function findTheta(u, h, g, s, t) {
  const have = (x) => typeof x === 'number' && isFinite(x);

  if (have(t) && t > EPS && u > EPS) {
    // sinθ = (½g t² − h) / (u t)
    const sn = (0.5 * g * t * t - h) / (u * t);
    if (Math.abs(sn) > 1) return { ok: false, reason: 'No angle fits that time of flight — the launch speed is too small to stay in the air that long.' };
    const theta = Math.asin(sn) / DEG;
    return { ok: true, theta, how: `sin θ = (½gt² − h) / ut, so θ = ${n(theta, 1)}°` };
  }

  if (have(s) && u > EPS && g > EPS) {
    // Trajectory equation at landing, with T = tanθ:
    //   (gs²/2u²) T² − s T + (gs²/2u² − h) = 0
    const A = (g * s * s) / (2 * u * u);
    const B = -s;
    const C = A - h;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return { ok: false, reason: `No angle reaches ${n(s)} m at ${n(u)} m s⁻¹ — the launch speed is too small.` };
    const r = Math.sqrt(disc);
    const t1 = (-B + r) / (2 * A), t2 = (-B - r) / (2 * A);
    const angles = [Math.atan(t1) / DEG, Math.atan(t2) / DEG].sort((a, b) => a - b);
    // The low trajectory is the one students are nearly always after.
    return { ok: true, theta: angles[0], alt: Math.abs(angles[0] - angles[1]) > 0.05 ? angles[1] : null,
             how: `θ from a horizontal displacement of ${n(s)} m = ${n(angles[0], 1)}°` };
  }

  return { ok: false, reason: 'To find the angle of projection, also give the horizontal displacement when it lands, or the time of flight.' };
}
