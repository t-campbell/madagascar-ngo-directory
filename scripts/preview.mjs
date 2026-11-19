import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json',
  '.csv': 'text/csv', '.xml': 'application/xml', '.txt': 'text/plain' };
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Run npm run build before preview.');

export const server = createServer((req, res) => {
  let path;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    path = resolve(dist, '.' + pathname);
    if (!path.startsWith(dist + sep) && path !== dist) throw new Error('outside preview root');
    if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
    if (!existsSync(path) || path.includes('\0')) throw new Error('missing file');
  } catch {
    path = resolve(dist, '404.html');
    res.statusCode = 404;
  }
  res.setHeader('Content-Type', (types[extname(path)] ?? 'application/octet-stream') + '; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (path.endsWith('.csv')) res.setHeader('Content-Disposition', 'attachment');
  if (req.method === 'HEAD') return res.end();
  createReadStream(path).on('error', () => res.destroy()).pipe(res);
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  server.listen(port, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:' + server.address().port));
}
