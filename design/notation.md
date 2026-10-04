# Maths is set as maths

This site teaches with equations. An equation written the way a program writes
one is not the equation a student meets in an exam — it is a different notation
that happens to share some letters, and a student reading it has to translate
before they can learn anything.

So: **no computer maths reaches the screen.** Not `^2`, not `sqrt`, not `*`, not
`/` for a division, not `<=`, not `u_y`, not `-9.81` with a hyphen, not `1.2e+5`.

The same statement, twice:

```
as code      (v^2 - u^2)/(2*a)       sqrt(u_y^2 + 2*g*h)       a = -9.81
```

&nbsp;&nbsp;&nbsp;&nbsp;as maths&nbsp;&nbsp;&nbsp;&nbsp;
<i>v</i>² − <i>u</i>² over 2<i>a</i>, as a stacked fraction &nbsp;·&nbsp;
√ with a bar over <i>u</i><sub>y</sub>² + 2<i>gh</i> &nbsp;·&nbsp;
<i>a</i> = −9.81

## How it works

One module does all of it: [`js/notation.js`](../js/notation.js). It is the only
thing in the codebase that decides what a symbol looks like.

```js
import { M, T, num, signed } from './notation.js';

M`(v^2 - u^2)/(2a)`           // typeset HTML — a stacked fraction
T`(v^2 - u^2)/(2a)`           // Unicode alone — for canvas and aria text
num(-9.81)                    // −9.81   (a minus sign, not a hyphen)
signed(-9.81)                 // (−9.81) — bracketed, ready to substitute
```

The **source** stays ASCII, because ASCII is quick to type and clean to diff.
The **output** is typeset. Authors never write a glyph; they write the structure
and let the module set it.

| write | get |
|---|---|
| `x^2`  `x^-1`  `x^{n+1}` | superscript |
| `u_y`  `s_{max}` | subscript |
| `a/b` | a stacked fraction, with a bar |
| `sqrt(x)` | a radical, with a vinculum — so the brackets go away |
| `abs(x)` | \|x\| |
| `*` | × |
| `2a`, `u sin theta` | implicit multiplication, set with the right gap |
| `-` | − (U+2212) |
| `+-` | ± |
| `<=` `>=` `!=` `~=` `->` | ≤ ≥ ≠ ≈ → |
| `theta` `pi` `Delta` | θ π Δ |
| `inf` | ∞ |
| `°` | degrees, tight against the number |
| `[m s^-2]` | a unit — upright, never italic |
| `"at the top"` | prose inside an equation — upright |

Interpolate **numbers**, not prose: `M\`t = ${num(x)} [s]\``. The source is
parsed, so an interpolated number is read as a number and typeset as one.

## The three typographic rules behind it

1. **Quantities are italic, units and function names are upright.** That is
   ISO 80000-2, and it is not decoration: an italic `sin` reads as three
   variables multiplied together, and an upright `m` is a metre rather than a
   mass. The module enforces it, so nobody has to remember.
2. **A fraction is stacked.** `(v^2 - u^2)/(2a)` on one line is a row of
   punctuation to be decoded. Over a bar it is two short rows the eye takes in
   at once. This is the single biggest difference between the two notations.
3. **A radical has a bar.** The bar is what says where the root ends, which is
   why `√(u² + 2gh)` needs no brackets once it is drawn properly.

The maths is also set in a **serif** face while the interface is sans — see
`--font-math` in [`css/math.css`](../css/math.css). An equation is a quotation
from another language, and a textbook changes face for exactly that reason. It
also buys a true italic, which the interface font does not reliably ship.

## Where the rule is enforced

[`test/notation.test.mjs`](../test/notation.test.mjs) does two things. It checks
the module against a table of known-good output, and then it **sweeps everything
the app can display** — every one of the five equations, every rearrangement the
solver can reach, every row of the working panel across eight scenarios and four
instants each, every line the engine says back on screen two — and fails if any
of it contains programmer's maths.

```bash
node test/notation.test.mjs
```

Add a new formula through `` M`` `` and the sweep covers it with no new test.
Add one as a raw string and the sweep fails. That is the point: the rule is not
a convention anybody has to remember, it is a test.

## Two limits, stated

- **Canvas has no HTML.** `T``  ` falls back to Unicode, which has no stacked
  fraction and no vinculum, so it writes `(v² − u²)⁄2a` and `√(…)` with the
  brackets kept. That is still maths, not code.
- **Unicode has no subscript `y`.** So subscripted symbols belong in HTML, and
  canvas labels use words instead — "vertical", not `v_y`. They already do, and
  the sweep keeps them honest.
