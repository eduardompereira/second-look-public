const FW = 1920,
  FH = 1080,
  NS = 'http://www.w3.org/2000/svg';
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const lerp = (a, b, k) => a + (b - a) * k;
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const a = keys[i - 1],
      b = keys[i],
      k = (t - a[0]) / (b[0] - a[0]);
    return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
  }
  return keys.at(-1).slice(1);
}
export class VideoStage {
  constructor(host, log) {
    this.log = (type, data) => log.log(type, data);
    host.innerHTML = `
      <div class="vwrap" data-tap="off">
        <div class="vinner">
          <video playsinline webkit-playsinline preload="auto"></video>
          <svg class="ov" viewBox="0 0 ${FW} ${FH}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>
              <mask id="lightMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${FW}" height="${FH}"><rect width="${FW}" height="${FH}" fill="white"/><ellipse id="lightHole" cx="960" cy="540" rx="0" ry="0" fill="black" filter="url(#soft)"/></mask>
            </defs>
            <rect class="dark" width="${FW}" height="${FH}" fill="#04060a" fill-opacity=".5" mask="url(#lightMask)"/>
            <g class="lines"></g>
          </svg>
          <div class="marks"></div>
        </div>
        <div class="over">
          <div class="sweep"><i></i></div>
          <div class="title" aria-hidden="true"></div>
          <div class="chip ctxchip" hidden></div>
          <div class="chip park" hidden><i></i><span>Your look</span></div>
          <div class="badge" hidden></div>
          <div class="clock" hidden><span class="tm"><b></b><u></u></span><small></small></div>
          <div class="num" hidden></div>
          <button class="playmark" hidden aria-label="Play"><i></i><span>Watch</span></button>
        </div>
        <div class="shutter"></div>
        <button class="soundchip" hidden>Tap for sound</button>
      </div>`;
    this.wrap = host.querySelector('.vwrap');
    this.inner = host.querySelector('.vinner');
    this.video = host.querySelector('video');
    this.svg = host.querySelector('svg');
    this.marks = host.querySelector('.marks');
    this.lines = host.querySelector('.lines');
    this.over = host.querySelector('.over');
    this.darkEl = this.svg.querySelector('.dark');
    this.hole = this.svg.querySelector('#lightHole');
    this.badgeEl = host.querySelector('.badge');
    this.clockEl = host.querySelector('.clock');
    this.numEl = host.querySelector('.num');
    this.titleEl = host.querySelector('.title');
    this.ctxEl = host.querySelector('.ctxchip');
    this.parkEl = host.querySelector('.park');
    this.sweepEl = host.querySelector('.sweep');
    this.playEl = host.querySelector('.playmark');
    this.shutterEl = host.querySelector('.shutter');
    this.soundchip = host.querySelector('.soundchip');
    this.soundchip.onclick = e => {
      e.stopPropagation();
      this.video.muted = false;
      this.soundchip.hidden = true;
      this.log('sound_on');
    };
    this.crop = null;
    this.clip = null;
    this.view = null;
    this.L = {
      cx: 960,
      cy: 540,
      rx: 0,
      ry: 0
    };
    this._tw = 0;
    addEventListener('resize', () => this.applyView(false));
    requestAnimationFrame(() => this.applyView(false));
  }
  async load(clip) {
    if (this.clip === clip) return;
    this.clip = clip;
    const v = this.video;
    v.innerHTML = `<source src="/media/${clip}.mp4" type="video/mp4"><source src="/media/${clip}.webm" type="video/webm">`;
    v.load();
    if (v.readyState < 2) await new Promise((res, rej) => {
      const ok = () => {
        v.removeEventListener('loadeddata', ok);
        res();
      };
      v.addEventListener('loadeddata', ok);
      v.addEventListener('error', () => rej(new Error('video load failed')), {
        once: true
      });
    });
  }
  seek(t) {
    const v = this.video;
    return new Promise(res => {
      if (Math.abs(v.currentTime - t) < 0.002 && v.readyState >= 2) return res();
      const h = () => {
        v.removeEventListener('seeked', h);
        res();
      };
      v.addEventListener('seeked', h);
      v.currentTime = t;
    });
  }
  primeFromGesture(t) {
    const v = this.video;
    v.muted = false;
    try {
      v.currentTime = t;
    } catch {}
    const p = v.play();
    return p ? p.then(() => v.pause()).catch(() => {}) : Promise.resolve();
  }
  async play({
    from,
    to,
    rate = 1,
    mute = false,
    onTime = null,
    label = '',
    skippable = false
  }) {
    const v = this.video,
      gen = this._gen = (this._gen || 0) + 1;
    if (from != null) await this.seek(from);
    if (gen !== this._gen) return;
    v.playbackRate = rate;
    const wasMuted = v.muted;
    if (mute) v.muted = true;
    this.log('video_start', {
      clip: this.clip,
      from,
      to,
      rate,
      label
    });
    try {
      await v.play();
    } catch {
      v.muted = true;
      this.soundchip.hidden = false;
      await v.play().catch(() => {});
    }
    let skipped = false;
    await new Promise(res => {
      const stopAt = to - 0.02;
      const done = () => {
        v.pause();
        res();
      };
      this._abortPlay = () => res();
      if (skippable && this.onReplay) {
        const skip = how => {
          if (skipped || gen !== this._gen) return;
          skipped = true;
          v.pause();
          this.log('skip_replay', {
            label,
            how,
            at_s: +v.currentTime.toFixed(2),
            to
          });
          res();
        };
        this._skipKey = e => {
          if (e.key === 'ArrowRight' && !document.querySelector('.sheet')) {
            e.preventDefault();
            skip('key');
          }
        };
        addEventListener('keydown', this._skipKey);
        this.onReplay(true, skip, label);
      }
      const step = () => {
        if (gen !== this._gen) return res();
        if (skipped) return;
        onTime && onTime(v.currentTime);
        if (v.currentTime >= stopAt || v.ended) return done();
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step);else requestAnimationFrame(step);
      };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step);else requestAnimationFrame(step);
    });
    if (this._skipKey) {
      removeEventListener('keydown', this._skipKey);
      this._skipKey = null;
    }
    if (skippable && this.onReplay) this.onReplay(false);
    if (gen !== this._gen) return;
    if (to < (v.duration || 1e9) - 0.05) await this.seek(to);
    onTime && onTime(to);
    v.muted = mute ? wasMuted : v.muted;
    v.playbackRate = 1;
    this.log('video_end', {
      clip: this.clip,
      t: to,
      label
    });
  }
  async rewind(from, to, ms = 1000, onTime = null) {
    this.log('rewind', {
      clip: this.clip,
      from,
      to
    });
    if (reduced()) {
      await this.seek(to);
      onTime && onTime(to);
      return;
    }
    this.wrap.classList.add('rewinding');
    this.sweepEl.style.setProperty('--ms', `${ms}ms`);
    this.sweepEl.classList.remove('run');
    void this.sweepEl.offsetWidth;
    this.sweepEl.classList.add('run');
    const t0 = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - t0) / ms),
        t = lerp(from, to, ease(k));
      await Promise.race([this.seek(t), sleep(160)]);
      onTime && onTime(t);
      if (k >= 1) break;
    }
    await this.seek(to);
    onTime && onTime(to);
    this.wrap.classList.remove('rewinding');
    this.sweepEl.classList.remove('run');
  }
  stop() {
    this._gen = (this._gen || 0) + 1;
    this.video.pause();
    const a = this._abortPlay;
    this._abortPlay = null;
    a && a();
  }
  async shutter() {
    this.shutterEl.classList.add('on');
    await sleep(140);
    this.shutterEl.classList.remove('on');
  }
  get aspect() {
    return this.wrap.clientWidth / Math.max(1, this.wrap.clientHeight);
  }
  setBase(x0 = 240) {
    this.baseX = x0;
    this.applyView(false);
  }
  baseView() {
    const a = this.aspect;
    if (a > 1.7) return [0, 0, FW, FH];
    const w = FH * a;
    return [Math.max(0, Math.min(FW - w, this.baseX ?? (FW - w) / 2)), 0, w, FH];
  }
  fit(rect) {
    if (!rect) return null;
    const a = this.aspect,
      [x, y, w, h] = rect,
      cx = x + w / 2;
    let W = h * a,
      H = h;
    if (W > FW) {
      W = FW;
      H = FW / a;
    }
    const v = [Math.max(0, Math.min(FW - W, cx - W / 2)), Math.max(0, Math.min(FH - H, y)), W, H];
    return v[2] >= this.baseView()[2] - 1 ? null : v;
  }
  applyView(animate = true, ms = 520) {
    const v = this.view || this.baseView(),
      k = this.wrap.clientWidth / v[2];
    this.inner.style.transition = animate && !reduced() ? `transform ${ms}ms cubic-bezier(.4,0,.2,1)` : 'none';
    this.inner.style.transform = `scale(${k}) translate(${-v[0]}px, ${-v[1]}px)`;
    this.wrap.style.setProperty('--z', k);
    this.crop = v;
  }
  async setCrop(rect, ms = 520) {
    this.view = this.fit(rect);
    this.applyView(true, ms);
    await sleep(ms + 30);
    return !!this.view;
  }
  _setL(L) {
    this.L = L;
    const h = this.hole;
    h.setAttribute('cx', L.cx);
    h.setAttribute('cy', L.cy);
    h.setAttribute('rx', Math.max(0, L.rx));
    h.setAttribute('ry', Math.max(0, L.ry));
  }
  async light(to, {
    dim = 0.5,
    ms = 600
  } = {}) {
    this.darkEl.style.transition = `opacity ${reduced() ? 1 : Math.max(250, ms)}ms cubic-bezier(.4,0,.2,1)`;
    this.darkEl.setAttribute('fill-opacity', dim);
    this.darkEl.style.opacity = 1;
    this.wrap.classList.add('lit');
    if (!to) return;
    const from = {
        ...this.L
      },
      id = ++this._tw;
    if (!ms || reduced() || from.rx === 0) {
      this._setL(to);
      if (from.rx === 0 && ms) await sleep(ms);
      return;
    }
    const t0 = performance.now();
    await new Promise(res => {
      const f = () => {
        if (id !== this._tw) return res();
        const k = Math.min(1, (performance.now() - t0) / ms),
          e = ease(k);
        this._setL({
          cx: lerp(from.cx, to.cx, e),
          cy: lerp(from.cy, to.cy, e),
          rx: lerp(from.rx, to.rx, e),
          ry: lerp(from.ry, to.ry, e)
        });
        k < 1 ? requestAnimationFrame(f) : res();
      };
      requestAnimationFrame(f);
    });
  }
  follow(keys) {
    ++this._tw;
    return t => {
      const [cx, cy, rx, ry] = track(keys, t);
      this._setL({
        cx,
        cy,
        rx,
        ry
      });
    };
  }
  async lightOff(ms = 500) {
    ++this._tw;
    this.darkEl.style.transition = `opacity ${reduced() ? 1 : ms}ms cubic-bezier(.4,0,.2,1)`;
    this.darkEl.style.opacity = 0;
    this.wrap.classList.remove('lit');
    await sleep(ms);
    this._setL({
      cx: 960,
      cy: 540,
      rx: 0,
      ry: 0
    });
  }
  async line([a, b], {
    cls = 'evidence',
    ms = 650
  } = {}) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', a[0]);
    l.setAttribute('y1', a[1]);
    l.setAttribute('x2', b[0]);
    l.setAttribute('y2', b[1]);
    l.setAttribute('class', cls);
    l.setAttribute('vector-effect', 'non-scaling-stroke');
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    l.style.strokeDasharray = len;
    l.style.strokeDashoffset = reduced() ? 0 : len;
    this.lines.appendChild(l);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      l.style.transition = `stroke-dashoffset ${ms}ms ease-out`;
      l.style.strokeDashoffset = 0;
    }));
    await sleep(ms);
    return l;
  }
  halo([cx, cy], [rx, ry], ms = 700) {
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', cx);
    e.setAttribute('cy', cy);
    e.setAttribute('rx', rx);
    e.setAttribute('ry', ry);
    e.setAttribute('class', 'halo');
    e.setAttribute('pathLength', '100');
    e.setAttribute('vector-effect', 'non-scaling-stroke');
    e.style.strokeDasharray = 100;
    e.style.strokeDashoffset = reduced() ? 0 : 100;
    this.lines.appendChild(e);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      e.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.4,0,.2,1), opacity .4s`;
      e.style.strokeDashoffset = 0;
    }));
    return e;
  }
  pct([x, y]) {
    return {
      left: `${x / FW * 100}%`,
      top: `${y / FH * 100}%`
    };
  }
  mark(kind, xy, html = '', extra = '') {
    const d = document.createElement('div');
    d.className = `mk ${kind} ${extra}`;
    Object.assign(d.style, this.pct(xy));
    d.innerHTML = `<div class="c">${html}</div>`;
    this.marks.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('in')));
    return d;
  }
  arrow(a, b) {
    const deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const d = this.mark('arrow', b, '<i></i>');
    d.querySelector('.c').style.setProperty('--rot', `${deg}deg`);
    return d;
  }
  stamp(xy, html, pos = 'above') {
    return this.mark('stamp', xy, html, pos);
  }
  fanRing(xy) {
    this.fan?.remove();
    this.fanXY = xy;
    this.fan = this.mark('fan', xy, '<span></span><em>You</em>');
    return this.fan;
  }
  fanState(s) {
    if (this.fan) this.fan.dataset.s = s || '';
  }
  park(on) {
    if (!this.fan && !this.parked) return;
    this.parked = on;
    this.fan?.classList.toggle('off', on);
    this.parkEl.hidden = !on;
  }
  tag(xy, label, team, side = 'above') {
    const m = String(label).match(/^(#\d+)\s+(.*)$/),
      no = m ? m[1] : '',
      name = m ? m[2] : label;
    const d = this.mark('tag', xy, `<i class="bar ${team}"></i>${no ? `<b class="no">${no}</b>` : ''}<span class="nm">${name}</span>`, `${team} ${side}`);
    if (/\bb1\b/.test(side)) {
      const fit = () => {
        if (!d.isConnected) return removeEventListener('resize', fit);
        d.style.setProperty('--b1dx', '0px');
        const c = d.querySelector('.c').getBoundingClientRect(),
          w = this.wrap.getBoundingClientRect();
        const dx = c.left < w.left + 6 ? w.left + 6 - c.left : c.right > w.right - 6 ? w.right - 6 - c.right : 0;
        d.style.setProperty('--b1dx', `${Math.round(dx)}px`);
      };
      requestAnimationFrame(fit);
      addEventListener('resize', fit);
    }
    const yieldChip = () => {
      if (!d.isConnected) return;
      const k = this.ctxEl;
      if (k.hidden) return;
      const hits = () => {
        const kr = k.getBoundingClientRect();
        return [...this.marks.querySelectorAll('.mk.tag .c')].some(c => {
          const r = c.getBoundingClientRect();
          return !(r.right <= kr.left || r.left >= kr.right || r.bottom <= kr.top || r.top >= kr.bottom);
        });
      };
      if (k.classList.contains('b1-off') || !hits()) return;
      if (!k.classList.contains('b1-up')) {
        k.classList.add('b1-up');
        if (!hits()) return;
      }
      k.classList.remove('b1-up');
      k.classList.add('b1-off');
    };
    requestAnimationFrame(() => requestAnimationFrame(yieldChip));
    setTimeout(yieldChip, 400);
    return d;
  }
  clearMarks({
    keepFan = true
  } = {}) {
    this.ctxEl?.classList.remove('b1-up', 'b1-off');
    [...this.marks.children].forEach(c => {
      if (!(keepFan && c === this.fan)) c.remove();
    });
    if (!keepFan) {
      this.fan = null;
      this.parkEl.hidden = true;
    }
    this.lines.innerHTML = '';
  }
  async fadeMarks(ms = 400) {
    [...this.marks.children].forEach(c => {
      if (c !== this.fan) c.classList.remove('in');
    });
    [...this.lines.children].forEach(c => {
      c.style.opacity = 0;
    });
    this.fan?.classList.remove('in');
    await sleep(ms);
    this.clearMarks({
      keepFan: false
    });
  }
  badge(text, value = '') {
    this.badgeEl.hidden = !text;
    this.badgeEl.innerHTML = text ? `<i></i><span>${text}</span>${value ? `<b>${value}</b>` : ''}` : '';
  }
  ctx(text) {
    if (this.pinCtx && !text) return;
    this.ctxEl.hidden = !text;
    this.ctxEl.innerHTML = text || '';
  }
  async title(text, ms = 1100) {
    this.titleEl.textContent = text;
    this.titleEl.classList.remove('on');
    void this.titleEl.offsetWidth;
    this.titleEl.classList.add('on');
    setTimeout(() => this.titleEl.classList.remove('on'), ms);
  }
  clock(text, sub = '', mode = '') {
    this.clockEl.hidden = !text;
    const m = String(text || '').match(/^([\d.:–-]+)\s*(.*)$/);
    this.clockEl.querySelector('b').textContent = m ? m[1] : text || '';
    this.clockEl.querySelector('u').textContent = m && m[2] ? ` ${m[2]}` : '';
    this.clockEl.querySelector('small').textContent = sub || '';
    this.clockEl.dataset.mode = mode;
  }
  num(html, pos = 'lr') {
    this.numEl.hidden = !html;
    this.numEl.innerHTML = html || '';
    this.numEl.dataset.pos = pos;
    this.numEl.classList.remove('in');
    if (html) requestAnimationFrame(() => requestAnimationFrame(() => this.numEl.classList.add('in')));
  }
  playMark() {
    this.playEl.hidden = false;
    this.wrap.dataset.tap = 'play';
    return new Promise(res => {
      const go = e => {
        e.stopPropagation();
        this.wrap.removeEventListener('pointerup', go);
        this.playEl.hidden = true;
        this.wrap.dataset.tap = 'off';
        res();
      };
      this.wrap.addEventListener('pointerup', go);
    });
  }
  tap() {
    this.wrap.dataset.tap = 'on';
    return new Promise(res => {
      this._tapRes = res;
      this._onTap = e => {
        if (e.target.closest('button')) return;
        const r = this.wrap.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width,
          cy = (e.clientY - r.top) / r.height;
        const [x0, y0, w, h] = this.crop || this.baseView();
        this.endTap();
        res({
          x: Math.round(x0 + cx * w),
          y: Math.round(y0 + cy * h)
        });
      };
      this.wrap.addEventListener('pointerup', this._onTap);
    });
  }
  cancelTap() {
    const r = this._tapRes;
    this.endTap();
    r && r(null);
  }
  endTap() {
    this.wrap.dataset.tap = 'off';
    if (this._onTap) this.wrap.removeEventListener('pointerup', this._onTap);
    this._onTap = null;
    this._tapRes = null;
  }
}
