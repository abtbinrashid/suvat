// scene3d.js — the same flight, standing in the same place, seen in perspective.
//
// The motion is identical to the 2D view and so is the world: this file reads
// the very same records, extrudes them instead of cutting them, and puts the
// camera somewhere you can orbit. Drag to orbit, scroll to zoom.
//
// The scenery is projected once per camera position into an offscreen canvas.
// A flight never moves the camera, so during a flight exactly one bitmap is
// blitted and the only live drawing is the ball and its arrows.

import { fitCanvas, palette, stroke, arrow, dot, fmt, clamp, labels, cssVar } from './util.js';
import { makeView3D, fit3D } from './grid.js';
import { drawScenery3D, bearingName, farRings3D } from './world3d.js';
import { tones, layer, zoomBand, BAND_LABEL, fade } from './world2d.js';
import { siteFor, siteWorld } from '../world/world.js';
import { D } from '../world/dims.js';

let moving = false, movedAt = 0;

export function render(canvas, cam3, o) {
  const { traj: f, second, ghost, t, show, fired = true, markers = {}, scenario,
          resolve = null, hover = null } = o;
  const { ctx, w, h } = fitCanvas(canvas);
  if (!f) return;
  const P = palette();
  const L = labels();
  const tn = tones();
  const site = siteFor(scenario?.id);
  const toWorld = siteWorld(site);
  const dirVec = site.axis === 'x' ? { x: site.dir, z: 0 } : { x: 0, z: site.dir };

  const end = f.pos(f.tMax);
  const reach = Math.max(10, isFinite(end.x) ? end.x : f.horiz * f.tMax);
  const topY = Math.max(f.apexHeight, f.params.h, 5);
  if (cam3.fit) {
    fit3D(cam3, reach, topY, w, h, site.origin, dirVec);
    // Far enough back that the flight is standing in a stadium rather than
    // filling the frame on its own — the place is half the point.
    cam3.dist = clamp(cam3.dist * 1.15, 120, 3000);
    cam3.yaw = Math.atan2(dirVec.z, dirVec.x) - Math.PI * 0.68;
    // Look DOWN into the bowl. A roof that covers every seat covers the view
    // as well, so a camera outside the stadium and low sees nothing but a lid;
    // the default has to clear the rim on the way in.
    cam3.pitch = 0.62;
    snap3(cam3);                          // a fit arrives, it does not travel
  }

  clearOfRoof(cam3);
  const V = makeView3D(cam3, w, h);
  const span = (2 * cam3.dist * Math.tan((cam3.fov * Math.PI) / 360) * w) / h;
  const poly = (pts, st) => { for (const run of V.polyline(pts)) stroke(ctx, run, st); };
  const seg = (a, b, st) => { const q = V.segment(a, b); if (q) stroke(ctx, q, st); };
  const W = (p) => toWorld(p.x, p.y);

  /* ── the world ────────────────────────────────────────────────────── */
  sky3D(ctx, V, w, h, tn);
  const detail = !moving && performance.now() - movedAt > 200;
  const key = [w, h, document.documentElement.dataset.theme, show.xray === false ? 'solid' : 'xray',
               cam3.yaw.toFixed(3), cam3.pitch.toFixed(3), cam3.dist.toFixed(2),
               cam3.target.x.toFixed(1), cam3.target.y.toFixed(1), cam3.target.z.toFixed(1),
               detail ? 'hi' : 'lo'].join('|');
  const bg = layer('scenery3d', w, h, key, (g) => {
    g.clearRect(0, 0, w, h);
    // Anything closer than this goes glassy, so the stand between the camera
    // and the pitch stops being a wall without ceasing to be a stand.
    // Anything between the eye and what it is looking AT goes glassy — which
    // is the whole trick: the near stand stays a stand and stops being a wall.
    const xray = show.xray === false ? 0 : Math.max(12, cam3.dist * 0.70);
    drawScenery3D(g, V, { w, h, span, detail, xray });
    farRings3D(g, V, tn, span);
  });
  ctx.drawImage(bg, 0, 0, w, h);

  if (show.grid) metreGrid3D(ctx, V, P, L, { reach, site, w, h });

  /* ── markers ──────────────────────────────────────────────────────── */
  if (markers.heightLine != null) {
    const a = W({ x: -reach * 0.15, y: markers.heightLine }), b = W({ x: reach * 1.15, y: markers.heightLine });
    seg(a, b, { color: P.mark, width: 2.4, dash: [10, 7], alpha: 0.9 });
    const m = V.point(b);
    if (m) L.add(`${fmt(markers.heightLine, 1)} m`, m.x + 10, m.y, { color: P.mark, pri: 6, size: 16 });
  }
  if (markers.obstacle) {
    const half = D.goal.width / 2;
    const base = toWorld(markers.obstacle.x, 0), top = toWorld(markers.obstacle.x, markers.obstacle.height);
    const across = site.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const pts = [-half, half].map((s) => ({ x: base.x + across.x * s, y: 0, z: base.z + across.z * s }));
    poly([pts[0], { ...pts[0], y: top.y }, { ...pts[1], y: top.y }, pts[1]], { color: P.mark, width: 3 });
  }
  if (markers.target) {
    const p = V.point(W(markers.target));
    if (p) { dot(ctx, p.x, p.y, 12, { stroke: P.mark, width: 3 }); dot(ctx, p.x, p.y, 4, { fill: P.mark }); }
  }

  /* ── paths ────────────────────────────────────────────────────────── */
  if (ghost && show.path) poly(ghost.map(W), { color: P.faint, width: 2.8 });
  if (second) poly(second.path(200).map(W), { color: P.second, width: 3.2, dash: [9, 6], alpha: .9 });
  if (show.path && fired) {
    const pts = f.path(260, t).concat([{ t, ...f.pos(t) }]).map(W);
    poly(pts, { color: P.surface, width: 7.2, alpha: 0.45 });
    poly(pts, { color: P.vel, width: 4.2 });
  }

  // The launch mast drops to the DECK the launch sits on, not to y = 0 —
  // from the front row of an upper tier, the ground is 25 m of stand away.
  if (f.params.h > 0) {
    const foot = deckUnder(site);
    seg(toWorld(0, foot), toWorld(0, f.params.h), { color: P.strong, width: 3, dash: [7, 5] });
  }

  const now = f.pos(fired ? t : 0), v = f.vel(fired ? t : 0);
  const wp = W(now);
  const p = V.point(wp);
  if (p) {
    // the dropped line to the ground is what makes "height" a thing you can see
    seg(wp, { ...wp, y: 0 }, { color: P.disp, width: 2.2, dash: [6, 6] });
    const sh = V.point({ ...wp, y: 0 });
    if (sh) dot(ctx, sh.x, sh.y, 4, { fill: P.disp });

    if (fired && show.velocity && !resolve) {
      const e = V.point(W({ x: now.x + v.x * 0.55, y: now.y + v.y * 0.55 }));
      if (e) {
        arrow(ctx, p.x, p.y, e.x, e.y, { color: P.vel, width: 3.8, head: 15 });
        L.add(`velocity ${fmt(Math.hypot(v.x, v.y), 2)} m s⁻¹`, e.x + 12, e.y - 12,
              { color: P.vel, pri: 10, size: 19, weight: 600 });
      }
    }
    if (fired && show.acceleration && f.params.g > 0) {
      const e = V.point({ ...wp, y: now.y - f.params.g * 0.4 });
      if (e) arrow(ctx, p.x, p.y, e.x, e.y, { color: P.acc, width: 3.2, head: 13 });
    }

    // the ball at its real 0.22 m, with the ring that keeps it findable
    const rpx = (D.prop.ball / 2) * (V.f / V.distTo(wp));
    dot(ctx, p.x, p.y, Math.max(1.6, rpx), { fill: P.vel });
    dot(ctx, p.x, p.y, Math.max(11, rpx + 7), { stroke: P.vel, width: fired ? 2 : 1.4 });

    /* ── resolving, at the instant that was clicked ─────────────────── */
    // Only ever two components. The bearing is how the flight is placed in
    // the world, not a third thing to resolve, so 3D resolves exactly what
    // 2D resolves and the extra dimension is there to look along.
    if (fired && resolve) {
      dot(ctx, p.x, p.y, Math.max(15, rpx + 11), { stroke: P.vel, width: 2.2 });
      const sq = Math.max(0.4, Math.max(reach, topY) * 0.022);

      if (!resolve.vertical) {
        tri3D(ctx, L, V, W, {
          a: { x: 0, y: f.params.h }, c: { x: now.x, y: f.params.h }, b: { x: now.x, y: now.y },
          color: P.disp, width: 2.4, alpha: 0.95, pri: 12, sq,
          labelX: `horizontal ${fmt(resolve.sx, 1)} m`,
          labelY: `vertical ${fmt(resolve.sy, 1)} m`,
          labelR: `${fmt(resolve.dist, 1)} m from the launch`,
        });
      }

      const mpp = V.distTo(wp) / V.f;            // metres per pixel, at the ball
      const k = resolve.speed > 1e-6
        ? clamp((165 * mpp) / resolve.speed, 0.04, (Math.max(reach, topY) * 0.6) / resolve.speed)
        : 0.5;
      if (resolve.vertical) {
        const e = V.point(W({ x: now.x, y: now.y + v.y * k }));
        if (e) {
          arrow(ctx, p.x, p.y, e.x, e.y, { color: P.vel, width: 4.2, head: 16 });
          L.add(`vertical ${fmt(v.y, 1)} m s⁻¹ · no horizontal component`, e.x + 12, e.y,
                { color: P.vel, pri: 16, size: 17, weight: 600 });
        }
      } else {
        tri3D(ctx, L, V, W, {
          a: { x: now.x, y: now.y },
          c: { x: now.x + v.x * k, y: now.y },
          b: { x: now.x + v.x * k, y: now.y + v.y * k },
          color: P.vel, width: 3.4, pri: 16, sq,
          labelX: `horizontal ${fmt(v.x, 1)} m s⁻¹`,
          labelY: `vertical ${fmt(v.y, 1)} m s⁻¹`,
          labelR: `${fmt(resolve.speed, 2)} m s⁻¹ at ${fmt(resolve.velocity.angle, 1)}°`,
        });
      }
    } else if (fired && hover) {
      dot(ctx, p.x, p.y, Math.max(16, rpx + 12), { stroke: P.vel, width: 2 });
      L.add('click to resolve', p.x, p.y - 34,
            { color: P.vel, align: 'center', pri: 9, size: 15, weight: 600 });
    }
  }
  if (second) {
    const q = V.point(W(second.pos(clamp(t, 0, second.tMax))));
    if (q && t > 0) { dot(ctx, q.x, q.y, 4, { fill: P.second }); dot(ctx, q.x, q.y, 11, { stroke: P.second, width: 1.6 }); }
  }

  if (show.apex && f.apexInFlight) {
    const a = V.point(W({ x: f.horiz * f.tApex, y: f.apexHeight }));
    if (a) { dot(ctx, a.x, a.y, 4.5, { fill: P.ink });
      L.add(`greatest height ${fmt(f.apexHeight, 2)} m`, a.x, a.y - 24, { color: P.ink, align: 'center', pri: 8, size: 18, weight: 600 }); }
  }

  if (!fired) {
    const lp = V.point(toWorld(0, f.params.h));
    if (lp) L.add(site.place, lp.x, lp.y - 28, { color: P.muted, align: 'center', pri: 4, size: 15 });
  }

  groundScaleBar(ctx, V, L, P);
  heightLadder(ctx, V, L, P, toWorld, Math.max(f.apexHeight, f.params.h), deckUnder(site));
  L.add(`${BAND_LABEL[zoomBand(span)]} · looking ${bearingName(cam3.yaw)} · eye ${fmt(V.eye.y, 0)} m up · 1 unit = 1 m`,
        18, h - 32, { color: P.strong, pri: 11, size: 13 });
  L.add('drag to orbit · scroll to zoom · double-click to refit', w - 12, h - 14,
        { color: P.muted, align: 'right', pri: 4, size: 13 });
  L.draw(ctx, w, h);
  cam3._V = V; cam3._W = W; cam3._ball = p ? { x: p.x, y: p.y } : null;
}

/* ── the resolve figure, in the plane of the flight ──────────────────────
   The same triangle as the 2D view, but its corners are world points, so
   perspective does the work and the figure stands in the stadium rather than
   being pasted on the glass. Flight coordinates in, screen out. */
function tri3D(ctx, L, V, W, A) {
  const { a, c, b, color, width = 3, alpha = 1, pri = 14, sq = 0,
          labelX, labelY, labelR } = A;
  const pa = V.point(W(a)), pc = V.point(W(c)), pb = V.point(W(b));
  if (!pa || !pc || !pb) return;
  if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 6) return;

  ctx.save(); ctx.globalAlpha = alpha;
  arrow(ctx, pa.x, pa.y, pc.x, pc.y, { color, width, head: 11, dash: [7, 5] });
  arrow(ctx, pc.x, pc.y, pb.x, pb.y, { color, width, head: 11 });
  arrow(ctx, pa.x, pa.y, pb.x, pb.y, { color, width: width + 1.1, head: 15 });
  ctx.restore();

  if (sq > 0 && Math.abs(c.x - a.x) > sq * 2 && Math.abs(b.y - c.y) > sq * 2) {
    const ix = -Math.sign(c.x - a.x) * sq, iy = Math.sign(b.y - c.y) * sq;
    const q = [{ x: c.x + ix, y: c.y }, { x: c.x + ix, y: c.y + iy }, { x: c.x, y: c.y + iy }]
      .map((o) => V.point(W(o)));
    if (q.every(Boolean)) stroke(ctx, q, { color, width: 1.6, alpha: alpha * 0.85 });
  }

  const away = pb.y > pa.y ? 18 : -18;
  const side = pc.x >= pa.x ? 1 : -1;
  if (labelX) L.add(labelX, (pa.x + pc.x) / 2, (pa.y + pc.y) / 2 - away,
                    { color, align: 'center', pri, size: 16, weight: 600, maxPush: 40 });
  if (labelY) L.add(labelY, pc.x + side * 14, (pc.y + pb.y) / 2,
                    { color, align: side > 0 ? 'left' : 'right', pri, size: 16, weight: 600, maxPush: 40 });
  if (labelR) L.add(labelR, pb.x + side * 14, pb.y + (pb.y > pa.y ? 16 : -16),
                    { color, align: side > 0 ? 'left' : 'right', pri: pri + 2, size: 18, weight: 700 });
}

/** Where the ground plane runs out. Without it the district ends on a blade. */
function horizonHaze(ctx, V, w, h, tn) {
  const far = V.point({ x: V.eye.x + V.fwd.x * 90000, y: 0, z: V.eye.z + V.fwd.z * 90000 });
  const y = far ? far.y : h * 0.35;
  if (y < -200 || y > h + 200) return;
  const g = ctx.createLinearGradient(0, y - 70, 0, y + 8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, tn.skyBottom);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = g;
  ctx.fillRect(0, y - 70, w, 78); ctx.restore();
}

/** A stick of known length, laid on the ground in the plane of the flight.
    A scale bar in screen pixels means nothing in perspective; one lying in
    the world foreshortens with everything else, which is the point. */
function groundScaleBar(ctx, V, L, P) {
  // Laid along the south touchline: open ground, in view from every angle,
  // and never inside a building. A bar drawn in the flight plane ended up
  // buried in the north stand and painted straight over the roof, because
  // overlays have no depth buffer to be occluded by.
  const z = (V.eye.z > 0 ? -1 : 1) * (D.pitch.halfW - 2), y = 0.06;
  const a = V.point({ x: -D.pitch.halfL + 4, y, z });
  if (!a) return;
  for (const len of [100, 50, 20, 10, 5]) {
    const b = V.point({ x: -D.pitch.halfL + 4 + len, y, z });
    if (!b) continue;
    const px = Math.hypot(b.x - a.x, b.y - a.y);
    if (px < 60 || px > 460) continue;
    // Chrome, not physics: it has to be findable and it must not be the
    // heaviest mark in the frame, which at 2.4 px of --ink-strong it was.
    const col = cssVar('--ink-muted', '#888');
    stroke(ctx, [a, b], { color: col, width: 1.6 });
    for (const q of [a, b]) {
      const n = { x: -(b.y - a.y) / px, y: (b.x - a.x) / px };
      stroke(ctx, [{ x: q.x - n.x * 5, y: q.y - n.y * 5 }, { x: q.x + n.x * 5, y: q.y + n.y * 5 }],
             { color: col, width: 1.6 });
    }
    L.add(`${len} m`, (a.x + b.x) / 2, (a.y + b.y) / 2 + 14,
          { color: P.muted, align: 'center', pri: 3, size: 13 });
    return;
  }
}

/** Heights, read off the launch point itself. */
function heightLadder(ctx, V, L, P, toWorld, topY, foot) {
  const step = topY > 70 ? 20 : topY > 28 ? 10 : 5;
  const top = Math.ceil(topY / step) * step;
  const base = V.point(toWorld(0, foot));
  const p0 = V.point(toWorld(0, 0)), p1 = V.point(toWorld(0, step));
  if (!base || !p0 || !p1) return;
  // Rungs closer together than they are tall cannot be read, and a label
  // queue that shuffles them to find space turns a ruler into a word search.
  if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 17) return;
  for (let y = step; y <= top; y += step) {
    const a = V.point(toWorld(0, y)), b = V.point(toWorld(-step * 0.22, y));
    if (!a || !b) continue;
    stroke(ctx, [a, b], { color: cssVar('--border', '#888'), width: 1.4 });
    L.add(`${y}`, b.x - 6, b.y, { color: P.muted, align: 'right', pri: -1, size: 13, bg: false, maxPush: 0 });
  }
  const t = V.point(toWorld(0, top));
  if (t) stroke(ctx, [base, t], { color: cssVar('--border', '#888'), width: 1.2, dash: [4, 5] });
}

/** Keep the eye out of the roof slab.
    The roof is 43–48 m of solid geometry over an ellipse 250 × 200 m wide.
    An eye inside it sees nothing but the underside, which is how the
    "touchline" view came to be a grey void — and a student orbiting by hand
    can wander in just as easily, so the camera is pushed out of it here. */
function clearOfRoof(cam3) {
  const R = D.roof, B = D.bowl;
  for (let i = 0; i < 24; i++) {
    const cp = Math.cos(cam3.pitch);
    const e = { x: cam3.target.x + cam3.dist * cp * Math.cos(cam3.yaw),
                y: cam3.target.y + cam3.dist * Math.sin(cam3.pitch),
                z: cam3.target.z + cam3.dist * cp * Math.sin(cam3.yaw) };
    if (e.y < R.fasciaBottom - 1.5 || e.y > R.fasciaTop + 1.5) return;
    // inside the bowl's plan?
    const qx = Math.max(Math.abs(e.x) - (B.halfL - B.cornerR), 0);
    const qz = Math.max(Math.abs(e.z) - (B.halfW - B.cornerR), 0);
    if (Math.hypot(qx, qz) + Math.min(Math.max(qx, qz), 0) - B.cornerR > 2) return;
    // inside the opening, where there is no roof?
    const ox = Math.max(Math.abs(e.x) - (D.bowl.frontL - R.ringInset - (D.bowl.frontR - R.ringInset)), 0);
    const oz = Math.max(Math.abs(e.z) - (D.bowl.frontW - R.ringInset - (D.bowl.frontR - R.ringInset)), 0);
    if (Math.hypot(ox, oz) + Math.min(Math.max(ox, oz), 0) - (D.bowl.frontR - R.ringInset) < -1) return;
    cam3.pitch = clamp(cam3.pitch + 0.045, 0.02, 1.45);
  }
}

/* The sky, with the sun actually in it. The horizon is where the ground
   plane vanishes, so the warm band is pinned to that rather than to the
   bottom of the canvas — tilt the camera and the sunset stays put. */
function sky3D(ctx, V, w, h, tn) {
  const far = V.point({ x: V.eye.x + V.fwd.x * 90000, y: 0, z: V.eye.z + V.fwd.z * 90000 });
  const hz = clamp(far ? far.y : h * 0.4, -h, h * 2);
  const g = ctx.createLinearGradient(0, Math.min(0, hz - h), 0, hz);
  g.addColorStop(0, tn.skyTop);
  g.addColorStop(0.78, tn.skyMid);
  g.addColorStop(1, tn.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // the sun itself, placed in the world to the west and low
  const sun = V.point({ x: -9000, y: 2600, z: 1800 });
  const dark = (document.documentElement.dataset.theme || 'dark') !== 'light';
  if (!dark && sun && sun.x > -w && sun.x < w * 2) {
    const r = Math.max(w, h);
    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, r);
    glow.addColorStop(0, tn.sunGlow);
    glow.addColorStop(0.3, 'rgba(255,206,138,0.16)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h); ctx.restore();
    ctx.save(); ctx.fillStyle = tn.sun; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 16, 0, 7); ctx.fill(); ctx.restore();
  }
  // The ground, all the way to the horizon. A finite plane has an edge, and
  // from 350 m up you can see it; painting the far ground behind everything
  // means the edge has the same colour on both sides and disappears.
  if (hz < h) {
    ctx.save();
    ctx.fillStyle = tn.terrain;
    ctx.fillRect(0, Math.max(0, hz), w, h - Math.max(0, hz));
    const band = ctx.createLinearGradient(0, hz - 46, 0, hz + 26);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.55, tn.haze);
    band.addColorStop(1, tn.haze);
    ctx.globalAlpha = 0.9; ctx.fillStyle = band;
    ctx.fillRect(0, hz - 46, w, 72);
    ctx.restore();
  }

  // cloud banks, far enough out to read as sky rather than as geometry
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(140,165,205,0.06)' : 'rgba(255,255,255,0.38)';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const c = V.point({ x: Math.cos(a) * 7000, y: 900 + ((i * 53) % 7) * 120, z: Math.sin(a) * 7000 });
    if (!c || c.x < -400 || c.x > w + 400 || c.y > hz) continue;
    ctx.globalAlpha = 0.55 + ((i * 17) % 5) / 12;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 150, 22, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x + 60, c.y - 16, 85, 18, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/** The optional metre grid, laid on the ground in the plane of the flight. */
function metreGrid3D(ctx, V, P, L, { reach, site }) {
  const step = reach > 400 ? 100 : reach > 120 ? 20 : 10;
  const n = Math.ceil(reach / step) + 2;
  const across = site.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 };
  const along = site.axis === 'x' ? { x: site.dir, z: 0 } : { x: 0, z: site.dir };
  const at = (a, c) => ({ x: site.origin.x + along.x * a + across.x * c, y: 0.05,
                          z: site.origin.z + along.z * a + across.z * c });
  const lim = step * 4;
  for (let i = -1; i <= n; i++) {
    const a = i * step;
    const q = V.segment(at(a, -lim), at(a, lim));
    if (q) stroke(ctx, q, { color: i === 0 ? P.gridMajor : P.grid, width: i === 0 ? 2 : 1.2 });
    const lab = V.point(at(a, 0));
    if (lab && a >= 0) L.add(fmt(a, 0), lab.x, lab.y + 14, { color: P.faint, align: 'center', pri: -2, size: 13, bg: false });
  }
  for (let j = -4; j <= 4; j++) {
    const q = V.segment(at(-step, j * step), at(n * step, j * step));
    if (q) stroke(ctx, q, { color: j === 0 ? P.gridMajor : P.grid, width: j === 0 ? 2 : 1.2 });
  }
}

export function attachControls3D(canvas, cam3, onChange, getScene, onResolve = {}) {
  let drag = false, lx = 0, ly = 0, down = null, hovering = false;

  const active = () => (getScene?.() || {});

  /** The object, or anywhere on the arc already flown. No handles up here. */
  const pick = (e) => {
    const { traj, t, fired, dim } = active();
    const V = cam3._V, W = cam3._W;
    if (dim !== '3d' || !traj || !fired || !V || !W) return null;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;

    const bp = V.point(W(traj.pos(t)));
    if (bp && Math.hypot(mx - bp.x, my - bp.y) < 26) return { kind: 'ball', t };
    if (t > 1e-6) {
      let best = null;
      for (const q of traj.path(150, t)) {
        const sp = V.point(W(q));
        if (!sp) continue;
        const dd = Math.hypot(mx - sp.x, my - sp.y);
        if (dd < 15 && (!best || dd < best.d)) best = { d: dd, t: q.t };
      }
      if (best) return { kind: 'path', t: best.t };
    }
    return null;
  };

  canvas.addEventListener('pointermove', (e) => {
    // Both cameras listen on this one canvas, so each leaves the cursor alone
    // when its own view is not the one on screen.
    if (active().dim !== '3d' || drag) return;
    const hv = !!pick(e);
    canvas.style.cursor = hv ? 'pointer' : 'grab';
    if (hv !== hovering) { hovering = hv; onResolve.hover?.(hv); }
  });

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, pick: pick(e) };
    drag = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    moving = true; movedAt = performance.now(); cam3.touched = true;
    cam3.yaw += (e.clientX - lx) * 0.008;
    cam3.pitch = clamp(cam3.pitch - (e.clientY - ly) * 0.006, 0.02, 1.45);
    snap3(cam3);                          // a drag is direct: no easing
    lx = e.clientX; ly = e.clientY; onChange();
  });
  const end = (e, clicked) => {
    const was = down;
    drag = false; moving = false; down = null; canvas.style.cursor = 'grab';
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    // A press that did not move is a click; anything else was an orbit.
    if (clicked && was?.pick && e && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 5) {
      onResolve.click?.(was.pick.t);
    }
    onChange();
  };
  canvas.addEventListener('pointerup', (e) => end(e, true));
  canvas.addEventListener('pointercancel', (e) => end(e, false));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    moving = true; movedAt = performance.now(); cam3.touched = true;
    const base = cam3.want?.dist ?? cam3.dist;
    cam3.want = { ...(cam3.want || {}), dist: clamp(base * Math.exp(e.deltaY * 0.0014), 8, 6000),
                  yaw: cam3.want?.yaw ?? cam3.yaw, pitch: cam3.want?.pitch ?? cam3.pitch,
                  target: cam3.want?.target ?? { ...cam3.target } };
    onChange();
    clearTimeout(attachControls3D._t);
    attachControls3D._t = setTimeout(() => { moving = false; onChange(); }, 240);
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { cam3.fit = true; cam3.touched = false; onChange(); });
}

/** Named viewpoints, so "behind the goal" is one click rather than a drag.
    They are fixed to the WORLD, not to the flight: the place is the constant
    and the flight is the thing that moves around inside it. */
/** The height of whatever the launch point stands on, so the mast has a foot.
    From the front row of an upper tier, the ground is 25 m of stand away;
    dropping the mast to y = 0 ran it through the building. */
function deckUnder(site) {
  const perp = site.axis === 'x' ? Math.abs(site.origin.x) : Math.abs(site.origin.z);
  const spec = site.axis === 'x' ? (site.origin.x < 0 ? D.sides.W : D.sides.E) : D.sides.NS;
  const d = perp - spec.front;
  if (d < 0 || d > spec.out) return 0;                 // over open ground
  let y = 0;
  for (const el of spec.el) {
    if (d < Math.min(el.d0, el.d1) - 1e-9 || d > Math.max(el.d0, el.d1) + 1e-9) continue;
    const k = Math.abs(el.d1 - el.d0) < 1e-9 ? 0 : (d - el.d0) / (el.d1 - el.d0);
    y = Math.max(y, el.y0 + (el.y1 - el.y0) * k);
  }
  return y;
}

export const VIEWS = {
  // Eye positions chosen inside or over the bowl: anywhere outside it and low
  // down, a roof that covers every seat covers the flight too.
  // A television camera high on the south side. Yaw is deliberately OFF the
  // halfway line: dead square to the flight plane, a parabola collapses into
  // a vertical stick, which is the one thing this view must not do.
  // Eye over the south run-off, 36 m up, inside the roof opening: the one
  // place a camera can sit on the touchline side and still see sky.
  touchline: { yaw: 1.995, pitch: 0.110, dist: 73, target: { x: 0, y: 26, z: -26 } },
  // Behind the west goal, up in the single steep tier, again off-axis.
  // Behind the west goal, over the run-off and inside the opening.
  goal:      { yaw: 2.967, pitch: 0.115, dist: 70, target: { x: 10, y: 24, z: 0 } },
  // High and oblique: straight down through the opening shows only a lid.
  aerial:    { yaw: 2.35, pitch: 0.86, dist: 300, target: { x: 0, y: 8, z: 0 } },
  // Far enough out for the district, close enough for the bowl to read.
  district:  { yaw: 2.05, pitch: 0.42, dist: 780, target: { x: 0, y: 30, z: 0 } },
};
export function setView(cam3, name, site) {
  const v = VIEWS[name]; if (!v) return;
  const target = { ...v.target };
  // keep the flight in frame: nudge the target towards where it happens
  if (site && name !== 'district') {
    target.x = target.x * 0.6 + site.origin.x * 0.4;
    target.z = target.z * 0.6 + site.origin.z * 0.4;
  }
  cam3.fit = false; cam3.touched = true;
  // the camera FLIES there: a cut between two viewpoints loses you, a move
  // between them tells you how they relate
  cam3.want = { yaw: nearestYaw(cam3.yaw, v.yaw), pitch: v.pitch, dist: v.dist, target };
}

/** Take the short way round. 350° to 10° is 20°, not 340°. */
function nearestYaw(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

/* ── moving the camera, rather than teleporting it ─────────────────────
   Distance eases in LOG space because zoom is multiplicative; angles and the
   look-at point ease linearly. Dragging stays immediate — lag in a direct
   manipulation feels like a fault, not like smoothing. */
export function easeCamera3D(cam3, dt) {
  if (!cam3.want) return false;
  const k = 1 - Math.exp(-dt * 7.5);
  const W = cam3.want;
  let moving = false;
  if (W.dist != null) {
    const r = Math.log(W.dist / cam3.dist);
    if (Math.abs(r) > 0.0008) { cam3.dist *= Math.exp(r * k); moving = true; } else cam3.dist = W.dist;
  }
  for (const key of ['yaw', 'pitch']) {
    if (W[key] == null) continue;
    const d = W[key] - cam3[key];
    if (Math.abs(d) > 0.0012) { cam3[key] += d * k; moving = true; } else cam3[key] = W[key];
  }
  if (W.target) {
    for (const key of ['x', 'y', 'z']) {
      const d = W.target[key] - cam3.target[key];
      if (Math.abs(d) > 0.05) { cam3.target[key] += d * k; moving = true; } else cam3.target[key] = W.target[key];
    }
  }
  // A travelling camera invalidates the scenery cache on every frame, so a
  // full-detail repaint would make the smooth move the jerkiest thing in the
  // app. While it travels it travels cheap; the moment it stops, it sharpens.
  if (moving) movedAt = performance.now();
  return moving;
}
const snap3 = (c) => { c.want = { yaw: c.yaw, pitch: c.pitch, dist: c.dist, target: { ...c.target } }; };
