// question.js — turns an extracted exam question into engine parameters.
//
// This sits between the AI and the physics and is deliberately dumb: it does
// arithmetic the model is not allowed to do, and it refuses rather than guesses.
// Nothing here calls a network; it is pure and fully testable without a key.
//
// The model's job ends at "here are the numbers printed on the page". Every
// derived quantity — resolving tan α = 3/4 into degrees, working back from a
// range to a launch speed — happens here, in code, with tests behind it.

const DEG = 180 / Math.PI;

/* ── Angles ──────────────────────────────────────────────────────────────
   Papers give angles as trig ratios far more often than as degrees:
   sin α = 3/5, cos α = 4/5, tan α = 3/4, tan α = 7/24. Accept either. */

export function resolveAngle(angle) {
  if (!angle) return { ok: false, error: 'No angle given.' };

  let deg;
  if (typeof angle.degrees === 'number') {
    deg = angle.degrees;
  } else if (angle.ratio) {
    const { fn, num, den } = angle.ratio;
    if (!den) return { ok: false, error: 'Ratio has no denominator.' };
    const r = num / den;
    if (fn === 'tan') deg = Math.atan(r) * DEG;
    else if (fn === 'sin') {
      if (Math.abs(r) > 1) return { ok: false, error: `sin θ = ${num}/${den} is impossible — it must be between −1 and 1.` };
      deg = Math.asin(r) * DEG;
    } else if (fn === 'cos') {
      if (Math.abs(r) > 1) return { ok: false, error: `cos θ = ${num}/${den} is impossible — it must be between −1 and 1.` };
      deg = Math.acos(r) * DEG;
    } else return { ok: false, error: `Unknown ratio "${fn}".` };
  } else {
    return { ok: false, error: 'Angle is neither degrees nor a ratio.' };
  }

  if (angle.belowHorizontal) deg = -Math.abs(deg);
  if (!isFinite(deg)) return { ok: false, error: 'Angle did not resolve to a number.' };
  return { ok: true, degrees: deg };
}

/* ── Working backwards ───────────────────────────────────────────────────
   "A ball is projected from a 25 m cliff at 45° and lands 100 m away.
    Show that U = 28."  This exact shape is the single most common question
   in the sample, so it is worth solving properly rather than asking the
   student to guess the speed with a slider.

     R = u cosθ · t          and         0 = h + u sinθ · t − ½g t²
     eliminate t  →  u² = gR² / (2cos²θ (h + R tanθ))                      */

export function speedFromRange(R, thetaDeg, h, g) {
  const th = thetaDeg / DEG;
  const c = Math.cos(th);
  if (Math.abs(c) < 1e-9) return { ok: false, error: 'A vertical launch has no horizontal range.' };
  const denom = 2 * c * c * (h + R * Math.tan(th));
  if (denom <= 0) return { ok: false, error: 'No launch speed fits that range, angle and height.' };
  const u = R * Math.sqrt(g / denom);
  if (!isFinite(u) || u <= 0) return { ok: false, error: 'Launch speed did not resolve.' };
  return { ok: true, u };
}

/** Launch speed from the greatest height reached above the launch point. */
export function speedFromApex(riseAboveLaunch, thetaDeg, g) {
  const s = Math.sin(thetaDeg / DEG);
  if (Math.abs(s) < 1e-9) return { ok: false, error: 'A horizontal launch never rises.' };
  if (riseAboveLaunch < 0) return { ok: false, error: 'Rise above the launch point cannot be negative.' };
  return { ok: true, u: Math.sqrt(2 * g * riseAboveLaunch) / Math.abs(s) };
}

/* ── Extraction → engine ─────────────────────────────────────────────── */

const DEFAULT_G = 9.8;

/**
 * @param {Object} x  the extraction object (see worker/src/schema.js)
 * @returns {{ok, params?, markers?, missing?, derived?, notes?, error?}}
 *   params   { u, theta, h, g }  ready for flight()
 *   derived  anything this module worked out rather than read off the page —
 *            surfaced so the confirm screen can show it was calculated
 *   missing  fields the student still has to supply
 */
export function toEngine(x) {
  if (!x || typeof x !== 'object') return { ok: false, error: 'No question data.' };
  if (x.understood === false) {
    return { ok: false, error: x.note || 'Could not read a projectile question from that image.' };
  }

  const g = typeof x.g === 'number' && x.g > 0 ? x.g : DEFAULT_G;
  const notes = [];
  const derived = [];
  const missing = [];

  // Height. Absent means ground level, which is a real answer, not a gap.
  const h = typeof x.h === 'number' ? x.h : 0;

  // Angle.
  let theta = null;
  if (x.scenario === 'dropped') {
    theta = 0;
    notes.push('Dropped from rest, so there is no launch angle.');
  } else if (x.scenario === 'thrown_up') {
    theta = 90;
  } else if (x.scenario === 'thrown_down') {
    theta = -90;
  } else if (x.scenario === 'horizontal') {
    theta = 0;
  } else if (x.angle) {
    const a = resolveAngle(x.angle);
    if (!a.ok) return { ok: false, error: a.error };
    theta = a.degrees;
    if (x.angle.ratio) {
      const { fn, num, den } = x.angle.ratio;
      derived.push(`${fn} θ = ${num}/${den} → θ = ${theta.toFixed(2)}°`);
    }
  } else {
    missing.push('angle');
  }

  // Speed — given, or worked back from a range or an apex height.
  let u = typeof x.u === 'number' ? x.u : null;

  if (u === null && theta !== null) {
    if (typeof x.range === 'number') {
      const r = speedFromRange(x.range, theta, h, g);
      if (r.ok) {
        u = r.u;
        derived.push(`u from range ${x.range} m at ${theta.toFixed(2)}° from ${h} m → u = ${u.toFixed(2)} m s⁻¹`);
      } else notes.push(r.error);
    } else if (typeof x.apexAboveLaunch === 'number') {
      const r = speedFromApex(x.apexAboveLaunch, theta, g);
      if (r.ok) {
        u = r.u;
        derived.push(`u from a rise of ${x.apexAboveLaunch} m → u = ${u.toFixed(2)} m s⁻¹`);
      } else notes.push(r.error);
    }
  }

  if (x.scenario === 'dropped') u = 0;
  if (u === null) missing.push('launch speed');

  if (missing.length) {
    return {
      ok: false, needsInput: true, missing, notes, derived,
      partial: { u, theta, h, g },
      error: `Still need: ${missing.join(' and ')}.`,
    };
  }

  return {
    ok: true,
    params: { u, theta, h, g, azimuth: 0 },
    markers: normaliseMarkers(x.markers),
    asks: Array.isArray(x.asks) ? x.asks : [],
    derived, notes,
    summary: x.summary || null,
  };
}

/** Obstacles, targets and height lines the scene should draw. */
function normaliseMarkers(m) {
  if (!m || typeof m !== 'object') return {};
  const out = {};
  if (typeof m.obstacleDistance === 'number') {
    out.obstacle = { x: m.obstacleDistance, height: typeof m.obstacleHeight === 'number' ? m.obstacleHeight : 0 };
  }
  if (typeof m.targetDistance === 'number') {
    out.target = { x: m.targetDistance, y: typeof m.targetHeight === 'number' ? m.targetHeight : 0 };
  }
  if (typeof m.heightLine === 'number') out.heightLine = m.heightLine;
  return out;
}
