/** Gráficos SVG ligeros. Colores vía variables CSS en `style` (los atributos no admiten var()). */
import { num } from '@/core/utils/format';

export function LineChart({ points, max = 100, target, label }: { points: { x: string; y: number }[]; max?: number; target?: number; label: string }) {
  const W = 640, H = 210, P = 36, n = points.length;
  const x = (i: number) => P + (n === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => H - P - (Math.max(0, Math.min(max, v)) / max) * (H - 2 * P);
  const ticks = [0, max * .3, max * .5, max * .7, max].map(Math.round);
  return (
    <svg class="c-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(v => <g><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} /><text x={P - 8} y={y(v) + 4} text-anchor="end" font-size="11" style={{ fill: 'var(--muted)' }}>{v}</text></g>)}
      {target !== undefined && <g><line x1={P} x2={W - P} y1={y(target)} y2={y(target)} stroke-dasharray="5 5" style={{ stroke: 'var(--ok)' }} /><text x={W - P} y={y(target) - 6} text-anchor="end" font-size="11" style={{ fill: 'var(--ok)' }}>objetivo {target}</text></g>}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} fill="none" stroke-width="2.5" stroke-linejoin="round" style={{ stroke: 'var(--accent)' }} />
      {points.map((p, i) => <circle cx={x(i)} cy={y(p.y)} r="4.5" style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} stroke-width="2.5"><title>{`${p.x}: ${num(p.y)}`}</title></circle>)}
    </svg>
  );
}

export function BarChart({ bars, label }: { bars: { label: string; value: number; title: string; tick?: string }[]; label: string }) {
  const W = 640, H = 150, n = bars.length, step = (W - 20) / n, max = Math.max(1, ...bars.map(b => b.value));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {bars.map((b, i) => { const h = (110 * b.value) / max; return <g>
        <rect x={10 + i * step} y={120 - Math.max(h, 2)} width={step * .72} height={Math.max(h, 2)} rx="3" style={{ fill: b.value ? 'var(--accent)' : 'var(--line)' }}><title>{b.title}</title></rect>
        {b.tick && <text x={10 + i * step} y="140" font-size="11" style={{ fill: 'var(--muted)' }}>{b.tick}</text>}
      </g>; })}
    </svg>
  );
}
