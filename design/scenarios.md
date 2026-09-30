# What the exams actually ask

Compiled from ~30 real questions across four banks:

- Edexcel M2 past papers, Jan 2005 – June 2011 (naikermaths, 14 questions)
- Edexcel Year 2 Mechanics, recent (PMT Set B, 5 questions)
- Edexcel M2 topic set (PMT Set 1, 13 questions, partly overlapping)
- A-level Physics kinematics bank (Loreto, ~20 questions — 1D and simple projectiles)

This is a sample, not a census. But the pattern is lopsided enough that the
ranking is safe.

---

## The headline

**One setup dominates everything: *projected at an angle from a point above the
ground, lands on the ground below*.** Roughly 16 of ~30 Maths questions. Cliff,
roof, hand, dart-thrower's arm — the geometry is identical and only the height
changes.

If the playground opens on anything, it opens on that. Launch height is not an
advanced option; it is **the** default case.

The second observation is that Physics and Maths ask for different things from
the same picture. Physics stays mostly 1D (free fall, braking cars, v–t graphs)
plus horizontal projection. Maths goes straight to angled launch from a height
and asks for speed and direction at named points along the path.

---

## Ranked by frequency — Maths (Mechanics)

| # | Scenario | Seen | Notes |
|---|---|---|---|
| 1 | **Angled launch from a height → lands on ground** | ~16 | The default. h from 0.9 m (cricket) to 73.5 m (cliff) |
| 2 | **Hit / clear an object at a given horizontal distance** | ~5 | Fence, pole, dart board, target point, tennis net. Layered on top of #1 |
| 3 | **Horizontal launch from a height** (θ = 0) | ~5 | Dart, stone off a cliff, football off a roof, bomb from a plane |
| 4 | **Ground-to-ground at an angle** | ~4 | Includes the trajectory-equation derivations |
| 5 | **Trajectory equation "show that"** | ~4 | y = x tan θ − gx² / (2u² cos²θ) |
| 6 | **Two projectiles that collide** | 2 | Both launched at t = 0, meet mid-air |
| 7 | **Given the apex height** (not the angle) | 2 | "The highest point is 12 m above P" — work backwards |
| 8 | **Thrown *downwards* at an angle** | 1 | 30° **below** horizontal. Rare, and the one students fumble |

### The sub-questions, in order of how often they appear

1. Time of flight
2. Horizontal distance — where it lands
3. **Speed at a named point** (on landing, at a given height, above a target)
4. Direction / angle of the velocity at that point
5. Greatest height
6. **"State a limitation of the model"** — in nearly every modern paper

Number 3 is worth calling out. Students are asked for *speed at a point* almost
as often as for the range, and it is the quantity a static textbook diagram
cannot show. It is the strongest argument for a scrubber.

---

## Two patterns that should change the interface

**Angles are given as ratios, not degrees.** Across the Maths bank: `sin α = 3/5`,
`cos α = 4/5`, `tan α = 3/4`, `tan α = 7/24`, `tan α = 24/7`. Degrees almost never
appear except for the round ones (30°, 45°). The 3-4-5 triangle is everywhere.

→ The angle control should accept a **ratio**, not only a degree value. A student
holding a paper that says `tan α = 3/4` should not have to reach for a calculator
before they can use the site.

**g is 9.8 or 10, and the paper says which.** Several questions specify
`g = 10 m s⁻²` explicitly and the answers depend on it.

→ A plain **9.8 / 10** switch matters far more than Moon and Mars. Keep those as a
toy if you like, but they are not what the exam needs.

---

## The interesting ones

Scenarios that are rarer but teach something a plain arc does not.

**Time spent above a given height.** *"Find the length of time for which the ball
is at least 4 m above the ground."* (Jan 09 Q6e) — needs **both** roots of the
quadratic and their difference. A horizontal line on the animation with the
interval shaded would make this immediate.

**Velocity perpendicular to the launch velocity.** *"When P is at Q, the velocity
is at right angles to its initial velocity — find x at Q."* (Jan 10 Q8c) — a
genuinely surprising moment on the path, and trivial to mark on screen.

**Two stones that collide.** A 73.5 m cliff: one thrown horizontally from the top
at 28 m s⁻¹, one from the bottom at 35 m s⁻¹ at an angle, colliding mid-air
(June 06 Q5). Two trajectories with a synced clock — the compare feature already
half-does this.

**The moving catcher.** A ball thrown from an 8 m cliff; a boy leaves the base
**0.4 s later** and runs to catch it at 1 m above the beach (June 11 Q8c). Couples
a projectile to constant-velocity motion.

**Thrown downwards at 30° below horizontal** (June 08 Q7). Worth a preset purely
because the sign of `u_y` is where marks are lost.

**Released from a moving platform.** A sandbag dropped from a balloon *ascending*
at 8 m s⁻¹ — so `u = +8`, not 0. The single best "the model is not what you
assumed" question in the Physics bank.

**Distance fallen during the third second.** Not the distance after 3 s — the
distance *during* the third second. Two SUVAT calls and a subtraction, and it
kills the idea that falling is uniform.

**Complementary angles.** Not common in exams, but it is the cleanest
demonstration that two very different flights share a range.

---

## The model-criticism question

Nearly every modern paper ends with *"state one limitation of the model"* or
*"suggest two improvements"*. Mark schemes want: air resistance, the ball is not
a particle / has size, spin, wind, g is not exactly constant, the ground is not
horizontal.

This is directly relevant to what the site is for. It is built on the idealised
model **on purpose** — and the exam explicitly asks students to name what that
model throws away. A short, permanent, plain-English statement of the
assumptions is therefore not a disclaimer. It is revision content, and it answers
a question worth 1–2 marks on nearly every paper.

---

## Suggested presets, with real numbers

Every one of these is lifted from an actual question.

| Preset | u | θ | h | g | From |
|---|---|---|---|---|---|
| Dropped | 0 | — | 80 m | 9.8 | Physics bank |
| Thrown straight up | 14 | 90° | 0 | 9.8 | Physics bank Q4 |
| Off a roof, horizontal | 20 | 0° | 14 m | 9.8 | Physics bank |
| Off a cliff, horizontal | 20 | 0° | 80 m | 9.8 | Physics bank Q6b |
| Cliff, 45° | 28 | 45° | 25 m | 9.8 | PMT Y2 Q4 (lands 100 m out) |
| Golf ball off a cliff | 35 | tan α = 3/4 | — | 9.8 | June 07 Q6 (168 m out) |
| Cricket, near ground | 19.2 | tan α = 3/4 | 0.9 m | 9.8 | Jan 09 Q6 (3 s, 57.6 m) |
| Over the fence | u | 45° | 0 | 9.8 | June 09 Q6 (2 m fence at 10 m) |
| Thrown downwards | 25 | −30° | 12 m | 9.8 | June 08 Q7 |
| Stone into the sea | 65 | tan α given | 70 m | **10** | PMT Y2 Q5 |
| Two stones colliding | 28 / 35 | 0° / α | 73.5 m / 0 | 9.8 | June 06 Q5 |
