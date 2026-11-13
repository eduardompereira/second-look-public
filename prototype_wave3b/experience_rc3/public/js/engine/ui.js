import { sleep, reduced } from './stage.js';
const esc = s => String(s).replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
})[c]);
export const nl2br = s => esc(s).replace(/\n/g, '<br>');
export const evd = rows => `<dl class="evd">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
export class Captions {
  constructor(root, log) {
    this.root = root;
    this.log = log;
    this.topEl = root.querySelector('.cap.top');
    this.lowEl = root.querySelector('.cap.low');
    this.evEl = root.querySelector('.cap.ev');
    this.actEl = root.querySelector('.act');
    this.holdEl = root.querySelector('.holdline');
  }
  async _set(el, html, {
    stagger = 380,
    cls = ''
  } = {}) {
    if (el.innerHTML) {
      el.classList.add('out');
      await sleep(200);
    }
    el.className = el.className.replace(/\s?k-\S+/g, '') + (cls ? ` k-${cls}` : '');
    el.innerHTML = html;
    el.classList.remove('out');
    const lns = [...el.querySelectorAll('.ln')];
    for (const l of lns) {
      requestAnimationFrame(() => l.classList.add('in'));
      await sleep(stagger);
    }
  }
  top(lines, opt = {}) {
    return this._set(this.topEl, lines.map((p, i) => `<span class="ln l${i}">${p}</span>`).join(''), opt);
  }
  low(lines, opt = {}) {
    return this._set(this.lowEl, lines.map((p, i) => `<span class="ln l${i}">${p}</span>`).join(''), opt);
  }
  ev(text) {
    this.evEl.innerHTML = text ? `<p><b class="src">Source</b>${text}</p>` : '';
    this.evEl.classList.toggle('in', !!text);
  }
  dimTop(on) {
    this.topEl.classList.toggle('dim', on);
  }
  async clear(which = ['top', 'low', 'ev', 'act']) {
    const els = which.map(w => ({
      top: this.topEl,
      low: this.lowEl,
      ev: this.evEl,
      act: this.actEl
    })[w]);
    els.forEach(e => e.classList.add('out'));
    await sleep(220);
    els.forEach(e => {
      e.innerHTML = '';
      e.classList.remove('out', 'in', 'dim');
    });
  }
  async question(q, sub = '') {
    await this._set(this.topEl, `<span class="ln q in">${nl2br(q)}</span>${sub ? `<span class="ln sub in">${esc(sub)}</span>` : ''}`, {
      stagger: 0,
      cls: 'q'
    });
    this.actEl.innerHTML = '<button class="chipbtn" data-k="notsure">Not sure</button>';
    return new Promise(res => {
      this.actEl.querySelector('[data-k=notsure]').onclick = e => {
        e.stopPropagation();
        res('not_sure');
      };
    });
  }
  hold(ms, at) {
    const el = this.holdEl;
    el.style.setProperty('--ms', `${ms}ms`);
    el.classList.remove('run');
    void el.offsetWidth;
    el.classList.add('run');
    return new Promise(res => {
      let done = false;
      const finish = how => {
        if (done) return;
        done = true;
        clearTimeout(tid);
        this.root.removeEventListener('pointerup', onTap);
        removeEventListener('keydown', onKey);
        el.classList.remove('run');
        this.log.log('advance', {
          at,
          how
        });
        res(how);
      };
      const onTap = e => {
        if (e.target.closest('button, a')) return;
        finish('tap');
      };
      const onKey = e => {
        if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          finish('key');
        }
      };
      const tid = setTimeout(() => finish('auto'), reduced() ? ms * 1.3 : ms);
      setTimeout(() => {
        if (!done) {
          this.root.addEventListener('pointerup', onTap);
          addEventListener('keydown', onKey);
        }
      }, 250);
    });
  }
}
export const READ = {
  wpm: 180,
  buffer: 1100,
  labelBuffer: 500,
  min: 1700
};
const words = el => el && !el.hidden ? (el.innerText || el.textContent || '').trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
Object.assign(Captions.prototype, {
  ctx(html) {
    const el = this.root.querySelector('.cap.cx');
    if (!el) return;
    el.innerHTML = html ? `<p>${html}</p>` : '';
    el.classList.toggle('in', !!html);
  },
  src(text, details = '') {
    const teach = !!details && !this._taughtDetails;
    this.evEl.innerHTML = text ? `<p class="srcline"><span class="srctxt"><b class="src">Simulated data</b>${text}</span>${details ? `<button class="srcmore${teach ? ' teach' : ''}" type="button" aria-label="Evidence details"><i aria-hidden="true">i</i><span>Details</span></button>` : ''}</p>` : '';
    this.evEl.classList.toggle('in', !!text);
    const b = this.evEl.querySelector('.srcmore');
    if (teach) {
      this._taughtDetails = true;
      this.log.log('details_taught', {
        at: document.body.dataset.beat || ''
      });
    }
    if (b) b.onclick = e => {
      e.stopPropagation();
      b.classList.remove('teach');
      const at = document.body.dataset.beat || '';
      this.log.log('source_details_open', {
        at
      });
      if (this.paceUI) this.log.log('detail_open', {
        at,
        kind: 'story_details'
      });
      this._detailsOpen?.();
      sheet(details, () => {
        if (this.paceUI) this.log.log('detail_close', {
          at,
          kind: 'story_details'
        });
        this._detailsClose?.();
      });
    };
  },
  readingWords() {
    const cx = this.root.querySelector('.cap.cx'),
      plate = this.root.querySelector('.bridge:not([hidden]) .bcap');
    return words(this.topEl) + words(this.lowEl) + words(cx) + words(plate) + Math.round((this.srcWeight ?? 0.4) * words(this.evEl));
  },
  read(at, {
    extraMs = 0,
    min = READ.min,
    label = false
  } = {}) {
    const w = this.readingWords();
    const ms = Math.max(min, Math.round(w * 60000 / READ.wpm) + (label ? READ.labelBuffer : READ.buffer) + extraMs);
    this.log.log('read_hold', {
      at,
      words: w,
      ms,
      mode: 'auto'
    });
    return this.holdW(ms, at);
  },
  paceShow(kind, onGo, label = '') {
    if (!this.paceUI) return;
    let b = this.root.querySelector('.pace');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'pace';
      this.root.querySelector('.band.bottom').appendChild(b);
    }
    clearTimeout(this._paceOff);
    b.dataset.kind = kind;
    b.dataset.at = label;
    b.innerHTML = kind === 'skip' ? '<span>Skip replay</span><i aria-hidden="true"></i><i aria-hidden="true"></i>' : '<span>Continue</span><i aria-hidden="true"></i>';
    b.setAttribute('aria-label', kind === 'skip' ? 'Skip this replay' : 'Continue');
    b.onclick = e => {
      e.stopPropagation();
      onGo('button');
    };
    b.hidden = false;
    requestAnimationFrame(() => b.classList.add('in'));
  },
  paceHide() {
    const b = this.root.querySelector('.pace');
    if (!b) return;
    b.onclick = null;
    b.classList.remove('in');
    clearTimeout(this._paceOff);
    this._paceOff = setTimeout(() => {
      if (!b.classList.contains('in')) b.hidden = true;
    }, 260);
  },
  holdW(ms, at, {
    tapOnly = false
  } = {}) {
    const el = this.holdEl,
      scale = reduced() ? 1.3 : 1;
    ms = Math.round(ms * scale);
    if (this.clarity && this.evEl?.classList.contains('in')) {
      tapOnly = true;
      this.log.log('evidence_wait', {
        at
      });
    }
    el.style.setProperty('--ms', `${ms}ms`);
    el.classList.remove('run');
    void el.offsetWidth;
    if (!(this.clarity && tapOnly)) el.classList.add('run');
    return new Promise(res => {
      let done = false,
        tid = null,
        pill = null,
        finishHint = null;
      const finish = how => {
        if (done) return;
        done = true;
        clearTimeout(tid);
        finishHint?.();
        this.root.removeEventListener('pointerup', onTap);
        removeEventListener('keydown', onKey);
        el.classList.remove('run');
        pill?.remove();
        this._detailsOpen = this._detailsClose = null;
        this.paceHide();
        this.log.log('advance', {
          at,
          how
        });
        if (how !== 'auto') this.log.log('manual_advance', {
          at,
          how,
          ms_planned: ms
        });
        res(how);
      };
      if (this.paceUI) this.paceShow('continue', finish, at);
      const showPill = () => {
        if (this.paceUI) return;
        if (done || pill) return;
        pill = document.createElement('button');
        pill.className = 'contpill';
        pill.type = 'button';
        pill.innerHTML = '<span>Continue</span><i aria-hidden="true"></i>';
        pill.onclick = e => {
          e.stopPropagation();
          finish('continue');
        };
        this.root.querySelector('.band.bottom').appendChild(pill);
        requestAnimationFrame(() => pill.classList.add('in'));
      };
      const onTap = e => {
        if (e.target.closest('button, a, .sheet')) return;
        finish('tap');
      };
      const onKey = e => {
        if (document.querySelector('.sheet')) return;
        if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          finish('key');
        }
      };
      tid = setTimeout(() => tapOnly ? showPill() : finish('auto'), ms);
      let hint = null;
      if (this.tapHint && !this.paceUI && !tapOnly && ms >= 4500) {
        const ht = setTimeout(() => {
          if (done) return;
          hint = document.createElement('span');
          hint.className = 'taphint';
          hint.setAttribute('aria-hidden', 'true');
          hint.textContent = 'Tap to continue';
          this.root.querySelector('.band.bottom')?.appendChild(hint);
          requestAnimationFrame(() => hint?.classList.add('in'));
        }, 2000);
        finishHint = () => {
          clearTimeout(ht);
          hint?.remove();
        };
      }
      this._detailsOpen = () => {
        clearTimeout(tid);
        el.classList.remove('run');
        tapOnly = true;
      };
      this._detailsClose = () => {
        if (!done) showPill();
      };
      setTimeout(() => {
        if (!done) {
          this.root.addEventListener('pointerup', onTap);
          addEventListener('keydown', onKey);
        }
      }, 250);
    });
  }
});
export function sheet(html, onClose) {
  const m = document.createElement('div');
  m.className = 'sheet';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'Evidence');
  m.innerHTML = `<div class="sbox"><p class="skick">Evidence</p>${html}<button class="cta-sm" type="button">Close</button></div>`;
  const close = e => {
    e?.stopPropagation();
    m.remove();
    onClose && onClose();
  };
  m.querySelector('button').onclick = close;
  m.addEventListener('pointerup', e => {
    e.stopPropagation();
    if (e.target === m) close(e);
  });
  document.body.appendChild(m);
  m.querySelector('button').focus();
}
export class Chapters {
  constructor(el, chapters) {
    this.el = el;
    this.ch = chapters;
    el.innerHTML = `${chapters.map(c => `<i data-c="${c.id}"></i>`).join('')}<span></span>`;
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-valuemin', 0);
    el.setAttribute('aria-valuemax', chapters.length);
  }
  set(id) {
    if (!id || id === this.cur) return;
    this.cur = id;
    const i = this.ch.findIndex(c => c.id === id);
    if (i < 0) return;
    this.el.querySelectorAll('i').forEach((d, k) => {
      d.dataset.s = k < i ? 'done' : k === i ? 'now' : '';
    });
    const s = this.el.querySelector('span');
    s.textContent = this.ch[i].label || '';
    this.el.setAttribute('aria-valuenow', i + 1);
    this.el.setAttribute('aria-valuetext', this.ch[i].label || '');
    s.classList.remove('on');
    void s.offsetWidth;
    if (this.ch[i].label) s.classList.add('on');
  }
}
export function modal(html, onClose, label) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="box">${html}<div class="row"><button class="cta-sm">${esc(label)}</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('button').onclick = e => {
    e.stopPropagation();
    m.remove();
    onClose && onClose();
  };
}
export function shareCard({
  match,
  reads
}) {
  return `<div class="sharecard" role="img" aria-label="Share card mock-up">
    <div class="sc-top">SECOND LOOK</div>
    <div class="sc-match">${esc(match.label)}<br><b>${esc(match.home)} ${esc(match.score)} ${esc(match.away)}</b></div>
    <div class="sc-big">I found ${reads} things<br>I missed the first time.</div>
    <div class="sc-dots">${'<i></i>'.repeat(reads)}</div>
    <div class="sc-cta">Can you spot them?</div>
  </div>`;
}
