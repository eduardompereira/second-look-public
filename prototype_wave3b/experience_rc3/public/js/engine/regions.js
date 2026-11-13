export function classify(pt, regions) {
  if (!pt) return 'not_sure';
  for (const r of regions) {
    if (r.kind === 'ellipse' && ((pt.x - r.cx) / r.rx) ** 2 + ((pt.y - r.cy) / r.ry) ** 2 <= 1) return r.id;
    if (r.kind === 'rect' && pt.x >= r.r[0] && pt.x <= r.r[2] && pt.y >= r.r[1] && pt.y <= r.r[3]) return r.id;
    if (r.kind === 'segment') {
      const [ax, ay] = r.a,
        [bx, by] = r.b,
        dx = bx - ax,
        dy = by - ay;
      const t = Math.max(0, Math.min(1, ((pt.x - ax) * dx + (pt.y - ay) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(pt.x - (ax + t * dx), pt.y - (ay + t * dy)) <= r.tol) return r.id;
    }
  }
  return 'elsewhere';
}
