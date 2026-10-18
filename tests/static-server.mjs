// Serves docs/ the way Firebase Hosting does for these tests: paths are case-sensitive
// (so a wrong-case asset 404s even on Windows/macOS), directories serve index.html,
// hosting-ignored folders are hidden, and misses get docs/404.html.
import { createServer } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'docs');
const port = Number(process.env.PORT) || 4173;
const ignored = ['agents', 'adr'];

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

// Walks the path one segment at a time, requiring each to match a directory entry exactly.
function resolveExact(urlPath) {
  const segments = decodeURIComponent(urlPath).split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s.startsWith('.')) || ignored.includes(segments[0])) return null;
  let current = root;
  for (const segment of segments) {
    try {
      if (!readdirSync(current).includes(segment)) return null;
    } catch {
      return null;
    }
    current = join(current, segment);
  }
  if (statSync(current).isDirectory()) current = join(current, 'index.html');
  try {
    return statSync(current).isFile() ? current : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const file = resolveExact(new URL(req.url, 'http://localhost').pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    res.end(readFileSync(join(root, '404.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
