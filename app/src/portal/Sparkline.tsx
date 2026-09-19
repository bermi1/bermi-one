/**
 * A small inline chart, drawn as SVG.
 *
 * SVG rather than a chart library: this is one path and a fill, it has to
 * inherit the console's theme tokens, and pulling in a charting dependency to
 * draw a line would cost more than the whole portal weighs.
 *
 * The path is built from a Catmull-Rom curve so a sparse week of data reads as
 * a trend rather than a zigzag, and the area beneath it is the same path closed
 * to the baseline.
 */
export function Sparkline({ values, height = 46, tone = 'var(--brand)', label }: {
  values: number[];
  height?: number;
  tone?: string;
  label?: string;
}) {
  const W = 100;
  const H = height;
  const pad = 3;

  if (values.length === 0) {
    return <div style={{ height: H, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--ink3)' }}>—</div>;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (W - pad * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => ({
    x: pad + i * step,
    y: pad + (H - pad * 2) * (1 - (v - min) / span),
  }));

  // Catmull-Rom through the points, converted to cubic béziers.
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const area = `${d} L ${points[points.length - 1].x.toFixed(2)} ${H} L ${points[0].x.toFixed(2)} ${H} Z`;
  const id = `spark-${Math.abs(values.reduce((a, b) => a + b, values.length)) % 100000}`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity="0.26" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="1.8" fill={tone} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * A proportion, drawn as a ring.
 *
 * Reads faster than a number for "how much of the base is paying" — the kind of
 * figure someone glances at rather than reads.
 */
export function Donut({ value, total, tone = 'var(--ok)', size = 74, caption }: {
  value: number;
  total: number;
  tone?: string;
  size?: number;
  caption?: string;
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;

  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={caption}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(circumference * pct).toFixed(2)} ${circumference.toFixed(2)}`}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {caption && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{caption}</div>}
    </div>
  );
}

/** A labelled proportion bar — the subscription mix, at a glance. */
export function StackBar({ segments }: { segments: { label: string; value: number; tone: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--line)' }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.tone }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: s.tone }} />
            {s.label}
            <b style={{ color: 'var(--ink)' }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
