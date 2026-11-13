const BASE_KEYS = new Set(['mode', 'participant', 'category', 'hook', 'viewport', 'ua', 'build', 'entry', 'variant', 'session']);
export class Logger {
  constructor(base, {
    sink = null,
    session = null
  } = {}) {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    this.sink = sink;
    this.base = {
      ...base,
      session: session || `${stamp}_${(base.participant || 'anon').replace(/[^\w-]/g, '')}_${base.mode}_${Math.random().toString(36).slice(2, 6)}`
    };
    this.t0 = performance.now();
    this.buf = [];
    this.listeners = new Set();
    setInterval(() => this.flush(), 1500);
    addEventListener('pagehide', () => this.flush(true));
  }
  get session() {
    return this.base.session;
  }
  log(type, data = {}) {
    const ev = {
      ...this.base,
      type,
      t_ms: Math.round(performance.now() - this.t0),
      iso: new Date().toISOString(),
      ...data
    };
    if (this.sink) {
      const d = {};
      for (const [k, v] of Object.entries(data)) if (!BASE_KEYS.has(k)) d[k] = v;
      this.sink.push(type, d, ev.t_ms, ev.iso);
    } else this.buf.push(ev);
    this.listeners.forEach(f => f(ev));
    if (/(tap|not_sure|complete|carry|start)$/.test(type)) this.flush();
    return ev;
  }
  flush(beacon = false) {
    if (this.sink) {
      beacon ? this.sink.beacon() : this.sink.flush();
      return;
    }
    if (!this.buf.length || this.base.mode === 'qa-nolog') return;
    const body = JSON.stringify(this.buf);
    this.buf = [];
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/log', new Blob([body], {
      type: 'application/json'
    }));else fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      keepalive: true
    }).catch(() => {});
  }
}
