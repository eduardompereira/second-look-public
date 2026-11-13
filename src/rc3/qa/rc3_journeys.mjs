import { chromium } from 'playwright';
import fs from 'node:fs';
const [base, out, vpk = 'phone', ...rest] = process.argv.slice(2);
const RM = rest.includes('rm'),
  ONLY = (rest.find(x => x.startsWith('only=')) || 'only=A,B,C,D').slice(5).split(',');
const VP = {
  phone: {
    viewport: {
      width: 390,
      height: 844
    },
    isMobile: true,
    hasTouch: true
  },
  android: {
    viewport: {
      width: 412,
      height: 915
    },
    isMobile: true,
    hasTouch: true
  },
  land: {
    viewport: {
      width: 844,
      height: 390
    },
    isMobile: true,
    hasTouch: true
  },
  desktop: {
    viewport: {
      width: 1440,
      height: 900
    }
  }
}[vpk];
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const R = {
  vp: vpk,
  rm: RM,
  checks: [],
  shots: [],
  errors: []
};
const check = (name, ok, info = '') => {
  R.checks.push({
    name,
    ok: !!ok,
    info: String(info).slice(0, 300)
  });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  · ' + String(info).slice(0, 160) : ''}`);
};
async function newPage(q = '') {
  const c = await b.newContext({
    ...VP,
    reducedMotion: RM ? 'reduce' : 'no-preference',
    ...(process.env.QA_HTTP_PASS ? {
      httpCredentials: {
        username: process.env.QA_HTTP_USER || 'sic',
        password: process.env.QA_HTTP_PASS
      }
    } : {})
  });
  const p = await c.newPage();
  p.on('pageerror', e => R.errors.push(String(e)));
  p.on('console', m => {
    if (m.type() === 'error' && !/404/.test(m.text())) R.errors.push(m.text());
  });
  await p.goto(base + q);
  await hook(p);
  return {
    p,
    c
  };
}
const EVIDENCE = ['gp02_name', 'gp04_climax', 'gp04_name', 'twin', 's2_bridge_saved', 'gp08_name', 'gp09_climax', 'gp09_name'];
async function autoEvidence(p) {
  await p.evaluate(() => {
    if (window.__autoEv) return;
    window.__autoEv = setInterval(() => {
      const b = document.querySelector('.pace.in:not([hidden])');
      const ev = window.__ctx?.cap?.evEl?.classList.contains('in');
      if (!b || b.dataset.kind !== 'continue' || !ev) {
        window.__evSeen = 0;
        return;
      }
      if (!window.__evSeen) window.__evSeen = performance.now();else if (performance.now() - window.__evSeen > 1500) {
        window.__evSeen = 0;
        b.click();
      }
    }, 100);
  });
}
async function hook(p) {
  await p.waitForFunction(() => !!window.__ctx, null, {
    timeout: 30000
  });
  await p.evaluate(() => {
    if (window.__evHooked) return;
    window.__evHooked = 1;
    window.__ev = [];
    window.__ctx.log.listeners.add(e => {
      const {
        iso,
        ua,
        viewport,
        session,
        ...r
      } = e;
      window.__ev.push({
        ...r,
        pt: performance.now()
      });
    });
  });
  await autoEvidence(p);
}
const evs = (p, type) => p.evaluate(t => window.__ev.filter(e => e.type === t), type);
const n = (p, type) => p.evaluate(t => window.__ev.filter(e => e.type === t).length, type);
const waitFn = async (p, fn, arg, ms = 150000) => {
  const s = Date.now();
  while (Date.now() - s < ms) {
    if (await p.evaluate(fn, arg).catch(() => false)) return true;
    await p.waitForTimeout(80);
  }
  throw new Error('timeout ' + String(fn).slice(0, 120));
};
const waitEv = (p, type, k = 1, ms) => waitFn(p, ([t, k]) => window.__ev.filter(e => e.type === t).length >= k, [type, k], ms);
const shot = async (p, name) => {
  const f = `${out}_${name}.png`;
  await p.screenshot({
    path: f
  });
  R.shots.push(f);
};
const clickFrame = async (p, x, y) => {
  const r = await p.evaluate(([x, y]) => {
    const st = window.__ctx.stage,
      bb = st.wrap.getBoundingClientRect(),
      [x0, y0, w, h] = st.crop || st.baseView();
    return [bb.x + (x - x0) / w * bb.width, bb.y + (y - y0) / h * bb.height];
  }, [x, y]);
  await p.mouse.click(r[0], r[1]);
};
const vis = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return false;
  const r = e.getBoundingClientRect(),
    cs = getComputedStyle(e);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.hidden;
}, sel);
const videoStartsSince = (p, t0) => p.evaluate(t => window.__ev.filter(e => e.type === 'video_start' && e.pt > t).map(e => e.label), t0);
const now = p => p.evaluate(() => performance.now());
async function toStop(p) {
  await p.click('#score .sl-hook');
  await p.waitForTimeout(1300);
  R.rotate ??= await p.evaluate(() => document.querySelector('#story .cap.low')?.innerText || '');
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on');
  await p.waitForTimeout(1200);
  await clickFrame(p, 1540, 600);
  await waitFn(p, () => !!document.querySelector('.p1.in'));
  await p.waitForTimeout(700);
}
async function stopToCarry(p) {
  await p.click('.p1 [data-k=next]');
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 'use_it');
  await p.waitForTimeout(1000);
  await clickFrame(p, 430, 560);
  await waitFn(p, () => !!document.querySelector('.next.on .showme'));
  await p.waitForTimeout(2300);
}
let t0 = 0;
const AB = ONLY.includes('A') || ONLY.includes('B');
if (AB || ONLY.includes('C')) {
  const {
    p,
    c
  } = await newPage(AB ? '?fs=0' : '?fs=0&s2=1');
  if (AB) {
    await shot(p, 'A0_score');
    check('A score: one quiet Look-around line, no mode chips', (await vis(p, '#score .sl-look.rc3q')) && !(await vis(p, '#score .sl-look-modes')));
    const sp = await p.evaluate(() => ({
      cta: document.querySelector('#score .sl-hook .go b')?.innerText.trim(),
      note: !!document.querySelector('#score .sl-note'),
      kick: !!document.querySelector('#score .sl-kick'),
      why: !!document.querySelector('#score .hk-why'),
      words: document.querySelector('#score .sl-module')?.innerText.split(/\s+/).filter(Boolean).length
    }));
    check('A score (#6): CTA "Watch the winning goal again"; no kicker, note or second explanatory line', /^Watch the winning goal again$/i.test(sp.cta) && !sp.note && !sp.kick && !sp.why, JSON.stringify(sp));
    await toStop(p);
    await shot(p, 'A1_stop');
    const stopBtns = await p.$$eval('.p1 button', bs => bs.map(x => x.innerText.trim()));
    check('T-FS (#18): no full-screen promise in the first-watch hint (portrait: "bigger picture"; landscape/desktop: no hint)', !/full ?screen/i.test(R.rotate) && (VP.viewport.height > VP.viewport.width ? /bigger picture/i.test(R.rotate) : true), R.rotate || '(no hint)');
    check('A stop: exactly 3 choices, Show me first, one lens door', stopBtns.length === 3 && /show me/i.test(stopBtns[0]) && /\d+ Harbour shot attempts with Novak in goal/i.test(stopBtns[1]), stopBtns.join(' | '));
    const stopTxt = await p.evaluate(() => document.querySelector('.p1')?.innerText.replace(/\s+/g, ' '));
    check('A stop (#7): names the next clip (Next: 3rd period, clock · score), no riddle, no result', /^Next: 3rd period, \d+:\d\d · \d–\d/i.test(stopTxt) && /almost the same spot/.test(stopTxt) && !/wasn.t the end|saved|danger/i.test(stopTxt), stopTxt);
    const pace = (await evs(p, 'manual_advance')).filter(e => !EVIDENCE.includes(e.at));
    const rr = await n(p, 'read_hold');
    check('A pace control was shown on holds (no fan tap on a timed hold = 0 manual advances)', pace.length === 0 && rr > 0, `holds ${rr}`);
    const ew = (await evs(p, 'evidence_wait')).map(e => e.at),
      auto = (await evs(p, 'advance')).filter(e => EVIDENCE.includes(e.at) && e.how === 'auto');
    check('A clarity default (#22): gp02_name waited for a tap, never auto-advanced', ew.includes('gp02_name') && auto.length === 0, `${ew} auto=${auto.length}`);
    t0 = await now(p);
    await p.click('.p1 [data-k=shots]');
    await waitFn(p, () => document.body.dataset.beat === 'look_shots_found');
    await p.waitForTimeout(1300);
    await shot(p, 'A2_shots_story');
    const L = await p.evaluate(() => window.__look.state());
    check('A lens: Explore the Shots found, winner selected', L.screen === 'found:shots' && L.map.sel === 53382, JSON.stringify(L.map).slice(0, 120));
    check('A lens: all 61 attempts drawn by default', L.map.marks.length === 61, L.map.marks.length);
    check('A lens: URL carries #lens=shots&from=stop', (await p.evaluate(() => location.hash)) === '#lens=shots&from=stop');
    check('A lens: no hub button in story mode; Back labelled for the story', !L.nav.all && L.nav.back && (await p.getAttribute('.lk-back', 'aria-label')) === 'Back to the story');
    const hero = await p.evaluate(() => document.querySelector('#story .cap.cx .lk3-hero')?.innerText.replace(/\s+/g, ' '));
    check("A lens: hero = 17.9 m + comparison group (4 goals on Novak)", /17\.9\s*m/.test(hero) && /4 goals on Novak/.test(hero), hero);
    const ctxl = await p.evaluate(() => document.querySelector('#story .cap.cx .lk3-ctx')?.innerText);
    check("A lens: denominator stated (61 Harbour shot attempts with Novak in goal, incl. missed and blocked)", /61 Harbour shot attempts with Novak in goal, including missed and blocked/.test(ctxl), ctxl);
    check('A lens: origin bridge line', /From your story/.test(await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText)));
    const acts = await p.$$eval('#story .act .lk-act', bs => bs.map(x => x.dataset.a));
    check('A lens: actions = origin first, own door, score last', acts[0] === 'origin' && acts.at(-1) === 'score' && acts.includes('pair'), acts.join(','));
    await p.click('.lk3-more > summary');
    await p.waitForTimeout(300);
    check('A lens: More detail opens (logged)', (await n(p, 'detail_open')) >= 1 && (await p.evaluate(() => document.querySelector('.lk3-more').open)));
    await shot(p, 'A3_shots_more');
    await p.click('.lk3-more > summary');
    await p.click('.lk3-bandsbtn');
    await p.waitForTimeout(300);
    check('A lens: By distance shows the 3 bands', (await p.$$('.lk-bandrow')).length === 3);
    check('A lens (B1): no How we know / Technical details in the fan layer', !(await p.$('.lk-whybtn, .lk-sheet, details.lk-tech')));
    const mstate = () => p.evaluate(() => {
      const marks = [...document.querySelectorAll('.lk-mapg .lk-att')];
      return {
        goal: marks.filter(m => m.classList.contains('goal')).length,
        other: marks.filter(m => !m.classList.contains('goal')).length,
        btn: document.querySelector('.lk-allbtn')?.innerText.trim()
      };
    });
    const t15 = [];
    const step15 = async (what, act) => {
      await act();
      await p.waitForTimeout(450);
      const m = await mstate();
      t15.push([what, m]);
      return m;
    };
    if ((await mstate()).btn === 'Goals only') await step15('to goals', () => p.click('.lk-allbtn'));
    if (!(await vis(p, '.lk-bandrow'))) await p.click('.lk3-bandsbtn');
    const s1 = await step15('band far', () => p.click('.lk-bandrow[data-band=far]'));
    const s2 = await step15('goals only', () => p.click('.lk-allbtn'));
    const s3 = await step15('band mid', () => {
      return p.evaluate(() => document.querySelector('.lk-bandrow[data-band=mid]') ? null : document.querySelector('.lk3-bandsbtn').click()).then(() => p.click('.lk-bandrow[data-band=mid]'));
    });
    const s4 = await step15('goals only', () => p.click('.lk-allbtn'));
    const s5 = await step15('all', () => p.click('.lk-allbtn'));
    const s6 = await step15('goals only', () => p.click('.lk-allbtn'));
    check('T-15 band → Goals only → band → Goals only → All → Goals only: marks match the state, label names the switch', s1.other > 0 && s1.btn === 'Goals only' && s2.other === 0 && /^All \d+ attempts$/.test(s2.btn) && s3.other > 0 && s3.btn === 'Goals only' && s4.other === 0 && s5.other + s5.goal === 61 && s5.btn === 'Goals only' && s6.other === 0 && s6.goal > 0, JSON.stringify(t15));
    if (VP.isMobile && VP.viewport.height > VP.viewport.width) {
      const rinkVis = () => p.evaluate(() => {
        const r = document.querySelector('.look-ice').getBoundingClientRect(),
          vh = innerHeight;
        return +((Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height).toFixed(2);
      });
      const v16 = [];
      for (const sel of ['.lk-bandrow[data-band=close]', '.lk-allbtn', '.lk-bandrow[data-band=far]', '.lk-allbtn']) {
        if (!(await p.$(sel))) await p.click('.lk3-bandsbtn');
        await p.evaluate(() => document.querySelectorAll('*').forEach(e => {
          const cs = getComputedStyle(e);
          if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) e.scrollTop = e.scrollHeight;
        }));
        await p.waitForTimeout(250);
        await p.click(sel);
        await p.waitForTimeout(900);
        v16.push(await rinkVis());
      }
      check(`T-16 phone ${VP.viewport.width}×${VP.viewport.height}: rink ≥ 80 % in view after each Shots control`, v16.every(x => x >= 0.8), v16.join(','));
    }
    await p.click('.lk-act[data-a=origin]');
    await waitFn(p, () => !!document.querySelector('.p1.in'));
    await p.waitForTimeout(600);
    await shot(p, 'A4_stop_returned');
    const vs = await videoStartsSince(p, t0),
      v = await p.evaluate(() => ({
        clip: window.__ctx.stage.clip,
        t: +window.__ctx.stage.video.currentTime.toFixed(2),
        paused: window.__ctx.stage.video.paused
      }));
    check('A return: same stop, frozen GP-02 last frame, NO footage replayed', vs.length === 0 && v.clip === 'gp02' && Math.abs(v.t - 13.33) < 0.1 && v.paused, `${JSON.stringify(v)} starts=${vs}`);
    check('A return: hash cleared, look closed', (await p.evaluate(() => location.hash)) === '' && !(await p.evaluate(() => document.body.classList.contains('look'))));
    check('A return logged (context_return → story_resume stop)', (await evs(p, 'context_return')).some(e => e.destination === 'stop') && (await evs(p, 'story_resume')).some(e => e.at === 'stop'));
    t0 = await now(p);
    await p.click('.p1 [data-k=shots]');
    await waitFn(p, () => document.body.dataset.beat === 'look_shots_found');
    await p.waitForTimeout(600);
    await p.goBack();
    await waitFn(p, () => !!document.querySelector('.p1.in'));
    await p.waitForTimeout(500);
    check('A repeat + browser Back: same stop again, no footage', (await videoStartsSince(p, t0)).length === 0 && (await evs(p, 'context_return')).some(e => e.how === 'browser_back'));
    check('A repeat: exactly 2 lens opens, 2 returns, no duplicate stop logs per entry', (await n(p, 'context_open')) === 2 && (await n(p, 'context_return')) === 2 && (await n(p, 'choice1_shown')) === 3);
    await stopToCarry(p);
    check('A→B: Show me after the lens resumes the story normally (GP-04 autostart)', (await evs(p, 'gp04_autostart')).some(e => e.ok));
    await shot(p, 'B1_carry');
    check('B carry: one Follow door under Show me', (await vis(p, '.next [data-k=follow]')) && (await p.$$('.next .ctxdoor')).length === 1, await p.evaluate(() => document.querySelector('.next [data-k=follow]')?.innerText));
    t0 = await now(p);
    await p.click('.next [data-k=follow]');
    await waitFn(p, () => document.body.dataset.beat === 'look_follow_intro');
    await p.waitForTimeout(900);
    await shot(p, 'B2_follow_intro');
    check('B lens intro: origin bridge (chance 2 = the one you just saw)', /Chance 2 is the one you just saw/.test(await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText)));
    check('B lens: #lens=follow&from=s1_carry', (await p.evaluate(() => location.hash)) === '#lens=follow&from=s1_carry');
    const pre = await p.evaluate(() => document.querySelector('#story')?.innerText.replace(/\s+/g, ' '));
    const preHit = /.{0,60}(\bsaved?\b|\bscored\b|\bgoal\b).{0,40}/i.exec(pre);
    check('B lens before the GP-03 READ: no result on screen (no saved / goal / scored)', !preHit, preHit?.[0]);
    if (await p.$('.fs-pane')) {
      await p.locator('.fs-pane[data-i="1"] .lk-tok .ring').click();
      await p.waitForTimeout(1500);
      const g = await p.$('.fs-guess button[data-a=same]');
      if (g) {
        await g.click();
        await p.waitForTimeout(1800);
      }
      if (!(await p.$('.fs-pane[data-i="0"].open'))) {
        await p.locator('.fs-pane[data-i="0"] .lk-tok .ring').click();
        await p.waitForTimeout(1800);
      }
      const held = await p.evaluate(() => ({
        held: [...document.querySelectorAll('.fs-pane .fs-held')].map(e => e.closest('.fs-pane').dataset.i),
        vids: [...document.querySelectorAll('.fs-pane video')].map(v => v.currentSrc || [...v.querySelectorAll('source')].map(x => x.src).join('+'))
      }));
      check('B (#5) before the GP-03 READ: chance 1 (GP-03) footage held, never loaded', held.held.includes('0') && !held.vids.some(v => /gp03/.test(v)), JSON.stringify(held));
      const fn = await p.$('.fs-next');
      if (fn) await fn.click();
    } else for (const i of [1, 0]) {
      await p.$eval(`.lk-tok[data-i="${i}"]`, e => e.click());
      await p.waitForTimeout(1400);
    }
    await waitFn(p, () => document.body.dataset.beat === 'look_follow_found');
    await p.waitForTimeout(1500);
    await shot(p, 'B3_follow_found');
    const fh = await p.evaluate(() => document.querySelector('#story .cap.cx')?.innerText.replace(/\s+/g, ' '));
    check("B found: hero 2 of 2 + Haldane + visible last-pass caveat", /2 of 2/.test(fh) && /Haldane/.test(fh) && /not who made it happen/.test(fh), fh);
    check('B found: no GP-03 footage played inside the lens before its READ', !(await videoStartsSince(p, t0)).some(l => /gp03/.test(String(l))), await videoStartsSince(p, t0));
    const preF = await p.evaluate(() => ({
      txt: document.querySelector('#story')?.innerText.replace(/\s+/g, ' '),
      acts: [...document.querySelectorAll('#story .act .lk-act')].map(x => x.innerText.trim()),
      more: !!document.querySelector('.lk3-more')
    }));
    const preFHit = /.{0,60}(\bsaved?\b|\bscored\b).{0,40}/i.exec(preF.txt);
    check("B found before the GP-03 READ: no result, no More detail, no 8:47 replay", !preFHit && !preF.more && !preF.acts.some(a => /8:47/.test(a)), JSON.stringify(preF.acts) + ' ' + (preFHit?.[0] || ''));
    await p.click('.lk-back');
    await waitFn(p, () => !!document.querySelector('.next.on .showme'));
    await p.waitForTimeout(400);
    check('B return via nav Back: same carry, no footage', (await videoStartsSince(p, t0)).length === 0 && (await evs(p, 'story_resume')).some(e => e.at === 's1_carry'));
    await p.waitForTimeout(2000);
    t0 = await now(p);
    await p.click('.next [data-k=follow]');
    await waitFn(p, () => document.body.dataset.beat === 'look_follow_intro');
    await p.waitForTimeout(500);
    await p.keyboard.press('Escape');
    await waitFn(p, () => !!document.querySelector('.next.on .showme'));
    await p.waitForTimeout(2200);
    check('B repeat + Esc: same carry', (await evs(p, 'context_return')).filter(e => e.destination === 's1_carry').length === 2);
    check('B: story_complete logged once', (await n(p, 'story_complete')) === 1);
    const nextCard = await p.evaluate(() => document.querySelector('.nx-hook')?.innerText.replace(/\s+/g, ' ').trim());
    check('T-SP Next card before the GP-03 READ (B1, L3): short ungraded question, no result word', /^The best chance of the final\. Goal or save\?$/i.test(nextCard) && !/\b(saved|scored?|missed|didn.t|went in|stopped)\b/i.test(nextCard), nextCard);
    await p.click('.next .showme');
  } else await p.click('#score .cta-sm');
  await p.waitForSelector('.callbtn[data-c=save]', {
    timeout: 120000
  });
  await p.waitForTimeout(1500);
  await p.click('.callbtn[data-c=save]');
  await waitFn(p, () => document.body.dataset.beat === 's2_bridge' && /best chance of the final/.test(document.querySelector('#story .cap.top')?.innerText || ''));
  await shot(p, 'C1_gp03_saved');
  check("C GP-03 (#9): \"Saved.\" + the rank attributed to The shot model on the main layer", /Saved\./.test(await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText)) && /shot model rated it the best chance of the final/.test(await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText)));
  await waitFn(p, () => document.querySelector('.pace.in')?.dataset.kind === 'continue');
  await p.click('.pace');
  await p.waitForTimeout(300);
  check('C Continue button ends a hold (manual_advance how=button)', (await evs(p, 'manual_advance')).some(e => e.how === 'button'));
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 's2_commit');
  await p.waitForTimeout(1000);
  await clickFrame(p, 760, 345);
  await waitFn(p, () => document.querySelector('.pace.in')?.dataset.kind === 'skip', null, 60000);
  await shot(p, 'C2_skip_replay');
  await p.click('.pace');
  await p.waitForTimeout(400);
  const sk = await evs(p, 'skip_replay');
  check('C Skip replay ends the GP-08 replay (skip_replay logged)', sk.some(e => e.label === 'gp08_see_again' && e.how === 'button'), JSON.stringify(sk.at(-1) || {}));
  await waitFn(p, () => !!document.querySelector('.bridge .s2c.in'), null, 120000);
  const plate = await p.evaluate(() => document.querySelector('.bridge .bcap')?.innerText.replace(/\s+/g, ' '));
  await shot(p, 'C3_plate');
  check('C GP-09 plate (#10): says it is the fan\u2019s turn and whose attack, not where to look', /Your turn/.test(plate) && /Now the Ridge attack/.test(plate) && !/far side|Ibsen|across|look/i.test(plate), plate);
  await p.click('.s2c [data-k=next]');
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 's2_use_it');
  await p.waitForTimeout(1000);
  const q9 = await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText.replace(/\s+/g, ' '));
  check('C GP-09 READ (#12): plain question, no "danger", untimed (no Continue / timer)', /Where will the next Ridge shot come from\?/.test(q9) && !/danger/i.test(q9) && !(await vis(p, '.pace.in')), q9);
  await clickFrame(p, 685, 610);
  await waitFn(p, () => !!document.querySelector('.next.on [data-k=xhold]'), null, 150000);
  await p.waitForTimeout(800);
  await shot(p, 'C4_s2_carry');
  t0 = await now(p);
  await p.click('.next [data-k=xhold]');
  await waitFn(p, () => document.body.dataset.beat === 'look_hold_ice');
  await p.waitForTimeout(900);
  await shot(p, 'C5_ice_direct');
  check('C lens: starts on the rink, GP-03 clip NOT replayed', (await videoStartsSince(p, t0)).length === 0, await videoStartsSince(p, t0));
  check('C lens: origin bridge head', /You saw both/.test(await p.evaluate(() => document.querySelector('#story .cap.top')?.innerText)));
  await p.click('.lk-act[data-a=q]');
  await p.waitForSelector('.lk-pred .pick');
  await p.click('.lk-pred .pick[data-c=changed]');
  await waitFn(p, () => document.body.dataset.beat === 'look_hold_found');
  await p.waitForTimeout(1900);
  await shot(p, 'C6_ice_found');
  const ih = await p.evaluate(() => document.querySelector('#story .cap.cx')?.innerText.replace(/\s+/g, ' '));
  check('C found: strip graphic + 5 of 5 hero + visible not-tiredness caveat', (await vis(p, '.cap.cx .lk3-strip')) && /5 of 5/.test(ih) && /tired/.test(ih), ih);
  const cavPos = await p.evaluate(() => {
    const h = document.querySelector('.lk3-hero')?.getBoundingClientRect(),
      c = document.querySelector('.lk3-cav')?.getBoundingClientRect(),
      s = document.querySelector('.lk3-strip')?.getBoundingClientRect();
    return h && c && s ? {
      under: c.top >= h.bottom - 1 && c.bottom <= s.top + 1,
      gap: Math.round(c.top - h.bottom)
    } : null;
  });
  check('C found (#14): the not-tiredness limit sits directly under the hero, before the strip', !!cavPos?.under, JSON.stringify(cavPos));
  check('C found: 12-name line-up list collapsed (inside a closed More detail)', await p.evaluate(() => [...document.querySelectorAll('.lk-lineups')].every(e => e.closest('details:not([open])'))));
  await p.click('.lk-act[data-a=origin]');
  await waitFn(p, () => !!document.querySelector('.next.on [data-k=xhold]'));
  await p.waitForTimeout(500);
  check('C return: same Story 2 carry, no footage, journey complete logged once', (await videoStartsSince(p, t0)).length === 0 && (await n(p, 'full_journey_complete')) === 1);
  await p.click('.next [data-k=xhold]');
  await waitFn(p, () => document.body.dataset.beat === 'look_hold_ice');
  await p.reload();
  await hook(p);
  await waitFn(p, () => /look_hold/.test(document.body.dataset.beat || ''), null, 60000);
  await p.waitForTimeout(800);
  const rs = await p.evaluate(() => ({
    hash: location.hash,
    st: window.__look?.state()
  }));
  check('C reload of #lens=hold&from=s2_carry: lens reopens in hub mode, hash cleared', rs.hash === '' && rs.st && rs.st.inv === 'hold' && rs.st.history[0] === 'home', JSON.stringify(rs.st?.history));
  await shot(p, 'C7_reload');
  await c.close();
}
if (ONLY.includes('D')) {
  const {
    p,
    c
  } = await newPage('?fs=0');
  await p.click('#score .sl-look');
  await waitFn(p, () => document.body.dataset.beat === 'look_home');
  await p.waitForTimeout(500);
  await shot(p, 'D1_hub');
  check('D hub: three question-led cards', (await p.$$('.lk-card')).length === 3, await p.$$eval('.lk-c-q', x => x.map(e => e.innerText).join(' | ')));
  await p.click('.lk-card[data-inv=hold]');
  await p.waitForSelector('.lk-act[data-a=ice]', {
    timeout: 60000
  });
  check('D hub lens: the original video step is preserved', (await evs(p, 'video_start')).some(e => /look_gp03/.test(e.label)));
  await p.click('.lk-act[data-a=ice]');
  await p.waitForSelector('.lk-act[data-a=q]', {
    timeout: 60000
  });
  await p.click('.lk-act[data-a=q]');
  await p.waitForSelector('.lk-pred .pick');
  await p.click('.lk-pred .pick[data-c=same]');
  await waitFn(p, () => document.body.dataset.beat === 'look_hold_found');
  await p.waitForTimeout(1500);
  await shot(p, 'D2_hub_ice_found');
  check('D hub lens: no story origin → "Explore another discovery" present, no "Back to the story"', !!(await p.$('.lk-act[data-a=home]')) && !(await p.$('.lk-act[data-a=origin]')));
  await p.click('.lk-back');
  await waitFn(p, () => document.body.dataset.beat === 'look_home');
  check('D Back from a hub lens → hub', true);
  await p.click('.lk-h-score');
  await p.waitForURL(/back=1/, {
    timeout: 10000
  });
  await hook(p);
  await p.waitForSelector('#score .sl-hook');
  check('D hub → Back to the score → score page', /back=1/.test(p.url()), p.url());
  await c.close();
  const d2 = await newPage('?fs=0&lens=follow');
  await waitFn(d2.p, () => document.body.dataset.beat === 'look_follow_intro', null, 30000);
  await d2.p.waitForTimeout(500);
  check('D deep link ?lens=follow opens Follow the Play (hub mode)', (await d2.p.evaluate(() => window.__look.state().history)).join() === 'home,inv:follow');
  await shot(d2.p, 'D3_deeplink');
  await d2.p.click('.lk-back');
  await waitFn(d2.p, () => document.body.dataset.beat === 'look_home');
  check('D deep link Back → hub', true);
  await d2.c.close();
  const d3 = await newPage('?fs=0&lens=bogus');
  await d3.p.waitForSelector('#score .sl-hook', {
    timeout: 20000
  });
  check('D unknown ?lens= is ignored (score page)', await vis(d3.p, '#score .sl-hook'));
  await d3.c.close();
}
if (ONLY.includes('E')) {
  const {
    p,
    c
  } = await newPage('?fs=0');
  await p.focus('#score .sl-hook');
  await p.keyboard.press('Enter');
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on');
  await p.waitForTimeout(1000);
  await clickFrame(p, 1540, 600);
  await waitFn(p, () => document.querySelector('.pace.in')?.dataset.kind === 'continue');
  await p.waitForTimeout(400);
  await p.keyboard.press(' ');
  await p.waitForTimeout(250);
  check('E Space continues a hold (how=key)', (await evs(p, 'manual_advance')).some(e => e.how === 'key'));
  await waitFn(p, () => document.querySelector('.pace.in')?.dataset.kind === 'skip', null, 60000);
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(300);
  check('E → skips a replay (how=key)', (await evs(p, 'skip_replay')).some(e => e.how === 'key'));
  await waitFn(p, () => !!document.querySelector('.p1.in'));
  await p.waitForTimeout(700);
  let k = 0;
  while (k++ < 8) {
    await p.keyboard.press('Tab');
    if (await p.evaluate(() => document.activeElement?.dataset?.k === 'shots')) break;
  }
  check('E the lens door is reachable by Tab', await p.evaluate(() => document.activeElement?.dataset?.k === 'shots'), k);
  await p.keyboard.press('Enter');
  await waitFn(p, () => document.body.dataset.beat === 'look_shots_found');
  await p.waitForTimeout(700);
  await p.keyboard.press('Escape');
  await waitFn(p, () => !!document.querySelector('.p1.in'));
  check('E Esc leaves the story lens → same stop', (await evs(p, 'context_return')).some(e => e.destination === 'stop'));
  await c.close();
}
R.errors = [...new Set(R.errors)];
check('no page errors', R.errors.length === 0, R.errors.join(' | '));
fs.writeFileSync(`${out}_results.json`, JSON.stringify(R, null, 1));
const f = R.checks.filter(x => !x.ok).length;
console.log(`\n${R.checks.length - f}/${R.checks.length} checks passed (${vpk}${RM ? ', reduced motion' : ''})`);
await b.close();
process.exit(f ? 1 : 0);
