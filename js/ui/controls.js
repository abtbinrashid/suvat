// controls.js — builds the left-hand panel from a declarative spec.
//
// Every control is described as data, then rendered once. Adding a slider is a
// one-line change to PANEL below, not a new block of HTML plus a new listener.

export const PANEL = [
  {
    title: 'Launch',
    fields: [
      { key: 'u',     sym: 'u', name: 'launch speed',     min: 0,   max: 100, step: 0.5, unit: 'm s⁻¹' },
      { key: 'theta', sym: 'θ', name: 'angle of elevation', min: -90, max: 90, step: 1,   unit: '°' },
      { key: 'h',     sym: 'h', name: 'launch height',     min: 0,   max: 120, step: 0.5, unit: 'm' },
    ],
  },
  {
    title: 'Gravitational field',
    segment: {
      key: 'body',
      options: [
        { value: 'earth',   label: 'Earth' },
        { value: 'moon',    label: 'Moon' },
        { value: 'mars',    label: 'Mars' },
        { value: 'jupiter', label: 'Jupiter' },
        { value: 'zero',    label: '0g' },
      ],
    },
    fields: [
      { key: 'g', sym: 'g', name: 'field strength', min: 0, max: 25, step: 0.01, unit: 'm s⁻²' },
    ],
  },
  {
    title: 'Bearing — 3D only',
    fields: [
      { key: 'azimuth', sym: 'φ', name: 'compass bearing', min: 0, max: 360, step: 1, unit: '°' },
    ],
  },
  {
    title: 'Compare a second angle',
    check: { key: 'compareOn', label: 'Overlay a second launch' },
    fields: [
      { key: 'theta2', sym: 'θ₂', name: 'second angle', min: -90, max: 90, step: 1, unit: '°', dependsOn: 'compareOn' },
    ],
  },
  {
    title: 'Show',
    toggles: [
      { key: 'trace',      label: 'Trajectory' },
      { key: 'ticks',      label: 'Equal Δt marks' },
      { key: 'velocity',   label: 'Velocity vector' },
      { key: 'components', label: 'Components' },
      { key: 'apex',       label: 'Greatest height' },
      { key: 'range',      label: 'Range' },
      { key: 'shadow',     label: 'Ground track' },
      { key: 'gravity',    label: 'Weight arrow' },
      { key: 'grid',       label: 'Grid' },
      { key: 'axes',       label: 'Axes' },
    ],
  },
];

export const PRESETS = [
  { id: 'classic',   name: 'Classic 45°',      hint: 'maximum range on level ground', set: { u: 25, theta: 45, h: 0, g: 9.81 } },
  { id: 'drop',      name: 'Dropped',          hint: 'u = 0, straight down',          set: { u: 0,  theta: 0,  h: 45, g: 9.81 } },
  { id: 'cliff',     name: 'Off a cliff',      hint: 'horizontal from a height',      set: { u: 18, theta: 0,  h: 60, g: 9.81 } },
  { id: 'vertical',  name: 'Straight up',      hint: 'θ = 90°, one dimension',        set: { u: 30, theta: 90, h: 0, g: 9.81 } },
  { id: 'complement',name: 'Complementary',    hint: '30° and 60° — same range',      set: { u: 28, theta: 30, h: 0, g: 9.81, compareOn: true, theta2: 60 } },
  { id: 'moon',      name: 'On the Moon',      hint: 'same throw, g = 1.62',          set: { u: 25, theta: 45, h: 0, g: 1.62, body: 'moon' } },
];

const svgTick = '<span class="box"></span>';

/** Render the whole panel into `root`, wiring every control to `state`. */
export function buildPanel(root, state, onChange) {
  const refs = {};
  root.innerHTML = '';

  for (const group of PANEL) {
    const sec = el('section', 'group');
    sec.append(el('h2', 'group-title', group.title));

    if (group.check) {
      sec.append(checkbox(group.check, state, refs, onChange));
    }

    if (group.segment) {
      const seg = el('div', 'seg');
      seg.setAttribute('role', 'group');
      for (const opt of group.segment.options) {
        const b = el('button', null, opt.label);
        b.type = 'button';
        b.dataset.value = opt.value;
        b.setAttribute('aria-pressed', String(state[group.segment.key] === opt.value));
        b.addEventListener('click', () => {
          state[group.segment.key] = opt.value;
          onChange(group.segment.key);
        });
        seg.append(b);
      }
      refs[group.segment.key] = seg;
      sec.append(seg);
      sec.append(el('div', null, '', { style: 'height:var(--sp-4)' }));
    }

    for (const f of group.fields || []) sec.append(slider(f, state, refs, onChange));

    if (group.toggles) {
      const grid = el('div', 'toggles');
      for (const t of group.toggles) grid.append(checkbox({ ...t, showKey: true }, state, refs, onChange));
      sec.append(grid);
    }
    root.append(sec);
  }

  // Presets last — they write several values at once.
  const psec = el('section', 'group');
  psec.append(el('h2', 'group-title', 'Presets'));
  const pg = el('div', 'presets');
  for (const p of PRESETS) {
    const b = el('button', 'preset');
    b.type = 'button';
    b.innerHTML = `<b></b><span></span>`;
    b.querySelector('b').textContent = p.name;
    b.querySelector('span').textContent = p.hint;
    b.addEventListener('click', () => {
      Object.assign(state, p.set);
      onChange('preset');
    });
    pg.append(b);
  }
  psec.append(pg);
  root.append(psec);

  return {
    refs,
    /** Push state back into the DOM — used after presets and keyboard nudges. */
    sync() {
      for (const [key, node] of Object.entries(refs)) {
        if (node.classList?.contains('seg')) {
          for (const b of node.children) b.setAttribute('aria-pressed', String(state[key] === b.dataset.value));
        } else if (node.range) {
          node.range.value = state[key];
          node.number.value = round(state[key], node.step);
          if (node.dependsOn) node.wrap.style.opacity = state[node.dependsOn] ? '1' : '0.4';
        } else if (node.type === 'checkbox') {
          node.checked = !!state[key];
        }
      }
    },
  };
}

function slider(f, state, refs, onChange) {
  const wrap = el('div', 'field');
  const head = el('div', 'field-head');
  head.append(el('span', 'field-sym', f.sym));
  head.append(el('span', 'field-name', f.name));

  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'field-val';
  num.min = f.min; num.max = f.max; num.step = f.step;
  num.value = round(state[f.key], f.step);
  num.setAttribute('aria-label', `${f.name} in ${f.unit}`);
  head.append(num);
  head.append(el('span', 'field-unit', f.unit));
  wrap.append(head);

  const range = document.createElement('input');
  range.type = 'range';
  range.min = f.min; range.max = f.max; range.step = f.step;
  range.value = state[f.key];
  range.tabIndex = -1;                       // the number box is the a11y target
  range.setAttribute('aria-hidden', 'true');
  wrap.append(range);

  const commit = (raw, fromRange) => {
    let v = parseFloat(raw);
    if (!isFinite(v)) return;
    v = Math.min(f.max, Math.max(f.min, v));
    state[f.key] = v;
    if (fromRange) num.value = round(v, f.step); else range.value = v;
    onChange(f.key);
  };
  range.addEventListener('input', (e) => commit(e.target.value, true));
  num.addEventListener('input', (e) => commit(e.target.value, false));

  refs[f.key] = { range, number: num, step: f.step, wrap, dependsOn: f.dependsOn };
  if (f.dependsOn) wrap.style.opacity = state[f.dependsOn] ? '1' : '0.4';
  return wrap;
}

function checkbox(c, state, refs, onChange) {
  const lab = el('label', 'chk');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!state[c.key];
  input.addEventListener('change', () => { state[c.key] = input.checked; onChange(c.key); });
  lab.append(input);
  lab.insertAdjacentHTML('beforeend', svgTick);
  lab.append(document.createTextNode(c.label));
  refs[c.key] = input;
  return lab;
}

function el(tag, cls, text, attrs) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function round(v, step) {
  const dp = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number(v).toFixed(dp);
}
