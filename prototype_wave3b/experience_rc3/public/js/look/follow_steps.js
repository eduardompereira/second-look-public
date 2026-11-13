const PAUSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5h3v11H6zM11 4.5h3v11h-3z" fill="currentColor"/></svg>';
const AGAIN = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4a6 6 0 1 1-5.6 3.9l1.8.7A4.1 4.1 0 1 0 10 5.9V8L6.5 5 10 2z" fill="currentColor"/></svg>';
const HOLD_MS = 1800,
  SVGNS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function followSteps({
  P,
  st,
  ICON,
  esc,
  log,
  panelEl,
  setPanel,
  chancesHTML,
  alive,
  held = () => []
}) {
  if (!document.querySelector('link[data-follow-steps]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/css/follow_steps.css';
    css.dataset.followSteps = '1';
    document.head.insertBefore(css, document.querySelector('link[href="/css/b1.css"]'));
  }
  const R = P.rink,
    PAS = P.passes,
    MOM = P.moments,
    PEOPLE = P.people;
  const BOARD = {
    w: 30,
    top: -15,
    bottom: 15
  };
  let panes = null,
    marker = null,
    observer = null,
    current = null,
    onKey = null,
    lastOpen = null;
  let guess = {
    i: null,
    answer: null,
    el: null
  };
  const portrait = () => matchMedia('(max-aspect-ratio: 1 / 1)').matches;
  const players = new Map();
  function geom(inv, i) {
    const l = inv.links[i],
      p = PAS[l.pass_],
      mo = MOM[l.moment],
      s = mo.attack === 'left' ? -1 : 1;
    const T = s < 0 ? (x, y) => [x, -y] : (x, y) => [-x, y];
    return {
      l,
      p,
      mo,
      s,
      T,
      u0: s > 0 ? 0 : -BOARD.w,
      a: T(...p.start),
      b: T(...p.end),
      sh: T(...p.shot.at),
      n: T(-R.goal_x, 0)
    };
  }
  function rinkSVG(inv, i) {
    const {
      p,
      mo,
      s,
      T,
      u0,
      a,
      b,
      sh,
      n
    } = geom(inv, i);
    const g = s * R.goal_x,
      bl = s * R.blue_x,
      cr = s * 21.5,
      ce = s * 30,
      sw = s > 0 ? 1 : 0;
    const lines = `<path class="boards" d="M0,-15 H${cr} A8.5,8.5 0 0 ${sw} ${ce},-6.5 V6.5 A8.5,8.5 0 0 ${sw} ${cr},15 H0 Z"/>
      <line class="red" x1="0" y1="-15" x2="0" y2="15"/><line class="blue" x1="${bl}" y1="-15" x2="${bl}" y2="15"/><line class="red thin" x1="${g}" y1="-14.2" x2="${g}" y2="14.2"/>
      ${R.dots.map(([x, y]) => `<circle class="fo" cx="${s * x}" cy="${y}" r="4.5"/><circle class="dot" cx="${s * x}" cy="${y}" r=".35"/>`).join('')}
      <path class="crease" d="M${g},-1.8 A1.8,1.8 0 0 ${s > 0 ? 0 : 1} ${g},1.8 Z"/><rect class="net" x="${s > 0 ? g : g - 1.1}" y="-.915" width="1.1" height="1.83"/>`;
    const dots = mo.players.filter(q => q.pid !== p.passer && q.pid !== p.receiver && !(q.goalie && PEOPLE[q.pid]?.team !== 'selects')).map(q => {
      const [u, v] = T(q.x, q.y);
      if (u < u0 || u > u0 + BOARD.w || v < BOARD.top || v > BOARD.bottom) return '';
      return PEOPLE[q.pid]?.team === 'davos' ? `<circle class="fs-dot davos" cx="${u}" cy="${v}" r=".5"/>` : `<rect class="fs-dot selects" x="${u - .45}" y="${v - .45}" width=".9" height=".9" rx=".15"/>`;
    }).join('');
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      ux = (b[0] - a[0]) / len,
      uy = (b[1] - a[1]) / len;
    const arrow = `${b[0]},${b[1]} ${b[0] - 1.5 * ux - .8 * uy},${b[1] - 1.5 * uy + .8 * ux} ${b[0] - 1.5 * ux + .8 * uy},${b[1] - 1.5 * uy - .8 * ux}`;
    const puck = reduced() ? '' : `<circle class="fs-puck" r=".5"><animateMotion dur="1.8s" repeatCount="indefinite" path="M${a[0]},${a[1]} L${b[0]},${b[1]}"/></circle>`;
    return `<svg class="rink" viewBox="${u0 - .2} ${BOARD.top - .2} ${BOARD.w + .4} ${BOARD.bottom - BOARD.top + .4}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${lines}${dots}
      <polyline class="fs-grey" points="${b[0]},${b[1]} ${sh[0]},${sh[1]} ${n[0]},${n[1]}" vector-effect="non-scaling-stroke"/><circle class="fs-shotpt" cx="${sh[0]}" cy="${sh[1]}" r=".45"/>
      <g class="fs-passgroup"><line class="passline" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" vector-effect="non-scaling-stroke"/><polygon class="fs-head" points="${arrow}"/>${puck}</g>
      <circle class="passstart" cx="${a[0]}" cy="${a[1]}" r=".5"/><circle class="fs-recv" cx="${b[0]}" cy="${b[1]}" r=".5"/></svg>`;
  }
  function paneHTML(inv, i) {
    const c = inv.chances[i],
      p = PAS[inv.links[i].pass_],
      rp = PEOPLE[p.receiver];
    return `<p class="fs-when"><i class="lk-cn" aria-hidden="true">${c.n}</i>${esc(c.per)} · ${esc(c.clock)}</p><div class="fs-ice" data-ice="${i}" aria-label="Chance ${c.n} on the rink">${rinkSVG(inv, i)}<svg class="fs-leads" aria-hidden="true"></svg>
        <button type="button" class="lk-chip lk-tok davos ask" style="opacity:1" aria-label="Reveal the last Harbour pass before chance ${c.n}"><span class="ring"><b>?</b></span><span class="nm"><span></span></span></button>
        <div class="lk-chip davos fs-rcv" style="opacity:1"><span class="ring"><b>${esc(rp.no.replace('#', ''))}</b></span><span class="nm">${esc(rp.name)}</span></div></div>`;
  }
  function layout(pane, inv, i) {
    const ice = pane.querySelector('.fs-ice'),
      rink = ice.querySelector('.rink'),
      W = ice.clientWidth,
      H = ice.clientHeight;
    if (!W || !H) return;
    const {
        u0,
        a,
        b
      } = geom(inv, i),
      box = rink.getBoundingClientRect(),
      org = ice.getBoundingClientRect(),
      vb = rink.viewBox.baseVal;
    const sc = Math.min(box.width / vb.width, box.height / vb.height),
      ox = box.left - org.left + (box.width - vb.width * sc) / 2,
      oy = box.top - org.top + (box.height - vb.height * sc) / 2;
    const px = ([u, v]) => [ox + (u - vb.x) * sc, oy + (v - vb.y) * sc];
    const compact = W < 260;
    const edges = {
        left: ox,
        right: ox + vb.width * sc,
        top: oy,
        bottom: oy + vb.height * sc
      },
      out = compact ? 24 : 30;
    const out_ = ([x, y]) => {
      const d = compact ? {
          top: y - edges.top,
          bottom: edges.bottom - y
        } : {
          top: y - edges.top,
          bottom: edges.bottom - y,
          left: x - edges.left,
          right: edges.right - x
        },
        side = Object.keys(d).sort((p, q) => d[p] - d[q])[0];
      return {
        side,
        x: side === 'left' ? edges.left - out : side === 'right' ? edges.right + out : x,
        y: side === 'top' ? edges.top - out : side === 'bottom' ? edges.bottom + out : y
      };
    };
    const [pa, pb] = [px(a), px(b)],
      A = out_(pa),
      B = out_(pb),
      minGap = compact ? 64 : 96;
    if (A.side === B.side) {
      const k = A.side === 'top' || A.side === 'bottom' ? 'x' : 'y',
        sign = A[k] <= B[k] ? 1 : -1,
        miss = minGap - Math.abs(A[k] - B[k]);
      if (miss > 0) {
        A[k] -= sign * miss / 2;
        B[k] += sign * miss / 2;
      }
    }
    const m = compact ? 20 : 24,
      clamp = c => {
        c.x = Math.max(m, Math.min(W - m, c.x));
        c.y = Math.max(m, Math.min(H - m, c.y));
      };
    clamp(A);
    clamp(B);
    const tok = ice.querySelector('.lk-tok'),
      rcv = ice.querySelector('.fs-rcv');
    tok.style.transform = `translate(${A.x}px, ${A.y}px)`;
    rcv.style.transform = `translate(${B.x}px, ${B.y}px)`;
    tok.dataset.side = A.side;
    rcv.dataset.side = B.side;
    const leads = ice.querySelector('.fs-leads');
    leads.setAttribute('viewBox', `0 0 ${W} ${H}`);
    leads.innerHTML = [[pa, A], [pb, B]].map(([p, c]) => `<line x1="${p[0]}" y1="${p[1]}" x2="${c.x}" y2="${c.y}"/>`).join('');
  }
  function mount(inv) {
    if (panes) return;
    const vw = document.querySelector('.vwrap');
    marker = document.createComment('follow-steps');
    panelEl.before(marker);
    vw.before(panelEl);
    panes = document.createElement('div');
    panes.className = 'fs-panes';
    const pp = PEOPLE[PAS[inv.links[0].pass_].passer];
    const why = (P.founds[inv.found]?.why_it_matters || '').split(/(?<=[.!?])\s/)[0];
    panes.innerHTML = inv.links.map((_, i) => `<section class="fs-pane" data-i="${i}">${paneHTML(inv, i)}<button type="button" class="fs-close" aria-label="Close the video">×</button></section>`).join('') + `<svg class="fs-same-lines" aria-hidden="true"><path/><path/></svg><p class="fs-same"><span class="fs-same-k">Same player</span><span class="fs-same-who">${esc(pp.full)} <b>${esc(pp.no)}</b></span><span class="fs-same-guess" hidden></span></p><p class="fs-tap">Tap a rink to watch the moment again</p>
        <div class="fs-key"><p><i class="ci" aria-hidden="true"></i>Harbour <i class="sq" aria-hidden="true"></i>Ridge at the shot · <i class="yl" aria-hidden="true"></i>last Harbour pass · <i class="gr" aria-hidden="true"></i>straight lines to the shot, not his path</p></div>`;
    panelEl.after(panes);
    current = inv;
    panes.querySelectorAll('.fs-pane').forEach(pane => {
      const {
        u0,
        a,
        b
      } = geom(inv, +pane.dataset.i);
      const sideOf = ([u, v]) => {
        const d = {
          top: v - BOARD.top,
          bottom: BOARD.bottom - v,
          left: u - u0,
          right: u0 + BOARD.w - u
        };
        return Object.keys(d).sort((p, q) => d[p] - d[q])[0];
      };
      const sides = [sideOf(a), sideOf(b)];
      pane.classList.toggle('no-top', !sides.includes('top'));
      pane.classList.toggle('no-bottom', !sides.includes('bottom'));
    });
    document.body.classList.add('fs-open');
    const all = () => {
      if (!panes) return;
      placeGuess();
      panes.querySelectorAll('.fs-pane').forEach(pane => layout(pane, inv, +pane.dataset.i));
      if (panes.classList.contains('final')) {
        drawSame();
        tapTargets();
      }
    };
    panes.fsLayout = all;
    observer = new ResizeObserver(all);
    observer.observe(panes);
    panes.querySelectorAll('.lk-tok').forEach((tok, i) => {
      tok.onclick = e => {
        e.stopPropagation();
        if (guess.el && guess.i === i) {
          guess.el.scrollIntoView({
            block: 'nearest',
            behavior: reduced() ? 'auto' : 'smooth'
          });
          guess.el.querySelector('button').focus({
            preventScroll: true
          });
          return;
        }
        panelEl.querySelector(`.lk-reveal[data-i="${i}"]`)?.click();
      };
    });
    panes.querySelectorAll('.fs-pane').forEach(pane => {
      const i = +pane.dataset.i,
        ice = pane.querySelector('.fs-ice');
      const tap = e => {
        if (!panes.classList.contains('final') || !portrait()) return;
        e.stopPropagation();
        e.preventDefault();
        openFull(pane, i);
      };
      ice.addEventListener('click', tap);
      ice.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') tap(e);
      });
      pane.querySelector('.fs-close').onclick = e => {
        e.stopPropagation();
        closeFull();
      };
    });
    all();
  }
  function placeGuess() {
    if (!guess.el) return;
    const target = portrait() ? panes.querySelector(`.fs-pane[data-i="${guess.i}"] .fs-when`) : null,
      slot = panelEl.querySelector(`.lk-chance[data-i="${guess.i}"] .lk-cslot`);
    if (target && target.nextElementSibling !== guess.el) target.after(guess.el);else if (!target && slot && guess.el.parentElement !== slot) slot.appendChild(guess.el);
  }
  function askGuess(inv, i) {
    const reveal = panelEl.querySelector(`.lk-reveal[data-i="${i}"]`);
    if (reveal) reveal.style.display = 'none';
    const slot = panelEl.querySelector(`.lk-chance[data-i="${i}"] .lk-cslot`);
    slot?.insertAdjacentHTML('beforeend', '<span class="fs-guess-note">Make your guess below</span>');
    const el = document.createElement('div');
    el.className = 'fs-guess';
    el.innerHTML = `<p>Same player again, or someone else?</p><div><button type="button" data-a="same">Same player</button><button type="button" data-a="other">Someone else</button></div>`;
    guess = {
      i,
      answer: null,
      el
    };
    el.querySelectorAll('button').forEach(b => {
      b.onclick = async e => {
        e.stopPropagation();
        guess.answer = b.dataset.a;
        guess.el = null;
        el.remove();
        log.log('look_predict', {
          inv: inv.id,
          q: 'steps_second',
          answer: b.dataset.a,
          variant: 'steps'
        });
        for (let n = 0; n < 100 && panes && !players.has(i); n++) {
          panelEl.querySelector(`.lk-reveal[data-i="${i}"]`)?.click();
          await sleep(80);
        }
      };
    });
    placeGuess();
  }
  function drawSame() {
    const inv = current,
      badge = panes.querySelector('.fs-same'),
      lines = panes.querySelectorAll('.fs-same-lines path'),
      box = panes.getBoundingClientRect(),
      tall = portrait();
    const R_ = el => {
      const r = el.getBoundingClientRect();
      return {
        l: r.left - box.left,
        r: r.right - box.left,
        t: r.top - box.top,
        b: r.bottom - box.top,
        cx: (r.left + r.right) / 2 - box.left,
        cy: (r.top + r.bottom) / 2 - box.top
      };
    };
    const svg = panes.querySelector('.fs-same-lines');
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const iceA = R_(panes.querySelector('.fs-pane[data-i="0"] .fs-ice')),
      iceB = R_(panes.querySelector('.fs-pane[data-i="1"] .fs-ice'));
    if (tall) {
      badge.style.left = '';
      badge.style.top = '';
    } else {
      badge.style.left = `${(iceA.r + iceB.l) / 2}px`;
      badge.style.top = `${(iceA.cy + iceB.cy) / 2}px`;
    }
    const bd = R_(badge),
      midX = bd.cx;
    if (tall) {
      const up = R_(panes.querySelector('.fs-pane[data-i="0"] .boards')),
        down = R_(panes.querySelector('.fs-pane[data-i="1"] .boards'));
      lines[0].setAttribute('d', `M${midX.toFixed(1)},${up.b.toFixed(1)} L${midX.toFixed(1)},${bd.t.toFixed(1)}`);
      lines[1].setAttribute('d', `M${midX.toFixed(1)},${down.t.toFixed(1)} L${midX.toFixed(1)},${bd.b.toFixed(1)}`);
      lines.forEach(l => l.setAttribute('pathLength', '1'));
      return;
    }
    inv.links.forEach((_, i) => {
      const tok = panes.querySelector(`.fs-pane[data-i="${i}"] .lk-tok`),
        r = R_(tok.querySelector('.ring')),
        side = tok.dataset.side,
        ice = i ? iceB : iceA;
      const pts = [];
      if (side === 'top') pts.push([r.cx, r.t - 24]);else if (side === 'bottom') pts.push([r.cx, r.b + 24]);else {
        const toward = i === 0 ? side === 'right' : side === 'left';
        if (toward) pts.push([side === 'left' ? r.l : r.r, r.cy]);else {
          pts.push([r.cx, r.t - 24]);
          pts[0][1] = Math.min(pts[0][1], ice.t);
        }
      }
      const y = pts[0][1];
      pts.push([midX, y], [midX, y < bd.cy ? bd.t : bd.b]);
      lines[i].setAttribute('d', `M${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L')}`);
      lines[i].setAttribute('pathLength', '1');
    });
  }
  function tapTargets() {
    const on = portrait();
    panes.querySelectorAll('.fs-ice').forEach((ice, i) => {
      if (on) {
        ice.setAttribute('role', 'button');
        ice.tabIndex = 0;
        ice.setAttribute('aria-label', `Watch chance ${current.chances[i].n} again, full screen`);
      } else {
        ice.removeAttribute('role');
        ice.removeAttribute('tabindex');
        ice.setAttribute('aria-label', `Chance ${current.chances[i].n} on the rink`);
      }
    });
  }
  async function enterFinal(animate) {
    if (panes.classList.contains('final')) return;
    const inv = current,
      same = new Set(inv.links.map(l => PAS[l.pass_].passer)).size === 1;
    panes.classList.add('final');
    panes.classList.toggle('same', same);
    const said = panes.querySelector('.fs-same-guess');
    if (guess.answer && said) {
      said.hidden = false;
      said.textContent = guess.answer === 'same' ? 'You said: same player.' : 'You said: someone else.';
    }
    if (portrait()) players.forEach(o => o.pause());
    panes.fsLayout();
    if (!same) return;
    if (!animate || reduced()) {
      panes.classList.add('drawn', 'told');
      return;
    }
    panes.scrollIntoView({
      block: 'start',
      behavior: 'smooth'
    });
    await sleep(350);
    if (!panes) return;
    panes.fsLayout();
    panes.classList.add('draw');
    await sleep(900);
    if (!panes) return;
    panes.classList.add('drawn', 'told');
    await sleep(900);
  }
  function openFull(pane, i) {
    if (players.get(i)?.held) return;
    closeFull();
    pane.classList.add('full');
    document.body.classList.add('fs-fullon');
    log.log('look_step', {
      inv: current.id,
      step: 'steps_full',
      variant: 'steps',
      chance: current.chances[i].n
    });
    onKey = e => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeFull();
      }
    };
    addEventListener('keydown', onKey, true);
    pane.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    players.get(i)?.play();
    pane.querySelector('.fs-close').focus({
      preventScroll: true
    });
  }
  function closeFull() {
    const pane = panes?.querySelector('.fs-pane.full');
    if (!pane) return;
    players.get(+pane.dataset.i)?.halt();
    pane.classList.remove('full');
    document.body.classList.remove('fs-fullon');
    if (onKey) {
      removeEventListener('keydown', onKey, true);
      onKey = null;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    pane.querySelector('.fs-ice').focus?.({
      preventScroll: true
    });
  }
  addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && panes?.querySelector('.fs-pane.full')) closeFull();
  });
  function player(pane, inv, i) {
    const p = PAS[inv.links[i].pass_],
      mo = MOM[inv.links[i].moment],
      v = pane.querySelector('video'),
      btn = pane.querySelector('.fs-play'),
      note = pane.querySelector('.fs-state');
    const dim = pane.querySelector('.fs-dim'),
      tag = pane.querySelector('.fs-tag');
    const S = {
      state: 'loading',
      paused: false,
      holding: false,
      token: 0
    };
    const draw = () => {
      const [icon, text] = S.state === 'playing' ? S.paused ? [ICON.play, 'Resume'] : [PAUSE, 'Pause'] : S.state === 'ended' ? [AGAIN, 'Watch again'] : [ICON.play, 'Play'];
      btn.innerHTML = `<i aria-hidden="true">${icon}</i><span>${text}</span>`;
      btn.disabled = S.state === 'loading' || S.state === 'error';
      note.textContent = S.state === 'cued' ? 'Frozen on the pass' : S.state === 'error' ? 'Video not available' : '';
    };
    const marks = on => {
      dim.hidden = !on;
      tag.hidden = !on;
    };
    const L = p.light;
    dim.style.background = `radial-gradient(ellipse ${L.rx / 19.2}% ${L.ry / 10.8}% at ${L.cx / 19.2}% ${L.cy / 10.8}%, transparent 72%, rgba(4,6,10,.58) 100%)`;
    tag.textContent = PEOPLE[p.passer].label;
    tag.style.left = `${p.tag_px[0] / 19.2}%`;
    tag.style.top = `${p.tag_px[1] / 10.8}%`;
    tag.style.transform = `translateX(${p.tag_px[0] < 320 ? 0 : p.tag_px[0] > 1600 ? -100 : -50}%)`;
    const seek = t => new Promise(res => {
      if (Math.abs(v.currentTime - t) < .002 && v.readyState >= 2) return res();
      v.addEventListener('seeked', res, {
        once: true
      });
      v.currentTime = t;
    });
    v.addEventListener('playing', () => {
      if (S.paused || S.state !== 'playing') v.pause();
    });
    const start = () => v.play().catch(() => {
      v.muted = true;
      return v.play().catch(() => {});
    });
    const runTo = (to, stale) => new Promise(res => {
      start();
      const step = () => {
        if (stale()) return res();
        if (v.currentTime >= to - .02 || v.ended) {
          v.pause();
          return res();
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    S.play = async () => {
      const tok = ++S.token,
        stale = () => tok !== S.token;
      players.forEach((o, k) => {
        if (k !== i) o.pause();
      });
      marks(false);
      S.state = 'playing';
      S.paused = false;
      S.holding = false;
      draw();
      log.log('look_step', {
        inv: inv.id,
        step: 'steps_play',
        variant: 'steps',
        moment: mo.id
      });
      await seek(mo.window[0]);
      if (stale()) return;
      await runTo(p.t, stale);
      if (stale()) return;
      await seek(p.t);
      if (stale()) return;
      marks(true);
      S.holding = true;
      for (let left = HOLD_MS; left > 0;) {
        await sleep(100);
        if (stale()) return;
        if (!S.paused) left -= 100;
      }
      S.holding = false;
      marks(false);
      await runTo(mo.window[1], stale);
      if (stale()) return;
      await seek(mo.window[1]);
      if (stale()) return;
      S.state = 'ended';
      draw();
    };
    S.pause = () => {
      if (S.state === 'playing' && !S.paused) {
        S.paused = true;
        v.pause();
        draw();
      }
    };
    S.halt = () => {
      S.token++;
      v.pause();
      marks(false);
      S.state = 'ended';
      S.paused = false;
      S.holding = false;
      draw();
    };
    S.stop = () => {
      S.token++;
      v.pause();
      v.removeAttribute('src');
      v.innerHTML = '';
      v.load();
    };
    btn.onclick = e => {
      e.stopPropagation();
      if (S.state !== 'playing') return void S.play();
      if (S.paused) {
        S.paused = false;
        if (!S.holding) start();
        draw();
        log.log('look_step', {
          inv: inv.id,
          step: 'steps_resume',
          variant: 'steps'
        });
      } else {
        S.pause();
        log.log('look_step', {
          inv: inv.id,
          step: 'steps_pause',
          variant: 'steps'
        });
      }
    };
    draw();
    v.addEventListener('error', () => {
      S.state = 'error';
      draw();
    }, true);
    v.addEventListener('loadeddata', async () => {
      if (S.state !== 'loading') return;
      await seek(p.t);
      if (S.state !== 'loading') return;
      S.state = 'cued';
      marks(true);
      draw();
    }, {
      once: true
    });
    v.innerHTML = `<source src="/media/${mo.clip}.mp4" type="video/mp4"><source src="/media/${mo.clip}.webm" type="video/webm">`;
    v.load();
    return S;
  }
  function openPane(inv, i, {
    animate = true
  } = {}) {
    if (players.has(i)) return;
    const pane = panes.querySelector(`.fs-pane[data-i="${i}"]`),
      tok = pane.querySelector('.lk-tok'),
      pp = PEOPLE[PAS[inv.links[i].pass_].passer];
    tok.classList.remove('ask');
    tok.classList.add('open');
    if (animate) tok.classList.add('flip');
    tok.onclick = null;
    tok.disabled = true;
    tok.querySelector('b').textContent = pp.no.replace('#', '');
    tok.querySelector('.nm > span').textContent = pp.name;
    tok.setAttribute('aria-label', `Chance ${inv.chances[i].n}: last Harbour pass by ${pp.full}, ${pp.no}`);
    pane.classList.add('open');
    if (held(inv).includes(inv.links[i].moment)) {
      pane.insertAdjacentHTML('beforeend', '<p class="fs-held">You’ll watch this chance in Story 2.</p>');
      players.set(i, {
        held: true,
        play() {},
        pause() {},
        halt() {},
        stop() {}
      });
      log.log('look_step', {
        inv: inv.id,
        step: 'steps_video_held',
        chance: inv.chances[i].n
      });
    } else {
      pane.insertAdjacentHTML('beforeend', `<div class="fs-video"><video playsinline webkit-playsinline preload="auto"></video><div class="fs-dim" hidden></div><div class="fs-tag" hidden></div></div>
      <div class="fs-ctl"><button type="button" class="fs-play"></button><span class="fs-state"></span></div>`);
      players.set(i, player(pane, inv, i));
    }
    layout(pane, inv, i);
  }
  return {
    intro(inv) {
      mount(inv);
    },
    open(inv, i) {
      if (!panes) mount(inv);
      openPane(inv, i);
      lastOpen = i;
      panes.classList.add('stacked');
      const other = inv.links.findIndex((_, k) => !players.has(k));
      if (other >= 0) askGuess(inv, other);
      panes.fsLayout();
      requestAnimationFrame(() => {
        if (!panes) return;
        panes.fsLayout();
        const behavior = reduced() ? 'auto' : 'smooth',
          pane = panes.querySelector(`.fs-pane[data-i="${i}"]`);
        if (portrait()) pane.scrollIntoView({
          block: 'start',
          behavior
        });else pane.querySelector('.fs-ctl').scrollIntoView({
          block: 'nearest',
          behavior
        });
      });
    },
    async finish(run) {
      await sleep(reduced() ? 150 : 700);
      alive(run);
      if (portrait()) {
        const ctl = panes.querySelector(`.fs-pane[data-i="${lastOpen}"] .fs-ctl`) || panes.querySelector(`.fs-pane[data-i="${lastOpen}"] .fs-held`) || panes.querySelector(`.fs-pane[data-i="${lastOpen}"]`).lastElementChild;
        ctl.insertAdjacentHTML('afterend', '<button type="button" class="fs-next">See the finding</button>');
        const next = ctl.nextElementSibling;
        next.scrollIntoView({
          block: 'nearest',
          behavior: reduced() ? 'auto' : 'smooth'
        });
        await new Promise(res => {
          next.onclick = e => {
            e.stopPropagation();
            res();
          };
        });
        alive(run);
        next.remove();
      }
      await enterFinal(true);
      alive(run);
    },
    rinks(inv) {
      if (!panes) mount(inv);
      inv.links.forEach((_, i) => openPane(inv, i, {
        animate: false
      }));
      st.moments = inv.moments.slice();
      setPanel(chancesHTML(inv, inv.links.map((_, i) => i)));
      enterFinal(false);
    },
    off() {
      closeFull();
      players.forEach(o => o.stop());
      players.clear();
      observer?.disconnect();
      observer = null;
      if (marker) {
        marker.replaceWith(panelEl);
        marker = null;
      }
      guess = {
        i: null,
        answer: null,
        el: null
      };
      lastOpen = null;
      panes?.remove();
      panes = null;
      current = null;
      document.body.classList.remove('fs-open');
    }
  };
}
