# The flight view, rebuilt in a place

Notes on what changed, and why. Companion to `design/dimensions.md` (every
measurement) and `design/launch-map.svg` (where each scenario starts).

## The idea

The motion used to happen on a blank grid. It now happens in a large modern
football stadium and the district around it, at 1 unit = 1 metre, with nothing
exaggerated. The object is a football, 0.22 m across.

There is **one model**, shown two ways. The 2D view takes a cross-section
through it along the plane the flight happens in; the 3D view extrudes the same
records. They cannot disagree, because they read the same arrays.

The stadium takes its proportions from Tottenham Hotspur Stadium — a 250 × 200 m
bowl, a 48 m cable-net roof on an elliptical ring, one end a single steep tier —
but it is an original building. There is no club name, crest, bird, sponsor or
kit colour anywhere: the hoardings are blank LED panels in a 2.4 m rhythm and
the seats are neutral grey.

## New files

| File | What it is |
| --- | --- |
| `js/world/dims.js` | The dimension sheet, as data. Single source of truth for both renderers and for `design/dimensions.md`. |
| `js/world/world.js` | Builds the world once: ground surfaces, solids, markings, props, the four seating decks, the roof. Also the cross-section slicer and the per-scenario launch sites. |
| `js/render/world2d.js` | Paints the cross-section: sky, far field, surfaces, markings, boxes, decks, roof, props. Owns the LOD rules and the offscreen layer cache. |
| `js/render/world3d.js` | Builds a face list from the same records, clips, sorts, shades and draws it. |
| `tools/dimension-sheet.mjs` | Writes `design/dimensions.md` from `dims.js`, so the sheet cannot drift. |
| `tools/launch-map.mjs` | Writes `design/launch-map.svg` from `world.js` and the real engine. |

## `js/render/scene.js` — the 2D view

**Two coordinate systems, kept apart.** Flight `x` is metres from the launch
point, which is what the physics talks about. Section `u` is metres along the
cutting plane, which is what the world is built in. They differ by one constant
`u0` that the launch site supplies, so `sx(x) = su(u0 + x)`. Every axis label
the student reads is in flight `x`; every piece of scenery is placed in section
`u`. Nothing is converted twice, and a free kick shooting west shares one world
with a goal kick shooting east without either being drawn backwards.

**The camera fits once.** `cam.auto` became `cam.fit`, a one-shot flag consumed
by the first render after it is set. Launch sets it; double-click sets it; a
resize sets it only if the student has not panned. It is never set during a
flight. This is the whole reason a faster launch now visibly crosses the pitch
faster — a camera that keeps rescaling turns every launch into the same picture.
There is also a 96 m minimum span, so a short flight is still seen *somewhere*.

**The world is painted once.** `W2.layer()` keeps an offscreen canvas keyed on
size, theme, camera and scenario. During a flight the key never changes, so one
bitmap is blitted and the only live drawing is the ball, its trail and the
arrows — a few dozen calls a frame.

**New on screen:** a scale bar whose length is a round number of metres, a
height ruler up the left edge, named landmark lines (roof 48 m, upper tier front
25 m, back of the lower tier 10 m, crossbar 2.44 m), and the zoom band and
launch site in words. The metre grid is now pinned to the launch point rather
than the world origin, and is off by default — the ruler and the scale bar carry
the measuring job, and the grid is the overlay you switch on.

**Markers grew up.** The fence is a defensive wall of four players at 1.8 m and
still draggable. The height line snaps onto the crossbar, the back of the lower
tier, the upper tier front and the roof, and names what it has snapped to. The
target starts on the top corner of the goal. Every existing overlay — traced
path, equal-time marks, component arrows, range bar, apex, the perpendicular
instant — works unchanged.

**The ball is drawn at 0.22 m.** Below about 5 px of radius it also gets a ring,
which is chrome and not the ball; above that the ring becomes its outline.

**The ground is stated, not hidden.** The idealised model lands on a flat plane
at y = 0 that runs under everything, stands included. That plane is drawn right
across the canvas and the ground below it is filled solid, so the idealisation
is visible rather than quietly papered over by scenery.

## `js/render/scene3d.js` — the 3D view

### Does the hand-written projection carry this, or does it need WebGL?

**It carries it, and it stays.** The decision turns on one fact: *the camera is
fixed during a flight*. Everything expensive — the bowl, the roof, the district
— is static, so it is projected once into an offscreen bitmap and blitted after
that. What runs per frame is the ball, its trail and a dozen arrows: tens of
draw calls, not thousands. WebGL would buy fast re-projection that is only
needed while someone is dragging the camera, and would cost a shader pipeline, a
second colour path for the theme tokens, and a context that can be lost.

What the projector was missing, and now has:

- **Polygon clipping** against the near plane (Sutherland–Hodgman, in
  `grid.js`). Without it the ground plane you are standing on gets dropped the
  moment it straddles the camera.
- **A painter's-algorithm depth sort** on *centroid* depth, not the far corner.
  Sorting on the far corner made a fifty-metre roof strip sort as though it were
  distant, and the stand underneath painted straight over the top of it. Long
  pieces are also subdivided — the roof into seven radial rings — so the sort has
  compact things to order.
- **A separate ground pass.** Every flat surface sits at the same height, so
  depth-sorting them against each other is a coin toss. They are drawn first, in
  big-to-small order; everything with height sits on them and is sorted after.
- **Two-sided materials.** A raking surface seen from inside the bowl is
  seating; the same surface seen from outside is the back of the stand. One
  quad, two tones, chosen by the sign of the facing test. Without it the bowl
  reads as a smooth grey funnel.
- **Flat shading** from a theme-dependent light: a low sun in daylight, a
  near-vertical floodlit wash at night.
- **LOD and a moving/settled split.** While the camera is being dragged the bowl
  drops from 112 × 46 to 48 × 18 segments and the cables and seams are skipped.

**Budget:** about 2,600 faces at full detail, ~700 while moving. A cold render
of the full scenery measured ~2–6 ms on this machine; it happens on camera
change only, never inside a flight.

**Also new:** four named viewpoints — touchline, behind the goal, aerial,
district — chosen *inside or over* the bowl, because a roof that covers every
seat covers the view as well and any camera outside the stadium and low sees
nothing but a wall. An orientation readout ("looking north-east · eye 23 m up")
replaces floating world-space labels, which had no way of knowing a roof was in
front of them: there is no depth buffer. Beyond the district, labelled distance
rings every 500 m, so a flight that never comes back still has something to be
measured against.

## `css/tokens.css`

A new scenery block at the bottom, in two themes. Rules it follows:

- **Scenery never competes.** Every token is low chroma and lives in a narrow
  lightness band, well away from the five physics hues (orange velocity, cyan
  displacement, violet acceleration, magenta second object, green markers).
  Those five are unchanged.
- **Light is a daytime match, dark is a floodlit night match** — not a dark copy
  of the day. At night the *grass gets brighter* while everything around it gets
  darker, the box glazing lights up, floodlight beams fall from the compression
  ring onto the pitch, and the turf carries a lit top edge.
- **Figure and ground.** `--structure-dark` is the poché — the material the
  section actually cuts — and sits clearly darker than `--interior`, the volume
  behind the cut. Without that gap a three-tier stand is a grey wedge.

New tokens: `--sky-top`, `--sky-bottom`, `--haze`, `--earth`, `--interior`,
`--terrain`, `--grass`, `--grass-alt`, `--runoff`, `--pitchline`, `--concrete`,
`--paving`, `--asphalt`, `--roadline`, `--ballast`, `--brick`, `--roofing`,
`--window`, `--glass`, `--metal`, `--net`, `--seat`, `--seat-alt`, `--board`,
`--structure`, `--structure-dark`, `--roof-top`, `--roof-under`, `--prop`,
`--water`, `--park`, `--flood`, `--far-grid`.

## Motion

Playback was already real time; it is now labelled as such and joined by 0.5×
and 0.25×, as a segmented control next to the 2D/3D switch. Because the camera
no longer rescales mid-flight, a faster launch visibly crosses the pitch faster.

## Level of detail

Three bands, by visible width: **pitch** under 30 m, **stadium** 30–300 m,
**district** 300 m–2 km. Each feature also has its own threshold, so detail
fades independently rather than snapping at a band edge — pitch markings survive
to 560 m because they are still readable there, individual seat rows stop at
130 m because they are not. Every fade runs over the last quarter of its range.
The full table is in `design/dimensions.md`.

## What did not change

`js/core/` — `projectile.js`, `trajectory.js`, `suvat.js`, `solve.js`,
`question.js` — is untouched. All 149 engine, solver and question tests still
pass. The five physics hues are the same five. Every overlay that existed before
still exists and still works.
