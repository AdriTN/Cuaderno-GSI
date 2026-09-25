import type { ComponentChildren } from 'preact';

/** Anillo de progreso con contenido central. */
export function Ring({ value, size = 112, stroke = 9, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ComponentChildren }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <div class="c-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} style={{ stroke: 'var(--sunken)' }} />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} stroke-linecap="round" stroke-dasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ stroke: 'var(--accent)', transition: 'stroke-dasharray .6s var(--ease)' }} />}
      </svg>
      <div class="c-ring__body">{children}</div>
    </div>
  );
}
