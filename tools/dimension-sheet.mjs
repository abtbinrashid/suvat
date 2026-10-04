// dimension-sheet.mjs — writes design/dimensions.md straight out of dims.js,
// so the sheet and the thing it describes cannot disagree.
//
//   node tools/dimension-sheet.mjs > design/dimensions.md

import { D, rake, sideTop, tierSteps } from '../js/world/dims.js';
import { SITES } from '../js/world/world.js';
import { SCENARIOS } from '../js/scenarios.js';
import { flight } from '../js/core/projectile.js';

const L = [];
const p = (s = '') => L.push(s);
const f = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toString();
const tbl = (head, rows) => {
  p(`| ${head.join(' | ')} |`);
  p(`| ${head.map(() => '---').join(' | ')} |`);
  for (const r of rows) p(`| ${r.join(' | ')} |`);
  p();
};

p('# Dimension sheet');
p();
p('Every object in the flight view, in metres. Generated from `js/world/dims.js`');
p('by `tools/dimension-sheet.mjs` — if a number here is wrong, the renderer is');
p('wrong too, because they read the same file.');
p();
p('**Axes.** Right-handed, origin at the centre spot on the pitch surface.');
p('`x` runs along the pitch, −52.5 (west goal) to +52.5 (east goal). `y` is up,');
p('and `y = 0` is both the pitch surface and the physics datum the ball lands on.');
p('`z` runs across, −34 (north touchline) to +34 (south touchline).');
p();
p('**One deliberate disagreement.** The idealised projectile lands on flat ground');
p('at `y = 0`. The podium plaza really is 1.5 m above that, so it is drawn at');
p('1.5 m and the ball passes it rather than landing on it. Scenery is not allowed');
p('to lie about its size and the physics is not allowed to notice the scenery;');
p('the plaza is where those two rules meet. The 2D view draws the datum plane');
p('right across the canvas, under the stands included, so the idealisation is');
p('stated rather than hidden.');
p();

p('## The playing surface');
p();
tbl(['Object', 'Dimension', 'Value (m)'], [
  ['Pitch', 'length × width', `${D.pitch.length} × ${D.pitch.width}`],
  ['Goal line', 'at x', `±${D.pitch.halfL}`],
  ['Touchline', 'at z', `±${D.pitch.halfW}`],
  ['Line width', '—', f(D.pitch.lineW)],
  ['Centre circle', 'radius', f(D.pitch.centreCircleR)],
  ['Centre spot', 'radius', f(D.pitch.centreSpotR)],
  ['Penalty area', 'depth × width', `${D.pitch.penaltyDepth} × ${f(D.pitch.penaltyHalfW * 2)}`],
  ['Goal area', 'depth × width', `${D.pitch.goalAreaDepth} × ${f(D.pitch.goalAreaHalfW * 2)}`],
  ['Penalty spot', 'from goal line', f(D.pitch.penaltySpot, 0)],
  ['Penalty arc', 'radius', f(D.pitch.penaltyArcR)],
  ['Corner arc', 'radius', f(D.pitch.cornerArcR, 0)],
  ['Mowing stripes', 'count × width', `${D.pitch.stripes} × ${f(D.pitch.stripeW, 3)}`],
  ['Goal', 'width × height', `${D.goal.width} × ${D.goal.height}`],
  ['Goalpost', 'diameter', f(D.goal.postR * 2)],
  ['Goal net', 'depth, mesh', `${D.goal.netDepth}, ${D.goal.netMesh}`],
  ['Grass run-off', 'beyond touchline / goal line', `${D.surface.runoffSide} / ${D.surface.runoffEnd}`],
  ['Grassed area', 'length × width', `${f(D.surface.halfL * 2, 0)} × ${f(D.surface.halfW * 2, 0)}`],
  ['Advertising hoardings', 'height × depth, panel', `${f(D.boards.height, 1)} × ${D.boards.depth}, ${D.boards.panel}`],
  ['Hoarding line', 'at z / at x', `±${D.boards.atZ} / ±${D.boards.atX}`],
  ['Technical area', 'length × depth × height', `${D.bench.length} × ${D.bench.depth} × ${D.bench.roofH}`],
]);
p('Hoardings carry no brand of any kind: they are blank LED panels in a 2.4 m');
p('rhythm. There is no club name, crest, bird, sponsor or kit colour anywhere in');
p('this world, and the seating is a neutral grey so that no palette reads as a');
p('team strip.');
p();

p('## The bowl');
p();
tbl(['Object', 'Dimension', 'Value (m)'], [
  ['Bowl plan', 'length × width', `${D.bowl.halfL * 2} × ${D.bowl.halfW * 2}`],
  ['Bowl plan', 'corner radius', f(D.bowl.cornerR, 0)],
  ['North / south front row', 'at |z|', f(D.sides.NS.front, 0)],
  ['East / west front row', 'at |x|', f(D.sides.W.front, 0)],
  ['North / south height', 'top of rear facade', f(sideTop(D.sides.NS), 1)],
  ['West height', 'top of rear facade', f(sideTop(D.sides.W), 1)],
  ['East height', 'top of rear facade', f(sideTop(D.sides.E), 1)],
]);

for (const [name, spec] of [['North and south — three tiers and a ring of boxes', D.sides.NS],
                            ['West — one steep tier', D.sides.W],
                            ['East — four tiers', D.sides.E]]) {
  p(`### ${name}`);
  p();
  p(`Front row at ${spec.front} m from the centre line; ${spec.out} m of depth behind it.`);
  p('`d` is the outward distance from the front row.');
  p();
  tbl(['Element', 'd from', 'd to', 'y from', 'y to', 'Rows', 'Tread', 'Rise', 'Rake'],
    spec.el.map((el) => [
      el.name, f(el.d0, 1), f(el.d1, 1), f(el.y0, 2), f(el.y1, 2),
      el.rows ?? '—', el.rowD ?? '—', el.rise != null ? f(el.rise, 4) : '—',
      el.t === 'tier' ? `${f(rake(el), 1)}°` : '—',
    ]));
}

p('## The roof');
p();
p('A cable net on an elliptical compression ring, open over the pitch.');
p();
tbl(['Object', 'Dimension', 'Value (m)'], [
  ['Outer fascia', 'top edge — the highest thing in the world', f(D.roof.fasciaTop, 1)],
  ['Outer fascia', 'bottom edge', f(D.roof.fasciaBottom, 1)],
  ['Roof plane', 'at the outer structure line', f(D.roof.outerStructure, 1)],
  ['Compression ring', 'top / bottom', `${f(D.roof.ringTop, 1)} / ${f(D.roof.ringBottom, 1)}`],
  ['Roof opening', 'semi-axes a × b', `${D.roof.ringA} × ${D.roof.ringB}`],
  ['Roof opening', 'full size', `${D.roof.ringA * 2} × ${D.roof.ringB * 2}`],
  ['Floodlight strip', 'height, width', `${f(D.roof.lightStripY, 1)}, ${D.roof.lightStripW}`],
  ['Cables', 'radial / hoop', `${D.roof.radialCables} / ${D.roof.hoopCables}`],
]);
p('The opening is bigger than the pitch in both directions, so the whole pitch is');
p('open to the sky and every seat is under cover.');
p();

p('## Podium and district');
p();
const R = D.road;
tbl(['Object', 'Dimension', 'Value (m)'], [
  ['Podium plaza', 'plan, as a ring round the bowl', `${D.podium.halfL * 2} × ${D.podium.halfW * 2}`],
  ['Podium plaza', 'height above the datum', f(D.podium.y, 1)],
  ['Podium balustrade', 'height', f(D.podium.railH, 1)],
  ['Forecourt / drop-off', 'z range, depth', `${R.forecourt.join(' to ')}, ${f(R.forecourt[1] - R.forecourt[0], 0)}`],
  ['Wide pavement', 'z range, depth', `${R.pavementWide.join(' to ')}, ${f(R.pavementWide[1] - R.pavementWide[0], 0)}`],
  ['Carriageway A', 'z range, 2 lanes', `${R.carriagewayA.join(' to ')}, 2 × ${R.laneW}`],
  ['Planted median', 'z range', R.median.join(' to ')],
  ['Carriageway B', 'z range, 2 lanes', `${R.carriagewayB.join(' to ')}, 2 × ${R.laneW}`],
  ['Far pavement', 'z range, depth', `${R.pavement.join(' to ')}, ${f(R.pavement[1] - R.pavement[0], 0)}`],
  ['Street lighting', 'height, spacing', `${R.lampH}, every ${R.lampEvery}`],
  ['Street trees', 'spacing', `every ${R.treeEvery}`],
  ['West street', 'x range', D.roadW.x.join(' to ')],
  ['Station building', 'plan, roof height', `${D.station.x[1] - D.station.x[0]} × ${D.station.z[1] - D.station.z[0]}, ${D.station.roofY}`],
  ['Platform canopy', 'z range, height', `${D.station.canopy.z.join(' to ')}, ${f(D.station.canopy.y, 1)}`],
  ['Track bed', 'tracks, gauge, spacing', `${D.station.tracks.n}, ${D.station.tracks.gauge}, ${f(D.station.tracks.spacing, 1)}`],
  ['Station', 'distance from the centre spot', f(D.station.distanceFromCentre, 0)],
  ['Parking bay', 'width × length', `${D.carPark.bayW} × ${D.carPark.bayL}`],
  ['Parking aisle', 'width', f(D.carPark.aisle, 1)],
  ['Car park lighting', 'height', f(D.carPark.lampH, 0)],
  ['Terraced house', 'frontage × depth', `${D.house.front} × ${D.house.depth}`],
  ['Terraced house', 'eaves / ridge', `${D.house.eaves} / ${D.house.ridge}`],
  ['Rear gardens', 'depth each', f(D.house.garden, 0)],
  ['Residential street', 'width', f(D.house.street, 0)],
]);
tbl(['Car park', 'x range', 'z range'], D.carParks.map((c) => [c.id, c.x.join(' to '), c.z.join(' to ')]));
tbl(['Terrace block', 'x range', 'z range'], D.terraces.map((t, i) => [`T${i + 1}`, t.x.join(' to '), t.z.join(' to ')]));
tbl(['Park', 'x range', 'z range', 'Pond'], D.parks.map((k) => [k.id, k.x.join(' to '), k.z.join(' to '), k.pond ? `${k.pond.x.join(' to ')} × ${k.pond.z.join(' to ')}` : '—']));

p('## Scale references');
p();
p('Every one of these is a real measurement, drawn at that measurement. If one');
p('of them looks small on screen, it is because it is small.');
p();
const PP = D.prop;
tbl(['Object', 'Dimension', 'Value (m)'], [
  ['Football', 'diameter', f(PP.ball, 2)],
  ['Person', 'height × shoulder width', `${PP.person.h} × ${PP.person.w}`],
  ['Car', 'length × width × height', `${PP.car.l} × ${PP.car.w} × ${PP.car.h}`],
  ['Double-decker bus', 'length × width × height', `${PP.bus.l} × ${PP.bus.w} × ${PP.bus.h}`],
  ['Mature tree', 'height, canopy radius, trunk radius', `${PP.treeMature.h}, ${PP.treeMature.canopyR}, ${PP.treeMature.trunkR}`],
  ['Young tree', 'height, canopy radius', `${PP.treeYoung.h}, ${PP.treeYoung.canopyR}`],
  ['Street lamp', 'height, arm', `${PP.lamp.h}, ${PP.lamp.armL}`],
]);

p('## The far field');
p();
tbl(['Setting', 'Value (m)'], [
  ['District fades from', f(D.far.fadeFrom, 0)],
  ['District fully faded by', f(D.far.fadeTo, 0)],
  ['Distance grid step', f(D.far.gridStep, 0)],
  ['Distance grid out to', f(D.far.gridTo, 0)],
]);
p('Past 1.5 km the district dissolves into a labelled distance grid rather than');
p('ending at an edge, which is what makes `g = 0` and Moon gravity survivable:');
p('the ball leaves the world and there is still something to measure it against.');
p();

p('## Level of detail');
p();
p('Thresholds are in metres of VISIBLE WIDTH. Each feature fades out over the');
p('last quarter of its range, so nothing pops.');
p();
tbl(['Band', 'Visible width (m)'], Object.entries(D.lod.bands).map(([k, v]) => [k, `up to ${v}`]));
tbl(['Feature', 'Gone by (m)'], Object.entries(D.lod).filter(([k]) => k !== 'bands').map(([k, v]) => [k, v]));

p('## The numbers the brief asks the world to honour');
p();
const chk = [
  ['14 m s⁻¹ straight up reaches', f(14 * 14 / (2 * 9.81), 2), `the back of the lower tier at ${f(D.sides.NS.el[0].y1, 1)} m`],
  ['31 m s⁻¹ straight up reaches', f(31 * 31 / (2 * 9.81), 2), `clears the roof at ${f(D.roof.fasciaTop, 1)} m`],
  ['20 m s⁻¹ flat from 25 m travels', f(20 * Math.sqrt(2 * 25 / 9.81), 1), 'lands on the pitch, 1.2 m inside the north touchline'],
  ['25 m s⁻¹ at 45° travels', f(25 * 25 / 9.81, 1), 'a goal kick, landing in the far half'],
  ['28 m s⁻¹ at 30° and at 60° both travel', f(28 * 28 * Math.sin(Math.PI / 3) / 9.81, 1), 'apexes 10.0 m and 30.0 m'],
  ['28 m s⁻¹ at 45° from 25 m peaks at', f(25 + (28 * Math.SQRT1_2) ** 2 / (2 * 9.81), 2), `3 m under the roof at ${f(D.roof.fasciaTop, 1)} m`],
];
tbl(['Check', 'Metres', 'What it lands level with'], chk);

p('## Where each scenario starts');
p();
tbl(['Scenario', 'Launch point (x, y, z)', 'Section', 'Place'],
  SCENARIOS.filter((s) => SITES[s.id]).map((s) => {
    const site = SITES[s.id];
    return [s.name,
      `(${f(site.origin.x, 1)}, ${f(s.params.h, 2)}, ${f(site.origin.z, 1)})`,
      site.axis === 'x' ? `along the pitch, ${site.dir > 0 ? 'east' : 'west'}` : `across the pitch, ${site.dir > 0 ? 'south' : 'north'}`,
      site.place];
  }));

console.log(L.join('\n'));
