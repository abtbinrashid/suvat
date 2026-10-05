// notation.test.mjs — proves the maths is set as maths. Run with:
//     node test/notation.test.mjs
//
// Two halves, and the second is the one that matters.
//
//   1. The notation module itself: given this source, print exactly this.
//   2. A SWEEP of everything the app can actually put on screen — every
//      equation, every rearrangement, every substitution, every row of the
//      working, over a spread of scenarios — checked against a blacklist of
//      programmer's maths. If anybody ever writes (v^2 - u^2)/(2a) straight
//      into a string that reaches a student, this is what catches it.
//
// Adding a formula? You do not need to add a test. Add it through M`` and the
// sweep covers it. Add it as a raw string and the sweep fails. That is the
// whole point of the file.

import fs from 'node:fs';
import { mathHTML, mathText, num, signed } from '../js/notation.js';
import { EQUATIONS, solve } from '../js/core/suvat.js';
import { flight, derivation } from '../js/core/projectile.js';
import { solveLaunch } from '../js/core/solve.js';
import { buildWorking, resolveAt, obstacleCheck } from '../js/working.js';

let pass = 0, fail = 0;

function is(actual, expected, label) {
  if (actual === expected) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${actual}\n         want ${expected}`); }
}
function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}
function group(name, fn) { console.log(`\n${name}`); fn(); }

/* == 1 · the notation itself ========================================== */

group('Unicode output: the source reads one way, the screen another', () => {
  const THIN = '\u2009';   // the gap between implicit factors
  is(mathText('v = u + at'), 'v = u + at', 'the simplest one is untouched');
  is(mathText('v^2 = u^2 + 2as'), 'v² = u² + 2as', 'powers become superscripts');
  is(mathText('(v^2 - u^2)/(2a)'), '(v² − u²)⁄2a', 'a fraction slash, not a solidus');
  is(mathText('sqrt(u^2 + 2gh)'), '√(u² + 2gh)', 'a radical sign');
  is(mathText('u sin theta'), `u${THIN}sin${THIN}θ`, 'Greek by name, function upright');
  is(mathText('u sin theta t'), `u${THIN}sin${THIN}θ${THIN}t`, 'separate symbols get air between them');
  is(mathText('cos^2 theta'), `cos²${THIN}θ`, 'a squared trig function');
  is(mathText('9.81 [m s^-2]'), '9.81 m s⁻²', 'units carry negative indices');
  is(mathText('x <= y != z ~= w -> q'), 'x ≤ y ≠ z ≈ w → q', 'relations are real symbols');
  is(mathText('v = +-sqrt(u^2 + 2as)'), 'v = ±√(u² + 2as)', 'plus-or-minus');
  is(mathText('t = h/abs(u sin theta)'), `t = h⁄|u${THIN}sin${THIN}θ|`, 'the size of a quantity');
  is(mathText('35°'), '35°', 'degrees sit tight against the number');
  is(mathText('1.2e5'), '1.2 × 10⁵', 'standard form, not exponent notation');
  is(mathText('2a'), '2a', 'a numeral binds to what follows it');
  is(mathText('3 - -5'), '3 − (−5)', 'two signs in a row are bracketed, never doubled');
});

group('HTML output: the structures Unicode cannot draw', () => {
  const frac = mathHTML('(v^2 - u^2)/(2a)');
  ok(frac.includes('m-frac') && frac.includes('m-fnum') && frac.includes('m-fden'),
     'a fraction is stacked over a bar, not written along one line');
  ok(mathHTML('sqrt(u^2 + 2gh)').includes('m-rad'),
     'a radical gets a vinculum, so the radicand needs no brackets');
  ok(mathHTML('u_y = 0').includes('<sub'), 'subscripts are real subscripts');
  ok(mathHTML('v = u + at').includes('<i class="m-var">v</i>'),
     'quantities are italic — ISO 80000-2');
  const trig = mathHTML('u sin theta');
  ok(trig.includes('<span class="m-fn">sin</span>') && !trig.includes('<i class="m-var">sin</i>'),
     'function names are upright, so sin is not s times i times n');
  ok(mathHTML('9.81 [m s^-2]').includes('class="m-unit"'),
     'units are upright too — m is a metre, not a variable');
  ok(!mathHTML('a < b').includes('<b'), 'angle brackets in the source are escaped');
});

group('Numbers', () => {
  is(num(-9.81), '−9.81', 'a minus sign, not a hyphen');
  is(num(9.8, 2, { trim: true }), '9.8', 'trailing zeros can be trimmed');
  is(num(Infinity), '∞', 'infinity');
  is(num(-Infinity), '−∞', 'and negative infinity');
  is(num(123456.7), '1.235 × 10⁵', 'large values go to standard form');
  is(num(0.00001234), '1.234 × 10⁻⁵', 'and small ones');
  is(signed(-9.81), '(−9.81)', 'a negative being substituted gets brackets');
  is(signed(9.81), '9.81', 'a positive one does not');
});

/* == 2 · the sweep ==================================================== */

// Programmer's maths, every form of it. A string that reaches a student may
// contain none of these.
const BANNED = [
  { re: /\^/,                  why: 'a caret instead of a superscript' },
  { re: /\bsqrt\b/,            why: 'the word sqrt instead of a radical sign' },
  { re: /\*/,                  why: 'an asterisk instead of a multiplication sign' },
  { re: /\//,                  why: 'a slash instead of a fraction bar' },
  { re: /<=|>=|!=|~=/,         why: 'a two-character comparison instead of one symbol' },
  { re: /-\s*\d|\d\s*-/,       why: 'a hyphen where a minus sign belongs' },
  { re: /\b(?:theta|alpha|beta|lambda|omega|sigma)\b/, why: 'a Greek letter spelled out' },
  { re: /\be[+-]\d/,           why: "a programmer's exponent, e+5" },
  { re: /_[A-Za-z0-9]/,        why: 'an underscore instead of a subscript' },
  { re: /\+-|\+\/-/,           why: 'plus-or-minus typed out' },
  { re: /->|-->/,              why: 'an arrow typed out' },
  { re: /\bInfinity\b|\bNaN\b|\bundefined\b/, why: 'a raw JavaScript value' },
];

// The notation module emits markup. Tags become spaces rather than vanishing,
// so stripping them can never fuse two tokens into a word that reads clean.
const visible = (html) => String(html)
  .replace(/<[^>]*>/g, ' ')
  .replace(/&[a-z]+;/g, ' ');

function check(label, html, bag) {
  if (html == null) return;
  const text = visible(html);
  for (const b of BANNED) {
    if (b.re.test(text)) bag.push(`${label}: ${b.why}\n           ${text.replace(/\s+/g, ' ').trim()}`);
  }
}

group('Every one of the five, typeset', () => {
  const bag = [];
  for (const eq of EQUATIONS) check(`equation ${eq.id}`, eq.tex, bag);
  ok(bag.length === 0, "the five equations carry no programmer's maths", bag.join('\n         '));
  ok(EQUATIONS.every((e) => String(e.tex).includes('class="m"')),
     'and every one of them is typeset, not a bare string');
});

group("The solver's working, over every rearrangement it can reach", () => {
  // Three knowns at a time, across enough combinations that each of the five
  // equations gets rearranged for each of its variables at least once.
  const COMBOS = [
    { u: 0, a: 9.81, t: 3 },      { u: 0, v: 27, t: 8 },     { u: 5, v: 15, a: 2 },
    { v: 12, a: -9.81, t: 1.5 },  { u: 20, a: -9.81, s: 0 }, { s: 100, u: 0, t: 4 },
    { s: -40, v: -28, a: -9.81 }, { s: 12, u: 3, v: 9 },     { u: -4, v: 4, t: 2 },
    { s: 0, u: 14, a: -9.81 },    { s: 45, a: 2, t: 5 },     { u: 1e6, a: -9.81, t: 2 },
    { s: 1e-5, u: 0, a: 9.81 },   { v: 0, a: -9.81, s: 10 },
  ];
  const bag = [];
  let steps = 0;
  for (const c of COMBOS) {
    const r = solve(c);
    if (!r.ok) continue;
    for (const st of r.steps) {
      steps++;
      check('formula', st.formula, bag);
      check('rearranged', st.rearranged, bag);
      check('substitution', st.substitution, bag);
      if (st.warning) check('warning', st.warning, bag);
    }
  }
  ok(steps > 20, `the sweep reaches the solver (${steps} steps)`);
  ok(bag.length === 0, 'nothing the solver shows is written as code', bag.join('\n         '));
});

group('The working panel, across the scenarios it is written for', () => {
  const CASES = [
    { u: 25, theta: 40, h: 0, g: 9.81 },      // the simple arc
    { u: 25, theta: 40, h: 32, g: 9.81 },     // off a cliff
    { u: 14, theta: 90, h: 0, g: 9.81 },      // straight up
    { u: 0, theta: -90, h: 80, g: 9.81 },     // dropped
    { u: 18, theta: -35, h: 40, g: 9.81 },    // thrown down at an angle
    { u: 20, theta: 0, h: 25, g: 1.62 },      // horizontal, on the Moon
    { u: 12, theta: 60, h: 5, g: 0 },         // no field at all
    { u: 30, theta: 20, h: 100, g: 24.79 },   // Jupiter, and a long drop
  ];
  const bag = [];
  let rows = 0;
  for (const p of CASES) {
    const f = flight(p);
    for (const t of [0, 0.4, f.tFlight / 2, f.tFlight]) {
      if (!isFinite(t)) continue;
      for (const st of buildWorking(f, t)) {
        check('step title', st.title, bag);
        if (st.note) check('step note', st.note, bag);
        for (const r of st.rows) {
          rows++;
          check('formula', r.f, bag);
          check('substitution', r.s, bag);
          if (r.r) check('result', r.r, bag);
        }
      }
      // the resolve card: both blocks, all three rows of each
      const R = resolveAt(f, t);
      for (const b of [R.velocity, R.displacement]) {
        for (const part of [b.x, b.y, b.r]) {
          check('resolve formula', part.formula, bag);
          check('resolve substitution', part.sub, bag);
          check('resolve note', part.note, bag);
        }
      }
      check('convention', R.convention, bag);
    }
    for (const st of derivation(f)) {
      check('derivation title', st.title, bag);
      for (const L of st.lines) { check('derivation', L.tex, bag); check('derivation', L.sub, bag); }
    }
    check('obstacle', obstacleCheck(f, { x: 30, height: 8 }).text, bag);
  }
  ok(rows > 100, `the sweep reaches the working panel (${rows} rows)`);
  ok(bag.length === 0, 'nothing in the working is written as code', bag.join('\n         '));
});

group('Whatever the engine says back on screen two', () => {
  const INPUTS = [
    [{ u: 25, g: 9.81, s: 60 }, {}],
    [{ u: 25, g: 9.81, t: 3 }, {}],
    [{ s: 100, t: 4, g: 9.81, h: 12 }, {}],
    [{ u: 20, v: 30, h: 25.51 }, {}],
    [{ g: 9.81, h: 80 }, { noAngle: true }],
    [{ u: 14, g: 9.81 }, { lockAngle: true, theta: 90 }],
    [{ u: 14, g: 9.81, s: 10 }, { lockAngle: true, theta: 90 }],   // refused
    [{ u: 5 }, {}],                                                // refused
    [{ u: 25, g: 9.81, s: 60, t: 9 }, {}],                         // contradictory
    [{ v: 30, t: 2, g: 9.81 }, {}],
  ];
  const bag = [];
  let said = 0;
  for (const [input, opts] of INPUTS) {
    const r = solveLaunch(input, opts);
    for (const x of r.derived || []) { said++; check('derived', x, bag); }
    for (const x of r.notes || []) { said++; check('note', x, bag); }
    if (r.reason) { said++; check('reason', r.reason, bag); }
    if (r.convention) check('convention', r.convention, bag);
    if (r.moment) check('moment', r.moment.text, bag);
  }
  ok(said > 15, `the sweep reaches the engine's own words (${said} lines)`);
  ok(bag.length === 0, 'nothing the engine says is written as code', bag.join('\n         '));
});


/* == 3 · the sinks ==================================================== */

// Typeset maths is markup. A sink that receives it must use innerHTML, because
// textContent prints the tags at the student — which is exactly the bug this
// group exists to catch, having already happened once. Any element below may
// carry an equation; none of them may be filled with textContent.
const MATH_SINKS = [
  'solve-msg',     // what the engine worked out, and why it cannot
  'notes',         // its assumptions
  'working',       // the working panel
  'res-title',     // the resolve card
  'res-blocks',
  'done-note',     // the landing card
  'done-five',
  'done-extra',
];

group('Nothing that can hold an equation is filled with textContent', () => {
  const src = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

  // `const msg = $('solve-msg')` means `msg.textContent` is the same offence,
  // so resolve the aliases before looking for it.
  const alias = new Map();
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\$\(\s*'([^']+)'\s*\)/g)) {
    alias.set(m[1], m[2]);
  }

  const offences = [];
  for (const m of src.matchAll(/(?:\$\(\s*'([^']+)'\s*\)|([A-Za-z_$][\w$]*))\s*\.textContent\s*=/g)) {
    const id = m[1] ?? alias.get(m[2]);
    if (id && MATH_SINKS.includes(id)) {
      offences.push(`#${id} is filled with textContent — it can hold an equation`);
    }
  }
  ok(offences.length === 0, 'every maths sink in app.js takes innerHTML', offences.join('\n         '));

  // And the sinks have to still exist, or the list above is quietly dead.
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const gone = MATH_SINKS.filter((id) => !html.includes(`id="${id}"`));
  ok(gone.length === 0, 'and every one of them is still in the page',
     gone.length ? `missing from index.html: ${gone.join(', ')}` : '');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
