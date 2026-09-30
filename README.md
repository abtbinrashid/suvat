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

## Status

The **physics engine is finished and tested**. The interface is being redesigned
from scratch.

```bash
node test/engine.test.mjs     # 26 checks against hand-worked A-level answers
```

## Layout

```
js/core/suvat.js       the five equations + a solver that shows its working
js/core/projectile.js  the idealised projectile model
test/engine.test.mjs   hand-worked answers that prove the above
```

The previous interface is preserved in commit `4723636` if any of it is wanted
back.

## Credits

Built by abtbinrashid.
