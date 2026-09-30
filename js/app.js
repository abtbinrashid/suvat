// app.js — application wiring. State lives here; the render modules stay pure.

import { flight, GRAVITY, optimumAngle } from './core/projectile.js';
import { solve, SYMBOLS, NAMES, UNITS, EQUATIONS, fmtNum } from './core/suvat.js';
import * as scene2d from './render/scene2d.js';
import * as scene3d from './render/scene3d.js';
import { drawGraph, graphSpecs } from './render/graphs.js';
import { buildPanel } from './ui/controls.js';
import { fmt } from './render/util.js';

/* ── State ─────────────────────────────────────────────────────────────── */
const state = {
  u: 25, theta: 45, h: 0, g: 9.81, azimuth: 30, body: 'earth',
  compareOn: false, theta2: 60,
  trace: true, ticks: true, velocity: true, components: true,
  apex: true, range: true, shadow: true, gravity: false, grid: true, axes: true,
  dim: '2d', t: 0, playing: true, rate: 1,
};

const cam2 = scene2d.createCamera2D();
const cam3 = scene3d.createCamera3D();
const $ = (id) => document.getElementById(id);

let current = null;      // the active flight
let compare = null;      // the overlay flight, when comparing
let dirty = true;

function recompute() {
  current = flight({ u: state.u, theta: state.theta, h: state.h, g: state.g, azimuth: state.azimuth });
  compare = state.compareOn
    ? flight({ u: state.u, theta: state.theta2, h: state.h, g: state.g, azimuth: state.azimuth })
    : null;
  if (state.t > current.tMax) state.t = current.tMax;
  dirty = true;
}

/* ── Theme ─────────────────────────────────────────────────────────────── */
const SUN = 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4';
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $('theme-icon').setAttribute('d', mode === 'dark' ? SUN : MOON);
  $('theme-btn').setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`);
  try { localStorage.setItem('suvat-theme', mode); } catch {}
  dirty = true;
}
$('theme-btn').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('suvat-theme'); } catch {}
  applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
})();

/* ── Tabs ──────────────────────────────────────────────────────────────── */
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t === tab));
    for (const v of document.querySelectorAll('.view')) v.toggleAttribute('data-active', v.id === `view-${tab.dataset.view}`);
    dirty = true;
    requestAnimationFrame(() => { resizeAll(); dirty = true; });
  });
}

/* ── Panel ─────────────────────────────────────────────────────────────── */
const panel = buildPanel($('panel'), state, (key) => {
  // Keep the gravity segmented control and the g slider in step with each other.
  if (key === 'body') {
    state.g = GRAVITY[state.body].g;
    panel.sync();
  } else if (key === 'g') {
    const match = Object.entries(GRAVITY).find(([, v]) => Math.abs(v.g - state.g) < 0.005);
    state.body = match ? match[0] : null;
    panel.sync();
  } else if (key === 'preset') {
    state.t = 0;
    cam2.auto = true; cam3.auto = true;
    panel.sync();
  } else if (key === 'compareOn') {
    panel.sync();
  }
  recompute();
});

/* ── Dimension toggle ──────────────────────────────────────────────────── */
for (const b of $('dim-seg').children) {
  b.addEventListener('click', () => {
    state.dim = b.dataset.dim;
    for (const x of $('dim-seg').children) x.setAttribute('aria-pressed', String(x === b));
    dirty = true;
  });
}

/* ── Transport ─────────────────────────────────────────────────────────── */
const PLAY = 'M8 5v14l11-7z';
function setPlaying(on) {
  state.playing = on;
  $('play-icon').innerHTML = on
    ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
    : `<path d="${PLAY}"/>`;
  $('play-btn').setAttribute('aria-label', on ? 'Pause' : 'Play');
}
$('play-btn').addEventListener('click', () => setPlaying(!state.playing));

$('scrub').addEventListener('input', (e) => {
  setPlaying(false);
  state.t = parseFloat(e.target.value) * current.tMax;
  dirty = true;
});

for (const b of $('rate').children) {
  b.addEventListener('click', () => {
    state.rate = parseFloat(b.dataset.rate);
    for (const x of $('rate').children) x.setAttribute('aria-pressed', String(x === b));
  });
}

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  else if (e.key === 'ArrowRight') { setPlaying(false); state.t = Math.min(current.tMax, state.t + current.tMax / 80); dirty = true; }
  else if (e.key === 'ArrowLeft')  { setPlaying(false); state.t = Math.max(0, state.t - current.tMax / 80); dirty = true; }
  else if (e.key === 'r' || e.key === 'R') { state.t = 0; dirty = true; }
});

/* ── Chips ─────────────────────────────────────────────────────────────── */
function chip(k, v, u, live) {
  return `<div class="chip${live ? ' live' : ''}"><span class="k">${k}</span><span class="v">${v}</span><span class="u">${u}</span></div>`;
}
function renderChips() {
  const f = current;
  const p = f.pos(state.t), v = f.vel(state.t);
  const opt = optimumAngle(state.u, state.h, state.g);
  $('chips').innerHTML = [
    chip('t', fmt(state.t, 2), 's', true),
    chip(state.dim === '3d' ? 'x' : 'x', fmt(p.x, 1), 'm', true),
    chip('y', fmt(p.y, 1), 'm', true),
    chip('|v|', fmt(Math.hypot(v.x, v.y, v.z), 1), 'm s⁻¹', true),
    chip('T', isFinite(f.tFlight) ? fmt(f.tFlight, 2) : '∞', 's'),
    chip('H', fmt(f.apexHeight, 1), 'm'),
    chip('R', isFinite(f.tFlight) ? fmt(f.range, 1) : '∞', 'm'),
    chip('θ&nbsp;best', fmt(opt, 0), '°'),
  ].join('');
}

/* ── Render loop ───────────────────────────────────────────────────────── */
function resizeAll() { dirty = true; }
addEventListener('resize', resizeAll);

scene2d.attachControls2D($('scene'), cam2, () => { dirty = true; });
scene3d.attachControls3D($('scene'), cam3, () => { dirty = true; });

/** Draw one complete frame. Split out of the loop so it can be called directly. */
function draw() {
  const opts = { flight: current, compare, t: state.t, show: state };
  if (state.dim === '2d') scene2d.render($('scene'), cam2, opts);
  else scene3d.render($('scene'), cam3, opts);

  for (const spec of graphSpecs(current, state.t)) drawGraph($(spec.canvas), spec);

  renderChips();
  $('scrub').value = current.tMax ? state.t / current.tMax : 0;
  $('t-read').textContent = `t = ${fmt(state.t, 2)} / ${isFinite(current.tFlight) ? fmt(current.tFlight, 2) : '\u221e'} s`;
  dirty = false;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const onStage = $('view-playground').hasAttribute('data-active');

  if (state.playing && onStage) {
    state.t += dt * state.rate;
    if (state.t >= current.tMax) state.t = 0;   // loop the flight
    dirty = true;
  }
  if (dirty && onStage) draw();
  requestAnimationFrame(frame);
}

// Coming back from a hidden tab: the clock jumped, so redraw once.
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  dirty = true;
});

/** Debug handle — open devtools and poke at `SUVAT` to see how it all fits together. */
window.SUVAT = {
  state, cam2, cam3,
  get flight() { return current; },
  redraw() { recompute(); draw(); },
};

/* ── Solver ────────────────────────────────────────────────────────────── */
const entered = { s: '', u: '', v: '', a: '', t: '' };

function buildSolver() {
  $('solve-grid').innerHTML = SYMBOLS.map((k) => `
    <div class="var" data-var="${k}">
      <div class="var-sym">${k}</div>
      <div class="var-name">${NAMES[k]}</div>
      <input type="text" inputmode="decimal" data-key="${k}" placeholder="—" aria-label="${NAMES[k]} in ${UNITS[k]}">
      <div class="var-unit">${UNITS[k]}</div>
    </div>`).join('');

  for (const input of $('solve-grid').querySelectorAll('input')) {
    input.addEventListener('input', (e) => {
      entered[e.target.dataset.key] = e.target.value.trim();
      runSolver();
    });
  }
  // A sensible starting example rather than a blank grid.
  entered.u = '0'; entered.a = '9.81'; entered.t = '3';
  runSolver();
}

function runSolver() {
  const known = {};
  for (const k of SYMBOLS) {
    if (entered[k] === '') continue;
    const v = parseFloat(entered[k]);
    if (isFinite(v)) known[k] = v;
  }

  const res = solve(known);
  const out = $('solve-out');

  for (const k of SYMBOLS) {
    const box = $('solve-grid').querySelector(`[data-var="${k}"]`);
    const input = box.querySelector('input');
    if (entered[k] !== '') {
      input.value = entered[k];
      box.removeAttribute('data-state');
    } else if (res.ok && res.values[k] !== undefined) {
      input.value = fmtNum(res.values[k], 3);
      box.dataset.state = 'solved';
    } else {
      input.value = '';
      box.removeAttribute('data-state');
    }
  }

  if (!res.ok) {
    out.innerHTML = `<div class="alert">${res.error}</div>`;
    return;
  }

  const stepHTML = res.steps.map((st, i) => `
    <div class="step">
      <div class="step-tag">Step ${i + 1} — equation ${st.eq}, the one with no ${NAMES[st.omits]}</div>
      <div class="formula">${st.formula}</div>
      <div class="subst">rearrange &nbsp;→&nbsp; ${st.rearranged}</div>
      <div class="subst">substitute &nbsp;→&nbsp; ${st.substitution}</div>
      <div class="result">${st.target} = ${fmtNum(st.value, 4)} ${UNITS[st.target]}</div>
      ${st.warning ? `<div class="note">${st.warning}</div>` : ''}
    </div>`).join('');

  out.innerHTML = `<div class="steps">${stepHTML}</div>`;
}

/* ── Reference equation list ───────────────────────────────────────────── */
function buildReference() {
  $('eq-list').innerHTML = EQUATIONS.map((e) => `
    <div class="eq">
      <span class="n">${e.id}</span>
      <span class="f">${e.tex}</span>
      <span class="w">${e.note}<br><span style="color:var(--ink-4)">use when ${NAMES[e.missing]} is unknown and unwanted</span></span>
    </div>`).join('');
}

/* ── Boot ──────────────────────────────────────────────────────────────── */
recompute();
buildSolver();
buildReference();
setPlaying(true);
requestAnimationFrame(frame);
