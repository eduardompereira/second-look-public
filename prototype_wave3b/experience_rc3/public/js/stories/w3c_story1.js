import { sleep } from '../engine/stage.js';
import { classify } from '../engine/regions.js';
import { nl2br, evd } from '../engine/ui.js';
export const CHAPTERS_W1 = [{
  id: 'first',
  label: 'First look'
}, {
  id: 'second',
  label: 'Second look'
}, {
  id: 'read',
  label: 'Your read'
}];
export const STORY_W1 = {
  id: 'w3c_story1',
  beats: [{
    id: 'watch',
    seg: 'first',
    type: 'gp02_watch',
    clip: 'gp02'
  }, {
    id: 'commit',
    seg: 'first',
    type: 'gp02_commit',
    clip: 'gp02'
  }, {
    id: 'turn',
    seg: 'second',
    type: 'gp02_turn'
  }, {
    id: 'see_again',
    seg: 'second',
    type: 'gp02_see_again',
    clip: 'gp02'
  }, {
    id: 'name',
    seg: 'second',
    type: 'gp02_name',
    clip: 'gp02'
  }, {
    id: 'bridge',
    seg: 'read',
    type: 'bridge',
    clip: 'gp04'
  }, {
    id: 'use_it',
    seg: 'read',
    type: 'gp04_use_it',
    clip: 'gp04'
  }, {
    id: 'use_it_reveal',
    seg: 'read',
    type: 'gp04_reveal',
    clip: 'gp04'
  }, {
    id: 'use_it_name',
    seg: 'read',
    type: 'gp04_name'
  }, {
    id: 'twin',
    seg: 'read',
    type: 'twin'
  }, {
    id: 'carry',
    seg: 'read',
    type: 'carry'
  }]
};
const _cut = STORY_W1.beats.findIndex(b => b.id === 'bridge');
export const STORY_W1_RC2 = {
  id: 'w3c_story1_rc2',
  beats: [...STORY_W1.beats.slice(0, _cut), {
    id: 'pause1',
    seg: 'second',
    type: 'pause1'
  }]
};
export const STORY_W1_FROM_BRIDGE = {
  id: 'w3c_story1_from_bridge',
  beats: STORY_W1.beats.slice(_cut)
};
export const STORY_W1_STOP_RETURN = {
  id: 'w3c_story1_stop_return',
  beats: [{
    id: 'stop_return',
    seg: 'second',
    type: 'stop_return'
  }, {
    id: 'pause1',
    seg: 'second',
    type: 'pause1'
  }]
};
export const STORY_W1_CARRY_RETURN = {
  id: 'w3c_story1_carry_return',
  beats: [{
    id: 'carry',
    seg: 'read',
    type: 'carry'
  }]
};
const TURN_COPY = {
  shooter: ["You watched Lindqvist.", 'Now watch what he shoots through.'],
  goalie: ['You watched the goalie.', 'Now watch what’s in front of him.'],
  front: ['You were already in front of the goalie.', 'Stay there. Watch again.'],
  lane: ['You were on the line of the shot.', 'Now watch who’s standing on it.'],
  elsewhere: ['You were watching somewhere else.', 'Now watch the space in front of the goalie.'],
  not_sure: ['Hard to say at full speed.', 'Now watch the space in front of the goalie.']
};
const TURN4_COPY = {
  shot2pos: 'You marked the front of the net.',
  crease: 'You marked the front of the net.',
  shooter: 'You marked the first shooter.',
  elsewhere: 'You marked your spot.',
  not_sure: 'Hard to call at full speed.'
};
const TWIN_S1_SHOOTER = [1490, 437];
const B1_RING_SHOT1 = [50, 101];
const P = {
  gp02: {
    track: [[7.4, 1439, 945, 465, 80], [7.83, 1431, 485, 119, 87], [8.25, 1650, 1021, 143, 105], [8.67, 1006, 464, 290, 115], [9.1, 477, 912, 1139, 233], [9.52, 1596, 949, 396, 223], [9.94, 816, 1435, 429, 194], [10.37, 576, 971, 417, 156], [10.79, 309, 789, 1508, 84]],
    halos: [[[1443, 770], [125, 36]], [[1344, 1740], [77, 128]]],
    slowFrom: 9.94,
    slowRate: 0.4,
    goalRow: 12.5,
    num: 'll',
    nf: {
      crop: [159, 174, 1314, 1665],
      from: 10.79,
      slowTo: 11.63,
      rate: 0.4,
      wideTo: 13.33,
      keys: [[10.79, 565, 355, 487, 67], [11, 1400, 295, 537, 125], [11.21, 1450, 1663, 1295, 145], [11.42, 944, 345, 410, 129], [11.63, 517, 743, 858, 89]]
    }
  },
  gp04: {
    shooter: [[8.04, 1668, 1665, 70, 181], [8.58, 1346, 788, 127, 102], [8.76, 439, 1447, 126, 218]],
    crease: [[8.04, 409, 764, 175, 157], [8.58, 995, 1394, 78, 33], [9.15, 536, 1444, 77, 37], [9.41, 1383, 1564, 144, 229], [9.63, 985, 573, 229, 165]],
    pushAt: 8.67,
    climax: 9.52,
    halo2: [[1752, 757], [46, 80]]
  }
};
const MOBILE_X = {
  gp02: 276,
  gp04: 173
};
async function commitOnFootage(ctx, {
  q,
  sub,
  regions,
  event
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
    log.log(`${event}_tap`, {
      x: res.x,
      y: res.y,
      region,
      latency_ms
    });
  } else log.log(`${event}_not_sure`, {
    latency_ms,
    region: 'not_sure'
  });
  ctx.tapAffordance?.(false);
  log.log(`${event}_region`, {
    region
  });
  if (!res) log.log('not_sure', {
    at: event
  });
  cap.actEl.innerHTML = '';
  return {
    pt: res,
    region,
    latency_ms
  };
}
const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const ti = (v, u) => `<span class="ti">${v}<u> ${u}</u></span>`;
const ctxLine = (period, score) => `<em>${period}</em><b>${score}</b>`;
export function handlersW1(D, X) {
  const g2 = D.gp02,
    g4 = D.gp04,
    F = D.facts;
  const lockup = () => `<small>Shot distance</small><span class="tm"><b>${F.gp02.distance_m}</b><u> m</u></span>`;
  const gp02Src = () => [`Both players coded in the screening area.`, evd([['Distance', `<b>${X.gp02.distance_m} m</b>: the longest goal on a goalie in this final. Only this one of ${X.gp02.n_attempts_as_far_or_further} attempts from this far or further went in.`], ['In front', `#14 Okafor (Ridge) and #8 Brandt (Harbour): where they stood, not what the goalie could see.`]])];
  const holdFixed = (cap, log, at, ms) => {
    log.log('read_hold', {
      at,
      words: cap.readingWords(),
      ms,
      mode: 'auto'
    });
    return cap.holdW(ms, at);
  };
  async function gp02NameRC2({
    stage,
    cap,
    log,
    state
  }) {
    const NF = P.gp02.nf;
    stage.light({
      cx: g2.beam.cx,
      cy: g2.beam.cy,
      rx: g2.beam.rx + 30,
      ry: g2.beam.ry + 20
    }, {
      dim: 0.55,
      ms: 600
    });
    stage.park(false);
    stage.fanState('');
    await cap.clear(['top']);
    await sleep(250);
    stage.halo(...P.gp02.halos[0]);
    await sleep(220);
    stage.halo(...P.gp02.halos[1]);
    log.log('reveal_shown', {
      beat: 'gp02',
      step: 'halos'
    });
    await sleep(600);
    await stage.line([g2.lane[0], g2.lane[1]], {
      ms: 700
    });
    const two = cap.top(['Two bodies on the line of the shot.', 'One from each team.'], {
      stagger: 1100
    });
    await sleep(1150);
    stage.tag(g2.bodies[0].xy, g2.bodies[0].label, g2.bodies[0].team, 'below');
    await sleep(200);
    stage.tag(g2.bodies[1].xy, g2.bodies[1].label, g2.bodies[1].team, 'above');
    log.log('reveal_shown', {
      beat: 'gp02',
      step: 'names'
    });
    await two;
    await holdFixed(cap, log, 'gp02_names', 1700);
    stage.num(lockup(), P.gp02.num);
    await cap.top([state?.clarity ? 'The shot went past both.' : 'Through both.']);
    await cap.low([`<span class="bignum">${lockup()}</span>`], {
      stagger: 0
    });
    await sleep(500);
    cap.ctx(`The longest goal scored on a goalie in this final.`);
    cap.src(...gp02Src());
    log.log('context_shown', {
      beat: 'gp02',
      fact: 'longest_goal_on_goalie'
    });
    await holdFixed(cap, log, 'gp02_name', 4800);
    stage.num('');
    cap.clear(['top', 'low', 'ev']);
    cap.ctx('');
    stage.fadeMarks(450);
    stage.light({
      cx: NF.keys[0][1],
      cy: NF.keys[0][2],
      rx: NF.keys[0][3],
      ry: NF.keys[0][4]
    }, {
      dim: 0.5,
      ms: 600
    });
    await stage.setCrop(NF.crop, 650);
    log.log('payoff_crop', {
      clip: 'gp02',
      crop: NF.crop,
      magnified: !!stage.view
    });
    const follow = stage.follow(NF.keys);
    stage.badge('Slow motion', `${NF.rate}×`);
    log.log('slow_start', {
      clip: 'gp02',
      rate: NF.rate,
      at: 'payoff'
    });
    await stage.play({
      from: NF.from,
      to: NF.slowTo,
      rate: NF.rate,
      mute: true,
      label: 'gp02_goal_slow',
      skippable: true,
      onTime: follow
    });
    stage.badge('');
    stage.lightOff(600);
    stage.setCrop(null, 900);
    stage.ctx(ctxLine('3rd period', F.gp02.score_before));
    let flipped = false;
    await stage.play({
      from: NF.slowTo,
      to: NF.wideTo,
      label: 'gp02_goal',
      onTime: t => {
        if (!flipped && t >= P.gp02.goalRow) {
          flipped = true;
          stage.ctx(ctxLine('3rd period', '4–3'));
          stage.ctxEl.classList.add('flip');
        }
      }
    });
    await sleep(900);
    stage.ctxEl.classList.remove('flip');
  }
  return {
    async gp02_watch(b, ctx) {
      const {
        stage,
        cap
      } = ctx;
      await stage.load('gp02');
      stage.setBase(MOBILE_X.gp02);
      await stage.seek(g2.watch[0]);
      stage.ctx(ctxLine('3rd period', F.gp02.score_before));
      cap.top(['Watch it once, like you did live.']);
      cap.low([`<span class="rotate">${ctx.state?.clarity ? 'Turn your phone for a bigger picture' : 'Turn your phone for full screen'}</span>`]);
      await sleep(900);
      setTimeout(() => cap.clear(['top', 'low']), 2600);
      setTimeout(() => stage.ctx(''), 3000);
      await stage.play({
        from: g2.watch[0],
        to: g2.watch[1],
        label: 'gp02_watch',
        onTime: stage.pinCtx ? t => {
          if (t >= P.gp02.goalRow) stage.ctx(ctxLine('3rd period', '4–3'));
        } : undefined
      });
    },
    async gp02_commit(b, ctx) {
      const {
        stage
      } = ctx;
      await stage.shutter();
      await sleep(250);
      await stage.rewind(g2.watch[1], g2.release, 800);
      if (stage.pinCtx) stage.ctx(ctxLine('3rd period', F.gp02.score_before));
      ctx.state.att = await commitOnFootage(ctx, {
        q: 'Where were you looking?',
        sub: 'The moment of the shot. Tap where your eyes were.',
        regions: g2.regions,
        event: 'attention'
      });
    },
    async gp02_turn(b, {
      stage,
      cap,
      log,
      state
    }) {
      log.log('turn_start', {
        region: state.att.region
      });
      const [a, z] = TURN_COPY[state.att.region] || TURN_COPY.elsewhere;
      if (state.rc2) {
        const ring = state.att.pt ? {
          cx: state.att.pt.x,
          cy: state.att.pt.y,
          rx: 190,
          ry: 170
        } : {
          cx: 960,
          cy: 600,
          rx: 260,
          ry: 200
        };
        const L = P.gp02.track.at(-1),
          target = {
            cx: L[1],
            cy: L[2],
            rx: L[3],
            ry: L[4]
          };
        const lines = cap.top([`<span class="ack">${a}</span>`, z], {
          stagger: 700
        });
        await stage.light(ring, {
          dim: 0.5,
          ms: 600
        });
        stage.fanState('ember');
        await Promise.all([lines, stage.light(target, {
          dim: 0.5,
          ms: 900
        })]);
        log.log('read_hold', {
          at: 'turn',
          words: cap.readingWords(),
          ms: 1300,
          mode: 'auto'
        });
        await cap.holdW(1300, 'turn');
        return;
      }
      await cap.top([`<span class="ack">${a}</span>`, z], {
        stagger: 700
      });
      await cap.read('turn', {
        min: 2400,
        label: true
      });
    },
    async gp02_see_again(b, {
      stage,
      cap,
      log,
      state
    }) {
      log.log('see_again_start');
      const ring = state.att.pt ? {
        cx: state.att.pt.x,
        cy: state.att.pt.y,
        rx: 190,
        ry: 170
      } : {
        cx: 960,
        cy: 600,
        rx: 260,
        ry: 200
      };
      const L = P.gp02.track.at(-1),
        target = {
          cx: L[1],
          cy: L[2],
          rx: L[3],
          ry: L[4]
        };
      if (!state.rc2) {
        await stage.light(ring, {
          dim: 0.5,
          ms: 600
        });
        await sleep(150);
        stage.fanState('ember');
        await stage.light(target, {
          dim: 0.5,
          ms: 900
        });
      }
      cap.dimTop(true);
      stage.park(true);
      stage.title('Second look', 1300);
      const follow = stage.follow(P.gp02.track);
      await stage.rewind(g2.release, g2.replay_from, 1100, follow);
      let slow = false;
      await stage.play({
        from: g2.replay_from,
        to: g2.release,
        label: 'gp02_see_again',
        skippable: true,
        onTime: t => {
          follow(t);
          if (!slow && t >= P.gp02.slowFrom) {
            slow = true;
            stage.video.playbackRate = P.gp02.slowRate;
            stage.video.muted = true;
            stage.badge('Slow motion', `${P.gp02.slowRate}×`);
            log.log('slow_start', {
              clip: 'gp02',
              rate: P.gp02.slowRate
            });
          }
        }
      });
      stage.video.muted = false;
      stage.badge('');
      await stage.shutter();
    },
    async gp02_name(b, ctx) {
      if (ctx.state.rc2) return gp02NameRC2(ctx);
      const {
        stage,
        cap,
        log
      } = ctx;
      stage.light({
        cx: g2.beam.cx,
        cy: g2.beam.cy,
        rx: g2.beam.rx + 30,
        ry: g2.beam.ry + 20
      }, {
        dim: 0.55,
        ms: 600
      });
      stage.park(false);
      stage.fanState('');
      await cap.clear(['top']);
      await sleep(500);
      stage.halo(...P.gp02.halos[0]);
      await sleep(220);
      stage.halo(...P.gp02.halos[1]);
      log.log('reveal_shown', {
        beat: 'gp02',
        step: 'halos'
      });
      await sleep(1250);
      await stage.line([g2.lane[0], g2.lane[1]], {
        ms: 800
      });
      await cap.top(['Two bodies on the line of the shot.']);
      await sleep(1300);
      stage.tag(g2.bodies[0].xy, g2.bodies[0].label, g2.bodies[0].team, 'below');
      await sleep(240);
      stage.tag(g2.bodies[1].xy, g2.bodies[1].label, g2.bodies[1].team, 'above');
      await cap.top(['One from each team.']);
      log.log('reveal_shown', {
        beat: 'gp02',
        step: 'names'
      });
      await cap.read('gp02_names', {
        min: 1600,
        label: true
      });
      const lockup = `<small>Shot distance</small><span class="tm"><b>${F.gp02.distance_m}</b><u> m</u></span>`;
      stage.num(lockup, P.gp02.num);
      await cap.top(['Through both.']);
      await cap.low([`<span class="bignum">${lockup}</span>`], {
        stagger: 0
      });
      await sleep(500);
      cap.ctx(`The longest goal scored on a goalie in this final.`);
      cap.src('Both players coded in the screening area.', evd([['Distance', `<b>${X.gp02.distance_m} m</b> from the goal: the longest goal on a goalie in this final (next: ${X.gp02.next_longest_goal_m} m).`], ['In front', `#14 Okafor (Ridge) and #8 Brandt (Harbour): where they stood, not what the goalie could see.`]]));
      log.log('context_shown', {
        beat: 'gp02',
        fact: 'longest_goal_on_goalie'
      });
      await cap.read('gp02_name', {
        min: 3200
      });
      stage.num('');
      cap.clear(['top', 'low', 'ev']);
      cap.ctx('');
      stage.fadeMarks(450);
      await stage.lightOff(600);
      stage.ctx(ctxLine('3rd period', F.gp02.score_before));
      let flipped = false;
      await stage.play({
        from: g2.goal_continue[0],
        to: g2.goal_continue[1],
        label: 'gp02_goal',
        onTime: t => {
          if (!flipped && t >= P.gp02.goalRow) {
            flipped = true;
            stage.ctx(ctxLine('3rd period', '4–3'));
            stage.ctxEl.classList.add('flip');
          }
        }
      });
      await sleep(900);
      stage.ctxEl.classList.remove('flip');
    },
    async stop_return(b, {
      stage,
      cap
    }) {
      await cap.clear();
      cap.ctx('');
      stage.clearMarks({
        keepFan: false
      });
      stage.num('');
      stage.clock('');
      stage.badge('');
      stage.ctx('');
      await stage.lightOff(0);
      await stage.load('gp02');
      stage.setBase(MOBILE_X.gp02);
      stage.view = null;
      stage.applyView(false);
      await stage.seek(P.gp02.nf.wideTo);
      if (stage.pinCtx) stage.ctx(ctxLine('3rd period', '4–3'));
    },
    async pause1(b, {
      stage,
      cap,
      log,
      state,
      root,
      end
    }) {
      const t0 = performance.now();
      stage.ctx('');
      stage.wrap.classList.add('p1dim');
      await cap.top(['Now you’ve seen what was in front of it.']);
      const band = root.querySelector('.band.bottom');
      const el = document.createElement('div');
      el.className = 'p1';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'What next');
      const nextAt = `${F.gp04.period.replace(/^P3 0?/, '3rd period, ')} · ${F.gp04.score_before}`;
      el.innerHTML = `<p class="p1-k">${state.clarity ? `Next: ${nextAt}` : "Earlier · same goalie"}</p><p class="p1-q">${state.clarity ? "Same goalie. Harbour shot from almost the same spot. What happened to that shot?" : 'The first shot wasn’t the end.'}</p>
        <button class="showme p1-next" type="button" data-k="next"><i class="pg" aria-hidden="true"></i><span>Show me</span></button>
        <div class="p1-alt"><button class="textbtn p1-shots" type="button" data-k="shots">${state.clarity && X.goalie_pool ? `All ${X.goalie_pool.n_attempts} Harbour shot attempts with Novak in goal` : state.rc3 ? "All Harbour attempts on Novak" : "All attempts on this goalie"}</button>
          <button class="textbtn quiet" type="button" data-k="score">Back to the score</button></div>`;
      band.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
      document.body.classList.add('p1mode');
      log.log('choice1_shown');
      if (state.rc3) log.log('context_offer_shown', {
        lens: 'shots',
        at: 'stop'
      });
      const pick = await new Promise(res => el.querySelectorAll('button').forEach(x => x.onclick = e => {
        e.stopPropagation();
        res(x.dataset.k);
      }));
      log.log('choice1_pick', {
        pick,
        latency_ms: Math.round(performance.now() - t0)
      });
      state.p1 = pick;
      if (pick === 'next') state.rc2Continue = true;
      el.classList.remove('in');
      document.body.classList.remove('p1mode');
      await Promise.all([cap.clear(['top']), new Promise(r => setTimeout(r, 260))]);
      el.remove();
      stage.wrap.classList.remove('p1dim');
      if (pick === 'score') end('choice1');
    },
    async bridge(b, {
      stage,
      cap,
      root,
      state
    }) {
      stage.ctx('');
      const br = root.querySelector('.bridge');
      br.hidden = false;
      requestAnimationFrame(() => br.classList.add('on'));
      const clk = br.querySelector('.bclk'),
        sc = br.querySelector('.bsc');
      const from = 15 * 60 + 19,
        to = 7 * 60 + 55;
      br.querySelector('.bper').textContent = '3rd period';
      clk.textContent = fmtClock(from);
      sc.textContent = '4–3';
      await sleep(500);
      br.classList.add('rew');
      const t0 = performance.now(),
        ms = 1500;
      await new Promise(res => {
        const f = () => {
          const k = Math.min(1, (performance.now() - t0) / ms),
            e = 1 - (1 - k) ** 3,
            s = from + (to - from) * e;
          clk.textContent = fmtClock(s);
          if (s < from - 1) {
            sc.textContent = '3–3';
            if (stage.pinCtx) stage.ctx(ctxLine('3rd period', F.gp04.score_before));
          }
          k < 1 ? requestAnimationFrame(f) : res();
        };
        requestAnimationFrame(f);
      });
      clk.textContent = fmtClock(to);
      br.classList.remove('rew');
      await stage.load('gp04');
      stage.setBase(MOBILE_X.gp04);
      await stage.seek(g4.watch[0]);
      if (state?.rc2Continue) {
        await sleep(350);
      } else {
        await cap.top(state?.clarity ? ['Earlier in the 3rd period.'] : ["Earlier in the 3rd period.", 'Same goalie. A different problem.'], {
          stagger: 650
        });
        await cap.read('bridge', {
          min: 2200,
          label: true
        });
      }
      if (!state?.rc2Continue) await cap.clear(['top']);
      br.classList.remove('on');
      await sleep(450);
      br.hidden = true;
    },
    async gp04_use_it(b, ctx) {
      const {
        stage,
        log
      } = ctx;
      await stage.load('gp04');
      stage.setBase(MOBILE_X.gp04);
      await stage.seek(g4.watch[0]);
      stage.ctx(ctxLine('3rd period', F.gp04.score_before));
      let auto = false;
      if (ctx.state.rc2 && (ctx.state.rc2Continue || ctx.state.resumed)) {
        await sleep(700);
        auto = await stage.video.play().then(() => {
          stage.video.pause();
          return true;
        }).catch(() => false);
        log.log('gp04_autostart', {
          ok: auto
        });
      }
      if (!auto) {
        await stage.playMark();
        log.log('gp04_play_tap');
      }
      stage.ctx('');
      await stage.play({
        from: g4.watch[0],
        to: g4.freeze,
        label: 'gp04_use_it'
      });
      await stage.shutter();
      const r = await commitOnFootage(ctx, {
        q: ctx.state.clarity ? 'The puck is loose.\nWhere could the next shot come from?' : 'The puck is loose.\nWhere’s the danger now?',
        sub: 'Tap the spot.',
        regions: g4.regions,
        event: 'use_it'
      });
      r.cue_consistent = g4.cue_consistent.includes(r.region);
      log.log('use_it_coded', {
        region: r.region,
        cue_consistent: r.cue_consistent,
        latency_ms: r.latency_ms
      });
      ctx.state.use = r;
    },
    async gp04_reveal(b, {
      stage,
      cap,
      log,
      state
    }) {
      log.log('turn_start', {
        beat: 'gp04'
      });
      const ring = state.use.pt ? {
        cx: state.use.pt.x,
        cy: state.use.pt.y,
        rx: 190,
        ry: 170
      } : {
        cx: 960,
        cy: 560,
        rx: 260,
        ry: 200
      };
      const toShooter = {
        cx: P.gp04.shooter[0][1],
        cy: P.gp04.shooter[0][2],
        rx: P.gp04.shooter[0][3],
        ry: P.gp04.shooter[0][4]
      };
      if (state.rc2) {
        const lines = cap.top([`<span class="ack">${TURN4_COPY[state.use.region] || TURN4_COPY.elsewhere}</span>`, 'Same seconds. Slower.'], {
          stagger: 650
        });
        await stage.light(ring, {
          dim: 0.45,
          ms: 600
        });
        await lines;
        await holdFixed(cap, log, 'gp04_turn', 900);
        log.log('see_again_start', {
          beat: 'gp04'
        });
        cap.dimTop(true);
        stage.park(true);
        stage.light(toShooter, {
          dim: 0.45,
          ms: 700
        });
        await stage.rewind(g4.freeze, g4.slow.start, 750);
      } else {
        await cap.top([`<span class="ack">${TURN4_COPY[state.use.region] || TURN4_COPY.elsewhere}</span>`, 'Same seconds. Slower.'], {
          stagger: 650
        });
        await stage.light(ring, {
          dim: 0.45,
          ms: 600
        });
        await cap.read('gp04_turn', {
          min: 1800,
          label: true
        });
        log.log('see_again_start', {
          beat: 'gp04'
        });
        cap.dimTop(true);
        stage.park(true);
        stage.light(toShooter, {
          dim: 0.45,
          ms: 700
        });
        await stage.rewind(g4.freeze, g4.slow.start, 750);
      }
      stage.badge('Slow motion', `${g4.slow.rate}×`);
      const onShooter = stage.follow(P.gp04.shooter),
        onCrease = stage.follow(P.gp04.crease);
      let phase = 'shooter',
        held = false;
      await stage.play({
        from: g4.slow.start,
        to: P.gp04.climax,
        rate: g4.slow.rate,
        mute: true,
        label: 'gp04_slow',
        skippable: true,
        onTime: t => {
          if (phase === 'shooter') {
            onShooter(t);
            if (t >= P.gp04.pushAt) {
              phase = 'crease';
              stage.darkEl.style.transition = 'opacity 260ms';
              stage.darkEl.style.opacity = 0;
              setTimeout(() => {
                onCrease(stage.video.currentTime);
                stage.darkEl.style.transition = 'opacity 420ms';
                stage.darkEl.style.opacity = 1;
              }, 270);
              stage.setCrop(g4.crop, 700);
            }
          } else onCrease(t);
          if (t < g4.shot1) stage.clock('');else if (t < g4.shot2) stage.clock(`${(t - g4.shot1).toFixed(2)} s`, 'after the first shot', 'run');else if (!held) {
            held = true;
            stage.clock(`${F.gp04.dt_s.toFixed(2)} s`, 'second shot', 'lock');
            log.log('dt_shown');
          }
        }
      });
      await stage.shutter();
      stage.badge('');
      cap.clear(['top']);
      if (state.clarity) {
        stage.clock(' ', 'Between the 1st and 2nd shot', 'climax');
        await sleep(900);
        stage.clock(`${F.gp04.dt_s.toFixed(2)} s`, 'Between the 1st and 2nd shot', 'climax');
      } else stage.clock(`${F.gp04.dt_s.toFixed(2)} s`, 'From the first shot to the second.', 'climax');
      log.log('climax_shown', {
        beat: 'gp04'
      });
      await sleep(1100);
      cap.ctx(`The quickest second attempt of the final.`);
      cap.src('Shot times.', evd([['Gap', `<b>0.72 s</b> between Moreau’s shot and Kowal’s, from the two shot events.`], ['Compared with', `The quickest of ${X.gp04.n_pairs} back-to-back attempts by one team in this final (next: 1.18 s).`]]));
      log.log('context_shown', {
        beat: 'gp04',
        fact: 'quickest_second_attempt'
      });
      await cap.read('gp04_climax', {
        min: 2600
      });
    },
    async gp04_name(b, {
      stage,
      cap,
      log,
      state
    }) {
      cap.clear(['top', 'ev']);
      cap.ctx('');
      stage.clock(`${F.gp04.dt_s.toFixed(2)} s`, '', 'corner');
      stage.setCrop(null, 600);
      await stage.rewind(P.gp04.climax, g4.freeze, 600);
      stage.park(false);
      stage.fanState('');
      await stage.light({
        cx: g4.beam.cx,
        cy: g4.beam.cy,
        rx: g4.beam.rx + 20,
        ry: g4.beam.ry + 10
      }, {
        dim: 0.5,
        ms: 500
      });
      stage.halo(...P.gp04.halo2);
      await sleep(500);
      if (state.clarity) {
        stage.halo(g4.shot1_origin, B1_RING_SHOT1);
        stage.tag(g4.shot1_origin, "1st shot · Moreau", 'davos', 'bl b1');
        await sleep(250);
        stage.tag(g4.shot2pos, "2nd shot · #27 Kowal", 'davos', 'bl b1');
      } else stage.tag(g4.shot2pos, "#27 Kowal", 'davos', 'right');
      await cap.low([`Kowal, from ${ti(F.gp04.d2_m, 'm')}.`], {
        stagger: 0,
        cls: 'coda'
      });
      cap.src('Distance of each shot from the goal.', evd([['Distance', `<b>${X.gp04.d1_m} m → ${X.gp04.d2_m} m</b>, the biggest drop between two quick shots in this final.`], ['Not shown', 'The puck’s path between the two shots.']]));
      if (state.rc2) await holdFixed(cap, log, 'gp04_name', 4200);else await cap.read('gp04_name', {
        min: 3000
      });
    },
    async twin(b, {
      stage,
      cap,
      log,
      root,
      data,
      state
    }) {
      log.log('twin_shown');
      cap.clear(['top', 'low', 'ev']);
      cap.ctx('');
      stage.clock('');
      stage.fadeMarks(350);
      stage.lightOff(400);
      const T = X.twin;
      const tw = root.querySelector('.twin');
      const ring = ([x, y]) => state.clarity ? `<i class="tw-ring" aria-hidden="true" style="left:${x / 19.2}%;top:${y / 10.8}%"></i>` : '';
      tw.innerHTML = `
        <div class="tw-pair">
          <figure><img src="/data/twin_s1.jpg" alt="Moreau’s shot, third period 5:08">${ring(TWIN_S1_SHOOTER)}<figcaption><em>${T.clock_s1.replace('P3', '3rd')} · ${T.score}</em><b>Saved</b></figcaption></figure>
          <figure><img src="/data/twin_win.jpg" alt="Lindqvist’s winning shot, third period 12:41">${ring(g2.shooter)}<figcaption><em>${T.clock_win.replace('P3', '3rd')} · ${T.score}</em><b class="g">${state.clarity ? 'The winner' : 'Goal'}</b></figcaption></figure>
        </div>`;
      document.body.classList.add('twinon');
      tw.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => tw.classList.add('on')));
      if (state.clarity && innerHeight > innerWidth) {
        tw.insertAdjacentHTML('beforeend', `<div class="over"><div class="chip ctxchip tw-ctx">${stage.ctxEl.innerHTML}</div></div>`);
        stage.ctxEl.hidden = true;
      }
      await sleep(450);
      await cap.top([state.clarity ? `Two Harbour shots, only ${T.loc_sep_m} m apart.` : 'You’ve seen this shot before.']);
      cap.ctx(state.clarity ? 'Same score. Same goalie. Nothing in the data says why one went in.' : 'Same score. Same goalie. Almost the same spot.');
      cap.src(state.clarity ? 'Circled: who took each shot.' : `Shot locations ${T.loc_sep_m} m apart.`, evd([['The pair', `Moreau’s shot (5:08, saved) and Lindqvist’s winner (12:41): both at 3–3, on Novak, <b>${T.loc_sep_m} m</b> apart.`], ['In front', "One Harbour and one Ridge player in front of the goalie, both times."]]));
      if (state.rc2) await holdFixed(cap, log, 'twin', 4600);else await cap.read('twin', {
        min: 3000
      });
      cap.clear(['top', 'ev']);
      cap.ctx('');
      tw.classList.remove('on');
      await sleep(400);
      tw.hidden = true;
      tw.innerHTML = '';
      document.body.classList.remove('twinon');
      if (state.clarity) stage.ctxEl.hidden = false;
    },
    async carry(b, {
      stage,
      cap,
      log,
      data,
      root,
      end,
      state,
      look
    }) {
      log.log('carry_reached', state.s1done ? {
        resumed: true
      } : {});
      stage.clock('');
      cap.clear();
      cap.ctx('');
      stage.fadeMarks(400);
      stage.lightOff(500);
      const nx = root.querySelector('.next');
      nx.innerHTML = `
        <div class="nx-bg"><img src="/data/${data.gp03_card.poster}" alt=""></div>
        <div class="nx-k"><p class="nx-know">Two new ways to look.</p>
          <ul class="nx-cues"><li><b>Look through</b><span>what stands between puck and goalie</span></li><li><b>Keep watching</b><span>what happens after the first shot</span></li></ul></div>
        <article class="nx-card">
          <div class="nx-body"><p class="nx-kick">Next</p><p class="nx-hook b1-hook">The best chance of the final.<br>Goal or save?</p><p class="b1-hooksub">Picked by the shot model</p>
            <button class="showme"><i class="pg" aria-hidden="true"></i><span>Show me</span></button></div>
        </article>
        ${state.rc3 && look ? '<div class="nx-ctx"><button class="ctxdoor" type="button" data-k="follow"><span>This chance and the next: who made the last pass?</span><i aria-hidden="true">→</i></button></div>' : ''}
        <div class="nx-after">${state.fromLook ? '<button class="textbtn quiet nx-tomap" data-k="map">Back to the map</button>' : ''}<button class="textbtn quiet" data-k="done">Back to the score</button></div>`;
      nx.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => nx.classList.add('on')));
      document.body.classList.add('nextmode');
      if (nx.querySelector('[data-k=follow]')) log.log('context_offer_shown', {
        lens: 'follow',
        at: 'story1_carry'
      });
      await new Promise(res => {
        nx.querySelector('.showme').onclick = e => {
          e.stopPropagation();
          log.log('next_story_tap', {
            story: 'gp03'
          });
          state.next = 'story2';
          res();
        };
        nx.querySelector('[data-k=done]').onclick = e => {
          e.stopPropagation();
          log.log('done_tap');
          res();
        };
        const mp = nx.querySelector('[data-k=map]');
        if (mp) mp.onclick = e => {
          e.stopPropagation();
          log.log('xlink_back_to_map');
          state.back = 'map';
          res();
        };
        const fl = nx.querySelector('[data-k=follow]');
        if (fl) fl.onclick = e => {
          e.stopPropagation();
          log.log('context_door_tap', {
            lens: 'follow',
            at: 'story1_carry'
          });
          state.lens = 'follow';
          res();
        };
      });
      if (!state.s1done) {
        state.s1done = true;
        log.log('story_complete');
      }
      if (state.next !== 'story2' && state.back !== 'map' && state.lens !== 'follow') end('story1_carry');
    }
  };
}
