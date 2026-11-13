let DATA = null;
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export async function loadCards() {
  try {
    DATA = await (await fetch('/data/player_cards.json')).json();
  } catch {
    DATA = null;
  }
  return !!DATA;
}
export const hasCard = pid => !!DATA?.players?.[pid];
export function openCard(pid, log, opener) {
  const c = DATA?.players?.[pid];
  if (!c) return;
  const M = DATA.meta;
  let per = 'all';
  const m = document.createElement('div');
  m.className = 'sheet e1-card';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', `${c.name} · match card`);
  const body = () => {
    if (!c.periods) return `<p class="e1-cnote">${esc(M.goalie_note)}</p>`;
    const v = c.periods[per];
    if (!v) return '<p class="e1-cnote">Not on the ice in this period.</p>';
    const cell = (l, val, sub = '') => `<div><dt>${l}</dt><dd>${val}${sub ? ` <small>${sub}</small>` : ''}</dd></div>`;
    const ga = v.g == null ? '' : cell('Goals', v.g) + cell('Assists', v.a);
    return `<dl class="e1-grid">${cell('Time on ice', mmss(v.toi))}${cell('Shifts', v.shifts)}${cell('Shot attempts', v.s)}${cell('Passes completed', v.pc, `of ${v.pa}`)}${ga}</dl>` + `<p class="e1-cnote">${v.g == null ? 'Goals and assists: whole match only.' : 'Counts from this final, not ratings.'}</p>`;
  };
  const draw = () => {
    m.innerHTML = `<div class="sbox e1-cbox"><div class="e1-chead"><p class="skick">Match card · this final</p><button type="button" class="e1-x" data-a="close" aria-label="Close match card">×</button></div>
      <h3 class="e1-name"><b>${esc(c.no)}</b> ${esc(c.name)} <small>${c.team === 'davos' ? "Harbour" : "Ridge"}</small></h3>
      ${c.periods ? `<div class="e1-per" role="group" aria-label="Period">${[['all', 'Match'], ['p1', '1st'], ['p2', '2nd'], ['p3', '3rd']].map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === per}">${l}</button>`).join('')}</div>` : ''}
      ${body()}</div>`;
    m.querySelectorAll('[data-p]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      per = b.dataset.p;
      log?.log('e1_card_period', {
        pid,
        per
      });
      draw();
      m.querySelector(`[data-p=${per}]`).focus();
    });
    m.querySelectorAll('[data-a=close]').forEach(b => b.onclick = close);
  };
  const close = e => {
    e?.stopPropagation();
    m.remove();
    removeEventListener('keydown', onK, true);
    log?.log('e1_card_close', {
      pid
    });
    opener?.focus?.({
      preventScroll: true
    });
  };
  const onK = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  };
  addEventListener('keydown', onK, true);
  m.addEventListener('pointerup', e => {
    e.stopPropagation();
    if (e.target === m) close(e);
  });
  draw();
  document.body.appendChild(m);
  m.querySelector('[data-a=close]').focus({
    preventScroll: true
  });
  log?.log('e1_card_open', {
    pid
  });
}
