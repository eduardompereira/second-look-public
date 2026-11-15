export async function mergeOtherSide(P) {
  let S;
  try {
    S = await (await fetch('/data/selects_map.json')).json();
  } catch {
    return null;
  }
  const inv = S.investigations?.[0];
  if (!inv || P.investigations.some(i => i.id === inv.id)) return null;
  P.investigations.push(inv);
  for (const [k, v] of Object.entries(S.founds || {})) if (!(k in P.founds)) P.founds[k] = v;
  for (const [k, v] of Object.entries(S.moments || {})) if (!(k in P.moments)) P.moments[k] = v;
  for (const [k, v] of Object.entries(S.people || {})) if (!(k in P.people)) P.people[k] = v;
  return inv.id;
}
export function selectsMap(k) {
  const {
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
    setView,
    getView,
    tr,
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
    sleep
  } = k;
  const cardName = k.cardName || (pid => esc(PEOPLE[pid].full));
  const ID = 'shots_sel',
    inv = INV[ID];
  if (!inv) return null;
  const ATT = Object.fromEntries(inv.attempts.map(a => [a.row, a]));
  const BNET = [-P.rink.goal_x, 0];
  const MAPVIEW = [4.6, -16.6, 29, 33.2];
  const GN = PEOPLE[inv.goalie]?.name || 'the goalie';
  const S = () => st.selmap ||= {
    band: null,
    sel: null,
    all: false,
    bandsOpen: false,
    revealed: false,
    pick: false,
    hover: null
  };
  const KEY = `selmap:${ID}`;
  const visibleRows = () => {
    const m = S();
    return inv.attempts.filter(a => a.result === 'goal' || m.all || m.band && a.band === m.band || a.row === m.sel).map(a => a.row);
  };
  function layout() {
    if (st.inv !== ID || !st.rinkKey?.startsWith('selmap:')) return;
    const g = svg.querySelector('.lk-mapg');
    if (!g) return;
    const VIEW = getView(),
      TR = tr();
    const sc = Math.min(iceW() / VIEW[2], iceH() / VIEW[3]),
      px = n => +(n / sc).toFixed(3);
    const [nu, nv] = TR(...BNET),
      m = S(),
      vis = new Set(visibleRows()),
      hov = m.hover;
    const bandsSvg = `<defs><clipPath id="lkSelMapClip"><path d="${svg.querySelector('.boards').getAttribute('d')}Z"/></clipPath></defs>
      <g class="lk-bands${m.band ? ' has-sel' : ''}${hov ? ' has-hover' : ''}${hov || m.band ? ` act act-${hov || m.band}` : ''}" clip-path="url(#lkSelMapClip)">
        <rect class="lk-band far${m.band === 'far' || hov === 'far' ? ' sel' : ''}" x="${VIEW[0]}" y="${VIEW[1]}" width="${VIEW[2]}" height="${VIEW[3]}"/>
        <circle class="lk-band mid${m.band === 'mid' || hov === 'mid' ? ' sel' : ''}" cx="${nu}" cy="${nv}" r="10"/>
        <circle class="lk-band close${m.band === 'close' || hov === 'close' ? ' sel' : ''}" cx="${nu}" cy="${nv}" r="5"/></g>
      <text class="lk-bl" x="${nu - 5}" y="${nv + px(16)}" text-anchor="middle" font-size="${px(12)}">5 m</text>
      <text class="lk-bl" x="${nu - 10}" y="${nv + px(16)}" text-anchor="middle" font-size="${px(12)}">10 m</text>`;
    const marks = !m.revealed ? '' : inv.attempts.filter(a => vis.has(a.row)).map(a => {
      const [u, v] = TR(...a.at),
        goal = a.result === 'goal',
        inBand = m.band && a.band === m.band;
      const r = px(goal ? 8.5 : 5),
        cls = `lk-att${goal ? ' goal' : ''}${a.moment ? ' vid' : ''}${a.row === m.sel ? ' sel' : ''}${m.band && !inBand && !goal ? ' dim' : ''}${m.band && !inBand && goal ? ' gdim' : ''}`;
      const notch = a.moment ? `<path class="lk-vidmark" d="M${u + r + px(2)},${v - px(5)} l${px(8)},${px(5)} l${-px(8)},${px(5)}z"/>` : '';
      const ring = a.row === m.sel ? `<circle class="lk-selring" cx="${u}" cy="${v}" r="${px(goal ? 14 : 11)}"/>` : '';
      return `<g class="${cls}" data-row="${a.row}">${ring}<circle cx="${u}" cy="${v}" r="${r}"/>${notch}</g>`;
    }).join('');
    g.innerHTML = bandsSvg + marks;
    chipsEl.querySelectorAll('.lk-alab, .lk-bandlab').forEach(e => e.remove());
    const act = hov || m.band;
    if (act) {
      const B = inv.bands.find(b => b.id === act);
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
    if (m.sel && vis.has(m.sel)) {
      const a = ATT[m.sel],
        el = document.createElement('div'),
        [x, y] = m2px(...a.at);
      el.className = `lk-alab ${y < iceH() * .35 ? 'below' : 'above'}${a.result === 'goal' ? ' goal' : ''}`;
      el.dataset.row = a.row;
      el.innerHTML = `<b>${esc(PEOPLE[a.pid].name)}</b> ${esc(a.clock)}`;
      chipsEl.appendChild(el);
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
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
  function panelHTML() {
    const m = S(),
      a = m.sel ? ATT[m.sel] : null;
    const rows = inv.bands.map(b => `<button type="button" class="lk-bandrow${m.band === b.id ? ' on' : ''}" data-band="${b.id}" aria-pressed="${m.band === b.id}">
        <span class="lk-sw ${b.id}" aria-hidden="true"></span><span class="lk-br-n"><b>${esc(b.label)}</b><small>${esc(b.range)}</small></span>
        <span class="lk-br-c"><b>${b.n}</b><small>attempts</small></span><span class="lk-br-c goals"><b>${b.goals}</b><small>${b.goals === 1 ? 'goal' : 'goals'}</small></span></button>`).join('');
    const inBand = m.band ? inv.attempts.filter(x => x.band === m.band) : inv.attempts.filter(x => x.result === 'goal');
    const idx = a ? inBand.findIndex(x => x.row === a.row) : -1;
    const model = a && a.xg != null ? `<div class="model"><dt>Chance quality <small>shot model</small></dt><dd>${a.xg.toFixed(3)} · ${ord(a.rank)} of ${inv.rated}</dd></div>` : '';
    const card = a ? `<article class="lk-attcard" aria-live="polite" data-row="${a.row}">
        <header><span class="lk-whoring" aria-hidden="true">${esc(PEOPLE[a.pid].no.replace('#', ''))}</span><span class="lk-attwho"><b>${cardName(a.pid)}</b><em>${esc(inv.team_label)} · ${esc(PEOPLE[a.pid].no)} · ${esc(a.per_label)} · ${esc(a.clock)}</em></span></header>
        <dl class="lk-attfacts"><div><dt>Result</dt><dd>${esc(a.word)}</dd></div><div><dt>Distance</dt><dd>${a.dist} m from the net</dd></div>${model}</dl>
        <div class="lk-attfoot">${a.moment ? `<button type="button" class="lk-watch" data-moment="${a.moment}">${ICON.play}<span>Watch it</span></button>` : `<span class="lk-novideo">Not in our video clips</span>`}
          ${idx >= 0 && inBand.length > 1 ? `<span class="lk-step"><button type="button" class="lk-stepb" data-d="-1" aria-label="Previous attempt">${ICON.back}</button><span>${idx + 1} of ${inBand.length}${m.band ? '' : ' goals'}</span><button type="button" class="lk-stepb" data-d="1" aria-label="Next attempt">${ICON.next}</button></span>` : ''}</div></article>` : `<p class="lk-maphint">Tap a band, a goal or any attempt on the rink to see it here.</p>`;
    if (RC3) {
      const ng = inv.attempts.filter(x => x.result === 'goal').length,
        open = !!m.bandsOpen;
      return `<div class="lk-map lk3-map"><p class="lk3-key" aria-hidden="true"><i class="g"></i>${ng} goals <i class="a"></i>${inv.total - ng} other attempts${m.sel ? ' <i class="s"></i>selected' : ''}</p>
        <div class="lk3-tools"><button type="button" class="lk3-bandsbtn" aria-expanded="${open}">${open ? 'Hide distances' : 'By distance'}</button><button type="button" class="lk-allbtn quiet" aria-pressed="${m.all}">${m.all ? 'Goals only' : `All ${inv.total} attempts`}</button></div>
        ${open ? `<div class="lk-bandrows" role="group" aria-label="${esc(inv.team_label)} attempts on ${esc(GN)} by distance">${rows}</div>` : ''}${a ? card : ''}</div>`;
    }
    return `<div class="lk-map"><div class="lk-bandrows" role="group" aria-label="Attempts on ${esc(GN)} by distance">${rows}</div>
      <div class="lk-maptools"><button type="button" class="lk-allbtn" aria-pressed="${m.all}">${m.all ? 'Show goals only' : `Show all ${inv.total} attempts`}</button>
        <span class="lk-legend2" aria-hidden="true"><i class="g"></i>goal <i class="a"></i>attempt <i class="v"></i>on video · ${inv.attempts.filter(x => x.result === 'goal' && x.moment).length} of ${inv.attempts.filter(x => x.result === 'goal').length} goals</span></div>${card}</div>`;
  }
  function renderPanel({
    focus = null,
    reveal = false
  } = {}) {
    panelEl.classList.toggle('lk-reveal-in', reveal && !reduced());
    setPanel(panelHTML());
    panelEl.querySelectorAll('.lk-bandrow').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        selectBand(b.dataset.band === S().band ? null : b.dataset.band, 'panel');
      };
      b.onpointerenter = () => {
        S().hover = b.dataset.band;
        layout();
      };
      b.onpointerleave = () => {
        S().hover = null;
        layout();
      };
      b.onfocus = () => {
        if (st.kbd) {
          S().hover = b.dataset.band;
          layout();
        }
      };
      b.onblur = () => {
        S().hover = null;
        layout();
      };
    });
    const bb = panelEl.querySelector('.lk3-bandsbtn');
    if (bb) bb.onclick = e => {
      e.stopPropagation();
      S().bandsOpen = !S().bandsOpen;
      log.log(S().bandsOpen ? 'detail_open' : 'detail_close', {
        kind: 'shots_sel_bands'
      });
      renderPanel({
        focus: '.lk3-bandsbtn'
      });
    };
    panelEl.querySelector('.lk-allbtn').onclick = e => {
      e.stopPropagation();
      S().all = !S().all;
      log.log('look_map', {
        inv: ID,
        action: 'all',
        on: S().all
      });
      renderPanel({
        focus: '.lk-allbtn'
      });
      layout();
    };
    panelEl.querySelectorAll('.lk-stepb').forEach(b => b.onclick = e => {
      e.stopPropagation();
      stepAttempt(+b.dataset.d);
    });
    const w = panelEl.querySelector('.lk-watch');
    if (w) w.onclick = e => {
      e.stopPropagation();
      log.log('look_map', {
        inv: ID,
        action: 'watch',
        row: S().sel,
        moment: w.dataset.moment
      });
      openReplay(ID, w.dataset.moment);
    };
    if (focus && st.kbd) panelEl.querySelector(focus)?.focus({
      preventScroll: false
    });
  }
  function selectBand(band, how) {
    const m = S();
    m.band = band;
    const list = band ? inv.attempts.filter(a => a.band === band) : [];
    m.sel = band ? (list.find(a => a.result === 'goal') || list[0])?.row ?? null : m.sel;
    log.log('look_map', {
      inv: ID,
      action: 'band',
      band,
      how,
      sel: m.sel
    });
    renderPanel({
      focus: band ? `.lk-bandrow[data-band="${band}"]` : null
    });
    layout();
  }
  function selectAttempt(row, how) {
    S().sel = row;
    log.log('look_map', {
      inv: ID,
      action: 'select',
      row,
      how,
      moment: ATT[row]?.moment || null
    });
    renderPanel();
    layout();
    if (how === 'rink' && innerWidth / innerHeight < 1) panelEl.querySelector('.lk-attcard')?.scrollIntoView({
      block: 'nearest',
      behavior: reduced() ? 'auto' : 'smooth'
    });
  }
  function stepAttempt(d) {
    const m = S(),
      list = m.band ? inv.attempts.filter(a => a.band === m.band) : inv.attempts.filter(a => a.result === 'goal');
    const i = list.findIndex(a => a.row === m.sel),
      n = list[(i + d + list.length) % list.length];
    m.sel = n.row;
    log.log('look_map', {
      inv: ID,
      action: 'step',
      d,
      row: n.row
    });
    renderPanel({
      focus: `.lk-stepb[data-d="${d}"]`
    });
    layout();
  }
  pickEl.addEventListener('click', e => {
    if (st.inv !== ID || !st.rinkKey?.startsWith('selmap:') || !S().pick) return;
    e.stopPropagation();
    const r = ice.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    let best = null,
      bd = 30;
    for (const row of visibleRows()) {
      const [px_, py] = m2px(...ATT[row].at),
        d = Math.hypot(px_ - x, py - y);
      if (d < bd) {
        bd = d;
        best = row;
      }
    }
    if (best) selectAttempt(best, 'rink');
  });
  function prep() {
    stage.video.pause();
    vw.classList.add('lk-novid');
    document.body.classList.add('lk-tall', 'lk-mapface');
    st.moments = [];
    bindRink(KEY, inv.rink_attack, {
      k: inv.rink_note,
      t: ''
    });
    ice.classList.add('lk-mapon');
    const V = view();
    setView(V);
    svg.setAttribute('viewBox', V.join(' '));
    placeCap();
  }
  function view() {
    const M_ = .6,
      us = inv.attempts.map(a => tr()(...a.at)[0]);
    const u0 = Math.min(-M_, Math.min(...us) - M_),
      u1 = Math.max(30 + M_, Math.max(...us) + M_);
    return [u0, MAPVIEW[1], u1 - u0, MAPVIEW[3]];
  }
  async function run(runId) {
    st.selmap = {
      band: null,
      sel: null,
      all: false,
      bandsOpen: false,
      revealed: false,
      pick: false,
      hover: null
    };
    await clearBand();
    alive(runId);
    stage.lightOff(0);
    await iceOn(true, {
      ms: 0
    });
    prep();
    layout();
    ice.setAttribute('aria-hidden', 'false');
    document.body.dataset.beat = `look_${ID}_predict`;
    await head(inv.intro.head, inv.intro.sub, inv.category);
    alive(runId);
    log.log('look_step', {
      inv: ID,
      step: 'predict'
    });
    const p = inv.predict,
      shown = performance.now(),
      opts = [...p.options, ['not_sure', 'Not sure', '']];
    cap.actEl.innerHTML = `<div class="lk-acts lk-pred lk-pred4" role="group" aria-label="Your guess">${opts.map(([c, l, r]) => `<button type="button" class="lk-act pick${c === 'not_sure' ? ' unsure' : ''}" data-c="${c}"><span>${esc(l)}</span>${r ? `<small>${esc(r)}</small>` : ''}</button>`).join('')}</div>`;
    cap.actEl.querySelectorAll('button').forEach(b => {
      const hi = on => () => {
        S().hover = on && b.dataset.c !== 'not_sure' ? b.dataset.c : null;
        layout();
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
      if (runId !== st.run) return;
      cap.actEl.querySelectorAll('button').forEach(x => {
        x.disabled = x !== b;
      });
      b.setAttribute('aria-pressed', 'true');
      res(b.dataset.c);
    }));
    alive(runId);
    S().hover = null;
    st.predicted[p.id] = ans;
    log.log('look_predict', {
      inv: ID,
      q: p.id,
      answer: ans,
      latency_ms: Math.round(performance.now() - shown)
    });
    await sleep(reduced() ? 100 : 350);
    alive(runId);
    await clearBand();
    alive(runId);
    Object.assign(S(), {
      band: null,
      sel: null,
      all: !!RC3,
      bandsOpen: false,
      revealed: true
    });
    const done = found(runId, inv);
    k.popGoals?.();
    return done;
  }
  async function found(runId, _inv, {
    instant = false
  } = {}) {
    if (instant) {
      await clearBand();
      alive(runId);
      stage.lightOff(0);
      await iceOn(true, {
        ms: 0
      });
      S().revealed = true;
      prep();
      ice.setAttribute('aria-hidden', 'false');
    }
    if (S().sel == null && !S().band) S().sel = inv.highlight?.row ?? null;
    S().pick = true;
    pickEl.hidden = false;
    renderPanel();
    layout();
    foundEntry(ID);
    document.body.dataset.beat = `look_${ID}_found`;
    const a = st.predicted[inv.predict.id];
    const ack = a ? inv.ack[a] : '';
    return showFound(runId, inv, ack);
  }
  function hero() {
    const g = inv.attempts.filter(a => a.result === 'goal'),
      b = Object.fromEntries(inv.bands.map(x => [x.id, x])),
      sel = S().sel && ATT[S().sel];
    const allClose = g.length && g.every(x => x.band === 'close');
    const where = `The ${g.length} goals came from ${Math.min(...g.map(x => x.dist))} to ${Math.max(...g.map(x => x.dist))} m.`;
    if (sel && sel.result === 'goal' && sel.row === inv.highlight?.row) return {
      v: `${sel.dist}`,
      u: 'm',
      k: `${PEOPLE[sel.pid].name}’s goal · ${sel.per_label.replace(' period', '')} ${sel.clock} · one of ${g.length} goals on ${GN}`,
      ctx: `${where} ${allClose ? `None from beyond 5 m in ${inv.total} ${inv.team_label} attempts.` : `${inv.total} ${inv.team_label} attempts on ${GN} in all.`}`
    };
    return {
      v: `${b.close.goals} of ${b.close.n}`,
      u: '',
      k: 'close-in attempts (within 5 m) went in',
      ctx: `${where} ${inv.total} ${inv.team_label} attempts on ${GN} in all.`
    };
  }
  return {
    id: ID,
    run,
    found,
    layout,
    hero,
    state: () => ({
      ...S(),
      marks: [...svg.querySelectorAll('.lk-att')].map(g => +g.dataset.row),
      view: getView()?.slice() || null
    })
  };
}
