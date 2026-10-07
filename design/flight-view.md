# The flight view, rebuilt in a place

Notes on what changed, and why. Companion to `design/dimensions.md` (every
measurement) and `design/launch-map.svg` (where each scenario starts).

## Removed: the perspective view — 7 October 2026

There used to be a second view of the same flight: the world extruded instead
of cut, with an orbitable camera, four named viewpoints and a hand-written
perspective projector. It is gone, along with `js/render/scene3d.js`,
`js/render/world3d.js`, `js/render/grid.js`, the 2D/3D switch and the
see-through-the-near-stand option. It cost a third of the render code and
earned no physics: a projectile question is a question about one vertical
plane, and the cut IS that plane.

Two consequences worth knowing. The flight model is now genuinely planar —
`flight()` lost its `azimuth` argument and its `uz`/`z` components, which were
always zero and existed only to point a camera. And the world model keeps its
third dimension on purpose: `z` is what the section is cut at, not something
that gets drawn.

Sections below that describe the extruded model are kept as history. Where
they describe the world data — plan geometry, dimensions, tokens — they are
still live, because the section reads the same arrays.

## The idea

The motion used to happen on a blank grid. It now happens in a large modern
football stadium and the district around it, at 1 unit = 1 metre, with nothing
exaggerated. The object is a football, 0.22 m across.

There is **one model**, shown one way: a cross-section through it along the
plane the flight happens in. The model is kept in three dimensions so the
section can move with the launch site — a free kick and a goal kick cut
different planes through the same stadium — but the only thing ever drawn is
the cut.

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

## Two geometry bugs worth naming

Both are in the world model itself — `js/world/world.js` and `dims.js` — so
they still matter to the section and to `design/launch-map.svg`.

The roof opening was an ellipse, 128 × 82, over a front row that is a rounded
rectangle. In the pitch-corner direction the ellipse reaches about 53 m while
the pitch corner is at 62.6 m, so the roof oversailed nine metres of playing
surface at each corner while leaving the end seats open to the sky. The
opening is now the front row's own plan inset by 2 m, so every seat is covered
and the whole pitch is open — by construction rather than by tuning.

The bowl and the roof were generated from two *different* rounded rectangles —
the bowl by offsetting the front row outward, the roof from its own plan with
its own corner radius. They agreed along the straight sides and missed each
other in the corners. Both now come from one function, `planRadius(direction,
d)`: the front row is a rounded rectangle 124 × 84 with a 30 m radius, and
offsetting it outward by d grows every radius by exactly d. 63 m of depth
therefore gives a bowl and a roof that are both 250 × 210 with a 93 m corner
radius, by construction rather than by coincidence.

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
and 0.25×, as a segmented control in the stage bar. Because the camera
no longer rescales mid-flight, a faster launch visibly crosses the pitch faster.

## Level of detail

Three bands, by visible width: **pitch** under 30 m, **stadium** 30–300 m,
**district** 300 m–2 km — and each is a *camera*, not a crop. A segmented
control in the stage bar moves between them: Pitch rides with the ball
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

**Shadows.** A band of shade is thrown across the pitch from each stand,
worked out from the sun's 28° elevation: a 35 m stand lays 66 m of shadow,
which is the one cue that tells you, in a drawing with no perspective in it,
which things are tall.

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

**The camera travels.** Zoom and band changes are eased rather than cut:
scale in log space because zoom is multiplicative, the look-at point linearly.
Dragging stays immediate — lag in a direct manipulation reads as a fault, not
as smoothing.

**Streets, not runways.** Terraces are built in 88 m blocks with 11 m cross
streets between them. One unbroken six-hundred-metre ridge read as a runway.

## The model, gone over again

A second pass, after the first one had been looked at properly. Six things.
Three of them — the cracked quads, the bowl mesh, the eleven-box car — were
about the extruded model and are history now; the rest changed the world data
and still show up in the section.

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

Measured against the previous commit, back when the perspective view still
shipped. Kept for the record; the orbiting rows no longer apply.

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
