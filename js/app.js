// app.js — state and wiring.
//
// The order is deliberate. The student picks a scenario, fills in whatever the
// question gave them, and the engine works out the rest. Fire only becomes
// available once the launch is actually determined; until then it says why not.

import { solveLaunch } from './core/solve.js';
import { trajectory } from './core/trajectory.js';
import { flight } from './core/projectile.js';
import { SCENARIOS, GROUPS, GRAVITY, byId, DEFAULT_SCENARIO } from './scenarios.js';
import { buildWorking, obstacleCheck } from './working.js';
import * as scene from './render/scene.js';
import { drawGraph, graphSpecs } from './render/graphs.js';
import { fmt, palette } from './render/util.js';

const $ = (id) => document.getElementById(id);

/* Every SUVAT quantity is a field. Blank means "not given". */
const FIELDS = [
  { key: 'u',     name: 'Initial velocity',        sym: 'u', unit: 'm s⁻¹' },
  { key: 'v',     name: 'Speed when it lands',     sym: 'v', unit: 'm s⁻¹' },
  { key: 'theta', name: 'Angle of projection',     sym: 'θ', unit: '°' },
  { key: 'h',     name: 'Launch height',           sym: 'h', unit: 'm' },
  { key: 's',     name: 'Horizontal displacement', sym: 's', unit: 'm' },
  { key: 't',     name: 'Time of flight',          sym: 't', unit: 's' },
  { key: 'g',     name: 'Acceleration',            sym: 'a', unit: 'm s⁻²', chips: true },
  { key: 'mass',  name: 'Mass',                    sym: 'm', unit: 'kg' },
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
  id: DEFAULT_SCENARIO,
  given: {},                       // what the student typed; blank = unknown
  mass: 1,
  bounce: false, restitution: 0.7,
  t: 0, fired: false, playing: false, firedBefore: false,
  show: { path: true, velocity: true, apex: true, range: true,
          components: false, ticks: false, grid: false, acceleration: false },
  extras: { graphs: false, working: false, energy: false },
  options: false,
};

const cam = scene.createCamera();
let scenario = null, solved = null, traj = null, second = null, ghost = null, dirty = true;

/* ── scenario ───────────────────────────────────────────────────────── */
function buildPicker() {
  const sel = $('scenario');
  sel.innerHTML = GROUPS.map((g) => {
    const items = SCENARIOS.filter((s) => s.group === g.id)
      .map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    return `<optgroup label="${g.label}">${items}</optgroup>`;
  }).join('');
  sel.value = state.id;
  sel.addEventListener('change', () => loadScenario(sel.value));
}

function loadScenario(id) {
  scenario = byId(id) || byId(DEFAULT_SCENARIO);
  state.id = scenario.id;
  state.given = { ...scenario.params };
  if (scenario.noAngle) delete state.given.theta;
  state.markers = JSON.parse(JSON.stringify(scenario.markers || {}));
  state.firedBefore = false;
  ghost = null;
  cam.auto = true;
  $('scenario-note').textContent = scenario.note || '';
  $('scenario-note').hidden = !scenario.note;
  buildFields();
  unfire();
}

/* ── fields ─────────────────────────────────────────────────────────── */
function buildFields() {
  const root = $('fields');
  root.innerHTML = '';

  for (const fd of FIELDS) {
    if (fd.key === 'theta' && scenario.noAngle) continue;
    if (fd.key === 'u' && scenario.fixedU != null) continue;   // dropped: u is zero by definition
    if (fd.key === 'mass' && !state.extras.energy && !state.bounce) continue;

    const locked = fd.key === 'theta' && scenario.lockAngle;
    const val = fd.key === 'mass' ? state.mass : state.given[fd.key];

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div class="f-head"><span class="f-name">${fd.name}</span><span class="f-sym">${fd.sym}</span></div>
      <div class="f-row">
        <input class="f-num" type="number" step="any" data-k="${fd.key}"
               value="${val ?? ''}" placeholder="—" aria-label="${fd.name} in ${fd.unit}"${locked ? ' readonly' : ''}>
        <span class="f-unit">${fd.unit}</span>
      </div>
      ${fd.chips ? `<div class="chips" style="margin-top:var(--sp-2)">${GRAVITY.map((x) =>
        `<button class="chip" data-g="${x.g}" aria-pressed="${state.given.g === x.g}">${x.label}</button>`).join('')}</div>` : ''}
      <div class="f-derived" hidden></div>`;

    const num = wrap.querySelector('.f-num');
    num.addEventListener('input', (e) => {
      const raw = e.target.value.trim();
      const v = raw === '' ? undefined : parseFloat(raw);
      if (fd.key === 'mass') state.mass = isFinite(v) ? v : 1;
      else if (raw === '' || !isFinite(v)) delete state.given[fd.key];
      else state.given[fd.key] = v;
      cam.auto = true;
      unfire();
    });
    for (const b of wrap.querySelectorAll('.chip')) {
      b.addEventListener('click', () => {
        state.given.g = parseFloat(b.dataset.g);
        cam.auto = true; buildFields(); unfire();
      });
    }
    root.append(wrap);
  }
}

/* ── solve, then decide whether Fire is allowed ─────────────────────── */
function recompute() {
  const k = { ...state.given };
  if (scenario.fixedU != null) k.u = scenario.fixedU;

  solved = solveLaunch(k, { noAngle: scenario.noAngle, lockAngle: scenario.lockAngle });

  const msg = $('solve-msg');
  const fireBtn = $('fire');

  if (!solved.ok) {
    msg.dataset.ok = 'false';
    msg.textContent = solved.reason;
    fireBtn.disabled = true;
    fireBtn.textContent = 'Fire';
    $('fire-hint').textContent = '';
    traj = null; second = null;
    dirty = true;
    markDerived({});
    return;
  }

  msg.dataset.ok = 'true';
  msg.textContent = solved.derived.length ? solved.derived.join('  ·  ') : '';
  markDerived(solved.params);

  traj = trajectory({
    ...solved.params, mass: state.mass,
    restitution: state.bounce ? state.restitution : 0,
    maxBounces: state.bounce ? 6 : 0,
  });
  second = buildSecond(solved.params);

  fireBtn.disabled = false;
  fireBtn.textContent = state.fired ? 'Fire again' : `Fire at ${fmt(solved.params.u, 1)} m s⁻¹`;
  dirty = true;
}

/** Show which boxes the engine filled in rather than the student. */
function markDerived(params) {
  for (const wrap of $('fields').querySelectorAll('.field')) {
    const num = wrap.querySelector('.f-num');
    const key = num.dataset.k;
    if (key === 'mass' || !(key in params)) { wrap.dataset.derived = 'false'; continue; }
    const wasGiven = state.given[key] !== undefined;
    if (!wasGiven && params[key] !== undefined) {
      num.value = Number(params[key].toFixed(2));
      wrap.dataset.derived = 'true';
    } else {
      wrap.dataset.derived = 'false';
    }
  }
}

function buildSecond(p) {
  const s = scenario.second;
  if (!s) return null;
  if (s.thetaFrom) return flight({ u: p.u, theta: s.thetaFrom(p.theta), h: p.h, g: p.g });
  if (s.sameAsFirst) return flight({ ...p });
  return flight({ u: s.u, theta: s.theta, h: s.h, g: p.g });
}

/* ── fire / pause ───────────────────────────────────────────────────── */
function unfire() {
  state.fired = false; state.playing = false; state.t = 0;
  $('play').disabled = true; $('scrub').disabled = true;
  $('fire').dataset.state = 'ready';
  $('fire-hint').textContent = state.firedBefore
    ? 'The last path is shown faintly. Fire again to compare.'
    : 'Nothing is drawn until you fire.';
  recompute();
}

function fire() {
  if (!traj) return;
  // The path already flown becomes the faint projection on the next run.
  if (state.fired || state.firedBefore) ghost = traj.path(260);
  state.firedBefore = true;
  state.fired = true; state.playing = true; state.t = 0;
  $('play').disabled = false; $('scrub').disabled = false;
  $('fire').dataset.state = 'fired';
  $('fire').textContent = 'Fire again';
  $('fire-hint').textContent = 'Space to pause and continue.';
  setPlayIcon(true);
  dirty = true;
}

function togglePlay() {
  if (!state.fired) return;
  if (state.t >= traj.tMax) state.t = 0;
  state.playing = !state.playing;
  setPlayIcon(state.playing);
  dirty = true;
}

function setPlayIcon(playing) {
  $('play-icon').innerHTML = playing
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : '<path d="M8 5v14l11-7z"/>';
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('play').dataset.playing = String(playing);
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
      buildFields(); dirty = true;
    });
}

/* ── readout boxes ──────────────────────────────────────────────────── */
function renderBoxes() {
  const on = state.fired && traj;
  const p = on ? traj.pos(state.t) : { x: 0, y: 0 };
  const v = on ? traj.vel(state.t) : { x: 0, y: 0 };
  const box = (k, val, unit, hue) =>
    `<div class="box"${hue ? ` data-hue="${hue}"` : ''} data-dim="${!on}">
       <div class="box-k">${k}</div>
       <div class="box-v">${on ? val : '—'}<small>${unit}</small></div></div>`;
  const items = [
    box('Time elapsed', fmt(state.t, 2), 's'),
    box('Height', fmt(p.y, 1), 'm', 'disp'),
    box('Horizontal distance', fmt(p.x, 1), 'm', 'disp'),
    box('Speed', fmt(Math.hypot(v.x, v.y), 1), 'm s⁻¹', 'vel'),
  ];
  if (state.extras.energy && on) {
    items.push(box('Kinetic energy', fmt(traj.kineticEnergy(state.t), 0), 'J'));
    items.push(box('Momentum', fmt(traj.momentum(state.t), 1), 'kg m s⁻¹'));
  }
  $('boxes').innerHTML = items.join('');
  $('boxes').style.gridTemplateColumns = `repeat(${items.length > 4 ? 3 : 4}, 1fr)`;
}

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
  scene.render($('scene'), cam, {
    traj, second, ghost, t: state.t, show: state.show, fired: state.fired,
    markers: state.markers || {}, scenario,
    secondLabel: scenario.second?.label,
  });
  if (state.extras.graphs && traj) {
    const P = palette();
    for (const spec of graphSpecs(traj, state.t, P)) drawGraph($(spec.canvas), spec);
  }
  renderBoxes();
  renderWorking();
  if (traj) $('scrub').value = traj.tMax ? state.t / traj.tMax : 0;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.fired && state.playing && traj) {
    state.t += dt;
    if (state.t >= traj.tMax) { state.t = traj.tMax; state.playing = false; setPlayIcon(false); }
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

/* ── chrome ─────────────────────────────────────────────────────────── */
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $('theme-btn').textContent = mode === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('suvat-theme', mode); } catch {}
  dirty = true;
}

$('fire').addEventListener('click', fire);
$('play').addEventListener('click', togglePlay);
$('reset').addEventListener('click', () => { cam.auto = true; ghost = null; state.firedBefore = false; unfire(); });
$('scrub').addEventListener('input', (e) => {
  if (!state.fired || !traj) return;
  state.playing = false; setPlayIcon(false);
  state.t = parseFloat(e.target.value) * traj.tMax; dirty = true;
});
$('bounce-ck').addEventListener('change', (e) => {
  state.bounce = e.target.checked;
  $('bounce-opts').hidden = !state.bounce;
  buildFields(); cam.auto = true; unfire();
});
$('restitution').addEventListener('input', (e) => {
  state.restitution = parseFloat(e.target.value);
  $('rest-val').textContent = state.restitution.toFixed(2);
  cam.auto = true; unfire();
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
  if (e.code === 'Space') { e.preventDefault(); state.fired ? togglePlay() : fire(); }
  else if (e.key === 'ArrowRight' && state.fired) { state.playing = false; setPlayIcon(false); state.t = Math.min(traj.tMax, state.t + traj.tMax / 60); dirty = true; }
  else if (e.key === 'ArrowLeft' && state.fired)  { state.playing = false; setPlayIcon(false); state.t = Math.max(0, state.t - traj.tMax / 60); dirty = true; }
});

addEventListener('resize', () => { dirty = true; });

/* Markers are draggable on the canvas — the fence, the target, the line. */
scene.attachControls($('scene'), cam, () => { dirty = true; },
  () => ({ markers: state.markers, scenario }),
  (kind, world) => {
    if (kind === 'obstacle') { state.markers.obstacle.x = Math.max(0.5, world.x); state.markers.obstacle.height = Math.max(0, world.y); }
    else if (kind === 'target') { state.markers.target.x = Math.max(0.5, world.x); state.markers.target.y = Math.max(0, world.y); }
    else if (kind === 'heightLine') { state.markers.heightLine = Math.max(0, world.y); }
    dirty = true;
  });

/* ── boot ───────────────────────────────────────────────────────────── */
let saved = null;
try { saved = localStorage.getItem('suvat-theme'); } catch {}
applyTheme(saved || 'light');
buildPicker();
buildOptions();
loadScenario(state.id);
requestAnimationFrame(frame);

window.SUVAT = { state, get traj() { return traj; }, get solved() { return solved; },
                 cam, load: loadScenario, fire, redraw() { recompute(); draw(); } };
