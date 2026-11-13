import { Logger } from './engine/log.js';
import { VideoStage } from './engine/stage.js';
import { StoryRunner } from './engine/runner.js';
import { Captions, Chapters, nl2br } from './engine/ui.js';
import { STORY_A, STORY_A2, CHAPTERS, CHAPTERS_A2, handlers } from './stories/second_look.js';
import { STORY_2, STORY_GP09_COLD, CHAPTERS_2, CHAPTERS_COLD, handlers2 } from './stories/pass_across.js';
import { STORY_W1, STORY_W1_RC2, STORY_W1_FROM_BRIDGE, STORY_W1_STOP_RETURN, STORY_W1_CARRY_RETURN, CHAPTERS_W1, handlersW1 } from './stories/w3c_story1.js';
import { STORY_W2, STORY_W2_CARRY_RETURN, CHAPTERS_W2, handlersW2 } from './stories/w3c_story2.js';
import { studyBoot, studyNotice, StudyDelivery, studyFeedback, studyEndCard } from './study.js';
const STUDY = await studyBoot();
if (STUDY?.blocked) await new Promise(() => {});
const q = STUDY ? (() => {
  const u = new URLSearchParams(location.search),
    f = STUDY.flags,
    o = new URLSearchParams({
      mode: 'wave3c'
    });
  if (f.rc2) o.set('rc2', '1');
  o.set('hk', f.hk);
  if (f.rc2) o.set('dur', '0');
  if (f.s2) o.set('s2', '1');
  o.set('p', STUDY.participant);
  o.set('cat', STUDY.cohort);
  if (u.get('back') === '1') o.set('back', '1');
  if (u.get('fs') === '0') o.set('fs', '0');
  return o;
})() : new URLSearchParams(location.search);
const MODES = ['journey', 'a1', 'a2', 'gp09cold', 'demo', 'wave3c'];
const MODE = MODES.includes(q.get('mode')) ? q.get('mode') : 'demo';
const W3C = MODE === 'wave3c' || MODE === 'demo';
const JOURNEY = MODE === 'journey';
const LOOK = W3C && q.get('look') !== '0';
const LOOK_TR = ['flatten', 'cut'].includes(q.get('tr')) ? q.get('tr') : 'cut';
const RC3 = W3C && !STUDY && q.get('rc3') !== '0';
const PTS = RC3 && q.get('pts') === '1';
const RC2 = W3C && (q.get('rc2') === '1' || RC3);
const HK = W3C && ['A', 'B', 'C'].includes(q.get('hk')) ? q.get('hk') : RC3 ? 'B' : null;
const DUR = RC2 && !RC3 && q.get('dur') !== '0';
const S2ONLY = RC2 && q.get('s2') === '1';
const D = await (await fetch('/data/second_look.json')).json();
const D2 = JOURNEY || W3C || MODE === 'gp09cold' ? await (await fetch('/data/story2.json')).json() : null;
const X = W3C ? await (await fetch('/data/w3c_context.json')).json() : null;
if (W3C) document.body.classList.add('w3c');
const HOOK = ['H1', 'H2', 'H3'].includes(q.get('hook')) ? q.get('hook') : D.hooks.default;
const log = new Logger({
  mode: MODE,
  participant: q.get('p') || (MODE === 'demo' ? 'demo' : 'anon'),
  category: q.get('cat') || '',
  hook: MODE === 'a2' || MODE === 'gp09cold' ? null : HOOK,
  viewport: `${innerWidth}x${innerHeight}`,
  ua: navigator.userAgent.replace(/\s+/g, ' ').slice(0, 160),
  build: W3C ? 'w3c' : JOURNEY || MODE === 'gp09cold' ? 'w3b3' : 'v2',
  entry: W3C ? S2ONLY ? 'prompted_s2' : q.get('src') === 'teaser' ? 'teaser' : 'score_page' : undefined,
  ...(RC3 ? {
    variant: `rc3_hk${HK}`,
    build: 'rc3'
  } : RC2 || HK ? {
    variant: `${RC2 ? 'rc2' : 'w3e51'}${HK ? `_hk${HK}` : ''}`
  } : {})
}, STUDY ? {
  sink: new StudyDelivery(STUDY),
  session: STUDY.session
} : {});
if (STUDY) {
  log.log('study_page', {
    page: STUDY.page,
    group: STUDY.group,
    entry: STUDY.entry,
    back: q.get('back') === '1'
  });
  addEventListener('error', e => log.log('error', {
    message: String(e.message || '').slice(0, 300),
    where: 'window',
    src: String(e.filename || '').split('/').pop()
  }));
  addEventListener('unhandledrejection', e => log.log('error', {
    message: String(e.reason?.message || e.reason || '').slice(0, 300),
    where: 'promise'
  }));
  document.addEventListener('visibilitychange', () => log.log(document.visibilityState === 'hidden' ? 'page_hidden' : 'page_visible', {
    beat: document.body.dataset.beat || ''
  }));
  addEventListener('pagehide', () => log.log('page_hide', {
    beat: document.body.dataset.beat || ''
  }), {
    capture: true
  });
}
const app = document.getElementById('app');
const KEEP = STUDY ? `&t=${encodeURIComponent(STUDY.token)}` : RC3 ? `${q.get('hk') ? `&hk=${HK}` : ''}${q.get('fs') === '0' ? '&fs=0' : ''}${q.get('clarity') === '0' ? '&clarity=0' : ''}${PTS ? '&pts=1' : ''}${['follow', 'selects_map', 'cards', 'e1'].filter(k => q.get(k)).map(k => `&${k}=${encodeURIComponent(q.get(k))}`).join('')}` : `${RC2 ? '&rc2=1' : ''}${HK ? `&hk=${HK}` : ''}${RC2 && !DUR ? '&dur=0' : ''}`;
app.innerHTML = `
  <section id="score" hidden></section>
  <section id="story" hidden>
    <div class="screen">
      <div class="band top"><div class="chap" aria-label="Chapter"></div><button class="x" aria-label="Close">×</button><div class="cap top" aria-live="polite"></div></div>
      <div class="stagehost"></div>
      <div class="band bottom"><div class="cap low" aria-live="polite"></div>${W3C ? '<div class="cap cx" aria-live="polite"></div>' : ''}<div class="cap ev"></div><div class="act"></div><div class="holdline"></div></div>
    </div>${W3C ? '<div class="twin" hidden></div>' : ''}
    <div class="bridge" hidden><p class="bper">3rd period</p><p class="bclk">12:41</p><p class="bsc">4–3</p><p class="bcap"></p></div>
    <div class="next" hidden></div>
  </section>
  ${W3C ? `<section id="end" class="end" hidden><h2>That was tonight’s Second Look.</h2><p>Not every moment deserves a second look. These did.</p>
    <p><button class="cta-sm" onclick="location.href='/?mode=${MODE}${KEEP}'">Back to the score</button></p></section>` : `<section id="end" class="end" hidden><h2>Thank you.</h2><p>You can hand the phone back now.</p>
    ${MODE === 'demo' ? '<p><button class="cta-sm" onclick="location.reload()">Restart</button></p>' : ''}</section>`}`;
const $ = s => app.querySelector(s);
const stage = new VideoStage($('.stagehost'), log);
if (RC3) stage.onReplay = (on, skip, label) => on ? cap.paceShow('skip', skip, label) : cap.paceHide();
if (W3C) {
  $('.screen').appendChild($('.bridge'));
  $('.stagehost').appendChild($('.twin'));
}
const cap = new Captions($('#story'), log);
if (RC2) {
  cap.srcWeight = 0;
  cap.tapHint = true;
}
if (RC3) {
  document.body.classList.add('rc3');
  cap.paceUI = true;
}
const CLARITY = RC3 && q.get('clarity') !== '0';
if (CLARITY) {
  cap.clarity = true;
  stage.pinCtx = true;
  document.body.classList.add('clarity');
}
const ctx = {
  stage,
  cap,
  log,
  data: D,
  data2: D2,
  ctxData: X,
  state: RC3 ? {
    rc3: true,
    clarity: CLARITY
  } : {},
  rc3: RC3,
  mode: MODE,
  journey: JOURNEY || W3C,
  w3c: W3C,
  root: $('#story'),
  end: () => {
    stage.video.pause();
    $('#story').hidden = true;
    $('#end').hidden = false;
    document.body.classList.remove('nextmode');
    scrollTo(0, 0);
  }
};
if (W3C) {
  ctx.end = (from = '') => {
    stage.video.pause();
    log.log('back_to_score', {
      from: from || document.body.dataset.beat || ''
    });
    log.flush(true);
    setTimeout(() => {
      location.href = `/?mode=${MODE}&back=1${KEEP}`;
    }, 120);
  };
  const vw = stage.wrap;
  vw.insertAdjacentHTML('beforeend', '<div class="scrim s-top" aria-hidden="true"></div><div class="scrim s-low" aria-hidden="true"></div>' + '<div class="tapframe" aria-hidden="true"><i></i><i></i><i></i><i></i></div>');
  for (const k of ['.s-top', '.s-low', '.tapframe']) vw.insertBefore(vw.querySelector(k), vw.querySelector('.over'));
  let spatialReads = 0;
  ctx.tapAffordance = on => {
    const tf = vw.querySelector('.tapframe');
    if (!on) {
      tf.className = 'tapframe';
      vw.classList.remove('readmode');
      return;
    }
    spatialReads++;
    tf.className = `tapframe on ${spatialReads === 1 ? 'first' : 'repeat'}`;
    vw.classList.add('readmode');
    log.log('tap_affordance', {
      n: spatialReads,
      kind: spatialReads === 1 ? 'first' : 'repeat'
    });
    const t0 = performance.now();
    const rip = spatialReads === 1;
    const glyph = () => {
      const sub = app.querySelector('.cap.top .sub');
      if (sub && !sub.querySelector('.tapglyph')) {
        sub.insertAdjacentHTML('afterbegin', rip ? '<i class="tapglyph rip" aria-hidden="true"><b></b><b></b></i>' : '<i class="tapglyph" aria-hidden="true"></i>');
        if (rip) log.log('tap_ripple', {
          n: spatialReads
        });
      } else if (!sub && performance.now() - t0 < 1500) requestAnimationFrame(glyph);
    };
    requestAnimationFrame(glyph);
  };
}
if (LOOK) ctx.look = async ({
  entry = 'carry',
  open = null,
  sel = null,
  resume = false,
  origin = null
} = {}) => {
  const {
    lookAround
  } = await import('./look/look.js');
  await lookAround(ctx, {
    transition: LOOK_TR,
    entry,
    open,
    sel,
    resume,
    origin
  });
};
if (LOOK && RC2) ctx.resumeStory1 = async () => {
  ctx.exited = false;
  ctx.state = {
    ...ctx.state,
    rc2Continue: false,
    resumed: true
  };
  log.log('rc2_resume', {
    from: 'look_shots'
  });
  try {
    await new StoryRunner({
      story: STORY_W1_FROM_BRIDGE,
      handlers: handlersW1(D, X),
      ctx,
      progress: new Chapters($('.chap'), CHAPTERS_W1)
    }).run();
    if (ctx.exited) return;
    if (ctx.state.next === 'story2') {
      document.body.classList.remove('nextmode');
      await new StoryRunner({
        story: STORY_W2,
        handlers: handlersW2(D2, D, X),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_W2)
      }).run();
    } else ctx.end();
  } catch (e) {
    log.log('error', {
      message: String(e && e.message || e),
      where: 'rc2_resume'
    });
    log.flush();
    cap.top(['Something went wrong.', `<span class="soft">${String(e.message || e)}</span>`]);
  }
};
if (LOOK) ctx.storyFromLook = async () => {
  ctx.state = {
    fromLook: true,
    ...(RC2 ? {
      rc2: true
    } : {}),
    ...(RC3 ? {
      rc3: true,
      clarity: CLARITY
    } : {})
  };
  ctx.exited = false;
  log.log('story_from_look', {
    story: 'w3c_story1'
  });
  try {
    await new StoryRunner({
      story: STORY_W1,
      handlers: handlersW1(D, X),
      ctx,
      progress: new Chapters($('.chap'), CHAPTERS_W1)
    }).run();
    if (ctx.exited) return;
    if (ctx.state.next === 'story2') {
      document.body.classList.remove('nextmode');
      await new StoryRunner({
        story: STORY_W2,
        handlers: handlersW2(D2, D, X),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_W2)
      }).run();
    } else if (ctx.state.back === 'map') await ctx.look({
      entry: 'return'
    });else ctx.end();
  } catch (e) {
    log.log('error', {
      message: String(e && e.message || e),
      where: 'story_from_look'
    });
    log.flush();
    cap.top(['Something went wrong.', `<span class="soft">${String(e.message || e)}</span>`]);
  }
};
const LENS_IDS = ['shots', 'follow', 'hold'];
const ORIGINS = {
  stop: {
    story: 'w3c_story1',
    beat: 'pause1',
    checkpoint: 'first_stop',
    label: 'Back to the story'
  },
  s1_carry: {
    story: 'w3c_story1',
    beat: 'carry',
    checkpoint: 'story1_end',
    label: 'Back to the story'
  },
  s2_carry: {
    story: 'w3c_story2',
    beat: 's2_carry',
    checkpoint: 'story2_end',
    label: 'Back to the story'
  }
};
let LENS = null;
async function runStory(story, H, chapters) {
  await new StoryRunner({
    story,
    handlers: H,
    ctx,
    progress: new Chapters($('.chap'), chapters)
  }).run();
}
const H1 = () => handlersW1(D, X),
  H2 = () => handlersW2(D2, D, X);
async function afterStop() {
  const p = ctx.state.p1;
  if (ctx.exited || p === 'score') return;
  if (p === 'shots') {
    if (RC3) return ctx.openLens('shots', {
      origin: 'stop',
      sel: D.facts.gp02.shot_row
    });
    return ctx.look({
      entry: 'choice1',
      open: 'shots',
      sel: D.facts.gp02.shot_row,
      resume: true
    });
  }
  await runStory(STORY_W1_FROM_BRIDGE, H1(), CHAPTERS_W1);
  return afterCarry1();
}
async function afterCarry1() {
  if (ctx.exited) return;
  if (ctx.state.lens === 'follow') {
    ctx.state.lens = null;
    return ctx.openLens('follow', {
      origin: 's1_carry'
    });
  }
  if (ctx.state.next === 'story2') {
    document.body.classList.remove('nextmode');
    return runStory(STORY_W2, H2(), CHAPTERS_W2);
  }
  if (ctx.state.back === 'map') return ctx.look({
    entry: 'return'
  });
}
const RESUME = {
  stop: async () => {
    ctx.state.p1 = null;
    await runStory(STORY_W1_STOP_RETURN, H1(), CHAPTERS_W1);
    return afterStop();
  },
  s1_carry: async () => {
    ctx.state.next = null;
    ctx.state.back = null;
    await runStory(STORY_W1_CARRY_RETURN, H1(), CHAPTERS_W1);
    return afterCarry1();
  },
  s2_carry: async () => runStory(STORY_W2_CARRY_RETURN, H2(), CHAPTERS_W2)
};
if (RC3 && LOOK) {
  ctx.openLens = async (lens, {
    origin = null,
    sel = null
  } = {}) => {
    const O = ORIGINS[origin] || null;
    if (!LENS_IDS.includes(lens)) return;
    if (O) {
      LENS = {
        lens,
        origin
      };
      history.pushState({
        rc3lens: lens,
        from: origin
      }, '', `${location.pathname}${location.search}#lens=${lens}&from=${origin}`);
    }
    log.log('context_open', {
      lens,
      origin: origin || 'hub',
      ...(O ? {
        story: O.story,
        beat: O.beat,
        checkpoint: O.checkpoint
      } : {}),
      ...(sel ? {
        sel
      } : {})
    });
    await ctx.look({
      entry: O ? `story_${origin}` : origin || 'hub',
      open: lens,
      sel,
      origin: O ? {
        id: origin,
        ...O,
        onReturn: how => ctx.lensReturn(how)
      } : null
    });
  };
  ctx.lensReturn = (how = 'button') => {
    if (!LENS) return;
    if (location.hash.startsWith('#lens=')) {
      LENS.pending = how;
      history.back();
      setTimeout(() => {
        if (LENS && LENS.pending) doLensReturn(LENS.pending);
      }, 700);
    } else doLensReturn(how);
  };
  async function doLensReturn(how) {
    if (!LENS) return;
    const {
      lens,
      origin
    } = LENS;
    LENS = null;
    log.log('context_close', {
      lens,
      origin,
      how
    });
    log.log('context_return', {
      lens,
      destination: origin,
      how
    });
    const {
      lookClose
    } = await import('./look/look.js');
    await lookClose();
    log.log('story_resume', {
      at: origin,
      from_lens: lens
    });
    ctx.exited = false;
    try {
      await RESUME[origin]();
    } catch (e) {
      log.log('error', {
        message: String(e && e.message || e),
        where: 'lens_return'
      });
      log.flush();
      cap.top(['Something went wrong.', `<span class="soft">${String(e.message || e)}</span>`]);
    }
  }
  addEventListener('popstate', () => {
    if (LENS) doLensReturn(LENS.pending || 'browser_back');
  });
}
if (PTS) {
  const {
    initPoints
  } = await import('./points/points.js');
  initPoints(ctx, {
    match: D.match
  });
}
log.listeners.add(e => {
  if (e.type === 'context_shown' && e.beat === 'gp09') {
    try {
      sessionStorage.setItem('sl.b1.gp09', '1');
    } catch {}
  }
});
window.__ctx = ctx;
const FS = (() => {
  const el = document.documentElement,
    req = el.requestFullscreen || el.webkitRequestFullscreen;
  const on = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  return {
    api: !!req && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true),
    on,
    coarse: matchMedia('(pointer: coarse)').matches,
    off: q.get('fs') === '0',
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    async request(why) {
      if (this.off || !this.api || on()) return false;
      try {
        await req.call(el, {
          navigationUI: 'hide'
        });
        log.log('fullscreen', {
          state: 'on',
          why
        });
        return true;
      } catch (e) {
        log.log('fullscreen', {
          state: 'refused',
          why,
          err: String(e?.name || e)
        });
        return false;
      }
    },
    exit() {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
    }
  };
})();
ctx.fs = FS;
['fullscreenchange', 'webkitfullscreenchange'].forEach(t => document.addEventListener(t, () => {
  document.body.classList.toggle('fs', FS.on());
  if (!FS.on()) log.log('fullscreen', {
    state: 'off'
  });
}));
if (W3C && FS.api && !FS.coarse && !FS.off) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fsbtn';
  b.setAttribute('aria-label', 'Full screen');
  b.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  b.onclick = e => {
    e.stopPropagation();
    FS.on() ? FS.exit() : FS.request('desktop_control');
  };
  $('#story').appendChild(b);
}
$('.x').onclick = e => {
  e.stopPropagation();
  log.log('exit_tap', {
    beat: document.body.dataset.beat || ''
  });
  ctx.exited = true;
  ctx.end();
};
function scorePage() {
  const m = D.match;
  $('#score').innerHTML = `
    <div class="result" aria-label="Final score">
      <div class="comp">${m.label} · ${m.date}</div>
      <div class="team win"><span class="name">${m.home}</span><span class="g">${m.home_goals}</span></div>
      <div class="team lose"><span class="name">${m.away}</span><span class="g">${m.away_goals}</span></div>
      <div class="ft">Full time</div>
    </div>
    <button class="hook" aria-label="${D.hooks[HOOK].replace(/\n/g, ' ')} — Take a second look">
      <span class="still"><img src="/data/poster_gp02.jpg" alt=""><i class="pm"></i></span>
      <span class="body"><span class="hookline">${nl2br(D.hooks[HOOK])}</span>
        <span class="go"><b><i class="pg" aria-hidden="true"></i>Take a second look</b><small>1 min · sound on</small></span></span>
    </button>`;
  $('#score').hidden = false;
  stage.load('gp02');
  log.log('story_start', {
    story: JOURNEY ? 'full_journey' : 'second_look'
  });
  log.log('hook_variant', {
    hook: HOOK
  });
  return new Promise(res => $('#score .hook').onclick = () => {
    stage.primeFromGesture(D.gp02.watch[0]);
    log.log('hook_tap', {
      hook: HOOK
    });
    $('#score').hidden = true;
    res();
  });
}
function hookRC2(k) {
  const head = k === 'C' ? 'You saw the winning goal.' : 'You saw the goal that won the final.';
  const dur = DUR ? ' · about a minute' : '';
  const img = `<picture><source media="(max-width: 700px)" srcset="/data/hook_b_m.jpg"><img src="/data/hook_b.jpg" alt=""></picture>`;
  const chip = `<span class="hk-moment" aria-hidden="true"><i></i>3rd period · 12:41 · 3–3</span>`;
  if (k === 'B' && CLARITY) return `<button class="hook sl-hook hk hk-b" aria-label="${head} Did you see what was in front of it? Watch the winning goal again, sound on">
        <span class="still">${img}${chip}</span>
        <span class="body"><span class="hookline">${head}<br><em>Did you see what was in front of it?</em></span>
          <span class="go"><b><i class="pg" aria-hidden="true"></i>Watch the winning goal again</b><small>sound on</small></span></span>
      </button>`;
  if (k === 'B') return `<button class="hook sl-hook hk hk-b" aria-label="${head} Did you see what was in front of it? Take a second look">
        <span class="still">${img}${chip}</span>
        <span class="body"><span class="hookline">${head}<br><em>Did you see what was in front of it?</em></span>
          <span class="go"><b><i class="pg" aria-hidden="true"></i>Take a second look</b><small>${DUR ? 'About a minute · ' : ''}sound on</small></span>
          <span class="hk-why">Watch it, make your read, then see it again.</span></span>
      </button>`;
  return `<button class="hook sl-hook hk hk-c" aria-label="${head} Did you see what was in front of it? Take a second look. Interactive${dur}, sound on">
        <span class="still">${img}${chip}</span>
        <span class="body"><span class="hookline">${head}<br><em>Did you see what was in front of it?</em></span>
          <span class="hk-cta"><span class="hk-btn"><i class="hk-tap" aria-hidden="true"></i>Take a second look</span><small>Make your read, then see it again${dur} · sound on</small></span></span>
      </button>`;
}
function scorePageW3C() {
  const m = D.match;
  $('#score').classList.add('sp');
  $('#score').innerHTML = `
    <header class="sp-nav sp-head"><span class="sp-brand">Winter Cup</span><span class="sp-ctx">Match result</span></header>
    <div class="result sp-result" aria-label="Final score">
      <div class="comp">${m.label} · ${m.date}</div>
      <div class="team win"><span class="name">${m.home}</span><span class="g">${m.home_goals}</span></div>
      <div class="team lose"><span class="name">${m.away}</span><span class="g">${m.away_goals}</span></div>
      <div class="ft">Final</div>
    </div>
    <section class="sl-module" aria-label="Second Look">
      ${CLARITY ? '' : '<p class="sl-kick"><b>2 Second Looks</b><span>from this final</span></p>'}
      ${HK && HK !== 'A' ? hookRC2(HK) : `<button class="hook sl-hook" aria-label="You saw the goal that won the final. Did you see what was in front of it? Take a second look">
        <span class="still"><img src="/data/poster_gp02.jpg" alt=""><i class="pm"></i></span>
        <span class="body"><span class="hookline">You saw the goal that won the final.<br><em>Did you see what was in front of it?</em></span>
          <span class="go"><b><i class="pg" aria-hidden="true"></i>Take a second look</b><small>${LOOK ? 'Two moments worth seeing again · sound on' : 'first story · about 1½ min · sound on'}</small></span></span>
      </button>`}${LOOK && RC3 ? `
      <button class="sl-look rc3q" type="button" aria-label="Look around this final: three questions about this final">
        <i class="sl-look-g" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.2" fill="currentColor"/></svg></i>
        <span><b>Look around this final</b><small>3 questions</small></span>
        <i class="sl-look-go" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></i>
      </button>` : LOOK ? `
      <button class="sl-look" type="button" aria-label="Look around this final. Follow the connections behind the moments.">
        <i class="sl-look-g" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.2" fill="currentColor"/></svg></i>
        <span class="sl-look-t"><b>Look around this final</b><small>Follow the connections behind the moments.</small><span class="sl-look-modes" aria-hidden="true"><i>Follow the play</i><i>Watch the ice</i><i>Explore the shots</i></span></span>
        <i class="sl-look-go" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></i>
      </button>` : ''}
      ${CLARITY ? '' : '<p class="sl-note">Not every moment deserves a second look.</p>'}
    </section>`;
  $('#score').hidden = false;
  stage.load('gp02');
  log.log('story_start', {
    story: 'w3c_second_look',
    entry: q.get('src') === 'teaser' ? 'teaser' : 'score_page'
  });
  log.log('score_page_shown', HK || RC2 ? {
    hk: HK || 'A',
    rc2: RC2,
    dur: DUR
  } : {});
  log.log('device_caps', {
    fs_api: FS.api,
    coarse: FS.coarse,
    standalone: FS.standalone,
    dpr: devicePixelRatio,
    vw: innerWidth,
    vh: innerHeight,
    orient: innerWidth > innerHeight ? 'landscape' : 'portrait'
  });
  if (HK === 'C' && !matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(() => $('#score .hk-c')?.classList.add('in'));
  if (STUDY && q.get('back') === '1') studyFeedback(STUDY, $('#score'), log);
  return new Promise(res => {
    $('#score .sl-hook').onclick = () => {
      stage.primeFromGesture(D.gp02.watch[0]);
      if (FS.coarse) FS.request('hook_tap');
      log.log('hook_tap', {
        hook: 'H3',
        surface: 'score_page',
        ...(HK ? {
          hk: HK
        } : {})
      });
      log.log('second_interaction', {
        from: 'score_page'
      });
      $('#score').hidden = true;
      res('story');
    };
    const lk = $('#score .sl-look');
    if (lk) lk.onclick = () => {
      stage.primeFromGesture(0);
      if (FS.coarse) FS.request('look_tap');
      log.log('look_tap', {
        at: 'score_page'
      });
      log.log('second_interaction', {
        from: 'score_page',
        to: 'look'
      });
      if (RC3) log.log('browse_open', {
        from: 'score_page'
      });
      $('#score').hidden = true;
      res('look');
    };
  });
}
function a2Intro() {
  $('#score').innerHTML = `<div class="a2intro"><div class="comp">${D.match.label}</div>
      <h2>A moment from the third period.<br>The score is 3–3.</h2>
      <p>Sound on, if you can.</p><button class="cta-sm">Start</button></div>`;
  $('#score').hidden = false;
  stage.load('gp04');
  log.log('story_start', {
    story: 'a2_baseline'
  });
  return new Promise(res => $('#score .cta-sm').onclick = () => {
    stage.primeFromGesture(D.gp04.watch[0]);
    log.log('a2_start_tap');
    $('#score').hidden = true;
    res();
  });
}
function coldIntro() {
  $('#score').innerHTML = `<div class="a2intro"><div class="comp">${D.match.label}</div>
      <h2>A moment from the second period.<br>Harbour lead 3–2.</h2>
      <p>Sound on, if you can.</p><button class="cta-sm">Start</button></div>`;
  $('#score').hidden = false;
  const loading = stage.load('gp09');
  log.log('story_start', {
    story: 'gp09_cold_baseline'
  });
  return new Promise(res => $('#score .cta-sm').onclick = async () => {
    const primed = stage.primeFromGesture(1);
    log.log('cold_start_tap');
    $('#score').hidden = true;
    await loading;
    await primed;
    res();
  });
}
(async () => {
  try {
    if (STUDY) await studyNotice(STUDY);
    if (STUDY && S2ONLY && q.get('back') === '1') {
      log.log('study_end_card');
      studyEndCard(app);
      return;
    }
    const isA2 = MODE === 'a2',
      isCold = MODE === 'gp09cold';
    if (LOOK && q.get('qa') === 'look') {
      $('#score').hidden = true;
      $('#story').hidden = false;
      requestAnimationFrame(() => stage.applyView(false));
      await ctx.look({
        entry: 'qa'
      });
      return;
    }
    if (RC3 && LOOK) {
      const hl = /^#lens=(\w+)/.exec(location.hash)?.[1],
        dl = q.get('lens'),
        lens = LENS_IDS.includes(dl) ? dl : LENS_IDS.includes(hl) ? hl : null;
      if (lens) {
        if (hl) {
          history.replaceState(null, '', `${location.pathname}${location.search}`);
          log.log('context_reload', {
            lens,
            from: /from=(\w+)/.exec(location.hash)?.[1] || ''
          });
        }
        $('#score').hidden = true;
        $('#story').hidden = false;
        scrollTo(0, 0);
        requestAnimationFrame(() => stage.applyView(false));
        log.log('story_start', {
          story: 'rc3_lens_direct',
          entry: hl ? 'reload' : 'deeplink'
        });
        log.log('context_open', {
          lens,
          origin: hl ? 'reload' : 'deeplink'
        });
        await ctx.look({
          entry: hl ? 'reload' : 'deeplink',
          open: lens
        });
        return;
      }
    }
    if (W3C && S2ONLY) {
      ctx.state.rc2 = true;
      $('#score').innerHTML = `<div class="a2intro"><div class="comp">${D.match.label}</div>
        <h2>A moment from the second period.<br>The score is 2–2.</h2><p>Sound on, if you can.</p><button class="cta-sm">Start</button></div>`;
      $('#score').hidden = false;
      const loading = stage.load('gp03');
      log.log('story_start', {
        story: 'w3c_story2_prompted',
        entry: 'prompted_s2'
      });
      await new Promise(res => $('#score .cta-sm').onclick = async () => {
        const pr = stage.primeFromGesture(8.4);
        log.log('prompted_s2_start');
        $('#score').hidden = true;
        await loading;
        await pr;
        res();
      });
      $('#story').hidden = false;
      scrollTo(0, 0);
      requestAnimationFrame(() => stage.applyView(false));
      await new StoryRunner({
        story: STORY_W2,
        handlers: handlersW2(D2, D, X),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_W2)
      }).run();
      return;
    }
    const pick = await (isA2 ? a2Intro() : isCold ? coldIntro() : W3C ? scorePageW3C() : scorePage());
    if (pick === 'look') {
      $('#story').hidden = false;
      scrollTo(0, 0);
      requestAnimationFrame(() => stage.applyView(false));
      await ctx.look({
        entry: 'score_page'
      });
      return;
    }
    $('#story').hidden = false;
    scrollTo(0, 0);
    requestAnimationFrame(() => stage.applyView(false));
    if (isCold) {
      await new StoryRunner({
        story: STORY_GP09_COLD,
        handlers: handlers2(D2, D),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_COLD)
      }).run();
      return;
    }
    if (W3C) {
      if (RC2) ctx.state.rc2 = true;
      await new StoryRunner({
        story: RC2 ? STORY_W1_RC2 : STORY_W1,
        handlers: handlersW1(D, X),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_W1)
      }).run();
      if (RC3) {
        await afterStop();
        return;
      }
      if (!ctx.exited && ctx.state.p1 === 'shots') {
        await ctx.look({
          entry: 'choice1',
          open: 'shots',
          sel: D.facts.gp02.shot_row,
          resume: true
        });
        return;
      }
      if (!ctx.exited && ctx.state.p1 === 'next') await new StoryRunner({
        story: STORY_W1_FROM_BRIDGE,
        handlers: handlersW1(D, X),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_W1)
      }).run();
      if (RC2 && ctx.state.p1 === 'score') return;
      if (!ctx.exited && ctx.state.next === 'story2') {
        document.body.classList.remove('nextmode');
        await new StoryRunner({
          story: STORY_W2,
          handlers: handlersW2(D2, D, X),
          ctx,
          progress: new Chapters($('.chap'), CHAPTERS_W2)
        }).run();
      } else if (!ctx.exited) ctx.end();
      return;
    }
    const chapters = new Chapters($('.chap'), isA2 ? CHAPTERS_A2 : CHAPTERS);
    await new StoryRunner({
      story: isA2 ? STORY_A2 : STORY_A,
      handlers: handlers(D),
      ctx,
      progress: chapters
    }).run();
    if (JOURNEY && !ctx.exited && ctx.state.next === 'story2') {
      document.body.classList.remove('nextmode');
      await new StoryRunner({
        story: STORY_2,
        handlers: handlers2(D2, D),
        ctx,
        progress: new Chapters($('.chap'), CHAPTERS_2)
      }).run();
    } else if (JOURNEY && !ctx.exited) ctx.end();
  } catch (e) {
    log.log('error', {
      message: String(e && e.message || e)
    });
    log.flush();
    cap.top(['Something went wrong.', `<span class="soft">${String(e.message || e)}</span>`]);
  }
})();
