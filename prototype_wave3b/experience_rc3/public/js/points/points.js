const KEY = 'sl.points.v1';
const GROUPS = {
  s1: 'Story 1',
  s2: 'Story 2',
  look: 'Look around',
  deep: 'Closer look'
};
export const DISCOVERIES = [{
  id: 'gp02',
  group: 's1',
  pts: 10,
  label: 'What was in front of the winner',
  on: e => e.type === 'context_shown' && e.beat === 'gp02'
}, {
  id: 'gp04',
  group: 's1',
  pts: 10,
  label: 'The quickest second attempt',
  on: e => e.type === 'context_shown' && e.beat === 'gp04'
}, {
  id: 'twin',
  group: 's1',
  pts: 5,
  label: 'Same score, same goalie',
  on: e => e.type === 'twin_shown'
}, {
  id: 'gp03',
  group: 's2',
  pts: 5,
  label: 'The best chance of the final',
  on: e => e.type === 'context_shown' && e.beat === 'gp03'
}, {
  id: 'gp08',
  group: 's2',
  pts: 10,
  label: 'Where the goal came from',
  on: e => e.type === 'context_shown' && e.beat === 'gp08'
}, {
  id: 'gp09',
  group: 's2',
  pts: 10,
  label: "Try it yourself: the Ridge attack",
  on: e => e.type === 'context_shown' && e.beat === 'gp09'
}, {
  id: 'shots',
  group: 'look',
  pts: 15,
  label: "Every Harbour attempt on Novak",
  on: e => e.type === 'look_found' && e.inv === 'shots'
}, {
  id: 'follow',
  group: 'look',
  pts: 15,
  label: 'The last pass',
  on: e => e.type === 'look_found' && e.inv === 'follow'
}, {
  id: 'hold',
  group: 'look',
  pts: 15,
  label: 'Who was on the ice',
  on: e => e.type === 'look_found' && e.inv === 'hold'
}, {
  id: 'evidence',
  group: 'deep',
  pts: 5,
  label: 'Looked closer at a finding',
  on: e => e.type === 'detail_open' || e.type === 'source_details_open' || e.type === 'look_why_open'
}];
export const MAX = DISCOVERIES.reduce((a, d) => a + d.pts, 0);
const SHOW = new Set(['choice1_shown', 'carry_reached', 'carry_final_shown', 'look_found', 'look_home']);
const HIDE = new Set(['beat_start', 'score_page_shown', 'context_open', 'context_close', 'story_resume', 'look_open', 'look_inv_start', 'look_step', 'look_replay', 'look_pair', 'look_back_to_score', 'back_to_score', 'exit_tap']);
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function load() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.found)) return {
      found: s.found.filter(id => DISCOVERIES.some(d => d.id === id)),
      shown: +s.shown || 0
    };
  } catch {}
  return {
    found: [],
    shown: 0
  };
}
function save(S) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
}
export function initPoints(ctx, {
  match
} = {}) {
  const {
    log
  } = ctx;
  const S = load();
  let fresh = [];
  let panel = null,
    opener = null;
  const total = () => S.found.reduce((a, id) => a + (DISCOVERIES.find(d => d.id === id)?.pts || 0), 0);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/css/points.css';
  document.head.insertBefore(css, document.querySelector('link[href="/css/b1.css"]'));
  document.body.classList.add('pts-on');
  const box = document.createElement('div');
  box.className = 'pts';
  box.hidden = true;
  box.innerHTML = `<button class="pts-pill" type="button"><i class="pts-dot" aria-hidden="true"></i><b class="pts-n">0</b><span class="pts-of">/ ${MAX}</span><span class="pts-gain" aria-hidden="true"></span></button>
    <p class="pts-tip" aria-hidden="true" hidden></p><p class="pts-live" aria-live="polite"></p>`;
  document.body.appendChild(box);
  const pill = box.querySelector('.pts-pill'),
    nEl = box.querySelector('.pts-n'),
    gainEl = box.querySelector('.pts-gain'),
    liveEl = box.querySelector('.pts-live'),
    tipEl = box.querySelector('.pts-tip');
  const label = () => `Your Second Look: ${total()} of ${MAX} points, ${S.found.length} of ${DISCOVERIES.length} discoveries. Show what is left to discover.`;
  pill.addEventListener('pointerup', e => e.stopPropagation());
  pill.onclick = e => {
    e.stopPropagation();
    openPanel(document.body.dataset.beat || 'pill');
  };
  let countTw = 0;
  function countTo(to) {
    const from = +nEl.textContent || 0,
      tw = ++countTw;
    if (reduced() || to <= from) {
      nEl.textContent = to;
      return;
    }
    const t0 = performance.now(),
      dur = Math.min(900, 120 + (to - from) * 22);
    const step = t => {
      if (tw !== countTw) return;
      const k = Math.min(1, (t - t0) / dur),
        v = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      nEl.textContent = v;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const isShown = el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  };
  function place() {
    const look = document.body.classList.contains('look');
    box.style.visibility = 'hidden';
    const ctl = [...document.querySelectorAll(look ? '.lk-nav .lk-all, .lk-nav .lk-score' : '#story .fsbtn, #story .x')].filter(isShown).map(el => el.getBoundingClientRect());
    box.style.visibility = '';
    box.classList.toggle('docked', look);
    if (!ctl.length) {
      box.style.right = box.style.top = '';
      return;
    }
    const left = Math.min(...ctl.map(r => r.left)),
      r0 = ctl[0];
    box.style.right = `${Math.round(innerWidth - left + 4)}px`;
    box.style.top = `${Math.round(r0.top + (r0.height - pill.offsetHeight) / 2)}px`;
    box.classList.remove('b1-below');
    if (look) {
      const pr = pill.getBoundingClientRect(),
        nav = document.querySelector('.lk-nav');
      const words = [...document.querySelectorAll('.lk-nav .lk-brand > span, .lk-nav .lk-where')].map(textBox).filter(Boolean);
      if (words.some(t => !(pr.right <= t.left || pr.left >= t.right || pr.bottom <= t.top || pr.top >= t.bottom)) && nav) {
        box.classList.add('b1-below');
      }
    }
  }
  function room() {
    const p = pill.getBoundingClientRect();
    let limit = 12;
    document.querySelectorAll('#story .chap, #story .cap.top .ln, .next:not([hidden]) .nx-k > *, .next:not([hidden]) .nx-k li, .next:not([hidden]) .fin-top > *, .lk-nav .lk-brand > span, .lk-nav .lk-where').forEach(el => {
      const t = textBox(el);
      if (!t || t.bottom < p.top || t.top > p.bottom || t.left >= p.right) return;
      limit = Math.max(limit, t.right + 12);
    });
    return p.left - limit;
  }
  const TEXT = '#story .cap.top .ln, #story .cap.low .ln, #story .cap.cx, #story .act button, .next:not([hidden]) .nx-k *, .next:not([hidden]) .fin-top *, .next:not([hidden]) .nx-card *';
  function textBox(el) {
    if (!el.getClientRects().length) return null;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const r = rg.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  }
  addEventListener('resize', () => {
    if (!box.hidden) place();
  });
  let gainTimer = 0,
    showSeq = 0;
  function show(at) {
    const t = total(),
      delta = t - S.shown,
      got = fresh.map(id => DISCOVERIES.find(d => d.id === id)).filter(Boolean),
      seq = ++showSeq;
    nEl.textContent = S.shown;
    box.hidden = false;
    box.classList.remove('gaining');
    gainEl.textContent = '';
    tipEl.hidden = true;
    tipEl.classList.remove('in');
    clearTimeout(gainTimer);
    place();
    pill.setAttribute('aria-label', label());
    requestAnimationFrame(() => box.classList.add('in'));
    setTimeout(() => requestAnimationFrame(() => {
      if (seq !== showSeq || box.hidden) return;
      place();
      if (delta > 0 && got.length) {
        const what = got.length === 1 ? got[0].label : `${got.length} new discoveries`;
        liveEl.textContent = `Plus ${delta} points: ${what}.`;
        const free = room(),
          inline = free >= 150 && !box.classList.contains('docked');
        const docked = box.classList.contains('docked');
        gainEl.innerHTML = `<b>+${delta}</b>${inline ? ` ${esc(what)}` : docked || free < 95 ? '' : ' discovered'}`;
        gainEl.style.maxWidth = inline ? `${Math.min(330, Math.round(free + 34))}px` : '';
        box.classList.add('gaining', 'gain');
        setTimeout(() => box.classList.remove('gain'), 900);
        if (false) {
          tipEl.textContent = got.length === 1 ? `Discovered: ${what}` : what;
          const pr = pill.getBoundingClientRect();
          const fits = w => {
            tipEl.style.maxWidth = `${Math.round(w)}px`;
            tipEl.hidden = false;
            const t = tipEl.getBoundingClientRect();
            const hit = [...document.querySelectorAll(TEXT)].some(el => {
              const b = textBox(el);
              return b && !(b.right <= t.left || b.left >= t.right || b.bottom <= t.top || b.top >= t.bottom);
            });
            if (hit) tipEl.hidden = true;
            return !hit;
          };
          let ok = fits(Math.min(360, pr.right - 12));
          if (!ok) {
            const h = tipEl.hidden ? 34 : tipEl.offsetHeight;
            let lim = 12;
            document.querySelectorAll(TEXT).forEach(el => {
              const b = textBox(el);
              if (!b || b.bottom < pr.bottom || b.top > pr.bottom + h * 2 + 8 || b.left >= pr.right) return;
              lim = Math.max(lim, b.right + 12);
            });
            if (pr.right - lim >= 140) ok = fits(Math.min(360, pr.right - lim));
          }
          if (!ok) {
            tipEl.classList.add('toast');
            tipEl.style.maxWidth = `${Math.round(Math.min(300, pr.right - 12))}px`;
            tipEl.hidden = false;
            ok = true;
          }
          if (ok) requestAnimationFrame(() => tipEl.classList.add('in'));
        }
        gainTimer = setTimeout(() => {
          box.classList.remove('gaining');
          tipEl.classList.remove('in');
          setTimeout(() => {
            tipEl.hidden = true;
            tipEl.classList.remove('toast');
          }, 320);
        }, 4200);
      }
      countTo(t);
    }), 90);
    log.log('points_shown', {
      at,
      total: t,
      delta,
      found_n: S.found.length
    });
    S.shown = t;
    fresh = [];
    save(S);
  }
  function hide() {
    if (box.hidden) return;
    box.classList.remove('in', 'gaining');
    clearTimeout(gainTimer);
    box.hidden = true;
  }
  function award(d) {
    S.found.push(d.id);
    fresh.push(d.id);
    save(S);
    log.log('points_award', {
      id: d.id,
      pts: d.pts,
      total: total(),
      found_n: S.found.length
    });
    if (!box.hidden) show('live');
  }
  function panelHTML() {
    const t = total(),
      n = S.found.length,
      N = DISCOVERIES.length;
    const groups = Object.entries(GROUPS).map(([g, title]) => {
      const items = DISCOVERIES.filter(d => d.group === g).map(d => {
        const got = S.found.includes(d.id);
        return `<li class="${got ? 'got' : 'todo'}"><i aria-hidden="true"></i><span>${esc(d.label)}</span><b>${got ? `+${d.pts}` : `${d.pts}`}</b><em class="sr">${got ? 'found' : 'still to discover'}</em></li>`;
      }).join('');
      return `<section><h3>${esc(title)}</h3><ul>${items}</ul></section>`;
    }).join('');
    const lead = n === N ? 'You’ve seen everything in this final.' : n === 0 ? 'Watch, look around and open the evidence to collect them.' : `${N - n} still to discover.`;
    return `<div class="sbox" role="document">
      <p class="skick">Your Second Look</p>
      <p class="pts-big"><b>${t}</b><span> / ${MAX} points</span></p>
      <div class="pts-bar" aria-hidden="true"><i style="width:${Math.round(t / MAX * 100)}%"></i></div>
      <p class="pts-lead">${esc(lead)} <span>Points come from discoveries. Your reads are never scored.</span></p>
      ${groups}
      <div class="pts-row"><button class="cta-sm pts-close" type="button">Close</button><button class="pts-reset" type="button">Start over</button></div>
    </div>`;
  }
  function renderPanel() {
    panel.innerHTML = panelHTML();
    panel.querySelector('.pts-close').onclick = e => {
      e.stopPropagation();
      closePanel('button');
    };
    panel.querySelector('.pts-reset').onclick = e => {
      e.stopPropagation();
      reset();
    };
  }
  function onKey(e) {
    if (e.key === 'Escape' && panel) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closePanel('esc');
    }
  }
  function openPanel(at) {
    if (panel) return;
    opener = document.activeElement;
    panel = document.createElement('div');
    panel.className = 'sheet pts-sheet';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Your Second Look points');
    panel.addEventListener('pointerup', e => {
      e.stopPropagation();
      if (e.target === panel) closePanel('backdrop');
    });
    renderPanel();
    document.body.appendChild(panel);
    addEventListener('keydown', onKey, true);
    panel.querySelector('.pts-close').focus({
      preventScroll: true
    });
    log.log('points_panel_open', {
      at,
      total: total(),
      found_n: S.found.length
    });
  }
  function closePanel(how) {
    if (!panel) return;
    panel.remove();
    panel = null;
    removeEventListener('keydown', onKey, true);
    log.log('points_panel_close', {
      how
    });
    opener?.focus?.({
      preventScroll: true
    });
  }
  function reset() {
    const rb = panel?.querySelector('.pts-reset');
    if (rb && !rb.dataset.armed) {
      rb.dataset.armed = '1';
      rb.textContent = 'Tap again to clear your points';
      return;
    }
    S.found = [];
    S.shown = 0;
    fresh = [];
    save(S);
    nEl.textContent = 0;
    pill.setAttribute('aria-label', label());
    log.log('points_reset', {});
    if (panel) {
      renderPanel();
      panel.querySelector('.pts-close').focus({
        preventScroll: true
      });
    }
    document.querySelector('#score .pts-strip')?.remove();
  }
  function scoreStrip() {
    const mod = document.querySelector('#score .sl-module');
    if (!mod || mod.querySelector('.pts-strip') || !S.found.length) return;
    const left = DISCOVERIES.length - S.found.length,
      t = total();
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pts-strip';
    b.setAttribute('aria-label', `Your Second Look: ${t} of ${MAX} points. ${left ? `${left} still to discover.` : 'Everything found.'} Show discoveries.`);
    b.innerHTML = `<i class="pts-dot" aria-hidden="true"></i><span><b>${t} / ${MAX}</b> points · ${left ? `${left} still to discover` : 'everything found'}</span><i class="pts-go" aria-hidden="true">›</i>`;
    b.onclick = e => {
      e.stopPropagation();
      openPanel('score_page');
    };
    const note = mod.querySelector('.sl-note');
    if (note) note.before(b);else mod.appendChild(b);
    log.log('points_shown', {
      at: 'score_page',
      total: t,
      delta: 0,
      found_n: S.found.length
    });
  }
  log.listeners.add(e => {
    if (e.type.startsWith('points_')) return;
    for (const d of DISCOVERIES) if (!S.found.includes(d.id) && d.on(e)) award(d);
    if (SHOW.has(e.type)) show(e.type);else if (HIDE.has(e.type)) {
      hide();
      if (e.type === 'score_page_shown') requestAnimationFrame(scoreStrip);
    }
  });
  ctx.points = {
    state: () => ({
      ...S,
      total: total(),
      visible: !box.hidden
    }),
    open: openPanel,
    reset
  };
  return ctx.points;
}
