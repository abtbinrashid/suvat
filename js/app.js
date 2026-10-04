// app.js — three screens, in order: scenario, values, flight.
//
// The whole app is SUVAT. Screen two asks for the five quantities and nothing
// else beyond what the chosen situation genuinely needs. Launch stays disabled
// until the engine can actually determine the motion, and says why not.

import { solveLaunch } from './core/solve.js';
import { trajectory } from './core/trajectory.js';
import { flight } from './core/projectile.js';
import { SCENARIOS, GROUPS, GRAVITY, byId } from './scenarios.js';
import { buildWorking, obstacleCheck } from './working.js';
import * as scene from './render/scene.js';
import * as scene3d from './render/scene3d.js';
import { createCamera3D } from './render/grid.js';
import { drawGraph, graphSpecs } from './render/graphs.js';
import { fmt, palette } from './render/util.js';

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
  { key: 'components',   label: 'Components of velocity' },
  { key: 'ticks',        label: 'Equal time steps' },
  { key: 'acceleration', label: 'Acceleration' },
  { key: 'apex',         label: 'Greatest height' },
  { key: 'range',        label: 'Horizontal displacement' },
  { key: 'grid',         label: 'Grid' },
];
const EXTRAS = [
  { key: 'graphs',  label: 'Graphs against time' },
  { key: 'working', label: 'Show the working' },
  { key: 'energy',  label: 'Kinetic energy and momentum' },
];

const state = {
  step: 'scenario', id: null,
  given: {}, mass: 1,
  bounce: false, restitution: 0.7,
  dim: '2d', t: 0, playing: false, launched: false, firedBefore: false,
  show: { path: true, velocity: true, apex: true, range: true, grid: true,
          components: false, ticks: false, acceleration: false },
  extras: { graphs: false, working: false, energy: false },
  options: false,
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

/** A small sketch of the situation, drawn from its own numbers. */
function thumb(s) {
  const f = flight({ u: s.params.u || 0.001, theta: s.noAngle ? -90 : s.params.theta, h: s.params.h, g: s.params.g || 9.81 });
  const pts = f.path(40);
  const maxX = Math.max(1, ...pts.map((p) => p.x));
  const maxY = Math.max(1, ...pts.map((p) => p.y));
  const X = (x) => 8 + (x / maxX) * 104;
  const Y = (y) => 52 - (y / maxY) * 40;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 120 60" aria-hidden="true">
    <line x1="2" y1="52.5" x2="118" y2="52.5" stroke="var(--border)" stroke-width="1"/>
    ${s.params.h > 0 ? `<line x1="${X(0)}" y1="${Y(s.params.h)}" x2="${X(0)}" y2="52.5" stroke="var(--ink-faint)" stroke-width="1.5"/>` : ''}
    <path d="${d}" fill="none" stroke="var(--vel)" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="${X(0)}" cy="${Y(s.params.h)}" r="3" fill="var(--vel)"/>
  </svg>`;
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
  go('values');
}

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
      <p class="xhint">Optional. Leave it blank if the question does not give it.</p></div>`);
  }
  rows.push(`<div class="xrow" data-x="h"><label for="x-h">Launch height h (m)</label>
    <input id="x-h" type="number" step="any" value="${state.h ?? ''}" placeholder="—">
    <p class="xhint">Optional. Blank means it works the height out, or takes the ground.</p></div>`);
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

  solved = solveLaunch(k, { noAngle: scenario.noAngle, lockAngle: scenario.lockAngle });

  const msg = $('solve-msg'), btn = $('launch');

  if (!solved.ok) {
    msg.dataset.ok = 'false'; msg.textContent = solved.reason;
    $('notes').innerHTML = '';
    btn.disabled = true; btn.textContent = 'Launch';
    $('launch-hint').textContent = 'Fill in enough for the engine to pin the motion down.';
    traj = null; return;
  }

  msg.dataset.ok = 'true';
  msg.textContent = solved.derived.length
    ? `Ready. The rest comes out as:  ${solved.derived.join('  ·  ')}`
    : 'Everything needed is here.';
  showDerived(solved);

  traj = trajectory({ ...solved.params, mass: state.mass,
                      restitution: state.bounce ? state.restitution : 0,
                      maxBounces: state.bounce ? 6 : 0 });
  second = buildSecond(solved.params);
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
  const q = s.from ? s.from(p) : s;
  if (!q) return null;                   // the situation does not support one
  return flight({ u: q.u, theta: q.theta, h: q.h ?? 0, g: p.g });
}

/* ── step 3 · flight ────────────────────────────────────────────────── */
function launch() {
  if (!traj) return;
  if (state.firedBefore) ghost = traj.path(260);
  state.firedBefore = true; state.launched = true;
  state.t = 0; state.playing = true;
  cam.auto = true; cam3.auto = true;
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
  hideDone();
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
  $('hud-right').innerHTML = b('Time elapsed', fmt(state.t, 2), 's');
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
  $('done-note').textContent = said.join(' ');

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
  const opts = { traj, second, ghost, t: state.t, show: state.show, fired: state.launched,
                 markers: state.markers || {}, scenario, secondLabel: scenario.second?.label };
  if (state.dim === '3d') scene3d.render($('scene'), cam3, opts);
  else scene.render($('scene'), cam, opts);

  if (state.extras.graphs) {
    const P = palette();
    for (const spec of graphSpecs(traj, state.t, P)) drawGraph($(spec.canvas), spec);
  }
  renderHud(); renderWorking();
  $('scrub').value = traj.tMax ? state.t / traj.tMax : 0;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.step === 'flight' && state.playing && traj) {
    state.t += dt;
    if (state.t >= traj.tMax) {
      state.t = traj.tMax; state.playing = false; setPlayIcon(false);
      showDone();                       // only ever on a flight that ran its course
    }
    dirty = true;
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
  dirty = true;
}

$('brand').addEventListener('click', () => go('scenario'));
$('back-1').addEventListener('click', () => go('scenario'));
$('back-2').addEventListener('click', () => { hideDone(); go('values'); });
$('launch').addEventListener('click', launch);
$('play').addEventListener('click', togglePlay);
const replay = () => { hideDone(); state.t = 0; state.playing = true; setPlayIcon(true); dirty = true; };
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
for (const b of $('dim-seg').children) {
  b.addEventListener('click', () => {
    state.dim = b.dataset.dim;
    for (const x of $('dim-seg').children) x.setAttribute('aria-pressed', String(x === b));
    cam.auto = true; cam3.auto = true; dirty = true;
  });
}
$('bounce-ck').addEventListener('change', (e) => {
  state.bounce = e.target.checked;
  $('bounce-opts').hidden = !state.bounce;
  cam.auto = true; cam3.auto = true; recompute(); dirty = true;
});
$('restitution').addEventListener('input', (e) => {
  state.restitution = parseFloat(e.target.value);
  $('rest-val').textContent = state.restitution.toFixed(2);
  cam.auto = true; recompute(); dirty = true;
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
  if (e.key === 'Escape') { hideDone(); return; }
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { hideDone(); state.playing = false; setPlayIcon(false); state.t = Math.min(traj.tMax, state.t + traj.tMax / 60); dirty = true; }
  else if (e.key === 'ArrowLeft')  { hideDone(); state.playing = false; setPlayIcon(false); state.t = Math.max(0, state.t - traj.tMax / 60); dirty = true; }
});

addEventListener('resize', () => { dirty = true; });
scene.attachControls($('scene'), cam, () => { dirty = true; },
  () => ({ markers: state.markers, scenario }),
  (kind, world) => {
    if (state.dim !== '2d') return;
    if (kind === 'obstacle') { state.markers.obstacle.x = Math.max(0.5, world.x); state.markers.obstacle.height = Math.max(0, world.y); }
    else if (kind === 'target') { state.markers.target.x = Math.max(0.5, world.x); state.markers.target.y = Math.max(0, world.y); }
    else if (kind === 'heightLine') { state.markers.heightLine = Math.max(0, world.y); }
    dirty = true;
  });
scene3d.attachControls3D($('scene'), cam3, () => { if (state.dim === '3d') dirty = true; });

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
                 showDone, hideDone,
                 redraw() { recompute(); draw(); } };
