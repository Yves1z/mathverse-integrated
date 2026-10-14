import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../design-demos/', import.meta.url));
const port = Number(process.env.DESIGN_PORT || 5500);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
http.createServer((req, res) => {
  let target;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    target = path.resolve(root, '.' + pathname);
    if (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end(); return; }
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('File not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Visual catalogue: http://127.0.0.1:${port}/`));
