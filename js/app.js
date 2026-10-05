// app.js — three screens, in order: scenario, values, flight.
//
// The whole app is SUVAT. Screen two asks for the five quantities and nothing
// else beyond what the chosen situation genuinely needs. Launch stays disabled
// until the engine can actually determine the motion, and says why not.

import { solveLaunch } from './core/solve.js';
import { trajectory } from './core/trajectory.js';
import { flight } from './core/projectile.js';
import { SCENARIOS, GROUPS, GRAVITY, byId } from './scenarios.js';
import { buildWorking, obstacleCheck, resolveAt } from './working.js';
import * as scene from './render/scene.js';
import * as exhibit from './render/exhibit.js';
import * as scene3d from './render/scene3d.js';
import { createCamera3D } from './render/grid.js';
import { siteFor } from './world/world.js';
import { dropToneCache } from './render/world2d.js';
import { drawGraph, graphSpecs } from './render/graphs.js';
import { fmt, palette, clamp } from './render/util.js';
import { M } from './notation.js';

const $ = (id) => document.getElementById(id);

/* The five. Everything else is scenario-specific and shown only when needed. */
const SUVAT = [
  { k: 's', sym: 's', name: 'displacement',     unit: 'm' },
  { k: 'u', sym: 'u', name: 'initial velocity', unit: 'm s⁻¹' },
  { k: 'v', sym: 'v', name: 'final velocity',   unit: 'm s⁻¹' },
  { k: 'g', sym: 'a', name: 'acceleration',     unit: 'm s⁻²' },
  { k: 't', sym: 't', name: 'time',             unit: 's' },
];

const SHOWS = [
  { key: 'components',   label: 'Velocity components' },
  { key: 'ticks',        label: 'Equal time steps' },
  { key: 'acceleration', label: 'Acceleration' },
  { key: 'apex',         label: 'Greatest height' },
  { key: 'range',        label: 'Horizontal displacement' },
  { key: 'grid',         label: 'Metre grid' },
  { key: 'ruler',        label: 'Height ruler' },
  { key: 'xray',         label: 'See through the near stand (3D)' },
];
const EXTRAS = [
  { key: 'graphs',  label: 'Graphs against time' },
  { key: 'working', label: 'The working' },
  { key: 'energy',  label: 'Energy and momentum' },
];

const state = {
  step: 'scenario', id: null,
  given: {}, mass: 1,
  bounce: false, restitution: 0.7,
  dim: '2d', t: 0, playing: false, launched: false, firedBefore: false,
  rate: 1,
  show: { path: true, velocity: true, apex: true, range: true, grid: false, ruler: true, xray: true,
          components: false, ticks: false, acceleration: false },
  extras: { graphs: false, working: false, energy: false },
  options: false,
  resolve: false, hover: false,
};

const cam = scene.createCamera();
const cam3 = createCamera3D();
let scenario = null, solved = null, traj = null, second = null, ghost = null, dirty = true;

/* ── step 1 · scenario ──────────────────────────────────────────────── */
function buildScenarioScreen() {
  $('pgrid').innerHTML = GROUPS.map((g) => {
    const cards = SCENARIOS.filter((s) => s.group === g.id).map((s) => `
      <button class="pcard" data-id="${s.id}">
        ${thumb(s)}
        <b>${s.name}</b>
        ${s.sub ? `<span class="pc-sub">${s.sub}</span>` : ''}
        <p class="pc-note">${s.note}</p>
      </button>`).join('');
    return `<div class="pgroup">
      <div class="pglabel">${g.label}</div>
      ${g.blurb ? `<p class="pgblurb">${g.blurb}</p>` : ''}
      <div class="pgrid-row">${cards}</div></div>`;
  }).join('');
  for (const b of $('pgrid').querySelectorAll('.pcard')) {
    b.addEventListener('click', () => chooseScenario(b.dataset.id));
  }
}

/**
 * A small sketch of the situation, drawn from its own numbers.
 *
 * It shows the flight ALREADY FLOWN: a solid path, a hollow ring where the
 * object started and a filled dot where it ended up. A dot at the launch point
 * says "about to happen" and leaves you reading the card for which end is
 * which; a dot at the landing point says what the situation produced, which is
 * what you are choosing between.
 */
function thumb(s) {
  const g = s.params.g || 9.81;
  const theta = s.noAngle ? -90 : (s.aimAtTarget ? aimFor(s) : s.params.theta);
  const f = flight({ u: s.params.u || 0.001, theta, h: s.params.h, g });
  const pts = f.path(48);
  const second = s.second?.from ? s.second.from({ ...s.params, g, theta }, s.markers) : null;
  const sPts = second
    ? flight({ u: second.u, theta: second.theta, h: second.h ?? 0, g })
        .path(40).map((p) => ({ ...p, x: p.x + (second.x0 || 0) }))
    : null;

  const all = sPts ? pts.concat(sPts) : pts;
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const lo = Math.min(0, ...xs), hi = Math.max(...xs);
  const top = Math.max(1, ...ys, s.markers?.target?.y ?? 0, s.markers?.heightLine ?? 0);

  // A vertical flight has no width at all, so give it some and centre it —
  // otherwise it is a line jammed against the left edge.
  const padX = Math.max((hi - lo) * 0.14, 6);
  const X0 = lo - padX, X1 = hi + padX;
  const X = (x) => 6 + ((x - X0) / (X1 - X0)) * 108;
  const Y = (y) => 51 - (y / (top * 1.14)) * 41;
  const d = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');

  const end = pts[pts.length - 1];
  const mk = s.markers || {};
  const bits = [];

  if (mk.heightLine != null) {
    bits.push(`<line x1="4" y1="${Y(mk.heightLine).toFixed(1)}" x2="116" y2="${Y(mk.heightLine).toFixed(1)}"
      stroke="var(--mark)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>`);
  }
  if (s.params.h > 0.3) {
    bits.push(`<line x1="${X(0).toFixed(1)}" y1="${Y(s.params.h).toFixed(1)}" x2="${X(0).toFixed(1)}" y2="51.5"
      stroke="var(--ink-faint)" stroke-width="1.4"/>`);
  }
  if (sPts) {
    bits.push(`<path d="${d(sPts)}" fill="none" stroke="var(--second)" stroke-width="1.9"
      stroke-dasharray="5 3.5" stroke-linecap="round" opacity=".95"/>`);
    const se = sPts[sPts.length - 1];
    bits.push(`<circle cx="${X(se.x).toFixed(1)}" cy="${Y(se.y).toFixed(1)}" r="2.6" fill="var(--second)"/>`);
  }
  if (mk.target) {
    bits.push(`<circle cx="${X(mk.target.x).toFixed(1)}" cy="${Y(mk.target.y).toFixed(1)}" r="3.6"
      fill="none" stroke="var(--mark)" stroke-width="1.6"/>`);
  }

  return `<svg viewBox="0 0 120 60" aria-hidden="true">
    <line x1="2" y1="51.5" x2="118" y2="51.5" stroke="var(--border)" stroke-width="1"/>
    ${bits.join('')}
    <path d="${d(pts)}" fill="none" stroke="var(--vel)" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="${X(0).toFixed(1)}" cy="${Y(s.params.h).toFixed(1)}" r="2.6"
            fill="var(--card)" stroke="var(--vel)" stroke-width="1.6"/>
    <circle cx="${X(end.x).toFixed(1)}" cy="${Y(end.y).toFixed(1)}" r="3.4" fill="var(--vel)"/>
  </svg>`;
}

/** The sketch aims at the marker too, so the card matches what you will get. */
function aimFor(s) {
  const t = s.markers?.target;
  if (!t) return s.params.theta;
  return (Math.atan2(t.y - (s.params.h || 0), t.x) * 180) / Math.PI;
}

function chooseScenario(id) {
  scenario = byId(id);
  state.id = id;
  state.given = {};
  // The scenario picks the SITUATION, never the numbers. Every box starts
  // empty; the only thing it fixes is that a dropped object starts at rest,
  // which is what "dropped" means.
  if (scenario.noAngle) state.given.u = 0;
  state.theta = undefined;
  state.h = undefined;
  state.markers = JSON.parse(JSON.stringify(scenario.markers || {}));
  state.firedBefore = false; ghost = null;
  $('chosen').textContent = scenario.name;
  buildValuesScreen();
  // An exhibit opens on the experiment itself. The card over the blurred
  // stage is where the numbers get chosen, and the values screen is still a
  // click away for anyone who would rather type them.
  if (scenario.intro) {
    seedExhibit();
    recompute();
    if (traj) { state.launched = true; state.firedBefore = false; state.t = 0; state.playing = false; }
    go('flight');
    openIntro();
  } else go('values');
}

/** Fill in the scenario's own starting numbers, so the stage has something to show. */
function seedExhibit() {
  const s = scenario.seed || {};
  if (s.u != null) state.given.u = s.u;
  if (s.g != null) state.given.g = s.g;
  if (s.h != null) state.h = s.h;
  buildValuesScreen();
}

/* ── the intro card ─────────────────────────────────────────────────── */
function openIntro() {
  const i = scenario.intro;
  if (!i) return;
  $('intro-eyebrow').textContent = scenario.place || 'Experiment';
  $('intro-title').textContent = i.title;
  $('intro-body').textContent = i.body;
  $('intro-models').innerHTML = i.models.map((mdl) => `
    <button class="imodel" data-u="${mdl.u}" aria-pressed="${state.given.u === mdl.u}">
      <span><b>${mdl.name}</b><br><span class="im-note">${mdl.note}</span></span>
      <span class="im-u">${mdl.u}<small>${i.unit}</small></span>
    </button>`).join('');
  for (const b of $('intro-models').children) {
    b.addEventListener('click', () => {
      state.given.u = parseFloat(b.dataset.u);
      for (const x of $('intro-models').children) x.setAttribute('aria-pressed', String(x === b));
      buildValuesScreen();
      recompute();
      dirty = true;
    });
  }
  $('intro').hidden = false;
}
function closeIntro() { $('intro').hidden = true; }

/* ── step 2 · the five values ───────────────────────────────────────── */
function buildValuesScreen() {
  $('suvat').innerHTML = SUVAT.map((f) => {
    const locked = (f.k === 'u' && scenario.noAngle);
    return `<div class="sbox" data-k="${f.k}" data-locked="${locked}">
      <div class="s-sym">${f.sym}</div>
      <div class="s-name">${f.name}</div>
      <input type="number" step="any" data-k="${f.k}" placeholder="—"
             value="${state.given[f.k] ?? ''}" aria-label="${f.name} in ${f.unit}"${locked ? ' readonly' : ''}>
      <div class="s-unit">${f.unit}</div>
    </div>`;
  }).join('');

  for (const i of $('suvat').querySelectorAll('input')) {
    i.addEventListener('input', (e) => {
      const raw = e.target.value.trim();
      const v = raw === '' ? undefined : parseFloat(raw);
      if (raw === '' || !isFinite(v)) delete state.given[e.target.dataset.k];
      else state.given[e.target.dataset.k] = v;
      recompute();
    });
  }

  // Only what this situation genuinely cannot do without.
  const rows = [];
  if (!scenario.noAngle && !scenario.lockAngle) {
    rows.push(`<div class="xrow" data-x="theta"><label for="x-theta">Angle of projection θ (°)</label>
      <input id="x-theta" type="number" step="any" value="${state.theta ?? ''}" placeholder="—">
      <p class="xhint">Optional.</p></div>`);
  }
  rows.push(`<div class="xrow" data-x="h"><label for="x-h">Launch height h (m)</label>
    <input id="x-h" type="number" step="any" value="${state.h ?? ''}" placeholder="—">
    <p class="xhint">Optional. Blank means ground level, or it works the height out.</p></div>`);
  rows.push(`<div class="xrow"><label>Gravitational field</label><div class="chips" id="g-chips">${
    GRAVITY.map((x) => `<button class="chip" data-g="${x.g}" aria-pressed="${state.given.g === x.g}">${x.label} ${x.g}</button>`).join('')
  }</div></div>`);
  $('extra').innerHTML = rows.join('');

  $('x-theta')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value); state.theta = isFinite(v) ? v : undefined; recompute();
  });
  $('x-h').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value); state.h = isFinite(v) ? v : undefined; recompute();
  });
  for (const b of $('g-chips').querySelectorAll('.chip')) {
    b.addEventListener('click', () => {
      state.given.g = parseFloat(b.dataset.g);
      for (const x of $('g-chips').querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x === b));
      $('suvat').querySelector('input[data-k="g"]').value = state.given.g;
      recompute();
    });
  }
  recompute();
}

/* ── solve ──────────────────────────────────────────────────────────── */
/** The angle that points the launch straight at the draggable target. */
function aimAngle() {
  const t = state.markers?.target;
  if (!t) return undefined;
  const h = state.h ?? 0;
  return (Math.atan2(t.y - h, t.x) * 180) / Math.PI;
}
/**
 * The boxes hold what the student typed and nothing else. The engine's answers
 * belong at the end of the flight, not spilled back over the form while it is
 * still being filled in.
 */
function showDerived(r) {
  const notes = [];
  if (r.convention) notes.push(r.convention);
  notes.push(...r.notes);
  if (r.moment) notes.push(r.moment.text);
  $('notes').innerHTML = notes.map((x) => `<li>${x}</li>`).join('');
}

function recompute() {
  const k = { ...state.given, theta: state.theta, h: state.h };
  if (scenario.noAngle) { k.u = 0; delete k.theta; }
  if (scenario.lockAngle) k.theta = scenario.params.theta;
  // AIMED, not angled. The hunter points straight at the monkey, so the angle
  // is a consequence of where the monkey is — drag it and the angle follows.
  if (scenario.aimAtTarget) k.theta = aimAngle();

  solved = solveLaunch(k, { noAngle: scenario.noAngle,
                            lockAngle: scenario.lockAngle || scenario.aimAtTarget });

  const msg = $('solve-msg'), btn = $('launch');

  if (!solved.ok) {
    // Typeset maths arrives as markup, so every sink that can receive it takes
    // innerHTML. textContent here prints the tags at the student. See CLAUDE.md.
    msg.dataset.ok = 'false'; msg.innerHTML = solved.reason;
    $('notes').innerHTML = '';
    btn.disabled = true; btn.textContent = 'Launch';
    $('launch-hint').textContent = '';
    traj = null; return;
  }

  msg.dataset.ok = 'true';
  msg.innerHTML = solved.derived.length
    ? `Ready. The rest comes out as:  ${solved.derived.join('  ·  ')}`
    : 'Everything needed is here.';
  showDerived(solved);

  traj = trajectory({ ...solved.params, mass: state.mass,
                      restitution: state.bounce ? state.restitution : 0,
                      maxBounces: state.bounce ? 6 : 0 });
  second = buildSecond(solved.params);
  // THE CATCH ENDS IT. Aimed straight at the monkey, the banana arrives when
  // its horizontal displacement equals the monkey's — and watching it sail on
  // through would undo the whole point of the scenario.
  if (scenario.aimAtTarget && second) {
    const tg = state.markers?.target;
    const tMeet = tg && traj.horiz > 1e-6 ? tg.x / traj.horiz : null;
    if (tMeet != null && tMeet > 0 && tMeet < traj.tMax) {
      traj = endAt(traj, tMeet);
      second = endAt(second, tMeet);
      state.caught = { t: tMeet, y: tg.y - 0.5 * solved.params.g * tMeet * tMeet };
    } else {
      // It never gets there. Work out WHY, because "it missed" is the one
      // thing this scenario is not allowed to leave unexplained.
      state.caught = null;
      const fall = tg && solved.params.g > 0 ? Math.sqrt((2 * tg.y) / solved.params.g) : Infinity;
      state.verdict = { kind: 'short', landed: fall,
        text: `Too slow — the monkey reached the sand after ${fmt(fall, 2)} s, before the banana covered ${fmt(tg.x, 0)} m. Throw harder.` };
    }
  } else { state.caught = null; state.verdict = null; }
  if (state.caught) state.verdict = { kind: 'caught' };
  btn.disabled = false;
  btn.textContent = solved.params.u < 0.05
    ? 'Release it'                      // a drop has no launch speed to quote
    : `Launch at ${fmt(solved.params.u, 1)} m s⁻¹`;
  $('launch-hint').textContent = '';
  dirty = true;
}

/**
 * The second object is DERIVED from the first, never fixed. Hard-coding its
 * numbers only worked while the first object's numbers were pre-filled too —
 * the moment the student types their own, a fixed second object simply misses.
 */
function buildSecond(p) {
  const s = scenario.second;
  if (!s) return null;
  const q = s.from ? s.from(p, state.markers) : s;
  if (!q) return null;                   // the situation does not support one
  const f = flight({ u: q.u, theta: q.theta, h: q.h ?? 0, g: p.g });
  return q.x0 ? shift(f, q.x0) : f;
}

/**
 * The same flight, started x0 metres along. `flight()` always launches from
 * the origin, and a monkey hanging in a tree does not — so the whole thing is
 * slid sideways rather than the model being bent to allow it.
 */
/** The same flight, stopped early. Nothing is re-modelled; the clock is cut. */
function endAt(f, tEnd) {
  const T = Math.min(tEnd, f.tMax);
  // The range bar measures the flight that happened, not the one that would
  // have happened — a banana caught at 26 m did not travel 36.
  const reach = f.pos(T).x;
  return { ...f, tMax: T, tFlight: Math.min(f.tFlight, T), range: reach,
    pos: (t) => f.pos(Math.min(t, T)),
    vel: (t) => f.vel(Math.min(t, T)),
    path: (n, e = T) => f.path(n, Math.min(e, T)),
    ticks: (n, e = T) => f.ticks(n, Math.min(e, T)) };
}

function shift(f, x0) {
  const move = (p) => ({ ...p, x: p.x + x0 });
  return { ...f, x0,
    pos: (t) => move(f.pos(t)),
    path: (n, tEnd) => f.path(n, tEnd).map(move),
    ticks: (n, tEnd) => f.ticks(n, tEnd).map(move),
    range: f.range + x0 };
}

/* ── step 3 · flight ────────────────────────────────────────────────── */
function launch() {
  if (!traj) return;
  closeIntro();
  closeResolve();
  if (state.firedBefore) ghost = traj.path(260);
  state.firedBefore = true; state.launched = true;
  state.t = 0; state.playing = true;
  cam.fit = true; cam3.fit = true;
  setPlayIcon(true);
  hideDone();
  go('flight');
}

function go(step) {
  state.step = step;
  $('app').dataset.step = step;
  $('options-btn').hidden = step !== 'flight';
  dirty = true;
  requestAnimationFrame(() => { dirty = true; });
}

function togglePlay() {
  if (!traj) return;
  hideDone(); closeResolve();
  if (state.t >= traj.tMax) state.t = 0;
  state.playing = !state.playing; setPlayIcon(state.playing); dirty = true;
}
function setPlayIcon(on) {
  $('play-icon').innerHTML = on
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : '<path d="M8 5v14l11-7z"/>';
  $('play').dataset.playing = String(on);
  $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
}

/* ── resolving one instant into components ──────────────────────────────
   Point at the object — or anywhere on the arc behind it — and the flight
   stops where it is and splits the velocity and the displacement into a
   horizontal part and a vertical part. It is the first line of every
   projectile answer, on the instant the student chose rather than on the
   instant the question chose. */
function openResolve(t) {
  if (!traj || state.step !== 'flight') return;
  hideDone();
  state.t = clamp(t ?? state.t, 0, traj.tMax);
  state.playing = false; setPlayIcon(false);
  state.resolve = true; state.hover = false;
  dirty = true;
}

function closeResolve() {
  if (!state.resolve) return;
  state.resolve = false;
  $('resolve').hidden = true;
  $('canvas-wrap').dataset.resolve = 'off';
  dirty = true;
}

function renderResolve(R) {
  const box = $('resolve');
  $('canvas-wrap').dataset.resolve = R ? 'on' : 'off';
  if (!R) { box.hidden = true; return; }

  $('res-title').innerHTML = `At ${M`t = ${fmt(R.t, 2)} [s]`}`;

  const row = (q, part) => `
    <div class="rrow" data-part="${part}">
      <div class="rrow-top"><span class="rrow-n">${q.name}</span>
        <b class="rrow-v">${fmt(q.value, 2)}<small>${q.unit}</small></b></div>
      <div class="rrow-f">${q.formula}${q.sub ? ` = ${q.sub}` : ''}</div>
      <div class="rrow-note">${q.note}</div>
    </div>`;
  // A vertical launch has no horizontal part and therefore no resultant to
  // find — printing a row of zeroes would teach the wrong thing.
  const block = (b) => `<div class="rblock" data-hue="${b.hue}">
      <div class="rb-h">${b.name}</div>
      ${R.vertical ? row(b.y, 'y') : row(b.x, 'x') + row(b.y, 'y') + row(b.r, 'r')}
    </div>`;
  $('res-blocks').innerHTML = block(R.velocity) + block(R.displacement);

  $('res-note').textContent = R.vertical
    ? 'Vertical motion only, so there is no horizontal component.'
    : R.after
      ? 'Past the bounce, u and θ no longer apply — so these are numbers, not formulas. The horizontal component is still unchanged.'
      : 'Up is positive. Drag the time slider to watch these change.';

  // The card stands on the side the object is not on, so it never covers the
  // thing it is describing.
  const bx = state.dim === '3d' ? cam3._ball?.x : cam._map?.ball?.x;
  const wide = $('canvas-wrap').getBoundingClientRect().width;
  if (bx != null && wide > 0) box.dataset.side = bx < wide / 2 ? 'right' : 'left';
  box.hidden = false;
}

/* ── readouts, on the diagram ───────────────────────────────────────── */
function renderHud() {
  if (!traj) return;
  const p = traj.pos(state.t), v = traj.vel(state.t);
  const b = (k, val, unit, hue) =>
    `<div class="hbox"${hue ? ` data-hue="${hue}"` : ''}><div class="hbox-k">${k}</div>
     <div class="hbox-v">${val}<small>${unit}</small></div></div>`;
  // In a straight line the horizontal distance is always zero, so show the
  // signed displacement along the line instead — that is the s being solved.
  const line = solved?.mode === '1d';
  const h0 = solved?.params.h ?? 0;
  const toAxis = (y) => (solved?.axis === 'down' ? -y : y);
  const left = line
    ? [
        b('Displacement', fmt(toAxis(p.y - h0), 1), 'm', 'disp'),
        b('Height', fmt(p.y, 1), 'm', 'disp'),
        b('Speed', fmt(Math.hypot(v.x, v.y), 1), 'm s⁻¹', 'vel'),
      ]
    : [
        b('Height', fmt(p.y, 1), 'm', 'disp'),
        b('Horizontal distance', fmt(p.x, 1), 'm', 'disp'),
        b('Speed', fmt(Math.hypot(v.x, v.y), 1), 'm s⁻¹', 'vel'),
      ];
  if (state.extras.energy) {
    left.push(b('Kinetic energy', fmt(traj.kineticEnergy(state.t), 0), 'J'));
    left.push(b('Momentum', fmt(traj.momentum(state.t), 1), 'kg m s⁻¹'));
  }
  $('hud-left').innerHTML = left.join('');
  $('hud-right').innerHTML = b('Time', fmt(state.t, 2), 's');
  const site = siteFor(state.id);
  $('place').textContent = site.place;
  $('place-note').textContent = site.note || '';
}

/* ── the landing card: the whole of SUVAT, once it has settled ───────── */
const SYM = { s: 's', u: 'u', v: 'v', a: 'a', t: 't' };

function showDone() {
  if (!solved?.ok || state.step !== 'flight') return;
  const r = solved;

  $('done-eyebrow').textContent = traj.bounces > 0
    ? `First flight, then ${traj.bounces} ${traj.bounces === 1 ? 'bounce' : 'bounces'}`
    : `Flight complete in ${fmt(r.five.t.value, 2)} s`;
  $('done-title').textContent = title(r);
  $('done-conv').textContent = r.convention || '';

  $('done-five').innerHTML = Object.entries(r.five).map(([slot, x]) => `
    <div class="dcell" data-given="${x.given}">
      <div class="d-sym">${SYM[slot]}</div>
      <div class="d-name">${x.label}</div>
      <div class="d-val">${fmt(x.value, Math.abs(x.value) < 10 ? 2 : 1)}</div>
      <div class="d-unit">${x.unit}</div>
      <div class="d-from">${x.given ? 'you gave this' : 'worked out'}</div>
    </div>`).join('');

  $('done-extra').innerHTML = r.extras
    .map((x) => `<span class="dx">${x.label}<b>${fmt(x.value, x.unit === '°' ? 1 : 2)}${x.unit === '°' ? '' : ' '}${x.unit}</b></span>`)
    .join('');

  // Whatever still needs saying: an assumption, a second valid angle, or the
  // instant they actually asked about.
  const said = [];
  if (r.moment) said.push(r.moment.text);
  said.push(...r.notes);
  $('done-note').innerHTML = said.join(' ');

  $('done').hidden = false;
}

function title(r) {
  if (traj?.bounces > 0) return 'It finished bouncing';
  if (r.mode === '1d' && Math.abs(r.params.u) < 1e-9) return 'It hit the ground';
  if (r.mode === '1d' && r.params.h <= 1e-9) return 'It came back down';
  return 'It landed';
}

function hideDone() { $('done').hidden = true; }

function renderWorking() {
  if (!state.extras.working || !traj) return;
  const parts = [];
  if (state.markers?.obstacle) {
    const c = obstacleCheck(traj, state.markers.obstacle);
    parts.push(`<div class="verdict" data-ok="${c.ok}">${c.text}</div>`);
  }
  for (const s of buildWorking(traj, state.t)) {
    parts.push(`<div class="step"><div class="step-h">${s.title}</div>` +
      s.rows.map((r) => `<div class="eq"><div class="eq-f">${r.f}</div><div class="eq-s">${r.s}</div>${r.r ? `<div class="eq-r">${r.r}</div>` : ''}</div>`).join('') +
      (s.note ? `<div class="step-n">${s.note}</div>` : '') + '</div>');
  }
  $('working').innerHTML = parts.join('');
}

/* ── loop ───────────────────────────────────────────────────────────── */
function draw() {
  if (state.step !== 'flight' || !traj) { dirty = false; return; }
  const R = state.resolve ? resolveAt(traj, state.t) : null;
  const opts = { traj, second, ghost, t: state.t, show: state.show, fired: state.launched,
                 verdict: state.verdict,
                 markers: state.markers || {}, scenario, secondLabel: scenario.second?.label,
                 resolve: R, hover: state.hover };
  // An exhibit is staged rather than surveyed: its own plate, its own scale on
  // each axis, and no 3D — there is nothing to orbit in a strobe photograph.
  if (scenario?.exhibit) exhibit.render($('scene'), cam, opts);
  else if (state.dim === '3d') scene3d.render($('scene'), cam3, opts);
  else scene.render($('scene'), cam, opts);

  if (state.extras.graphs) {
    const P = palette();
    for (const spec of graphSpecs(traj, state.t, P)) drawGraph($(spec.canvas), spec);
  }
  renderHud(); renderWorking(); renderResolve(R);
  $('scrub').value = traj.tMax ? state.t / traj.tMax : 0;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.step === 'flight' && state.playing && traj) {
    state.t += dt * state.rate;
    const tStop = Math.max(traj.tMax, scenario?.exhibit && second ? second.tMax : 0);
    if (state.t >= tStop) {
      state.t = tStop; state.playing = false; setPlayIcon(false);
      showDone();                       // only ever on a flight that ran its course
    }
    dirty = true;
  }
  // the camera travels rather than teleporting; while it is moving, so is
  // the frame
  if (state.step === 'flight') {
    if (state.dim === '3d') { if (scene3d.easeCamera3D(cam3, dt)) dirty = true; }
    else if (scene.easeCamera(cam, dt)) dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

/* ── options ────────────────────────────────────────────────────────── */
function buildOptions() {
  const mk = (list, store) => list.map((s) =>
    `<label class="ck"><input type="checkbox" data-k="${s.key}"${store[s.key] ? ' checked' : ''}>
     <span class="box-ck"></span>${s.label}</label>`).join('');
  $('shows').innerHTML = mk(SHOWS, state.show);
  $('extras').innerHTML = mk(EXTRAS, state.extras);
  for (const i of $('shows').querySelectorAll('input'))
    i.addEventListener('change', () => { state.show[i.dataset.k] = i.checked; dirty = true; });
  for (const i of $('extras').querySelectorAll('input'))
    i.addEventListener('change', () => {
      state.extras[i.dataset.k] = i.checked;
      $('graphs-wrap').hidden = !state.extras.graphs;
      $('working-wrap').hidden = !state.extras.working;
      dirty = true;
    });
}

/* ── chrome ─────────────────────────────────────────────────────────── */
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $('theme-btn').textContent = mode === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('suvat-theme', mode); } catch {}
  dropToneCache();
  dirty = true;
}

$('brand').addEventListener('click', () => go('scenario'));
$('back-1').addEventListener('click', () => go('scenario'));
$('back-2').addEventListener('click', () => { hideDone(); closeResolve(); go('values'); });
$('launch').addEventListener('click', launch);
$('intro-go').addEventListener('click', () => { closeIntro(); launch(); });
$('intro-values').addEventListener('click', () => { closeIntro(); go('values'); });
$('play').addEventListener('click', togglePlay);
const replay = () => { hideDone(); closeResolve(); state.t = 0; state.playing = true; setPlayIcon(true); dirty = true; };
$('replay').addEventListener('click', replay);
$('done-replay').addEventListener('click', replay);
$('done-close').addEventListener('click', hideDone);
$('done-values').addEventListener('click', () => { hideDone(); go('values'); });
$('scrub').addEventListener('input', (e) => {
  if (!traj) return;
  hideDone();
  state.playing = false; setPlayIcon(false);
  state.t = parseFloat(e.target.value) * traj.tMax; dirty = true;
});
$('res-close').addEventListener('click', closeResolve);
$('res-go').addEventListener('click', () => {
  closeResolve();
  if (traj && state.t < traj.tMax - 1e-6) { state.playing = true; setPlayIcon(true); }
  dirty = true;
});
for (const b of $('rate-seg').children) {
  b.addEventListener('click', () => {
    state.rate = parseFloat(b.dataset.rate);
    for (const x of $('rate-seg').children) x.setAttribute('aria-pressed', String(x === b));
  });
}
for (const b of $('dim-seg').children) {
  b.addEventListener('click', () => {
    state.dim = b.dataset.dim;
    for (const x of $('dim-seg').children) x.setAttribute('aria-pressed', String(x === b));
    $('band-seg').hidden = state.dim === '3d';   // zoom bands are the 2D camera
    cam.fit = true; cam3.fit = true; dirty = true;
  });
}
for (const b of $('band-seg').children) {
  b.addEventListener('click', () => {
    scene.setBand(cam, b.dataset.band);
    for (const x of $('band-seg').children) x.setAttribute('aria-pressed', String(x === b));
    dirty = true;
  });
}
$('bounce-ck').addEventListener('change', (e) => {
  state.bounce = e.target.checked;
  $('bounce-opts').hidden = !state.bounce;
  cam.fit = true; cam3.fit = true; recompute(); dirty = true;
});
$('restitution').addEventListener('input', (e) => {
  state.restitution = parseFloat(e.target.value);
  $('rest-val').textContent = state.restitution.toFixed(2);
  cam.fit = true; cam3.fit = true; recompute(); dirty = true;
});
$('theme-btn').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('options-btn').addEventListener('click', () => {
  state.options = !state.options;
  $('options-btn').setAttribute('aria-pressed', String(state.options));
  $('main').dataset.options = state.options ? 'on' : 'off';
  dirty = true;
});

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (state.step === 'values' && e.key === 'Enter' && !$('launch').disabled) { launch(); return; }
  if (state.step !== 'flight') return;
  if (e.key === 'Escape') { if (state.resolve) closeResolve(); else hideDone(); return; }
  if (e.key === 'r' || e.key === 'R') {
    if (state.resolve) closeResolve(); else if (state.launched) openResolve(state.t);
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { hideDone(); state.playing = false; setPlayIcon(false); state.t = Math.min(traj.tMax, state.t + traj.tMax / 60); dirty = true; }
  else if (e.key === 'ArrowLeft')  { hideDone(); state.playing = false; setPlayIcon(false); state.t = Math.max(0, state.t - traj.tMax / 60); dirty = true; }
});

addEventListener('resize', () => {
  if (!cam.touched) cam.fit = true;
  if (!cam3.touched) cam3.fit = true;
  dirty = true;
});
const pickScene = () => ({ markers: state.markers, scenario, traj, t: state.t,
                           fired: state.launched, dim: state.dim });
const resolveHooks = {
  hover(on) { if (state.hover !== on) { state.hover = on; dirty = true; } },
  click(t) { openResolve(t); },
};

scene.attachControls($('scene'), cam, () => { dirty = true; },
  pickScene,
  (kind, world) => {
    if (state.dim !== '2d') return;
    if (kind === 'obstacle') { state.markers.obstacle.x = Math.max(0.5, world.x); state.markers.obstacle.height = Math.max(0, world.y); }
    else if (kind === 'target') { state.markers.target.x = Math.max(0.5, world.x); state.markers.target.y = Math.max(0, world.y); }
    else if (kind === 'heightLine') { state.markers.heightLine = scene.snapHeight(Math.max(0, world.y)); }
    dirty = true;
  },
  resolveHooks);
scene3d.attachControls3D($('scene'), cam3, () => { if (state.dim === '3d') dirty = true; },
                         pickScene, resolveHooks);

/* ── boot ───────────────────────────────────────────────────────────── */
let saved = null;
try { saved = localStorage.getItem('suvat-theme'); } catch {}
applyTheme(saved || 'light');
buildScenarioScreen();
buildOptions();
go('scenario');
requestAnimationFrame(frame);

window.SUVAT = { state, get traj() { return traj; }, get solved() { return solved; },
                 cam, cam3, choose: chooseScenario, launch, go,
                 showDone, hideDone, openResolve, closeResolve,
                 redraw() { recompute(); draw(); } };
