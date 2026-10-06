// Mini serveur statique : sert le dossier motion-portfolio (polices, GSAP, scènes, sons).
// Usage direct : `node engine/server.mjs` puis ouvrir http://127.0.0.1:5173/scenes/01-kinetic/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let p = path.normalize(path.join(ROOT, url));
      if (!p.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end();
      }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      fs.readFile(p, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('404');
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.env.PORT) || 5173);
  console.log(`Prévisualisation : http://127.0.0.1:${port}/scenes/01-kinetic/`);
  console.log(`                   http://127.0.0.1:${port}/scenes/02-liquid/`);
  console.log(`                   http://127.0.0.1:${port}/scenes/03-shapes/`);
}
