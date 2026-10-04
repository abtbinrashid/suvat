// notation.js — maths set as maths, not as code.
//
// WHY THIS FILE EXISTS
//   Nearly every string on this site is an equation, and an equation written
//   the way a program writes one is not the equation a student meets in an
//   exam. These are the same statement twice:
//
//     as code     (v^2 - u^2)/(2*a)        sqrt(u_y^2 + 2*g*h)      -9.81
//
//                   v² − u²
//     as maths      ───────                √(u_y² + 2gh)            −9.81
//                     2a
//
//   The second one is the subject. The first one is a different subject that
//   happens to share some letters. So the SOURCE stays ASCII — quick to type,
//   clean to diff — and this file is the only place that decides what any of
//   it looks like on screen.
//
// HOW TO USE IT
//   M`(v^2 - u^2)/(2a)`     typeset HTML — stacked fraction, italic variables,
//                           real minus signs, a bar over the radical
//   T`(v^2 - u^2)/(2a)`     the same statement in Unicode alone, for canvas
//                           labels and aria text, where there is no HTML
//   num(-9.81)              a number, typeset: −9.81, ∞, 1.2 × 10⁵
//   signed(-9.81)           the same, bracketed when negative, for substituting
//
// THE SOURCE NOTATION
//   x^2  x^-1  x^{n+1}   superscript        u_y  s_{max}     subscript
//   a/b                  stacked fraction   sqrt(x)          radical, with bar
//   *                    × between numbers  2a, u sin theta  implicit, thin gap
//   -                    a real minus, −    +-               plus-or-minus, ±
//   <=  >=  !=  ~=       ≤ ≥ ≠ ≈            ->               →
//   theta  pi  Delta     Greek letters      inf              ∞
//   [m s^-2]             a unit — upright, never italic
//   "at the top"         prose inside an equation — upright
//   °                    degrees, set tight against the number
//
//   Interpolate NUMBERS into the templates, not prose: the source is parsed,
//   so `${num(x)}` is read as a number and typeset like one.
//
//   The rule this file exists to keep, and the reasoning behind each choice,
//   is design/notation.md. test/notation.test.mjs proves that nothing the app
//   can put on screen still contains programmer's maths.

/* ── glyphs ─────────────────────────────────────────────────────────── */

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε',
  eta: 'η', theta: 'θ', Theta: 'Θ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π',
  rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', Phi: 'Φ',
  omega: 'ω', Omega: 'Ω',
};

// Function names are upright — sin, not sin. That is not a typographic whim:
// an italic s·i·n reads as three variables multiplied together.
const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'cot',
                       'arcsin', 'arccos', 'arctan', 'ln', 'log', 'exp']);

const VULGAR = new Set(['½', '¼', '¾', '⅓', '⅔', '⅕', '⅖', '⅗', '⅘', '⅙', '⅛']);

const SUPERS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷',
  8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ' };
const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇',
  8: '₈', 9: '₉', '+': '₊', '−': '₋', '-': '₋', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ',
  o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };

// Superscripts written straight into the source — 'u²' — are read back.
const SUP_BACK = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ⁱ': 'i' };
const SUB_BACK = Object.fromEntries(Object.entries(SUBS).map(([k, v]) => [v, k]));

const REL = new Set(['=', '≤', '≥', '≠', '≈', '<', '>', '→', '≡']);
const ADD = new Set(['+', '−', '±', '∓']);
const MUL = new Set(['×', '·']);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── numbers ────────────────────────────────────────────────────────── */

/**
 * A number, typeset. Hyphen-minus is a hyphen; a minus sign is U+2212, and
 * the difference is visible at any size. Very large and very small values go
 * to standard form rather than to a programmer's 1.2e+5.
 *
 * @param {number} x
 * @param {number} dp   decimal places
 * @param {{trim?:boolean}} opts  trim: drop trailing zeros (9.80 → 9.8)
 */
export function num(x, dp = 2, { trim = false } = {}) {
  if (typeof x !== 'number' || Number.isNaN(x)) return '—';
  if (!isFinite(x)) return x < 0 ? '−∞' : '∞';
  if (x !== 0 && (Math.abs(x) >= 1e5 || Math.abs(x) < 1e-4)) return standardForm(x, 3);
  const body = trim ? String(Number(x.toFixed(dp))) : x.toFixed(dp);
  return body.replace('-', '−');
}

/** Bracketed when negative, so a substitution never shows a stray double minus. */
export function signed(x, dp = 2, opts) {
  const s = num(x, dp, opts);
  return s.startsWith('−') ? `(${s})` : s;
}

function standardForm(x, sig) {
  const [m, e] = x.toExponential(sig).split('e');
  return `${m.replace('-', '−')} × 10${toSuper(String(Number(e)))}`;
}

const toSuper = (s) => [...s].map((c) => SUPERS[c] ?? c).join('');
const toSub = (s) => [...s].map((c) => SUBS[c] ?? c).join('');

/* ── the public renderers ───────────────────────────────────────────── */

// The working panel is rebuilt on every animation frame, and the substituted
// numbers mean a fresh string each time, so the cache is capped rather than
// grown: it pays for the formulae, which repeat, and forgets the substitutions.
const CACHE_MAX = 600;
function cached(store, src, make) {
  const hit = store.get(src);
  if (hit !== undefined) return hit;
  if (store.size > CACHE_MAX) store.clear();
  const out = make(src);
  store.set(src, out);
  return out;
}
const htmlCache = new Map(), textCache = new Map();

/** Typeset HTML. Wrap once; nest freely inside prose. */
export function mathHTML(src) {
  return cached(htmlCache, src, (x) => `<span class="m">${renderHTML(parse(x))}</span>`);
}

/** Unicode only — canvas labels and aria text, where HTML cannot reach. */
export function mathText(src) {
  return cached(textCache, src, (x) => renderText(parse(x)));
}

/** Tagged templates: M`...` for HTML, T`...` for Unicode. */
export const M = (strings, ...vals) => mathHTML(weave(strings, vals));
export const T = (strings, ...vals) => mathText(weave(strings, vals));

const weave = (strings, vals) => strings.reduce((a, s, i) => a + vals[i - 1] + s);

/* ── reading the source ─────────────────────────────────────────────── */

function lex(src) {
  const s = String(src);
  const out = [];
  let i = 0;
  const fail = (why) => { throw new Error(`notation: ${why} in "${s}"`); };

  while (i < s.length) {
    const c = s[i];

    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }

    // [ … ] a unit, kept upright
    if (c === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) fail('unclosed [');
      out.push({ k: 'unit', v: s.slice(i + 1, j) }); i = j + 1; continue;
    }
    // " … " prose inside an equation, kept upright
    if (c === '"') {
      const j = s.indexOf('"', i + 1);
      if (j < 0) fail('unclosed "');
      out.push({ k: 'text', v: s.slice(i + 1, j) }); i = j + 1; continue;
    }

    if (c === '∞') { out.push({ k: 'num', v: '∞' }); i++; continue; }
    if (VULGAR.has(c)) { out.push({ k: 'num', v: c }); i++; continue; }
    if (c === '—' || c === '–') { out.push({ k: 'text', v: c }); i++; continue; }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+\-−]?[0-9]+)?/.exec(s.slice(i));
      out.push(numToken(m[0])); i += m[0].length; continue;
    }

    // u² written straight into the source, and u_x likewise
    if (SUP_BACK[c]) {
      let run = '';
      while (i < s.length && SUP_BACK[s[i]]) { run += SUP_BACK[s[i]]; i++; }
      out.push({ k: 'sup', v: run }); continue;
    }
    if (SUB_BACK[c]) {
      let run = '';
      while (i < s.length && SUB_BACK[s[i]]) { run += SUB_BACK[s[i]]; i++; }
      out.push({ k: 'sub', v: run }); continue;
    }

    if (c === '^' || c === '_') {
      const kind = c === '^' ? 'sup' : 'sub';
      i++;
      if (s[i] === '{') {
        const j = s.indexOf('}', i);
        if (j < 0) fail(`unclosed { after ${kind === 'sup' ? '^' : '_'}`);
        out.push({ k: kind, v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      const m = /^[+\-−]?[0-9]+|^[A-Za-z][A-Za-z0-9]*/.exec(s.slice(i));
      if (!m) fail(`nothing follows ${kind === 'sup' ? '^' : '_'}`);
      out.push({ k: kind, v: m[0] }); i += m[0].length; continue;
    }

    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z][A-Za-z0-9]*/.exec(s.slice(i));
      const w = m[0]; i += w.length;
      if (w === 'sqrt') out.push({ k: 'sqrt' });
      else if (w === 'abs') out.push({ k: 'abs' });
      else if (w === 'inf') out.push({ k: 'num', v: '∞' });
      else if (GREEK[w]) out.push({ k: 'name', v: GREEK[w], greek: true });
      else if (FUNCS.has(w)) out.push({ k: 'fn', v: w });
      else out.push({ k: 'name', v: w });
      continue;
    }

    const two = s.slice(i, i + 2);
    const PAIRS = { '<=': '≤', '>=': '≥', '!=': '≠', '~=': '≈', '->': '→', '+-': '±', '-+': '∓' };
    if (PAIRS[two]) { out.push({ k: 'op', v: PAIRS[two] }); i += 2; continue; }

    const ONE = {
      '+': '+', '-': '−', '−': '−', '±': '±', '∓': '∓',
      '*': '×', '×': '×', '·': '·',
      '=': '=', '<': '<', '>': '>', '≤': '≤', '≥': '≥', '≠': '≠', '≈': '≈',
      '→': '→', ',': ',',
    };
    if (ONE[c]) { out.push({ k: 'op', v: ONE[c] }); i++; continue; }

    if (c === '/') { out.push({ k: 'div' }); i++; continue; }
    if (c === '√') { out.push({ k: 'sqrt' }); i++; continue; }
    if (c === '°') { out.push({ k: 'deg' }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ k: c === '(' ? 'open' : 'close', paren: true }); i++; continue; }
    if (c === '{' || c === '}') { out.push({ k: c === '{' ? 'open' : 'close', paren: false }); i++; continue; }

    fail(`cannot read "${c}"`);
  }
  return out;
}

function numToken(raw) {
  const m = /^([0-9]*\.?[0-9]+)[eE]([+\-−]?[0-9]+)$/.exec(raw);
  if (m) return { k: 'num', v: m[1], exp: String(Number(m[2].replace('−', '-'))) };
  return { k: 'num', v: raw };
}

/* ── the shape of the statement ─────────────────────────────────────── */

const peek = (p) => p.ts[p.i];
const next = (p) => p.ts[p.i++];

function parse(src) {
  const p = { ts: lex(src), i: 0, src };
  const node = relation(p);
  if (p.i < p.ts.length) throw new Error(`notation: "${src}" does not read as one statement`);
  return node;
}

function row(items) { return items.length === 1 ? items[0] : { k: 'row', items }; }

function relation(p) {
  const items = [];
  // A continuation line may open with the relation it continues — `= 39.6`,
  // `-> t = 2.4` — which is how working is written down the page.
  const lead = peek(p);
  if (lead && lead.k === 'op' && REL.has(lead.v)) {
    next(p); items.push({ k: 'op', v: lead.v, rel: true, lead: true });
  }
  items.push(sum(p));
  for (;;) {
    const t = peek(p);
    if (t && t.k === 'op' && (REL.has(t.v) || t.v === ',')) {
      next(p);
      items.push({ k: 'op', v: t.v, rel: REL.has(t.v), comma: t.v === ',' });
      items.push(sum(p));
      continue;
    }
    break;
  }
  return row(items);
}

function sum(p) {
  const items = [];
  const lead = peek(p);
  if (lead && lead.k === 'op' && ADD.has(lead.v)) { next(p); items.push({ k: 'op', v: lead.v, unary: true }); }
  items.push(product(p));
  for (;;) {
    const t = peek(p);
    if (t && t.k === 'op' && ADD.has(t.v)) {
      next(p); items.push({ k: 'op', v: t.v }); items.push(factor(p, product));
      continue;
    }
    break;
  }
  return row(items);
}

// Every number in this app comes out of the physics, so any of them may arrive
// negative. An operator followed by a sign gets brackets round the sign —
// 3 − (−5), the way it is written by hand — rather than the double minus a
// program would print.
function factor(p, inner) {
  const sign = peek(p);
  if (sign && sign.k === 'op' && ADD.has(sign.v)) {
    next(p);
    return { k: 'group', paren: true,
             body: row([{ k: 'op', v: sign.v, unary: true }, inner(p)]) };
  }
  return inner(p);
}

// A solidus becomes a stacked fraction. Everything gathered so far at this
// level goes above the bar, the next single factor goes below — which is why
// `2s/t` sets as 2s over t, and why a compound denominator is written in
// brackets: `(v^2 - u^2)/(2a)`.
function product(p) {
  let items = [power(p)];
  for (;;) {
    const t = peek(p);
    if (!t) break;
    if (t.k === 'div') {
      next(p);
      items = [{ k: 'frac', num: row(items), den: factor(p, power) }];
      continue;
    }
    if (t.k === 'op' && MUL.has(t.v)) {
      next(p); items.push({ k: 'op', v: t.v, mul: true }); items.push(factor(p, power)); continue;
    }
    if (startsFactor(t)) { items.push(power(p)); continue; }   // implicit: 2as
    break;
  }
  return row(items);
}

const startsFactor = (t) => ['num', 'name', 'fn', 'sqrt', 'abs', 'unit', 'text'].includes(t.k)
  || (t.k === 'open');

function power(p) {
  let a = atom(p);
  for (;;) {
    const t = peek(p);
    if (t && t.k === 'sub') { next(p); a = { k: 'idx', base: a, idx: t.v }; continue; }
    if (t && t.k === 'sup') { next(p); a = { k: 'pow', base: a, exp: t.v }; continue; }
    if (t && t.k === 'deg') { next(p); a = { k: 'deg', base: a }; continue; }
    break;
  }
  return a;
}

function atom(p) {
  const t = next(p);
  if (!t) throw new Error(`notation: "${p.src}" ends too early`);
  switch (t.k) {
    case 'num':  return { k: 'num', v: t.v, exp: t.exp };
    case 'unit': return { k: 'unit', v: t.v };
    case 'text': return { k: 'text', v: t.v };
    case 'name': return { k: 'var', v: t.v, greek: t.greek };
    case 'open': {
      const body = relation(p);
      const close = next(p);
      if (!close || close.k !== 'close') throw new Error(`notation: unclosed bracket in "${p.src}"`);
      return { k: 'group', body, paren: t.paren };
    }
    case 'sqrt': {
      // The bar over the radicand replaces the brackets — that is what it is for.
      const inner = power(p);
      return { k: 'sqrt', body: inner.k === 'group' && inner.paren ? inner.body : inner };
    }
    case 'abs': {
      const inner = power(p);
      return { k: 'abs', body: inner.k === 'group' && inner.paren ? inner.body : inner };
    }
    case 'fn': {
      let exp = null;
      const nx = peek(p);
      if (nx && nx.k === 'sup') { next(p); exp = nx.v; }
      return { k: 'fn', name: t.v, exp, arg: power(p) };
    }
    default:
      throw new Error(`notation: "${t.v ?? t.k}" cannot start a term in "${p.src}"`);
  }
}

/**
 * Implicit multiplication: 2a is set tight, u sin θ is set with a gap. The
 * difference is the one a textbook makes — a numeral binds to what follows it,
 * everything else gets air so two symbols never read as one word.
 */
function gapNeeded(a, b) {
  const core = (n) => (n.k === 'pow' || n.k === 'idx' || n.k === 'deg' ? core(n.base) : n.k);
  const ka = core(a), kb = core(b);
  if (ka === 'num' && (kb === 'num' || kb === 'var' || kb === 'group')) return false;
  return true;
}

/** Strip brackets that a fraction bar or a radical bar has made redundant. */
const bare = (n) => (n.k === 'group' && n.paren ? n.body : n);

/* ── HTML ───────────────────────────────────────────────────────────── */

function renderHTML(n) {
  switch (n.k) {
    case 'row': {
      let out = '';
      n.items.forEach((it, i) => {
        const prev = n.items[i - 1];
        if (i > 0 && it.k !== 'op' && prev.k !== 'op' && gapNeeded(prev, it)) {
          out += '<span class="m-sp"></span>';
        }
        out += renderHTML(it);
      });
      return out;
    }
    case 'op': {
      const cls = ['m-op'];
      if (n.unary) cls.push('m-un');
      if (n.mul) cls.push('m-mul');
      if (n.rel) cls.push('m-rel');
      if (n.comma) cls.push('m-comma');
      if (n.lead) cls.push('m-lead');
      return `<span class="${cls.join(' ')}">${esc(n.v)}</span>`;
    }
    case 'num':
      return n.exp
        ? `<span class="m-num">${esc(n.v)}</span><span class="m-op m-mul">×</span><span class="m-num">10</span><sup class="m-sup">${esc(n.exp.replace('-', '−'))}</sup>`
        : `<span class="m-num">${esc(n.v)}</span>`;
    case 'var':
      return `<i class="m-var">${esc(n.v)}</i>`;
    case 'unit':
      return `<span class="m-unit">${unitHTML(n.v)}</span>`;
    case 'text':
      return `<span class="m-txt">${esc(n.v)}</span>`;
    case 'group':
      return n.paren
        ? `<span class="m-par">(</span>${renderHTML(n.body)}<span class="m-par">)</span>`
        : renderHTML(n.body);
    case 'pow':
      return `${renderHTML(n.base)}<sup class="m-sup">${renderHTML(parse(n.exp))}</sup>`;
    case 'idx':
      return `${renderHTML(n.base)}<sub class="m-sub">${renderHTML(parse(n.idx))}</sub>`;
    case 'deg':
      return `${renderHTML(n.base)}<span class="m-deg">°</span>`;
    case 'fn':
      return `<span class="m-fn">${esc(n.name)}</span>`
        + (n.exp ? `<sup class="m-sup">${renderHTML(parse(n.exp))}</sup>` : '')
        + `<span class="m-sp"></span>${renderHTML(n.arg)}`;
    case 'abs':
      return `<span class="m-bar">|</span>${renderHTML(n.body)}<span class="m-bar">|</span>`;
    case 'sqrt':
      return `<span class="m-sqrt"><span class="m-radix">√</span>`
        + `<span class="m-rad">${renderHTML(bare(n.body))}</span></span>`;
    case 'frac':
      return `<span class="m-frac"><span class="m-fnum">${renderHTML(bare(n.num))}</span>`
        + `<span class="m-fden">${renderHTML(bare(n.den))}</span></span>`;
    default:
      throw new Error(`notation: nothing to draw for ${n.k}`);
  }
}

// m s^-2 → m s⁻², and a unit already written with superscripts passes through.
function unitHTML(body) {
  return esc(body).replace(/\^\{([^}]*)\}|\^([+\-−]?[0-9A-Za-z]+)/g,
    (_, a, b) => `<sup class="m-sup">${(a ?? b).replace('-', '−')}</sup>`);
}
function unitText(body) {
  return body.replace(/\^\{([^}]*)\}|\^([+\-−]?[0-9A-Za-z]+)/g,
    (_, a, b) => toSuper((a ?? b).replace('-', '−')));
}

/* ── Unicode ────────────────────────────────────────────────────────── */

const THIN = ' ';          // the gap between implicit factors
const SOLIDUS = '⁄';       // a fraction slash, not a division sign

function renderText(n) {
  switch (n.k) {
    case 'row': {
      let out = '';
      n.items.forEach((it, i) => {
        const prev = n.items[i - 1];
        if (i > 0) {
          if (it.k === 'op') out += (it.unary || it.comma) ? '' : ' ';
          else if (prev.k === 'op') out += prev.unary ? '' : ' ';
          else out += gapNeeded(prev, it) ? THIN : '';
        }
        out += renderText(it);
      });
      return out;
    }
    case 'op': return n.comma ? ',' : n.v;
    case 'num': return n.exp ? `${n.v} × 10${toSuper(n.exp.replace('-', '−'))}` : n.v;
    case 'var': return n.v;
    case 'unit': return unitText(n.v);
    case 'text': return n.v;
    case 'group': return n.paren ? `(${renderText(n.body)})` : renderText(n.body);
    case 'pow': return renderText(n.base) + toSuper(renderText(parse(n.exp)));
    case 'idx': return renderText(n.base) + toSub(renderText(parse(n.idx)));
    case 'deg': return `${renderText(n.base)}°`;
    case 'fn':  return `${n.name}${n.exp ? toSuper(renderText(parse(n.exp))) : ''}${THIN}${renderText(n.arg)}`;
    case 'abs': return `|${renderText(n.body)}|`;
    // Without a bar to draw, the radicand keeps its brackets.
    case 'sqrt': return `√(${renderText(bare(n.body))})`;
    case 'frac': return `${wrap(n.num)}${SOLIDUS}${wrap(n.den)}`;
    default: throw new Error(`notation: nothing to write for ${n.k}`);
  }
}

// A fraction bar groups everything it spans; a slash groups nothing, so the
// brackets the bar made redundant have to come back. `2s⁄t` is safe — a numeral
// and a symbol read as one product — but anything with a sign or a trig
// function in it is not, and gets its brackets.
function wrap(n) {
  const b = bare(n);
  const loose = b.k === 'frac'
    || (b.k === 'row' && b.items.some((x) => (x.k === 'op' && !x.unary && !x.mul) || x.k === 'fn'));
  const text = renderText(b);
  return loose ? `(${text})` : text;
}
