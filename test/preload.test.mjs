// preload.test.mjs — index.html names every module the app really loads.
// Run: node test/preload.test.mjs
//
// The hints are a promise to the browser: "these are the modules, fetch them
// now". A promise that has gone stale is worse than none — a hint for a file
// that no longer exists is a wasted request, and a module left out of the
// list goes back to waiting its turn in the waterfall the hints exist to
// remove. So the list is generated from the real import graph, and this
// fails if the file and the graph have drifted apart.
import fs from 'node:fs';
import path from 'node:path';
import { graph, block, BEGIN, END } from '../tools/modulepreload.mjs';

let pass = 0, fail = 0;
const ok = (c, label) => c ? (pass++, console.log(`  ok   ${label}`))
                           : (fail++, console.log(`  FAIL ${label}`));
const group = (n, f) => { console.log(`\n${n}`); f(); };

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mods = graph().slice(1);

group('The generated block is in the page, and it is current', () => {
  ok(html.includes(BEGIN) && html.includes(END),
     'index.html carries the generated modulepreload block');
  const m = html.match(new RegExp(`${BEGIN}[\\s\\S]*?${END}`));
  if (m) {
    const indent = (html.match(new RegExp(`^([ \\t]*)${BEGIN}`, 'm')) || [, ''])[1];
    ok(m[0] === block(indent).trim().replace(new RegExp(`^${indent}`), ''),
       'it matches what tools/modulepreload.mjs generates today');
  } else fail++;
});

group('Every hint points at a module that exists and is really imported', () => {
  const hinted = [...html.matchAll(/<link rel="modulepreload" href="\.\/([^"]+)">/g)].map((x) => x[1]);
  ok(hinted.length > 0, `the page names ${hinted.length} modules`);
  for (const h of hinted) {
    ok(fs.existsSync(path.join(ROOT, h)), `${h} exists on disk`);
  }
  const missing = mods.filter((m) => !hinted.includes(m));
  ok(missing.length === 0, `nothing in the import graph is left out${missing.length ? ': ' + missing.join(', ') : ''}`);
  const extra = hinted.filter((h) => !mods.includes(h));
  ok(extra.length === 0, `nothing is named that the app does not import${extra.length ? ': ' + extra.join(', ') : ''}`);
});

group('The entry module is not hinted twice', () => {
  ok(!html.includes('<link rel="modulepreload" href="./js/app.js">'),
     'js/app.js is started by its own <script type="module">, not a hint');
  ok(/<script type="module" src="\.\/js\/app\.js">/.test(html),
     'and that script tag is still there');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
