// engine.test.mjs — proves the maths. Run with:  node test/engine.test.mjs
//
// These are hand-worked A-level answers. If a rebuild of the interface ever
// breaks a number on screen, run this first: it tells you whether the engine
// or the interface is at fault.

import { solve } from '../js/core/suvat.js';
import { flight, optimumAngle } from '../js/core/projectile.js';

let pass = 0, fail = 0;

function near(actual, expected, tol, label) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log(`  ok   ${label}  =  ${actual.toFixed(4)}`); }
  else { fail++; console.log(`  FAIL ${label}  =  ${actual.toFixed(4)}  expected ${expected} (±${tol})`); }
}

function group(name, fn) { console.log(`\n${name}`); fn(); }

/* ── The five equations ─────────────────────────────────────────────────── */
group('SUVAT solver', () => {
  let r = solve({ u: 0, a: 9.81, t: 3 });               // ball dropped for 3 s
  near(r.values.s, 44.145, 1e-3, 'dropped 3 s: s');
  near(r.values.v, 29.43, 1e-3, 'dropped 3 s: v');

  r = solve({ u: 0, v: 27, t: 8 });                     // car 0 to 27 m/s in 8 s
  near(r.values.s, 108, 1e-9, 'car: s');
  near(r.values.a, 3.375, 1e-9, 'car: a');

  r = solve({ u: 5, v: 15, a: 2 });                     // v² = u² + 2as
  near(r.values.s, 50, 1e-9, 'v²=u²+2as: s');
  near(r.values.t, 5, 1e-9, 'v²=u²+2as: t');

  r = solve({ v: 12, a: -9.81, t: 1.5 });               // equation with no u
  near(r.values.s, 29.03625, 1e-5, 'no-u case: s');
  near(r.values.u, 26.715, 1e-9, 'no-u case: u');

  // Thrown up at 20, returns to the same height. The physical answer is the
  // NEGATIVE root with t = 4.077 s, not the trivial t = 0 at launch.
  r = solve({ u: 20, a: -9.81, s: 0 });
  near(r.values.v, -20, 1e-9, 'thrown up, back to start: v (negative root)');
  near(r.values.t, 4.07747, 1e-4, 'thrown up, back to start: t');

  // Passing 10 m on the WAY UP is the smaller positive root.
  r = solve({ u: 20, a: -9.81, s: 10 });
  near(r.values.t, 0.58353, 1e-4, 'reaches 10 m going up: t');

  // Three values that do not determine the motion must be refused, not guessed.
  r = solve({ u: 0, v: 0, a: 0 });
  if (!r.ok) { pass++; console.log('  ok   underdetermined case is refused'); }
  else { fail++; console.log('  FAIL underdetermined case returned an answer'); }

  // Fewer than three knowns is a prompt, not a crash.
  r = solve({ u: 5 });
  if (!r.ok && /3 known/.test(r.error)) { pass++; console.log('  ok   too few knowns is reported'); }
  else { fail++; console.log('  FAIL too few knowns not handled'); }
});

/* ── Projectiles ────────────────────────────────────────────────────────── */
group('Projectile model', () => {
  const f = flight({ u: 20, theta: 45, h: 0, g: 9.81 });
  near(f.tFlight, 2.8837, 1e-3, '45°, u=20: time of flight');
  near(f.range, 40.7747, 1e-3, '45°, u=20: range');
  near(f.apexHeight, 10.1937, 1e-3, '45°, u=20: greatest height');

  // Horizontal and vertical are independent: vx never changes.
  const v0 = f.vel(0), v1 = f.vel(1.7);
  near(v1.x - v0.x, 0, 1e-12, 'horizontal velocity is constant');
  near(v1.y - v0.y, -9.81 * 1.7, 1e-9, 'vertical velocity changes by -gt');

  // Complementary angles give equal range on level ground.
  const a = flight({ u: 20, theta: 30, h: 0, g: 9.81 });
  const b = flight({ u: 20, theta: 60, h: 0, g: 9.81 });
  near(a.range - b.range, 0, 1e-9, 'range(30°) equals range(60°)');

  // Dropped from 45 m.
  const d = flight({ u: 0, theta: 0, h: 45, g: 9.81 });
  near(d.tFlight, 3.0289, 1e-3, 'dropped from 45 m: time');
  near(d.vLanding, 29.7132, 1e-3, 'dropped from 45 m: landing speed');

  // Launched horizontally from a cliff: the fall time matches a pure drop.
  const c = flight({ u: 18, theta: 0, h: 60, g: 9.81 });
  const drop = flight({ u: 0, theta: 0, h: 60, g: 9.81 });
  near(c.tFlight - drop.tFlight, 0, 1e-9, 'horizontal launch falls in the same time as a drop');
  near(c.range, 18 * drop.tFlight, 1e-9, 'cliff range = u × fall time');

  // Optimum angle: 45° from the ground, less than 45° from a height.
  near(optimumAngle(20, 0, 9.81), 45, 1e-9, 'best angle from ground level');
  const opt = optimumAngle(20, 20, 9.81);
  if (opt < 45 && opt > 30) { pass++; console.log(`  ok   best angle from 20 m is ${opt.toFixed(2)}° (below 45°)`); }
  else { fail++; console.log(`  FAIL best angle from height came out ${opt.toFixed(2)}°`); }

  // Zero gravity: never lands.
  const z = flight({ u: 20, theta: 45, h: 0, g: 0 });
  if (!isFinite(z.tFlight)) { pass++; console.log('  ok   zero-g flight never lands'); }
  else { fail++; console.log('  FAIL zero-g flight returned a finite time'); }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
