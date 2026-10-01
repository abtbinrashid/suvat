// app.js — state and wiring.

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
  knownRange: null,            // only used when a value is marked unknown
  t: 0, playing: true,
  show: { path: true, ticks: true, velocity: true, components: true,
          acceleration: false, apex: true, range: true, grid: true },
  working: true,
};

const cam = scene.createCamera();
let f = null, second = null, scenario = null, derived = null, dirty = true;

/* ── fields ──────────────────────────────────────────────────────────── */
const FIELDS = [
  { key: 'u',     name: 'Initial velocity',   sym: 'u', unit: 'm s⁻¹', min: 0,   max: 100, step: 0.1 },
  { key: 'theta', name: 'Angle of projection', sym: 'θ', unit: '°',     min: -90, max: 90,  step: 0.1 },
  { key: 'h',     name: 'Launch height',      sym: 'h', unit: 'm',     min: 0,   max: 500, step: 0.1 },
];

const G_CHIPS = [
  { label: '9.8', g: 9.8 }, { label: '10', g: 10 }, { label: '9.81', g: 9.81 },
  { label: 'Moon 1.62', g: 1.62 }, { label: 'None', g: 0 },
];

const SHOWS = [
  { key: 'path',         label: 'Path',                   hue: 'vel' },
  { key: 'velocity',     label: 'Velocity',               hue: 'vel' },
  { key: 'components',   label: 'Components of velocity', hue: 'vel' },
  { key: 'acceleration', label: 'Acceleration',           hue: 'acc' },
  { key: 'apex',         label: 'Greatest height' },
  { key: 'range',        label: 'Horizontal displacement' },
  { key: 'ticks',        label: 'Equal time steps' },
  { key: 'grid',         label: 'Grid' },
];

/* ── scenario picker — one dropdown, not twenty-six buttons ──────────── */
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
  state.t = 0;
  cam.auto = true;
  $('scenario-note').textContent = scenario.note || 'Everything here is editable. Change a value and watch what it does.';
  $('scenario-note').style.display = scenario.note ? '' : 'none';
  buildFields();
  recompute();
}

/* ── control fields, with an explicit "not given" state ─────────────── */
function buildFields() {
  const root = $('fields');
  root.innerHTML = '';

  for (const fd of FIELDS) {
    // A dropped object has no angle of projection, so do not pretend it does.
    if (fd.key === 'theta' && scenario.noAngle) continue;

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.unknown = String(state.unknown[fd.key]);

    const locked = fd.key === 'theta' && scenario.lockAngle;

    wrap.innerHTML = `
      <div class="f-head">
        <span class="f-name">${fd.name}</span>
        <span class="f-sym">${fd.sym}</span>
      </div>
      <div class="f-row">
        <input class="f-num" type="number" step="${fd.step}" value="${round(state[fd.key], fd.step)}"
               aria-label="${fd.name} in ${fd.unit}">
        <span class="f-unit">${fd.unit}</span>
        ${locked ? '' : `<button class="f-unknown" aria-pressed="${state.unknown[fd.key]}">Not given</button>`}
      </div>
      <input type="range" min="${fd.min}" max="${fd.max}" step="${fd.step}" value="${state[fd.key]}"
             aria-label="${fd.name}" ${locked ? 'disabled' : ''}>
      <div class="f-solved" hidden></div>`;

    const num = wrap.querySelector('.f-num');
    const rng = wrap.querySelector('input[type=range]');
    const unk = wrap.querySelector('.f-unknown');

    const set = (val, fromRange) => {
      let v = parseFloat(val);
      if (!isFinite(v)) return;
      v = Math.min(fd.max, Math.max(fd.min, v));
      state[fd.key] = v;
      if (fromRange) num.value = round(v, fd.step); else rng.value = v;
      recompute();
    };
    rng.addEventListener('input', (e) => set(e.target.value, true));
    num.addEventListener('input', (e) => set(e.target.value, false));
    if (locked) num.readOnly = true;

    unk?.addEventListener('click', () => {
      state.unknown[fd.key] = !state.unknown[fd.key];
      unk.setAttribute('aria-pressed', String(state.unknown[fd.key]));
      wrap.dataset.unknown = String(state.unknown[fd.key]);
      buildFields();
      recompute();
    });

    root.append(wrap);
  }

  // When something is unknown, the usual way a paper lets you find it is by
  // telling you where it lands. Offer exactly that, and nothing else.
  const anyUnknown = Object.values(state.unknown).some(Boolean);
  if (anyUnknown) {
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
      recompute();
    });
    root.append(extra);
  }
}

const round = (v, step) => {
  const dp = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number(v).toFixed(dp);
};

/* ── g chips and show toggles ───────────────────────────────────────── */
function buildChips() {
  $('g-chips').innerHTML = G_CHIPS
    .map((c) => `<button class="chip" data-g="${c.g}" aria-pressed="${Math.abs(c.g - state.g) < 1e-9}">${c.label}</button>`)
    .join('');
  for (const b of $('g-chips').children) {
    b.addEventListener('click', () => {
      state.g = parseFloat(b.dataset.g);
      for (const x of $('g-chips').children) x.setAttribute('aria-pressed', String(x === b));
      cam.auto = true; recompute();
    });
  }
}

function buildShows() {
  $('shows').innerHTML = SHOWS.map((s) => `
    <label class="ck"${s.hue ? ` data-hue="${s.hue}"` : ''}>
      <input type="checkbox" data-k="${s.key}"${state.show[s.key] ? ' checked' : ''}>
      <span class="box"></span>${s.label}${s.hue ? '<span class="dash"></span>' : ''}
    </label>`).join('');
  for (const i of $('shows').querySelectorAll('input')) {
    i.addEventListener('change', () => { state.show[i.dataset.k] = i.checked; dirty = true; });
  }
}

/* ── compute ────────────────────────────────────────────────────────── */
function recompute() {
  derived = null;
  let u = state.u, theta = state.theta, h = state.h;

  // Work out anything marked "not given", or say plainly that it cannot be.
  const msg = [];
  if (state.unknown.u) {
    if (state.knownRange != null) {
      const r = speedFromRange(state.knownRange, theta, h, state.g);
      if (r.ok) { u = r.u; derived = { key: 'u', value: u, how: `From a horizontal displacement of ${state.knownRange} m at ${fmt(theta, 1)}° from ${fmt(h, 1)} m.` }; }
      else msg.push(r.error);
    } else msg.push('To find the initial velocity, give the horizontal displacement when it lands.');
  }
  if (state.unknown.h) {
    if (state.knownRange != null && Math.abs(Math.cos(theta * Math.PI / 180)) > 1e-9) {
      const tt = state.knownRange / (u * Math.cos(theta * Math.PI / 180));
      const hh = 0.5 * state.g * tt * tt - u * Math.sin(theta * Math.PI / 180) * tt;
      if (hh >= 0) { h = hh; derived = { key: 'h', value: h, how: `From a horizontal displacement of ${state.knownRange} m.` }; }
      else msg.push('No launch height above the ground fits those values.');
    } else msg.push('To find the launch height, give the horizontal displacement when it lands.');
  }
  if (state.unknown.theta) {
    msg.push('The angle of projection cannot be found from the values given. Enter it, or give a different unknown.');
  }

  const dm = $('derive-msg');
  if (dm) {
    dm.textContent = derived ? `Worked out: ${fmt(derived.value, 2)} — ${derived.how}` : msg.join(' ');
    dm.style.color = derived ? 'var(--accent-hi)' : 'var(--ink-muted)';
  }

  f = flight({ u, theta: scenario.noAngle ? -90 : theta, h, g: state.g, azimuth: 0 });
  second = buildSecond(u, theta, h);
  if (state.t > f.tMax) state.t = f.tMax;
  dirty = true;
}

function buildSecond(u, theta, h) {
  const s = scenario.second;
  if (!s) return null;
  if (s.thetaFrom) return flight({ u, theta: s.thetaFrom(theta), h, g: state.g });
  if (s.sameAsFirst) return flight({ u, theta, h, g: state.g });
  return flight({ u: s.u, theta: s.theta, h: s.h, g: state.g });
}

/* ── readouts ───────────────────────────────────────────────────────── */
function renderReadouts() {
  const p = f.pos(state.t), v = f.vel(state.t);
  const ro = (k, val, unit, hue) =>
    `<div class="ro"${hue ? ` data-hue="${hue}"` : ''}><div class="ro-k">${k}</div><div class="ro-v">${val}<small>${unit}</small></div></div>`;

  $('readouts').innerHTML = [
    ro('Time', fmt(state.t, 2), 's'),
    ro('Horizontal displacement', fmt(p.x, 1), 'm', 'disp'),
    ro('Height', fmt(p.y, 1), 'm', 'disp'),
    ro('Speed', fmt(Math.hypot(v.x, v.y), 1), 'm s⁻¹', 'vel'),
    '<div class="ro-sep"></div>',
    ro('Time of flight', isFinite(f.tFlight) ? fmt(f.tFlight, 2) : '∞', 's'),
    ro('Greatest height', fmt(f.apexHeight, 1), 'm'),
    ro('Range', isFinite(f.tFlight) ? fmt(f.range, 1) : '∞', 'm'),
    scenario.showOptimum ? ro('Best angle', fmt(optimumAngle(state.u, state.h, state.g), 1), '°') : '',
  ].join('');
}

/* ── working panel ──────────────────────────────────────────────────── */
function renderWorking() {
  if (!state.working) return;
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
    flight: f, second, t: state.t, show: state.show,
    markers: scenario.markers || {}, scenario,
    secondDelay: scenario.second?.delay || 0,
    secondLabel: scenario.second?.label,
  });
  const P = palette();
  for (const spec of graphSpecs(f, state.t, P)) drawGraph($(spec.canvas), spec);
  renderReadouts();
  renderWorking();
  $('scrub').value = f.tMax ? state.t / f.tMax : 0;
  $('t-read').textContent = `t = ${fmt(state.t, 2)} s`;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing) {
    state.t += dt;
    if (state.t >= f.tMax) state.t = 0;
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

/* ── chrome ─────────────────────────────────────────────────────────── */
function setPlaying(on) {
  state.playing = on;
  $('play-icon').innerHTML = on
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : '<path d="M8 5v14l11-7z"/>';
  $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $('theme-btn').textContent = mode === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('suvat-theme', mode); } catch {}
  dirty = true;
}

$('play').addEventListener('click', () => setPlaying(!state.playing));
$('reset').addEventListener('click', () => { state.t = 0; cam.auto = true; dirty = true; });
$('scrub').addEventListener('input', (e) => {
  setPlaying(false); state.t = parseFloat(e.target.value) * f.tMax; dirty = true;
});
$('theme-btn').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('working-btn').addEventListener('click', () => {
  state.working = !state.working;
  $('working-btn').setAttribute('aria-pressed', String(state.working));
  $('main').dataset.working = state.working ? 'on' : 'off';
  dirty = true;
});

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  else if (e.key === 'ArrowRight') { setPlaying(false); state.t = Math.min(f.tMax, state.t + f.tMax / 60); dirty = true; }
  else if (e.key === 'ArrowLeft')  { setPlaying(false); state.t = Math.max(0, state.t - f.tMax / 60); dirty = true; }
  else if (e.key.toLowerCase() === 'r') { state.t = 0; dirty = true; }
});

addEventListener('resize', () => { dirty = true; });
scene.attachControls($('scene'), cam, () => { dirty = true; });

/* ── boot ───────────────────────────────────────────────────────────── */
let saved = null;
try { saved = localStorage.getItem('suvat-theme'); } catch {}
applyTheme(saved || 'dark');
buildPicker();
buildChips();
buildShows();
loadScenario(state.id);
setPlaying(true);
requestAnimationFrame(frame);

window.SUVAT = { state, get flight() { return f; }, cam, redraw() { recompute(); draw(); },
                 load: loadScenario };
