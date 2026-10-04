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
  ok(r.notes.some((d) => /second angle/.test(d)), 'reports the second valid angle too');
  near(r.altTheta, 45, 0.01, 'and hands it back as a number');

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
  ok(!r.ok && /three of the five/i.test(r.reason), 'one of the five is refused, by name');
  ok(/one more|two more/.test(r.reason), 'and says how many more are needed');

  r = solveLaunch({ theta: 45, h: 10, g: 9.8 });
  ok(!r.ok && /where it lands|time|landing speed/.test(r.reason), 'missing speed says what would fix it');

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

/* ════════════════════════════════════════════════════════════════════════
   No angle of projection. The five equations never needed one — any three
   of s, u, v, a, t give the other two along a straight line. This is the
   whole point, so it gets the most tests.
   ════════════════════════════════════════════════════════════════════════ */

group('No angle: three of the five still solve', () => {
  // Thrown straight up from 10 m. Angle never mentioned.
  let r = solveLaunch({ u: 20, h: 10, g: 9.8 });
  ok(r.ok, 'u, a and a launch height is enough');
  ok(r.mode === '1d', 'treated as straight-line motion');
  ok(r.notes.some((x) => /no angle of projection given/i.test(x)), 'and says so out loud');
  near(r.five.t.value, 4.5319, 1e-3, 'time of flight');
  near(r.five.v.value, -24.4131, 1e-3, 'lands at 24.41 m s⁻¹, downwards');
  near(r.five.s.value, -10, 1e-9, 'net displacement is −10 m, upwards positive');
  ok(/upwards as positive/.test(r.convention), 'states the direction convention');

  // The classic drill: u, a, t → find s and v. No angle, no height.
  r = solveLaunch({ u: 20, g: 9.81, t: 3 });
  ok(r.ok, 'u, a and t is enough');
  near(r.moment.s, 20 * 3 - 0.5 * 9.81 * 9, 1e-6, 's = ut + ½at² at the instant asked about');
  near(r.moment.v, 20 - 9.81 * 3, 1e-6, 'v = u + at at that instant');

  // Only two of the five → refused, and it counts them.
  r = solveLaunch({ u: 20, g: 9.81 });
  ok(!r.ok && /you have two/.test(r.reason), 'two of the five is refused, counted');
});

group('No angle: the engine signs the acceleration itself', () => {
  // Dropped — gravity is the positive direction, so a = +9.81.
  const drop = solveLaunch({ g: 9.81, h: 80 }, { noAngle: true });
  ok(drop.ok, 'a drop needs nothing but the height and g');
  near(drop.five.a.value, 9.81, 1e-9, 'downwards positive, so a = +9.81');
  near(drop.five.s.value, 80, 1e-9, 's = +80 m');
  near(drop.five.t.value, 4.0385, 1e-3, 't = 4.04 s');
  near(drop.five.v.value, 39.6181, 1e-3, 'v = 39.62 m s⁻¹');

  // Thrown up — the motion is the positive direction, so a = −9.81.
  const up = solveLaunch({ u: 14, g: 9.81, h: 0 }, { lockAngle: true, theta: 90 });
  ok(up.ok, 'thrown straight up from the ground');
  near(up.five.a.value, -9.81, 1e-9, 'upwards positive, so a = −9.81');

  // Entering it negative changes nothing — the size is what is used.
  const neg = solveLaunch({ u: 14, g: -9.81, h: 0 }, { lockAngle: true, theta: 90 });
  near(neg.five.t.value, up.five.t.value, 1e-9, 'a typed as −9.81 gives the same answer');
});

group('No angle: a landing speed quoted as a speed, not a velocity', () => {
  // A ball thrown up at 14 lands at 14 — quoted positive, really −14.
  const r = solveLaunch({ u: 14, v: 14, g: 9.81, h: 0 }, { lockAngle: true, theta: 90 });
  ok(r.ok, 'accepted');
  near(r.five.t.value, 2.8542, 1e-3, 'picks the root that runs forwards in time');
});

group('No angle: a displacement it never reaches', () => {
  // 14 m s⁻¹ straight up tops out at 9.99 m.
  const r = solveLaunch({ u: 14, g: 9.81, s: 10 }, { lockAngle: true, theta: 90 });
  ok(!r.ok, 'refused');
  ok(/only reaches 9.99 m/.test(r.reason), 'and says exactly how high it does get');
});

group('No angle: passing the same displacement twice', () => {
  const r = solveLaunch({ u: 14, g: 9.81, s: 9 }, { lockAngle: true, theta: 90 });
  ok(r.ok, 'solved');
  ok(/happens twice/.test(r.moment.text), 'reports both times');
  // 9 = 14t − 4.905t² → t = 0.9757 and 1.8780
  near(r.moment.t, 0.9779, 1e-3, 'the first crossing is the one solved for');
});

group('Where it lands AND the time: both u and the angle at once', () => {
  const f0 = flight({ u: 26, theta: 38, h: 0, g: 9.81 });
  const r = solveLaunch({ s: f0.range, t: f0.tFlight, g: 9.81, h: 0 });
  ok(r.ok, 'solved with neither u nor the angle given');
  near(r.params.u, 26, 1e-6, 'u from the components');
  near(r.params.theta, 38, 1e-6, 'angle from the components');
});

group('The launch height, when it was never entered', () => {
  // from the time of flight
  const f0 = flight({ u: 25, theta: 30, h: 28.4765, g: 9.81 });
  let r = solveLaunch({ u: 25, theta: 30, g: 9.81, t: f0.tFlight });
  ok(r.ok, 'solved');
  near(r.params.h, 28.4765, 1e-3, 'h = ½gt² − u sin θ · t');

  // from where it lands
  const f1 = flight({ u: 28, theta: 45, h: 25, g: 9.8 });
  r = solveLaunch({ u: 28, theta: 45, g: 9.8, s: f1.range });
  ok(r.ok, 'solved');
  near(r.params.h, 25, 1e-6, 'h = gs²/(2u²cos²θ) − s tan θ');

  // and it admits when it simply assumed zero
  r = solveLaunch({ u: 28, theta: 45, g: 9.8 });
  ok(r.ok && r.assumedH, 'flags the assumption');
  ok(r.notes.some((x) => /taken as 0 m/.test(x)), 'and writes it down');
});

group('The full set handed back for the completion screen', () => {
  const r = solveLaunch({ u: 28, theta: 45, h: 25, g: 9.8 });
  ok(r.ok, 'solved');
  near(r.five.s.value, 100, 1e-6, 'horizontal displacement');
  near(r.five.u.value, 28, 1e-9, 'u');
  near(r.five.t.value, 5.0507, 1e-3, 'time of flight');
  ok(r.five.u.given && r.five.a.given, 'marks what was given');
  ok(!r.five.s.given && !r.five.t.given, 'and what was worked out');
  const keys = r.extras.map((x) => x.key);
  ok(['apex', 'tApex', 'h', 'theta', 'land'].every((x) => keys.includes(x)), 'extras are all there');
  near(r.extras.find((x) => x.key === 'apex').value, 25 + (28 * Math.sin(Math.PI / 4)) ** 2 / (2 * 9.8), 1e-6, 'greatest height');
});

group('A box only counts as given when the figure shown is the one typed', () => {
  // Asked about t = 3 s of a 4.08-second flight: t is NOT their 3.
  const r = solveLaunch({ u: 20, g: 9.81, t: 3 });
  ok(r.ok, 'solved');
  ok(!r.five.t.given, 't is not badged as given, because 4.08 s is not 3 s');
  ok(r.five.u.given, 'u is, because 20 really is 20');
});

group('Values that contradict each other are refused, not drawn', () => {
  // Thrown up at 20 from ground level must land at 20, not 30.
  let r = solveLaunch({ u: 20, v: 30, g: 9.81, h: 0 });
  ok(!r.ok, 'refused');
  ok(/launch height of 0 m does not fit/.test(r.reason), 'blames the height, not the student');
  ok(/25.48 m/.test(r.reason), 'and says what the height would have to be');

  // Clear the height and the same pair is perfectly sound.
  r = solveLaunch({ u: 20, v: 30, g: 9.81 });
  ok(r.ok, 'with no height given it solves');
  near(r.params.h, 25.4842, 1e-3, 'and finds the height from v² = u² + 2as');

  // A typed figure outranks one inferred from the height.
  r = solveLaunch({ u: 20, t: 5.0968, g: 9.81, h: 0 });
  ok(!r.ok && /does not all?( |ly )?fit|does not fit/.test(r.reason), 'an impossible time is caught');

  // A textbook's rounded answer is not treated as a contradiction.
  r = solveLaunch({ u: 14, v: 14, t: 2.85, g: 9.81, h: 0 }, { lockAngle: true, theta: 90 });
  ok(r.ok, '2.85 s instead of 2.8542 s is accepted');
});

group('Answering the question asked, not just the whole flight', () => {
  // Thrown straight up at 14, asked about the moment it is 9 m up.
  const r = solveLaunch({ u: 14, g: 9.81, s: 9, h: 0 }, { lockAngle: true, theta: 90 });
  ok(r.ok, 'solved');
  ok(r.answer !== null, 'hands back the five at that moment');
  near(r.answer.v.value, 4.4068, 1e-3, 'v at 9 m');
  near(r.answer.t.value, 0.9779, 1e-3, 't at 9 m');
  ok(r.answer.s.given, 'their 9 m is marked as theirs');
  // and the flight itself is still the whole flight
  near(r.five.t.value, 2.8542, 1e-3, 'the flight still lasts 2.85 s');
  near(r.five.s.value, 0, 1e-9, 'with a net displacement of zero');

  // No moment to separate out when the solve IS the whole flight.
  const plain = solveLaunch({ g: 9.81, h: 80 }, { noAngle: true });
  ok(plain.answer === null && plain.moment === null, 'a plain drop has no separate moment');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
