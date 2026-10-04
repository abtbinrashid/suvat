// suvat.js — the five equations of uniform acceleration, and a solver that shows its working.
//
// Model assumptions (A-level): acceleration is CONSTANT, motion is in a straight line.
// No drag, no varying g. That is the whole point of this site.
//
// NOTATION. Equations, rearrangements and substitutions are authored in the
// source notation of js/notation.js and typeset from there — a fraction is
// stacked, a root gets a bar over it, and a minus sign is a minus sign. Never
// hand a student a / ^ sqrt or *.

import { M, num, signed } from '../notation.js';

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
  { id: 1, src: 'v = u + at',        missing: 's', note: 'no displacement' },
  { id: 2, src: 's = ut + ½at^2',    missing: 'v', note: 'no final velocity' },
  { id: 3, src: 's = ½(u + v)t',     missing: 'a', note: 'no acceleration' },
  { id: 4, src: 'v^2 = u^2 + 2as',   missing: 't', note: 'no time' },
  { id: 5, src: 's = vt - ½at^2',    missing: 'u', note: 'no initial velocity' },
].map((eq) => ({ ...eq, tex: M`${eq.src}` }));

const EPS = 1e-12;

function n(x, dp = 4) {
  return num(x, dp, { trim: true });
}

// Format a signed value for substitution into a formula, bracketing negatives
// so students see (−9.81) rather than a stray double minus.
function sub(x, dp = 4) {
  return signed(x, dp, { trim: true });
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
      if (target === 'v') return mk(M`v = u + at`, M`v = ${sub(u)} + ${sub(a)} * ${sub(t)}`, u + a * t);
      if (target === 'u') return mk(M`u = v - at`, M`u = ${sub(v)} - ${sub(a)} * ${sub(t)}`, v - a * t);
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from v = u + at when t = 0.' };
        return mk(M`a = (v - u)/t`, M`a = (${sub(v)} - ${sub(u)})/${sub(t)}`, (v - u) / t);
      }
      if (target === 't') {
        if (Math.abs(a) < EPS) return { error: 'Cannot find t from v = u + at when a = 0.' };
        return mk(M`t = (v - u)/a`, M`t = (${sub(v)} - ${sub(u)})/${sub(a)}`, (v - u) / a);
      }
      break;

    // ── s = ut + ½at² ─────────────────────────────────────────────────────
    case 2:
      if (target === 's') return mk(M`s = ut + ½at^2`, M`s = ${sub(u)} * ${sub(t)} + ½ * ${sub(a)} * ${sub(t)}^2`, u * t + 0.5 * a * t * t);
      if (target === 'u') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find u from s = ut + ½at² when t = 0.' };
        return mk(M`u = (s - ½at^2)/t`, M`u = (${sub(s)} - ½ * ${sub(a)} * ${sub(t)}^2)/${sub(t)}`, (s - 0.5 * a * t * t) / t);
      }
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from s = ut + ½at² when t = 0.' };
        return mk(M`a = 2(s - ut)/t^2`, M`a = 2(${sub(s)} - ${sub(u)} * ${sub(t)})/${sub(t)}^2`, (2 * (s - u * t)) / (t * t));
      }
      if (target === 't') {
        // ½a t² + u t − s = 0
        return quadratic(0.5 * a, u, -s, mk, '½at^2 + ut - s = 0', 't', branch);
      }
      break;

    // ── s = ½(u + v)t ─────────────────────────────────────────────────────
    case 3:
      if (target === 's') return mk(M`s = ½(u + v)t`, M`s = ½(${sub(u)} + ${sub(v)}) * ${sub(t)}`, 0.5 * (u + v) * t);
      if (target === 'u') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find u from s = ½(u + v)t when t = 0.' };
        return mk(M`u = 2s/t - v`, M`u = 2 * ${sub(s)}/${sub(t)} - ${sub(v)}`, (2 * s) / t - v);
      }
      if (target === 'v') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find v from s = ½(u + v)t when t = 0.' };
        return mk(M`v = 2s/t - u`, M`v = 2 * ${sub(s)}/${sub(t)} - ${sub(u)}`, (2 * s) / t - u);
      }
      if (target === 't') {
        if (Math.abs(u + v) < EPS) return { error: 'Cannot find t from s = ½(u + v)t when u + v = 0.' };
        return mk(M`t = 2s/(u + v)`, M`t = 2 * ${sub(s)}/(${sub(u)} + ${sub(v)})`, (2 * s) / (u + v));
      }
      break;

    // ── v² = u² + 2as ─────────────────────────────────────────────────────
    case 4:
      if (target === 'v') {
        const sq = u * u + 2 * a * s;
        if (sq < 0) return { error: 'v² came out negative — the object never reaches that displacement.' };
        const root = Math.sqrt(sq);
        const opts = [root, -root];
        return mk(M`v = +-sqrt(u^2 + 2as)`, M`v = +-sqrt(${sub(u)}^2 + 2 * ${sub(a)} * ${sub(s)}) = +-${n(root)}`, opts[branch % 2], {
          roots: opts,
          warning: `Two roots: v = +${n(root)} and v = −${n(root)}. Same speed, opposite directions — pick the one that matches the direction of travel.`,
        });
      }
      if (target === 'u') {
        const sq = v * v - 2 * a * s;
        if (sq < 0) return { error: 'u² came out negative — no real starting velocity fits these values.' };
        const root = Math.sqrt(sq);
        const opts = [root, -root];
        return mk(M`u = +-sqrt(v^2 - 2as)`, M`u = +-sqrt(${sub(v)}^2 - 2 * ${sub(a)} * ${sub(s)}) = +-${n(root)}`, opts[branch % 2], {
          roots: opts,
          warning: `Two roots: u = +${n(root)} and u = −${n(root)}.`,
        });
      }
      if (target === 'a') {
        if (Math.abs(s) < EPS) return { error: 'Cannot find a from v² = u² + 2as when s = 0.' };
        return mk(M`a = (v^2 - u^2)/(2s)`, M`a = (${sub(v)}^2 - ${sub(u)}^2)/(2 * ${sub(s)})`, (v * v - u * u) / (2 * s));
      }
      if (target === 's') {
        if (Math.abs(a) < EPS) return { error: 'Cannot find s from v² = u² + 2as when a = 0.' };
        return mk(M`s = (v^2 - u^2)/(2a)`, M`s = (${sub(v)}^2 - ${sub(u)}^2)/(2 * ${sub(a)})`, (v * v - u * u) / (2 * a));
      }
      break;

    // ── s = vt − ½at² ─────────────────────────────────────────────────────
    case 5:
      if (target === 's') return mk(M`s = vt - ½at^2`, M`s = ${sub(v)} * ${sub(t)} - ½ * ${sub(a)} * ${sub(t)}^2`, v * t - 0.5 * a * t * t);
      if (target === 'v') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find v from s = vt − ½at² when t = 0.' };
        return mk(M`v = (s + ½at^2)/t`, M`v = (${sub(s)} + ½ * ${sub(a)} * ${sub(t)}^2)/${sub(t)}`, (s + 0.5 * a * t * t) / t);
      }
      if (target === 'a') {
        if (Math.abs(t) < EPS) return { error: 'Cannot find a from s = vt − ½at² when t = 0.' };
        return mk(M`a = 2(vt - s)/t^2`, M`a = 2(${sub(v)} * ${sub(t)} - ${sub(s)})/${sub(t)}^2`, (2 * (v * t - s)) / (t * t));
      }
      if (target === 't') {
        // −½a t² + v t − s = 0
        return quadratic(-0.5 * a, v, -s, mk, '-½at^2 + vt - s = 0', 't', branch);
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
    return mk(`${M`${target} = -C/B`} — with ${M`a = 0`} it is linear`, M`${target} = -${sub(C)}/${sub(B)}`, root);
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
    M`${form} -> ${target} = (-B +- sqrt(B^2 - 4AC))/(2A)`,
    M`${target} = (-${sub(B)} +- sqrt(${sub(B)}^2 - 4 * ${sub(A)} * ${sub(C)}))/(2 * ${sub(A)})`,
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
