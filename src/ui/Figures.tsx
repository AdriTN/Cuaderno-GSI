import type { ComponentChildren } from 'preact';
import './figures.css';

export type Figure = { value: ComponentChildren; label: ComponentChildren; mark?: boolean; extra?: ComponentChildren };

/** Banda de cifras clave separadas por divisores (en vez de tarjetas idénticas). */
export function Figures({ items }: { items: Figure[] }) {
  return (
    <div class="c-figures-wrap"><div class="c-figures" style={{ '--cols': items.length } as any}>
      {items.map(f => (
        <div class="c-figure">
          <div class="c-figure__value">{f.mark ? <span class="u-mark">{f.value}</span> : f.value}</div>
          <div class="c-figure__label">{f.label}</div>
          {f.extra && <div class="c-figure__extra">{f.extra}</div>}
        </div>
      ))}
    </div></div>
  );
}
