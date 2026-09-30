// suvat.js — the five equations of uniform acceleration, and a solver that shows its working.
//
// Model assumptions (A-level): acceleration is CONSTANT, motion is in a straight line.
// No drag, no varying g. That is the whole point of this site.

export const SYMBOLS = ['s', 'u', 'v', 'a', 't'];

export const NAMES = {
  s: 'displacement',
  u: 'initial velocity',
  v: 'final velocity',
  a: 'acceleration',
  t: 'time',
};

export const UNITS = { s: 'm', u: 'm s⁻¹', v: 'm s⁻¹', a: 'm s⁻²', t: 's' };

// Each equation omits exactly one of the five variables. That omission is what
// makes the equation useful: pick the one that leaves out what you do not know
// and do not care about.
export const EQUATIONS = [
  { id: 1, tex: 'v = u + at',    missing: 's', note: 'no displacement' },
  { id: 2, tex: 's = ut + \u00bdat\u00b2', missing: 'v', note: 'no final velocity' },
  { id: 3, tex: 's = \u00bd(u + v)t',  missing: 'a', note: 'no acceleration' },
  { id: 4, tex: 'v\u00b2 = u\u00b2 + 2as',  missing: 't', note: 'no time' },
  { id: 5, tex: 's = vt \u2212 \u00bdat\u00b2', missing: 'u', note: 'no initial velocity' },
];

const EPS = 1e-12;

function n(x, dp = 4) {
  if (!isFinite(x)) return String(x);
  const r = Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-4 && x !== 0)
    ? x.toExponential(3)
    : String(Number(x.toFixed(dp)));
  return r;
}

// Format a signed value for substitution into a formula, bracketing negatives
// so students see (−9.81) rather than a stray double minus.
function sub(x, dp = 4) {
  return x < 0 ? `(${n(x, dp)})` : n(x, dp);
}

/**
 * Solve for the two unknowns given exactly three knowns.
 * @param {Object} known  e.g. { u: 0, a: 9.81, t: 3 }
 * @returns {{ok:boolean, values?:Object, steps?:Array, error?:string, warnings?:Array}}
 */
export function solve(known) {
  // A ± root (from v² = u² + 2as) or a quadratic in t can each yield two
  // mathematically valid answers. Try both branches and prefer the one that is
  // physically sensible — time running forwards.
  const primary = solveBranch(known, 0);
  if (!primary.ok) return primary;
  if (!primary.steps.some((st) => st.roots && st.roots.length === 2)) return primary;

  const alt = solveBranch(known, 1);
  if (!alt.ok) return primary;

  const score = (r) => {
    const t = r.values.t;
    if (!isFinite(t)) return -2;
    if (t > EPS) return 2;        // forwards in time — what we want
    if (Math.abs(t) <= EPS) return 0;  // t = 0: the trivial launch instant
    return -1;                    // negative time
  };
  const pick = score(alt) > score(primary) ? alt : primary;
  pick.alternative = pick === primary ? alt : primary;
  return pick;
}

function solveBranch(known, branch) {
  const have = SYMBOLS.filter((k) => known[k] !== undefined && known[k] !== null && isFinite(known[k]));
  const missing = SYMBOLS.filter((k) => !have.includes(k));

  if (have.length < 3) {
    return { ok: false, error: `Need 3 known values — you have ${have.length}.`, need: 3 - have.length };
  }
  if (have.length > 3) {
    return { ok: false, error: `Only 3 values are needed. Clear ${have.length - 3} to solve.` };
  }

  const vals = {};
  have.forEach((k) => (vals[k] = known[k]));
  const steps = [];
  const warnings = [];

  // Two unknowns remain. An equation that OMITS one unknown must contain the
  // other as its only unknown — so it can be solved directly. Do that twice.
  let remaining = [...missing];
  let guard = 0;
  while (remaining.length && guard++ < 6) {
    let progressed = false;

    for (const target of remaining) {
      // Find an equation containing `target` whose other three variables are all known.
      const usable = EQUATIONS.filter((eq) => {
        const vars = SYMBOLS.filter((x) => x !== eq.missing);
        if (!vars.includes(target)) return false;
        return vars.every((x) => x === target || vals[x] !== undefined);
      });

      for (const eq of usable) {
        const step = applyEquation(eq, target, vals, branch);
        if (!step) continue;
        if (step.error) { warnings.push(step.error); continue; }
        vals[target] = step.value;
        steps.push(step);
        if (step.warning) warnings.push(step.warning);
        remaining = remaining.filter((x) => x !== target);
        progressed = true;
        break;
      }
      if (progressed) break;
    }

    if (!progressed) {
      return {
        ok: false,
        error: 'These three values do not pin down the motion — try a different combination.',
        detail: warnings,
      };
    }
  }

  return { ok: true, values: vals, steps, warnings };
}

/** Rearrange one equation for `target` and evaluate it, recording the working. */
function applyEquation(eq, target, V, branch = 0) {
  const { s, u, v, a, t } = V;
  const base = { eq: eq.id, formula: eq.tex, target, omits: eq.missing };

  const mk = (rearranged, substitution, value, extra = {}) => ({
    ...base, rearranged, substitution, value, ...extra,
  });

  switch (eq.id) {
    // ── v = u + at ────────────────────────────────────────────────────────
    case 1:
      if (target === 'v') return mk('v = u + at', `v = ${sub(u)} + ${sub(a)} × ${sub(t)}`, u + a * t);
      if (target === 'u') return mk('u = v − at', `u = ${sub(v)} − ${sub(a)} × ${sub(t)}`, v - a * t);
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from v = u + at when t = 0.' };
        return mk('a = (v − u) / t', `a = (${n(v)} − ${n(u)}) / ${sub(t)}`, (v - u) / t);
      }
      if (target === 't') {
        if (Math.abs(a) < EPS) return { error: 'Cannot find t from v = u + at when a = 0.' };
        return mk('t = (v − u) / a', `t = (${n(v)} − ${n(u)}) / ${sub(a)}`, (v - u) / a);
      }
      break;

    // ── s = ut + ½at² ─────────────────────────────────────────────────────
    case 2:
      if (target === 's') return mk('s = ut + ½at²', `s = ${sub(u)} × ${sub(t)} + ½ × ${sub(a)} × ${sub(t)}²`, u * t + 0.5 * a * t * t);
      if (target === 'u') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find u from s = ut + ½at² when t = 0.' };
        return mk('u = (s − ½at²) / t', `u = (${n(s)} − ½ × ${sub(a)} × ${sub(t)}²) / ${sub(t)}`, (s - 0.5 * a * t * t) / t);
      }
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from s = ut + ½at² when t = 0.' };
        return mk('a = 2(s − ut) / t²', `a = 2(${n(s)} − ${sub(u)} × ${sub(t)}) / ${sub(t)}²`, (2 * (s - u * t)) / (t * t));
      }
      if (target === 't') {
        // ½a t² + u t − s = 0
        return quadratic(0.5 * a, u, -s, mk, '½at² + ut − s = 0', 't', branch);
      }
      break;

    // ── s = ½(u + v)t ─────────────────────────────────────────────────────
    case 3:
      if (target === 's') return mk('s = ½(u + v)t', `s = ½(${n(u)} + ${n(v)}) × ${sub(t)}`, 0.5 * (u + v) * t);
      if (target === 'u') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find u from s = ½(u + v)t when t = 0.' };
        return mk('u = 2s/t − v', `u = 2 × ${sub(s)} / ${sub(t)} − ${sub(v)}`, (2 * s) / t - v);
      }
      if (target === 'v') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find v from s = ½(u + v)t when t = 0.' };
        return mk('v = 2s/t − u', `v = 2 × ${sub(s)} / ${sub(t)} − ${sub(u)}`, (2 * s) / t - u);
      }
      if (target === 't') {
        if (Math.abs(u + v) < EPS) return { error: 'Cannot find t from s = ½(u + v)t when u + v = 0.' };
        return mk('t = 2s / (u + v)', `t = 2 × ${sub(s)} / (${n(u)} + ${n(v)})`, (2 * s) / (u + v));
      }
      break;

    // ── v² = u² + 2as ─────────────────────────────────────────────────────
    case 4:
      if (target === 'v') {
        const sq = u * u + 2 * a * s;
        if (sq < 0) return { error: 'v² came out negative — the object never reaches that displacement.' };
        const root = Math.sqrt(sq);
        const opts = [root, -root];
        return mk('v = ±√(u² + 2as)', `v = ±√(${sub(u)}² + 2 × ${sub(a)} × ${sub(s)}) = ±${n(root)}`, opts[branch % 2], {
          roots: opts,
          warning: `Two roots: v = +${n(root)} and v = −${n(root)}. Same speed, opposite directions — pick the one that matches the direction of travel.`,
        });
      }
      if (target === 'u') {
        const sq = v * v - 2 * a * s;
        if (sq < 0) return { error: 'u² came out negative — no real starting velocity fits these values.' };
        const root = Math.sqrt(sq);
        const opts = [root, -root];
        return mk('u = ±√(v² − 2as)', `u = ±√(${sub(v)}² − 2 × ${sub(a)} × ${sub(s)}) = ±${n(root)}`, opts[branch % 2], {
          roots: opts,
          warning: `Two roots: u = +${n(root)} and u = −${n(root)}.`,
        });
      }
      if (target === 'a') {
        if (Math.abs(s) < EPS) return { error: 'Cannot find a from v² = u² + 2as when s = 0.' };
        return mk('a = (v² − u²) / 2s', `a = (${sub(v)}² − ${sub(u)}²) / (2 × ${sub(s)})`, (v * v - u * u) / (2 * s));
      }
      if (target === 's') {
        if (Math.abs(a) < EPS) return { error: 'Cannot find s from v² = u² + 2as when a = 0.' };
        return mk('s = (v² − u²) / 2a', `s = (${sub(v)}² − ${sub(u)}²) / (2 × ${sub(a)})`, (v * v - u * u) / (2 * a));
      }
      break;

    // ── s = vt − ½at² ─────────────────────────────────────────────────────
    case 5:
      if (target === 's') return mk('s = vt − ½at²', `s = ${sub(v)} × ${sub(t)} − ½ × ${sub(a)} × ${sub(t)}²`, v * t - 0.5 * a * t * t);
      if (target === 'v') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find v from s = vt − ½at² when t = 0.' };
        return mk('v = (s + ½at²) / t', `v = (${n(s)} + ½ × ${sub(a)} × ${sub(t)}²) / ${sub(t)}`, (s + 0.5 * a * t * t) / t);
      }
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from s = vt − ½at² when t = 0.' };
        return mk('a = 2(vt − s) / t²', `a = 2(${sub(v)} × ${sub(t)} − ${n(s)}) / ${sub(t)}²`, (2 * (v * t - s)) / (t * t));
      }
      if (target === 't') {
        // −½a t² + v t − s = 0
        return quadratic(-0.5 * a, v, -s, mk, '−½at² + vt − s = 0', 't', branch);
      }
      break;
  }
  return null;
}

/** Solve At² + Bt + C = 0, preferring the smallest non-negative root for time. */
function quadratic(A, B, C, mk, form, target, branch = 0) {
  if (Math.abs(A) < EPS) {
    if (Math.abs(B) < EPS) return { error: `Cannot find ${target} — the equation degenerates.` };
    const root = -C / B;
    return mk(`${target} = −C / B  (a = 0, so it is linear)`, `${target} = −${sub(C)} / ${sub(B)}`, root);
  }
  const disc = B * B - 4 * A * C;
  if (disc < 0) return { error: 'Discriminant is negative — the object never reaches that displacement.' };
  const sq = Math.sqrt(disc);
  const r1 = (-B + sq) / (2 * A);
  const r2 = (-B - sq) / (2 * A);
  const roots = [r1, r2].sort((x, y) => x - y);
  // Prefer positive times; branch 1 asks for the *other* physically valid root.
  const ordered = [...roots].sort((x, y) => {
    const px = x > EPS ? 0 : 1, py = y > EPS ? 0 : 1;
    return px - py || x - y;
  });
  const chosen = ordered[branch % ordered.length];

  return mk(
    `${form}  →  ${target} = (−B ± √(B² − 4AC)) / 2A`,
    `${target} = (−${sub(B)} ± √(${sub(B)}² − 4 × ${sub(A)} × ${sub(C)})) / (2 × ${sub(A)})`,
    chosen,
    {
      roots,
      warning: roots.length === 2 && Math.abs(r1 - r2) > EPS
        ? `Two solutions: t = ${n(roots[0])} s and t = ${n(roots[1])} s. The object passes that displacement twice — going up, then coming down.`
        : undefined,
    },
  );
}

export { n as fmtNum };
