// scene.js — the side-on view: a cross-section of the stadium, cut along the
// plane the flight happens in, with the motion standing in it.
//
// Colour carries meaning and nothing else does: velocity is one hue,
// acceleration another, displacement a third. Horizontal and vertical
// components share their quantity's hue and are told apart by a dashed stroke.
// The scenery is deliberately held to low chroma so those hues always win.
//
// TWO COORDINATE SYSTEMS, and it matters which is which:
//   FLIGHT x   metres from the launch point, what the physics talks about
//   SECTION u  metres along the cutting plane, what the world is built in
// They differ by one constant, `u0`, which the launch site supplies. Every
// axis label the student reads is in flight x; every piece of scenery is
// placed in section u. Nothing is ever converted twice.

import { fitCanvas, palette, stroke, arrow, dot, fmt, niceStep, clamp, labels, cssVar } from './util.js';
import { createCamera3D } from './grid.js';
import { slice, siteFor, siteMap, deckProfile } from '../world/world.js';
import { D } from '../world/dims.js';
import * as W2 from './world2d.js';

export { createCamera3D };

export function createCamera() { return { cx: 0, cy: 0, scale: 8, fit: true, touched: false, band: 'stadium' }; }

/* ── the three zoom bands, as places to stand rather than crops ────────
   Pitch level follows the ball at a span where a 1.8 m person is 60 px and
   the 0.22 m ball is a real disc. Stadium is the fit. District pulls back to
   the road, the station and the terraces. Each is a camera, not a zoom. */
export function setBand(cam, band) {
  cam.band = band;
  cam.touched = true;
  cam.follow = band === 'pitch';
  if (band === 'stadium') { cam.fit = true; cam.wantSpan = null; return; }
  cam.fit = false;
  cam.wantSpan = band === 'pitch' ? 26 : 900;
}

/** Pitch level rides with the object; there is nothing else worth centring on. */
function applyBand(cam, w, h, u0, ball) {
  if (cam.fit || !cam.wantSpan) return;
  const scale = (w - 60) / cam.wantSpan;
  const BOTTOM = 74;
  const groundOffset = (h - BOTTOM - h / 2) / scale;
  cam.want = cam.follow
    ? { scale, cx: u0 + ball.x, cy: Math.max(groundOffset, ball.y - (h / 2 - 90) / scale) }
    : { scale, cx: 0, cy: groundOffset };
}

/* ── moving the camera, rather than teleporting it ──────────────────────
   A zoom that jumps is a zoom you have to re-read from scratch; a zoom that
   travels keeps you oriented the whole way. Scale is eased in LOG space,
   because zoom is multiplicative — linear easing crawls at the wide end and
   bolts at the close end. Panning and orbiting stay immediate: a drag is a
   direct manipulation and lag in one feels like a fault. */
export function easeCamera(cam, dt) {
  if (!cam.want) return false;
  const k = 1 - Math.exp(-dt * 9.5);
  let moving = false;
  if (cam.want.scale != null) {
    const r = Math.log(cam.want.scale / cam.scale);
    if (Math.abs(r) > 0.0008) { cam.scale *= Math.exp(r * k); moving = true; }
    else cam.scale = cam.want.scale;
  }
  for (const key of ['cx', 'cy']) {
    if (cam.want[key] == null) continue;
    const d = cam.want[key] - cam[key];
    const span = 40 / cam.scale;
    if (Math.abs(d) > span * 0.002) { cam[key] += d * k; moving = true; }
    else cam[key] = cam.want[key];
  }
  // A travelling camera invalidates the scenery cache on every frame, so
  // while it travels it travels cheap and sharpens when it stops.
  cam.moving = moving;
  return moving;
}
const snapWant = (cam) => { cam.want = { scale: cam.scale, cx: cam.cx, cy: cam.cy }; };

/* ── fitting, once ───────────────────────────────────────────────────────
   The brief is explicit: fit before launch and do not rescale during it. A
   camera that keeps rescaling turns a fast launch and a slow one into the
   same picture, which destroys the one thing the view exists to show. */
function autoFit(cam, flights, markers, w, h, u0, section) {
  let uLo = u0, uHi = u0, yHi = 4;
  for (const f of flights) {
    if (!f) continue;
    const end = f.pos(f.tMax);
    const reach = isFinite(end.x) ? end.x : f.horiz * f.tMax;
    uLo = Math.min(uLo, u0 + Math.min(0, reach), u0 + Math.min(0, isFinite(f.range) ? f.range : 0));
    uHi = Math.max(uHi, u0 + Math.max(0, reach), u0 + Math.max(0, isFinite(f.range) ? f.range : 0));
    yHi = Math.max(yHi, f.apexHeight, f.params.h);
  }
  if (markers?.obstacle) { uHi = Math.max(uHi, u0 + markers.obstacle.x + 4); uLo = Math.min(uLo, u0 + markers.obstacle.x - 4); yHi = Math.max(yHi, markers.obstacle.height); }
  if (markers?.target)   { uHi = Math.max(uHi, u0 + markers.target.x + 4);   uLo = Math.min(uLo, u0 + markers.target.x - 4);   yHi = Math.max(yHi, markers.target.y); }
  if (markers?.heightLine != null) yHi = Math.max(yHi, markers.heightLine);

  /* THE PLACE IS HALF THE SUBJECT, so the frame has to contain some of it.
     Fitting the flight alone gave a third of the canvas to empty sky, ninety
     pixels to the south stand and four hundred and eighty to the north one.
     The bowl is brought into the fit, weighted so it widens the frame without
     ever shrinking the flight to a scratch. */
  const flightSpan = Math.max(12, uHi - uLo);
  if (section) {
    let bLo = Infinity, bHi = -Infinity, bTop = 0;
    for (const deck of section.decks) {
      for (const el of deckProfile(deck)) {
        bLo = Math.min(bLo, el.u0, el.u1); bHi = Math.max(bHi, el.u0, el.u1);
        bTop = Math.max(bTop, el.y0, el.y1);
      }
    }
    for (const wing of section.roof.wings) {
      bLo = Math.min(bLo, wing.outerU, wing.inner); bHi = Math.max(bHi, wing.outerU, wing.inner);
    }
    if (isFinite(bLo)) {
      bTop = Math.max(bTop, section.roof.fasciaTop);
      // Pull the frame towards the bowl by at most 45% of the distance. A
      // 20 m throw does not get a 250 m frame; a 100 m one gets its stadium.
      const k = clamp(flightSpan / 170, 0, 0.45);
      uLo += (Math.max(bLo, uLo - flightSpan) - uLo) * k;
      uHi += (Math.min(bHi, uHi + flightSpan) - uHi) * k;
      yHi = Math.max(yHi, bTop * clamp(flightSpan / 120, 0.34, 1));
    }
  }

  // A minimum span, so the flight is always seen somewhere rather than nowhere:
  // 96 m is a little under the length of the pitch.
  const MIN_SPAN = 96;
  const spanU = Math.max(MIN_SPAN, (uHi - uLo) * 1.14 + 10);
  const spanY = Math.max(22, yHi * 1.2 + 6);
  const sU = (w - 130) / spanU, sY = (h - 128) / spanY;
  cam.scale = Math.max(0.004, Math.min(sU, sY));
  cam.cx = (uLo + uHi) / 2;

  // The ground sits as low as the chrome below it allows, always. Nothing in
  // this model goes below the ground, so any space under the datum is spent
  // on earth nobody needs to look at.
  const BOTTOM = 74;                      // range bar, its label, the scale bar
  cam.cy = (h - BOTTOM - h / 2) / cam.scale;
  cam.fit = false;
  snapWant(cam);                          // a fit arrives, it does not travel
}

export function render(canvas, cam, o) {
  const { traj: f, second, ghost, t, show, markers = {}, scenario, fired = true,
          resolve = null, hover = null } = o;
  if (!f) { return null; }
  const { ctx, w, h } = fitCanvas(canvas);
  const P = palette();
  const L = labels();
  const tn = W2.tones();
  const site = siteFor(scenario?.id);
  const { u0 } = siteMap(site);
  const list = [f, second].filter(Boolean);
  const section = slice({ axis: site.axis, at: site.at, dir: site.dir });
  if (cam.fit) autoFit(cam, list, markers, w, h, u0, section);
  else applyBand(cam, w, h, u0, f.pos(fired ? t : 0));

  /* section coordinates on the left, flight coordinates on the right */
  const su = (u) => w / 2 + (u - cam.cx) * cam.scale;
  const sy = (y) => h / 2 - (y - cam.cy) * cam.scale;
  const pu = (X) => (X - w / 2) / cam.scale + cam.cx;
  const py = (Y) => (h / 2 - Y) / cam.scale + cam.cy;
  const sx = (x) => su(u0 + x);
  const px = (X) => pu(X) - u0;
  const M = (p) => ({ x: sx(p.x), y: sy(p.y) });
  const groundY = sy(0);
  const span = w / cam.scale;
  const band = W2.zoomBand(span);

  /* ── the world, painted once and kept ─────────────────────────────── */
  // The key includes the camera, so a pan repaints the world every frame. It
  // repaints a CHEAPER world while the pointer is down: props and house
  // detail are what cost, and they are also what nobody studies mid-drag.
  const key = [w, h, document.documentElement.dataset.theme, cam.scale.toFixed(4),
               cam.cx.toFixed(2), cam.cy.toFixed(2), scenario?.id, cam.moving ? 'lo' : 'hi'].join('|');
  const bg = W2.layer('section', w, h, key, (g) => {
    W2.drawSection({ ctx: g, w, h, span, scale: cam.scale, sx: su, sy, px: pu, py,
                     section, tn, L: null, moving: cam.moving });
  });
  ctx.drawImage(bg, 0, 0, w, h);

  /* ── readability chrome ───────────────────────────────────────────── */
  if (show.grid) metreGrid({ ctx, w, h, su, sy, pu, py, cam, P, L, u0 });
  if (show.ruler !== false) W2.heightRuler({ ctx, w, h, sy, py, scale: cam.scale, tn }, L,
    Math.max(f.apexHeight, f.params.h, D.roof.fasciaTop, markers.heightLine ?? 0));
  landmarkLabels({ ctx, w, h, sy, su, L, tn, span, P, section, uMin: pu(0), uMax: pu(w) });

  /* ── height line, fence, target ───────────────────────────────────── */
  if (markers.heightLine != null) {
    const Y = sy(markers.heightLine);
    stroke(ctx, [{ x: 0, y: Y }, { x: w, y: Y }], { color: P.mark, width: 2.8, dash: [10, 7], alpha: .92 });
    const snapped = snapName(markers.heightLine);
    L.add(`${fmt(markers.heightLine, 1)} m${snapped ? ` — ${snapped}` : ''}${fired ? '' : ' · drag me'}`,
          w - 12, Y, { color: P.mark, align: 'right', pri: 6, size: 17 });
    dot(ctx, 76, Y, 8, { fill: P.surface, stroke: P.mark, width: 3 });

    const bandT = fired ? timeAbove(f, markers.heightLine) : null;
    if (bandT) {
      ctx.save(); ctx.globalAlpha = .14; ctx.fillStyle = P.mark;
      ctx.fillRect(sx(f.horiz * bandT.t1), sy(f.apexHeight),
                   (bandT.t2 - bandT.t1) * f.horiz * cam.scale, sy(markers.heightLine) - sy(f.apexHeight));
      ctx.restore();
      L.add(`above for ${fmt(bandT.t2 - bandT.t1, 2)} s`,
            sx(f.horiz * (bandT.t1 + bandT.t2) / 2), sy(markers.heightLine) - 24,
            { color: P.mark, align: 'center', pri: 7, size: 18 });
    }
  }

  if (markers.obstacle) {
    defensiveWall({ ctx, sx, sy, tn, scale: cam.scale }, markers.obstacle);
    const X = sx(markers.obstacle.x), Yt = sy(markers.obstacle.height);
    stroke(ctx, [{ x: X, y: groundY }, { x: X, y: Yt }], { color: P.mark, width: 4 });
    stroke(ctx, [{ x: X - 22, y: Yt }, { x: X + 22, y: Yt }], { color: P.mark, width: 3 });
    dot(ctx, X, Yt, 7, { fill: P.surface, stroke: P.mark, width: 2.5 });
    const clears = clearsObstacle(f, markers.obstacle);
    if (!fired) L.add(`wall ${fmt(markers.obstacle.height, 2)} m · drag me`, X, Yt - 26, { color: P.mark, align: 'center', pri: 5, size: 16 });
    else L.add(clears ? 'clears it' : 'hits it', X, Yt - 26,
      { color: clears ? P.good : P.bad, align: 'center', pri: 9, weight: 600, size: 19 });
  }

  if (markers.target) {
    const p = M(markers.target);
    const hit = fired ? passesThrough(f, markers.target) : null;
    const col = hit == null ? P.mark : hit ? P.good : P.mark;
    dot(ctx, p.x, p.y, 13, { stroke: col, width: 3 });
    dot(ctx, p.x, p.y, 4, { fill: col });
    L.add(hit == null ? 'target — drag me' : hit ? 'hit' : 'missed',
          p.x, p.y - 28, { color: hit ? P.good : col, align: 'center', pri: 9, size: 18, weight: 600 });
  }

  /* ── second object ────────────────────────────────────────────────── */
  if (second) {
    const delay = o.secondDelay || 0;
    stroke(ctx, second.path(200).map(M), { color: P.second, width: 3.4, dash: [9, 6], alpha: .9 });
    const t2 = clamp(t - delay, 0, second.tMax);
    if (t >= delay) {
      const q = M(second.pos(t2));
      ball({ ctx, scale: cam.scale }, q.x, q.y, P.second, true);
    }
    L.add(o.secondLabel || 'second object', sx(second.range), groundY - 22,
          { color: P.second, align: 'center', pri: 3, size: 17 });
  }

  /* ── the path ─────────────────────────────────────────────────────── */
  if (ghost && show.path) stroke(ctx, ghost.map(M), { color: P.faint, width: 2.8 });

  // The path is TRACED behind the object as it goes. Nothing is drawn ahead of
  // it, so the student watches the shape appear rather than reading it off.
  if (show.path && fired) {
    const flown = f.path(260, t).concat([{ t, ...f.pos(t) }]).map(M);
    // A casing in the surface colour under the path. The trajectory crosses
    // sky, lit grass, dark seating and bare earth in one stroke; without it
    // there is always some background it nearly matches.
    stroke(ctx, flown, { color: P.surface, width: 7.6, alpha: 0.5 });
    stroke(ctx, flown, { color: P.vel, width: 4.6 });
  }

  /* ── markers at equal time steps ──────────────────────────────────── */
  if (fired && show.ticks) {
    const n = scenario?.secondMarks ? Math.min(12, Math.max(2, Math.floor(f.tMax))) : 10;
    const marks = scenario?.secondMarks
      ? Array.from({ length: n + 1 }, (_, i) => ({ t: i, ...f.pos(i) })).filter((m) => m.t <= f.tMax)
      : f.ticks(n);
    for (const k of marks) {
      const p = M(k);
      dot(ctx, p.x, p.y, 3.5, { fill: P.surface, stroke: P.strong, width: 1.8 });
    }
    if (marks.length > 2) {
      const p = M(marks[1]);
      L.add(scenario?.secondMarks ? 'every 1 s' : 'equal time steps', p.x, p.y - 20,
            { color: P.muted, align: 'center', pri: 2, size: 16 });
    }
  }

  /* ── greatest height and range ────────────────────────────────────── */
  if (show.apex && f.apexInFlight) {
    const a = M({ x: f.horiz * f.tApex, y: f.apexHeight });
    // an open tick across the curve, so it reads as a place on the path
    stroke(ctx, [{ x: a.x, y: a.y - 9 }, { x: a.x, y: a.y + 9 }], { color: P.ink, width: 2 });
    stroke(ctx, [{ x: a.x - 7, y: a.y }, { x: a.x + 7, y: a.y }], { color: P.ink, width: 2 });
    L.add(`greatest height ${fmt(f.apexHeight, 2)} m`, a.x, a.y - 26, { color: P.ink, align: 'center', pri: 8, size: 19, weight: 600 });
  }

  // A vertical launch has no horizontal displacement to bracket — a bar of
  // zero width labelled 0.00 m is noise, not information.
  // The bracket measures what has HAPPENED, not what is going to. Drawing the
  // full range while the ball is halfway there puts a tick on empty grass
  // 56 m ahead of the object and claims it as a measurement.
  if (show.range && isFinite(f.tFlight) && Math.abs(f.range) > 0.5) {
    const done = fired ? Math.min(f.range, f.horiz * t) : 0;
    const landed = !fired || t >= f.tFlight - 1e-6;
    const value = landed ? f.range : done;
    if (Math.abs(value) > 0.3) {
      const y = groundY + 30, x0 = sx(0), x1 = sx(value);
      // nothing on screen to bracket means nothing worth labelling
      if (Math.max(x0, x1) > 0 && Math.min(x0, x1) < w) {
        stroke(ctx, [{ x: x0, y }, { x: x1, y }], { color: P.muted, width: 2.2 });
        for (const X of [x0, x1]) stroke(ctx, [{ x: X, y: y - 6 }, { x: X, y: y + 6 }], { color: P.muted, width: 2.2 });
        L.add(`${landed ? 'horizontal displacement' : 'travelled so far'} ${fmt(value, 2)} m`,
              clamp((x0 + x1) / 2, 150, w - 150), y + 18,
              { color: P.muted, align: 'center', pri: 7, size: 16, maxPush: 0 });
      }
    }
  }

  /* ── where the velocity turns 90° from the launch ─────────────────── */
  if (scenario?.showPerpendicular) {
    const tp = perpendicularTime(f);
    if (tp != null && tp <= f.tMax) {
      const p = M(f.pos(tp));
      dot(ctx, p.x, p.y, 6, { stroke: P.acc, width: 2.5 });
      L.add(`90° to launch at t = ${fmt(tp, 2)} s`, p.x, p.y - 22, { color: P.acc, align: 'center', pri: 8, size: 18 });
    }
  }

  /* ── the object, and its velocity now ─────────────────────────────── */
  const now = f.pos(fired ? t : 0), v = f.vel(fired ? t : 0), p = M(now);
  const vScale = clamp(cam.scale * 0.5, 1.1, 7);

  if (fired && show.components) {
    const hx = p.x + v.x * vScale, vy = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, hx, p.y, { color: P.vel, width: 2.4, head: 10, dash: [6, 5] });
    arrow(ctx, p.x, p.y, p.x, vy,  { color: P.vel, width: 2.4, head: 10, dash: [6, 5] });
    L.add(`horizontal ${fmt(v.x, 1)}`, hx + 8, p.y + 16, { color: P.vel, pri: 4, maxPush: 40, size: 17 });
    L.add(`vertical ${fmt(v.y, 1)}`, p.x + 10, vy - 14, { color: P.vel, pri: 4, maxPush: 40, size: 17 });
  }
  if (fired && show.velocity && !resolve) {
    const ex = p.x + v.x * vScale, ey = p.y - v.y * vScale;
    arrow(ctx, p.x, p.y, ex, ey, { color: P.vel, width: 4, head: 16 });
    L.add(`velocity ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, ex + 12, ey - 12, { color: P.vel, pri: 10, weight: 600, size: 19 });
  }
  if (fired && show.acceleration && f.params.g > 0) {
    const len = clamp(f.params.g * vScale * 0.5, 14, 60);
    arrow(ctx, p.x, p.y, p.x, p.y + len, { color: P.acc, width: 3.4, head: 13 });
    L.add(`g ${fmt(f.params.g, 2)} m s⁻²`, p.x - 10, p.y + len + 4, { color: P.acc, align: 'right', pri: 5, size: 17 });
  }

  ball({ ctx, scale: cam.scale }, p.x, p.y, P.vel, fired);

  /* ── resolving, at the instant that was clicked ───────────────────── */
  if (fired && resolve) {
    dot(ctx, p.x, p.y, 15, { stroke: P.vel, width: 2.2 });

    // Displacement first, and lighter: it spans the whole picture, and the
    // velocity is the thing the student actually pointed at.
    if (!resolve.vertical) {
      const l = M({ x: 0, y: f.params.h });
      resolveTriangle(ctx, L, {
        x0: l.x, y0: l.y, dx: p.x - l.x, dy: p.y - l.y,
        color: P.disp, width: 2.4, alpha: 0.95, pri: 12,
        labelX: `horizontal ${fmt(resolve.sx, 1)} m`,
        labelY: `vertical ${fmt(resolve.sy, 1)} m`,
        labelR: `${fmt(resolve.dist, 1)} m from the launch`,
      });
    }

    const rs = resolve.speed > 1e-6
      ? clamp(vScale, 150 / resolve.speed, 330 / resolve.speed)
      : vScale;
    if (resolve.vertical) {
      // No horizontal part means no triangle. One arrow, and say why.
      arrow(ctx, p.x, p.y, p.x, p.y - v.y * rs, { color: P.vel, width: 4.4, head: 16 });
      L.add(`vertical ${fmt(v.y, 1)} m s⁻¹ · no horizontal component`,
            p.x + 14, p.y - (v.y * rs) / 2, { color: P.vel, pri: 16, size: 17, weight: 600 });
    } else {
      resolveTriangle(ctx, L, {
        x0: p.x, y0: p.y, dx: v.x * rs, dy: -v.y * rs,
        color: P.vel, width: 3.4, pri: 16, angle: resolve.velocity.angle,
        labelX: `horizontal ${fmt(v.x, 1)} m s⁻¹`,
        labelY: `vertical ${fmt(v.y, 1)} m s⁻¹`,
        labelR: `${fmt(resolve.speed, 2)} m s⁻¹ at ${fmt(resolve.velocity.angle, 1)}°`,
      });
    }
  } else if (fired && hover) {
    dot(ctx, p.x, p.y, 16, { stroke: P.vel, width: 2 });
    L.add('click to resolve', p.x, p.y - 34,
          { color: P.vel, align: 'center', pri: 9, size: 15, weight: 600 });
  }

  /* ── launch point ─────────────────────────────────────────────────── */
  const lp = M({ x: 0, y: f.params.h });
  if (f.params.h > 0) {
    stroke(ctx, [{ x: lp.x, y: lp.y }, { x: lp.x, y: groundY }], { color: P.mark, width: 2.4, dash: [7, 5], alpha: 0.9 });
    L.add(`${fmt(f.params.h, 1)} m`, lp.x - 10, (lp.y + groundY) / 2, { color: P.mark, align: 'right', pri: 6, size: 16 });
  }
  dot(ctx, lp.x, lp.y, 3.5, { fill: P.strong });
  if (!fired) L.add(site.place, lp.x, lp.y - 30, { color: P.muted, align: 'center', pri: 4, size: 15 });

  /* ── scale bar and where we are ───────────────────────────────────── */
  // Bottom RIGHT: the range bracket owns the centre of the earth band, and
  // the two kept colliding, which sent the bracket's label off on a leader.
  const barX = w - 210;
  const bar = W2.scaleBar({ ctx, scale: cam.scale, tn }, barX, h - 28);
  L.add(bar.label, barX + bar.px + 9, h - 28, { color: P.strong, pri: 11, size: 14, bg: false });
  L.add(`${W2.BAND_LABEL[band]} · 1 unit = 1 m`, w - 12, h - 50,
        { color: P.strong, align: 'right', pri: 11, size: 13 });

  L.draw(ctx, w, h);
  cam._map = { sx, sy, px, py, su, pu, u0, ball: { x: p.x, y: p.y } };
  return { sx, sy };
}

/* ── the resolve figure ──────────────────────────────────────────────────
   The right-angled triangle every projectile answer starts with: horizontal
   component, vertical component, resultant across the corner. Drawn head to
   tail, so it is a triangle and not a parallelogram — that is the figure the
   mark scheme expects. Dashed is horizontal and solid is vertical, as
   everywhere else on this site. */
function resolveTriangle(ctx, L, A) {
  const { x0, y0, dx, dy, color, width = 3.2, alpha = 1, pri = 14,
          labelX, labelY, labelR, angle = null } = A;
  const cx = x0 + dx, cy = y0;            // the right angle sits here
  const tx = x0 + dx, ty = y0 + dy;       // the tip of the resultant
  if (Math.hypot(dx, dy) < 6) return;

  ctx.save(); ctx.globalAlpha = alpha;
  arrow(ctx, x0, y0, cx, cy, { color, width, head: 11, dash: [7, 5] });
  arrow(ctx, cx, cy, tx, ty, { color, width, head: 11 });
  arrow(ctx, x0, y0, tx, ty, { color, width: width + 1.2, head: 15 });
  ctx.restore();

  // the right angle, marked the way it is marked on paper
  const sq = 10;
  if (Math.abs(dx) > sq * 2 && Math.abs(dy) > sq * 2) {
    const ix = -Math.sign(dx) * sq, iy = Math.sign(dy) * sq;
    stroke(ctx, [{ x: cx + ix, y: cy }, { x: cx + ix, y: cy + iy }, { x: cx, y: cy + iy }],
           { color, width: 1.6, alpha: alpha * 0.85 });
  }

  // the angle to the horizontal, arced at the corner it is measured from
  if (angle != null && Math.abs(dx) > 26 && Math.abs(dy) > 10) {
    const r = Math.min(34, Math.hypot(dx, dy) * 0.38);
    const a1 = Math.atan2(dy, dx);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath(); ctx.arc(x0, y0, r, Math.min(0, a1), Math.max(0, a1)); ctx.stroke();
    ctx.restore();
    L.add(`${fmt(angle, 1)}°`, x0 + Math.cos(a1 / 2) * (r + 16), y0 + Math.sin(a1 / 2) * (r + 16),
          { color, align: 'center', pri: pri - 1, size: 15, weight: 600 });
  }

  // Labels sit on the far side of each leg, so they never cross the arrows.
  const away = dy > 0 ? 23 : -23;
  if (labelX) L.add(labelX, (x0 + cx) / 2, cy - away,
                    { color, align: 'center', pri, size: 16, weight: 600, maxPush: 40 });
  if (labelY) L.add(labelY, cx + (dx > 0 ? 14 : -14), (cy + ty) / 2,
                    { color, align: dx > 0 ? 'left' : 'right', pri, size: 16, weight: 600, maxPush: 40 });
  if (labelR) L.add(labelR, tx + (dx > 0 ? 14 : -14), ty + (dy > 0 ? 16 : -16),
                    { color, align: dx > 0 ? 'left' : 'right', pri: pri + 2, size: 18, weight: 700 });
}

/* ── the ball, to scale, with a ring so it never disappears ──────────── */
function ball(A, X, Y, col, fired) {
  const { ctx, scale } = A;
  const r = (D.prop.ball / 2) * scale;
  // Below about 10 px across, a 0.22 m ball is a speck. The ring is a
  // magnifier, not a second object — so it carries a faint fill of the same
  // hue, which reads as "the ball, enlarged" rather than "a circle nearby".
  if (r < 5) {
    const R = Math.max(10, r + 7);
    ctx.save(); ctx.globalAlpha = 0.16; dot(ctx, X, Y, R, { fill: col }); ctx.restore();
    dot(ctx, X, Y, R, { stroke: col, width: fired ? 1.8 : 1.3 });
  }
  dot(ctx, X, Y, Math.max(1.8, r), { fill: col });
  if (r >= 5) dot(ctx, X, Y, r, { stroke: P0(col), width: 1.2 });
}
const P0 = (c) => c;

/* ── the metre grid, as an optional overlay ──────────────────────────── */
function metreGrid({ ctx, w, h, su, sy, pu, py, cam, P, L, u0 }) {
  const stepX = niceStep(w / cam.scale, 10);
  const stepY = niceStep(h / cam.scale, 6);
  ctx.save();
  ctx.lineWidth = 1.2; ctx.strokeStyle = P.grid; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  // The grid is pinned to the LAUNCH POINT, not to the world origin, because
  // every number the student reads off it is a distance from the launch.
  for (let x = Math.floor((pu(0) - u0) / stepX) * stepX; x <= pu(w) - u0; x += stepX) {
    const X = Math.round(su(u0 + x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, h);
  }
  for (let y = Math.max(0, Math.floor(py(h) / stepY) * stepY); y <= py(0); y += stepY) {
    const Y = Math.round(sy(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(w, Y);
  }
  ctx.stroke();
  ctx.strokeStyle = P.gridMajor; ctx.lineWidth = 2;
  ctx.beginPath();
  const X0 = Math.round(su(u0)) + 0.5;
  if (X0 > 0 && X0 < w) { ctx.moveTo(X0, 0); ctx.lineTo(X0, h); }
  ctx.stroke();
  ctx.restore();

  for (let x = Math.floor((pu(0) - u0) / stepX) * stepX; x <= pu(w) - u0; x += stepX) {
    const X = su(u0 + x);
    if (X < 70 || X > w - 26) continue;
    L.add(fmt(x, stepX < 1 ? 1 : 0), X, Math.min(h - 56, sy(0) + 18),
          { color: P.muted, align: 'center', pri: -1, bg: false, size: 13 });
  }
}

/** Heights worth naming — the whole point of putting the flight in a place.
    "14 m s⁻¹ reaches 10 m" means nothing until 10 m is the back of a stand.
    But a landmark whose object is not in the cut is a label pointing at
    nothing, so each one has to find its own geometry on screen first. */
function landmarkLabels({ ctx, w, h, sy, su, L, tn, span, P, section, uMin, uMax }) {
  if (span > 620) return;
  const marks = W2.landmarksIn(section, uMin, uMax);
  ctx.save();
  ctx.setLineDash([3, 6]); ctx.lineWidth = 1;
  ctx.strokeStyle = cssVar('--border', tn.prop);
  for (const m of marks) {
    const Y = Math.round(sy(m.y)) + 0.5;
    if (Y < 24 || Y > h - 86) continue;
    const anchor = clamp(su(m.u), 96, w - 14);
    ctx.beginPath(); ctx.moveTo(Math.min(anchor, 70), Y); ctx.lineTo(anchor, Y); ctx.stroke();
    L.add(m.name, anchor + 6, Y, { color: P.muted, align: 'left', pri: -2, size: 13, maxPush: 0 });
  }
  ctx.restore();
}

const SNAPS = [{ y: D.goal.height, name: 'the crossbar' }, { y: D.roof.fasciaTop, name: 'the roof' },
               { y: D.sides.NS.el[0].y1, name: 'the lower tier' }, { y: D.sides.NS.el[6].y0, name: 'the upper tier front' }];
function snapName(y) {
  for (const s of SNAPS) if (Math.abs(y - s.y) < Math.max(0.3, s.y * 0.03)) return s.name;
  return null;
}
/** Dragging the line snaps it onto things you can see. */
export function snapHeight(y) {
  for (const s of SNAPS) if (Math.abs(y - s.y) < Math.max(0.35, s.y * 0.035)) return s.y;
  return y;
}

/** The fence is a defensive wall: four players, shoulder to shoulder. */
function defensiveWall(A, ob) {
  const { ctx, sx, sy, tn, scale } = A;
  const n = 4, wide = D.prop.person.w * 1.35;
  ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = tn.prop;
  const hpx = sy(0) - sy(ob.height);
  if (hpx < 5) { ctx.restore(); return; }
  for (let i = 0; i < n; i++) {
    const X = sx(ob.x) + (i - (n - 1) / 2) * wide * scale;
    const wpx = Math.max(2, D.prop.person.w * scale);
    ctx.beginPath(); ctx.arc(X, sy(ob.height) + hpx * 0.1, Math.max(1, hpx * 0.085), 0, 7); ctx.fill();
    ctx.fillRect(X - wpx / 2, sy(ob.height) + hpx * 0.18, wpx, hpx * 0.82);
  }
  ctx.restore();
}

/* ── small geometric questions the scene needs answered ─────────────── */

function timeAbove(f, height) {
  const { h, g } = f.params, uy = f.uy;
  if (g <= 1e-9) return null;
  const disc = uy * uy - 2 * g * (height - h);
  if (disc <= 0) return null;
  const r = Math.sqrt(disc);
  const t1 = (uy - r) / g, t2 = (uy + r) / g;
  const a = Math.max(0, Math.min(t1, t2)), b = Math.min(f.tMax, Math.max(t1, t2));
  return b > a ? { t1: a, t2: b } : null;
}

function clearsObstacle(f, ob) {
  if (f.horiz <= 1e-9) return false;
  const t = ob.x / f.horiz;
  if (t > f.tMax) return false;
  return f.pos(t).y > ob.height;
}

/** Does the path pass within a small radius of the target? */
function passesThrough(f, target) {
  const tol = Math.max(0.6, target.x * 0.02);
  let best = Infinity;
  for (let i = 0; i <= 400; i++) {
    const p = f.pos((i / 400) * f.tMax);
    best = Math.min(best, Math.hypot(p.x - target.x, p.y - target.y));
  }
  return best <= tol;
}

/** The instant the velocity is perpendicular to the launch velocity: u·v = 0. */
function perpendicularTime(f) {
  const { g } = f.params;
  if (g <= 1e-9 || f.uy <= 0) return null;
  const t = (f.horiz * f.horiz + f.uy * f.uy) / (g * f.uy);
  return t > 0 ? t : null;
}

export function attachControls(canvas, cam, onChange, getScene, onMarkerMove, onResolve = {}) {
  let drag = false, lx = 0, ly = 0, dragging = null, down = null, hovering = false;

  const active = () => (getScene?.() || {});

  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    const m = cam._map;
    if (!m) return null;
    return { x: m.px(e.clientX - r.left), y: m.py(e.clientY - r.top), sxp: e.clientX - r.left, syp: e.clientY - r.top };
  };

  /** What is under the pointer: the object, a draggable handle, or the arc. */
  const pick = (e) => {
    const { markers, scenario, traj, t, fired, dim } = active();
    const m = cam._map;
    if (!m || dim !== '2d') return null;
    const w = toWorld(e);
    if (!w) return null;
    const near = (px, py, r = 26) => Math.hypot(w.sxp - px, w.syp - py) < r;

    // The object comes first: it is what the eye is already on.
    if (traj && fired) {
      const b = traj.pos(t);
      if (near(m.sx(b.x), m.sy(b.y))) return { kind: 'ball', t };
    }
    if (scenario?.dragTarget && markers?.target && near(m.sx(markers.target.x), m.sy(markers.target.y))) return { kind: 'target' };
    if (scenario?.dragObstacle && markers?.obstacle && near(m.sx(markers.obstacle.x), m.sy(markers.obstacle.height))) return { kind: 'obstacle' };
    if (scenario?.dragLine && markers?.heightLine != null && Math.abs(w.syp - m.sy(markers.heightLine)) < 18) return { kind: 'heightLine' };

    // Anywhere on the arc already flown gives the same card at that instant —
    // catching a ball mid-flight is a reaction test, and this is not one.
    if (traj && fired && t > 1e-6) {
      let best = null;
      for (const q of traj.path(170, t)) {
        const dd = Math.hypot(w.sxp - m.sx(q.x), w.syp - m.sy(q.y));
        if (dd < 15 && (!best || dd < best.d)) best = { d: dd, t: q.t };
      }
      if (best) return { kind: 'path', t: best.t };
    }
    return null;
  };

  const isResolve = (k) => k === 'ball' || k === 'path';

  canvas.addEventListener('pointermove', (e) => {
    // Both cameras listen on this one canvas, so each must leave the cursor
    // alone when its own view is not the one on screen.
    if (active().dim !== '2d' || drag || dragging) return;
    const k = pick(e)?.kind || null;
    canvas.style.cursor = isResolve(k) ? 'pointer' : 'grab';
    const hv = isResolve(k);
    if (hv !== hovering) { hovering = hv; onResolve.hover?.(hv); }
  });

  canvas.addEventListener('pointerdown', (e) => {
    const got = pick(e);
    down = { x: e.clientX, y: e.clientY, pick: got };
    dragging = got && !isResolve(got.kind) ? got.kind : null;
    if (dragging) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; return; }
    drag = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { const w = toWorld(e); if (w && onMarkerMove) onMarkerMove(dragging, w); return; }
    if (!drag) return;
    cam.touched = true; cam.moving = true; cam.wantSpan = null; cam.band = 'free';
    cam.cx -= (e.clientX - lx) / cam.scale;
    cam.cy += (e.clientY - ly) / cam.scale;
    snapWant(cam);                        // a drag is direct: no easing
    lx = e.clientX; ly = e.clientY; onChange();
  });
  const end = (e, clicked) => {
    const was = down;
    drag = false; dragging = null; down = null;
    canvas.style.cursor = 'grab';
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    // A click is a press that did not move. Anything that moved was a pan, and
    // must not open a card nobody asked for.
    if (clicked && was?.pick && isResolve(was.pick.kind) && e
        && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 5) onResolve.click?.(was.pick.t);
  };
  canvas.addEventListener('pointerup', (e) => end(e, true));
  canvas.addEventListener('pointercancel', (e) => end(e, false));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); cam.touched = true;
    // Zoom about the pointer, so the thing being looked at stays put.
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const before = cam._map ? { u: cam._map.pu(mx), y: cam._map.py(my) } : null;
    cam.wantSpan = null; cam.band = 'free';
    const base = cam.want?.scale ?? cam.scale;
    const scale = clamp(base * Math.exp(-e.deltaY * 0.0016), 0.0035, 900);
    cam.moving = true;
    clearTimeout(attachControls._z);
    attachControls._z = setTimeout(() => { cam.moving = false; onChange(); }, 220);
    const box = canvas.getBoundingClientRect();
    cam.want = before
      ? { scale, cx: before.u - (mx - box.width / 2) / scale, cy: before.y + (my - box.height / 2) / scale }
      : { scale, cx: cam.cx, cy: cam.cy };
    onChange();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam.fit = true; cam.touched = false; onChange(); });
  canvas.style.cursor = 'grab';
}
