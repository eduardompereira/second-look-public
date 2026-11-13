import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, appendFile, mkdir, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PRIVATE = join(ROOT, 'private_data');
const SESSIONS = join(ROOT, 'sessions');
const QA = join(ROOT, 'qa');
const CLIPS = process.env.CLIPS_DIR || resolve(ROOT, '../../prototype/private_assets/clips');
const LAN = process.env.ALLOW_LAN === '1';
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const PORT = Number(process.env.PORT || 5199);
const TOKEN = LAN ? process.env.ACCESS_TOKEN || randomBytes(6).toString('hex') : null;
const CLIP_OK = new Set(['gp02', 'gp03', 'gp04', 'gp08', 'gp09']);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.csv': 'text/csv; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};
const send = (res, code, body, type = 'text/plain; charset=utf-8', extra = {}) => {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    ...extra
  });
  res.end(body);
};
const safeId = s => String(s || '').replace(/[^\w-]/g, '_').slice(0, 80);
async function serveFile(req, res, file) {
  const st = await stat(file);
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    let [a, b] = range.replace('bytes=', '').split('-');
    const start = a ? Number(a) : 0,
      end = b ? Math.min(Number(b), st.size - 1) : st.size - 1;
    if (start >= st.size) return send(res, 416, '', type, {
      'Content-Range': `bytes */${st.size}`
    });
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    });
    return createReadStream(file, {
      start,
      end
    }).on('error', () => res.destroy()).pipe(res);
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store'
  });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}
async function readSession(id) {
  const ev = (await readFile(join(SESSIONS, `${id}.jsonl`), 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  let debrief = null;
  try {
    debrief = JSON.parse(await readFile(join(SESSIONS, `${id}.debrief.json`), 'utf8'));
  } catch {}
  return {
    id,
    events: ev,
    debrief
  };
}
function summarize({
  id,
  events: ev,
  debrief
}) {
  const f = t => ev.find(e => e.type === t);
  const start = f('story_start') || ev[0] || {};
  const at = f('attention_tap') || f('attention_not_sure');
  const ut = f('use_it_tap') || f('use_it_not_sure');
  const beats = ev.filter(e => e.type === 'beat_start').map(e => e.beat);
  return {
    id,
    mode: start.mode,
    participant: start.participant,
    category: start.category,
    hook: start.hook,
    hook_tap: !!f('hook_tap'),
    attention_region: at ? at.region || 'not_sure' : '',
    attention_latency_ms: at?.latency_ms ?? '',
    use_it_region: ut ? ut.region || 'not_sure' : '',
    use_it_cue_consistent: f('use_it_coded')?.cue_consistent ?? '',
    use_it_latency_ms: ut?.latency_ms ?? '',
    reached_use_it: beats.includes('use_it'),
    carry_reached: !!f('carry_reached'),
    next_story_tap: !!f('next_story_tap'),
    share_tap: !!f('share_tap'),
    story_complete: !!f('story_complete'),
    last_beat: beats.at(-1) || '',
    exit_at: f('exit_tap')?.beat || '',
    build: start.build || 'v1',
    variant: start.variant || 'w3e51',
    choice1_shown: !!f('choice1_shown'),
    choice1_pick: f('choice1_pick')?.pick || '',
    rc2_resume: !!f('rc2_resume'),
    debrief_category: debrief?.category || '',
    expectation: debrief?.expectation || '',
    retelling: debrief?.retelling || '',
    would_look: debrief?.would_look || '',
    first_confusion: debrief?.first_confusion || '',
    voluntary_next: debrief?.voluntary_next || '',
    exclude: debrief?.exclude || false,
    ...journeySummary(ev, debrief)
  };
}
function journeySummary(ev, debrief) {
  const f = t => ev.find(e => e.type === t);
  const c8 = f('gp08_commit_tap') || f('gp08_commit_not_sure'),
    c9 = f('gp09_commit_tap') || f('gp09_commit_not_sure');
  const call = f('story2_bridge_call');
  return {
    story1_complete: !!f('story_complete'),
    show_me_tap: !!f('next_story_tap'),
    bridge_start: !!f('story2_bridge_start'),
    bridge_call: call?.call || '',
    bridge_call_latency_ms: call?.latency_ms ?? '',
    story2_start: !!f('story2_start'),
    gp08_region: c8 ? c8.region || 'not_sure' : '',
    gp08_x: c8?.x ?? '',
    gp08_y: c8?.y ?? '',
    gp08_latency_ms: c8?.latency_ms ?? '',
    gp08_name_reached: !!f('gp08_name_reached'),
    gp09_region: c9 ? c9.region || 'not_sure' : '',
    gp09_x: c9?.x ?? '',
    gp09_y: c9?.y ?? '',
    gp09_latency_ms: c9?.latency_ms ?? '',
    gp09_intended: f('gp09_commit_coded')?.intended ?? '',
    gp09_name_reached: !!f('gp09_name_reached'),
    story2_carry_reached: !!f('story2_carry_reached'),
    full_journey_complete: !!f('full_journey_complete'),
    gp01_teaser_tap: !!f('gp01_teaser_tap'),
    j_retelling_cue: debrief?.j_retell_cue || '',
    j_coherent: debrief?.j_coherent || '',
    j_perceptual_cue: debrief?.j_perceptual_cue || '',
    j_time_confusion: debrief?.j_time_confusion || '',
    j_bridge: debrief?.j_bridge || '',
    j_gp09_language: debrief?.j_gp09_language || '',
    j_failure_class: debrief?.j_failure_class || ''
  };
}
const csv = rows => {
  if (!rows.length) return '';
  const k = Object.keys(rows[0]);
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [k.join(','), ...rows.map(r => k.map(x => q(r[x])).join(','))].join('\n');
};
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (LAN) {
      const remote = req.socket.remoteAddress || '';
      const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
      const cookieOk = (req.headers.cookie || '').includes(`k=${TOKEN}`);
      if (!local && url.searchParams.get('k') !== TOKEN && !cookieOk) return send(res, 403, 'forbidden');
      if (url.searchParams.get('k') === TOKEN) res.setHeader('Set-Cookie', `k=${TOKEN}; Path=/; SameSite=Strict; HttpOnly`);
    }
    const p = url.pathname;
    if (req.method === 'POST' && (p === '/api/log' || p === '/api/debrief')) {
      let body = '';
      for await (const c of req) {
        body += c;
        if (body.length > 2e6) throw new Error('too large');
      }
      await mkdir(SESSIONS, {
        recursive: true
      });
      if (p === '/api/log') {
        const lines = JSON.parse(body);
        const arr = Array.isArray(lines) ? lines : [lines];
        for (const ev of arr) await appendFile(join(SESSIONS, `${safeId(ev.session)}.jsonl`), JSON.stringify({
          ...ev,
          server_iso: new Date().toISOString()
        }) + '\n');
      } else {
        const d = JSON.parse(body);
        await writeFile(join(SESSIONS, `${safeId(d.session)}.debrief.json`), JSON.stringify({
          ...d,
          saved_iso: new Date().toISOString()
        }, null, 1));
      }
      return send(res, 200, '{"ok":true}', TYPES['.json']);
    }
    if (p === '/api/sessions' || p === '/api/export.csv') {
      await mkdir(SESSIONS, {
        recursive: true
      });
      const ids = (await readdir(SESSIONS)).filter(f => f.endsWith('.jsonl')).map(f => f.slice(0, -6)).sort();
      const rows = [];
      for (const id of ids) rows.push(summarize(await readSession(id)));
      return p === '/api/export.csv' ? send(res, 200, csv(rows), TYPES['.csv']) : send(res, 200, JSON.stringify(rows), TYPES['.json']);
    }
    if (p.startsWith('/api/session/')) return send(res, 200, JSON.stringify(await readSession(safeId(p.split('/').pop()))), TYPES['.json']);
    let m;
    if ((m = p.match(/^\/media\/(gp0[23489])\.(mp4|webm)$/)) && CLIP_OK.has(m[1])) {
      return await serveFile(req, res, m[2] === 'mp4' ? join(CLIPS, `${m[1]}.mp4`) : join(QA, `${m[1]}.webm`));
    }
    if (m = p.match(/^\/data\/(second_look\.json|story2\.json|w3c_context\.json|look_around\.json|selects_map\.json|player_cards\.json|twin_(?:s1|win)\.jpg|poster_gp0[123489]\.jpg|card_(?:follow|hold)\.jpg|hook_b(?:_m)?\.jpg)$/)) return await serveFile(req, res, join(PRIVATE, m[1]));
    const page = p === '/' ? '/index.html' : p === '/observer' ? '/observer.html' : p === '/teaser' ? '/teaser.html' : p;
    const file = normalize(join(PUBLIC, page));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');
    return await serveFile(req, res, file);
  } catch (e) {
    return send(res, e.code === 'ENOENT' ? 404 : 500, e.code === 'ENOENT' ? 'not found' : 'error');
  }
}).listen(PORT, HOST, () => {
  console.log(`Second Look RC3 (isolated copy of RC2.1.1; RC3 is the default, ?rc3=0 = RC2.1.1 behaviour) on http://${LAN ? '<this-machine-ip>' : '127.0.0.1'}:${PORT}/`);
  console.log(`  RC3: /   ·   a lens from the hub: /?lens=shots|follow|hold   ·   RC2.1.1 comparison: /?rc3=0&rc2=1&hk=B&dur=0`);
  console.log(`  WAVE 3C converged product: /?mode=wave3c   ·   owned-media teaser: /teaser   ·   demo = wave3c`);
  console.log(`  FULL JOURNEY (Wave 3B-3 test): /?mode=journey&p=CODE&cat=NOVICE   ·   GP-09 cold baseline: /?mode=gp09cold&p=CODE&cat=...   ·   (demo now = wave3c)`);
  console.log(`  historical: A1 /?mode=a1&p=CODE&cat=...   ·   A2 /?mode=a2&p=CODE&cat=...`);
  console.log(`  observer: /observer`);
  if (LAN) console.log(`  LAN MODE: every non-localhost request needs ?k=${TOKEN} (first visit sets a cookie). Turn off after the session.`);
});
