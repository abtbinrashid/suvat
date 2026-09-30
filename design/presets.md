# Scenario presets

Every scenario a preset screen should offer. All numbers are taken from real
exam questions. Grouped by what the object is doing, roughly in the order a
student meets them.

`u` launch speed · `θ` angle above horizontal (negative = below) · `h` launch
height · `g` gravity

---

## 1 · Straight up and down — no horizontal motion

| Preset | What happens | u | θ | h | g |
|---|---|---|---|---|---|
| **Dropped** | Released from rest, falls straight down | 0 | — | 80 m | 9.8 |
| **Thrown straight up** | Goes up, stops, comes back to your hand | 14 | +90° | 0 | 9.8 |
| **Thrown straight down** | Thrown downward off a height | 10 | −90° | 45 m | 9.8 |
| **Dropped from a rising balloon** | Balloon is going **up** at 8, so the bag goes up first | 8 | +90° | 100 m | 9.8 |

> The balloon one is the trick question: `u = +8`, not 0.

---

## 2 · Horizontal launch — the classic "off a cliff"

| Preset | What happens | u | θ | h | g |
|---|---|---|---|---|---|
| **Off a table** | Rolls off an edge, short drop | 3 | 0° | 1.2 m | 9.8 |
| **Off a roof** | Football kicked horizontally off a flat roof | 20 | 0° | 14 m | 9.8 |
| **Off a cliff into the sea** | Thrown horizontally from a clifftop | 20 | 0° | 80 m | 9.8 |
| **Dart at a board** | Nearly flat — drops only 10 cm on the way | 12.6 | 0° | 0 | 9.8 |
| **Package from a plane** | Released from a plane flying level | 40 | 0° | 500 m | 9.8 |

> Every one of these falls in exactly the same time as if it were simply dropped.
> That is the whole point of the group.

---

## 3 · Angled launch from ground level

| Preset | What happens | u | θ | h | g |
|---|---|---|---|---|---|
| **Classic 45°** | The standard arc, lands back at ground level | 25 | 45° | 0 | 9.8 |
| **Shot put** | Low-ish angle, short range | 8 | 55° | 0 | 9.8 |
| **Over the fence** | Must clear a 2 m fence 10 m away | 12 | 45° | 0 | 9.8 |
| **Two angles, same range** | 30° and 60° land in the same place | 28 | 30° + 60° | 0 | 9.8 |
| **Maximum range** | 45° beats every other angle from the ground | 25 | sweep θ | 0 | 9.8 |

---

## 4 · Angled launch from a height — **the most examined setup by far**

| Preset | What happens | u | θ | h | g |
|---|---|---|---|---|---|
| **Cliff at 45°** | Thrown up and out from a 25 m cliff, lands 100 m away | 28 | 45° | 25 m | 9.8 |
| **Golf ball off a cliff** | Long flight, lands 168 m out | 35 | 36.87° (tan = 3⁄4) | 50.4 m | 9.8 |
| **Cricket shot** | Hit from just above the ground, 3 s flight, 57.6 m | 24 | 36.87° (tan = 3⁄4) | 0.9 m | 9.8 |
| **Stone into the sea** | Off a 70 m cliff — this paper uses g = 10 | 65 | 22.6° (tan = 5⁄12) | 70 m | **10** |
| **Thrown downwards at an angle** | 30° **below** the horizontal, at a target | 25 | −30° | 12 m | 9.8 |
| **Throw at a target** | Must hit a point 2 m up, 10 m away | 11 | 30° | 1 m | 9.8 |
| **Stone off a cliff to the sea** | Lands 36 m from the foot of an 18 m cliff | 15 | 36.87° (tan = 3⁄4) | 18 m | **10** |

---

## 5 · Two objects at once

| Preset | What happens |
|---|---|
| **Two stones collide** | 73.5 m cliff. One thrown horizontally from the top at 28; one from the bottom at 35 at 36.87°. They meet mid-air |
| **Catch it** | Ball thrown from an 8 m cliff at 7 m s⁻¹, 45°. A boy starts running 0.4 s later and catches it 1 m up |
| **Thrown at each other** | Two balls, 50 m apart, launched at the same moment, colliding after 2 s |
| **Head start** | Same throw, one launched a second after the other |

---

## 6 · Things worth seeing that exams ask occasionally

| Preset | What it shows |
|---|---|
| **How long above 4 m?** | Shade the time the ball spends above a height line — needs both roots |
| **Turned 90°** | Mark the moment the velocity is at right angles to the launch velocity |
| **Hit the apex height** | Given only "the top of the path is 12 m up", work back to the angle |
| **The third second** | Distance fallen *during* the third second, not after 3 s |
| **On the Moon** | Identical throw, g = 1.62 — same shape, much bigger |
| **No gravity** | g = 0, so it never comes down. Shows what gravity is actually doing |

---

## Controls these presets imply

- **Launch height must be on the main screen.** Half of all exam questions use it.
- **Angle must accept a ratio** — `tan α = 3⁄4` — as well as degrees. Papers give
  ratios far more often than angles.
- **g needs a plain 9.8 / 10 switch.** Papers specify which, and answers depend on
  it. Moon and zero-g are a bonus, not the priority.
- **A height line** the student can drag, for "how long above 4 m" and "does it
  clear the fence".
- **A second object**, for the collision and comparison presets.
