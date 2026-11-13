import { sleep, reduced } from '../engine/stage.js';
import { classify } from '../engine/regions.js';
import { nl2br, READ, evd } from '../engine/ui.js';
export const CHAPTERS_W2 = [{
  id: 'first',
  label: 'First look'
}, {
  id: 'second',
  label: 'Second look'
}, {
  id: 'read',
  label: 'Your read'
}];
export const STORY_W2_CARRY_RETURN = {
  id: 'w3c_story2_carry_return',
  beats: [{
    id: 's2_carry',
    seg: 'read',
    type: 's2_carry'
  }]
};
export const STORY_W2 = {
  id: 'w3c_story2',
  forbidClips: [],
  beats: [{
    id: 's2_bridge',
    type: 's2_bridge',
    clip: 'gp03'
  }, {
    id: 's2_watch',
    seg: 'first',
    type: 'gp08_watch',
    clip: 'gp08'
  }, {
    id: 's2_commit',
    seg: 'first',
    type: 'gp08_commit',
    clip: 'gp08'
  }, {
    id: 's2_turn',
    seg: 'second',
    type: 'gp08_turn'
  }, {
    id: 's2_see_again',
    seg: 'second',
    type: 'gp08_see_again',
    clip: 'gp08'
  }, {
    id: 's2_name',
    seg: 'second',
    type: 'gp08_name',
    clip: 'gp08'
  }, {
    id: 's2_forward',
    seg: 'read',
    type: 's2_forward',
    clip: 'gp09'
  }, {
    id: 's2_use_it',
    seg: 'read',
    type: 'gp09_use_it',
    clip: 'gp09'
  }, {
    id: 's2_use_it_reveal',
    seg: 'read',
    type: 'gp09_reveal',
    clip: 'gp09'
  }, {
    id: 's2_use_it_name',
    seg: 'read',
    type: 'gp09_name',
    clip: 'gp09'
  }, {
    id: 's2_carry',
    seg: 'read',
    type: 's2_carry'
  }]
};
const P = {
  gp03: {
    watch: [9.4, 11.64],
    freeze: 11.64,
    reveal_to: 14.33,
    x0: 452
  },
  gp08: {
    watch: [2.17, 10.84],
    x0: 53,
    shotF: 7.8,
    passF: 6.5,
    goalTo: 10.84,
    shooterA: [931, 1104],
    shooterAR: [96, 218],
    passerA: [1196, 931],
    passerAR: [230, 102],
    line: [[1164, 690], [884, 445]],
    dim: [1076, 1278],
    lightShooterA: {
      cx: 395,
      cy: 1263,
      rx: 75,
      ry: 70
    },
    lightPasserA: {
      cx: 1096,
      cy: 590,
      rx: 167,
      ry: 99
    },
    slowRate: 0.5,
    regions: [{
      id: 'passer',
      kind: 'ellipse',
      cx: 436,
      cy: 473,
      rx: 258,
      ry: 54
    }, {
      id: 'shooter',
      kind: 'ellipse',
      cx: 913,
      cy: 1756,
      rx: 36,
      ry: 116
    }, {
      id: 'net',
      kind: 'ellipse',
      cx: 1461,
      cy: 1321,
      rx: 190,
      ry: 76
    }]
  },
  gp09: {
    watch: [0.92, 7.03],
    x0: 1742,
    freeze: 7.03,
    shotF: 8.17,
    slow: [7.03, 8.17],
    slowRate: 0.4,
    goalTo: 10.08,
    shooterB: [1729, 359],
    passerB: [869, 1779],
    lightShooterB: {
      cx: 634,
      cy: 1629,
      rx: 102,
      ry: 225
    },
    passerBS: [290, 995],
    shooterBS: [684, 1389],
    shooterBSR: [243, 99],
    passerBSR: [228, 237],
    line: [[1145, 743], [1547, 1232]],
    lightShot: {
      cx: 527,
      cy: 1503,
      rx: 462,
      ry: 62
    },
    regions: [{
      id: "shooterB",
      kind: 'ellipse',
      cx: 1286,
      cy: 838,
      rx: 172,
      ry: 162
    }, {
      id: "passerB",
      kind: 'ellipse',
      cx: 438,
      cy: 573,
      rx: 139,
      ry: 89
    }, {
      id: 'goalie',
      kind: 'ellipse',
      cx: 690,
      cy: 201,
      rx: 240,
      ry: 194
    }, {
      id: 'slot_high',
      kind: 'ellipse',
      cx: 1694,
      cy: 1267,
      rx: 211,
      ry: 213
    }, {
      id: 'far_side',
      kind: 'ellipse',
      cx: 465,
      cy: 570,
      rx: 1791,
      ry: 55
    }],
    intended: ["shooterB", 'far_side']
  }
};
const TURN8 = {
  passer: ['You went back across the ice.', 'Watch it come from there.'],
  shooter: ['You stayed with the shooter.', 'Look one second back.'],
  net: ['You watched the net.', 'Look one second back.'],
  elsewhere: ['You marked your spot.', 'Look one second back.'],
  not_sure: ['Hard to say at full speed.', 'Look one second back.']
};
const ACK9 = {
  shooterB: 'You looked across.',
  far_side: 'You looked across.',
  slot_high: 'You marked the slot.',
  passerB: 'You marked the puck.',
  goalie: 'You marked the near post.',
  elsewhere: 'You marked your spot.',
  not_sure: 'Hard to call at full speed.'
};
const ctxLine = (period, score) => `<em>${period}</em><b>${score}</b>`;
const ti = (v, u) => `<span class="ti">${v}<u> ${u}</u></span>`;
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
async function commit(ctx, {
  q,
  sub,
  regions,
  ev
}) {
  const {
    stage,
    cap,
    log
  } = ctx;
  const shown = performance.now();
  const notSure = cap.question(q, sub);
  ctx.tapAffordance?.(true);
  const res = await Promise.race([stage.tap(), notSure.then(() => {
    stage.cancelTap();
    return null;
  })]);
  const latency_ms = Math.round(performance.now() - shown);
  const region = classify(res, regions);
  if (res) {
    stage.fanRing([res.x, res.y]);
    log.log(`${ev}_commit_tap`, {
      x: res.x,
      y: res.y,
      region,
      latency_ms
    });
  } else log.log(`${ev}_commit_not_sure`, {
    latency_ms,
    region: 'not_sure'
  });
  ctx.tapAffordance?.(false);
  log.log(`${ev}_commit_region`, {
    region
  });
  log.log(`${ev}_commit_latency`, {
    latency_ms
  });
  cap.actEl.innerHTML = '';
  return {
    pt: res,
    region,
    latency_ms
  };
}
async function plate(root, {
  segs,
  score,
  ms,
  dir
}) {
  const br = root.querySelector('.bridge'),
    per = br.querySelector('.bper'),
    clk = br.querySelector('.bclk'),
    sc = br.querySelector('.bsc');
  if (!br.querySelector('.bsweep')) br.insertAdjacentHTML('beforeend', '<div class="bsweep"><i></i></div>');
  br.classList.remove('rew', 'fwd');
  br.querySelector('.bcap').className = 'bcap';
  br.querySelector('.bcap').innerHTML = '';
  per.textContent = segs[0].per;
  clk.textContent = fmt(segs[0].from);
  sc.textContent = score(segs[0].per, segs[0].from);
  sc.classList.remove('flip');
  br.hidden = false;
  requestAnimationFrame(() => br.classList.add('on'));
  await sleep(550);
  br.style.setProperty('--ms', `${ms}ms`);
  br.classList.add(dir === 'fwd' ? 'fwd' : 'rew');
  const total = segs.reduce((a, s) => a + Math.abs(s.to - s.from), 0);
  const t0 = performance.now();
  let last = sc.textContent;
  await new Promise(res => {
    const f = () => {
      const k = reduced() ? 1 : Math.min(1, (performance.now() - t0) / ms),
        e = 1 - (1 - k) ** 3;
      let d = total * e,
        i = 0;
      while (i < segs.length - 1 && d > Math.abs(segs[i].to - segs[i].from)) {
        d -= Math.abs(segs[i].to - segs[i].from);
        i++;
      }
      const s = segs[i],
        v = s.from + Math.sign(s.to - s.from) * Math.min(d, Math.abs(s.to - s.from));
      per.textContent = s.per;
      clk.textContent = fmt(v);
      const now = score(s.per, v);
      if (now !== last) {
        last = now;
        sc.textContent = now;
        sc.classList.remove('flip');
        void sc.offsetWidth;
        sc.classList.add('flip');
      }
      k < 1 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
  br.classList.remove('rew', 'fwd');
  return br;
}
async function plateCaption(br, html) {
  const c = br.querySelector('.bcap');
  c.innerHTML = html;
  requestAnimationFrame(() => c.classList.add('in'));
  await sleep(500);
}
async function plateOff(br) {
  br.classList.remove('on');
  await sleep(450);
  br.hidden = true;
  br.querySelector('.bcap').innerHTML = '';
}
export function handlersW2(S2, D, X) {
  const F = S2.facts,
    C = S2.cues;
  const f8 = F.gp08,
    f9 = F.gp09,
    f3 = F.gp03;
  const densityMs = (words, label) => Math.round(words * 60000 / READ.wpm) + (label ? READ.labelBuffer : READ.buffer);
  const holdNew = (cap, log, at, words, label) => {
    const ms = Math.max(READ.min, densityMs(words, label));
    log.log('read_hold', {
      at,
      words,
      ms,
      mode: 'auto'
    });
    return cap.holdW(ms, at);
  };
  const POLICY = {
    title: () => 2200,
    question: w => w * 300 + 300,
    hero: w => Math.min(4800, Math.round(w * 60000 / READ.wpm) + READ.buffer),
    coda: w => Math.min(5200, w * 300 + 500)
  };
  const rcHold = (cap, log, at, kind, words = cap.readingWords()) => {
    const ms = Math.max(READ.min, Math.round(POLICY[kind](words)));
    log.log('read_hold', {
      at,
      words,
      ms,
      mode: 'auto',
      policy: kind
    });
    return cap.holdW(ms, at);
  };
  const countW = html => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  };
  async function gp08NameRC2({
    stage,
    cap,
    log
  }) {
    const g = P.gp08;
    cap.clear(['top']);
    stage.park(false);
    stage.fanState('');
    await stage.light({
      cx: 1110,
      cy: 610,
      rx: 560,
      ry: 380
    }, {
      dim: 0.42,
      ms: 600
    });
    stage.halo(g.passerA, g.passerAR);
    await sleep(380);
    stage.halo(g.shooterA, g.shooterAR);
    log.log('reveal_shown', {
      beat: 'gp08',
      step: 'halos'
    });
    await sleep(800);
    await stage.line(g.line, {
      ms: 900
    });
    stage.arrow(g.line[0], g.line[1]);
    await sleep(300);
    stage.tag(g.passerA, "#11 Varga", 'davos', 'right pa');
    await sleep(240);
    stage.tag(g.shooterA, "#23 Sato", 'davos', 'below');
    log.log('reveal_shown', {
      beat: 'gp08',
      step: 'names'
    });
    await sleep(700);
    const hero = `<small>Pass to shot, across the ice</small><span class="tm">${f8.across_m}<u> m</u></span>`;
    stage.stamp(g.dim, hero, 'right hero');
    cap.low([`<span class="bignum">${hero}</span>`]);
    log.log('climax_shown', {
      beat: 'gp08',
      value: f8.across_m
    });
    const cue = ['One second earlier,', 'the puck was on the other side.'];
    await cap.top(cue, {
      stagger: 650
    });
    await holdNew(cap, log, 'gp08_name_cue', countW(cue.join(' ')) + countW(hero), true);
    const ctxLine8 = `No Ridge skater within ${ti(5, 'm')}: the most space any scorer had in this final.`;
    cap.ctx(ctxLine8);
    cap.src('Pass and shot positions.', evd([['Across', `<b>${f8.across_m} m</b> across the ice between where Varga’s pass started and where Sato shot, ${f8.pass_to_shot_s.toFixed(2)} s later. Not the puck’s path.`], ['Space', `Nearest Ridge skater at the shot: <b>${X.gp08.nearest_selects_m} m</b>, the most for any goal on a goalie. An association, not the reason the goal went in.`]]));
    log.log('context_shown', {
      beat: 'gp08',
      fact: 'most_space_of_any_scorer'
    });
    log.log('gp08_name_reached');
    await rcHold(cap, log, 'gp08_name', 'hero', countW(ctxLine8));
    stage.fadeMarks(450);
    cap.clear(['top', 'low', 'ev']);
    cap.ctx('');
    await stage.lightOff(450);
    stage.ctx(ctxLine('2nd period', f8.score_before));
    let flipped = false;
    await stage.play({
      from: g.shotF,
      to: g.goalTo,
      label: 'gp08_goal',
      onTime: t => {
        if (!flipped && t >= C.gp08.goal_row) {
          flipped = true;
          stage.ctx(ctxLine('2nd period', f8.score_after));
          stage.ctxEl.classList.add('flip');
        }
      }
    });
    await sleep(700);
    stage.ctxEl.classList.remove('flip');
    stage.ctx('');
  }
  return {
    async s2_bridge(b, ctx) {
      const {
        stage,
        cap,
        log,
        root,
        state
      } = ctx;
      log.log('story2_bridge_start');
      const nx = root.querySelector('.next');
      const loading = stage.load('gp03');
      nx.classList.remove('on');
      await sleep(650);
      nx.hidden = true;
      nx.innerHTML = '';
      nx.classList.remove('s2');
      const score = (per, v) => per.startsWith('3') ? '3–3' : v >= 13 * 60 + 40 ? '3–3' : v >= 11 * 60 + 2 ? '3–2' : '2–2';
      const br = await plate(root, {
        dir: 'back',
        ms: 1400,
        score,
        segs: [{
          per: '3rd period',
          from: 7 * 60 + 55,
          to: 0
        }, {
          per: '2nd period',
          from: 20 * 60,
          to: 10 * 60 + 22
        }]
      });
      if (stage.pinCtx) stage.ctx(ctxLine('2nd period', f3.score_before));
      await loading;
      stage.setBase(P.gp03.x0);
      stage.clearMarks({
        keepFan: false
      });
      stage.clock('');
      stage.badge('');
      await stage.seek(P.gp03.watch[0]);
      await sleep(250);
      await plateOff(br);
      stage.ctx(ctxLine('2nd period', f3.score_before));
      setTimeout(() => stage.ctx(''), 2600);
      await stage.play({
        from: P.gp03.watch[0],
        to: P.gp03.freeze,
        label: 'gp03_watch'
      });
      await stage.shutter();
      const shown = performance.now();
      await cap._set(cap.topEl, `<span class="ln q in">Goal or save?</span>`, {
        stagger: 0,
        cls: 'q'
      });
      cap.actEl.innerHTML = '<div class="callrow"><button class="callbtn" data-c="goal">Goal</button><button class="callbtn" data-c="save">Save</button></div>';
      const call = await new Promise(res => cap.actEl.querySelectorAll('.callbtn').forEach(bt => bt.onclick = e => {
        e.stopPropagation();
        bt.setAttribute('aria-pressed', 'true');
        res(bt.dataset.c);
      }));
      state.bridgeCall = call;
      log.log('story2_bridge_call', {
        call,
        latency_ms: Math.round(performance.now() - shown)
      });
      await sleep(250);
      cap.actEl.innerHTML = '';
      await cap.clear(['top']);
      await stage.play({
        from: P.gp03.freeze,
        to: P.gp03.reveal_to,
        label: 'gp03_reveal'
      });
      cap.top(state?.clarity ? ['Saved.', "The shot model rated it the best chance of the final."] : state?.rc3 ? ['Saved.', 'The best chance of the final.'] : ['Saved.'], {
        stagger: 500
      });
      cap.ctx(`Two Ridge skaters within ${ti(3, 'm')} of him.`);
      cap.src('Shot model: the best chance of the final.', evd([['Shot model', `Rated Reyes’s shot from <b>${f3.distance_m.toFixed(1)} m</b> the highest of ${f3.xg_rank.split('/')[1]} attempts in this final: a rating, not a reason for the save.`], ['Crowd', `Two Ridge skaters within 3 m of him at the shot.`]]));
      log.log('context_shown', {
        beat: 'gp03',
        fact: 'crowded'
      });
      if (state?.rc2) await rcHold(cap, log, 's2_bridge_saved', 'hero');else await cap.read('s2_bridge_saved', {
        min: 2600
      });
      await cap.clear(['low', 'ev']);
      cap.ctx('');
      await cap.top([state?.clarity ? `Moments later, Harbour scored from ${ti(f8.shot_distance_m.toFixed(1), 'm')},<br>from a different kind of chance.` : `Moments later,<br>Harbour scored from ${ti(f8.shot_distance_m.toFixed(1), 'm')}.`, '<span class="how">How?</span>'], {
        stagger: 650
      });
      log.log('story2_start');
      if (state?.rc2) await rcHold(cap, log, 's2_bridge_how', 'question');else await cap.read('s2_bridge_how', {
        min: 2200,
        label: true
      });
      await cap.clear(['top']);
    },
    async gp08_watch(b, {
      stage,
      log
    }) {
      log.log('gp08_watch_start');
      await stage.load('gp08');
      stage.setBase(P.gp08.x0);
      await stage.seek(P.gp08.watch[0]);
      stage.ctx(ctxLine('2nd period', f8.score_before));
      setTimeout(() => stage.ctx(''), 3000);
      await stage.play({
        from: P.gp08.watch[0],
        to: P.gp08.watch[1],
        label: 'gp08_watch',
        onTime: stage.pinCtx ? t => {
          if (t >= C.gp08.goal_row) stage.ctx(ctxLine('2nd period', f8.score_after));
        } : undefined
      });
    },
    async gp08_commit(b, ctx) {
      const {
        stage
      } = ctx;
      await stage.shutter();
      await sleep(250);
      if (stage.pinCtx) stage.ctx(ctxLine('2nd period', f8.score_before));
      await stage.rewind(P.gp08.watch[1], P.gp08.shotF, 800);
      ctx.state.c8 = await commit(ctx, {
        q: 'Where was the puck\none second ago?',
        sub: 'This is the shot. Tap where the puck was a second before.',
        regions: P.gp08.regions,
        ev: 'gp08'
      });
    },
    async gp08_turn(b, {
      cap,
      log,
      state,
      stage: ctxStage
    }) {
      log.log('turn_start', {
        beat: 'gp08',
        region: state.c8.region
      });
      const [a, z] = TURN8[state.c8.region] || TURN8.elsewhere;
      if (state.rc2) {
        const ring = state.c8.pt ? {
          cx: state.c8.pt.x,
          cy: state.c8.pt.y,
          rx: 170,
          ry: 150
        } : {
          cx: 1000,
          cy: 560,
          rx: 240,
          ry: 190
        };
        const lines = cap.top([`<span class="ack">${a}</span>`, z], {
          stagger: 700
        });
        await ctxStage.light(ring, {
          dim: 0.5,
          ms: 600
        });
        ctxStage.fanState('ember');
        await Promise.all([lines, ctxStage.light(P.gp08.lightShooterA, {
          dim: 0.5,
          ms: 800
        })]);
        log.log('read_hold', {
          at: 'gp08_turn',
          words: cap.readingWords(),
          ms: 1300,
          mode: 'auto'
        });
        await cap.holdW(1300, 'gp08_turn');
        return;
      }
      await cap.top([`<span class="ack">${a}</span>`, z], {
        stagger: 700
      });
      await cap.read('gp08_turn', {
        min: 2400,
        label: true
      });
    },
    async gp08_see_again(b, {
      stage,
      cap,
      log,
      state
    }) {
      log.log('gp08_reveal_start');
      const g = P.gp08;
      const ring = state.c8.pt ? {
        cx: state.c8.pt.x,
        cy: state.c8.pt.y,
        rx: 170,
        ry: 150
      } : {
        cx: 1000,
        cy: 560,
        rx: 240,
        ry: 190
      };
      if (!state.rc2) {
        await stage.light(ring, {
          dim: 0.5,
          ms: 600
        });
        await sleep(150);
        stage.fanState('ember');
        await stage.light(g.lightShooterA, {
          dim: 0.5,
          ms: 800
        });
      }
      cap.dimTop(true);
      await sleep(state.rc2 ? 150 : 350);
      stage.park(true);
      stage.title(`One second back · ${f8.pass_to_shot_fan} s`, 1700);
      stage.lightOff(300);
      await stage.rewind(g.shotF, g.passF, 1500);
      await stage.light(g.lightPasserA, {
        dim: 0.55,
        ms: 700
      });
      log.log('reveal_shown', {
        beat: 'gp08',
        step: 'origin_light'
      });
      await sleep(state.rc2 ? 900 : 1300);
      await stage.lightOff(350);
      stage.badge('Slow motion', `${g.slowRate}×`);
      log.log('slow_start', {
        clip: 'gp08',
        rate: g.slowRate
      });
      await stage.play({
        from: g.passF,
        to: g.shotF,
        rate: g.slowRate,
        mute: true,
        label: 'gp08_see_again',
        skippable: true
      });
      stage.badge('');
      await stage.shutter();
    },
    async gp08_name(b, ctx) {
      if (ctx.state?.rc2) return gp08NameRC2(ctx);
      const {
        stage,
        cap,
        log
      } = ctx;
      const g = P.gp08;
      cap.clear(['top']);
      stage.park(false);
      stage.fanState('');
      await stage.light({
        cx: 1110,
        cy: 610,
        rx: 560,
        ry: 380
      }, {
        dim: 0.42,
        ms: 600
      });
      stage.halo(g.passerA, g.passerAR);
      await sleep(380);
      stage.halo(g.shooterA, g.shooterAR);
      log.log('reveal_shown', {
        beat: 'gp08',
        step: 'halos'
      });
      await sleep(1100);
      await stage.line(g.line, {
        ms: 900
      });
      stage.arrow(g.line[0], g.line[1]);
      await cap.top(['All the way across.']);
      await sleep(900);
      stage.tag(g.passerA, "#11 Varga", 'davos', 'right pa');
      await sleep(240);
      stage.tag(g.shooterA, "#23 Sato", 'davos', 'below');
      log.log('reveal_shown', {
        beat: 'gp08',
        step: 'names'
      });
      await sleep(900);
      const hero = `<small>Pass to shot, across the ice</small><span class="tm">${f8.across_m}<u> m</u></span>`;
      stage.stamp(g.dim, hero, 'right hero');
      cap.low([`<span class="bignum">${hero}</span>`]);
      log.log('climax_shown', {
        beat: 'gp08',
        value: f8.across_m
      });
      await sleep(700);
      await cap.top(['One second earlier,', 'the puck was on the other side.'], {
        stagger: 650
      });
      await sleep(400);
      cap.ctx(`When Sato shot, no Ridge skater was within ${ti(5, 'm')}: the most space any scorer had in this final.`);
      cap.src('Pass and shot positions.', evd([['Across', `<b>${f8.across_m} m</b> across the ice between where Varga’s pass started and where Sato shot, ${f8.pass_to_shot_s.toFixed(2)} s later. Not the puck’s path.`], ['Space', `Nearest Ridge skater at the shot: <b>${X.gp08.nearest_selects_m} m</b>, the most for any goal on a goalie. An association, not the reason the goal went in.`]]));
      log.log('context_shown', {
        beat: 'gp08',
        fact: 'most_space_of_any_scorer'
      });
      log.log('gp08_name_reached');
      await cap.read('gp08_name', {
        min: 4000
      });
      stage.fadeMarks(450);
      cap.clear(['top', 'low', 'ev']);
      cap.ctx('');
      await stage.lightOff(500);
    },
    async s2_forward(b, ctx) {
      const {
        stage,
        cap,
        root,
        log,
        state
      } = ctx;
      const loading = stage.load('gp09');
      const br = await plate(root, {
        dir: 'fwd',
        ms: 1700,
        score: () => f9.score_before,
        segs: [{
          per: '2nd period',
          from: 11 * 60 + 2,
          to: 13 * 60 + 32
        }]
      });
      await plateCaption(br, state?.clarity ? "Your turn. Now the Ridge attack." : state?.rc3 ? "<span class=\"ack\">A few minutes later.</span>Now the Ridge attack. Your read." : "<span class=\"ack\">A few minutes later.</span>Other end. Your read.");
      await loading;
      stage.setBase(P.gp09.x0);
      await stage.seek(P.gp09.watch[0]);
      if (state?.rc2) {
        const t0 = performance.now(),
          box = document.createElement('div');
        box.className = 's2c';
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', 'What next');
        box.innerHTML = '<button class="showme s2c-go" type="button" data-k="next"><i class="pg" aria-hidden="true"></i><span>Try it yourself</span></button>' + '<button class="textbtn quiet s2c-out" type="button" data-k="score">Back to the score</button>';
        br.appendChild(box);
        requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));
        log.log('s2_choice_shown');
        const pick = await new Promise(res => box.querySelectorAll('button').forEach(x => x.onclick = e => {
          e.stopPropagation();
          res(x.dataset.k);
        }));
        log.log('s2_choice_pick', {
          pick,
          latency_ms: Math.round(performance.now() - t0)
        });
        box.remove();
        if (pick === 'score') {
          ctx.exited = true;
          await plateOff(br);
          ctx.end('s2_choice');
          return;
        }
      } else await cap.read('s2_forward', {
        min: 2400,
        label: true
      });
      await plateOff(br);
    },
    async gp09_use_it(b, ctx) {
      const {
        stage,
        log
      } = ctx;
      log.log('gp09_use_start');
      await stage.load('gp09');
      stage.setBase(P.gp09.x0);
      await stage.seek(P.gp09.watch[0]);
      stage.ctx(ctxLine('2nd period', f9.score_before));
      setTimeout(() => stage.ctx(''), 2600);
      await stage.play({
        from: P.gp09.watch[0],
        to: P.gp09.freeze,
        label: 'gp09_use_it'
      });
      await stage.shutter();
      const r = await commit(ctx, {
        q: ctx.state?.clarity ? "Where will the next Ridge shot come from?" : 'Where’s the danger?',
        sub: 'Tap the spot.',
        regions: P.gp09.regions,
        ev: 'gp09'
      });
      r.intended = P.gp09.intended.includes(r.region);
      log.log('gp09_commit_coded', {
        region: r.region,
        intended: r.intended,
        latency_ms: r.latency_ms
      });
      ctx.state.c9 = r;
    },
    async gp09_reveal(b, {
      stage,
      cap,
      log,
      state
    }) {
      log.log('gp09_reveal_start');
      const g = P.gp09;
      if (state.rc2) {
        await Promise.all([cap.top([`<span class="ack">${ACK9[state.c9.region] || ACK9.elsewhere}</span>`, 'Watch the far side.'], {
          stagger: 600
        }), stage.light(g.lightShooterB, {
          dim: 0.5,
          ms: 700
        })]);
        log.log('reveal_shown', {
          beat: 'gp09',
          step: "light_shooterB"
        });
        log.log('read_hold', {
          at: 'gp09_turn',
          words: cap.readingWords(),
          ms: 1300,
          mode: 'auto'
        });
        await cap.holdW(1300, 'gp09_turn');
      } else {
        await cap.top([`<span class="ack">${ACK9[state.c9.region] || ACK9.elsewhere}</span>`, 'Watch the far side.'], {
          stagger: 600
        });
        await stage.light(g.lightShooterB, {
          dim: 0.5,
          ms: 700
        });
        log.log('reveal_shown', {
          beat: 'gp09',
          step: "light_shooterB"
        });
        await cap.read('gp09_turn', {
          min: 1900,
          label: true
        });
      }
      cap.dimTop(true);
      stage.park(true);
      await stage.lightOff(300);
      stage.badge('Slow motion', `${g.slowRate}×`);
      log.log('slow_start', {
        clip: 'gp09',
        rate: g.slowRate
      });
      await stage.play({
        from: g.slow[0],
        to: g.shotF,
        rate: g.slowRate,
        mute: true,
        label: 'gp09_slow',
        skippable: true
      });
      stage.badge('');
      await stage.shutter();
      cap.clear(['top']);
      await stage.light(g.lightShot, {
        dim: 0.45,
        ms: 450
      });
      await stage.line(g.line, {
        ms: 420
      });
      stage.arrow(g.line[0], g.line[1]);
      stage.parkEl.classList.add('s2q');
      stage.tag(g.passerBS, "#5 Duarte", 'selects', 'right');
      stage.tag(g.shooterBS, "#31 Ibsen", 'selects', 'above');
      await sleep(500);
      stage.clockEl.dataset.pos = 'low';
      stage.clock(`${f9.pass_to_shot_s.toFixed(2)} s`, "From Duarte’s pass to Ibsen’s shot.", 'climax');
      log.log('climax_shown', {
        beat: 'gp09',
        value: f9.pass_to_shot_s
      });
      await sleep(1100);
      cap.ctx('The quickest pass-to-goal of the final.');
      cap.src('Pass and shot times.', evd([['Pass to shot', `<b>${f9.pass_to_shot_s.toFixed(2)} s</b> from Duarte’s pass to Ibsen’s shot.`], ['Compared with', `Quickest of any goal in this final; #${X.gp09.rank_all} of ${X.gp09.n_attempts_after_pass} attempts that followed a pass.`]]));
      log.log('context_shown', {
        beat: 'gp09',
        fact: 'quickest_pass_to_goal'
      });
      await cap.read('gp09_climax', {
        min: 2600
      });
      cap.clear(['ev']);
      cap.ctx('');
    },
    async gp09_name(b, {
      stage,
      cap,
      log,
      state
    }) {
      const g = P.gp09;
      stage.fadeMarks(350);
      stage.clock(`${f9.pass_to_shot_s.toFixed(2)} s`, '', 'corner');
      delete stage.clockEl.dataset.pos;
      await stage.lightOff(350);
      stage.ctx(ctxLine('2nd period', f9.score_before));
      let flipped = false;
      await stage.play({
        from: g.shotF,
        to: g.goalTo,
        label: 'gp09_goal',
        onTime: t => {
          if (!flipped && t >= C.gp09.goal_row) {
            flipped = true;
            stage.ctx(ctxLine('2nd period', f9.score_after));
            stage.ctxEl.classList.add('flip');
          }
        }
      });
      await cap.low([`Ibsen, from ${ti(f9.shot_distance_m.toFixed(1), 'm')}.`], {
        stagger: 0,
        cls: 'coda'
      });
      cap.ctx(`A second before the pass, he was ${ti(X.gp09.shooterB_across_fan, 'm')} across the ice from Duarte.`);
      cap.src("Positions just before the pass.", evd([['Across', `<b>${X.gp09.shooterB_across_from_passerB_m} m</b> across the ice between Duarte and Ibsen, at the last recorded positions ${X.gp09.keyframe_s_before_pass} s before the pass.`], ['At the pass', `Nearest Harbour skater to Ibsen: ${X.gp09.shooterB_nearest_davos_at_pass_m} m.`]]));
      log.log('context_shown', {
        beat: 'gp09',
        fact: "shooterB_across_before_pass"
      });
      log.log('gp09_name_reached');
      if (state?.rc2) await rcHold(cap, log, 'gp09_name', 'coda');else await cap.read('gp09_name', {
        min: 3600
      });
      stage.ctxEl.classList.remove('flip');
      stage.parkEl.classList.remove('s2q');
      if (state?.clarity) {
        await cap.clear(['low', 'ev']);
        cap.ctx('');
        await cap.top([`That made it ${f9.score_after}.`, 'The next goal was the winner you saw at the start.'], {
          stagger: 650
        });
        await cap.read('s2_close', {
          min: 3000,
          label: true
        });
        await cap.clear(['top']);
      }
    },
    async s2_carry(b, ctx) {
      const {
        stage,
        cap,
        log,
        data,
        root,
        end
      } = ctx;
      log.log('story2_carry_reached', ctx.state.s2done ? {
        resumed: true
      } : {});
      stage.clock('');
      stage.ctx('');
      cap.clear();
      cap.ctx('');
      stage.fadeMarks(400);
      stage.lightOff(500);
      const nx = root.querySelector('.next');
      nx.classList.add('s2', 'fin');
      nx.innerHTML = `
        <header class="fin-top"><p class="fin-kick">Tonight’s Second Look</p>
          <h2 class="fin-head">You’ve seen this final differently.</h2></header>
        <section class="fin-cues" aria-label="Three things to look for next time">
          <p class="fin-lead">Next time, look for</p>
          <ol>
            <li><b>Look through</b><span>What stands between the puck and the goalie.</span></li>
            <li><b>Keep watching</b><span>What happens after the first shot.</span></li>
            <li><b>Look before</b><span>Where the danger was a second earlier.</span></li>
          </ol></section>
        <article class="nx-card fin-close">
          <p class="fin-line"><em>Now you know where to look.</em></p>
          <button class="showme backscore" data-k="done"><span>Back to the score</span></button>${ctx.look ? `
          <button class="lk-offer" data-k="look" type="button"><i aria-hidden="true">◎</i><span>Look around this final</span></button>
          <button class="lk-xlink" data-k="xhold" type="button"><span>The 8:47 save, then the 9:31 goal: who stayed on the ice? <i aria-hidden="true">→</i></span></button>` : ''}
        </article>`;
      nx.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => nx.classList.add('on')));
      document.body.classList.add('nextmode');
      log.log('carry_final_shown');
      if (ctx.look) log.log('look_offer_shown');
      if (ctx.look && ctx.state.rc3) log.log('context_offer_shown', {
        lens: 'hold',
        at: 'story2_carry'
      });
      const pick = await new Promise(res => {
        nx.querySelector('[data-k=done]').onclick = e => {
          e.stopPropagation();
          log.log('done_tap', {
            at: 'story2'
          });
          res('done');
        };
        const lk = nx.querySelector('[data-k=look]');
        if (lk) lk.onclick = e => {
          e.stopPropagation();
          log.log('look_tap', {
            at: 'story2'
          });
          res('look');
        };
        const xh = nx.querySelector('[data-k=xhold]');
        if (xh) xh.onclick = e => {
          e.stopPropagation();
          log.log('xlink_tap', {
            at: 'story2_carry',
            to: 'hold'
          });
          res('xhold');
        };
      });
      if (!ctx.state.s2done) {
        ctx.state.s2done = true;
        log.log('full_journey_complete');
      }
      if (pick === 'look') {
        if (ctx.state.rc3) log.log('browse_open', {
          from: 'story2_carry'
        });
        await ctx.look();
        return;
      }
      if (pick === 'xhold' && ctx.openLens) {
        await ctx.openLens('hold', {
          origin: 's2_carry'
        });
        return;
      }
      if (pick === 'xhold') {
        await ctx.look({
          entry: 'carry_xlink',
          open: 'hold'
        });
        return;
      }
      end('story2_carry');
    }
  };
}
