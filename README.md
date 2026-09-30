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

**Playground** — the projectile in 2D and 3D. Sliders for launch speed, angle,
height, gravity and bearing. Velocity resolved into components, greatest height
and range marked, and equal-Δt ghost marks whose spacing shows horizontal
velocity staying constant while vertical velocity changes.

**Graphs** — displacement–time, velocity–time and acceleration–time, sharing one
time cursor with the animation. The area under each curve is shaded live, so
"area under v–t is displacement" is something you watch rather than memorise.

**Solver** — enter any three of s, u, v, a, t. It picks the equation that omits
what you don't know, rearranges it, substitutes, and shows every step. Where a
± root or a quadratic gives two answers, it says so instead of quietly choosing.

**Reference** — the five equations, when each applies, and the projectile
results derived from them.

## Running it locally

```bash
node dev-server.mjs
```

Then open http://localhost:4173. The server only exists to send `no-store` so
ES modules aren't cached between edits — any static server works.

There is no build step and no dependencies. It is HTML, CSS and ES modules.

## Layout

```
index.html            markup for all three views
css/tokens.css        the design system — colours, type, spacing, radii
css/app.css           components; uses only token names, never raw hex
js/core/suvat.js      the five equations + a solver that shows its working
js/core/projectile.js the idealised projectile model
js/render/util.js     canvas helpers, palette bridge, label collision layer
js/render/scene2d.js  side-on view
js/render/scene3d.js  perspective wireframe view (hand-rolled, no 3D library)
js/render/graphs.js   the three graphs
js/ui/controls.js     control panel, built from a declarative spec
js/app.js             state and wiring
```

Two conventions worth knowing if you edit it:

1. **Components never use raw colours.** They reference roles from
   `tokens.css` (`--ink`, `--line`, `--accent`). That is why the dark theme is a
   short override block rather than a second stylesheet.

2. **The accent colour means "live".** Pink marks the moving projectile, its
   velocity vector, the path already flown and the time cursor — and nothing
   else. Everything static is greyscale, so colour carries information.

`window.SUVAT` is exposed in the console for poking at state:

```js
SUVAT.state.theta = 60; SUVAT.redraw();
```

## Credits

Visual system adapted from datalexing.com — Onest, IBM Plex Sans and Fragment
Mono, a near-black `#020a0f` ink, and the `#ee4498` accent.
