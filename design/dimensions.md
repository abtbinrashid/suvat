# Dimension sheet

Every object in the flight view, in metres. Generated from `js/world/dims.js`
by `tools/dimension-sheet.mjs` — if a number here is wrong, the renderer is
wrong too, because they read the same file.

**Axes.** Right-handed, origin at the centre spot on the pitch surface.
`x` runs along the pitch, −52.5 (west goal) to +52.5 (east goal). `y` is up,
and `y = 0` is both the pitch surface and the physics datum the ball lands on.
`z` runs across, −34 (north touchline) to +34 (south touchline).

**One deliberate disagreement.** The idealised projectile lands on flat ground
at `y = 0`. The podium plaza really is 1.5 m above that, so it is drawn at
1.5 m and the ball passes it rather than landing on it. Scenery is not allowed
to lie about its size and the physics is not allowed to notice the scenery;
the plaza is where those two rules meet. The 2D view draws the datum plane
right across the canvas, under the stands included, so the idealisation is
stated rather than hidden.

## The playing surface

| Object | Dimension | Value (m) |
| --- | --- | --- |
| Pitch | length × width | 105 × 68 |
| Goal line | at x | ±52.5 |
| Touchline | at z | ±34 |
| Line width | — | 0.12 |
| Centre circle | radius | 9.15 |
| Centre spot | radius | 0.11 |
| Penalty area | depth × width | 16.5 × 40.32 |
| Goal area | depth × width | 5.5 × 18.32 |
| Penalty spot | from goal line | 11 |
| Penalty arc | radius | 9.15 |
| Corner arc | radius | 1 |
| Mowing stripes | count × width | 8 × 13.125 |
| Goal | width × height | 7.32 × 2.44 |
| Goalpost | diameter | 0.12 |
| Goal net | depth, mesh | 1.8, 0.12 |
| Grass run-off | beyond touchline / goal line | 5 / 6 |
| Grassed area | length × width | 117 × 78 |
| Advertising hoardings | height × depth, panel | 1 × 0.25, 2.4 |
| Hoarding line | at z / at x | ±39 / ±58.5 |
| Technical area | length × depth × height | 8 × 2.4 × 2.2 |

Hoardings carry no brand of any kind: they are blank LED panels in a 2.4 m
rhythm. There is no club name, crest, bird, sponsor or kit colour anywhere in
this world, and the seating is a neutral grey so that no palette reads as a
team strip.

## The bowl

| Object | Dimension | Value (m) |
| --- | --- | --- |
| Bowl plan | length × width | 250 × 200 |
| Bowl plan | corner radius | 45 |
| North / south front row | at |z| | 42 |
| East / west front row | at |x| | 62 |
| North / south height | top of rear facade | 36 |
| West height | top of rear facade | 35 |
| East height | top of rear facade | 35.6 |

### North and south — three tiers and a ring of boxes

Front row at 42 m from the centre line; 58 m of depth behind it.
`d` is the outward distance from the front row.

| Element | d from | d to | y from | y to | Rows | Tread | Rise | Rake |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lower tier | 0 | 17.6 | 1.2 | 10 | 22 | 0.8 | 0.4 | 26.6° |
| lower concourse | 17.6 | 20.2 | 10 | 10 | — | — | — | — |
| parapet | 20.2 | 20.2 | 10 | 11.1 | — | — | — | — |
| box glazing | 20.2 | 20.5 | 10 | 14 | — | — | — | — |
| boxes, roof deck | 20.5 | 30 | 14 | 14 | — | — | — | — |
| middle tier | 30 | 36.4 | 14 | 17.44 | 8 | 0.8 | 0.43 | 28.3° |
| middle rear | 36.4 | 38 | 17.44 | 25 | — | — | — | — |
| upper tier | 36 | 53.6 | 25 | 34.9 | 22 | 0.8 | 0.45 | 29.4° |
| rear facade | 53.6 | 58 | 34.9 | 36 | — | — | — | — |

### West — one steep tier

Front row at 62 m from the centre line; 63 m of depth behind it.
`d` is the outward distance from the front row.

| Element | d from | d to | y from | y to | Rows | Tread | Rise | Rake |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| single tier, lower block | 0 | 24 | 1.2 | 17.39 | 30 | 0.8 | 0.5396 | 34° |
| vomitory walkway | 24 | 26.5 | 17.39 | 17.39 | — | — | — | — |
| single tier, upper block | 26.5 | 50.5 | 17.39 | 33.58 | 30 | 0.8 | 0.5396 | 34° |
| rear facade | 50.5 | 63 | 33.58 | 35 | — | — | — | — |

### East — four tiers

Front row at 62 m from the centre line; 63 m of depth behind it.
`d` is the outward distance from the front row.

| Element | d from | d to | y from | y to | Rows | Tread | Rise | Rake |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tier 1 | 0 | 16 | 1.2 | 9.2 | 20 | 0.8 | 0.4 | 26.6° |
| concourse | 16 | 18.5 | 9.2 | 9.2 | — | — | — | — |
| parapet | 18.5 | 18.5 | 9.2 | 10.3 | — | — | — | — |
| box glazing | 18.5 | 18.8 | 9.2 | 13 | — | — | — | — |
| boxes, roof deck | 18.8 | 27 | 13 | 13 | — | — | — | — |
| tier 2 | 27 | 35 | 13 | 17.2 | 10 | 0.8 | 0.42 | 27.7° |
| tier 2 rear | 35 | 36.5 | 17.2 | 21.5 | — | — | — | — |
| tier 3 | 36 | 45.6 | 21.5 | 26.78 | 12 | 0.8 | 0.44 | 28.8° |
| tier 3 rear | 45.6 | 47 | 26.78 | 30 | — | — | — | — |
| tier 4, gallery | 46.5 | 54.5 | 30 | 34.6 | 10 | 0.8 | 0.46 | 29.9° |
| rear facade | 54.5 | 63 | 34.6 | 35.6 | — | — | — | — |

## The roof

A cable net on an elliptical compression ring, open over the pitch.

| Object | Dimension | Value (m) |
| --- | --- | --- |
| Outer fascia | top edge — the highest thing in the world | 48 |
| Outer fascia | bottom edge | 43 |
| Roof plane | at the outer structure line | 46.5 |
| Compression ring | top / bottom | 44 / 42.5 |
| Roof opening | semi-axes a × b | 64 × 41 |
| Roof opening | full size | 128 × 82 |
| Floodlight strip | height, width | 42, 1.2 |
| Cables | radial / hoop | 28 / 3 |

The opening is bigger than the pitch in both directions, so the whole pitch is
open to the sky and every seat is under cover.

## Podium and district

| Object | Dimension | Value (m) |
| --- | --- | --- |
| Podium plaza | plan, as a ring round the bowl | 330 × 280 |
| Podium plaza | height above the datum | 1.5 |
| Podium balustrade | height | 1.1 |
| Forecourt / drop-off | z range, depth | -152 to -140, 12 |
| Wide pavement | z range, depth | -164 to -152, 12 |
| Carriageway A | z range, 2 lanes | -171 to -164, 2 × 3.5 |
| Planted median | z range | -173.4 to -171 |
| Carriageway B | z range, 2 lanes | -180.4 to -173.4, 2 × 3.5 |
| Far pavement | z range, depth | -186.4 to -180.4, 6 |
| Street lighting | height, spacing | 6, every 30 |
| Street trees | spacing | every 14 |
| West street | x range | -336 to -320 |
| Station building | plan, roof height | 120 × 40, 14 |
| Platform canopy | z range, height | -272 to -250, 7 |
| Track bed | tracks, gauge, spacing | 4, 1.435, 4 |
| Station | distance from the centre spot | 210 |
| Parking bay | width × length | 2.4 × 4.8 |
| Parking aisle | width | 6 |
| Car park lighting | height | 8 |
| Terraced house | frontage × depth | 5.5 × 9 |
| Terraced house | eaves / ridge | 6.2 / 9.4 |
| Rear gardens | depth each | 10 |
| Residential street | width | 10 |

| Car park | x range | z range |
| --- | --- | --- |
| P1 | -210 to -70 | 150 to 230 |
| P2 | 80 to 215 | 150 to 215 |
| P3 | -450 to -340 | -150 to 150 |

| Terrace block | x range | z range |
| --- | --- | --- |
| T1 | 300 to 900 | -150 to 250 |
| T2 | -240 to 240 | 260 to 700 |
| T3 | -900 to -480 | 240 to 620 |
| T4 | 430 to 900 | -640 to -200 |

| Park | x range | z range | Pond |
| --- | --- | --- | --- |
| west | -900 to -480 | -200 to 180 | -780 to -660 × -80 to 20 |
| north | -300 to 300 | -600 to -320 | — |

## Scale references

Every one of these is a real measurement, drawn at that measurement. If one
of them looks small on screen, it is because it is small.

| Object | Dimension | Value (m) |
| --- | --- | --- |
| Football | diameter | 0.22 |
| Person | height × shoulder width | 1.8 × 0.45 |
| Car | length × width × height | 4.5 × 1.8 × 1.5 |
| Double-decker bus | length × width × height | 11.2 × 2.55 × 4.4 |
| Mature tree | height, canopy radius, trunk radius | 15, 5, 0.35 |
| Young tree | height, canopy radius | 8, 2.6 |
| Street lamp | height, arm | 6, 1.5 |

## The far field

| Setting | Value (m) |
| --- | --- |
| District fades from | 1500 |
| District fully faded by | 2100 |
| Distance grid step | 500 |
| Distance grid out to | 4000 |

Past 1.5 km the district dissolves into a labelled distance grid rather than
ending at an edge, which is what makes `g = 0` and Moon gravity survivable:
the ball leaves the world and there is still something to measure it against.

## Level of detail

Thresholds are in metres of VISIBLE WIDTH. Each feature fades out over the
last quarter of its range, so nothing pops.

| Band | Visible width (m) |
| --- | --- |
| pitch | up to 30 |
| stadium | up to 300 |
| district | up to 2000 |

| Feature | Gone by (m) |
| --- | --- |
| netMesh | 260 |
| grassBlades | 24 |
| people | 230 |
| boardPanels | 260 |
| pitchLines | 560 |
| players | 340 |
| seatRows | 130 |
| seatTexture | 440 |
| roofCables | 950 |
| floodDetail | 760 |
| carParkBays | 950 |
| cars | 1900 |
| treeDetail | 1200 |
| treeBlob | 3400 |
| houseDetail | 1500 |
| houseBlock | 4200 |
| grassStripes | 1000 |
| roadLines | 1100 |

## The numbers the brief asks the world to honour

| Check | Metres | What it lands level with |
| --- | --- | --- |
| 14 m s⁻¹ straight up reaches | 9.99 | the back of the lower tier at 10 m |
| 31 m s⁻¹ straight up reaches | 48.98 | clears the roof at 48 m |
| 20 m s⁻¹ flat from 25 m travels | 45.2 | lands on the pitch, 1.2 m inside the north touchline |
| 25 m s⁻¹ at 45° travels | 63.7 | a goal kick, landing in the far half |
| 28 m s⁻¹ at 30° and at 60° both travel | 69.2 | apexes 10.0 m and 30.0 m |
| 28 m s⁻¹ at 45° from 25 m peaks at | 44.98 | 3 m under the roof at 48 m |

## Where each scenario starts

| Scenario | Launch point (x, y, z) | Section | Place |
| --- | --- | --- | --- |
| Thrown straight up | (0, 0, 0) | across the pitch, south | The centre spot |
| Simple arc | (-52.5, 0, 0) | along the pitch, east | A goal kick from the west goal line |
| Dropped | (0, 80, 0) | across the pitch, south | A camera drone, 80 m above the centre circle |
| Thrown straight down | (0, 45, -41) | across the pitch, south | The roof edge, at the inner compression ring |
| Off a platform | (0, 25, -78) | across the pitch, south | Front row of the north upper tier, 25 m up |
| Up and off a platform | (0, 25, -78) | across the pitch, south | Front row of the north upper tier, 25 m up |
| Throw at a target | (-36, 1, 0) | along the pitch, west | A shot from the edge of the penalty area |
| Time above a line | (-52.5, 0.9, 0) | along the pitch, east | A clearance from the west goal line |
| Two that collide | (-52.5, 73.5, 0) | along the pitch, east | A drone 73.5 m up, and a kick from the goal line below it |

