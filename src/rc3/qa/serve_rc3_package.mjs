import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const PKG = resolve(process.env.PKG || 'deploy/second-look-rc3-candidate'),
  PUBLIC = join(PKG, 'public'),
  PORT = Number(process.env.PORT || 5401);
const QA_MEDIA = process.env.QA_MEDIA_DIR ? resolve(process.env.QA_MEDIA_DIR) : null;
const {
  default: middleware
} = await import(pathToFileURL(join(PKG, 'middleware.js')));
const T = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
const send = async (res, r) => {
  const h = {};
  r.headers.forEach((v, k) => h[k] = v);
  res.writeHead(r.status, h);
  res.end(Buffer.from(await r.arrayBuffer()));
};
async function file(req, res, f) {
  const st = await stat(f),
    type = T[extname(f)] || 'application/octet-stream',
    range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    let [a, b] = range.replace('bytes=', '').split('-');
    const s = a ? +a : 0,
      e = b ? Math.min(+b, st.size - 1) : st.size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': e - s + 1,
      'Content-Range': `bytes ${s}-${e}/${st.size}`,
      'Accept-Ranges': 'bytes'
    });
    return createReadStream(f, {
      start: s,
      end: e
    }).pipe(res);
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    'Accept-Ranges': 'bytes'
  });
  createReadStream(f).pipe(res);
}
http.createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const wr = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers
    });
    const gate = await middleware(wr);
    if (gate) return send(res, gate);
    const p = new URL(wr.url).pathname;
    const m = p.match(/^\/api\/([\w-]+)$/);
    if (m) {
      const f = join(PKG, 'api', `${m[1]}.js`);
      if (!existsSync(f)) {
        res.writeHead(404);
        return res.end();
      }
      const mod = await import(pathToFileURL(f));
      const r = {
        _s: 200,
        setHeader: (k, v) => res.setHeader(k, v),
        status(c) {
          this._s = c;
          return this;
        },
        end(b) {
          res.statusCode = this._s;
          res.end(b);
        }
      };
      for await (const _ of req) {}
      return mod.default(req, r);
    }
    const w = p.match(/^\/media\/(gp0[23489])\.webm$/);
    if (w && QA_MEDIA) return file(req, res, join(QA_MEDIA, `${w[1]}.webm`));
    let f = normalize(join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!f.startsWith(PUBLIC + '/') && f !== PUBLIC) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    return await file(req, res, f);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500);
    res.end(e.code === 'ENOENT' ? 'not found' : 'error');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`RC3 package ${PKG} on http://127.0.0.1:${PORT}/ (Vercel emulation, local only)`));
