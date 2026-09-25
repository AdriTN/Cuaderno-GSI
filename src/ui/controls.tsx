/** Controles pequeños y reutilizables del sistema de diseño. */
import type { ComponentChildren, JSX } from 'preact';
import type { TopicStatus } from '@/core/types';
import './controls.css';

export const STATUS_LABEL = ['Sin empezar', 'Leído', 'Estudiado', 'Dominado'] as const;

export function Meter({ parts, size }: { parts: { value: number; color: string; label?: string }[]; size?: 'lg' }) {
  return <div class={`c-meter ${size === 'lg' ? 'c-meter--lg' : ''}`} role="img" aria-label={parts.map(p => p.label).filter(Boolean).join(', ')}>
    {parts.filter(p => p.value > 0).map(p => <span title={p.label} style={{ width: `${Math.min(100, p.value)}%`, background: p.color }} />)}
  </div>;
}

export const Tag = ({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'accent' | 'mark'; children: ComponentChildren }) =>
  <span class={`c-tag c-tag--${tone}`}>{children}</span>;

export function Segmented<T extends string | number>({ options, value, onChange, label, block }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string; block?: boolean }) {
  // --n: opciones; --half: columnas en espacio estrecho (4 → 2×2), para no dejar opciones huérfanas.
  // Hasta 5 opciones cortas caben en una fila incluso en móvil.
  const short = options.every(([, l]) => l.length <= 5);
  const n = options.length, half = n <= 3 || (short && n <= 5) ? n : Math.ceil(n / 2);
  return <div class={`c-seg ${block ? 'c-seg--block' : ''}`} role="group" aria-label={label} style={{ '--n': n, '--half': half } as any}>
    {options.map(([v, l]) => <button type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
  </div>;
}

export function Tabs<T extends string>({ items, value, onChange, label }: { items: [T, string, number?][]; value: T; onChange: (v: T) => void; label: string }) {
  return <div class="c-tabs" role="tablist" aria-label={label}>
    {items.map(([v, l, n]) => <button type="button" role="tab" aria-selected={v === value} onClick={() => onChange(v)}>{l}{n !== undefined && <span class="count">{n}</span>}</button>)}
  </div>;
}

/** Casilla propia: el input nativo queda invisible (accesible) y se dibuja una caja con icono. */
export const Checkbox = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ComponentChildren }) =>
  <label class="c-check"><input type="checkbox" checked={checked} onChange={e => onChange((e.target as HTMLInputElement).checked)} /><span class="c-check__box" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><span>{children}</span></label>;

/** Campo con etiqueta. `group` para controles compuestos (desplegable, calendario, −/+), que ya se etiquetan solos. */
export const Field = ({ label, hint, children, group }: { label: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; group?: boolean }) => group
  ? <div class="c-field" role="group"><span class="c-field__label">{label}</span>{children}{hint && <span class="c-field__hint">{hint}</span>}</div>
  : <label class="c-field"><span class="c-field__label">{label}</span>{children}{hint && <span class="c-field__hint">{hint}</span>}</label>;

export const Input = (p: JSX.InputHTMLAttributes<HTMLInputElement>) => <input {...p} class={`c-input ${p.class ?? ''}`} />;
export const TextArea = (p: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} class={`c-input ${p.class ?? ''}`} />;

export const StatusDot = ({ status }: { status: TopicStatus }) => <span class={`c-status c-status--${status}`} title={STATUS_LABEL[status]} role="img" aria-label={STATUS_LABEL[status]} />;

export const Callout = ({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'ok' | 'bad'; children: ComponentChildren; action?: ComponentChildren }) =>
  <div class={`c-callout c-callout--${tone}`}><div>{children}</div>{action}</div>;

export const Empty = ({ title, children, action }: { title?: string; children?: ComponentChildren; action?: ComponentChildren }) =>
  <div class="c-empty">{title && <strong>{title}</strong>}{children && <div>{children}</div>}{action}</div>;

export const Kbd = ({ children }: { children: ComponentChildren }) => <kbd class="c-kbd">{children}</kbd>;

type RowProps = { href?: string; onClick?: () => void; lead?: ComponentChildren; title: ComponentChildren; meta?: ComponentChildren; trail?: ComponentChildren; icon?: ComponentChildren; action?: ComponentChildren };
/** Fila de lista. `action` va fuera del enlace para no anidar elementos interactivos. */
export function Row({ action, ...p }: RowProps) {
  if (!action) return <RowInner {...p} />;
  return <div class="c-rowwrap"><RowInner {...p} />{action}</div>;
}
function RowInner({ href, onClick, lead, title, meta, trail, icon }: Omit<RowProps, 'action'>) {
  const inner = <>{icon}{lead !== undefined && <span class="c-row__lead">{lead}</span>}<span class="c-row__body"><span class="c-row__title">{title}</span>{meta && <span class="c-row__meta">{meta}</span>}</span>{trail && <span class="c-row__trail">{trail}</span>}</>;
  if (href) return <a class="c-row" href={href}>{inner}</a>;
  if (onClick) return <button type="button" class="c-row" onClick={onClick}>{inner}</button>;
  return <div class="c-row">{inner}</div>;
}
export const List = ({ children }: { children: ComponentChildren }) => <ul class="c-list">{children}</ul>;
