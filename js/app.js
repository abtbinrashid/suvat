// app.js — state and wiring.
//
// The flow is deliberate: choose a scenario, set the values, see the path
// drawn, then Fire. Nothing is animating and no readings exist until the
// student asks for them. Everything beyond that lives behind Options.

import { flight, optimumAngle } from './core/projectile.js';
import { speedFromRange } from './core/question.js';
import { SCENARIOS, GROUPS, byId, DEFAULT_SCENARIO } from './scenarios.js';
import { buildWorking, obstacleCheck } from './working.js';
import * as scene from './render/scene.js';
import { drawGraph, graphSpecs } from './render/graphs.js';
import { fmt, palette } from './render/util.js';

const $ = (id) => document.getElementById(id);

const state = {
  id: DEFAULT_SCENARIO,
  u: 28, theta: 45, h: 25, g: 9.8,
  unknown: { u: false, theta: false, h: false },
  knownRange: null,
  t: 0, fired: false, playing: false,
  // A first-time view shows the path, the object and its velocity. Everything
  // else is an option, because the first screen was doing far too much.
  show: { path: true, velocity: true, apex: true, range: true,
          components: false, ticks: false, grid: false, acceleration: false },
  extras: { graphs: false, working: false },
  options: false,
};

const cam = scene.createCamera();
let f = null, second = null, scenario = null, dirty = true;

const FIELDS = [
  { key: 'u',     name: 'Initial velocity',    sym: 'u', unit: 'm s⁻¹', min: 0,   max: 100, step: 0.1 },
  { key: 'theta', name: 'Angle of projection', sym: 'θ', unit: '°',     min: -90, max: 90,  step: 0.1 },
  { key: 'h',     name: 'Launch height',       sym: 'h', unit: 'm',     min: 0,   max: 500, step: 0.1 },
];

const G_CHIPS = [{ label: '9.8', g: 9.8 }, { label: '10', g: 10 },
                 { label: 'Moon', g: 1.62 }, { label: 'None', g: 0 }];

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
];

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
  Object.assign(state, scenario.params);
  state.unknown = { u: false, theta: false, h: false };
  state.knownRange = null;
  cam.auto = true;
  $('scenario-note').textContent = scenario.note || '';
  $('scenario-note').hidden = !scenario.note;
  buildFields();
  buildChips();
  unfire();
}

/** Back to "ready to fire": the path is drawn, nothing is moving, no readings. */
function unfire() {
  state.fired = false;
  state.playing = false;
  state.t = 0;
  $('fire').textContent = 'Fire';
  $('fire').dataset.state = 'ready';
  $('fire-hint').textContent = 'The path is drawn. Press Fire to run it.';
  $('play').disabled = true;
  $('scrub').disabled = true;
  recompute();
}

function fire() {
  state.fired = true;
  state.playing = true;
  state.t = 0;
  $('fire').textContent = 'Fire again';
  $('fire').dataset.state = 'fired';
  $('fire-hint').textContent = 'Drag the slider to move through the flight.';
  $('play').disabled = false;
  $('scrub').disabled = false;
  setPlayIcon(true);
  dirty = true;
}

/* ── fields ─────────────────────────────────────────────────────────── */
function buildFields() {
  const root = $('fields');
  root.innerHTML = '';

  for (const fd of FIELDS) {
    if (fd.key === 'theta' && scenario.noAngle) continue;   // a dropped object has no angle
    const locked = fd.key === 'theta' && scenario.lockAngle;

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.unknown = String(state.unknown[fd.key]);
    wrap.innerHTML = `
      <div class="f-head"><span class="f-name">${fd.name}</span><span class="f-sym">${fd.sym}</span></div>
      <div class="f-row">
        <input class="f-num" type="number" step="${fd.step}" value="${round(state[fd.key], fd.step)}"
               aria-label="${fd.name} in ${fd.unit}"${locked ? ' readonly' : ''}>
        <span class="f-unit">${fd.unit}</span>
      </div>
      ${locked ? '' : `<button class="f-unknown" aria-pressed="${state.unknown[fd.key]}">I don’t know this</button>`}`;

    const num = wrap.querySelector('.f-num');
    num.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isFinite(v)) return;
      state[fd.key] = Math.min(fd.max, Math.max(fd.min, v));
      cam.auto = true;
      unfire();
    });
    wrap.querySelector('.f-unknown')?.addEventListener('click', () => {
      state.unknown[fd.key] = !state.unknown[fd.key];
      buildFields();
      unfire();
    });
    root.append(wrap);
  }

  if (Object.values(state.unknown).some(Boolean)) {
    const extra = document.createElement('div');
    extra.className = 'field';
    extra.innerHTML = `
      <div class="f-head"><span class="f-name">Horizontal displacement when it lands</span><span class="f-sym">s</span></div>
      <div class="f-row">
        <input class="f-num" type="number" step="0.1" value="${state.knownRange ?? ''}" placeholder="—"
               aria-label="Horizontal displacement when it lands, in metres">
        <span class="f-unit">m</span>
      </div>
      <div class="f-solved" id="derive-msg"></div>`;
    extra.querySelector('.f-num').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.knownRange = isFinite(v) ? v : null;
      unfire();
    });
    root.append(extra);
  }
}

const round = (v, step) => {
  const dp = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number(v).toFixed(dp);
};

function buildChips() {
  $('g-chips').innerHTML = G_CHIPS
    .map((c) => `<button class="chip" data-g="${c.g}" aria-pressed="${Math.abs(c.g - state.g) < 1e-9}">${c.label}</button>`)
    .join('');
  for (const b of $('g-chips').children) {
    b.addEventListener('click', () => {
      state.g = parseFloat(b.dataset.g);
      for (const x of $('g-chips').children) x.setAttribute('aria-pressed', String(x === b));
      cam.auto = true; unfire();
    });
  }
}

function buildOptions() {
  const mk = (list, store, after) => list.map((s) =>
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

/* ── compute ────────────────────────────────────────────────────────── */
function recompute() {
  let u = state.u, theta = state.theta, h = state.h;
  const msg = [];
  let derived = null;

  if (state.unknown.u) {
    if (state.knownRange != null) {
      const r = speedFromRange(state.knownRange, theta, h, state.g);
      if (r.ok) { u = r.u; derived = `Initial velocity worked out as ${fmt(u, 2)} m s⁻¹.`; }
      else msg.push(r.error);
    } else msg.push('Give the horizontal displacement when it lands, and the initial velocity can be found from it.');
  }
  if (state.unknown.h) {
    const c = Math.cos(theta * Math.PI / 180);
    if (state.knownRange != null && Math.abs(c) > 1e-9) {
      const tt = state.knownRange / (u * c);
      const hh = 0.5 * state.g * tt * tt - u * Math.sin(theta * Math.PI / 180) * tt;
      if (hh >= 0) { h = hh; derived = `Launch height worked out as ${fmt(h, 2)} m.`; }
      else msg.push('No launch height above the ground fits those values.');
    } else msg.push('Give the horizontal displacement when it lands, and the launch height can be found from it.');
  }
  if (state.unknown.theta) {
    msg.push('The angle of projection cannot be found from these values alone. Enter it, or mark a different quantity as unknown.');
  }

  const dm = $('derive-msg');
  if (dm) { dm.textContent = derived || msg.join(' '); dm.style.color = derived ? 'var(--accent)' : 'var(--ink-muted)'; }

  f = flight({ u, theta: scenario.noAngle ? -90 : theta, h, g: state.g, azimuth: 0 });
  second = buildSecond(u, theta, h);
  dirty = true;
}

function buildSecond(u, theta, h) {
  const s = scenario.second;
  if (!s) return null;
  if (s.thetaFrom) return flight({ u, theta: s.thetaFrom(theta), h, g: state.g });
  if (s.sameAsFirst) return flight({ u, theta, h, g: state.g });
  return flight({ u: s.u, theta: s.theta, h: s.h, g: state.g });
}

/* ── readout boxes ──────────────────────────────────────────────────── */
function renderBoxes() {
  const on = state.fired;
  const p = f.pos(state.t), v = f.vel(state.t);
  const box = (k, val, unit, hue) =>
    `<div class="box"${hue ? ` data-hue="${hue}"` : ''} data-dim="${!on}">
       <div class="box-k">${k}</div>
       <div class="box-v">${on ? val : '—'}<small>${unit}</small></div>
     </div>`;
  $('boxes').innerHTML = [
    box('Time elapsed', fmt(state.t, 2), 's'),
    box('Height', fmt(p.y, 1), 'm', 'disp'),
    box('Horizontal distance', fmt(p.x, 1), 'm', 'disp'),
    box('Speed', fmt(Math.hypot(v.x, v.y), 1), 'm s⁻¹', 'vel'),
  ].join('');
}

function renderWorking() {
  if (!state.extras.working) return;
  const parts = [];
  if (scenario.markers?.obstacle) {
    const c = obstacleCheck(f, scenario.markers.obstacle);
    parts.push(`<div class="verdict" data-ok="${c.ok}">${c.text}</div>`);
  }
  for (const s of buildWorking(f, state.t)) {
    parts.push(`<div class="step"><div class="step-h">${s.title}</div>` +
      s.rows.map((r) => `<div class="eq"><div class="eq-f">${r.f}</div><div class="eq-s">${r.s}</div>${r.r ? `<div class="eq-r">${r.r}</div>` : ''}</div>`).join('') +
      (s.note ? `<div class="step-n">${s.note}</div>` : '') + '</div>');
  }
  $('working').innerHTML = parts.join('');
}

/* ── loop ───────────────────────────────────────────────────────────── */
function draw() {
  scene.render($('scene'), cam, {
    flight: f, second, t: state.t, show: state.show, fired: state.fired,
    markers: scenario.markers || {}, scenario,
    secondDelay: scenario.second?.delay || 0,
    secondLabel: scenario.second?.label,
  });
  if (state.extras.graphs) {
    const P = palette();
    for (const spec of graphSpecs(f, state.t, P)) drawGraph($(spec.canvas), spec);
  }
  renderBoxes();
  renderWorking();
  $('scrub').value = f.tMax ? state.t / f.tMax : 0;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.fired && state.playing) {
    state.t += dt;
    if (state.t >= f.tMax) { state.t = f.tMax; state.playing = false; setPlayIcon(false); }
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

/* ── chrome ─────────────────────────────────────────────────────────── */
function setPlayIcon(playing) {
  $('play-icon').innerHTML = playing
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : '<path d="M8 5v14l11-7z"/>';
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $('theme-btn').textContent = mode === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('suvat-theme', mode); } catch {}
  dirty = true;
}

$('fire').addEventListener('click', () => (state.fired ? (state.t = 0, fire()) : fire()));
$('play').addEventListener('click', () => {
  if (!state.fired) return;
  if (state.t >= f.tMax) state.t = 0;
  state.playing = !state.playing; setPlayIcon(state.playing); dirty = true;
});
$('reset').addEventListener('click', () => { cam.auto = true; unfire(); });
$('scrub').addEventListener('input', (e) => {
  if (!state.fired) return;
  state.playing = false; setPlayIcon(false);
  state.t = parseFloat(e.target.value) * f.tMax; dirty = true;
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
  if (e.code === 'Space') { e.preventDefault(); state.fired ? $('play').click() : fire(); }
  else if (e.key === 'ArrowRight' && state.fired) { state.playing = false; setPlayIcon(false); state.t = Math.min(f.tMax, state.t + f.tMax / 60); dirty = true; }
  else if (e.key === 'ArrowLeft' && state.fired)  { state.playing = false; setPlayIcon(false); state.t = Math.max(0, state.t - f.tMax / 60); dirty = true; }
  else if (e.key.toLowerCase() === 'r') { cam.auto = true; unfire(); }
});

addEventListener('resize', () => { dirty = true; });
scene.attachControls($('scene'), cam, () => { dirty = true; });

/* ── boot ───────────────────────────────────────────────────────────── */
let saved = null;
try { saved = localStorage.getItem('suvat-theme'); } catch {}
applyTheme(saved || 'light');          // light is the default
buildPicker();
buildOptions();
loadScenario(state.id);
requestAnimationFrame(frame);

window.SUVAT = { state, get flight() { return f; }, cam, load: loadScenario, fire,
                 redraw() { recompute(); draw(); } };
