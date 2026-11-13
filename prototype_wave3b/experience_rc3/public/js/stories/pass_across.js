import { sleep, reduced } from '../engine/stage.js';
import { classify } from '../engine/regions.js';
import { nl2br, shareCard, modal } from '../engine/ui.js';
export const CHAPTERS_2 = [{
  id: 'first',
  label: 'First look'
}, {
  id: 'second',
  label: 'Second look'
}, {
  id: 'read',
  label: 'Your read'
}];
export const CHAPTERS_COLD = [{
  id: 'read',
  label: ''
}];
export const STORY_2 = {
  id: 'story2',
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
export const STORY_GP09_COLD = {
  id: 'gp09_cold',
  forbidClips: ['gp08', 'gp02', 'gp04'],
  beats: [{
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
    id: 'cold_end',
    seg: 'read',
    type: 'cold_end'
  }]
};
const P = {
  gp03: {
    watch: [8.6, 10.65],
    freeze: 10.65,
    reveal_to: 13.11,
    x0: 542
  },
  gp08: {
    watch: [1.79, 8.93],
    x0: 239,
    shotF: 6.43,
    passF: 5.36,
    shooterA: [676, 600],
    shooterAR: [192, 36],
    passerA: [1047, 233],
    passerAR: [91, 151],
    line: [[1006, 856], [1448, 481]],
    dim: [1073, 1251],
    lightShooterA: {
      cx: 1131,
      cy: 939,
      rx: 146,
      ry: 34
    },
    lightPasserA: {
      cx: 1353,
      cy: 1028,
      rx: 121,
      ry: 32
    },
    slowRate: 0.5,
    regions: [{
      id: 'passer',
      kind: 'ellipse',
      cx: 1705,
      cy: 302,
      rx: 138,
      ry: 244
    }, {
      id: 'shooter',
      kind: 'ellipse',
      cx: 868,
      cy: 1669,
      rx: 169,
      ry: 46
    }, {
      id: 'net',
      kind: 'ellipse',
      cx: 484,
      cy: 1574,
      rx: 241,
      ry: 100
    }]
  },
  gp09: {
    watch: [1, 7.68],
    x0: 1319,
    freeze: 7.68,
    shotF: 8.92,
    slow: [7.68, 8.92],
    slowRate: 0.4,
    goalTo: 11,
    shooterB: [699, 1405],
    passerB: [1043, 319],
    lightShooterB: {
      cx: 1358,
      cy: 479,
      rx: 47,
      ry: 119
    },
    passerBS: [570, 470],
    shooterBS: [1525, 843],
    shooterBSR: [82, 97],
    passerBSR: [61, 76],
    line: [[552, 1056], [886, 1666]],
    lightShot: {
      cx: 288,
      cy: 997,
      rx: 1082,
      ry: 252
    },
    regions: [{
      id: "shooterB",
      kind: 'ellipse',
      cx: 1583,
      cy: 1432,
      rx: 47,
      ry: 39
    }, {
      id: "passerB",
      kind: 'ellipse',
      cx: 287,
      cy: 425,
      rx: 113,
      ry: 172
    }, {
      id: 'goalie',
      kind: 'ellipse',
      cx: 1660,
      cy: 1102,
      rx: 112,
      ry: 170
    }, {
      id: 'slot_high',
      kind: 'ellipse',
      cx: 1522,
      cy: 1037,
      rx: 209,
      ry: 221
    }, {
      id: 'far_side',
      kind: 'ellipse',
      cx: 1083,
      cy: 428,
      rx: 1349,
      ry: 220
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
export function handlers2(S2, D) {
  const F = S2.facts,
    C = S2.cues;
  const f8 = F.gp08,
    f9 = F.gp09,
    f3 = F.gp03;
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
      cap.top(['Saved.']);
      await cap.low([`<span class="soft">Reyes, from ${ti(f3.distance_m.toFixed(1), 'm')}.</span>`, 'The best chance of the final.'], {
        stagger: 600,
        cls: 'coda'
      });
      cap.ev(`Simulated shot model: xG ${f3.xg.toFixed(2)}, the highest of ${f3.xg_rank.split('/')[1]} attempts in the final.`);
      await cap.hold(2700, 's2_bridge_saved');
      await cap.clear(['low', 'ev']);
      await cap.top([`Moments later,<br>Harbour scored from ${ti(f8.shot_distance_m.toFixed(1), 'm')}.`, '<span class="how">How?</span>'], {
        stagger: 650
      });
      log.log('story2_start');
      await cap.hold(1800, 's2_bridge_how');
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
        label: 'gp08_watch'
      });
    },
    async gp08_commit(b, ctx) {
      const {
        stage
      } = ctx;
      await stage.shutter();
      await sleep(250);
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
      state
    }) {
      log.log('turn_start', {
        beat: 'gp08',
        region: state.c8.region
      });
      const [a, z] = TURN8[state.c8.region] || TURN8.elsewhere;
      await cap.top([`<span class="ack">${a}</span>`, z], {
        stagger: 700
      });
      await cap.hold(2400, 'gp08_turn');
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
      cap.dimTop(true);
      await sleep(350);
      stage.park(true);
      stage.title('One second back', 1500);
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
      await sleep(1300);
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
        label: 'gp08_see_again'
      });
      stage.badge('');
      await stage.shutter();
    },
    async gp08_name(b, {
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
      const hero = `<small>Before the shot</small><span class="tm">${f8.pass_to_shot_fan}<u> s</u></span>`;
      stage.stamp(g.passerA, hero, 'above hero');
      cap.low([`<span class="bignum">${hero}</span>`]);
      log.log('climax_shown', {
        beat: 'gp08',
        value: f8.pass_to_shot_fan
      });
      await sleep(1100);
      stage.stamp(g.dim, `<span class="tm">${f8.across_m}<u> m</u></span><small>across</small>`, 'above sm');
      await cap.top(['One second earlier,', 'the puck was on the other side.'], {
        stagger: 650
      });
      cap.ev(`Simulated event data: Varga’s pass to Sato’s shot, ${f8.pass_to_shot_s.toFixed(2)} s. “${f8.across_m} m across” is the sideways distance between where the pass started and where the shot was taken.`);
      log.log('gp08_name_reached');
      await cap.hold(5600, 'gp08_name');
      stage.fadeMarks(450);
      cap.clear(['top', 'low', 'ev']);
      await stage.lightOff(500);
    },
    async s2_forward(b, {
      stage,
      cap,
      root
    }) {
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
      await plateCaption(br, "<span class=\"ack\">A few minutes later.</span>Other end. Your read.");
      await loading;
      stage.setBase(P.gp09.x0);
      await stage.seek(P.gp09.watch[0]);
      await cap.hold(2600, 's2_forward');
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
        q: 'Where’s the danger?',
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
      await cap.hold(1900, 'gp09_turn');
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
        label: 'gp09_slow'
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
      await cap.hold(2600, 'gp09_climax');
    },
    async gp09_name(b, {
      stage,
      cap,
      log
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
      await cap.low([`Ibsen, from ${ti(f9.shot_distance_m.toFixed(1), 'm')}.`, `<span class="soft">The pass came from the goal line.</span>`], {
        stagger: 600,
        cls: 'coda'
      });
      cap.ev(`Simulated event data: Duarte’s pass to Ibsen’s shot, ${f9.pass_to_shot_s.toFixed(2)} s. Nearest Harbour skater at the shot: ${f9.nearest_davos_skater_at_shot_m} m.`);
      log.log('gp09_name_reached');
      await cap.hold(4600, 'gp09_name');
      stage.ctxEl.classList.remove('flip');
      stage.parkEl.classList.remove('s2q');
    },
    async s2_carry(b, {
      stage,
      cap,
      log,
      data,
      root,
      end
    }) {
      log.log('story2_carry_reached');
      stage.clock('');
      stage.ctx('');
      cap.clear();
      stage.fadeMarks(400);
      stage.lightOff(500);
      const nx = root.querySelector('.next');
      nx.classList.add('s2');
      nx.innerHTML = `
        <div class="nx-bg"><img src="/data/poster_gp01.jpg" alt=""></div>
        <div class="nx-k"><p class="nx-know">Now you know another place to look.</p>
          <p class="nx-chips"><span>in front of the goalie</span><span>after the first shot</span><span class="new">the pass across</span></p></div>
        <article class="nx-card">
          <div class="nx-body"><p class="nx-kick">Next</p><p class="nx-hook">Ridge’ first goal started six seconds earlier, in their own zone.</p>
            <button class="showme"><i class="pg" aria-hidden="true"></i><span>Show me</span></button></div>
        </article>
        <div class="nx-after"><button class="textbtn" data-k="share">Share</button><button class="textbtn quiet" data-k="done">I’m done</button></div>`;
      nx.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => nx.classList.add('on')));
      document.body.classList.add('nextmode');
      await new Promise(res => {
        nx.querySelector('.showme').onclick = e => {
          e.stopPropagation();
          log.log('gp01_teaser_tap', {
            story: 'gp01'
          });
          modal('<h2 class="mq">Coming next.</h2><p class="msub">This story isn’t in this prototype yet.</p>', res, 'Finish');
        };
        nx.querySelector('[data-k=share]').onclick = e => {
          e.stopPropagation();
          log.log('share_tap', {
            at: 'story2'
          });
          modal(`${shareCard({
            match: data.match,
            reads: 3
          })}<p class="msub" style="margin-top:12px">Mock-up only — nothing is posted.</p>`, null, 'Close');
        };
        nx.querySelector('[data-k=done]').onclick = e => {
          e.stopPropagation();
          log.log('done_tap', {
            at: 'story2'
          });
          res();
        };
      });
      log.log('full_journey_complete');
      end();
    },
    async cold_end(b, {
      log,
      end
    }) {
      log.log('story_complete', {
        story: 'gp09_cold'
      });
      end();
    }
  };
}
