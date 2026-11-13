import { sleep } from '../engine/stage.js';
import { classify } from '../engine/regions.js';
import { nl2br, shareCard, modal } from '../engine/ui.js';
export const CHAPTERS = [{
  id: 'first',
  label: 'First look'
}, {
  id: 'second',
  label: 'Second look'
}, {
  id: 'read',
  label: 'Your read'
}];
export const CHAPTERS_A2 = [{
  id: 'read',
  label: ''
}];
export const STORY_A = {
  id: 'second_look',
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
    id: 'carry',
    seg: 'read',
    type: 'carry'
  }]
};
export const STORY_A2 = {
  id: 'a2_baseline',
  forbidClips: ['gp02'],
  beats: [{
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
    id: 'a2_end',
    seg: 'read',
    type: 'a2_end'
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
const P = {
  gp02: {
    track: [[7.36, 313, 1266, 1345, 35], [7.78, 1525, 610, 176, 230], [8.2, 878, 206, 43, 36], [8.63, 664, 403, 1478, 191], [9.05, 1083, 1423, 1224, 49], [9.47, 1539, 927, 1686, 244], [9.89, 874, 333, 1779, 125], [10.31, 1595, 955, 809, 31], [10.73, 350, 1445, 777, 37]],
    halos: [[[1587, 1385], [41, 119]], [[1532, 380], [114, 160]]],
    slowFrom: 9.89,
    slowRate: 0.4,
    goalRow: 12.43,
    num: 'll'
  },
  gp04: {
    shooter: [[7.45, 1643, 1637, 157, 42], [7.96, 578, 1645, 95, 86], [8.12, 1465, 598, 144, 118]],
    crease: [[7.45, 627, 1452, 189, 183], [7.96, 247, 1602, 58, 61], [8.48, 1741, 342, 207, 210], [8.73, 1085, 1214, 89, 85], [8.93, 1172, 1588, 90, 193]],
    pushAt: 8.04,
    climax: 8.83,
    halo2: [[428, 976], [242, 48]]
  }
};
const MOBILE_X = {
  gp02: 225,
  gp04: 122
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
  const tapped = stage.tap();
  const res = await Promise.race([tapped, notSure.then(() => {
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
export function handlers(D) {
  const g2 = D.gp02,
    g4 = D.gp04,
    F = D.facts;
  const ctxLine = (period, score) => `<em>${period}</em><b>${score}</b>`;
  return {
    async gp02_watch(b, {
      stage,
      cap
    }) {
      await stage.load('gp02');
      stage.setBase(MOBILE_X.gp02);
      await stage.seek(g2.watch[0]);
      stage.ctx(ctxLine('3rd period', F.gp02.score_before));
      cap.low(['<span class="rotate">Turn your phone for full screen</span>']);
      await sleep(900);
      setTimeout(() => cap.clear(['low']), 6000);
      setTimeout(() => stage.ctx(''), 3000);
      await stage.play({
        from: g2.watch[0],
        to: g2.watch[1],
        label: 'gp02_watch'
      });
    },
    async gp02_commit(b, ctx) {
      const {
        stage
      } = ctx;
      await stage.shutter();
      await sleep(250);
      await stage.rewind(g2.watch[1], g2.release, 800);
      ctx.state.att = await commitOnFootage(ctx, {
        q: 'Where were you looking?',
        sub: 'The moment of the shot. Tap where your eyes were.',
        regions: g2.regions,
        event: 'attention'
      });
    },
    async gp02_turn(b, {
      cap,
      log,
      state,
      stage
    }) {
      log.log('turn_start', {
        region: state.att.region
      });
      const [a, z] = TURN_COPY[state.att.region] || TURN_COPY.elsewhere;
      await cap.top([`<span class="ack">${a}</span>`, z], {
        stagger: 700
      });
      await cap.hold(2600, 'turn');
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
      const target = {
        cx: P.gp02.track.at(-1)[1],
        cy: P.gp02.track.at(-1)[2],
        rx: P.gp02.track.at(-1)[3],
        ry: P.gp02.track.at(-1)[4]
      };
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
    async gp02_name(b, {
      stage,
      cap,
      log,
      state
    }) {
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
      await sleep(1100);
      stage.tag(g2.bodies[0].xy, g2.bodies[0].label, g2.bodies[0].team, 'below');
      await sleep(240);
      stage.tag(g2.bodies[1].xy, g2.bodies[1].label, g2.bodies[1].team, 'above');
      await cap.top(['One from each team.']);
      log.log('reveal_shown', {
        beat: 'gp02',
        step: 'names'
      });
      await sleep(1000);
      const lockup = `<small>Shot distance</small><span class="tm"><b>${F.gp02.distance_m}</b><u> m</u></span>`;
      stage.num(lockup, P.gp02.num);
      await cap.low([`<span class="bignum">${lockup}</span>`, 'Through both.'], {
        stagger: 800
      });
      cap.ev(`Simulated tracking flags both players in the screening area · By its shot model, ${F.gp02.higher_xg_non_goals} other attempts in this final were more likely to score.`);
      await cap.hold(5200, 'gp02_name');
      stage.num('');
      cap.clear(['top', 'low', 'ev']);
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
    async bridge(b, {
      stage,
      cap,
      root
    }) {
      stage.ctx('');
      const br = root.querySelector('.bridge');
      br.hidden = false;
      requestAnimationFrame(() => br.classList.add('on'));
      const clk = br.querySelector('.bclk'),
        sc = br.querySelector('.bsc');
      const from = 15 * 60 + 19,
        to = 7 * 60 + 55;
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
          if (s < from - 1) sc.textContent = '3–3';
          k < 1 ? requestAnimationFrame(f) : res();
        };
        requestAnimationFrame(f);
      });
      clk.textContent = fmtClock(to);
      br.classList.remove('rew');
      await stage.load('gp04');
      stage.setBase(MOBILE_X.gp04);
      await stage.seek(g4.watch[0]);
      await cap.top(["Earlier in the 3rd period.", 'Same score. New problem.'], {
        stagger: 650
      });
      await cap.hold(2400, 'bridge');
      await cap.clear(['top']);
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
      await stage.playMark();
      log.log('gp04_play_tap');
      stage.ctx('');
      await stage.play({
        from: g4.watch[0],
        to: g4.freeze,
        label: 'gp04_use_it'
      });
      await stage.shutter();
      const r = await commitOnFootage(ctx, {
        q: 'The puck is loose.\nWhere’s the danger now?',
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
      await cap.top([`<span class="ack">${TURN4_COPY[state.use.region] || TURN4_COPY.elsewhere}</span>`, 'Same seconds. Slower.'], {
        stagger: 650
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
      await stage.light(ring, {
        dim: 0.45,
        ms: 600
      });
      await cap.hold(1800, 'gp04_turn');
      log.log('see_again_start', {
        beat: 'gp04'
      });
      cap.dimTop(true);
      stage.park(true);
      stage.light({
        cx: P.gp04.shooter[0][1],
        cy: P.gp04.shooter[0][2],
        rx: P.gp04.shooter[0][3],
        ry: P.gp04.shooter[0][4]
      }, {
        dim: 0.45,
        ms: 700
      });
      await stage.rewind(g4.freeze, g4.slow.start, 750);
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
      stage.clock(`${F.gp04.dt_s.toFixed(2)} s`, 'From the first shot to the second.', 'climax');
      log.log('climax_shown', {
        beat: 'gp04'
      });
      await sleep(700);
      await cap.hold(2300, 'gp04_climax');
    },
    async gp04_name(b, {
      stage,
      cap
    }) {
      cap.clear(['top']);
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
      stage.tag(g4.shot2pos, "#27 Kowal", 'davos', 'right');
      const ti = (v, u) => `<span class="ti">${v}<u> ${u}</u></span>`;
      await cap.low([`Kowal, from ${ti(F.gp04.d2_m, 'm')}.`, `<span class="soft">The first shot came from ${ti(F.gp04.d1_m, 'm')} — ${ti(Math.round(F.gp04.lateral_m), 'm')} across.</span>`], {
        stagger: 600,
        cls: 'coda'
      });
      cap.ev("Shot times and locations: Simulated event data. “9 m across” is the sideways distance between the two shot locations.");
      await cap.hold(5000, 'gp04_name');
    },
    async carry(b, {
      stage,
      cap,
      log,
      data,
      root,
      end,
      journey,
      state
    }) {
      log.log('carry_reached');
      stage.clock('');
      cap.clear();
      stage.fadeMarks(400);
      stage.lightOff(500);
      const nx = root.querySelector('.next');
      nx.innerHTML = `
        <div class="nx-bg"><img src="/data/${data.gp03_card.poster}" alt=""></div>
        <div class="nx-k"><p class="nx-know">Now you know where to look.</p>
          <p class="nx-chips"><span>in front of the goalie</span><span>after the first shot</span></p></div>
        <article class="nx-card">
          <div class="nx-body"><p class="nx-kick">Next</p><p class="nx-hook">${nl2br(data.gp03_card.text)}</p>
            <button class="showme"><i class="pg" aria-hidden="true"></i><span>Show me</span></button></div>
        </article>
        <div class="nx-after"><button class="textbtn" data-k="share">Share</button><button class="textbtn quiet" data-k="done">I’m done</button></div>`;
      nx.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => nx.classList.add('on')));
      document.body.classList.add('nextmode');
      await new Promise(res => {
        nx.querySelector('.showme').onclick = e => {
          e.stopPropagation();
          log.log('next_story_tap', {
            story: 'gp03'
          });
          if (journey) {
            state.next = 'story2';
            res();
            return;
          }
          modal('<h2 class="mq">Coming next.</h2><p class="msub">This story isn’t in this prototype yet.</p>', res, 'Finish');
        };
        nx.querySelector('[data-k=share]').onclick = e => {
          e.stopPropagation();
          log.log('share_tap');
          modal(`${shareCard({
            match: data.match,
            reads: 2
          })}<p class="msub" style="margin-top:12px">Mock-up only — nothing is posted.</p>`, null, 'Close');
        };
        nx.querySelector('[data-k=done]').onclick = e => {
          e.stopPropagation();
          log.log('done_tap');
          res();
        };
      });
      log.log('story_complete');
      if (state.next !== 'story2') end();
    },
    async a2_end(b, {
      log,
      end
    }) {
      log.log('story_complete');
      end();
    }
  };
}
