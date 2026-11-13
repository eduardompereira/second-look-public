import { chromium } from 'playwright';
import fs from 'node:fs';
const [base, out, vpk = 'phone'] = process.argv.slice(2);
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
async function newPage(q) {
  const c = await b.newContext({
    ...VP,
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
}
const evs = (p, type) => p.evaluate(t => window.__ev.filter(e => e.type === t), type);
const waitFn = async (p, fn, arg, ms = 150000) => {
  const s = Date.now();
  while (Date.now() - s < ms) {
    if (await p.evaluate(fn, arg).catch(() => false)) return true;
    await p.waitForTimeout(80);
  }
  throw new Error('timeout ' + String(fn).slice(0, 120));
};
const ff = async (p, fn, arg, ms = 150000) => {
  const s = Date.now();
  while (Date.now() - s < ms) {
    if (await p.evaluate(fn, arg).catch(() => false)) return true;
    if (await p.evaluate(() => !!document.querySelector('.pace.in'))) await p.click('.pace.in').catch(() => {});
    await p.waitForTimeout(120);
  }
  throw new Error('timeout ' + String(fn).slice(0, 120));
};
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
const pts = p => p.evaluate(() => window.__ctx.points?.state());
const pillVisible = p => p.evaluate(() => {
  const e = document.querySelector('.pts');
  if (!e || e.hidden) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
});
const awards = async p => (await evs(p, 'points_award')).map(e => e.id);
{
  const {
    p,
    c
  } = await newPage('?fs=0&e1=0');
  await p.click('#score .sl-hook');
  await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on');
  await p.waitForTimeout(800);
  await clickFrame(p, 1540, 600);
  await ff(p, () => !!document.querySelector('.p1.in'));
  const none = await p.evaluate(() => ({
    el: !!document.querySelector('.pts, .pts-strip'),
    css: !!document.querySelector('link[href="/css/points.css"]'),
    api: !!window.__ctx.points,
    logged: window.__ev.filter(e => e.type.startsWith('points_')).length
  }));
  check('0 default (no ?pts=1): no points element, stylesheet, API or log event', !none.el && !none.css && !none.api && none.logged === 0, JSON.stringify(none));
  await c.close();
}
const {
  p,
  c
} = await newPage('?fs=0&pts=1');
await c.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
check('1 score page, first visit: no points line, no pill (the hook stays the only action)', !(await p.$('#score .pts-strip')) && !(await pillVisible(p)));
await p.click('#score .sl-hook');
await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on');
await p.waitForTimeout(600);
await shot(p, '1_read_no_pill');
check('1 GP-02 READ: pill hidden, nothing awarded before the reveal', !(await pillVisible(p)) && (await awards(p)).length === 0);
await clickFrame(p, 1540, 600);
let seenDuring = false;
await (async () => {
  const s = Date.now();
  while (Date.now() - s < 150000) {
    const o = await p.evaluate(() => {
      const e = document.querySelector('.pts'),
        r = e?.getBoundingClientRect();
      return {
        stop: window.__ev.some(x => x.type === 'choice1_shown'),
        vis: !!e && !e.hidden && r.width > 0,
        beat: document.body.dataset.beat
      };
    });
    if (o.stop) break;
    if (o.vis) seenDuring = o.beat || true;
    if (await p.evaluate(() => !!document.querySelector('.pace.in'))) await p.click('.pace.in').catch(() => {});
    await p.waitForTimeout(100);
  }
})();
await waitFn(p, () => !!document.querySelector('.p1.in'));
check('1 pill never visible between the READ and the first stop (acknowledge · look again · reveal)', !seenDuring);
await p.waitForTimeout(700);
let s = await pts(p);
check('1 first stop: pill visible, 10 points for "What was in front of the winner"', (await pillVisible(p)) && s.total === 10 && s.found.join() === 'gp02', JSON.stringify(s));
await waitFn(p, () => document.querySelector('.pts')?.classList.contains('gaining'), null, 5000).catch(() => {});
await p.waitForTimeout(450);
const gain = await p.evaluate(() => {
  const tip = document.querySelector('.pts-tip');
  return {
    live: document.querySelector('.pts-live')?.textContent || '',
    vis: document.querySelector('.pts-gain')?.innerText || '',
    tip: tip && !tip.hidden ? tip.innerText : ''
  };
});
check('1 first stop: visibly says WHAT earned the points (in the pill, or "Discovered: …" under it)', /^\+10/.test(gain.vis) && /in front of the winner/.test(gain.live) && (/in front of the winner/.test(gain.vis) || /^Discovered: What was in front of the winner/.test(gain.tip)), JSON.stringify(gain));
const overlap = await p.evaluate(() => {
  const boxes = [...document.querySelectorAll('.pts-pill, .pts-tip:not([hidden])')].map(e => e.getBoundingClientRect());
  const ink = el => {
    if (/^(BUTTON|I)$/.test(el.tagName) || el.classList.contains('chap')) return el.getBoundingClientRect();
    const rg = document.createRange();
    rg.selectNodeContents(el);
    return rg.getBoundingClientRect();
  };
  return [...document.querySelectorAll('#story .chap, #story .x, #story .cap.top .ln, #story .act button, .next:not([hidden]) .nx-k > *')].filter(el => {
    const b = ink(el);
    return b.width && boxes.some(r => !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom));
  }).map(el => el.className);
});
check('1 first stop: the pill and its text cover no caption, choice, chapter dots or close button', overlap.length === 0, overlap.join(','));
const ctxBeforeAward = await p.evaluate(() => {
  const a = window.__ev.find(e => e.type === 'points_award'),
    c = window.__ev.find(e => e.type === 'context_shown' && e.beat === 'gp02'),
    tap = window.__ev.find(e => e.type === 'attention_tap' || e.type === 'attention_not_sure');
  return !!a && !!c && !!tap && c.t_ms <= a.t_ms && a.t_ms > tap.t_ms + 500;
});
check('1 the award follows the reveal (context_shown gp02), not the READ tap', ctxBeforeAward);
await shot(p, '1_stop_pill');
await p.click('.pts-pill');
await p.waitForSelector('.pts-sheet');
const rows = await p.$$eval('.pts-sheet li', ls => ls.map(l => l.className));
check('3 panel: 10 discoveries listed, 1 found', rows.length === 10 && rows.filter(x => x === 'got').length === 1, rows.join(','));
check('3 panel says reads are never scored', /never scored/.test(await p.evaluate(() => document.querySelector('.pts-sheet')?.innerText || '')));
await shot(p, '3_panel_stop');
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
check('3 Esc closes the panel and stays at the stop', !(await p.$('.pts-sheet')) && (await p.evaluate(() => !!document.querySelector('.p1.in'))));
await p.click('.p1 [data-k=shots]');
await waitFn(p, () => document.body.dataset.beat === 'look_shots_found');
await p.waitForTimeout(1200);
s = await pts(p);
check("3 lens finding: +15 (Where did Harbour beat Novak?), pill visible under the lens bar", s.total === 25 && (await pillVisible(p)), JSON.stringify(s));
await shot(p, '3_lens_found_pill');
await p.click('.lk3-more > summary');
const upd = await waitFn(p, () => document.querySelector('.pts-n')?.textContent === '30', null, 4000).catch(() => false);
s = await pts(p);
check('3 More detail: +5 evidence, updated in place', upd && s.total === 30 && s.found.includes('evidence'), JSON.stringify(s));
await p.click('.lk3-more > summary');
await p.click('.pts-pill');
await p.waitForSelector('.pts-sheet');
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
check('3 Esc on the panel inside a story lens does NOT leave the lens', await p.evaluate(() => document.body.dataset.beat === 'look_shots_found' && location.hash.startsWith('#lens=shots')));
await p.click('.lk-act[data-a=origin]');
await waitFn(p, () => !!document.querySelector('.p1.in'));
await p.waitForTimeout(500);
check('3 back at the stop: pill shown again, same total (no double award)', (await pillVisible(p)) && (await pts(p)).total === 30 && (await awards(p)).length === 3);
await p.click('.p1 [data-k=next]');
await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 'use_it');
check('1 GP-04 READ: pill hidden', !(await pillVisible(p)));
await p.waitForTimeout(500);
await clickFrame(p, 430, 560);
await ff(p, () => !!document.querySelector('.next.on .showme'));
await p.waitForTimeout(2300);
s = await pts(p);
check('1 Story 1 end: +15 (GP-04 + twin), 45 total, pill visible', s.total === 45 && (await pillVisible(p)), JSON.stringify(s));
const ov1 = await p.evaluate(() => {
  const r = document.querySelector('.pts-pill').getBoundingClientRect();
  return [...document.querySelectorAll('.next:not([hidden]) .nx-k *, .next:not([hidden]) .nx-card *')].filter(el => {
    if (!el.childNodes.length || [...el.childNodes].every(n => n.nodeType !== 3)) return false;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const b = rg.getBoundingClientRect();
    return b.width && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
  }).map(el => el.tagName + '.' + el.className);
});
check('1 Story 1 end: the pill covers none of the end screen\'s text', ov1.length === 0, ov1.join(','));
await shot(p, '1_carry1_pill');
await p.click('.next .showme');
await p.waitForSelector('.callbtn[data-c=goal]', {
  timeout: 120000
});
check('2 GP-03 call: pill hidden', !(await pillVisible(p)));
await p.waitForTimeout(800);
await p.click('.callbtn[data-c=goal]');
await ff(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 's2_commit');
check('2 GP-03 after a "Goal" call on a save: +5 all the same (ungraded)', (await awards(p)).includes('gp03') && (await evs(p, 'story2_bridge_call')).at(-1)?.call === 'goal');
check('2 GP-08 READ: pill hidden', !(await pillVisible(p)));
await p.waitForTimeout(500);
await p.click('[data-k=notsure]');
await ff(p, () => !!document.querySelector('.bridge .s2c.in'));
check('2 GP-08 after "Not sure": +10 all the same (ungraded)', (await awards(p)).includes('gp08') && (await evs(p, 'gp08_commit_not_sure')).length === 1);
await p.click('.s2c [data-k=next]');
await waitFn(p, () => window.__ctx.stage.wrap.dataset.tap === 'on' && document.body.dataset.beat === 's2_use_it');
check('1 GP-09 READ: pill hidden', !(await pillVisible(p)));
await p.waitForTimeout(500);
await clickFrame(p, 685, 610);
await ff(p, () => !!document.querySelector('.next.on [data-k=done]'));
await p.waitForTimeout(1500);
s = await pts(p);
check('4 Story 2 end: 70 / 100, pill visible', s.total === 70 && (await pillVisible(p)), JSON.stringify(s));
const ids = await awards(p);
check('4 awards are exactly the discoveries reached, each once', ids.join() === 'gp02,shots,evidence,gp04,twin,gp03,gp08,gp09', ids.join());
const readEv = await p.evaluate(() => window.__ev.filter(e => /(_tap|_not_sure|bridge_call)$/.test(e.type)).map(e => e.type));
check('2 no points event is ever logged at a READ (reads are not scored)', await p.evaluate(() => {
  const ev = window.__ev;
  return ev.every((e, i) => e.type !== 'points_award' || !/(_tap|_not_sure|_region|_coded|bridge_call)$/.test(ev[i - 1]?.type || ''));
}), readEv.join(','));
await shot(p, '4_carry2_pill');
await p.click('.next [data-k=done]');
await p.waitForURL(/back=1/, {
  timeout: 10000
});
await hook(p);
await p.waitForSelector('#score .sl-hook');
check('4 Back to the score keeps ?pts=1', /[?&]pts=1/.test(p.url()), p.url());
await p.waitForSelector('#score .pts-strip', {
  timeout: 5000
}).catch(() => {});
const strip = await p.evaluate(() => document.querySelector('#score .pts-strip')?.innerText.replace(/\s+/g, ' ') || '');
check('4 score page on return: "70 / 100 points · 2 still to discover"', /70 \/ 100/.test(strip) && /2 still to discover/.test(strip), strip);
check('4 the line sits under the hook (the hook stays first)', await p.evaluate(() => {
  const h = document.querySelector('#score .sl-hook'),
    st = document.querySelector('#score .pts-strip');
  return !!h && !!st && !!(h.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING);
}));
await shot(p, '4_score_return');
await p.click('#score .pts-strip');
await p.waitForSelector('.pts-sheet');
const todo = await p.$$eval('.pts-sheet li.todo span', x => x.map(e => e.innerText));
check('4 panel lists what is left with the product\'s own lens names (B0)', todo.join('|') === 'The last pass|Who was on the ice', todo.join('|'));
await shot(p, '4_panel_score');
await p.click('.pts-share');
await p.waitForTimeout(400);
const sh = (await evs(p, 'points_share')).at(-1);
check('4 Share works without a native share sheet (clipboard or visible text)', sh && ['clipboard', 'shown', 'native'].includes(sh.how), JSON.stringify(sh));
await p.click('.pts-reset');
await p.waitForTimeout(200);
check('4 Start over: 0 points, score line removed', (await pts(p)).total === 0 && !(await p.$('#score .pts-strip')));
await p.click('.pts-close');
await p.click('#score .sl-look');
await waitFn(p, () => document.body.dataset.beat === 'look_home');
await p.waitForTimeout(600);
check('4 hub: pill visible (0 / 100) under the lens bar', (await pillVisible(p)) && (await pts(p)).total === 0);
await shot(p, '4_hub_pill');
await c.close();
R.errors = [...new Set(R.errors)];
check('no page errors', R.errors.length === 0, R.errors.join(' | '));
fs.writeFileSync(`${out}_results.json`, JSON.stringify(R, null, 1));
const f = R.checks.filter(x => !x.ok).length;
console.log(`\n${R.checks.length - f}/${R.checks.length} points checks passed (${vpk})`);
await b.close();
process.exit(f ? 1 : 0);
