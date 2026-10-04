# SUVAT — house rules

An interactive projectile-motion playground for A-level physics and maths.
No build step, no dependencies: HTML, CSS and ES modules. `node dev-server.mjs`,
then http://localhost:4173.

Read these four before editing anything. They are the rules the codebase is
already keeping, and breaking one of them is a regression even when the tests
are silent.

### 1 · Maths is set as maths, never as code

No computer maths reaches the screen: no `^2`, no `sqrt`, no `*`, no `/` for a
division, no `<=`, no `u_y`, no `-9.81` written with a hyphen.

Every formula, rearrangement, substitution and number goes through
**[`js/notation.js`](js/notation.js)** — the only thing in the codebase that
decides what a symbol looks like:

```js
import { M, T, num, signed } from './notation.js';

M`(v^2 - u^2)/(2a)`    // typeset HTML: a stacked fraction, italic quantities
T`sqrt(u^2 + 2gh)`     // Unicode alone, for canvas labels and aria text
num(-9.81)             // −9.81, with a minus sign
signed(-9.81)          // (−9.81), bracketed and ready to substitute
```

Write the source the easy way and let the module set it. Interpolate numbers,
not prose. A sink that receives it must use `innerHTML`, not `textContent`.
Prose stays prose — a sentence with a quantity in it is not an equation.

The notation, the reasoning and the two stated limits:
**[`design/notation.md`](design/notation.md)**.
Enforced by **`node test/notation.test.mjs`**, which sweeps everything the app
can display and fails on any of it. Add a formula through `` M`` `` and the
sweep covers it for free; add one as a raw string and the sweep fails.

### 2 · Colour is the quantity, dash is the direction

Velocity, displacement and acceleration each have a hue; horizontal components
are dashed and vertical ones solid. The hues are validated together for colour
blindness — read `design/theme.js` before changing any of them, and re-run the
check.

### 3 · 13px is the floor, canvas labels included

Canvas text ignores CSS, so the floor is enforced by hand in
`js/render/util.js`. A teacher at the back of the room is the test.

### 4 · The engine calculates; nothing else does

`js/core/` computes. The working panel, the resolve card and the question reader
display what it computed, and claim nothing it did not.

## Layout

```
index.html              one screen; the scenario picker is a dropdown
css/tokens.css          design system — colours, type, spacing
css/app.css             laptop-first three-column layout
css/math.css            how a typeset equation looks
js/notation.js          maths set as maths — the source notation and its output
js/scenarios.js         the scenarios, as data
js/working.js           the working out, with real numbers substituted
js/core/suvat.js        the five equations and a solver that shows its working
js/core/solve.js        what the student knows -> the motion, or a reason why not
js/core/projectile.js   the idealised projectile model
js/core/question.js     exam question -> engine parameters
js/render/              the scene, the graphs, canvas helpers
js/world/               the stadium and the district round it
worker/                 Cloudflare Worker for reading a photo of a question
design/                 tokens, notation, scenario research, preset list
```

## Tests

```bash
node test/engine.test.mjs       # the physics
node test/solve.test.mjs        # what the engine does with partial information
node test/question.test.mjs     # the question reader
node test/notation.test.mjs     # that no computer maths reaches a student
```
