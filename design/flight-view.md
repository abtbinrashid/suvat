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
  moment it straddles the camera. The near plane is 1.0 m, not 0.4: dividing
  by 0.4 multiplies screen coordinates by about 1900, so a clipped vertex
  lands thousands of pixels away and no bounding-box reject can catch the
  polygon it belongs to. Projected coordinates are clamped to a guard band as
  well, and a face that is both very close and canvas-swallowing is dropped —
  every piece of this scene is subdivided, so a face like that is an artefact
  by definition.
- **A painter's-algorithm depth sort** on *centroid* depth, not the far corner.
  Sorting on the far corner made a fifty-metre roof strip sort as though it were
  distant, and the stand underneath painted straight over the top of it.
- **A size cap on polygons.** Painter's algorithm orders whole polygons, so one
  280 m podium slab can sort "far" on its centroid and still have a near end
  that paints across a building — which is exactly what it did. Nothing longer
  than 45 m reaches the sort now; the roof is split into seven radial rings and
  every box face and ground surface is tiled, with a hair of overlap so the
  tile edges do not antialias into a visible grid.
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

### Two geometry bugs worth naming

The roof opening was an ellipse, 128 × 82, over a front row that is a rounded
rectangle. In the pitch-corner direction the ellipse reaches about 53 m while
the pitch corner is at 62.6 m, so the roof oversailed nine metres of playing
surface at each corner while leaving the end seats open to the sky. The
opening is now the front row's own plan inset by 2 m, so every seat is covered
and the whole pitch is open — by construction rather than by tuning.


The bowl and the roof were generated from two *different* rounded rectangles —
the bowl by offsetting the front row outward, the roof from its own plan with
its own corner radius. They agreed along the straight sides and missed each
other in the corners, and you could see the district through the gap. Both now
come from one function, `planRadius(direction, d)`: the front row is a rounded
rectangle 124 × 84 with a 30 m radius, and offsetting it outward by d grows
every radius by exactly d. 63 m of depth therefore gives a bowl and a roof that
are both 250 × 210 with a 93 m corner radius, by construction rather than by
coincidence.

## `css/tokens.css`

A new scenery block at the bottom, in two themes. Rules it follows:

- **Three value bands, at least 2:1 apart.** A section cuts material, and the
  convention is that cut material is the darkest thing on the page, the volume
  behind the cut is the lightest, and the surfaces you are looking at sit
  between: `--structure-dark` (poché) → `--seat` (raked seating) → `--interior`.
  The first attempt had seating and cut concrete at 1.01:1 — the same colour —
  and the whole bowl read as a quarry face.
- **Scenery never competes.** Every token is low chroma and lives in a narrow
  lightness band, well away from the five physics hues. In particular the
  brickwork was pulled out of the velocity hue: a district of warm orange roofs
  is a district arguing with the velocity vector. Velocity itself was darkened
  in the light theme, from 3.2:1 against its own sky to 5.9:1 — the loudest
  thing on screen cannot be the weakest-contrasting element in the frame.
- **Light is a daytime match, dark is a floodlit night match** — not a dark copy
  of the day. At night the *grass gets brighter* while everything around it gets
  darker, the box glazing lights up, beams fall from the compression ring onto
  the turf (clipped to the roof opening, because light does not pass through a
  stand), and a glow dome sits over the bowl that gets *stronger* as you pull
  away — which is how you find a night match from a mile off, and the opposite
  of what level-of-detail would do if left to itself.
- **The value bands invert at night, deliberately.** On paper the poché is
  darkest and the volume behind is lightest. Against a near-black sky the
  darkest possible poché is invisible, so at night the cut material is the
  lightest of the three — it is the edge catching the floodlights — and the
  unlit volume behind it is the darkest. Same convention, read by another light.
- **Figure and ground.** `--structure-dark` is the poché — the material the
  section actually cuts — and sits clearly darker than `--interior`, the volume
  behind the cut. Without that gap a three-tier stand is a grey wedge.

New tokens: `--sky-top`, `--sky-bottom`, `--haze`, `--earth`, `--interior`,
`--terrain`, `--grass`, `--grass-alt`, `--runoff`, `--pitchline`, `--concrete`,
`--paving`, `--asphalt`, `--roadline`, `--ballast`, `--brick`, `--roofing`,
`--window`, `--glass`, `--metal`, `--net`, `--seat`, `--seat-alt`, `--board`,
`--structure`, `--structure-dark`, `--roof-top`, `--roof-under`, `--prop`,
`--water`, `--park`, `--flood`, `--far-grid`.

## Readability decisions worth recording

- **Labels have a 13 px floor and no plates.** The floor used to be 15, which
  silently overrode every `size: 13` a caller asked for. Opaque plates punched
  white holes in the daylight drawing, so a label now gets a halo stroke in the
  surface colour instead — it lifts text off the background without erasing it.
  A label that cannot find space used to be dropped; important ones now take a
  further slot and draw a leader back to what they name.
- **Nothing points at nothing.** A landmark height is only drawn when the
  geometry carrying it is in this cut and on screen, and it anchors to that
  geometry's own position rather than to the right edge. Seven of the nine
  scenarios cut across the pitch, where there is no goal — so there is no
  crossbar label in them.
- **The range bracket measures the past.** Drawing the full range while the ball
  is halfway there puts a tick on empty grass fifty metres ahead of the object
  and calls it a measurement. It reads "travelled so far" during the flight and
  snaps to the full range on landing.
- **The crowd is the ruler.** A section cuts through one spectator per row, and
  a seated person is 0.85 m above a seat on rows 0.80 m apart. That makes the
  stand measurable by eye, and it is the best scale reference in the building.

## Motion

Playback was already real time; it is now labelled as such and joined by 0.5×
and 0.25×, as a segmented control next to the 2D/3D switch. Because the camera
no longer rescales mid-flight, a faster launch visibly crosses the pitch faster.

## Level of detail

Three bands, by visible width: **pitch** under 30 m, **stadium** 30–300 m,
**district** 300 m–2 km — and each is a *camera*, not a crop. A segmented
control next to the 2D/3D switch moves between them: Pitch rides with the ball
at a 27 m span, where a 1.8 m person is sixty pixels tall and the 0.22 m ball
is a real disc; Stadium is the fit; District pulls back to 941 m, far enough
for the road, the station and the terraces. Before this they were zoom levels,
and the pitch band was a crop of the stadium fit — which pointed the camera at
an arbitrary patch of wall with no ball in it. Each feature also has its own threshold, so detail
fades independently rather than snapping at a band edge — pitch markings survive
to 560 m because they are still readable there, individual seat rows stop at
130 m because they are not. Every fade runs over the last quarter of its range.
The full table is in `design/dimensions.md`.

## Light, colour and depth

The first version was legible and grey. These are the changes that made it a
place rather than a diagram of one.

**Time of day.** Light is now a late-afternoon match: the sun low in the west,
a warm band along the horizon, a blue sky above it, and long shadows. Dark is
still a floodlit night. Both are lit scenes with a key and a fill; a scene with
no light in it has no depth, whatever colours you give it.

**Two lights, not one lambert term.** In 3D a surface takes a warm key from the
sun and a cool fill from the sky dome, each tint normalised to mean 1 so it
shifts hue and never brightness. A face turned to the sun goes warm, a face
turned away goes blue, and the difference between them is what gives a grey
building its form. A shadowed facade is lit by the sky, not painted black —
the first attempt had the whole stadium as a black drum.

**Shadows.** Every box and every prop is projected along the light onto y = 0
as one dark polygon, and so is the bowl itself. It is not a shadow map and it
costs a few hundred polygons; it is also most of what stops the model floating
above its own ground. In 2D the same idea is a band of shade thrown across the
pitch from each stand, worked out from the sun's 28° elevation: a 35 m stand
lays 66 m of shadow, which is the one cue that tells you, in a drawing with no
perspective in it, which things are tall.

**Light in a flat drawing.** The section has no normals to shade, so the light
is put in by hand: surfaces facing the sun take a warm lift, surfaces turned
away take the cool of the sky, and the volume behind the cut graduates from
daylight at the top to shadow at the bottom.

**Colour where it is real.** Cars take one of five muted automotive paints —
silver, graphite, white, navy, bottle green, and deliberately no reds, because
a red car at that size reads as a velocity vector from across the room. Houses
take brick, render or panel from their own position, with two roof colours;
the seats are two greys in broad bands and never a club's. Scenery is held
under about 35% saturation throughout and the trajectory carries a casing
stroke, so none of it can out-shout the physics.

**See through the near wall.** From inside a bowl there is always a stand
between the camera and the pitch. Anything nearer than 70% of the look-at
distance now goes glassy — four layers deep by the time you reach the pitch,
so each has to be very light — which shows the pitch AND the building at once.
It is a switch in Options, because sometimes you want the solid thing.

**The camera travels.** Zoom, band changes and the four named 3D viewpoints are
eased rather than cut: distance and scale in log space because zoom is
multiplicative, angles and the look-at point linearly. Dragging stays
immediate — lag in a direct manipulation reads as a fault, not as smoothing.
A travelling camera invalidates the scenery cache on every frame, so while it
travels it travels COARSE (the bowl drops from 84 × 26 segments to 30 × 9, the
shadows and distant props are skipped) and sharpens 200 ms after it stops.
Measured: 14 ms a frame while moving, under 1 ms a frame during a flight.

**The horizon.** A finite ground plane has an edge and from 350 m up you can
see it. The far ground is now painted behind everything from the computed
horizon down, so the edge has the same colour on both sides and disappears
into a haze band.

**Streets, not runways.** Terraces are built in 88 m blocks with 11 m cross
streets between them. One unbroken six-hundred-metre ridge read as a runway.

## The model, gone over again

A second pass, after the first one had been looked at properly. Six things.

**The pitch had twenty-three people standing on it.** A kick-off formation,
drawn as 1.8 m cards. At the size the touchline camera sees them, a figure is
about as big as the velocity arrow and about as dark — so the one thing on
screen a student is meant to follow had twenty-three decoys of the same size
scattered across the ground it has to cross. They are gone: no players, no
keepers, no referee. The scale references that remain are all outside the
bowl, where nothing has to be read through them — the crowd in the stands, the
cars on the road, the people on the podium. The corner flags stay, because a
flag is 1.5 m and does not move.

**Every quad had a crack down its edge.** A canvas antialiases each polygon
edge against whatever is already behind it, so two faces sharing an edge leave
a half-covered hairline between them — and a bowl made of several thousand
faces turned into crazed porcelain. An opaque face is now stroked with its own
fill colour, which puts the half-pixel back. This is the single change that
made the model read as a surface rather than as a mesh. It is skipped on
translucent faces, where a stroke would double the coverage along the edge and
draw the mesh back on in outline, and on faces under about fourteen pixels of
girth, where the crack is narrower than the antialiasing either side of it and
sealing it costs a second raster pass for nothing.

**The inside of the bowl was bands of mud.** The flat concourse runs and the
balcony fronts were both taking `--structure-dark`, which is the poché tone —
the colour of CUT material in the section drawing, and quite wrong for a wall
you are looking AT. In every stadium ever built the balcony front is pale
concrete. It is pale concrete here now, with the concourse behind each tier
the same material in shadow, and nothing else in the bowl bright: an early
attempt that also lit the gangways turned the stand into tartan and left the
seating as the gaps in a grid. The seating itself takes the row rhythm — a
seat back catches the light, the tread in front of it does not — instead of
the two broad bands of grey it had, which read as geology.

**The stairs are a known width.** Eighteen vomitories climb the rake, and they
are most of why a photograph of a stand tells you how big it is: a known 2.6 m
against an unknown wall of seats. They are laid as their own strips rather
than as columns of the bowl mesh, because a column is 2.8 m wide at the front
row and 5 m at the back, and a flight of steps that widens as it climbs is the
one thing on this model nobody would believe.

**A car was a loaf of bread.** Two stacked boxes. It is eleven boxes now —
four wheels, a body sitting clear of the road, and a glasshouse set in on all
four sides and set back along the length so the thing has a bonnet — and a bus
has its two decks of windows. Both only for cars big enough on screen to be
worth it; past that it is the body and the glasshouse, and past that one card.
A tree was a balloon on a stick: it has a box trunk that takes the same light
as everything else, and a crown of three overlapping lobes in three greens.
The dugout was a pane of blue glass hanging at the touchline; it is a solid
back with a glass canopy over it. The goal net was a box of frosted glass and
is now the mesh it actually is, on the back, both sides and the roof of the
net, at 0.9 m squares — reverting to the translucent box past 170 m, where the
squares would be finer than a pixel. Terraced houses within 320 m have two
floors of windows at one pair per 5.5 m frontage, lit from inside at night
with a quarter of them dark.

**The roof was a tarpaulin.** The ring is finer, the fascia and soffit shade
across each ring rather than stepping at it, the inner third is the brighter
material a cable-net roof really is where it has to let light onto the grass,
and the radial cables stopped being dark gashes. The soffit is no longer close
to black: it is a dark surface being bounced into by a lit pitch, and it
brightens towards the opening. The outside of the bowl gained a plinth, the
glazed concourse that rings every modern stadium, and a panelled upper facade
whose bay rhythm is a change of VALUE rather than of material — alternating
two tones across whole bays chopped the elevation into a chequerboard that was
visible from inside the bowl, over the roof.

### What it costs

Measured in the same tab, same view, same canvas, against the previous commit.

| | before | after |
| --- | --- | --- |
| frame during a flight | 0.51 ms | 0.52 ms |
| frame while orbiting | 5.4–6.1 ms | 6.4–9.3 ms |
| the one repaint when the camera stops | 28–33 ms | 49–54 ms |

The frame that matters — the one that runs sixty times a second while the ball
is in the air — is unchanged, because the scenery is still painted once into
an offscreen bitmap and blitted after that. Orbiting still has eight times the
headroom it needs. The repaint when the camera stops is the price of the finer
bowl and roof; it happens once, and what the user sees is the coarse model
sharpening, not a stutter. The roof was taken back from 120 segments to 96 and
from ten rings to eight when the first version of this pass put that repaint
at 75 ms.

### Two stale references, fixed

`tools/dimension-sheet.mjs` and `tools/launch-map.mjs` were still reading
`D.roof.ringA` / `ringB` — the semi-axes of an elliptical roof opening that
stopped existing when the roof and the bowl were made to share one
rounded-rectangle family. The sheet had been printing `undefined × undefined`
and `NaN × NaN`, and the map had been drawing an ellipse with `rx="NaN"`. Both
now derive the opening from the front row inset by `roof.ringInset`, which is
what the renderer does: 120 × 80 m. `D.lod.players` went with the players.

## What did not change

`js/core/` — `projectile.js`, `trajectory.js`, `suvat.js`, `solve.js`,
`question.js` — is untouched. All 149 engine, solver and question tests still
pass. The five physics hues are the same five. Every overlay that existed before
still exists and still works.
