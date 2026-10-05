// launch-map.mjs — a plan of the world with every scenario's launch site on it.
//
// Generated from the records the app renders, so it cannot drift out of step:
// the pitch, the bowl and the district come out of dims.js and world.js, and
// every arrow is the real flight computed by the real engine.
//
//   node tools/launch-map.mjs > design/launch-map.svg

import { D, rake } from '../js/world/dims.js';
import { SITES, roundedRect } from '../js/world/world.js';
import { SCENARIOS } from '../js/scenarios.js';
import { flight } from '../js/core/projectile.js';

const W = 1560, H = 1020;
const o = [];
const put = (s) => o.push(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ── one reusable plan painter ──────────────────────────────────────── */
function panel({ cx, cy, px, py, pw, ph, ext, detail }) {
  const S = Math.min(pw, ph) / (ext * 2);
  const X = (x) => px + pw / 2 + (x - cx) * S;
  const Z = (z) => py + ph / 2 + (z - cy) * S;
  const rect = (x0, x1, z0, z1, fill, op = 1) =>
    put(`<rect x="${X(x0).toFixed(1)}" y="${Z(z0).toFixed(1)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((z1 - z0) * S).toFixed(1)}" fill="${fill}" opacity="${op}"/>`);
  const path = (pts) => pts.map((p, i) => `${i ? 'M' : 'M'}${X(p.x).toFixed(1)} ${Z(p.z).toFixed(1)}`).join('');

  put(`<clipPath id="clip${px}${py}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12"/></clipPath>`);
  put(`<g clip-path="url(#clip${px}${py})">`);
  put(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#e6e2db"/>`);

  for (const p of D.parks) rect(p.x[0], p.x[1], p.z[0], p.z[1], '#cfdcc0');
  for (const t of D.terraces) rect(t.x[0], t.x[1], t.z[0], t.z[1], '#dfd6ce');
  for (const c of D.carParks) rect(c.x[0], c.x[1], c.z[0], c.z[1], '#d6d2cb');
  const R = D.road, FAR = 3000;
  for (const [a, f] of [[R.forecourt, '#e4e0d9'], [R.pavementWide, '#e4e0d9'], [R.carriagewayA, '#bcb9b4'],
                        [R.median, '#cfdcc0'], [R.carriagewayB, '#bcb9b4'], [R.pavement, '#e4e0d9']])
    rect(-FAR, FAR, a[0], a[1], f);
  rect(D.roadW.x[0] - D.roadW.pavement, D.roadW.x[1] + D.roadW.pavement, -FAR, FAR, '#e4e0d9');
  rect(D.roadW.x[0], D.roadW.x[1], -FAR, FAR, '#bcb9b4');
  rect(D.station.x[0] - 160, D.station.x[1] + 160, D.station.tracks.z[0], D.station.tracks.z[1], '#cac5be');
  rect(D.station.x[0], D.station.x[1], D.station.z[0], D.station.z[1], '#b9c7d1');

  const PD = D.podium, B = D.bowl;
  rect(-PD.halfL, PD.halfL, -PD.halfW, PD.halfW, '#dcd7cf');
  const ring = (pts, fill, st) =>
    put(`<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Z(p.z).toFixed(1)}`).join(' ')} Z" fill="${fill}" stroke="${st}" stroke-width="1.2"/>`);
  ring(roundedRect(B.halfL, B.halfW, B.cornerR), '#c7c2b9', '#99938a');
  ring(roundedRect(D.sides.W.front, D.sides.NS.front, 30), '#aea89e', '#8e887e');
  rect(-D.surface.halfL, D.surface.halfL, -D.surface.halfW, D.surface.halfW, '#9fb68c');
  rect(-D.pitch.halfL, D.pitch.halfL, -D.pitch.halfW, D.pitch.halfW, '#8fab78');

  if (detail) {
    const P = D.pitch, w = 1.3;
    const line = (x0, z0, x1, z1) =>
      put(`<line x1="${X(x0).toFixed(1)}" y1="${Z(z0).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Z(z1).toFixed(1)}" stroke="#fff" stroke-width="${w}"/>`);
    put(`<rect x="${X(-P.halfL).toFixed(1)}" y="${Z(-P.halfW).toFixed(1)}" width="${(P.length * S).toFixed(1)}" height="${(P.width * S).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${w}"/>`);
    line(0, -P.halfW, 0, P.halfW);
    put(`<circle cx="${X(0).toFixed(1)}" cy="${Z(0).toFixed(1)}" r="${(P.centreCircleR * S).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${w}"/>`);
    for (const s of [-1, 1]) {
      const gl = s * P.halfL;
      put(`<rect x="${X(Math.min(gl, gl - s * P.penaltyDepth)).toFixed(1)}" y="${Z(-P.penaltyHalfW).toFixed(1)}" width="${(P.penaltyDepth * S).toFixed(1)}" height="${(P.penaltyHalfW * 2 * S).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${w}"/>`);
      put(`<rect x="${X(Math.min(gl, gl - s * P.goalAreaDepth)).toFixed(1)}" y="${Z(-P.goalAreaHalfW).toFixed(1)}" width="${(P.goalAreaDepth * S).toFixed(1)}" height="${(P.goalAreaHalfW * 2 * S).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${w}"/>`);
      put(`<rect x="${X(Math.min(gl, gl + s * D.goal.netDepth)).toFixed(1)}" y="${Z(-D.goal.width / 2).toFixed(1)}" width="${(D.goal.netDepth * S).toFixed(1)}" height="${(D.goal.width * S).toFixed(1)}" fill="#fff" opacity="0.65"/>`);
    }
    put(`<ellipse cx="${X(0).toFixed(1)}" cy="${Z(0).toFixed(1)}" rx="${(D.roof.ringA * S).toFixed(1)}" ry="${(D.roof.ringB * S).toFixed(1)}" fill="none" stroke="#6f6a62" stroke-dasharray="7 5" stroke-width="1.4"/>`);
  }
  put('</g>');
  put(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="#c9c4bc" rx="12"/>`);
  return { X, Z, S };
}

put(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Instrument Sans, system-ui, sans-serif">`);
put(`<style>
 .t{font-size:24px;font-weight:600;fill:#1a1714}
 .h{font-size:14px;font-weight:600;fill:#1a1714;letter-spacing:.04em;text-transform:uppercase}
 .s{font-size:13px;fill:#6b665e}
 .l{font-size:13px;fill:#4a463f}
 .n{font-size:13px;font-weight:700;fill:#fff}
 .k{font-size:14px;font-weight:600;fill:#1a1714}
 .km{font-size:13px;fill:#6b665e}
</style>`);
put(`<rect width="100%" height="100%" fill="#f1efea"/>`);
put(`<defs>
 <marker id="ax" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#4c5a3f"/></marker>
 <marker id="az" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#4a4660"/></marker>
</defs>`);
put(`<text class="t" x="40" y="46">Where every scenario launches from</text>`);
const COUNT = SCENARIOS.filter((x) => SITES[x.id]).length;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
               'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const spell = (n) => WORDS[n] || String(n);
put(`<text class="s" x="40" y="68">One world, ${spell(COUNT)} situations. Plan, north up, 1 unit = 1 metre. Every arrow is the flight the engine actually computes from that scenario's own numbers.</text>`);

/* ── panel A: the stadium ───────────────────────────────────────────── */
const A = panel({ cx: 0, cy: -6, px: 40, py: 92, pw: 880, ph: 760, ext: 146, detail: true });
put(`<text class="h" x="40" y="${92 - 10}">1 · The stadium</text>`);

/* ── panel B: the district ──────────────────────────────────────────── */
const Bp = panel({ cx: 0, cy: -60, px: 948, py: 92, pw: 572, ph: 420, ext: 760, detail: false });
put(`<text class="h" x="948" y="${92 - 10}">2 · The district, out to 1.5 km</text>`);
// panel 1's real extent: 880 × 760 px at A.S px/m, centred on (0, −6)
const AEX = 880 / A.S / 2, AEZ = 760 / A.S / 2, ACZ = -6;
put(`<rect x="${Bp.X(-AEX).toFixed(1)}" y="${Bp.Z(ACZ - AEZ).toFixed(1)}" width="${(AEX * 2 * Bp.S).toFixed(1)}" height="${(AEZ * 2 * Bp.S).toFixed(1)}" fill="none" stroke="#1a1714" stroke-width="1.4" stroke-dasharray="5 4"/>`);
put(`<text class="l" x="${Bp.X(0).toFixed(1)}" y="${(Bp.Z(ACZ + AEZ) + 15).toFixed(1)}" text-anchor="middle">panel 1</text>`);
put(`<text class="l" x="${Bp.X(D.station.x[1] + 86).toFixed(1)}" y="${(Bp.Z((D.station.z[0] + D.station.z[1]) / 2)).toFixed(1)}" text-anchor="middle">rail station, ${D.station.distanceFromCentre} m out</text>`);
put(`<text class="l" x="${Bp.X(-480).toFixed(1)}" y="${(Bp.Z((D.road.carriagewayA[0] + D.road.carriagewayB[1]) / 2 - 12)).toFixed(1)}" text-anchor="middle">main road</text>`);
put(`<text class="l" x="${Bp.X(-660).toFixed(1)}" y="${(Bp.Z(0)).toFixed(1)}" text-anchor="middle">park</text>`);
const cp = D.carParks[0];
put(`<text class="l" x="${Bp.X((cp.x[0] + cp.x[1]) / 2).toFixed(1)}" y="${(Bp.Z(cp.z[1] + 22)).toFixed(1)}" text-anchor="middle">car parks</text>`);
put(`<text class="l" x="${Bp.X(520).toFixed(1)}" y="${(Bp.Z(40)).toFixed(1)}" text-anchor="middle">terraces</text>`);

/* labels inside panel A */
put(`<text class="l" x="${A.X(34).toFixed(1)}" y="${(A.Z(D.pitch.halfW) + 16).toFixed(1)}" text-anchor="middle">pitch ${D.pitch.length} × ${D.pitch.width} m</text>`);
const OPEN_L = D.bowl.frontL - D.roof.ringInset, OPEN_W = D.bowl.frontW - D.roof.ringInset;
put(`<text class="l" x="${A.X(40).toFixed(1)}" y="${(A.Z(-OPEN_W) - 7).toFixed(1)}" text-anchor="middle" fill="#6f6a62">roof opening ${OPEN_L * 2} × ${OPEN_W * 2} m</text>`);
put(`<text class="l" x="${A.X(0).toFixed(1)}" y="${(A.Z(-D.bowl.halfW) - 10).toFixed(1)}" text-anchor="middle">bowl ${D.bowl.halfL * 2} × ${D.bowl.halfW * 2} m · roof ${D.roof.fasciaTop} m</text>`);
put(`<text class="l" x="${A.X(0).toFixed(1)}" y="${(A.Z(D.podium.halfW) - 12).toFixed(1)}" text-anchor="middle">podium plaza, +1.5 m</text>`);
put(`<text class="l" x="${A.X(-95).toFixed(1)}" y="${A.Z(-62).toFixed(1)}" text-anchor="middle">single steep tier, ${rake(D.sides.W.el[0]).toFixed(0)}°</text>`);
put(`<text class="l" x="${A.X(95).toFixed(1)}" y="${A.Z(-62).toFixed(1)}" text-anchor="middle">${D.sides.E.el.filter((e) => e.t === 'tier').length} tiers</text>`);
put(`<text class="l" x="${A.X(0).toFixed(1)}" y="${A.Z(62).toFixed(1)}" text-anchor="middle">${D.sides.NS.el.filter((e) => e.t === 'tier').length} tiers + boxes (north and south)</text>`);

/* ── the flights ────────────────────────────────────────────────────── */
// Deliberately NOT the app's physics hues: in the app orange means velocity,
// and a plan where orange means "cut along the pitch" would teach the wrong
// thing to anyone who has learned the diagram.
const HUE = { x: '#4c5a3f', z: '#4a4660' };
const groups = new Map();
let n = 0;
const rows = [];
for (const sc of SCENARIOS) {
  const site = SITES[sc.id];
  if (!site) continue;
  n++;
  rows.push({ n, sc, site });
  const k = `${site.origin.x},${site.origin.z}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push({ n, sc, site });
}

/* Chips are placed greedily: try the dot itself, then step out at right
   angles to the cut until nothing else is already there. Thirteen launch
   sites inside one penalty area need it. */
// one lane per flight that shares an axis, so coincident arrows separate
const laneOf = new Map();
{
  const byAxis = { x: [], z: [] };
  for (const sc of SCENARIOS) { const st = SITES[sc.id]; if (st) byAxis[st.axis].push(sc.id); }
  for (const list of Object.values(byAxis))
    list.forEach((id, i) => laneOf.set(id, i - (list.length - 1) / 2));
}
const placed = [], chipJobs = [];
const free = (x, y) => !placed.some((q) => Math.hypot(q.x - x, q.y - y) < 26);

for (const [k, list] of groups) {
  const { x: ox, z: oz } = list[0].site.origin;
  const X0 = A.X(ox), Z0 = A.Z(oz);
  for (const { sc, site } of list) {
    const p = sc.params;
    const fl = flight({ u: p.u || 0.001, theta: sc.noAngle ? -90 : p.theta, h: p.h, g: p.g });
    const reach = isFinite(fl.range) ? Math.abs(fl.range) : 200;
    if (reach <= 2) continue;
    const col = HUE[site.axis];
    // Six along-the-pitch flights all live on z = 0. Drawn on one line they
    // are one line; fanned a few metres apart in the perpendicular they stay
    // honest about where they start and readable about which is which.
    const lane = (laneOf.get(sc.id) || 0) * 7;
    const ox2 = site.axis === 'x' ? ox : ox + lane;
    const oz2 = site.axis === 'z' ? oz : oz + lane;
    const ex = site.axis === 'x' ? ox2 + site.dir * reach : ox2;
    const ez = site.axis === 'z' ? oz2 + site.dir * reach : oz2;
    put(`<line x1="${A.X(ox2).toFixed(1)}" y1="${A.Z(oz2).toFixed(1)}" x2="${A.X(ex).toFixed(1)}" y2="${A.Z(ez).toFixed(1)}" stroke="${col}" stroke-width="2.2" opacity="0.8" marker-end="url(#a${site.axis})"/>`);
    put(`<circle cx="${A.X(ex).toFixed(1)}" cy="${A.Z(ez).toFixed(1)}" r="3.2" fill="${col}"/>`);
  }
  put(`<circle cx="${X0.toFixed(1)}" cy="${Z0.toFixed(1)}" r="4" fill="#ffffff" stroke="#1a1714" stroke-width="1.6"/>`);
  chipJobs.push({ X0, Z0, list });
}

for (const { X0, Z0, list } of chipJobs) {
  for (const { n: idx, site } of list) {
    const perpX = site.axis === 'x' ? 0 : 1, perpY = site.axis === 'x' ? 1 : 0;
    let cxp = X0, cyp = Z0;
    for (const d of [0, -30, 30, -58, 58, -86, 86, -114, 114, -142, 142]) {
      cxp = X0 + perpX * d; cyp = Z0 + perpY * d;
      if (free(cxp, cyp)) break;
    }
    placed.push({ x: cxp, y: cyp });
    if (Math.hypot(cxp - X0, cyp - Z0) > 2)
      put(`<line x1="${X0.toFixed(1)}" y1="${Z0.toFixed(1)}" x2="${cxp.toFixed(1)}" y2="${cyp.toFixed(1)}" stroke="#ffffff" stroke-width="3" opacity="0.85"/><line x1="${X0.toFixed(1)}" y1="${Z0.toFixed(1)}" x2="${cxp.toFixed(1)}" y2="${cyp.toFixed(1)}" stroke="#4a463f" stroke-width="1.2"/>`);
    put(`<circle cx="${cxp.toFixed(1)}" cy="${cyp.toFixed(1)}" r="11.5" fill="${HUE[site.axis]}" stroke="#fff" stroke-width="1.8"/>`);
    put(`<text class="n" x="${cxp.toFixed(1)}" y="${cyp.toFixed(1)}" text-anchor="middle" dy="4.6">${idx}</text>`);
  }
}

/* ── the key ────────────────────────────────────────────────────────── */
const KX = 948, KY = 560;
put(`<text class="h" x="${KX}" y="${KY - 12}">3 · The ${spell(COUNT)}</text>`);
put(`<rect x="${KX}" y="${KY}" width="572" height="${(rows.length * 29 + 56).toFixed(0)}" fill="#fff" rx="12" stroke="#e2ddd5"/>`);
let ky = KY + 30;
for (const { n: idx, sc, site } of rows) {
  put(`<circle cx="${KX + 24}" cy="${ky - 4}" r="10" fill="${HUE[site.axis]}"/>`);
  put(`<text class="n" x="${KX + 24}" y="${ky - 4}" text-anchor="middle" dy="4.4">${idx}</text>`);
  put(`<text class="k" x="${KX + 44}" y="${ky - 7}">${esc(sc.name)}</text>`);
  put(`<text class="km" x="${KX + 44}" y="${ky + 9}">${esc(site.place)}</text>`);
  ky += 29;
}
put(`<line x1="${KX + 16}" y1="${ky - 6}" x2="${KX + 556}" y2="${ky - 6}" stroke="#e2ddd5"/>`);
put(`<circle cx="${KX + 24}" cy="${ky + 14}" r="6" fill="#4c5a3f"/>`);
put(`<text class="km" x="${KX + 40}" y="${ky + 18}">cut ALONG the pitch</text>`);
put(`<circle cx="${KX + 214}" cy="${ky + 14}" r="6" fill="#4a4660"/>`);
put(`<text class="km" x="${KX + 230}" y="${ky + 18}">cut ACROSS the pitch</text>`);

/* scale bars and north */
const bar = 100 * A.S;
put(`<g transform="translate(${40 + 24}, ${92 + 760 - 26})">
 <rect x="-14" y="-22" width="${(bar + 90).toFixed(0)}" height="34" fill="#ffffffcc" rx="7"/>
 <line x1="0" y1="0" x2="${bar.toFixed(1)}" y2="0" stroke="#1a1714" stroke-width="2"/>
 <line x1="0" y1="-5" x2="0" y2="5" stroke="#1a1714" stroke-width="2"/>
 <line x1="${(bar / 2).toFixed(1)}" y1="-4" x2="${(bar / 2).toFixed(1)}" y2="4" stroke="#1a1714" stroke-width="2"/>
 <line x1="${bar.toFixed(1)}" y1="-5" x2="${bar.toFixed(1)}" y2="5" stroke="#1a1714" stroke-width="2"/>
 <text class="l" x="${(bar + 9).toFixed(1)}" y="5">100 m</text></g>`);
const bar2 = 500 * Bp.S;
put(`<g transform="translate(${948 + 24}, ${92 + 420 - 24})">
 <rect x="-14" y="-22" width="${(bar2 + 90).toFixed(0)}" height="34" fill="#ffffffcc" rx="7"/>
 <line x1="0" y1="0" x2="${bar2.toFixed(1)}" y2="0" stroke="#1a1714" stroke-width="2"/>
 <line x1="0" y1="-5" x2="0" y2="5" stroke="#1a1714" stroke-width="2"/>
 <line x1="${bar2.toFixed(1)}" y1="-5" x2="${bar2.toFixed(1)}" y2="5" stroke="#1a1714" stroke-width="2"/>
 <text class="l" x="${(bar2 + 9).toFixed(1)}" y="5">500 m</text></g>`);
put(`<g transform="translate(${40 + 880 - 36}, ${92 + 46})">
 <circle r="22" fill="#ffffffcc"/>
 <path d="M0 -15 L6 7 L0 2 L-6 7 Z" fill="#1a1714"/>
 <text class="l" x="0" y="18" text-anchor="middle">N</text></g>`);
put('</svg>');
console.log(o.join('\n'));
