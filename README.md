# SUVAT

An interactive projectile-motion playground for A-level physics and maths.

**Live:** https://abtbinrashid.github.io/suvat/

We use the SUVAT equations constantly but rarely *see* the thing they describe.
This is the projectile, the elapsed time, the acceleration and the velocity, all
on screen and all adjustable.

## Why another one

Most projectile simulators are built for undergraduate work: drag coefficients,
air density, wind, spin. At A-level none of that is in the specification, and
switching it on makes the equations stop matching the picture.

This one commits to the idealised model instead:

- no air resistance, no wind
- uniform, vertical gravity
- point mass, no spin
- flat ground

Which means every number on screen is *exactly* what the equations predict —
that is the point.

## What's in it

**Playground** — the projectile side on, the way a textbook draws it. Sliders
for launch speed, angle, height and gravity. Velocity resolved into components,
greatest height and range marked, and equal-Δt ghost marks whose spacing shows
horizontal velocity staying constant while vertical velocity changes.

**Graphs** — displacement–time, velocity–time and acceleration–time, sharing one
time cursor with the animation. The area under each curve is shaded live, so
"area under v–t is displacement" is something you watch rather than memorise.

**Solver** — enter any three of s, u, v, a, t. It picks the equation that omits
what you don't know, rearranges it, substitutes, and shows every step. Where a
± root or a quadratic gives two answers, it says so instead of quietly choosing.

**Reference** — the five equations, when each applies, and the projectile
results derived from them.

Everything with an equation in it is *typeset*: fractions stack over a bar,
roots get a vinculum, quantities are italic and units are upright. Nothing on
screen is written the way a program writes maths — see
[`design/notation.md`](design/notation.md).

## Running it locally

```bash
node dev-server.mjs
```

Then open http://localhost:4173. No build step, no dependencies — HTML, CSS and
ES modules.

```bash
node test/engine.test.mjs      # 26 checks on the physics
node test/solve.test.mjs       # 87 checks on partial information
node test/question.test.mjs    # 36 checks on the question reader
node test/notation.test.mjs    # 38 checks that no computer maths reaches a student
```

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
js/core/projectile.js   the idealised projectile model
js/core/question.js     exam question -> engine parameters
js/render/             the scene, the graphs, canvas helpers
worker/                 Cloudflare Worker for reading a photo of a question
design/                 tokens, notation, scenario research, preset list
```

Four rules worth knowing before editing — the long form is in
[`CLAUDE.md`](CLAUDE.md):

1. **Maths is set as maths, never as code.** No `^2`, no `sqrt`, no `*`, no `/`
   for a division, no `-9.81` with a hyphen. Every formula and every number goes
   through `js/notation.js`, which is the only thing that decides what a symbol
   looks like. `node test/notation.test.mjs` sweeps everything the app can
   display and fails on any of it.
2. **Colour is the quantity, dash is the direction.** Velocity, displacement and
   acceleration each have a hue; horizontal components are dashed and vertical
   ones solid. The three hues are validated for colour blindness — see
   `design/theme.js` before changing any of them.
3. **13px is the floor**, canvas labels included. Canvas text ignores CSS, so
   it is enforced by hand in `js/render/util.js`. Indices are the one exception,
   and they have a floor of their own in `css/math.css`.
4. **The engine calculates; nothing else does.** The working panel and the
   question reader both display what `js/core/` computed.

## Credits

Built by abtbinrashid.
