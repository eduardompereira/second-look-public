import { sleep, reduced } from '../engine/stage.js';
import { nl2br } from '../engine/ui.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
})[c]);
const mmss = s => {
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const about5 = s => s < 2.5 ? 'just on' : mmss(5 * Math.round(s / 5));
const ICON = {
  back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  all: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5.6" height="5.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="11.4" y="3" width="5.6" height="5.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11.4" width="5.6" height="5.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="11.4" y="11.4" width="5.6" height="5.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  close: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.8v10.4L15.2 10z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.2" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const ABORT = Symbol('look-abort');
const RC3_BRIDGE = {
  shots: {
    stop: {
      line: "From your story: Lindqvist’s winner, 3rd period 12:41."
    }
  },
  follow: {
    s1_carry: {
      intro: "Chance 2 is the one you just saw. Who made the last Harbour pass before each?",
      line: 'Chance 2 is the one you just saw.'
    }
  },
  hold: {
    s2_carry: {
      head: "You saw both: the 8:47 save, then the 9:31 goal.",
      sub: "On the ice for the save: five skaters a side. Moments later, who was still on?",
      line: "The 8:47 save and the 9:31 goal from your story."
    }
  }
};
const HMAX = 6;
let SINGLETON = null;
export async function lookAround(ctx, opts = {}) {
  if (!SINGLETON) SINGLETON = await create(ctx, opts);
  return SINGLETON.open(opts.entry || 'carry', opts.open || null, {
    sel: opts.sel ?? null,
    resume: !!opts.resume,
    origin: opts.origin || null
  });
}
export async function lookClose() {
  if (SINGLETON) await SINGLETON.close();
}
async function create(ctx, {
  transition = 'cut'
} = {}) {
  const {
    stage,
    cap,
    log,
    root
  } = ctx;
  if (!document.querySelector('link[data-look]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/css/look.css';
    l.dataset.look = 1;
    document.head.insertBefore(l, document.querySelector('link[href="/css/b1.css"]'));
    await new Promise(r => {
      l.onload = r;
      l.onerror = r;
      setTimeout(r, 1500);
    });
  }
  const P = await (await fetch('/data/look_around.json')).json();
  const CARDS = new URLSearchParams(location.search).get('cards') === '1' ? await import('../e1/cards.js') : null;
  if (CARDS) await CARDS.loadCards();
  if (CARDS && !root.__e1cards) {
    root.__e1cards = 1;
    const pick = e => e.target.closest?.('[data-card]');
    root.addEventListener('pointerup', e => {
      if (pick(e)) e.stopPropagation();
    }, true);
    root.addEventListener('click', e => {
      const b = pick(e);
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      CARDS.openCard(b.dataset.card, log, b);
    }, true);
  }
  function cardName(pid) {
    const pp = PEOPLE[pid];
    return CARDS?.hasCard(pid) ? `<button type="button" class="e1-pl" data-card="${pid}" aria-label="${esc(pp.full)}: match card">${esc(pp.full)}</button>` : esc(pp.full);
  }
  const SELQ = new URLSearchParams(location.search).get('selects_map'),
    SELCTX = SELQ === '1';
  const SELMAP = SELQ === '1' || SELQ === 'card' ? await import('./selects_map.js') : null;
  let SEL = null;
  if (SELMAP) await SELMAP.mergeOtherSide(P);
  const INV = Object.fromEntries(P.investigations.map(i => [i.id, i]));
  const RUNNERS = new Set(['connect', 'hold', 'map']);
  const READY = P.investigations.filter(i => i.status === 'ready' && RUNNERS.has(i.kind));
  const HUB = () => READY.filter(i => !(SELCTX && i.id === 'shots_sel'));
  const MOM = P.moments,
    PAS = P.passes,
    PEOPLE = P.people;
  const RC3 = !!ctx.rc3;
  const st = {
    origin: null,
    map: {
      band: null,
      sel: null,
      all: false
    },
    run: 0,
    history: [],
    screen: null,
    inv: null,
    face: 'none',
    rinkKey: null,
    rinkAttack: null,
    moments: [],
    found: new Set(),
    predicted: {},
    revealed: {},
    kbd: false,
    tr: transition,
    where: ''
  };
  const screen = root.querySelector('.screen'),
    vw = stage.wrap;
  const FOLLOW_VARIANT = new URLSearchParams(location.search).get('follow') === 'rink' ? 'rink' : 'cards';
  const panelEl = document.createElement('div');
  panelEl.className = 'lk-panel';
  panelEl.hidden = true;
  {
    const band = cap.actEl.parentElement,
      cx = band.querySelector('.cap.cx');
    band.insertBefore(panelEl, cx || cap.actEl);
  }
  const moreEl = document.createElement('div');
  moreEl.className = 'lk3-morebox';
  moreEl.hidden = true;
  if (ctx.rc3) {
    const band = cap.actEl.parentElement,
      cx = band.querySelector('.cap.cx');
    if (cx) cx.after(panelEl);
    panelEl.after(moreEl);
  }
  const setMore = html => {
    moreEl.innerHTML = html || '';
    moreEl.hidden = !html;
  };
  const setPanel = html => {
    panelEl.innerHTML = html || '';
    panelEl.hidden = !html;
    requestAnimationFrame(scrollHint);
  };
  const bandB = cap.actEl.parentElement;
  const sideDoor = document.createElement('div');
  sideDoor.className = 'lk-acts lk-sidedoor';
  sideDoor.hidden = true;
  bandB.insertBefore(sideDoor, bandB.firstChild);
  function scrollHint() {
    const b = bandB;
    if (!b) return;
    const more = b.scrollHeight - b.clientHeight - b.scrollTop > 6;
    b.classList.toggle('lk-more-below', more);
    b.classList.toggle('lk-more-above', b.scrollTop > 6);
    const sc = screen,
      pm = getComputedStyle(sc).overflowY !== 'hidden' && sc.scrollHeight - sc.clientHeight - sc.scrollTop > 6;
    document.body.classList.toggle('lk-pmore', !!pm && !document.body.classList.contains('lk-homeon'));
  }
  bandB.addEventListener('scroll', () => requestAnimationFrame(scrollHint), {
    passive: true
  });
  addEventListener('resize', () => requestAnimationFrame(scrollHint));
  screen.addEventListener('scroll', () => requestAnimationFrame(scrollHint), {
    passive: true
  });
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(scrollHint)).observe(bandB);
  addEventListener('keydown', e => {
    if (['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) st.kbd = true;
  }, true);
  addEventListener('pointerdown', () => {
    st.kbd = false;
  }, true);
  const focusFirst = el => {
    if (!st.kbd || !el) return;
    const b = el.matches?.('button') ? el : el.querySelector('button:not([disabled])');
    b && b.focus({
      preventScroll: true
    });
  };
  const nav = document.createElement('nav');
  nav.className = 'lk-nav';
  nav.setAttribute('aria-label', 'Look around navigation');
  nav.innerHTML = `
    <button type="button" class="lk-nb lk-back" aria-label="Back">${ICON.back}</button>
    <div class="lk-id"><span class="lk-brand">${ICON.eye}<span>Look around</span></span><span class="lk-where" aria-live="polite"></span></div>
    <button type="button" class="lk-nb lk-all" aria-label="All discoveries">${ICON.all}<span>All</span></button>
    <button type="button" class="lk-nb lk-score" aria-label="Back to the score">${ICON.close}<span>Score</span></button>`;
  screen.appendChild(nav);
  const whereEl = nav.querySelector('.lk-where');
  nav.querySelector('.lk-back').onclick = e => {
    e.stopPropagation();
    back('button');
  };
  nav.querySelector('.lk-all').onclick = e => {
    e.stopPropagation();
    log.log('look_nav', {
      action: 'home',
      from: cur()
    });
    goHome();
  };
  nav.querySelector('.lk-score').onclick = e => {
    e.stopPropagation();
    toScore('button');
  };
  const setNav = (where, {
    back = true,
    all = true
  } = {}) => {
    st.where = where;
    whereEl.textContent = where;
    nav.querySelector('.lk-back').hidden = !back;
    nav.querySelector('.lk-all').hidden = !all || !!st.origin;
    nav.querySelector('.lk-back').setAttribute('aria-label', st.origin && st.history.length <= 1 ? 'Back to the story' : 'Back');
  };
  const home = document.createElement('section');
  home.className = 'lk-home';
  home.setAttribute('aria-label', 'Look around this final');
  home.hidden = true;
  const m = ctx.data.match;
  home.innerHTML = `
    <header class="lk-h-head"><p class="lk-h-kick">${esc(m.label)} · ${esc(m.date)}</p>
      <h2 tabindex="-1">Look around this final</h2><p class="lk-h-sub">Follow the connections behind the moments.</p></header>
    <div class="lk-cards" data-n="${HUB().length}">${HUB().map(cardHTML).join('')}</div>
    <footer class="lk-h-foot"><button type="button" class="lk-act lk-quiet lk-h-score"><span>Back to the score</span></button></footer>`;
  screen.appendChild(home);
  home.querySelectorAll('.lk-card').forEach(b => b.onclick = e => {
    e.stopPropagation();
    b.setAttribute('aria-pressed', 'true');
    log.log('look_card_tap', {
      inv: b.dataset.inv
    });
    openInv(b.dataset.inv);
  });
  home.querySelector('.lk-h-score').onclick = e => {
    e.stopPropagation();
    toScore('home');
  };
  function cardHTML(i) {
    const c = i.card;
    return `<button type="button" class="lk-card" data-inv="${i.id}" data-kind="${i.kind}">
      <span class="lk-c-img">${c.still ? `<img src="/data/${c.still}" alt="">` : c.art === 'map' ? mapArt(i) : ''}${c.art ? '' : '<i class="lk-c-two" aria-hidden="true"><b></b><b></b></i>'}</span>
      <span class="lk-c-body"><span class="lk-c-cat">${esc(i.category)}</span><span class="lk-c-q">${esc(c.question)}</span>
        <span class="lk-c-t">${esc(c.teaser)}</span>
        <span class="lk-c-foot"><span class="lk-c-meta">${esc(c.meta)}</span><span class="lk-c-state" hidden>${ICON.check}<span></span></span><span class="lk-c-go" aria-hidden="true">${ICON.next}</span></span></span></button>`;
  }
  const refreshCards = () => home.querySelectorAll('.lk-card').forEach(b => {
    const i = INV[b.dataset.inv],
      f = i.found && st.found.has(i.found);
    b.dataset.state = f ? 'found' : '';
    b.removeAttribute('aria-pressed');
    const s = b.querySelector('.lk-c-state');
    s.hidden = !f;
    s.querySelector('span').textContent = f ? `Found · ${P.founds[i.found].short}` : '';
    b.setAttribute('aria-label', `${i.category}. ${i.card.question}${f ? '. Found.' : ''}`);
  });
  const ice = document.createElement('div');
  ice.className = 'look-ice';
  ice.setAttribute('aria-hidden', 'true');
  ice.innerHTML = `<svg class="rink"></svg><div class="lk-chips"></div><div class="lk-clock" hidden><b></b><small></small></div><div class="lk-legend" hidden></div><div class="lk-cap"><span class="lk-cap-k"></span><span class="lk-cap-t"></span></div>`;
  vw.insertBefore(ice, vw.querySelector('.over'));
  const svg = ice.querySelector('svg'),
    chipsEl = ice.querySelector('.lk-chips'),
    clockEl = ice.querySelector('.lk-clock');
  const legendEl = ice.querySelector('.lk-legend');
  const capK = ice.querySelector('.lk-cap-k'),
    capT = ice.querySelector('.lk-cap-t');
  const capBand = () => {
    const v = parseFloat(getComputedStyle(ice).getPropertyValue('--lk-capband'));
    return Number.isFinite(v) ? v : 0;
  };
  const iceW = () => ice.clientWidth,
    iceH = () => Math.max(1, ice.clientHeight - capBand());
  const capEl = ice.querySelector('.lk-cap');
  function placeCap() {
    if (!VIEW) return;
    const [, v0, VW, VH] = VIEW,
      Wp = iceW(),
      Hp = iceH(),
      sc = Math.min(Wp / VW, Hp / VH);
    const bottom = Math.min(Hp, (Hp - VH * sc) / 2 + (15 - v0) * sc);
    capEl.style.top = `${Math.round(bottom + 14)}px`;
    capEl.style.bottom = 'auto';
    capEl.style.height = 'auto';
    capEl.style.paddingTop = '0px';
  }
  const pickEl = document.createElement('div');
  pickEl.className = 'lk-mappick';
  pickEl.hidden = true;
  ice.appendChild(pickEl);
  const R = P.rink;
  let VIEW = null,
    TR = null;
  function drawRink(attack) {
    const s = attack === 'left' ? -1 : 1;
    TR = attack === 'left' ? (x, y) => [x, -y] : (x, y) => [-x, y];
    VIEW = s > 0 ? [-1.0, R.v0, R.half_w, R.half_h] : [-31.0, R.v0, R.half_w, R.half_h];
    const [u0, v0, W, H] = VIEW,
      g = s * R.goal_x,
      bl = s * R.blue_x,
      cr = s * 21.5,
      ce = s * 30,
      sw = s > 0 ? 1 : 0;
    svg.setAttribute('viewBox', `${u0} ${v0} ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = `
      <path class="boards" d="M0,-15 H${cr} A8.5,8.5 0 0 ${sw} ${ce},-6.5 V6.5 A8.5,8.5 0 0 ${sw} ${cr},15 H0"/>
      <line class="red" x1="0" y1="-15" x2="0" y2="15"/><line class="blue" x1="${bl}" y1="-15" x2="${bl}" y2="15"/>
      <line class="red thin" x1="${g}" y1="-14.2" x2="${g}" y2="14.2"/>
      ${R.dots.map(([x, y]) => `<circle class="fo" cx="${s * x}" cy="${y}" r="4.5"/><circle class="dot" cx="${s * x}" cy="${y}" r=".35"/>`).join('')}
      <path class="crease" d="M${g},-1.8 A1.8,1.8 0 0 ${s > 0 ? 0 : 1} ${g},1.8 Z"/><rect class="net" x="${s > 0 ? g : g - 1.1}" y="-.915" width="1.1" height="1.83"/>
      <g class="lk-mapg"></g><g class="lk-glow"></g><g class="lk-pass"></g>`;
    st.rinkAttack = attack;
    placeCap();
  }
  const inView = (x, y) => {
    const [u, v] = TR(x, y),
      [u0, v0, W, H] = VIEW;
    return u >= u0 - .5 && u <= u0 + W + .5 && v >= v0 && v <= v0 + H;
  };
  const m2px = (x, y) => {
    const [u, v] = TR(x, y),
      [u0, v0, VW, VH] = VIEW,
      Wp = iceW(),
      Hp = iceH(),
      s = Math.min(Wp / VW, Hp / VH);
    return [(Wp - VW * s) / 2 + (u - u0) * s, (Hp - VH * s) / 2 + (v - v0) * s];
  };
  const chipEls = new Map();
  const chipHTML = (pid, txt) => {
    const pp = PEOPLE[pid] || {};
    return `<span class="ring ${pp.team || ''}"><b>${esc(txt ?? (pp.no || '').replace('#', ''))}</b>${pp.goalie ? '<i class="gb" aria-hidden="true">G</i>' : ''}</span><span class="nm">${esc(pp.name || '')}${pp.goalie ? ' · goalie' : ''}</span><span class="sh"></span>`;
  };
  function placeChip(el, [x, y], ms) {
    el.style.transition = ms && !reduced() ? `transform ${ms}ms cubic-bezier(.4,0,.2,1), opacity .45s` : 'opacity .3s';
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function setPlayers(players, {
    ms = 900,
    focus = null,
    stagger = 0
  } = {}) {
    const keep = new Set(),
      pos = [];
    players.forEach((p, i) => {
      if (p.goalie && PEOPLE[p.pid]?.team !== 'selects') return;
      if (!inView(p.x, p.y)) return;
      keep.add(p.pid);
      let el = chipEls.get(p.pid);
      const fresh = !el;
      if (fresh) {
        el = document.createElement('div');
        el.className = `lk-chip ${PEOPLE[p.pid]?.team || ''}${p.goalie ? ' gk' : ''}`;
        el.dataset.pid = p.pid;
        el.innerHTML = chipHTML(p.pid);
        chipsEl.appendChild(el);
        chipEls.set(p.pid, el);
      }
      el.classList.toggle('focus', !!focus && PEOPLE[p.pid]?.team === focus && !p.goalie);
      el.classList.toggle('named', !!focus && PEOPLE[p.pid]?.team === focus);
      el.dataset.shift = p.shift_s ?? '';
      const to = m2px(p.x, p.y);
      pos.push([p.pid, to]);
      if (fresh) {
        placeChip(el, to, 0);
        el.style.opacity = 0;
        setTimeout(() => {
          if (chipEls.get(p.pid) === el) el.style.opacity = 1;
        }, reduced() ? 0 : 80 + i * stagger);
      } else {
        el.style.opacity = 1;
        placeChip(el, to, ms);
      }
    });
    placeLabels(pos);
    for (const [pid, el] of chipEls) if (!keep.has(pid)) {
      el.style.opacity = 0;
      chipEls.delete(pid);
      setTimeout(() => el.remove(), 600);
    }
  }
  function placeLabels(pos) {
    const R0 = innerWidth < 700 ? 15 : 16,
      boxes = pos.map(([, [x, y]]) => [x - R0, y - R0, x + R0, y + R0]),
      placed = [];
    const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const order = pos.slice().sort(([a], [b]) => (PEOPLE[b]?.goalie ? 2 : 0) + (chipEls.get(b)?.classList.contains('focus') ? 1 : 0) - (PEOPLE[a]?.goalie ? 2 : 0) - (chipEls.get(a)?.classList.contains('focus') ? 1 : 0));
    for (const [pid, [x, y]] of order) {
      const el = chipEls.get(pid);
      if (!el) continue;
      el.classList.remove('lab-above', 'lab-right', 'lab-left', 'nolab', 'labup');
      if (!el.classList.contains('named')) continue;
      const pp = PEOPLE[pid],
        w = ((pp.name || '').length + (pp.goalie ? 9 : 0)) * 7.2 + 12,
        h = 19,
        g = R0 + 2;
      const cands = [['', [x - w / 2, y + g, x + w / 2, y + g + h]], ['lab-above', [x - w / 2, y - g - h, x + w / 2, y - g]], ['lab-right', [x + g, y - h / 2, x + g + w, y + h / 2]], ['lab-left', [x - g - w, y - h / 2, x - g, y + h / 2]]];
      const W = iceW(),
        H = iceH();
      const ok = cands.find(([, b]) => b[0] >= 0 && b[2] <= W && b[1] >= 0 && b[3] <= H && !placed.some(q => hit(q, b)) && !boxes.some((q, i) => pos[i][0] !== pid && hit(q, b)));
      if (ok) {
        if (ok[0]) el.classList.add(ok[0]);
        placed.push(ok[1]);
      } else el.classList.add('nolab');
    }
  }
  const showShift = on => {
    const foc = st.focus,
      rng = {
        selects: [],
        davos: []
      };
    chipEls.forEach((el, pid) => {
      const s = el.dataset.shift,
        team = PEOPLE[pid]?.team;
      if (s !== '' && team) rng[team].push(+s);
      const show = on && s !== '' && (!foc || team === foc);
      el.querySelector('.sh').textContent = show ? about5(+s) : '';
      el.classList.toggle('withsh', show);
    });
    legendEl.hidden = !on;
    st.legend = on ? legendHTML(rng) : '';
    if (on) legendEl.innerHTML = st.legend;
  };
  function legendHTML(rng) {
    return ['selects', 'davos'].filter(t => rng[t].length).map(t => {
      const a = Math.min(...rng[t]),
        b = Math.max(...rng[t]);
      return `<span class="${t}"><b>${t === 'selects' ? "Ridge" : "Harbour"}</b> ${b < 20 ? `${about5(b) === 'just on' ? 'just on' : `${about5(b)} or less`}` : `${about5(a)}–${about5(b)}`}</span>`;
    }).join('') + '<small>on the ice this shift (about)</small>';
  }
  function clearIce() {
    svg.querySelector('.lk-mapg') && (svg.querySelector('.lk-mapg').innerHTML = '');
    pickEl.hidden = true;
    ice.classList.remove('lk-mapon');
    chipEls.forEach(el => el.remove());
    chipEls.clear();
    chipsEl.innerHTML = '';
    svg.querySelector('.lk-pass') && (svg.querySelector('.lk-pass').innerHTML = '');
    svg.querySelector('.lk-glow') && (svg.querySelector('.lk-glow').innerHTML = '');
    clockEl.hidden = true;
    legendEl.hidden = true;
    capK.textContent = capT.textContent = '';
    st.rinkKey = null;
    ice.setAttribute('aria-hidden', 'true');
  }
  function bindRink(key, attack, {
    k = '',
    t = '',
    keep = false
  } = {}) {
    const same = st.rinkKey === key && st.rinkAttack === attack;
    if (!same && !(keep && st.rinkAttack === attack)) {
      clearIce();
      drawRink(attack);
    }
    st.rinkKey = key;
    capK.textContent = k;
    capT.textContent = t;
  }
  function iceOn(on, {
    sameMoment = false,
    ms = 450
  } = {}) {
    ice.classList.toggle('on', on);
    vw.classList.toggle('lk-iceon', on);
    vw.classList.toggle('lk-samemoment', on && sameMoment);
    document.body.classList.toggle('lk-iceface', on);
    st.face = on ? 'ice' : 'video';
    return sleep(reduced() ? 0 : ms);
  }
  const relayout = () => {
    placeCap();
    if (st.face !== 'ice' || !st.rinkKey) return;
    if (st.rinkKey.startsWith('selmap:')) return SEL?.layout();
    if (st.rinkKey.startsWith('moment:')) {
      const mo = MOM[st.rinkKey.slice(7)];
      setPlayers(mo.players, {
        ms: 0,
        focus: st.focus
      });
      if (st.shifts) showShift(true);
    } else if (st.rinkKey.startsWith('connect:')) layoutConnect();else if (st.rinkKey.startsWith('map:')) layoutMap();else if (st.rinkKey.startsWith('pair:')) {
      pairView(INV[st.inv]);
      layoutMap();
    }
  };
  addEventListener('resize', () => requestAnimationFrame(relayout));
  try {
    new ResizeObserver(() => {
      stage.applyView(false);
      requestAnimationFrame(relayout);
    }).observe(vw);
  } catch {}
  const PERN = {
    '1st period': 1,
    '2nd period': 2,
    '3rd period': 3
  };
  const scoreAt = (per, v) => {
    let d = 0,
      s = 0;
    for (const g of P.score_timeline) if (g.period < PERN[per] || g.period === PERN[per] && g.clock_s < v) g.team === 'davos' ? d++ : s++;
    return `${d}–${s}`;
  };
  async function plate(run, to, {
    from = null,
    caption = ''
  } = {}) {
    const br = root.querySelector('.bridge'),
      per = br.querySelector('.bper'),
      clk = br.querySelector('.bclk'),
      sc = br.querySelector('.bsc');
    const bc = br.querySelector('.bcap');
    bc.textContent = caption;
    bc.classList.toggle('in', !!caption);
    const segs = [];
    if (from && from.period === to.period) segs.push({
      per: to.per_label,
      from: from.clock_s,
      to: to.clock_s
    });else if (from) {
      segs.push({
        per: from.per_label,
        from: from.clock_s,
        to: from.clock_s
      });
      segs.push({
        per: to.per_label,
        from: to.clock_s,
        to: to.clock_s
      });
    } else segs.push({
      per: to.per_label,
      from: to.clock_s,
      to: to.clock_s
    });
    const s0 = segs[0];
    per.textContent = s0.per;
    clk.textContent = mmss(s0.from);
    sc.textContent = scoreAt(s0.per, s0.from);
    br.hidden = false;
    requestAnimationFrame(() => br.classList.add('on'));
    await sleep(reduced() ? 120 : 420);
    alive(run);
    if (segs.length > 1 || s0.from !== s0.to) {
      br.classList.add('fwd');
      const ms = reduced() ? 0 : 1100,
        t0 = performance.now();
      if (segs.length > 1) {
        await sleep(reduced() ? 300 : 650);
        alive(run);
        per.textContent = segs[1].per;
        clk.textContent = mmss(segs[1].from);
        sc.textContent = scoreAt(segs[1].per, segs[1].from);
      } else await new Promise(res => {
        const f = () => {
          if (run !== st.run) return res();
          const k = ms ? Math.min(1, (performance.now() - t0) / ms) : 1,
            e = 1 - (1 - k) ** 3,
            v = s0.from + (s0.to - s0.from) * e;
          clk.textContent = mmss(v);
          sc.textContent = scoreAt(s0.per, v);
          k < 1 ? requestAnimationFrame(f) : res();
        };
        requestAnimationFrame(f);
      });
    }
    await sleep(reduced() ? 500 : 650);
    alive(run);
    br.classList.remove('on', 'fwd');
    await sleep(reduced() ? 0 : 380);
    br.hidden = true;
  }
  function plateOff() {
    const br = root.querySelector('.bridge');
    br.classList.remove('on', 'fwd');
    br.hidden = true;
  }
  async function clockRoll(run, per, a, b, ms = 1700) {
    clockEl.hidden = false;
    clockEl.querySelector('small').textContent = per;
    const B = clockEl.querySelector('b');
    const t0 = performance.now();
    await new Promise(res => {
      const f = () => {
        if (run !== st.run) return res();
        const k = reduced() ? 1 : Math.min(1, (performance.now() - t0) / ms),
          e = 1 - (1 - k) ** 3;
        B.textContent = mmss(a + (b - a) * e);
        k < 1 ? requestAnimationFrame(f) : res();
      };
      requestAnimationFrame(f);
    });
    alive(run);
  }
  async function head(h, sub = '', kick = '') {
    await cap._set(cap.topEl, `${kick ? `<span class="ln lk-eyebrow in">${esc(kick)}</span>` : ''}<span class="ln q in">${nl2br(h)}</span>${sub ? `<span class="ln sub in">${nl2br(sub)}</span>` : ''}`, {
      stagger: 0,
      cls: 'q'
    });
  }
  function actions(run, list) {
    cap.actEl.innerHTML = `<div class="lk-acts" role="group" aria-label="What next">${list.map(a => `<button type="button" class="lk-act ${a.kind === 'next' ? 'nav' : a.kind || 'go'}" data-a="${esc(a.id)}"${a.visited ? ' data-visited="1"' : ''}${a.disabled ? ' disabled' : ''}>
      <i aria-hidden="true">${a.kind === 'replay' ? ICON.play : a.kind === 'next' ? ICON.all : a.kind === 'back' ? ICON.back : ICON.next}</i><span>${esc(a.label)}</span>${a.visited ? `<em class="lk-seen">${ICON.check}seen</em>` : ''}</button>`).join('')}</div>`;
    focusFirst(cap.actEl);
    return new Promise(res => cap.actEl.querySelectorAll('.lk-act').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (run !== st.run) return;
      cap.actEl.querySelectorAll('.lk-act').forEach(x => {
        x.disabled = x !== b;
      });
      b.setAttribute('aria-pressed', 'true');
      res(b.dataset.a);
    }));
  }
  function source(text, found) {
    cap.evEl.innerHTML = text ? `<p class="srcline"><span class="srctxt"><b class="src">Simulated data</b>${esc(text)}</span></p>` : '';
    cap.evEl.classList.toggle('in', !!text);
  }
  async function clearBand({
    keepPanel = false
  } = {}) {
    cap.ctx('');
    source('');
    cap.actEl.innerHTML = '';
    setMore('');
    if (!keepPanel) setPanel('');
    await cap.clear(['top', 'low']);
  }
  const cur = () => st.history.at(-1) || '';
  function alive(run) {
    if (run !== st.run) throw ABORT;
  }
  function push(entry) {
    const i = st.history.indexOf(entry);
    if (i >= 0) st.history = st.history.slice(0, i + 1);else st.history.push(entry);
    if (st.history.length > HMAX) st.history = ['home', ...st.history.slice(-(HMAX - 1))];
  }
  function foundEntry(id) {
    if (cur() === `inv:${id}`) st.history.pop();
    push(`found:${id}`);
    st.screen = `found:${id}`;
  }
  function retire() {
    st.run++;
    stage.stop();
    plateOff();
    document.querySelector('.lk-sheet')?.remove();
    STEPS?.off();
    sideDoor.hidden = true;
    sideDoor.innerHTML = '';
    screen.scrollTop = 0;
    bandB.scrollTop = 0;
    stage.clearMarks({
      keepFan: false
    });
    stage.ctx('');
    stage.badge('');
    stage.clock('');
    stage.num('');
    ++stage._tw;
    stage.darkEl.style.transition = 'none';
    stage.darkEl.style.opacity = 0;
    stage.wrap.classList.remove('lit');
    stage._setL({
      cx: 960,
      cy: 540,
      rx: 0,
      ry: 0
    });
    vw.classList.remove('lk-dimvid');
    st.shifts = false;
    st.focus = null;
    st.legend = '';
    if (document.body.classList.contains('lk-tall')) {
      document.body.classList.remove('lk-tall', 'lk-mapface');
      stage.applyView(false);
    }
    return st.run;
  }
  async function guard(fn) {
    try {
      await fn();
    } catch (e) {
      if (e !== ABORT) {
        log.log('error', {
          message: String(e?.message || e),
          where: 'look'
        });
        throw e;
      }
    }
  }
  async function goHome({
    entry = null
  } = {}) {
    const run = retire();
    st.history = ['home'];
    st.inv = null;
    st.moments = [];
    st.screen = 'home';
    document.body.dataset.beat = 'look_home';
    refreshCards();
    home.hidden = false;
    document.body.classList.add('lk-homeon');
    await iceOn(false, {
      ms: 0
    });
    clearIce();
    await clearBand().catch(() => {});
    if (run !== st.run) return;
    home.scrollTop = 0;
    setNav('All discoveries', {
      back: false,
      all: false
    });
    log.log('look_home', {
      entry,
      found: [...st.found]
    });
    if (st.kbd) home.querySelector('.lk-card')?.focus({
      preventScroll: true
    });else home.querySelector('h2').focus({
      preventScroll: true
    });
  }
  function leaveHome() {
    home.hidden = true;
    document.body.classList.remove('lk-homeon');
  }
  function back(how) {
    log.log('look_nav', {
      action: 'back',
      from: cur(),
      how
    });
    if (document.querySelector('.lk-sheet')) {
      document.querySelector('.lk-sheet .lk-sheet-close').click();
      return;
    }
    if (st.origin && st.history.length <= 1) return toOrigin(how === 'button' ? 'nav_back' : how);
    if (st.history.length <= 1) return toScore(how);
    st.history.pop();
    const to = cur();
    if (to === 'home') return goHome();
    const [kind, id, mo] = to.split(':');
    if (kind === 'inv') return openInv(id);
    if (kind === 'found') return openFound(id);
    if (kind === 'replay') return openReplay(id, mo);
    if (kind === 'pair') return openPair(id);
  }
  function toScore(how) {
    log.log('look_back_to_score', {
      from: cur(),
      how
    });
    if (st.origin) log.log('context_close', {
      lens: st.inv,
      origin: st.origin.id,
      how: 'score'
    });
    retire();
    ctx.end('look');
  }
  function toOrigin(how) {
    log.log('look_nav', {
      action: 'to_origin',
      from: cur(),
      how,
      origin: st.origin?.id
    });
    st.origin?.onReturn(how);
  }
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !document.body.classList.contains('look') || document.querySelector('.lk-sheet')) return;
    e.preventDefault();
    back('esc');
  });
  function openInv(id) {
    const inv = INV[id];
    if (!inv || !READY.includes(inv)) return goHome();
    const run = retire();
    push(`inv:${id}`);
    st.inv = id;
    st.screen = `inv:${id}`;
    leaveHome();
    setNav(inv.category);
    log.log('look_inv_start', {
      inv: id
    });
    if (SEL && id === SEL.id) return guard(() => SEL.run(run, inv));
    return guard(() => inv.kind === 'connect' ? runConnect(run, inv) : inv.kind === 'map' ? runMap(run, inv) : runHold(run, inv));
  }
  function openFound(id) {
    const inv = INV[id];
    if (!inv || !READY.includes(inv)) return goHome();
    const run = retire();
    push(`found:${id}`);
    st.inv = id;
    st.screen = `found:${id}`;
    leaveHome();
    setNav(inv.category);
    if (SEL && id === SEL.id) return guard(() => SEL.found(run, inv, {
      instant: true
    }));
    return guard(() => inv.kind === 'connect' ? foundConnect(run, inv, {
      instant: true
    }) : inv.kind === 'map' ? foundMap(run, inv, {
      instant: true
    }) : foundHold(run, inv, {
      instant: true
    }));
  }
  function connectPrep(inv) {
    stage.video.pause();
    vw.classList.add('lk-novid');
    document.body.classList.add('lk-tall');
    st.moments = inv.moments.slice();
    bindRink(`connect:${inv.id}`, inv.rink_attack, {
      k: inv.rink_note,
      t: ''
    });
  }
  function layoutConnect() {
    const inv = INV[st.inv];
    if (!inv || inv.kind !== 'connect') return;
    const sc = Math.min(iceW() / VIEW[2], iceH() / VIEW[3]),
      px = n => sc > 0 ? (n / sc).toFixed(3) : '0';
    const NET = TR(-R.goal_x, 0);
    const merged = st.merged?.[inv.id];
    svg.querySelector('.lk-pass').innerHTML = inv.links.map((l, i) => {
      const p = PAS[l.pass_],
        [a, b, s] = [TR(...p.start), TR(...p.end), TR(...p.shot.at)],
        c = TR(...l.call);
      const skate = Math.hypot(b[0] - s[0], b[1] - s[1]) > 1.5 ? `<line class="skate l${i}" x1="${b[0]}" y1="${b[1]}" x2="${s[0]}" y2="${s[1]}" vector-effect="non-scaling-stroke"/>` : '';
      return `<g class="chance l${i}">
        <line class="lead${merged ? ' off' : ''}" x1="${c[0]}" y1="${c[1]}" x2="${a[0]}" y2="${a[1]}" vector-effect="non-scaling-stroke"/>
        <line class="shotline" x1="${s[0]}" y1="${s[1]}" x2="${NET[0]}" y2="${NET[1]}" vector-effect="non-scaling-stroke"/>${skate}
        <line class="passline l${i}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" vector-effect="non-scaling-stroke"/>
        <circle class="passstart" cx="${a[0]}" cy="${a[1]}" r="${px(5)}"/><circle class="passend" cx="${b[0]}" cy="${b[1]}" r="${px(3.5)}"/></g>`;
    }).join('');
    inv.links.forEach((l, i) => {
      const p = PAS[l.pass_];
      const tok = chipsEl.querySelector(`.lk-tok[data-i="${i}"]`);
      if (tok) placeChip(tok, m2px(...(merged ? inv.merge_at : l.call)), 0);
      const rc = chipsEl.querySelector(`.lk-chip[data-rcv="${i}"]`);
      if (rc) placeChip(rc, m2px(...p.shot.at), 0);
    });
    if (merged) glow(inv);
    requestAnimationFrame(placeConnectLabels);
  }
  function placeConnectLabels() {
    const inv = INV[st.inv];
    if (!inv || inv.kind !== 'connect' || !VIEW) return;
    const [u0, v0, VW, VH] = VIEW,
      Wp = iceW(),
      Hp = iceH(),
      s = Math.min(Wp / VW, Hp / VH);
    const d2p = (u, v) => [(Wp - VW * s) / 2 + (u - u0) * s, (Hp - VH * s) / 2 + (v - v0) * s];
    const pts = [];
    svg.querySelectorAll('.lk-pass line').forEach(l => {
      if (l.classList.contains('off')) return;
      const [x1, y1] = d2p(+l.getAttribute('x1'), +l.getAttribute('y1')),
        [x2, y2] = d2p(+l.getAttribute('x2'), +l.getAttribute('y2'));
      const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
      for (let k = 0; k <= n; k++) pts.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
    });
    const at = el => {
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
      return m ? [+m[1], +m[2]] : null;
    };
    const chips = [...chipsEl.querySelectorAll('.lk-tok:not(.gone), .lk-chip.rcv')].map(el => ({
      el,
      p: at(el),
      r: (el.querySelector('.ring')?.offsetWidth || 26) / 2
    })).filter(c => c.p);
    const rings = chips.map(c => [c.p[0] - c.r - 6, c.p[1] - c.r - 6, c.p[0] + c.r + 6, c.p[1] + c.r + 6]);
    const over = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const placed = [];
    for (const c of chips) {
      const nm = c.el.querySelector('.nm');
      if (!nm || getComputedStyle(nm).display === 'none') continue;
      for (const k of ['left', 'top', 'right', 'bottom', 'transform']) nm.style.removeProperty(k);
      const w = nm.offsetWidth,
        h = nm.offsetHeight,
        r = c.r,
        g = 4;
      if (!w || !h) continue;
      const C = {};
      for (const [far, e] of [['', 0], ['+', 12]]) Object.assign(C, {
        ['above' + far]: [-w / 2, -r - g - e - h],
        ['below' + far]: [-w / 2, r + g + e],
        ['right' + far]: [r + g + 2 + e, -h / 2],
        ['left' + far]: [-r - g - 2 - e - w, -h / 2],
        ['below-right' + far]: [r * .6 + e, r * .6 + g + e],
        ['below-left' + far]: [-w - r * .6 - e, r * .6 + g + e],
        ['above-right' + far]: [r * .6 + e, -r * .6 - g - e - h],
        ['above-left' + far]: [-w - r * .6 - e, -r * .6 - g - e - h]
      });
      const tag = c.el.classList.contains('lk-tok') ? 'above' : c.el.className.match(/tag-(\w+)/)?.[1] || 'below';
      const order = [tag, ...Object.keys(C).filter(k => k !== tag)];
      const own = r + 9;
      const P = pts.filter(([x, y]) => Math.hypot(x - c.p[0], y - c.p[1]) > own);
      let best = null;
      order.forEach((k, pi) => {
        const [dx, dy] = C[k],
          b = [c.p[0] + dx, c.p[1] + dy, c.p[0] + dx + w, c.p[1] + dy + h];
        const lineHits = P.filter(([x, y]) => x > b[0] - 3 && x < b[2] + 3 && y > b[1] - 3 && y < b[3] + 3).length;
        const ringHit = rings.reduce((a, q, i) => a + (chips[i] === c ? 0 : over(q, b)), 0);
        const labHit = placed.reduce((a, q) => a + over(q, b), 0);
        const out = Math.max(0, -b[0]) + Math.max(0, b[2] - Wp) + Math.max(0, -b[1]) + Math.max(0, b[3] - Hp);
        const score = lineHits * 6 + ringHit * 4 + labHit * 4 + out * 30 + pi * .5 + (k.endsWith('+') ? 6 : 0);
        if (!best || score < best.score) best = {
          k,
          dx,
          dy,
          b,
          score,
          lineHits,
          ringHit,
          labHit,
          out
        };
      });
      for (const [k, v] of [['left', `${best.dx}px`], ['top', `${best.dy}px`], ['right', 'auto'], ['bottom', 'auto'], ['transform', 'none']]) nm.style.setProperty(k, v, 'important');
      c.el.dataset.lab = best.k;
      c.el.dataset.labScore = `${best.lineHits}/${Math.round(best.ringHit)}/${Math.round(best.labHit)}/${Math.round(best.out)}`;
      placed.push(best.b);
    }
  }
  function glow(inv) {
    const pts = inv.links.map(l => TR(...PAS[l.pass_].start));
    const cx = (pts[0][0] + pts[1][0]) / 2,
      cy = (pts[0][1] + pts[1][1]) / 2;
    const r = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) / 2 + 1.5;
    svg.querySelector('.lk-glow').innerHTML = `<circle class="cornerglow in" cx="${cx}" cy="${cy}" r="${r}"/>`;
  }
  const passerOf = (inv, i) => PEOPLE[PAS[inv.links[i].pass_].passer];
  const preRead = inv => RC3 && inv?.pre_read && st.origin?.id === 's1_carry' && !ctx.state?.bridgeCall ? inv.pre_read : null;
  const whatOf = (inv, i) => preRead(inv)?.chances?.[i] ?? inv.chances[i].what;
  function chancesHTML(inv, revealed) {
    const both = revealed.length === inv.links.length;
    const same = both && new Set(inv.links.map((_, i) => PAS[inv.links[i].pass_].passer)).size === 1;
    return `<p class="lk-note">${esc(inv.rink_note)}</p><div class="lk-chances${same ? ' same' : ''}">${inv.links.map((l, i) => {
      const c = inv.chances[i],
        open = revealed.includes(i),
        pp = passerOf(inv, i);
      return `<article class="lk-chance${open ? ' open' : ''}" data-i="${i}" aria-label="Chance ${c.n}, ${esc(c.per)} ${esc(c.clock)}">
        <header><span class="lk-cn" aria-hidden="true">${c.n}</span><span class="lk-cw"><b>Chance ${c.n}</b><span>${esc(c.per)} · ${esc(c.clock)}</span></span></header>
        <p class="lk-cwhat">${esc(whatOf(inv, i))}</p>
        <div class="lk-cslot">${open ? `<span class="lk-who b1-who1"><small>Last pass</small><b>${esc(pp.no)} ${esc(pp.name)}</b></span>` : `<button type="button" class="lk-reveal" data-i="${i}"><span>Reveal the last Harbour pass</span>${ICON.next}</button>`}</div></article>`;
    }).join(`<div class="lk-link${same ? ' on' : ''}" aria-hidden="${same ? 'false' : 'true'}"><span>${same ? 'Same player' : ''}</span></div>`)}</div>`;
  }
  function connectScene(inv, {
    revealed = [],
    merged = false
  } = {}) {
    clearIce();
    connectPrep(inv);
    (st.merged ||= {})[inv.id] = merged;
    inv.links.forEach((l, i) => {
      const p = PAS[l.pass_],
        rp = PEOPLE[p.receiver];
      const rc = document.createElement('div');
      rc.className = `lk-chip rcv davos named tag-${l.tag_at || 'below'}`;
      rc.dataset.rcv = i;
      rc.dataset.pid = p.receiver;
      rc.innerHTML = `<span class="ring"><b>${esc(rp.no.replace('#', ''))}</b></span><span class="nm"><b><i class="lk-cn sm">${inv.chances[i].n}</i>${esc(rp.name)}’s shot</b><small>${esc(inv.chances[i].per.replace(' period', ''))} ${esc(inv.chances[i].clock)}${preRead(inv) ? '' : ` · ${esc(p.shot.result.toLowerCase())}`}</small></span>`;
      chipsEl.appendChild(rc);
      rc.style.opacity = 1;
    });
    inv.links.forEach((l, i) => {
      const p = PAS[l.pass_],
        open = revealed.includes(i),
        pp = PEOPLE[p.passer];
      const tok = document.createElement('button');
      tok.type = 'button';
      tok.className = `lk-chip lk-tok davos${open ? ' open' : ''}${merged ? i ? ' gone' : ' merged' : ''}`;
      tok.dataset.i = i;
      tok.dataset.pid = p.passer;
      tok.setAttribute('aria-label', open ? `Chance ${inv.chances[i].n}: last Harbour pass by ${pp.full}, ${pp.no}` : `Reveal the last Harbour pass before chance ${inv.chances[i].n}`);
      tok.innerHTML = `<span class="ring"><b>${open ? esc(pp.no.replace('#', '')) : '?'}</b></span><span class="nm"><small>${merged ? 'both chances' : `passer · chance ${inv.chances[i].n}`}</small><span>${open ? esc(pp.name) : ''}</span></span>`;
      chipsEl.appendChild(tok);
      tok.style.opacity = merged && i ? 0 : 1;
    });
    ice.setAttribute('aria-hidden', 'false');
    if (FOLLOW_VARIANT === 'cards') setPanel(chancesHTML(inv, revealed));
    layoutConnect();
  }
  async function runConnect(run, inv) {
    st.revealed[inv.id] = [];
    await clearBand();
    alive(run);
    stage.lightOff(0);
    await iceOn(true, {
      ms: 0
    });
    connectScene(inv);
    STEPS?.intro(inv);
    document.body.dataset.beat = `look_${inv.id}_intro`;
    if (!reduced()) {
      svg.querySelectorAll('.chance').forEach((g, i) => {
        g.style.animationDelay = `${i * 420}ms`;
        g.classList.add('draw');
      });
    }
    await head(preRead(inv)?.head || inv.intro.head, st.origin && RC3_BRIDGE[inv.id]?.[st.origin.id]?.intro || inv.intro.sub, inv.category);
    alive(run);
    log.log('look_step', {
      inv: inv.id,
      step: 'intro',
      variant: FOLLOW_VARIANT,
      ...(preRead(inv) ? {
        pre_read: true
      } : {}),
      ...(st.origin ? {
        origin: st.origin.id
      } : {})
    });
    const toks = [...chipsEl.querySelectorAll('.lk-tok')];
    toks.forEach(t => t.classList.add('ask'));
    const shown = performance.now();
    for (let n = 0; n < inv.links.length; n++) {
      const pending = inv.links.map((_, i) => i).filter(i => !st.revealed[inv.id].includes(i));
      const pick = await new Promise(res => {
        const go = i => e => {
          e?.stopPropagation();
          if (run === st.run) res(i);
        };
        pending.forEach(i => {
          toks[i].onclick = go(i);
          panelEl.querySelector(`.lk-reveal[data-i="${i}"]`)?.addEventListener('click', go(i));
        });
        if (FOLLOW_VARIANT === 'rink') actions(run, pending.map(i => ({
          id: `r${i}`,
          label: `Reveal the passer · chance ${inv.chances[i].n} (${inv.chances[i].per.replace(' period', '')} ${inv.chances[i].clock})`,
          kind: 'go'
        }))).then(a => res(+a.slice(1)));else if (st.kbd) panelEl.querySelector('.lk-reveal')?.focus({
          preventScroll: true
        });
      });
      alive(run);
      cap.actEl.innerHTML = '';
      reveal(inv, pick);
      st.revealed[inv.id].push(pick);
      chipsEl.querySelector(`.lk-chip[data-rcv="${pick}"]`)?.classList.add('lit');
      if (FOLLOW_VARIANT === 'cards') setPanel(chancesHTML(inv, st.revealed[inv.id]));
      STEPS?.open(inv, pick);
      log.log('look_reveal', {
        inv: inv.id,
        link: inv.links[pick].tag,
        n: n + 1,
        latency_ms: Math.round(performance.now() - shown)
      });
      await sleep(reduced() ? 150 : 600);
      alive(run);
      if (n === 0) {
        const pp = passerOf(inv, pick);
        await head(`Chance ${inv.chances[pick].n}: ${pp.full}.`, inv.after_first.sub, inv.category);
        alive(run);
      }
    }
    if (STEPS) {
      await STEPS.finish(run);
      return foundConnect(run, inv);
    }
    toks.forEach(t => {
      t.classList.remove('ask');
      t.onclick = null;
      t.disabled = true;
    });
    await sleep(reduced() ? 100 : 400);
    alive(run);
    await merge(run, inv);
    return foundConnect(run, inv);
  }
  async function merge(run, inv) {
    st.merged[inv.id] = true;
    log.log('look_step', {
      inv: inv.id,
      step: 'merge'
    });
    const [t0, t1] = [0, 1].map(i => chipsEl.querySelector(`.lk-tok[data-i="${i}"]`)),
      to = m2px(...inv.merge_at),
      ms = reduced() ? 0 : 900;
    svg.querySelectorAll('.lead').forEach(l => l.classList.add('off'));
    placeChip(t0, to, ms);
    placeChip(t1, to, ms);
    await sleep(ms ? ms - 120 : 0);
    alive(run);
    t1.classList.add('gone');
    t1.style.opacity = 0;
    t0.classList.add('merged');
    t0.querySelector('.nm small').textContent = 'both chances';
    placeConnectLabels();
    glow(inv);
    await sleep(reduced() ? 100 : 500);
    alive(run);
  }
  function reveal(inv, i) {
    const tok = chipsEl.querySelector(`.lk-tok[data-i="${i}"]`),
      pp = passerOf(inv, i);
    tok.classList.add('open', 'flip');
    tok.classList.remove('ask');
    tok.querySelector('b').textContent = pp.no.replace('#', '');
    tok.querySelector('.nm > span').textContent = pp.name;
    tok.setAttribute('aria-label', `Chance ${inv.chances[i].n}: last Harbour pass by ${pp.full}, ${pp.no}`);
    requestAnimationFrame(placeConnectLabels);
  }
  async function foundConnect(run, inv, {
    instant = false
  } = {}) {
    if (instant) {
      await clearBand();
      alive(run);
      stage.lightOff(0);
      await iceOn(true, {
        ms: 0
      });
      st.revealed[inv.id] = inv.links.map((_, i) => i);
      connectScene(inv, {
        revealed: st.revealed[inv.id],
        merged: true
      });
      chipsEl.querySelectorAll('.lk-tok').forEach(t => {
        t.disabled = true;
      });
      chipsEl.querySelectorAll('.lk-chip.rcv').forEach(c => c.classList.add('lit'));
    } else if (FOLLOW_VARIANT === 'cards') setPanel(chancesHTML(inv, st.revealed[inv.id]));
    if (RC3) setPanel(compactChancesHTML(inv));
    STEPS?.rinks(inv);
    foundEntry(inv.id);
    document.body.dataset.beat = `look_${inv.id}_found`;
    return showFound(run, inv, '');
  }
  const skaters = (mo, team) => mo.players.filter(p => !p.goalie && PEOPLE[p.pid]?.team === team);
  const goalieOf = (mo, team) => mo.players.find(p => p.goalie && PEOPLE[p.pid]?.team === team);
  const nameRow = (p, extra = '') => {
    const pp = PEOPLE[p.pid],
      nm = cardName(p.pid);
    return `<li><span class="lk-ln ${pp.team}" aria-hidden="true">${esc(pp.no.replace('#', ''))}</span><span class="lk-lnm">${nm}</span>${extra}</li>`;
  };
  function lineupHTML(A, Bm = null, times = null) {
    const team = (t, label) => {
      const a = skaters(A, t),
        g = goalieOf(A, t);
      if (!Bm) return `<section class="lk-lu ${t}"><h4><span class="lk-shape ${t}" aria-hidden="true"></span>${label} <small>5 skaters</small></h4><ul>${a.map(p => nameRow(p)).join('')}</ul>${g ? `<p class="lk-gk">Goalie: ${esc(PEOPLE[g.pid].full)} ${esc(PEOPLE[g.pid].no)}${t === 'davos' ? ' (other end)' : ''}</p>` : ''}</section>`;
      const b = skaters(Bm, t),
        aset = new Set(a.map(p => p.pid)),
        kept = b.filter(p => aset.has(p.pid)).length;
      const tm = p => times && times[PEOPLE[p.pid].name] ? ` <span class="lk-tm">${esc(times[PEOPLE[p.pid].name])}</span>` : '';
      const mixed = kept > 0 && kept < b.length;
      const rows = b.map(p => nameRow(p, `<em class="lk-on">${mixed ? aset.has(p.pid) ? '<b>still on</b>' : '<b class="new">new</b>' : ''}${tm(p)}</em>`)).join('');
      const gB = goalieOf(Bm, t),
        gk = gB && g && gB.pid === g.pid ? `<p class="lk-gk">Goalie: ${esc(PEOPLE[gB.pid].full)} ${esc(PEOPLE[gB.pid].no)}, both times${t === 'davos' ? ' (other end)' : ''}</p>` : '';
      return `<section class="lk-lu ${t}"><h4><span class="lk-shape ${t}" aria-hidden="true"></span>${label} skaters <span class="lk-count${kept ? ' kept' : ' none'}">${kept} of ${a.length} still on</span></h4><ul>${rows}</ul>${!kept ? `<p class="lk-was">On the ice at 8:47: ${a.map(p => esc(PEOPLE[p.pid].name)).join(', ')}</p>` : ''}${gk}</section>`;
    };
    return `<div class="lk-lineups${Bm ? ' cmp' : ''}">${team('selects', "Ridge")}${team('davos', "Harbour")}</div>`;
  }
  async function runHold(run, inv) {
    const A = MOM[inv.frm],
      Bm = MOM[inv.to];
    await clearBand();
    alive(run);
    await iceOn(false, {
      ms: 0
    });
    clearIce();
    st.moments = [A.id];
    const storyMode = !!(st.origin && RC3_BRIDGE.hold?.[st.origin.id]);
    if (storyMode) {
      stage.video.pause();
      vw.classList.add('lk-novid');
      stage.lightOff(0);
      stage.ctx('');
      bindRink(`moment:${A.id}`, A.attack, {
        k: 'Tracking',
        t: A.label
      });
      st.focus = inv.team;
      await iceOn(true, {
        ms: 0
      });
      alive(run);
      log.log('look_step', {
        inv: inv.id,
        step: 'ice_direct',
        moment: A.id,
        origin: st.origin.id
      });
    } else {
      document.body.dataset.beat = `look_${inv.id}_video`;
      await showVideoMoment(run, A, {
        play: true
      });
      await head(inv.video_intro.head, inv.video_intro.sub, inv.category);
      alive(run);
      log.log('look_step', {
        inv: inv.id,
        step: 'video',
        moment: A.id
      });
      await actions(run, [{
        id: 'ice',
        label: inv.video_intro.action,
        kind: 'go'
      }]);
      alive(run);
      await clearBand();
      alive(run);
      log.log('look_transition', {
        kind: st.tr,
        moment: A.id,
        from: 'video',
        to: 'ice'
      });
      if (A.light && !reduced()) {
        await stage.light({
          ...A.light,
          rx: A.light.rx * .35,
          ry: A.light.ry * .35
        }, {
          dim: .9,
          ms: 420
        });
        alive(run);
        await stage.light({
          ...A.light,
          rx: 0,
          ry: 0
        }, {
          dim: 1,
          ms: 260
        });
        alive(run);
      }
      stage.ctx('');
      bindRink(`moment:${A.id}`, A.attack, {
        k: 'Same moment · tracking',
        t: A.label
      });
      st.focus = inv.team;
      await iceOn(true, {
        sameMoment: true,
        ms: 300
      });
      alive(run);
    }
    setPlayers(A.players, {
      ms: 0,
      focus: inv.team,
      stagger: 45
    });
    await sleep(reduced() ? 0 : 650);
    alive(run);
    document.body.dataset.beat = `look_${inv.id}_ice`;
    setPanel(RC3 ? lineupCountsHTML(A) : lineupHTML(A));
    const B3 = storyMode ? RC3_BRIDGE.hold[st.origin.id] : null;
    await head(B3 ? B3.head : inv.ice_intro.head, B3 ? B3.sub : inv.ice_intro.sub, inv.category);
    alive(run);
    log.log('look_step', {
      inv: inv.id,
      step: 'ice',
      moment: A.id
    });
    await actions(run, [{
      id: 'q',
      label: "Moments later…",
      kind: 'go'
    }]);
    alive(run);
    rinkIntoView('hold_q');
    const p = inv.predict,
      shown = performance.now();
    await clearBand({
      keepPanel: true
    });
    alive(run);
    await head(p.q, '', inv.category);
    alive(run);
    const opts = [...p.options, ['not_sure', 'Not sure']];
    cap.actEl.innerHTML = `<div class="lk-acts lk-pred" role="group" aria-label="Your guess">${opts.map(([k, l]) => `<button type="button" class="lk-act pick${k === 'not_sure' ? ' unsure' : ''}" data-c="${k}"><span>${esc(l)}</span></button>`).join('')}</div>`;
    focusFirst(cap.actEl);
    const ans = await new Promise(res => cap.actEl.querySelectorAll('button').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (run !== st.run) return;
      cap.actEl.querySelectorAll('button').forEach(x => {
        x.disabled = x !== b;
      });
      b.setAttribute('aria-pressed', 'true');
      res(b.dataset.c);
    }));
    alive(run);
    st.predicted[p.id] = ans;
    log.log('look_predict', {
      inv: inv.id,
      q: p.id,
      answer: ans,
      latency_ms: Math.round(performance.now() - shown)
    });
    await sleep(reduced() ? 100 : 350);
    alive(run);
    await clearBand();
    alive(run);
    rinkIntoView('hold_pick');
    vw.classList.remove('lk-samemoment');
    vw.classList.add('lk-novid');
    stage.video.pause();
    capK.textContent = 'Tracking';
    capT.textContent = '';
    await clockRoll(run, inv.roll.per, inv.roll.from_s, inv.roll.to_s, 1700);
    bindRink(`moment:${Bm.id}`, Bm.attack, {
      k: 'Tracking',
      t: Bm.label,
      keep: true
    });
    st.moments = [Bm.id];
    setPlayers(Bm.players, {
      ms: 1100,
      focus: inv.team
    });
    await sleep(reduced() ? 0 : 1150);
    alive(run);
    markKept(A, Bm);
    return foundHold(run, inv);
  }
  function markKept(A, Bm) {
    const before = new Set(A.players.map(p => p.pid));
    chipEls.forEach((el, pid) => {
      const pp = PEOPLE[pid];
      if (!pp || pp.goalie) return;
      el.classList.toggle('kept', before.has(pid));
      el.classList.toggle('fresh', !before.has(pid));
    });
  }
  async function foundHold(run, inv, {
    instant = false
  } = {}) {
    const A = MOM[inv.frm],
      Bm = MOM[inv.to];
    if (instant) {
      await clearBand();
      alive(run);
      stage.video.pause();
      vw.classList.add('lk-novid');
      stage.lightOff(0);
      bindRink(`moment:${Bm.id}`, Bm.attack, {
        k: 'Tracking',
        t: Bm.label
      });
      st.moments = [Bm.id];
      st.focus = inv.team;
      await iceOn(true, {
        ms: 0
      });
      setPlayers(Bm.players, {
        ms: 0,
        focus: inv.team
      });
      markKept(A, Bm);
      clockEl.hidden = false;
      clockEl.querySelector('small').textContent = inv.roll.per;
      clockEl.querySelector('b').textContent = mmss(inv.roll.to_s);
    }
    const fd = P.founds[inv.found].depth;
    setPanel(RC3 ? '' : (fd ? `<div class="lk-holdlead">${leadHTML(fd)}</div>` : '') + lineupHTML(A, Bm));
    foundEntry(inv.id);
    document.body.dataset.beat = `look_${inv.id}_found`;
    const a = st.predicted[inv.predict.id];
    const ack = st.entryAck || (a ? inv.ack[a] : '');
    st.entryAck = '';
    return showFound(run, inv, ack);
  }
  const ATT = Object.fromEntries((INV.shots?.attempts || []).map(a => [a.row, a]));
  const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : {
    1: 'st',
    2: 'nd',
    3: 'rd'
  }[n % 10] || 'th'}`;
  const BNET = [-R.goal_x, 0];
  const MAPVIEW = [4.6, -16.6, 29, 33.2];
  function mapArt(inv) {
    const tr = (x, y) => [-x, y],
      [nu, nv] = [P.rink.goal_x, 0];
    const dots = inv.attempts.map(a => {
      const [u, v] = tr(...a.at);
      return a.result === 'goal' ? `<circle class="g" cx="${u}" cy="${v}" r="1.05"/>` : `<circle class="a" cx="${u}" cy="${v}" r=".55"/>`;
    }).join('');
    return `<svg class="lk-c-art" viewBox="2 -15.5 31 31" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><clipPath id="lkArtClip"><path d="M0,-15 H21.5 A8.5,8.5 0 0 1 30,-6.5 V6.5 A8.5,8.5 0 0 1 21.5,15 H0Z"/></clipPath></defs>
      <path class="bd" d="M0,-15 H21.5 A8.5,8.5 0 0 1 30,-6.5 V6.5 A8.5,8.5 0 0 1 21.5,15 H0"/>
      <g clip-path="url(#lkArtClip)"><circle class="b2" cx="${nu}" cy="${nv}" r="10"/><circle class="b1" cx="${nu}" cy="${nv}" r="5"/></g>
      <line class="gl" x1="${nu}" y1="-14.2" x2="${nu}" y2="14.2"/>${dots}</svg>`;
  }
  const mapShowsMore = () => !!(st.map.all || st.map.band || st.map.sel && ATT[st.map.sel]?.result !== 'goal');
  function rinkIntoView(why) {
    if (!RC3 || innerWidth >= innerHeight) return;
    const r = ice.getBoundingClientRect(),
      vh = window.visualViewport?.height || innerHeight;
    if (!r.height || (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height >= 0.8) return;
    ice.scrollIntoView({
      block: 'start',
      behavior: reduced() ? 'auto' : 'smooth'
    });
    log.log('look_rink_into_view', {
      why
    });
  }
  const visibleRows = inv => {
    const m = st.map;
    return inv.attempts.filter(a => a.result === 'goal' || m.all || m.band && a.band === m.band || a.row === m.sel).map(a => a.row);
  };
  function layoutMap() {
    const inv = INV[st.inv];
    if (!inv || inv.kind !== 'map') return;
    const g = svg.querySelector('.lk-mapg');
    if (!g) return;
    const sc = Math.min(iceW() / VIEW[2], iceH() / VIEW[3]),
      px = n => +(n / sc).toFixed(3);
    const [nu, nv] = TR(...BNET),
      s = 1,
      pair = st.rinkKey?.startsWith('pair:');
    const m = st.map,
      vis = new Set(pair ? inv.pair.rows : visibleRows(inv)),
      revealed = st.mapRevealed || pair;
    const bandsSvg = pair ? '' : `<defs><clipPath id="lkMapClip"><path d="${svg.querySelector('.boards').getAttribute('d')}Z"/></clipPath></defs>
      <g class="lk-bands${m.band ? ' has-sel' : ''}${st.mapHover ? ' has-hover' : ''}${st.mapHover || m.band ? ` act act-${st.mapHover || m.band}` : ''}" clip-path="url(#lkMapClip)">
        <rect class="lk-band far${m.band === 'far' || st.mapHover === 'far' ? ' sel' : ''}" x="${VIEW[0]}" y="${VIEW[1]}" width="${VIEW[2]}" height="${VIEW[3]}"/>
        <circle class="lk-band mid${m.band === 'mid' || st.mapHover === 'mid' ? ' sel' : ''}" cx="${nu}" cy="${nv}" r="10"/>
        <circle class="lk-band close${m.band === 'close' || st.mapHover === 'close' ? ' sel' : ''}" cx="${nu}" cy="${nv}" r="5"/></g>
      <text class="lk-bl" x="${nu - 5}" y="${nv + px(16)}" text-anchor="middle" font-size="${px(12)}">5 m</text>
      <text class="lk-bl" x="${nu - 10}" y="${nv + px(16)}" text-anchor="middle" font-size="${px(12)}">10 m</text>`;
    const marks = !revealed ? '' : inv.attempts.filter(a => vis.has(a.row)).map(a => {
      const [u, v] = TR(...a.at),
        goal = a.result === 'goal',
        sel = a.row === m.sel || pair && true,
        inBand = m.band && a.band === m.band;
      const r = px(goal ? 8.5 : 5),
        cls = `lk-att${goal ? ' goal' : ''}${a.moment ? ' vid' : ''}${a.row === m.sel ? ' sel' : ''}${m.band && !inBand && !goal ? ' dim' : ''}${m.band && !inBand && goal ? ' gdim' : ''}`;
      const notch = a.moment ? `<path class="lk-vidmark" d="M${u + r + px(2)},${v - px(5)} l${px(8)},${px(5)} l${-px(8)},${px(5)}z"/>` : '';
      const ring = a.row === m.sel ? `<circle class="lk-selring" cx="${u}" cy="${v}" r="${px(goal ? 14 : 11)}"/>` : '';
      return `<g class="${cls}" data-row="${a.row}">${ring}<circle cx="${u}" cy="${v}" r="${r}"/>${notch}</g>`;
    }).join('');
    const pairLines = pair ? inv.pair.rows.map(r => {
      const [u, v] = TR(...ATT[r].at);
      return `<line class="lk-pairnet" x1="${u}" y1="${v}" x2="${nu}" y2="${nv}"/>`;
    }).join('') : '';
    g.innerHTML = bandsSvg + pairLines + marks;
    chipsEl.querySelectorAll('.lk-alab, .lk-bandlab').forEach(e => e.remove());
    const act = !pair && (st.mapHover || m.band);
    if (act) {
      const B = inv.bands.find(b => b.id === act),
        at = {
          close: [-23.4, 0],
          mid: [-18.5, 0],
          far: [-11.5, 0]
        }[act];
      const el = document.createElement('div');
      el.className = `lk-bandlab ${act}`;
      el.innerHTML = `<b>${esc(B.label)}</b><span>${esc({
        close: '≤ 5 m',
        mid: '5–10 m',
        far: '> 10 m'
      }[act])}</span>`;
      chipsEl.appendChild(el);
      el.dataset.at = act;
    }
    const lab = (a, text, side) => {
      const el = document.createElement('div');
      el.className = `lk-alab ${side}${a.result === 'goal' ? ' goal' : ''}`;
      el.dataset.row = a.row;
      el.innerHTML = text;
      chipsEl.appendChild(el);
      const [x, y] = m2px(...a.at);
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    if (pair) inv.pair.rows.forEach((r, i) => {
      const a = ATT[r];
      lab(a, `<b>${esc(a.clock)}</b> ${esc(a.word)}`, i ? 'below' : 'above');
    });else if (m.sel && vis.has(m.sel)) {
      const a = ATT[m.sel];
      lab(a, `<b>${esc(PEOPLE[a.pid].name)}</b> ${esc(a.clock)}`, m2px(...a.at)[1] < iceH() * .35 ? 'below' : 'above');
    }
    if (!pair && revealed) placeGoalTags(inv);
    placeBandLabel();
  }
  function placeBandLabel() {
    const el = chipsEl.querySelector('.lk-bandlab');
    if (!el) return;
    const A = {
      close: [[-23.4, 0], [-23.4, -3.3], [-23.4, 3.3]],
      mid: [[-18.5, 0], [-18.8, -6.4], [-18.8, 6.4]],
      far: [[-11.5, 0], [-11.5, -10.5], [-11.5, 10.5]]
    }[el.dataset.at];
    const other = chipsEl.querySelector('.lk-alab')?.getBoundingClientRect(),
      ov = (a, b) => b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const at of A) {
      const [x, y] = m2px(...at);
      el.style.transform = `translate(${x}px, ${y}px)`;
      if (!ov(el.getBoundingClientRect(), other)) break;
    }
  }
  function placeGoalTags(inv) {}
  function mapPanelHTML(inv) {
    const m = st.map,
      a = m.sel ? ATT[m.sel] : null;
    const rows = inv.bands.map(b => `<button type="button" class="lk-bandrow${m.band === b.id ? ' on' : ''}" data-band="${b.id}" aria-pressed="${m.band === b.id}">
        <span class="lk-sw ${b.id}" aria-hidden="true"></span><span class="lk-br-n"><b>${esc(b.label)}</b><small>${esc(b.range)}</small></span>
        <span class="lk-br-c"><b>${b.n}</b><small>attempts</small></span><span class="lk-br-c goals"><b>${b.goals}</b><small>${b.goals === 1 ? 'goal' : 'goals'}</small></span></button>`).join('');
    const inBand = m.band ? inv.attempts.filter(x => x.band === m.band) : inv.attempts.filter(x => x.result === 'goal');
    const idx = a ? inBand.findIndex(x => x.row === a.row) : -1;
    const card = a ? `<article class="lk-attcard" aria-live="polite" data-row="${a.row}">
        <header><span class="lk-whoring" aria-hidden="true">${esc(PEOPLE[a.pid].no.replace('#', ''))}</span><span class="lk-attwho"><b>${cardName(a.pid)}</b><em>Harbour · ${esc(PEOPLE[a.pid].no)} · ${esc(a.per_label)} · ${esc(a.clock)}</em></span></header>
        <dl class="lk-attfacts"><div><dt>Result</dt><dd>${esc(a.word)}</dd></div><div><dt>Distance</dt><dd>${a.dist} m from the net</dd></div>
          <div class="model"><dt>Chance quality <small>shot model</small></dt><dd>${a.xg.toFixed(3)} · ${ord(a.rank)} of ${inv.total}</dd></div></dl>
        <div class="lk-attfoot">${a.moment ? `<button type="button" class="lk-watch" data-moment="${a.moment}">${ICON.play}<span>Watch it</span></button>` : `<span class="lk-novideo">${RC3 ? 'No clip of this one in Second Look' : 'Not in our video clips'}</span>`}
          ${a.row === inv.second_look?.row && ctx.storyFromLook && !st.resume && !st.origin ? `<button type="button" class="lk-xlink" data-x="story1"><span>${esc(inv.second_look.label)}</span><i aria-hidden="true">→</i></button>` : ''}
          ${idx >= 0 && inBand.length > 1 ? `<span class="lk-step"><button type="button" class="lk-stepb" data-d="-1" aria-label="Previous attempt">${ICON.back}</button><span>${idx + 1} of ${inBand.length}${m.band ? '' : ' goals'}</span><button type="button" class="lk-stepb" data-d="1" aria-label="Next attempt">${ICON.next}</button></span>` : ''}</div></article>` : `<p class="lk-maphint">Tap a band, a goal or any attempt on the rink to see it here.</p>`;
    if (RC3) {
      const ng = inv.attempts.filter(x => x.result === 'goal').length,
        open = !!m.bandsOpen;
      return `<div class="lk-map lk3-map"><p class="lk3-key" aria-hidden="true"><i class="g"></i>${ng} goals <i class="a"></i>${inv.total - ng} other attempts${m.sel ? ' <i class="s"></i>selected' : ''}</p>
        <div class="lk3-tools"><button type="button" class="lk3-bandsbtn" aria-expanded="${open}">${open ? 'Hide distances' : 'By distance'}</button><button type="button" class="lk-allbtn quiet">${mapShowsMore() ? 'Goals only' : `All ${inv.total} attempts`}</button></div>
        ${open ? `<div class="lk-bandrows" role="group" aria-label="Harbour attempts on Novak by distance">${rows}</div>` : ''}${a ? card : ''}</div>`;
    }
    return `<div class="lk-map"><div class="lk-bandrows" role="group" aria-label="Attempts on Novak by distance">${rows}</div>
      <div class="lk-maptools"><button type="button" class="lk-allbtn" aria-pressed="${m.all}">${m.all ? 'Show goals only' : `Show all ${inv.total} attempts`}</button>
        <span class="lk-legend2" aria-hidden="true"><i class="g"></i>goal <i class="a"></i>attempt <i class="v"></i>on video · ${inv.attempts.filter(x => x.result === 'goal' && x.moment).length} of ${inv.attempts.filter(x => x.result === 'goal').length} goals</span></div>${card}</div>`;
  }
  function renderMapPanel(inv, {
    focus = null,
    reveal = false
  } = {}) {
    panelEl.classList.toggle('lk-reveal-in', reveal && !reduced());
    setPanel(mapPanelHTML(inv));
    panelEl.querySelectorAll('.lk-bandrow').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        selectBand(inv, b.dataset.band === st.map.band ? null : b.dataset.band, 'panel');
      };
      b.onpointerenter = () => {
        st.mapHover = b.dataset.band;
        layoutMap();
      };
      b.onpointerleave = () => {
        st.mapHover = null;
        layoutMap();
      };
      b.onfocus = () => {
        if (st.kbd) {
          st.mapHover = b.dataset.band;
          layoutMap();
        }
      };
      b.onblur = () => {
        st.mapHover = null;
        layoutMap();
      };
    });
    const bb = panelEl.querySelector('.lk3-bandsbtn');
    if (bb) bb.onclick = e => {
      e.stopPropagation();
      st.map.bandsOpen = !st.map.bandsOpen;
      log.log(st.map.bandsOpen ? 'detail_open' : 'detail_close', {
        kind: 'shots_bands'
      });
      renderMapPanel(inv, {
        focus: '.lk3-bandsbtn'
      });
    };
    panelEl.querySelector('.lk-allbtn').onclick = e => {
      e.stopPropagation();
      if (RC3) {
        const toGoals = mapShowsMore();
        st.map.all = !toGoals;
        st.map.band = null;
        if (toGoals && st.map.sel && ATT[st.map.sel]?.result !== 'goal') st.map.sel = null;
        log.log('look_map', {
          action: toGoals ? 'goals_only' : 'all',
          on: st.map.all
        });
      } else {
        st.map.all = !st.map.all;
        log.log('look_map', {
          action: 'all',
          on: st.map.all
        });
      }
      renderMapPanel(inv, {
        focus: '.lk-allbtn'
      });
      layoutMap();
      rinkIntoView('all');
    };
    panelEl.querySelectorAll('.lk-stepb').forEach(b => b.onclick = e => {
      e.stopPropagation();
      stepAttempt(inv, +b.dataset.d);
    });
    const xl = panelEl.querySelector('.lk-xlink[data-x=story1]');
    if (xl) xl.onclick = e => {
      e.stopPropagation();
      log.log('look_xlink', {
        from: 'map',
        row: st.map.sel,
        to: 'story1'
      });
      try {
        stage.primeFromGesture(ctx.data.gp02.watch[0]);
      } catch {}
      toStory(inv.id);
    };
    const w = panelEl.querySelector('.lk-watch');
    if (w) w.onclick = e => {
      e.stopPropagation();
      log.log('look_map', {
        action: 'watch',
        row: st.map.sel,
        moment: w.dataset.moment
      });
      openReplay(inv.id, w.dataset.moment);
    };
    if (focus && st.kbd) panelEl.querySelector(focus)?.focus({
      preventScroll: false
    });
  }
  function selectBand(inv, band, how) {
    st.map.band = band;
    const list = band ? inv.attempts.filter(a => a.band === band) : [];
    st.map.sel = band ? (list.find(a => a.result === 'goal') || list[0])?.row ?? null : st.map.sel;
    log.log('look_map', {
      action: 'band',
      band,
      how,
      sel: st.map.sel
    });
    renderMapPanel(inv, {
      focus: band ? `.lk-bandrow[data-band="${band}"]` : null
    });
    layoutMap();
    rinkIntoView('band');
  }
  function selectAttempt(inv, row, how) {
    st.map.sel = row;
    log.log('look_map', {
      action: 'select',
      row,
      how,
      moment: ATT[row]?.moment || null
    });
    renderMapPanel(inv);
    layoutMap();
    if (how === 'rink' && innerWidth / innerHeight < 1) panelEl.querySelector('.lk-attcard')?.scrollIntoView({
      block: 'nearest',
      behavior: reduced() ? 'auto' : 'smooth'
    });
  }
  function stepAttempt(inv, d) {
    const list = st.map.band ? inv.attempts.filter(a => a.band === st.map.band) : inv.attempts.filter(a => a.result === 'goal');
    const i = list.findIndex(a => a.row === st.map.sel),
      n = list[(i + d + list.length) % list.length];
    st.map.sel = n.row;
    log.log('look_map', {
      action: 'step',
      d,
      row: n.row
    });
    renderMapPanel(inv, {
      focus: `.lk-stepb[data-d="${d}"]`
    });
    layoutMap();
    rinkIntoView('step');
  }
  pickEl.addEventListener('click', e => {
    const inv = INV[st.inv];
    if (!inv || inv.kind !== 'map' || !st.rinkKey?.startsWith('map:') || !st.mapPick) return;
    e.stopPropagation();
    const r = ice.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    let best = null,
      bd = 30;
    for (const row of visibleRows(inv)) {
      const [px_, py] = m2px(...ATT[row].at),
        d = Math.hypot(px_ - x, py - y);
      if (d < bd) {
        bd = d;
        best = row;
      }
    }
    if (best) selectAttempt(inv, best, 'rink');
  });
  function mapPrep(inv, key = `map:${inv.id}`) {
    stage.video.pause();
    vw.classList.add('lk-novid');
    document.body.classList.add('lk-tall', 'lk-mapface');
    st.moments = [];
    bindRink(key, inv.rink_attack, {
      k: inv.rink_note,
      t: ''
    });
    ice.classList.add('lk-mapon');
    VIEW = MAPVIEW.slice();
    svg.setAttribute('viewBox', VIEW.join(' '));
    placeCap();
  }
  async function runMap(run, inv) {
    st.mapRevealed = false;
    st.mapPick = false;
    await clearBand();
    alive(run);
    stage.lightOff(0);
    await iceOn(true, {
      ms: 0
    });
    mapPrep(inv);
    layoutMap();
    ice.setAttribute('aria-hidden', 'false');
    document.body.dataset.beat = `look_${inv.id}_predict`;
    await head(inv.intro.head, inv.intro.sub, inv.category);
    alive(run);
    log.log('look_step', {
      inv: inv.id,
      step: 'predict'
    });
    const p = inv.predict,
      shown = performance.now(),
      opts = [...p.options, ['not_sure', 'Not sure', '']];
    cap.actEl.innerHTML = `<div class="lk-acts lk-pred lk-pred4" role="group" aria-label="Your guess">${opts.map(([k, l, r]) => `<button type="button" class="lk-act pick${k === 'not_sure' ? ' unsure' : ''}" data-c="${k}"><span>${esc(l)}</span>${r ? `<small>${esc(r)}</small>` : ''}</button>`).join('')}</div>`;
    cap.actEl.querySelectorAll('button').forEach(b => {
      const hi = on => () => {
        st.mapHover = on && b.dataset.c !== 'not_sure' ? b.dataset.c : null;
        layoutMap();
      };
      b.addEventListener('pointerenter', hi(true));
      b.addEventListener('pointerleave', hi(false));
      b.addEventListener('focus', hi(true));
      b.addEventListener('blur', hi(false));
    });
    focusFirst(cap.actEl);
    requestAnimationFrame(scrollHint);
    const ans = await new Promise(res => cap.actEl.querySelectorAll('button').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (run !== st.run) return;
      cap.actEl.querySelectorAll('button').forEach(x => {
        x.disabled = x !== b;
      });
      b.setAttribute('aria-pressed', 'true');
      res(b.dataset.c);
    }));
    alive(run);
    st.mapHover = null;
    st.predicted[p.id] = ans;
    log.log('look_predict', {
      inv: inv.id,
      q: p.id,
      answer: ans,
      latency_ms: Math.round(performance.now() - shown)
    });
    await sleep(reduced() ? 100 : 350);
    alive(run);
    await clearBand();
    alive(run);
    st.map = {
      band: null,
      sel: null,
      all: !!RC3,
      bandsOpen: false
    };
    st.mapRevealed = true;
    const done = foundMap(run, inv);
    popGoals();
    return done;
  }
  function popGoals() {
    if (reduced()) return;
    svg.querySelectorAll('.lk-att.goal').forEach((el, i) => {
      el.style.animationDelay = `${i * 160}ms`;
      el.classList.add('pop');
    });
  }
  async function foundMap(run, inv, {
    instant = false
  } = {}) {
    if (instant) {
      await clearBand();
      alive(run);
      stage.lightOff(0);
      await iceOn(true, {
        ms: 0
      });
      st.mapRevealed = true;
      mapPrep(inv);
      ice.setAttribute('aria-hidden', 'false');
    }
    st.mapPick = true;
    pickEl.hidden = false;
    renderMapPanel(inv);
    layoutMap();
    foundEntry(inv.id);
    document.body.dataset.beat = `look_${inv.id}_found`;
    const a = st.predicted[inv.predict.id];
    const ack = st.entryAck || (a ? inv.ack[a] : '');
    st.entryAck = '';
    return showFound(run, inv, ack);
  }
  async function toStory(invId) {
    st.returnTo = invId;
    retire();
    st.history = [];
    st.screen = 'story';
    home.hidden = true;
    document.body.classList.remove('lk-homeon');
    await iceOn(false, {
      ms: 0
    });
    clearIce();
    await clearBand().catch(() => {});
    vw.classList.remove('lk-novid', 'lk-iceon', 'lk-samemoment', 'lk-dimvid');
    document.body.classList.remove('look', 'lk-iceface', 'lk-tall', 'lk-mapface', 'lk-pmore');
    screen.scrollTop = 0;
    stage.applyView(false);
    ctx.storyFromLook();
  }
  async function toResume(invId) {
    log.log('look_resume_story', {
      from: invId
    });
    st.resume = false;
    retire();
    st.history = [];
    st.screen = 'story';
    home.hidden = true;
    document.body.classList.remove('lk-homeon');
    await iceOn(false, {
      ms: 0
    });
    clearIce();
    await clearBand().catch(() => {});
    vw.classList.remove('lk-novid', 'lk-iceon', 'lk-samemoment', 'lk-dimvid');
    document.body.classList.remove('look', 'lk-iceface', 'lk-tall', 'lk-mapface', 'lk-pmore');
    screen.scrollTop = 0;
    stage.applyView(false);
    ctx.resumeStory1();
  }
  function pairView(inv) {
    const pts = inv.pair.rows.map(r => TR(...ATT[r].at)),
      [nu, nv] = TR(...BNET);
    const u0 = Math.min(...pts.map(p => p[0])) - 3.5,
      u1 = nu + 3,
      cv = (Math.min(...pts.map(p => p[1]), nv) + Math.max(...pts.map(p => p[1]), nv)) / 2;
    const ar = Math.max(.6, Math.min(1.9, iceW() / Math.max(1, iceH())));
    let W = u1 - u0,
      H = W / ar;
    if (H < 14) {
      H = 14;
      W = Math.max(W, H * ar);
    }
    VIEW = [u0 - (W - (u1 - u0)) / 2, cv - H / 2, W, H];
    svg.setAttribute('viewBox', VIEW.join(' '));
    placeCap();
  }
  function openPair(invId) {
    const inv = INV[invId];
    if (!inv?.pair) return goHome();
    const run = retire();
    push(`pair:${invId}`);
    st.inv = invId;
    st.screen = `pair:${invId}`;
    (st.revisited ||= {})[`${invId}:pair`] = true;
    leaveHome();
    setNav(`${inv.category} · Same area`);
    log.log('look_pair', {
      inv: invId,
      rows: inv.pair.rows
    });
    return guard(() => runPair(run, inv));
  }
  async function runPair(run, inv) {
    const pr = inv.pair;
    await clearBand();
    alive(run);
    stage.lightOff(0);
    await iceOn(true, {
      ms: 0
    });
    st.mapRevealed = true;
    st.mapPick = false;
    mapPrep(inv, `pair:${inv.id}`);
    ice.setAttribute('aria-hidden', 'false');
    pairView(inv);
    svg.setAttribute('viewBox', VIEW.join(' '));
    capK.textContent = RC3 ? "Zoomed in · Harbour attack to the right" : "Zoomed in · Harbour attacking →";
    capT.textContent = '';
    layoutMap();
    document.body.dataset.beat = `look_${inv.id}_pair`;
    st.moments = [];
    await head(pr.head, pr.sub, inv.category);
    alive(run);
    setPanel(`<div class="lk-pair"><table class="lk-ptab"><thead><tr>${pr.rows_cmp[0].map((h, i) => i ? `<th scope="col">${esc(h)}</th>` : '<td></td>').join('')}</tr></thead><tbody>${pr.rows_cmp.slice(1).map(r => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>
      <p class="lk-plimit">${esc(pr.limit)}</p></div>`);
    setCx(`<div class="lk-depth"><p class="lk-fctx">${esc(pr.ctx)}</p></div>`);
    source('Shot events: position, result and goalie in net.', inv.found);
    log.log('look_step', {
      inv: inv.id,
      step: 'pair'
    });
    const pick = await actions(run, [{
      id: `rp:${pr.moment}`,
      label: inv.replays.find(r => r.moment === pr.moment).label,
      kind: 'replay',
      visited: !!st.revisited?.[`${inv.id}:${pr.moment}`]
    }, {
      id: 'map',
      label: 'Back to the map',
      kind: 'back'
    }, {
      id: 'score',
      label: 'Back to the score',
      kind: 'quiet'
    }]);
    alive(run);
    log.log('look_door', {
      from: cur(),
      to: pick
    });
    if (pick === 'score') return toScore('pair');
    if (pick === 'map') {
      st.history.pop();
      return openFound(inv.id);
    }
    return openReplay(inv.id, pick.slice(3));
  }
  const HERO3 = {
    shots: () => {
      const g = INV.shots.attempts.filter(a => a.result === 'goal'),
        sel = st.map.sel && ATT[st.map.sel],
        b = Object.fromEntries(INV.shots.bands.map(x => [x.id, x]));
      if (sel && sel.result === 'goal' && sel.dist === Math.max(...g.map(x => x.dist))) return {
        v: `${sel.dist}`,
        u: 'm',
        k: `${PEOPLE[sel.pid].name}’s winner · the farthest of the ${g.length} goals on Novak`,
        ctx: `${g.length} goals from ${INV.shots.total} Harbour shot attempts with Novak in goal, including missed and blocked attempts. None from within 5 m.`
      };
      return {
        v: `${b.close.goals} of ${b.close.n}`,
        u: '',
        k: 'close-in attempts (within 5 m) went in',
        ctx: `${INV.shots.total} Harbour shot attempts with Novak in goal, including missed and blocked attempts.`
      };
    },
    follow: () => {
      const pp = PEOPLE[PAS[INV.follow.links[0].pass_].passer];
      return {
        v: `${INV.follow.links.length} of ${INV.follow.links.length}`,
        u: '',
        k: `last Harbour pass before each chance: ${pp.no} ${pp.name}`,
        card: PAS[INV.follow.links[0].pass_].passer,
        ctx: preRead(INV.follow) ? P.founds[INV.follow.found].depth.ctx : P.founds[INV.follow.found].depth.worth.text.split('. ')[0] + '.'
      };
    },
    hold: () => {
      const A = MOM[INV.hold.frm],
        Bm = MOM[INV.hold.to],
        a = new Set(A.players.map(p => p.pid));
      const kept = t => skaters(Bm, t).filter(p => a.has(p.pid)).length;
      return {
        v: `${kept('selects')} of 5`,
        u: '',
        k: kept('davos') ? `Ridge skaters still on 44 s later · Harbour ${kept('davos')} of 5` : "Ridge skaters still on, 40 s later",
        ctx: P.founds[INV.hold.found].depth.ctx
      };
    }
  };
  const CAVEAT3 = {
    shots: 'limit',
    follow: 'limit',
    hold: 'limit'
  };
  function heroHTML(h) {
    return `<div class="lk3-hero"><b class="lk3-v">${esc(h.v)}${h.u ? `<u> ${esc(h.u)}</u>` : ''}</b><span class="lk3-k">${esc(h.k)}</span>${h.card && CARDS?.hasCard(h.card) ? `<button type="button" class="e1-cardbtn" data-card="${h.card}">${esc(PEOPLE[h.card].name)}’s match card</button>` : ''}</div>`;
  }
  const deepRow = (d, re) => (d.deeper?.rows || []).find(([k]) => re.test(k))?.[1] || '';
  function moreHTML(f, inv) {
    const d = f.depth;
    if (!d) return '';
    let q = '',
      body = '';
    if (inv.kind === 'map') {
      q = 'How did each distance go?';
      body = `<table class="b1-btab"><thead><tr><th scope="col">Distance</th><th scope="col">Attempts</th><th scope="col">Goals</th></tr></thead><tbody>${inv.bands.map(b => `<tr><th scope="row"><span class="lk-sw ${b.id}" aria-hidden="true"></span>${esc(b.label)} <small>${esc(b.range)}</small></th><td>${b.n}</td><td>${b.goals}</td></tr>`).join('')}<tr class="tot"><th scope="row">All</th><td>${inv.total}</td><td>${inv.bands.reduce((a, b) => a + b.goals, 0)}</td></tr></tbody></table>` + `<p class="b1-note">Saved, missed and blocked attempts are on the map.${inv.empty_net_excluded ? ` ${inv.empty_net_excluded === 1 ? 'One more goal went into an empty net; it is not counted here.' : `${inv.empty_net_excluded} empty-net goals are not counted here.`}` : ''}</p>`;
    } else if (inv.kind === 'hold') {
      const times = d.context.times ? Object.fromEntries(d.context.times.flatMap(t => t.rows)) : null;
      q = "Who was on the ice at 9:31?";
      body = `<p class="b1-note">Time on the ice this shift, about.</p>${lineupHTML(MOM[inv.frm], MOM[inv.to], times)}` + (deepRow(d, /two moments/i) ? `<p class="b1-note">No whistle, faceoff or penalty between the two moments.</p>` : '');
    } else {
      const usual = deepRow(d, /followed by/i),
        also = deepRow(d, /Also on the ice/i);
      q = 'Is he an unusual passer?';
      body = (usual ? `<p>${esc(usual.replace(/^(\d+) of his (\d+) completed passes \((\d+) %\) were followed by a Harbour attempt in the same possession\. That is about the usual rate in this final \((\d+) %[^)]*\)\. /, "No. $1 of his $2 completed passes were followed by a Harbour attempt: about the usual rate in this final ($4 %). "))}</p>` : '') + (also ? `<p class="b1-note">Also on the ice both times: ${esc(also.replace(/\.$/, ''))}.</p>` : '');
    }
    return `<details class="lk3-more b1-more" data-row="more"><summary><span>${esc(q)}</span><i aria-hidden="true">${ICON.next}</i></summary><div class="lk3-more-b">${body}</div></details>`;
  }
  function shiftStripHTML() {
    const F = P.facts,
      rows = [['selects', "Ridge", Object.values(F.selects_elapsed)], ['davos', "Harbour", Object.values(F.davos_elapsed)]];
    const W = 320,
      X0 = 92,
      X1 = 308,
      MAX = 120,
      x = v => X0 + (X1 - X0) * Math.min(v, MAX) / MAX,
      typ = F.typical_shift_s,
      AX = 106;
    const marks = (vals, t, y) => vals.slice().sort((a, b) => a - b).map((v, i, arr) => {
      const d = arr.slice(0, i).filter(w => Math.abs(x(w) - x(v)) < 11).length,
        yy = y + (d ? (d % 2 ? -1 : 1) * 12 * Math.ceil(d / 2) : 0);
      return t === 'selects' ? `<circle class="sel" cx="${x(v).toFixed(1)}" cy="${yy}" r="6.5"/>` : `<rect class="dav" x="${(x(v) - 6).toFixed(1)}" y="${yy - 6}" width="12" height="12" rx="2"/>`;
    }).join('');
    const rng = vals => {
      const a = Math.min(...vals),
        b = Math.max(...vals);
      return b < 20 ? about5(b) === 'just on' ? 'just on' : `${about5(b)} or less` : `${about5(a)}–${about5(b)}`;
    };
    const label = rows.map(([, n, v]) => `${n}: ${rng(v)}`).join('; ');
    return `<figure class="lk3-strip" role="img" aria-label="Time on the ice this shift when Harbour scored at 9:31, about. ${esc(label)}. A typical shift in this final lasted about 45 seconds.">
      <figcaption>Time on the ice this shift, at the 9:31 goal <small>(about)</small></figcaption>
      <svg viewBox="0 0 ${W} 124" aria-hidden="true">
        <line class="ax" x1="${X0}" x2="${X1}" y1="${AX}" y2="${AX}"/>${[0, 60, 120].map(v => `<line class="tk" x1="${x(v)}" x2="${x(v)}" y1="${AX - 3}" y2="${AX + 3}"/><text class="tl" x="${x(v)}" y="${AX + 15}" text-anchor="middle">${v ? mmss(v) : '0:00'}</text>`).join('')}
        <line class="typ" x1="${x(typ)}" x2="${x(typ)}" y1="16" y2="${AX}"/><text class="typl" x="${x(typ)}" y="11" text-anchor="middle">typical shift ~45 s</text>
        ${rows.map(([t, n, v], i) => {
      const y = 40 + i * 40;
      return `<text class="rl ${t}" x="0" y="${y - 1}">${n}</text><text class="rv" x="0" y="${y + 13}">${esc(rng(v))}</text>${marks(v, t, y)}`;
    }).join('')}
      </svg></figure>`;
  }
  function lineupCountsHTML(A) {
    const g = t => goalieOf(A, t),
      sk = t => skaters(A, t).length;
    return `<div class="lk3-counts">${['selects', 'davos'].map(t => `<p class="${t}"><span class="lk-shape ${t}" aria-hidden="true"></span><b>${t === 'selects' ? "Ridge" : "Harbour"}</b> ${sk(t)} skaters${g(t) ? ` + ${esc(PEOPLE[g(t).pid].name)} in goal${t === 'davos' ? ' (other end)' : ''}` : ''}</p>`).join('')}</div>`;
  }
  function compactChancesHTML(inv) {
    const pp = i => passerOf(inv, i);
    return `<ol class="lk3-chances">${inv.links.map((l, i) => {
      const c = inv.chances[i],
        p = PAS[l.pass_];
      return `<li><span class="lk-cn" aria-hidden="true">${c.n}</span><span class="lk3-cw"><b>${esc(c.per.replace(' period', ''))} ${esc(c.clock)}</b> ${esc(whatOf(inv, i))}</span></li>`;
    }).join('')}</ol>`;
  }
  const setCx = html => {
    const el = root.querySelector('.cap.cx');
    if (!el) return;
    el.innerHTML = html || '';
    el.classList.toggle('in', !!html);
  };
  function depthRow(cls, label, short, body) {
    return `<details class="lk-row ${cls}" data-row="${cls}"><summary><span class="lk-row-t"><span class="lk-row-k">${esc(label)}</span><span class="lk-row-s">${esc(short)}</span></span><i class="lk-row-i" aria-hidden="true">${ICON.next}</i></summary><div class="lk-row-b">${body}</div></details>`;
  }
  function contextBody(c, inv) {
    let h = c.lead ? `<p class="lk-d-lead">${esc(c.lead)}</p>` : '';
    if (c.steps) h += `<ol class="lk-steps">${c.steps.map(x => `<li><b>${esc(x.v)}</b><span>${esc(x.k)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</li>`).join('')}</ol>`;
    if (c.times) h += `<div class="lk-times">${c.times.map(t => `<section class="${t.team}"><h5><span class="lk-shape ${t.team}" aria-hidden="true"></span>${t.team === 'selects' ? "Ridge" : "Harbour"}</h5><dl>${t.rows.map(([n, v]) => `<dt>${esc(n)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`).join('')}</div>`;
    if (c.bands && inv?.bands) h += bandTable(inv);
    if (c.note) h += `<p class="lk-d-note">${esc(c.note)}</p>`;
    return h;
  }
  function bandTable(inv) {
    return `<table class="lk-btab"><colgroup><col class="c1"><col><col><col><col><col></colgroup><thead><tr><th scope="col">Distance</th><th scope="col">Attempts</th><th scope="col">Goals</th><th scope="col">Saved</th><th scope="col">Missed</th><th scope="col">Blocked</th></tr></thead><tbody>${inv.bands.map(b => `<tr><th scope="row"><span class="lk-bn"><span class="lk-sw ${b.id}" aria-hidden="true"></span>${esc(b.label)}</span><small>${esc(b.range)}</small></th><td data-l="attempts">${b.n}</td><td data-l="goals">${b.goals}</td><td data-l="saved">${b.saved}</td><td data-l="missed">${b.missed}</td><td data-l="blocked">${b.blocked}</td></tr>`).join('')}<tr class="tot"><th scope="row">All</th><td data-l="attempts">${inv.total}</td><td data-l="goals">${inv.bands.reduce((a, b) => a + b.goals, 0)}</td><td data-l="saved">${inv.bands.reduce((a, b) => a + b.saved, 0)}</td><td data-l="missed">${inv.bands.reduce((a, b) => a + b.missed, 0)}</td><td data-l="blocked">${inv.bands.reduce((a, b) => a + b.blocked, 0)}</td></tr></tbody></table>`;
  }
  const leadHTML = d => `<p class="lk-fctx lk-lead">${esc(d.ctx)}</p>` + (d.facts?.length ? `<ul class="lk-facts">${d.facts.map(x => `<li class="${x.team || 'gen'}"><b>${esc(x.v)}</b><span>${x.k ? `<em>${esc(x.k)}</em>` : ''}${esc(x.l)}</span></li>`).join('')}</ul>` : '');
  function depthHTML(f, inv) {
    const d = f.depth;
    if (inv.kind === 'hold') return `<div class="lk-depth">${rowsHTML(d, inv)}</div>`;
    const facts = d.facts?.length ? `<ul class="lk-facts">${d.facts.map(x => `<li class="${x.team || 'gen'}"><b>${esc(x.v)}</b><span>${x.k ? `<em>${esc(x.k)}</em>` : ''}${esc(x.l)}</span></li>`).join('')}</ul>` : '';
    return `<div class="lk-depth"><p class="lk-fctx">${esc(d.ctx)}</p>${facts}${rowsHTML(d, inv)}</div>`;
  }
  function rowsHTML(d, inv) {
    return `<div class="lk-rows">${depthRow('worth', 'Why it’s worth noticing', d.worth.short, `<p>${esc(d.worth.text)}</p>`)}${depthRow('limit', 'What this doesn’t tell us', d.limit.short, `<p>${esc(d.limit.text)}</p>`)}</div>
      <div class="lk-rows lk-more">${depthRow('context', d.context.title, d.context.short, contextBody(d.context, inv))}${depthRow('deeper', d.deeper.title, d.deeper.short, `<dl class="lk-deep">${d.deeper.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`)}</div>`;
  }
  function wireDepth(fid) {
    root.querySelectorAll('.cap.cx details.lk-row').forEach(dd => dd.addEventListener('toggle', () => {
      log.log('look_depth', {
        found: fid,
        row: dd.dataset.row,
        open: dd.open
      });
      requestAnimationFrame(scrollHint);
    }));
  }
  async function showFound(run, inv, ack) {
    const f = P.founds[inv.found];
    st.found.add(inv.found);
    const bridge = st.origin && RC3_BRIDGE[inv.id]?.[st.origin.id]?.line;
    if (RC3) ack = bridge || ack;
    await cap._set(cap.topEl, `<span class="ln lk-eyebrow found in">${ICON.check}Found</span>${ack ? `<span class="ln sub ack in">${esc(ack)}</span>` : ''}<span class="ln q in lk-fline">${nl2br(f.line)}</span>`, {
      stagger: 0,
      cls: 'q'
    });
    alive(run);
    if (RC3 && f.depth && HERO3[inv.id]) {
      const h = HERO3[inv.id](),
        cav = CAVEAT3[inv.id] ? `<p class="lk3-cav">${esc(f.depth[CAVEAT3[inv.id]].text)}</p>` : '';
      const pic = inv.kind === 'hold' ? shiftStripHTML() : '';
      setCx(inv.kind === 'hold' ? `<div class="lk3">${heroHTML(h)}${cav}${pic}<p class="lk3-ctx">${esc(h.ctx)}</p></div>` : `<div class="lk3">${heroHTML(h)}${pic}<p class="lk3-ctx">${esc(h.ctx)}</p>${cav}</div>`);
      setMore(preRead(inv) ? '' : moreHTML(f, inv));
      moreEl?.querySelector('details.lk3-more')?.addEventListener('toggle', e => {
        log.log(e.target.open ? 'detail_open' : 'detail_close', {
          kind: 'lens_more',
          lens: inv.id
        });
        requestAnimationFrame(scrollHint);
      });
    } else {
      setCx(f.depth ? depthHTML(f, inv) : `<p><span class="lk-fctx">${esc(f.ctx)}</span></p>`);
      wireDepth(inv.found);
    }
    source(f.src, inv.found);
    log.log('look_found', {
      inv: inv.id,
      found: inv.found,
      ...(st.origin ? {
        origin: st.origin.id
      } : {})
    });
    const others = HUB().filter(i => i.id !== inv.id);
    const backHome = SEL && SELCTX && inv.id === SEL.id ? [{
      id: 'davos',
      label: "Back to the Harbour map",
      kind: 'back'
    }] : [];
    const gp09Seen = () => {
      try {
        return sessionStorage.getItem('sl.b1.gp09') === '1';
      } catch {
        return false;
      }
    };
    const sideOpen = st.origin && st.origin.id === 's2_carry' || !st.origin && gp09Seen();
    if (SEL && SELCTX && inv.id === 'shots' && sideOpen) {
      const seen = st.found.has(INV[SEL.id]?.found);
      sideDoor.innerHTML = `<button type="button" class="lk-act go" data-a="other"${seen ? ' data-visited="1"' : ''}><i aria-hidden="true">${ICON.next}</i><span>And the other side?</span>${seen ? `<em class="lk-seen">${ICON.check}seen</em>` : ''}</button>`;
      sideDoor.hidden = false;
      sideDoor.firstChild.onclick = e => {
        e.stopPropagation();
        if (run !== st.run) return;
        log.log('look_door', {
          from: cur(),
          to: 'other',
          where: 'top'
        });
        openInv(SEL.id);
      };
    } else if (SEL && SELCTX && inv.id === 'shots' && !st.origin) {
      sideDoor.innerHTML = `<p class="lk-sidenote">The other side’s shot map opens after Story 2.</p>`;
      sideDoor.hidden = false;
    }
    if (st.origin) {
      const own = inv.kind === 'map' ? inv.pair ? [{
        id: 'pair',
        label: RC3 ? 'Same spot: goal or save?' : 'Same area, different result',
        kind: 'go',
        visited: !!st.revisited?.[`${inv.id}:pair`]
      }] : [] : inv.replays.filter(r => !(preRead(inv)?.hide_replays || []).includes(r.moment)).map(r => ({
        id: `rp:${r.moment}`,
        label: r.label,
        kind: 'replay',
        visited: !!st.revisited?.[`${inv.id}:${r.moment}`]
      }));
      requestAnimationFrame(scrollHint);
      const pk = await actions(run, [{
        id: 'origin',
        label: st.origin.label,
        kind: 'back'
      }, ...backHome, ...own, {
        id: 'score',
        label: 'Back to the score',
        kind: 'quiet'
      }]);
      alive(run);
      log.log('look_door', {
        from: cur(),
        to: pk
      });
      if (pk === 'other') return openInv(SEL.id);
      if (pk === 'davos') return openFound('shots');
      if (pk === 'origin') return toOrigin('button');
      if (pk === 'score') return toScore('found');
      if (pk === 'pair') return openPair(inv.id);
      return openReplay(inv.id, pk.slice(3));
    }
    const list = (st.resume ? [{
      id: 'resume',
      label: 'Next: same goalie, a different problem',
      kind: 'go'
    }] : []).concat(inv.kind === 'map' ? inv.pair ? [{
      id: 'pair',
      label: RC3 ? 'Same spot: goal or save?' : 'Same area, different result',
      kind: 'go',
      visited: !!st.revisited?.[`${inv.id}:pair`]
    }] : [] : inv.replays.map(r => ({
      id: `rp:${r.moment}`,
      label: r.label,
      kind: 'replay',
      visited: !!st.revisited?.[`${inv.id}:${r.moment}`]
    }))).concat(backHome).concat(others.length ? [{
      id: 'home',
      label: 'Explore another discovery',
      kind: 'next'
    }] : []).concat([{
      id: 'score',
      label: 'Back to the score',
      kind: 'quiet'
    }]);
    requestAnimationFrame(scrollHint);
    const pick = await actions(run, list);
    alive(run);
    log.log('look_door', {
      from: cur(),
      to: pick
    });
    if (pick === 'other') return openInv(SEL.id);
    if (pick === 'davos') return openFound('shots');
    if (pick === 'home') return goHome();
    if (pick === 'score') return toScore('found');
    if (pick === 'resume') return toResume(inv.id);
    if (pick === 'pair') return openPair(inv.id);
    return openReplay(inv.id, pick.slice(3));
  }
  function openReplay(invId, momentId) {
    const inv = INV[invId],
      mo = MOM[momentId];
    const prevMoments = st.moments.slice();
    const run = retire();
    push(`replay:${invId}:${momentId}`);
    st.inv = invId;
    st.screen = `replay:${invId}:${momentId}`;
    (st.revisited ||= {})[`${invId}:${momentId}`] = true;
    leaveHome();
    setNav(`${inv.category} · ${mo.label}`);
    log.log('look_replay', {
      inv: invId,
      moment: momentId
    });
    return guard(() => runReplay(run, inv, mo, prevMoments));
  }
  async function runReplay(run, inv, mo, prevMoments) {
    await clearBand();
    alive(run);
    const from = prevMoments.length === 1 && prevMoments[0] !== mo.id ? MOM[prevMoments[0]] : null;
    const ori = (inv.kind === 'connect' || inv.kind === 'map') && mo.attack !== inv.rink_attack;
    vw.classList.add('lk-novid');
    await iceOn(false, {
      ms: 250
    });
    alive(run);
    clearIce();
    const r = inv.replays.find(x => x.moment === mo.id),
      pa = r?.pass_ ? PAS[r.pass_] : null;
    const loading = (async () => {
      if (stage.clip !== mo.clip) await stage.load(mo.clip);
      await stage.seek(mo.window[0]);
    })();
    await plate(run, mo, {
      from,
      caption: ori ? 'Teams have switched ends' : ''
    });
    await loading;
    alive(run);
    st.moments = [mo.id];
    document.body.dataset.beat = `look_replay_${mo.id}`;
    stage.setBase(mo.x0 ?? 240);
    vw.classList.remove('lk-novid');
    stage.ctx(`${mo.label} · ${mo.score}`);
    if (pa) {
      await stage.lightOff(0);
      await stage.play({
        from: mo.window[0],
        to: pa.t,
        label: `look_${mo.clip}_pass`
      });
      alive(run);
      await stage.light(pa.light, {
        dim: .55,
        ms: 500
      });
      alive(run);
      stage.tag(pa.tag_px, PEOPLE[pa.passer].label, PEOPLE[pa.passer].team, pa.tag_side);
      await head(r.pass_copy.head, r.pass_copy.sub, inv.category);
      alive(run);
      log.log('look_step', {
        inv: inv.id,
        step: 'replay_pass',
        moment: mo.id,
        pass: pa.id
      });
      await cap.holdW(reduced() ? 2600 : 3200, `look_replay_${mo.id}`);
      alive(run);
      stage.clearMarks({
        keepFan: false
      });
      await stage.lightOff(250);
      alive(run);
      await clearBand();
      alive(run);
      if (pa.pan_to != null) {
        stage.baseX = pa.pan_to;
        stage.applyView(true, 900);
      }
      await stage.play({
        from: null,
        to: mo.window[1],
        label: `look_${mo.clip}_shot`
      });
      alive(run);
    } else {
      await stage.lightOff(0);
      await stage.play({
        from: mo.window[0],
        to: mo.window[1],
        label: `look_${mo.clip}`
      });
      alive(run);
    }
    if (mo.light) {
      await stage.light(mo.light, {
        dim: .5,
        ms: 500
      });
      alive(run);
    }
    const end = r?.end_copy || {
      head: mo.kind === 'goal' ? 'The goal.' : 'The chance.',
      sub: `${mo.per_label} · ${mo.clock}`
    };
    await head(end.head, end.sub, inv.category);
    alive(run);
    log.log('look_step', {
      inv: inv.id,
      step: 'replay_end',
      moment: mo.id
    });
    const other = inv.kind === 'map' ? null : inv.replays.find(x => x.moment !== mo.id);
    const pick = await actions(run, [{
      id: 'again',
      label: 'Watch again',
      kind: 'replay'
    }, ...(other ? [{
      id: `rp:${other.moment}`,
      label: other.label,
      kind: 'replay',
      visited: !!st.revisited?.[`${inv.id}:${other.moment}`]
    }] : []), {
      id: 'found',
      label: inv.kind === 'map' ? 'Back to the map' : 'Back to the finding',
      kind: 'back'
    }]);
    alive(run);
    log.log('look_door', {
      from: cur(),
      to: pick
    });
    if (pick === 'again') {
      st.history.pop();
      return openReplay(inv.id, mo.id);
    }
    if (pick === 'found') {
      while (st.history.length && !cur().startsWith('found:')) st.history.pop();
      return openFound(inv.id);
    }
    st.history.pop();
    return openReplay(inv.id, pick.slice(3));
  }
  async function showVideoMoment(run, mo, {
    play = false
  } = {}) {
    vw.classList.remove('lk-dimvid');
    await iceOn(false, {
      ms: 0
    });
    if (stage.clip !== mo.clip) {
      vw.classList.add('lk-novid');
      await stage.load(mo.clip);
      alive(run);
      await stage.seek(mo.window[0]);
      alive(run);
    }
    vw.classList.remove('lk-novid');
    stage.setBase(mo.x0 ?? 240);
    if (play) {
      await stage.lightOff(0);
      await stage.play({
        from: mo.window[0],
        to: mo.t,
        label: `look_${mo.clip}`
      });
    } else await stage.seek(mo.t);
    alive(run);
    stage.ctx(`${mo.label} · ${mo.score}`);
    if (mo.light) {
      await stage.light(mo.light, {
        dim: .55,
        ms: 600
      });
      alive(run);
    }
  }
  if (SELMAP) {
    SEL = SELMAP.selectsMap({
      P,
      st,
      INV,
      PEOPLE,
      svg,
      chipsEl,
      pickEl,
      ice,
      capK,
      capT,
      cap,
      panelEl,
      setPanel,
      head,
      clearBand,
      iceOn,
      alive,
      bindRink,
      stage,
      vw,
      setView: v => {
        VIEW = v;
      },
      getView: () => VIEW,
      tr: () => TR,
      m2px,
      iceW,
      iceH,
      placeCap,
      foundEntry,
      showFound,
      log,
      esc,
      ICON,
      RC3,
      focusFirst,
      scrollHint,
      openReplay,
      ord,
      reduced,
      sleep,
      cardName,
      popGoals
    });
    if (SEL) {
      HERO3[SEL.id] = SEL.hero;
      CAVEAT3[SEL.id] = 'limit';
      window.__selmap = SEL.state;
    }
  }
  const STEPS = new URLSearchParams(location.search).get('follow') === 'steps' ? (await import('./follow_steps.js')).followSteps({
    P,
    st,
    ICON,
    esc,
    log,
    panelEl,
    setPanel,
    chancesHTML,
    alive,
    held: inv => preRead(inv)?.hide_replays || []
  }) : null;
  window.__look = {
    state: () => {
      const v = stage.video,
        vis = el => el && getComputedStyle(el).display !== 'none' && !el.hidden;
      return {
        screen: st.screen,
        inv: st.inv,
        history: st.history.slice(),
        face: st.face,
        rinkKey: st.rinkKey,
        rinkAttack: st.rinkAttack,
        moments: st.moments.slice(),
        chips: [...chipEls.keys()],
        tokens: [...chipsEl.querySelectorAll('.lk-tok')].map(t => ({
          pid: t.dataset.pid,
          open: t.classList.contains('open')
        })),
        capK: capK.textContent,
        capT: capT.textContent,
        clock: clockEl.hidden ? '' : clockEl.innerText.replace(/\s+/g, ' ').trim(),
        video: {
          clip: stage.clip,
          t: +v.currentTime.toFixed(2),
          paused: v.paused,
          hiddenUnderRink: vw.classList.contains('lk-novid'),
          sameMoment: vw.classList.contains('lk-samemoment')
        },
        stageCtx: stage.ctxEl.hidden ? '' : stage.ctxEl.innerText,
        nav: {
          where: st.where,
          back: !nav.querySelector('.lk-back').hidden,
          all: !nav.querySelector('.lk-all').hidden
        },
        home: !home.hidden,
        found: [...st.found],
        plate: !root.querySelector('.bridge').hidden,
        map: {
          ...st.map,
          revealed: !!st.mapRevealed,
          pick: !!st.mapPick && !pickEl.hidden,
          marks: [...svg.querySelectorAll('.lk-att')].map(g => +g.dataset.row),
          video: [...svg.querySelectorAll('.lk-att.vid')].map(g => +g.dataset.row),
          view: VIEW ? VIEW.slice() : null,
          area: [iceW(), iceH()],
          label: [...chipsEl.querySelectorAll('.lk-bandlab')].map(e => e.innerText.replace(/\s+/g, ' ').trim())
        }
      };
    },
    payload: P
  };
  return {
    async close() {
      retire();
      st.history = [];
      st.screen = 'story';
      st.origin = null;
      st.inv = null;
      home.hidden = true;
      document.body.classList.remove('lk-homeon');
      await iceOn(false, {
        ms: 0
      });
      clearIce();
      await clearBand().catch(() => {});
      vw.classList.remove('lk-novid', 'lk-iceon', 'lk-samemoment', 'lk-dimvid');
      document.body.classList.remove('look', 'lk-iceface', 'lk-tall', 'lk-mapface', 'lk-pmore');
      screen.scrollTop = 0;
      bandB.scrollTop = 0;
      stage.applyView(false);
    },
    async open(entry, openId = null, {
      sel = null,
      resume = false,
      origin = null
    } = {}) {
      log.log('look_open', {
        entry,
        transition: st.tr,
        ...(sel ? {
          sel
        } : {}),
        ...(origin ? {
          origin: origin.id
        } : {})
      });
      st.origin = RC3 && origin && READY.some(i => i.id === openId) ? origin : null;
      st.resume = !!(resume && ctx.resumeStory1);
      document.body.classList.add('look');
      document.body.classList.remove('nextmode');
      const nx = root.querySelector('.next');
      if (nx && !nx.hidden) {
        nx.classList.remove('on');
        await sleep(reduced() ? 0 : 350);
        nx.hidden = true;
        nx.innerHTML = '';
      }
      root.querySelector('#story .screen, .screen')?.removeAttribute('aria-hidden');
      root.querySelector('.band.top .cap.top')?.setAttribute('aria-live', 'polite');
      if (st.origin) {
        leaveHome();
        document.body.classList.remove('lk-homeon');
        st.history = [];
        st.resume = false;
        if (INV[openId].kind === 'map') {
          st.map = {
            band: null,
            sel: INV[openId].attempts.some(a => a.row === sel) ? sel : null,
            all: true,
            bandsOpen: false
          };
          log.log('look_xlink_open', {
            to: openId,
            entry,
            sel,
            origin: st.origin.id
          });
          return openFound(openId);
        }
        log.log('look_xlink_open', {
          to: openId,
          entry,
          origin: st.origin.id
        });
        return openInv(openId);
      }
      if (entry === 'return' && st.returnTo && INV[st.returnTo]) {
        const id = st.returnTo;
        st.returnTo = null;
        st.history = ['home'];
        log.log('look_return', {
          to: id,
          map: {
            ...st.map
          }
        });
        return openFound(id);
      }
      if (sel && openId && INV[openId]?.kind === 'map' && READY.some(i => i.id === openId) && INV[openId].attempts.some(a => a.row === sel)) {
        leaveHome();
        document.body.classList.remove('lk-homeon');
        st.history = ['home'];
        st.map = {
          band: null,
          sel,
          all: false
        };
        const g = INV[openId].attempts.filter(x => x.result === 'goal'),
          me = g.find(x => x.row === sel);
        st.entryAck = me && g.length > 1 && me.dist === Math.max(...g.map(x => x.dist)) ? `The winner: the farthest of the ${['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][g.length] || g.length} goals.` : '';
        log.log('look_xlink_open', {
          to: openId,
          entry,
          sel
        });
        return openFound(openId);
      }
      await goHome({
        entry
      });
      if (openId && READY.some(i => i.id === openId)) {
        log.log('look_xlink_open', {
          to: openId,
          entry
        });
        return openInv(openId);
      }
    }
  };
}
