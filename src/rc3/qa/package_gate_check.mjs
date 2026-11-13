import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
const PKG = resolve(process.argv[2] || 'deploy/second-look-rc3-candidate');
const R = [];
const check = (name, ok, info = '') => {
  R.push({
    name,
    ok: !!ok
  });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  · ' + info : ''}`);
};
const walk = d => readdirSync(d, {
  withFileTypes: true
}).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const {
  default: mw
} = await import(pathToFileURL(join(PKG, 'middleware.js')) + `?t=${Date.now()}`);
const PATHS = ['/', '/index.html', '/teaser', '/js/app.js', '/js/look/look.js', '/css/look.css', '/data/look_around.json', '/data/second_look.json', '/data/story2.json', '/data/w3c_context.json', '/data/poster_gp02.jpg', '/media/gp02.mp4', '/media/gp09.mp4', '/api/log', '/api/debrief', '/api/study', '/api/research', '/observer.html', '/research/', '/MANIFEST.json', '/.vercel/project.json', '/.env.local', '/robots.txt', '/fonts/archivo-var.woff2'];
const req = (p, auth) => new Request(`https://preview.example${p}`, {
  headers: auth ? {
    authorization: 'Basic ' + btoa(auth)
  } : {}
});
const saved = {
  ...process.env
};
delete process.env.SITE_PASSWORD;
delete process.env.SITE_USER;
let s = [];
for (const p of PATHS) s.push((await mw(req(p)))?.status);
check('fail closed: no SITE_PASSWORD → 503 on all ' + PATHS.length + ' paths', s.every(x => x === 503), JSON.stringify([...new Set(s)]));
s = [];
for (const p of PATHS) s.push((await mw(req(p, 'sic:x')))?.status);
check('fail closed: no SITE_PASSWORD even with credentials → 503', s.every(x => x === 503));
process.env.SITE_PASSWORD = 'local-test-only-' + Date.now();
s = [];
for (const p of PATHS) s.push((await mw(req(p)))?.status);
check('no credentials → 401 on every path', s.every(x => x === 401));
const r401 = await mw(req('/data/look_around.json'));
check('401 carries WWW-Authenticate and no-store, body is not the payload', /Basic/.test(r401.headers.get('www-authenticate') || '') && /no-store/.test(r401.headers.get('cache-control') || '') && (await r401.text()).length < 40);
s = [];
for (const p of PATHS) s.push((await mw(req(p, 'sic:wrong')))?.status);
check('wrong password → 401 on every path', s.every(x => x === 401));
s = [];
for (const p of PATHS) s.push((await mw(req(p, 'other:' + process.env.SITE_PASSWORD)))?.status);
check('wrong user → 401 on every path', s.every(x => x === 401));
s = [];
for (const p of PATHS) s.push((await mw(req(p, 'sic:' + process.env.SITE_PASSWORD)))?.status);
check('right credentials → passes through on every path', s.every(x => x === undefined));
s = await mw(new Request('https://preview.example/', {
  headers: {
    authorization: 'Basic !!!notbase64'
  }
}));
check('malformed Authorization → 401 (no crash)', s?.status === 401);
process.env.SITE_USER = 'team';
s = await mw(req('/', 'team:' + process.env.SITE_PASSWORD));
const s2 = await mw(req('/', 'sic:' + process.env.SITE_PASSWORD));
check('SITE_USER override honoured', s === undefined && s2?.status === 401);
Object.keys(process.env).forEach(k => {
  if (!(k in saved)) delete process.env[k];
});
Object.assign(process.env, saved);
const files = walk(PKG).map(f => relative(PKG, f));
const top = [...new Set(files.map(f => f.split('/')[0]))].sort();
const allowedTop = ['.gitignore', '.vercel', '.vercelignore', 'BUILD_REPORT.json', 'DEPLOY.md', 'MANIFEST.json', 'api', 'middleware.js', 'package.json', 'public', 'vercel.json'];
const extraTop = top.filter(t => !allowedTop.includes(t));
check('only expected top-level entries (local .env* from `vercel link` tolerated but never uploaded/packaged)', extraTop.every(t => t.startsWith('.env')), extraTop.join(','));
check('.vercelignore excludes .env*, .vercel and build metadata', ['.env', '.env.*', '.vercel', 'MANIFEST.json'].every(x => readFileSync(join(PKG, '.vercelignore'), 'utf8').split('\n').includes(x)));
check('API = exactly log.js + debrief.js', JSON.stringify(files.filter(f => f.startsWith('api/')).sort()) === JSON.stringify(['api/debrief.js', 'api/log.js']));
check('no observer / research / study pages or code', !files.some(f => /observer\.html|\/research|study_local|server_study|lib\/db/.test(f)));
check('no private_data/, sessions/, qa/, .webm, node_modules in the package', !files.some(f => /private_data|sessions\/|\/qa\/|\.webm$|node_modules/.test(f)));
check('vercel.json serves public/ only (outputDirectory=public), framework null', (() => {
  const v = JSON.parse(readFileSync(join(PKG, 'vercel.json')));
  return v.outputDirectory === 'public' && v.framework === null;
})());
check('every response noindex + robots.txt disallows all', readFileSync(join(PKG, 'public/robots.txt'), 'utf8').includes('Disallow: /') && JSON.stringify(JSON.parse(readFileSync(join(PKG, 'vercel.json')))).includes('noindex'));
const {
  default: logH
} = await import(pathToFileURL(join(PKG, 'api/log.js')));
let code;
logH({}, {
  setHeader() {},
  status(c) {
    code = c;
    return this;
  },
  end() {}
});
check('/api/log is a no-op (204, no storage code)', code === 204 && !/fs|writeFile|neon|postgres|DATABASE_URL/.test(readFileSync(join(PKG, 'api/log.js'), 'utf8')));
check('package.json has no dependencies (nothing to install on Vercel)', (() => {
  const p = JSON.parse(readFileSync(join(PKG, 'package.json')));
  return !p.dependencies && !p.devDependencies;
})());
const M = JSON.parse(readFileSync(join(PKG, 'MANIFEST.json')));
const bad = [];
for (const [f, v] of Object.entries(M.sha256)) {
  if (f === 'MANIFEST.json') continue;
  if (!existsSync(join(PKG, f)) || sha(join(PKG, f)) !== v.sha256) bad.push(f);
}
check(`MANIFEST matches disk (${Object.keys(M.sha256).length} entries)`, bad.length === 0, bad.slice(0, 5).join(','));
check('MANIFEST lists no .vercel/ or .env* file', !Object.keys(M.sha256).some(f => f.startsWith('.vercel/') || f.split('/').pop().startsWith('.env')));
const MEDIA_SHA = {
  gp02: '1189e9ea47ab297440f64a670c855485b5bd790192336ae04c2ea425672c3c50',
  gp03: '528e1ec07ad5a6088f016c580a3d99fe1787ebad8b23faf5b2b4788157a19c05',
  gp04: '931ddbd7dfe9fef627f638917b93175c5ef49e978b24348e1fcbcd7f7bd3845d',
  gp08: '81c2768d0605799d6c35ce8ca983f1f53a992c76b41a346dc9fe0582ef1c22d9',
  gp09: 'dfd7be9337fa83ad8f2803fca0e9b90aa2b659eeef48ffc5d018dfcd11f8ce5c'
};
const rep = JSON.parse(readFileSync(join(PKG, 'BUILD_REPORT.json')));
if (rep.media_mode === 'none') check('media: code-only build (media_mode none) — media check SKIPPED; a deployable build must use --media-mode hardlink|copy', true, 'NOT DEPLOYABLE AS IS');else check('media: all 5 clips present with the pinned SHA-256', Object.entries(MEDIA_SHA).every(([c, h]) => M.sha256[`public/media/${c}.mp4`]?.sha256 === h && existsSync(join(PKG, `public/media/${c}.mp4`)) && sha(join(PKG, `public/media/${c}.mp4`)) === h));
const js = files.filter(f => f.startsWith('public/') && f.endsWith('.js')).map(f => readFileSync(join(PKG, f), 'utf8')).join('\n');
const refs = [...new Set([...js.matchAll(/\/data\/([\w.-]+\.(?:json|jpg|png))/g)].map(m => m[1]))];
check(`every /data file referenced by the JS is packaged (${refs.length})`, refs.every(r => existsSync(join(PKG, 'public/data', r))));
const clipsRef = [...new Set([...js.matchAll(/['"`](gp0\d)['"`]/g)].map(m => m[1]))];
const mb = files.reduce((a, f) => a + statSync(join(PKG, f)).size, 0) / 1e6;
check('total size < 100 MB (Vercel CLI upload limit)', mb < 100, `${mb.toFixed(1)} MB`);
check('largest single file < 50 MB', Math.max(...files.map(f => statSync(join(PKG, f)).size)) < 50e6);
const secretRx = /postgres(ql)?:\/\/|npg_[A-Za-z0-9]{8,}|VERCEL_OIDC_TOKEN|ghp_[A-Za-z0-9]{20}|sk-[A-Za-z0-9]{20}|BEGIN (RSA|OPENSSH) PRIVATE KEY/;
check('no credential pattern in any packaged text file', !files.filter(f => /\.(js|json|html|css|md|txt)$/.test(f) && !f.startsWith('.vercel/') && !f.startsWith('.env')).some(f => secretRx.test(readFileSync(join(PKG, f), 'utf8'))));
const failed = R.filter(r => !r.ok).length;
console.log(`\n${R.length - failed}/${R.length} package checks passed · clips referenced in code: ${clipsRef.join(',')}`);
process.exit(failed ? 1 : 0);
