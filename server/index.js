// Local / traditional hosting entry: node server/index.js
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(join(root, '.env'));
const { makeStore } = await import('./store.js');
const { createApp } = await import('./app.js');

const store = makeStore();
const api = createApp(store);
const dist = join(root, 'client', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.map': 'application/json' };

const server = createServer((req, res) => {
  if (req.url.startsWith('/api')) return api(req, res);
  // static client (after `npm run build`)
  let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, p);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  if (!existsSync(file)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('API running. Start the client with `npm run dev` (http://localhost:5173) or build it with `npm run build`.'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': file.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(file).pipe(res);
});

const port = +process.env.PORT || 5000;
server.listen(port, async () => {
  console.log(`Cricket Arena API on http://localhost:${port}  (storage: ${store.name})`);
  try { await store.init(); console.log('Database ready.'); }
  catch (e) { console.error('\nCould not connect to the database:', e.message, '\nCheck DATABASE_URL in your .env file.\n'); }
});
