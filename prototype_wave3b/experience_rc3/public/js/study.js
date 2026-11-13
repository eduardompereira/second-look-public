const APP_VERSION = 'rc21';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
function device() {
  const ua = navigator.userAgent || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || /Macintosh/.test(ua) && navigator.maxTouchPoints > 1 ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'other';
  const inapp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|LinkedInApp|Snapchat|; wv\)|GSA\//.test(ua);
  const browser = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'other';
  return {
    os,
    browser: inapp ? `${browser} (in-app)` : browser,
    inapp,
    ua: ua.replace(/\s+/g, ' ').slice(0, 200),
    vw: innerWidth,
    vh: innerHeight,
    dpr: devicePixelRatio,
    coarse: matchMedia('(pointer: coarse)').matches,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    lang: (navigator.language || '').slice(0, 12)
  };
}
const post = (op, body) => fetch(`/api/study?op=${op}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body),
  credentials: 'same-origin'
}).then(async r => ({
  status: r.status,
  body: await r.json().catch(() => ({}))
}));
export async function studyBoot() {
  const t = new URLSearchParams(location.search).get('t');
  if (!t) return null;
  const sk = `sl_study_${t.slice(0, 16)}`;
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(sk) || 'null');
  } catch {}
  let r = null;
  for (let i = 0; i < 3 && !r; i++) {
    try {
      const x = await post('start', {
        token: t,
        resume: saved ? {
          session: saved.session,
          key: saved.key
        } : null,
        device: device(),
        app_version: APP_VERSION
      });
      if (x.status === 200 && x.body.ok) r = x.body;else if (x.status === 403) return block(x.body.error === 'link_closed' ? 'closed' : 'invalid');
    } catch {}
    if (!r) await new Promise(res => setTimeout(res, 800 * (i + 1)));
  }
  if (!r) return block('network');
  const same = saved && saved.session === r.session;
  const st = {
    ...r,
    token: t,
    page: same ? saved.page + 1 : 0,
    started_ms: same ? saved.started_ms : Date.now()
  };
  try {
    sessionStorage.setItem(sk, JSON.stringify({
      session: st.session,
      key: st.key,
      page: st.page,
      started_ms: st.started_ms
    }));
  } catch {}
  return st;
}
function block(kind) {
  const msg = {
    invalid: 'This link is not valid. Please check that you opened the complete link you were sent, or ask the person who sent it.',
    closed: 'This study link has been closed. Thank you for your interest.',
    network: 'The study page could not connect. Please check your internet connection and reload this page.'
  }[kind];
  document.getElementById('app').innerHTML = `<section class="st-note"><p class="st-k">Second Look · study preview</p><h1>${kind === 'network' ? 'No connection' : 'Link not available'}</h1><p>${esc(msg)}</p>
    ${kind === 'network' ? '<p><button class="cta-sm" type="button" onclick="location.reload()">Reload</button></p>' : ''}</section>`;
  return {
    blocked: kind
  };
}
export function studyNotice(S) {
  if (S.consent) return Promise.resolve();
  const ov = document.createElement('div');
  ov.className = 'st-overlay';
  ov.innerHTML = `<section class="st-note" role="dialog" aria-modal="true" aria-labelledby="st-h">
    <p class="st-k">Second Look · study preview</p>
    <h1 id="st-h">Thanks for trying this prototype.</h1>
    <p>Use it as you normally would on your phone. There are no right or wrong answers and you can stop at any time.</p>
    <p class="st-small">While you use it, this page records <b>anonymous interaction data</b>: what you tap and choose, timings, and your device type and screen size.
      It does not record your name, email, camera, microphone or screen. You can ask the person who sent you this link to delete your data.</p>
    <p><button class="cta-sm st-go" type="button">Continue</button></p></section>`;
  document.body.appendChild(ov);
  ov.querySelector('.st-go').focus();
  return new Promise(res => ov.querySelector('.st-go').onclick = async e => {
    e.currentTarget.disabled = true;
    await post('consent', {
      session: S.session,
      key: S.key
    }).catch(() => {});
    ov.remove();
    res();
  });
}
export class StudyDelivery {
  constructor(S, log) {
    this.S = S;
    this.log = log;
    this.seq = 0;
    this.q = [];
    this.inflight = false;
    this.fails = 0;
    this.wait = 0;
    this.maxQ = 0;
    this.timer = null;
    this.status = {
      queued: 0,
      failures: 0,
      lastOk: null
    };
    setInterval(() => this.flush(), 2000);
    addEventListener('online', () => {
      this.wait = 0;
      this.flush();
    });
    addEventListener('pagehide', () => this.beacon());
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.beacon();
    });
  }
  push(type, data, t_ms, iso) {
    this.q.push({
      page: this.S.page,
      seq: this.seq++,
      type,
      t_ms,
      iso,
      elapsed_ms: Date.now() - this.S.started_ms,
      data
    });
    this.maxQ = Math.max(this.maxQ, this.q.length);
    this.status.queued = this.q.length;
  }
  async flush() {
    if (this.inflight || !this.q.length || Date.now() < this.wait) return;
    this.inflight = true;
    const batch = this.q.slice(0, 150);
    try {
      const r = await post('events', {
        session: this.S.session,
        key: this.S.key,
        events: batch
      });
      if (r.status === 200 && r.body.ok) {
        const done = new Set(batch.map(e => `${e.page}:${e.seq}`));
        this.q = this.q.filter(e => !done.has(`${e.page}:${e.seq}`));
        if (this.fails) {
          const f = this.fails;
          this.fails = 0;
          this.push('delivery_recovered', {
            failed_attempts: f,
            max_queue: this.maxQ
          });
        }
        this.status = {
          queued: this.q.length,
          failures: 0,
          lastOk: Date.now()
        };
        this.wait = 0;
      } else if (r.status === 400 || r.status === 413) {
        this.q = this.q.slice(batch.length);
      } else throw new Error(String(r.status));
    } catch {
      this.fails++;
      this.status.failures = this.fails;
      this.wait = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(this.fails, 5));
    } finally {
      this.inflight = false;
    }
  }
  beacon() {
    if (!this.q.length || !navigator.sendBeacon) return;
    const body = JSON.stringify({
      session: this.S.session,
      key: this.S.key,
      events: this.q.slice(0, 150)
    });
    try {
      navigator.sendBeacon('/api/study?op=events', new Blob([body], {
        type: 'text/plain;charset=UTF-8'
      }));
    } catch {}
  }
}
export function studyFeedback(S, host, log) {
  if (S.feedback_done || S.entry === 'prompted_s2' || host.querySelector('.st-fb')) return;
  const q = (name, label, opts, multi = false) => `<fieldset class="st-q" data-q="${name}"><legend>${label}</legend><div class="st-opts">${opts.map(([v, t]) => `<button type="button" class="st-opt" data-v="${v}" aria-pressed="false"${multi ? ' data-multi="1"' : ''}>${t}</button>`).join('')}</div></fieldset>`;
  const el = document.createElement('section');
  el.className = 'st-fb';
  el.setAttribute('aria-label', 'Feedback');
  el.innerHTML = `<p class="st-k">Before you go · optional</p><h2>Four quick questions</h2>
    ${q('worth', 'Was the Second Look worth your time?', [['yes', 'Yes'], ['somewhat', 'Somewhat'], ['no', 'No']])}
    ${q('noticed', 'Did it show you something you hadn’t noticed?', [['yes', 'Yes'], ['not_sure', 'Not sure'], ['no', 'No']])}
    ${q('friction', 'Did any part feel too slow, confusing or hard to use?', [['too_slow', 'Too slow'], ['confusing', 'Confusing'], ['hard_to_use', 'Hard to use'], ['none', 'None of these']], true)}
    <label class="st-l">Which part? <span>(optional)</span><textarea data-t="friction_where" maxlength="600" rows="2"></textarea></label>
    ${q('again', 'Would you choose a Second Look after another match?', [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']])}
    <label class="st-l">Why? <span>(optional)</span><textarea data-t="again_why" maxlength="600" rows="2"></textarea></label>
    <label class="st-l">Anything else? <span>(optional)</span><textarea data-t="comment" maxlength="1500" rows="2"></textarea></label>
    <p class="st-acts"><button type="button" class="cta-sm st-send">Send</button><button type="button" class="textbtn st-skip">Skip</button></p>
    <p class="st-status" role="status" aria-live="polite"></p>`;
  host.appendChild(el);
  log.log('feedback_shown');
  const dk = `sl_fb_${S.session}`,
    draft = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(dk) || 'null') || {};
      } catch {
        return {};
      }
    })();
  const ans = draft.ans || {};
  const saveDraft = () => {
    try {
      const t = {};
      el.querySelectorAll('textarea[data-t]').forEach(x => t[x.dataset.t] = x.value);
      sessionStorage.setItem(dk, JSON.stringify({
        ans,
        t
      }));
    } catch {}
  };
  el.querySelectorAll('textarea[data-t]').forEach(x => {
    if (draft.t?.[x.dataset.t]) x.value = draft.t[x.dataset.t];
    x.addEventListener('input', saveDraft);
  });
  const keep = () => {
    const a = document.activeElement;
    if (!a || !el.contains(a) || a.tagName !== 'TEXTAREA') return;
    const vv = window.visualViewport,
      r = a.getBoundingClientRect(),
      top = vv ? vv.offsetTop : 0,
      h = vv ? vv.height : innerHeight;
    if (r.top < top + 12 || r.bottom > top + h - 12) a.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
  };
  el.addEventListener('focusin', () => setTimeout(keep, 350));
  window.visualViewport?.addEventListener('resize', () => setTimeout(keep, 60));
  el.querySelectorAll('.st-q').forEach(fs => {
    const k = fs.dataset.q,
      v0 = ans[k];
    fs.querySelectorAll('.st-opt').forEach(x => x.setAttribute('aria-pressed', String(Array.isArray(v0) ? v0.includes(x.dataset.v) : v0 === x.dataset.v)));
  });
  el.querySelectorAll('.st-q').forEach(fs => fs.querySelectorAll('.st-opt').forEach(b => b.onclick = () => {
    const k = fs.dataset.q,
      v = b.dataset.v;
    if (b.dataset.multi) {
      const set = new Set(ans[k] || []);
      if (v === 'none') set.clear();else set.delete('none');
      set.has(v) ? set.delete(v) : set.add(v);
      ans[k] = [...set];
      fs.querySelectorAll('.st-opt').forEach(x => x.setAttribute('aria-pressed', String(set.has(x.dataset.v))));
    } else {
      ans[k] = v;
      fs.querySelectorAll('.st-opt').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }
    saveDraft();
  }));
  const status = el.querySelector('.st-status');
  const send = async skipped => {
    const answers = skipped ? {} : {
      ...ans,
      friction_where: el.querySelector('[data-t=friction_where]').value.trim(),
      again_why: el.querySelector('[data-t=again_why]').value.trim()
    };
    const comment = skipped ? '' : el.querySelector('[data-t=comment]').value.trim();
    el.querySelectorAll('button').forEach(b => b.disabled = true);
    status.textContent = skipped ? '' : 'Saving…';
    status.className = 'st-status';
    let ok = false;
    try {
      const r = await post('feedback', {
        session: S.session,
        key: S.key,
        answers,
        comment,
        skipped
      });
      ok = r.status === 200 && r.body.saved;
    } catch {}
    if (ok) {
      S.feedback_done = true;
      try {
        sessionStorage.removeItem(dk);
      } catch {}
      log.log(skipped ? 'feedback_skip' : 'feedback_submit', {
        answered: Object.keys(answers).filter(k => answers[k] && answers[k].length).length
      });
      el.innerHTML = `<p class="st-done">${skipped ? 'No problem. Thank you for trying it.' : 'Thank you. Your answers were saved.'} You can close this page now.</p>`;
    } else {
      status.textContent = 'Couldn’t save. Check your connection and try again.';
      status.className = 'st-status err';
      el.querySelectorAll('button').forEach(b => b.disabled = false);
      log.log('feedback_save_failed');
    }
  };
  el.querySelector('.st-send').onclick = () => send(false);
  el.querySelector('.st-skip').onclick = () => send(true);
}
export function studyEndCard(app) {
  app.innerHTML = `<section class="st-note"><p class="st-k">Second Look · study preview</p><h1>That’s the end of this part.</h1><p>Thank you. You can hand the phone back or close this page.</p></section>`;
}
