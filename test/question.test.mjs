// question.test.mjs — the extraction→engine layer, checked against real questions.
// Run: node test/question.test.mjs

import { toEngine, resolveAngle, speedFromRange, speedFromApex } from '../js/core/question.js';
import { flight } from '../js/core/projectile.js';

let pass = 0, fail = 0;
const near = (a, e, tol, label) => {
  const ok = Math.abs(a - e) <= tol;
  ok ? (pass++, console.log(`  ok   ${label} = ${a.toFixed(3)}`))
     : (fail++, console.log(`  FAIL ${label} = ${a.toFixed(3)}, expected ${e} (±${tol})`));
};
const ok = (cond, label) => cond ? (pass++, console.log(`  ok   ${label}`))
                                 : (fail++, console.log(`  FAIL ${label}`));
const group = (n, f) => { console.log(`\n${n}`); f(); };

group('Angles given as ratios — how papers actually write them', () => {
  near(resolveAngle({ ratio: { fn: 'tan', num: 3, den: 4 } }).degrees, 36.8699, 1e-3, 'tan θ = 3/4');
  near(resolveAngle({ ratio: { fn: 'sin', num: 3, den: 5 } }).degrees, 36.8699, 1e-3, 'sin θ = 3/5');
  near(resolveAngle({ ratio: { fn: 'cos', num: 4, den: 5 } }).degrees, 36.8699, 1e-3, 'cos θ = 4/5');
  near(resolveAngle({ ratio: { fn: 'tan', num: 7, den: 24 } }).degrees, 16.2602, 1e-3, 'tan θ = 7/24');
  near(resolveAngle({ degrees: 30, belowHorizontal: true }).degrees, -30, 1e-9, '30° below horizontal');
  ok(!resolveAngle({ ratio: { fn: 'sin', num: 5, den: 3 } }).ok, 'sin θ = 5/3 is refused, not clamped');
  ok(!resolveAngle(null).ok, 'missing angle is refused');
});

group('Working backwards — "show that U = 28" (PMT Year 2 Q4)', () => {
  // 25 m cliff, 45°, lands 100 m from the foot. The paper's answer is U = 28.
  const r = speedFromRange(100, 45, 25, 9.8);
  near(r.u, 28, 1e-6, 'u from R=100, θ=45°, h=25');

  // and it must round-trip through the engine
  const f = flight({ u: r.u, theta: 45, h: 25, g: 9.8 });
  near(f.range, 100, 1e-6, 'engine agrees: range back to 100 m');
});

group('Working backwards — golf ball off a cliff (June 07 Q6)', () => {
  // 35 m s-1, tan α = 3/4, lands 168 m away. Paper's cliff height is 50.4 m.
  const a = resolveAngle({ ratio: { fn: 'tan', num: 3, den: 4 } });
  const f = flight({ u: 35, theta: a.degrees, h: 50.4, g: 9.8 });
  near(f.range, 168, 1e-2, 'range comes out at 168 m');
  // so inverting the range must return 35
  const back = speedFromRange(168, a.degrees, 50.4, 9.8);
  near(back.u, 35, 1e-6, 'u recovered from the range');
});

group('Working backwards from the apex (June 10 Q7)', () => {
  // "The highest point of the path is 12 m above the level of P", u = 40.
  // Round-trip it through the engine rather than trusting a typed-in angle:
  // find the angle that gives a 12 m rise, then check we recover u = 40.
  const theta = Math.asin(Math.sqrt(2 * 9.8 * 12) / 40) * 180 / Math.PI;
  near(theta, 22.54, 0.01, 'angle giving a 12 m rise at u = 40');

  const f = flight({ u: 40, theta, h: 36, g: 9.8 });
  near(f.apexHeight - 36, 12, 1e-6, 'engine confirms the rise is 12 m');

  const r = speedFromApex(12, theta, 9.8);
  near(r.u, 40, 1e-6, 'u recovered from the rise');
  ok(!speedFromApex(12, 0, 9.8).ok, 'a horizontal launch never rises — refused');
  ok(!speedFromApex(-5, 30, 9.8).ok, 'a negative rise is refused');
});

group('Full extraction → engine', () => {
  // The most common shape in the whole sample.
  const r = toEngine({
    understood: true, scenario: 'angled_from_height',
    u: 28, angle: { degrees: 45 }, h: 25, g: 9.8,
    asks: ['time of flight', 'speed on landing'],
  });
  ok(r.ok, 'cliff at 45° is accepted');
  near(r.params.u, 28, 1e-9, 'u passed through');
  near(r.params.theta, 45, 1e-9, 'θ passed through');
  const f = flight(r.params);
  near(f.range, 100, 1e-6, 'engine lands it 100 m out');

  // Ratio angle plus an unknown speed recovered from the range.
  const r2 = toEngine({
    understood: true, scenario: 'angled_from_height',
    angle: { ratio: { fn: 'tan', num: 3, den: 4 } }, h: 50.4, range: 168, g: 9.8,
  });
  ok(r2.ok, 'unknown speed is recovered from the range');
  near(r2.params.u, 35, 1e-4, 'recovered u = 35');
  ok(r2.derived.length >= 2, 'it reports what it calculated rather than pretending it was given');

  // Dropped: no angle needed, u forced to zero.
  const r3 = toEngine({ understood: true, scenario: 'dropped', h: 80, g: 9.8 });
  ok(r3.ok, 'dropped needs no angle');
  near(r3.params.u, 0, 1e-9, 'dropped has u = 0');
  near(flight(r3.params).tFlight, 4.0406, 1e-3, 'falls 80 m in 4.04 s');

  // Thrown down at an angle (June 08 Q7) — the sign trap.
  const r4 = toEngine({
    understood: true, scenario: 'angled_from_height',
    u: 25, angle: { degrees: 30, belowHorizontal: true }, h: 12, g: 9.8,
  });
  near(r4.params.theta, -30, 1e-9, '30° below horizontal stays negative');
  ok(flight(r4.params).apexInFlight === false, 'a downward throw never rises');
});

group('Refusing rather than guessing', () => {
  const r = toEngine({ understood: true, scenario: 'angled_from_ground', h: 0, g: 9.8 });
  ok(!r.ok && r.needsInput, 'missing speed and angle asks the student instead of inventing them');
  ok(r.missing.includes('angle') && r.missing.includes('launch speed'), 'names what is missing');

  ok(!toEngine({ understood: false, note: 'blurry' }).ok, 'an unreadable image is reported, not faked');
  ok(!toEngine(null).ok, 'null input is handled');

  // g defaults to 9.8 but the paper's value wins — several use g = 10.
  near(toEngine({ understood: true, scenario: 'dropped', h: 10 }).params.g, 9.8, 1e-9, 'g defaults to 9.8');
  near(toEngine({ understood: true, scenario: 'dropped', h: 10, g: 10 }).params.g, 10, 1e-9, "g = 10 is honoured");
});

group('Markers the scene should draw', () => {
  const r = toEngine({
    understood: true, scenario: 'angled_from_ground', u: 12, angle: { degrees: 45 }, g: 9.8,
    markers: { obstacleDistance: 10, obstacleHeight: 2, heightLine: 4 },
  });
  ok(r.markers.obstacle.x === 10 && r.markers.obstacle.height === 2, 'fence at 10 m, 2 m high');
  ok(r.markers.heightLine === 4, 'height line at 4 m');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
