// scenarios.test.mjs — the claims the two new cards make. Run: node test/scenarios.test.mjs
import { SCENARIOS, byId } from '../js/scenarios.js';
import { flight } from '../js/core/projectile.js';

let pass = 0, fail = 0;
const near = (a, e, tol, label) => Math.abs(a - e) <= tol
  ? (pass++, console.log(`  ok   ${label} = ${a.toFixed(4)}`))
  : (fail++, console.log(`  FAIL ${label} = ${a.toFixed(4)}, expected ${e} (±${tol})`));
const ok = (c, label) => c ? (pass++, console.log(`  ok   ${label}`)) : (fail++, console.log(`  FAIL ${label}`));
const group = (n, f) => { console.log(`\n${n}`); f(); };

const build = (s, p, markers) => {
  const q = s.second.from(p, markers);
  if (!q) return null;
  const f = flight({ u: q.u, theta: q.theta, h: q.h ?? 0, g: p.g });
  const dx = q.x0 || 0;
  return { f, dx, pos: (t) => { const r = f.pos(t); return { x: r.x + dx, y: r.y }; } };
};

group('Fired and dropped — they land together, whatever the muzzle speed', () => {
  const s = byId('bullet');
  for (const [u, h, g] of [[120, 1.6, 9.81], [400, 1.6, 9.81], [12, 25, 9.81], [300, 2, 1.62]]) {
    const fired = flight({ u, theta: 0, h, g });
    const dropped = build(s, { u, theta: 0, h, g }, null);
    near(dropped.f.tFlight - fired.tFlight, 0, 1e-12,
         `u=${u} h=${h} g=${g} — difference in landing time`);
  }
  // the fired one does go somewhere, so the point is not trivially true
  const f = flight({ u: 120, theta: 0, h: 1.6, g: 9.81 });
  ok(f.range > 60, 'the fired bullet really does travel downrange');
  // and with no height there is nothing to drop
  ok(s.second.from({ u: 120, theta: 0, h: 0, g: 9.81 }, null) === null, 'no height, no second bullet');
});

group('Monkey and hunter — aimed straight at it, it cannot miss', () => {
  const s = byId('monkey');
  const aim = (m, h) => (Math.atan2(m.y - h, m.x) * 180) / Math.PI;

  for (const m of [{ x: 26, y: 11.5 }, { x: 8, y: 20 }, { x: 60, y: 4 }, { x: 15, y: 15 }]) {
    for (const u of [22, 40, 90]) {
      const h = 1.4, g = 9.81;
      const theta = aim(m, h);
      const banana = flight({ u, theta, h, g });
      const monkey = build(s, { u, theta, h, g }, { target: m });
      // when the banana reaches the monkey's x, are they in the same place?
      const tMeet = m.x / banana.horiz;
      const fell = m.y - 0.5 * g * tMeet * tMeet;
      if (fell < 0) { ok(true, `monkey (${m.x},${m.y}) u=${u} — lands first, out of reach`); continue; }
      const b = banana.pos(tMeet), k = monkey.pos(tMeet);
      near(Math.hypot(b.x - k.x, b.y - k.y), 0, 1e-9,
           `monkey (${m.x},${m.y}) u=${u} — gap at the meeting`);
    }
  }

  // aiming flat at a monkey on the ground still works, and a monkey at the
  // hunter's own height needs no elevation at all
  near(aim({ x: 30, y: 1.4 }, 1.4), 0, 1e-12, 'level with the muzzle, the aim is flat');
  ok(s.second.from({ u: 22, theta: 0, h: 1.4, g: 9.81 }, { target: { x: 10, y: 0 } }) === null,
     'a monkey on the sand is not hanging from anything');
});

group('Both sit under Interesting ones, with everything a card needs', () => {
  for (const id of ['bullet', 'monkey']) {
    const s = byId(id);
    ok(s.group === 'look', `${id} is an interesting one`);
    ok(!!s.backdrop && !!s.site, `${id} brings its own place`);
    ok((s.note || '').length > 80 && !!s.sub, `${id} says what it is for`);
  }
  ok(SCENARIOS.length === 11, 'eleven scenarios in all');
});

group('The intro models exist, and none of them changes the landing time', () => {
  const s = byId('bullet');
  ok(Array.isArray(s.intro?.models) && s.intro.models.length >= 3, 'three rounds to pick from');
  const h = 1.5, g = 9.81;
  const base = flight({ u: s.intro.models[0].u, theta: 0, h, g }).tFlight;
  for (const mdl of s.intro.models) {
    const f = flight({ u: mdl.u, theta: 0, h, g });
    near(f.tFlight - base, 0, 1e-12, `${mdl.name} (${mdl.u} m/s) lands at the same instant`);
    ok(f.range > 0, `${mdl.name} still goes somewhere — ${f.range.toFixed(0)} m`);
  }
  // and the ranges really are different, so the student sees something change
  const r = s.intro.models.map((mdl) => flight({ u: mdl.u, theta: 0, h, g }).range);
  ok(new Set(r.map((x) => x.toFixed(0))).size === r.length, 'each round has its own range');
});

group('The monkey intro spans the reachable and the unreachable', () => {
  const s = byId('monkey');
  const m = s.markers.target, h = s.params.h, g = 9.81;
  const theta = Math.atan2(m.y - h, m.x);
  const reach = (u) => {
    const tMeet = m.x / (u * Math.cos(theta));
    return m.y - 0.5 * g * tMeet * tMeet >= 0;          // still above the sand
  };
  ok(s.intro.models.every((mdl) => reach(mdl.u)),
     'every offered throw reaches the monkey at its starting place');
  ok(!reach(4), 'a feeble enough throw does NOT, so the failure case is real');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
