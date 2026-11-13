import { chromium } from 'playwright';
import fs from 'node:fs';
import { reach } from './lib/reach.mjs';
const [base, out, seg = 'a', vpk = 'phone'] = process.argv.slice(2);
const VPS = {
  z125: {
    viewport: {
      width: 1024,
      height: 576
    }
  },
  z150: {
    viewport: {
      width: 853,
      height: 480
    }
  },
  phone: {
    viewport: {
      width: 390,
      height: 844
    },
    isMobile: true,
    hasTouch: true
  },
  se: {
    viewport: {
      width: 320,
      height: 568
    },
    isMobile: true,
    hasTouch: true
  },
  s375: {
    viewport: {
      width: 375,
      height: 667
    },
    isMobile: true,
    hasTouch: true
  },
  tiny: {
    viewport: {
      width: 360,
      height: 640
    },
    isMobile: true,
    hasTouch: true
  },
  big: {
    viewport: {
      width: 430,
      height: 932
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
  tab: {
    viewport: {
      width: 768,
      height: 1024
    },
    isMobile: true,
    hasTouch: true
  },
  tabl: {
    viewport: {
      width: 1024,
      height: 768
    }
  },
  short: {
    viewport: {
      width: 1280,
      height: 720
    }
  },
  desktop: {
    viewport: {
      width: 1440,
      height: 900
    }
  },
  fhd: {
    viewport: {
      width: 1920,
      height: 1080
    }
  }
};
fs.mkdirSync(out, {
  recursive: true
});
const R = {
  seg,
  vp: vpk,
  checks: [],
  geo: {},
  errors: []
};
const check = (n, ok, info = '') => {
  R.checks.push({
    n,
    ok: !!ok,
    info: String(info).slice(0, 500)
  });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  · ' + String(info).slice(0, 300)}`);
};
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const c = await b.newContext({
  ...VPS[vpk],
  ...(process.env.RM ? {
    reducedMotion: 'reduce'
  } : {})
});
const p = await c.newPage();
p.on('pageerror', e => R.errors.push(String(e)));
const shot = async n => {
  await p.waitForTimeout(400);
  await p.screenshot({
    path: `${out}/feat_${vpk}_${n}.png`
  });
};
const geo = async n => {
  const g = await p.evaluate(reach);
  R.geo[n] = g;
  return g;
};
const txt = s => p.evaluate(x => [...document.querySelectorAll(x)].filter(e => e.getClientRects().length).map(e => e.innerText).join(' ').replace(/\s+/g, ' ').trim(), s);
const beat = (re, ms = 60000) => p.waitForFunction(r => new RegExp(r).test(document.body.dataset.beat || ''), re, {
  timeout: ms
});
const bottomAll = () => p.evaluate(() => document.querySelectorAll('*').forEach(e => {
  const cs = getComputedStyle(e);
  if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) e.scrollTop = e.scrollHeight;
}));
const acts = () => p.$$eval('.lk-act', a => a.filter(e => e.getClientRects().length).map(e => e.dataset.a));
if (seg === 'a') {
  await p.goto(base + '?fs=0');
  await p.waitForFunction(() => !!window.__ctx);
  await p.waitForTimeout(800);
  check('fan mode: no E1 Lab control, all four features on by default', !(await p.$('.e1-lab')) && /pts=1/.test(p.url()) && /follow=steps/.test(p.url()) && /selects_map=1/.test(p.url()) && /cards=1/.test(p.url()), p.url());
  await shot('score');
  await geo('score');
  await p.click('#score .sl-look');
  await p.waitForSelector('.lk-card', {
    timeout: 60000
  });
  await p.waitForTimeout(1200);
  const cards = await p.$$eval('.lk-card', a => a.map(e => e.dataset.inv));
  check("hub: the three original investigations (Ridge map is contextual, not a 4th card)", cards.length === 3 && !cards.includes('shots_sel'), cards.join(','));
  await shot('hub');
  await geo('hub');
  await p.goto(base + '?fs=0&lens=shots');
  await beat('look_shots_predict', 30000);
  await p.click('.lk-pred .pick[data-c=far]');
  await beat('^look_shots_found$');
  await p.waitForTimeout(1500);
  await shot('shots_found');
  await geo('shots_found');
  check("Harbour Shots: no \"How we know\" / Technical details trigger", !(await p.$('.lk-whybtn, details.lk-tech, .lk-sheet')));
  const cav = await txt('.lk3-cav');
  check("Harbour Shots: distance limit visible next to the finding", /how hard a shot was to stop/.test(cav) && /small number/.test(cav), cav);
  const hero = await txt('.lk3');
  check("Harbour Shots: 61 attempts with Novak in goal, incl. missed and blocked", /61 Harbour shot attempts with Novak in goal, including missed and blocked/.test(hero), hero);
  check("Harbour Shots: no early Ridge door before GP-09 has been revealed", !(await acts()).includes('other'), (await acts()).join(','));
  const sum = await txt('.b1-more > summary');
  check("Harbour Shots: one optional layer, titled with a fan question", sum === 'How did each distance go?', sum);
  await p.$eval('.b1-more', d => {
    d.open = true;
    d.scrollIntoView({
      block: 'start'
    });
  });
  await p.waitForTimeout(400);
  const rows = await p.$$eval('.b1-btab tbody tr', a => a.map(r => [...r.children].map(c => c.innerText.trim())));
  check("Harbour table: 3 columns, All = 61 attempts / 4 goals; empty-net goal stated as outside", rows.length === 4 && rows.every(r => r.length === 3) && rows[3][1] === '61' && rows[3][2] === '4' && /empty net/.test(await txt('.b1-more')), JSON.stringify(rows));
  await shot('shots_more');
  await geo('shots_more');
  await p.evaluate(() => sessionStorage.setItem('sl.b1.gp09', '1'));
  await p.goto(base + '?fs=0&lens=shots');
  await beat('look_shots_predict', 30000);
  await p.click('.lk-pred .pick[data-c=far]');
  await beat('^look_shots_found$');
  await p.waitForTimeout(1200);
  check("after GP-09: \"And the other side?\" offered from the Harbour map", (await acts()).includes('other'), (await acts()).join(','));
  await bottomAll();
  await p.click('.lk-act[data-a=other]');
  await beat('look_shots_sel_predict', 30000);
  await p.waitForTimeout(600);
  await shot('sel_predict');
  await p.click('.lk-pred .pick[data-c=close]');
  await beat('^look_shots_sel_found$', 60000);
  await p.waitForTimeout(1800);
  await shot('sel_found');
  await geo('sel_found');
  const sh = await txt('.lk3');
  check("Ridge map: hero + 47 attempts on Albers", /47 Ridge attempts/.test(sh) && /3 goals on Albers/.test(sh), sh);
  const sc = await txt('.lk3-cav');
  check("Ridge map: visible limit incl. \"not a goalie comparison\"", /not a goalie comparison/.test(sc), sc);
  const marks = await p.evaluate(() => window.__selmap?.().marks?.length);
  check("Ridge map: all 47 attempts drawn on entry", marks === 47, marks);
  const ab = await p.$('.lk-allbtn');
  if (ab) {
    await ab.click();
    await p.waitForTimeout(500);
  }
  const g = await p.evaluate(() => [...document.querySelectorAll('.lk-mapg .lk-att')].map(e => e.classList.contains('goal')));
  check("Ridge map: Goals only draws exactly the 3 goals", g.length === 3 && g.every(Boolean), JSON.stringify(g));
  await shot('sel_goals');
  await p.$eval('.b1-more', d => {
    d.open = true;
    d.scrollIntoView({
      block: 'start'
    });
  });
  await p.waitForTimeout(400);
  const srows = await p.$$eval('.b1-btab tbody tr', a => a.map(r => [...r.children].map(c => c.innerText.trim())));
  check("Ridge table: All = 47 / 3; close-in counted", srows[3]?.[1] === '47' && srows[3]?.[2] === '3' && srows[0]?.[2] === '2', JSON.stringify(srows));
  await shot('sel_more');
  await geo('sel_more');
  await bottomAll();
  check("Ridge map: \"Back to the Harbour map\" offered", (await acts()).includes('davos'), (await acts()).join(','));
  await p.click('.lk-act[data-a=davos]');
  await beat('^look_shots_found$', 30000);
  check("Back to the Harbour map returns to the Harbour finding", true);
}
if (seg === 'b') {
  await p.goto(base + '?fs=0&lens=follow');
  await beat('^look_follow_intro$', 30000);
  await p.waitForTimeout(800);
  await shot('follow_intro');
  await p.locator('.fs-pane[data-i="0"] .lk-tok .ring').click();
  await p.waitForTimeout(1500);
  await shot('follow_1');
  await geo('follow_1');
  const gq = await p.$('.fs-guess button[data-a=same]');
  if (gq) {
    await gq.click();
    await p.waitForTimeout(1800);
  }
  if (!(await p.$('.fs-pane[data-i="1"].open'))) {
    await p.locator('.fs-pane[data-i="1"] .lk-tok .ring').click();
    await p.waitForTimeout(1800);
  }
  await p.waitForSelector('.fs-panes.final', {
    timeout: 20000
  }).catch(() => {});
  await p.waitForTimeout(1500);
  await shot('follow_both');
  await geo('follow_both');
  check('Follow: guess acknowledged, never graded', !/called it|wrong|correct|Not what you guessed/i.test(await txt('#story, .fs-panes')), '');
  const key = await txt('.fs-key');
  check('Follow: one-line key keeps the "not his path" limit', /not his path/.test(key) && key.length < 130, key);
  const slot = await txt('.lk-chance .lk-cslot');
  check('Follow: chance cards carry one short passer line', (slot.match(/Haldane/g) || []).length <= 2 && !/Harbour · #72/.test(slot), slot);
  const fn = await p.$('.fs-next');
  if (fn) await fn.click();
  await beat('^look_follow_found$');
  await p.waitForTimeout(1500);
  await shot('follow_found');
  await geo('follow_found');
  const same = await txt('.fs-same');
  check('Follow: the relation is one badge (Same player · name), no repeated narration', /Same player/i.test(same) && !/assist/.test(same), same);
  const fh = await txt('.lk3');
  check("Follow finding: 2 of 2, Haldane, not-an-assist and last-pass limit visible", /2 of 2/.test(fh) && /Haldane/.test(fh) && /not who made it happen/.test(fh), fh);
  const cb = await p.$('.e1-cardbtn');
  check("Follow finding: Haldane’s match card available", !!cb);
  if (cb) {
    await cb.click();
    await p.waitForSelector('.e1-card');
    await p.waitForTimeout(300);
    await shot('card_match');
    await geo('card');
    const ct = await txt('.e1-card');
    const dts = await p.$$eval('.e1-card dt', a => a.map(e => e.innerText.trim()));
    check('Match card: no glossary / How we know / experiment label', !/How we know|E1|experiment|Passes that reached|as recorded by/i.test(ct), ct);
    check('Match card: whole match shows 6 counts incl. goals and assists', dts.length === 6 && dts.some(d => /Goals/i.test(d)), dts.join(','));
    await p.click('.e1-per [data-p=p2]');
    await p.waitForTimeout(200);
    const d2 = await p.$$eval('.e1-card dt', a => a.map(e => e.innerText.trim()));
    check('Match card: period tab never shows goals/assists (not in the export per period)', d2.length === 4 && !d2.some(d => /Goals|Assists/i.test(d)) && /whole match only/.test(await txt('.e1-cnote')), d2.join(','));
    await shot('card_p2');
    const tot = await p.evaluate(async () => {
      const D = await (await fetch('/data/player_cards.json')).json();
      const bad = [];
      for (const [k, v] of Object.entries(D.players)) {
        if (!v.periods) continue;
        for (const f of ['s', 'toi', 'shifts', 'pc', 'pa']) {
          const sum = ['p1', 'p2', 'p3'].reduce((a, q) => a + (v.periods[q]?.[f] || 0), 0);
          if (Math.abs(sum - v.periods.all[f]) > (f === 'toi' ? 3 : 0)) bad.push(`${v.name}:${f} ${sum}≠${v.periods.all[f]}`);
        }
      }
      return {
        n: Object.keys(D.players).length,
        bad,
        goalies: Object.values(D.players).filter(v => !v.periods).length
      };
    });
    check(`Match cards: periods add up to the match for every skater (${tot.n} players, ${tot.goalies} goalies without stats)`, !tot.bad.length, tot.bad.join(' | '));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    check('Match card: Esc closes and focus returns to the opener', !(await p.$('.e1-card')) && (await p.evaluate(() => document.activeElement?.classList.contains('e1-cardbtn'))));
  }
  const sum = await txt('.b1-more > summary');
  check('Follow: optional layer titled with a fan question', sum === 'Is he an unusual passer?', sum);
  await p.$eval('.b1-more', d => {
    d.open = true;
    d.scrollIntoView({
      block: 'start'
    });
  });
  await p.waitForTimeout(400);
  const mt = await txt('.b1-more');
  check('Follow More detail: usual-rate answer + who else was on the ice; no model ratings', /^.*No\. 13 of his 27/.test(mt) && /Reyes/.test(mt) && !/0\.41|shot model/i.test(mt), mt);
  await shot('follow_more');
  await geo('follow_more');
  await p.goto(base + '?fs=0&lens=hold');
  await p.waitForSelector('.lk-act[data-a=ice]', {
    timeout: 60000
  });
  await p.click('.lk-act[data-a=ice]');
  await p.waitForSelector('.lk-act[data-a=q]', {
    timeout: 60000
  });
  await bottomAll();
  await p.click('.lk-act[data-a=q]');
  await p.waitForTimeout(900);
  await bottomAll();
  await p.click('.lk-pred .pick[data-c=same]');
  await beat('^look_hold_found$');
  await p.waitForTimeout(1500);
  await shot('hold_found');
  await geo('hold_found');
  const ht = await txt('.lk3');
  check('Watch the Ice: 5 of 5 + not-tiredness limit visible', /5 of 5/.test(ht) && /tired/.test(ht), ht);
  await p.$eval('.b1-more', d => {
    d.open = true;
    d.scrollIntoView({
      block: 'start'
    });
  });
  await p.waitForTimeout(400);
  const hm = await txt('.b1-more');
  check('Watch the Ice More detail: who was on, for how long; no typical-shift method prose', /Who was on the ice at 9:31\?/.test(hm) && /:/.test(hm) && /No whistle/.test(hm) && !/794|middle value/.test(hm), hm.slice(0, 200));
  await shot('hold_more');
  await geo('hold_more');
  await p.evaluate(() => window.__ctx.points?.open('qa'));
  await p.waitForSelector('.pts-sheet');
  await p.waitForTimeout(300);
  await shot('points');
  await geo('points');
  check('Points: no Share button (removed in B1)', !(await p.$('.pts-share')) && !/Share/.test(await txt('.pts-sheet')));
  const sbw = await p.$eval('.pts-sheet .sbox', e => getComputedStyle(e).scrollbarWidth);
  check('Points: themed thin scrollbar on the panel', sbw === 'thin', sbw);
  const st = await p.evaluate(() => window.__ctx.points.state());
  check(`Points: total ${st.total} = sum of found discoveries (no READ grading events)`, st.total > 0 && st.total <= 100, JSON.stringify(st));
  await p.click('.pts-reset');
  const armed = await txt('.pts-reset');
  check('Points: Start over asks once before clearing', /Tap again/.test(armed) && (await p.evaluate(() => window.__ctx.points.state().total)) === st.total, armed);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  check('Points: Esc closes the panel', !(await p.$('.pts-sheet')));
}
const bad = Object.entries(R.geo).filter(([, g]) => g.hscroll || g.unreach.length || g.overlap.length || g.clipped.length);
check(`B1 geometry (${Object.keys(R.geo).length} states): no side scroll, controls reachable, nothing clipped, no overlay on text`, !bad.length, bad.map(([k, g]) => `${k}:${JSON.stringify(g)}`).join(' | '));
R.errors = [...new Set(R.errors)];
check('no page errors', !R.errors.length, R.errors.join(' | '));
fs.writeFileSync(`${out}/feat_${seg}_${vpk}_results.json`, JSON.stringify(R, null, 1));
const f = R.checks.filter(x => !x.ok).length;
console.log(`${R.checks.length - f}/${R.checks.length} checks passed (features ${seg}, ${vpk})`);
await b.close();
process.exit(f ? 1 : 0);
