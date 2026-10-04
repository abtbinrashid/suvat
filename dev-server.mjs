// dev-server.mjs — static server for local development.
//
// Sends no-store so ES modules are never cached between edits. GitHub Pages
// serves the same files with its own sensible caching; this is dev only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// DEV ONLY. The design work needs real renders on disk — not approximations —
// so the page can post a canvas PNG here and it lands in shots/. Nothing in
// the app uses this, and GitHub Pages has no such endpoint.
const SHOTS = path.join(ROOT, 'shots');

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && url === '/__shot') {
    const name = (req.headers['x-name'] || 'shot').toString().replace(/[^a-z0-9._-]/gi, '');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(SHOTS, { recursive: true });
      const b64 = Buffer.concat(chunks).toString('utf8').replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(b64, 'base64'));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('ok ' + name);
    });
    return;
  }
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }

  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`SUVAT dev server → http://localhost:${PORT}`));
