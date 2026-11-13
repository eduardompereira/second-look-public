export const reach = () => {
  const vw = innerWidth,
    vh = innerHeight,
    out = {
      hscroll: document.documentElement.scrollWidth > vw + 1,
      unreach: [],
      overlap: [],
      clipped: []
    };
  const shut = el => {
    const d = el.closest('details:not([open])');
    return !!d && !(el.tagName === 'SUMMARY' && el.parentElement === d) && !el.closest('details:not([open]) > summary');
  };
  const vis = el => {
    if (shut(el)) return false;
    const r = el.getBoundingClientRect(),
      cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  };
  const name = el => (el.innerText || el.getAttribute('aria-label') || el.className || el.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 40);
  const scroller = el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return null;
  };
  const ctrls = [...document.querySelectorAll('button, summary, a[href], [role=button]')].filter(e => vis(e) && !e.closest('[hidden]') && !e.closest('[aria-hidden=true]'));
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    const inView = r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1;
    if (!inView) {
      const sc = scroller(el);
      const docScroll = document.scrollingElement.scrollHeight > vh + 2 && getComputedStyle(document.body).overflowY !== 'hidden';
      if (!sc && !docScroll) out.unreach.push(name(el));
    }
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible') continue;
      if (/(auto|scroll)/.test(cs.overflowY)) break;
      const q = p.getBoundingClientRect();
      if (r.bottom > q.bottom + 2 || r.right > q.right + 2 || r.top < q.top - 2) {
        out.clipped.push(name(el));
      }
      break;
    }
  }
  const textEls = [...document.querySelectorAll('.lk-nav .lk-where, .lk-nav .lk-brand > span, #story .cap .ln, #story .cap.cx p, #story .cap.ev .srcline, .pace, .nx-hook, .lk-act, #story .act button')].filter(vis);
  const box = el => {
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const r = rg.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  };
  const hit = (a, b) => !(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom - 1);
  const covers = [...document.querySelectorAll('.pace.in:not([hidden]), .pts:not([hidden]) .pts-pill, .pts:not([hidden]) .pts-tip:not([hidden])')].filter(vis);
  for (const c of covers) for (const t of textEls) if (!c.contains(t) && hit(c.getBoundingClientRect(), box(t))) out.overlap.push(`${name(c)} × ${name(t)}`);
  const tags = [...document.querySelectorAll('.mk.tag .c, .mk.stamp .c')].filter(vis);
  for (const g of tags) for (const t of textEls) if (hit(g.getBoundingClientRect(), box(t))) out.overlap.push(`${name(g)} × ${name(t)}`);
  const plates = [...document.querySelectorAll('#story .clock:not([hidden]), #story .ctxchip:not([hidden]), .mk.tag .c, .mk.stamp .c')].filter(vis);
  for (let i = 0; i < plates.length; i++) for (let j = i + 1; j < plates.length; j++) {
    const a = plates[i],
      b = plates[j];
    const ra = a.closest('.clock') ? box(a.querySelector('.tm') || a) : a.getBoundingClientRect(),
      rb = b.closest('.clock') ? box(b.querySelector('.tm') || b) : b.getBoundingClientRect();
    if (hit(ra, rb)) out.overlap.push(`${name(a)} × ${name(b)}`);
  }
  const nav = document.querySelector('body.look .lk-nav');
  if (nav && vis(nav) && !document.querySelector('.sheet')) {
    const nr = nav.getBoundingClientRect(),
      t = document.querySelector('.lk-nav .lk-where');
    if (t) {
      const tr = t.getBoundingClientRect();
      const top = document.elementFromPoint(tr.left + Math.min(20, tr.width / 2), tr.top + tr.height / 2);
      if (top && !nav.contains(top)) out.overlap.push(`lens title covered by ${name(top)}`);
    }
    const cs = getComputedStyle(nav);
    if (cs.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) out.overlap.push('lens title bar is transparent: scrolled text shows through');
  }
  return out;
};
