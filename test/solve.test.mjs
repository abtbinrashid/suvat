// solve.test.mjs — the smart engine. Run: node test/solve.test.mjs
import { solveLaunch } from '../js/core/solve.js';
import { flight } from '../js/core/projectile.js';

let pass = 0, fail = 0;
const near = (a, e, tol, label) => Math.abs(a - e) <= tol
  ? (pass++, console.log(`  ok   ${label} = ${a.toFixed(3)}`))
  : (fail++, console.log(`  FAIL ${label} = ${a.toFixed(3)}, expected ${e} (±${tol})`));
const ok = (c, label) => c ? (pass++, console.log(`  ok   ${label}`)) : (fail++, console.log(`  FAIL ${label}`));
const group = (n, f) => { console.log(`\n${n}`); f(); };

group('Everything given', () => {
  const r = solveLaunch({ u: 28, theta: 45, h: 25, g: 9.8 });
  ok(r.ok, 'accepted');
  near(flight(r.params).range, 100, 1e-6, 'lands at 100 m');
});

group('Unknown speed, from the horizontal displacement', () => {
  const r = solveLaunch({ theta: 45, h: 25, g: 9.8, s: 100 });
  ok(r.ok, 'solved');
  near(r.params.u, 28, 1e-6, 'u recovered');
});

group('Unknown ANGLE — the case that was missing', () => {
  // u = 28 from 25 m reaching 100 m: 45° is one answer.
  const r = solveLaunch({ u: 28, h: 25, g: 9.8, s: 100 });
  ok(r.ok, 'solved for the angle');
  const f = flight(r.params);
  near(f.range, 100, 1e-4, 'the angle it found really does reach 100 m');
  ok(r.derived.some((d) => /second angle/.test(d)), 'reports the second valid angle too');

  // Too slow to get there at any angle → refused, with a reason.
  const bad = solveLaunch({ u: 5, h: 0, g: 9.8, s: 500 });
  ok(!bad.ok && /too small/.test(bad.reason), 'unreachable range is refused with a reason');
});

group('Unknown angle, from the time of flight', () => {
  const f0 = flight({ u: 30, theta: 40, h: 10, g: 9.8 });
  const r = solveLaunch({ u: 30, h: 10, g: 9.8, t: f0.tFlight });
  ok(r.ok, 'solved');
  near(r.params.theta, 40, 1e-3, 'angle recovered from the time');
});

group('Unknown speed, from the time of flight', () => {
  const f0 = flight({ u: 22, theta: 55, h: 8, g: 9.8 });
  const r = solveLaunch({ theta: 55, h: 8, g: 9.8, t: f0.tFlight });
  ok(r.ok, 'solved');
  near(r.params.u, 22, 1e-3, 'speed recovered from the time');
});

group('Landing speed — energy, independent of angle', () => {
  // v² = u² + 2gh, so the height follows from u and v whatever the angle.
  const r = solveLaunch({ u: 20, v: 30, theta: 35, g: 9.8 });
  ok(r.ok, 'solved');
  near(r.params.h, (900 - 400) / (2 * 9.8), 1e-6, 'h from (v² − u²)/2g');
  near(flight(r.params).vLanding, 30, 1e-6, 'engine agrees the landing speed is 30');

  // and g itself can come out of it
  const r2 = solveLaunch({ u: 20, v: 30, h: 25.51, theta: 35 });
  ok(r2.ok, 'g found from u, v and h');
  near(r2.params.g, 9.8, 0.01, 'g recovered');
});

group('Refusing, with a reason the student can act on', () => {
  let r = solveLaunch({ h: 10, g: 9.8 });
  ok(!r.ok && /both/i.test(r.reason), 'two unknowns is refused');

  r = solveLaunch({ theta: 45, h: 10, g: 9.8 });
  ok(!r.ok && /horizontal displacement|time|landing speed/.test(r.reason), 'missing speed says what would fix it');

  r = solveLaunch({ u: 20, h: 10, g: 9.8 });
  ok(!r.ok && /horizontal displacement|time/.test(r.reason), 'missing angle says what would fix it');

  r = solveLaunch({ u: 20, theta: 45, h: 10 });
  ok(!r.ok && /acceleration/.test(r.reason), 'missing g is named');

  // A horizontal launch: the time cannot give the speed, and it says so.
  r = solveLaunch({ theta: 0, h: 20, g: 9.8, t: 2.02 });
  ok(!r.ok && /horizontal launch/.test(r.reason), 'horizontal launch + time is refused correctly');
});

group('Scenario constraints', () => {
  const r = solveLaunch({ u: 0, h: 80, g: 9.8 }, { noAngle: true });
  ok(r.ok, 'a dropped object needs no angle');
  near(r.params.theta, -90, 1e-9, 'angle forced to straight down');
  near(flight(r.params).tFlight, 4.0406, 1e-3, 'falls 80 m in 4.04 s');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
