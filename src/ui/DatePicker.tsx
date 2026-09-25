import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';
import { Popover } from './Popover';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const long = (s: string) => { if (!s) return ''; const d = parse(s); return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; };

type Props = { value: string; onChange: (iso: string) => void; label: string; min?: string; max?: string };

/** Selector de fecha propio: calendario en español que empieza en lunes, con navegación por teclado. */
export function DatePicker({ value, onChange, label, min, max }: Props) {
  const btn = useRef<HTMLButtonElement>(null), grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(value || iso(new Date()));
  const view = parse(focus), year = view.getFullYear(), month = view.getMonth();
  const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7, days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => { const d = i - offset + 1; return d >= 1 && d <= days ? new Date(year, month, d) : null; });
  const out = (s: string) => (min && s < min) || (max && s > max);
  const move = (days: number, months = 0) => { const d = parse(focus); if (months) { d.setDate(1); d.setMonth(d.getMonth() + months); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(parse(focus).getDate(), last)); } else d.setDate(d.getDate() + days); setFocus(iso(d)); };
  useEffect(() => { if (open) { setFocus(value || iso(new Date())); setTimeout(() => grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus(), 20); } }, [open]);
  useEffect(() => { if (open) grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus(); }, [focus]);
  const pick = (s: string) => { if (out(s)) return; onChange(s); setOpen(false); btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const k: Record<string, () => void> = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: () => move(-7), ArrowDown: () => move(7), PageUp: () => move(0, -1), PageDown: () => move(0, 1), Home: () => move(-((parse(focus).getDay() + 6) % 7)), End: () => move(6 - ((parse(focus).getDay() + 6) % 7)), Enter: () => pick(focus), ' ': () => pick(focus) };
    if (k[e.key]) { e.preventDefault(); k[e.key](); }
  };
  const today = iso(new Date());

  return (
    <>
      <button ref={btn} type="button" class="c-dd c-dd--block c-date" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${long(value) || 'sin fecha'}`} onClick={() => setOpen(!open)}>
        <Icon name="calendar" size={18} /><span class="c-dd__value">{long(value) || 'Elegir fecha'}</span>
      </button>
      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)} label={label} width={316}>
        <div class="c-pop__title">{label}</div>
        <div class="c-cal">
          <div class="c-cal__head">
            <button type="button" class="c-cal__nav" aria-label="Mes anterior" onClick={() => move(0, -1)}><Icon name="left" size={18} /></button>
            <div class="c-cal__title" aria-live="polite">{MONTHS[month]} {year}</div>
            <button type="button" class="c-cal__nav" aria-label="Mes siguiente" onClick={() => move(0, 1)}><Icon name="right" size={18} /></button>
          </div>
          <div class="c-cal__grid" role="grid" aria-label={`${MONTHS[month]} de ${year}`} ref={grid} onKeyDown={onKey}>
            {DAYS.map(d => <span class="c-cal__dow" role="columnheader" aria-hidden="true">{d}</span>)}
            {cells.map(d => {
              if (!d) return <span />;
              const s = iso(d);
              return <button type="button" role="gridcell" tabIndex={s === focus ? 0 : -1} disabled={!!out(s)} aria-selected={s === value} aria-label={long(s)}
                class={`c-cal__day ${s === value ? 'is-selected' : ''} ${s === today ? 'is-today' : ''}`} onClick={() => pick(s)}>{d.getDate()}</button>;
            })}
          </div>
          <div class="c-cal__foot"><button type="button" class="c-cal__link" onClick={() => { setFocus(today); }}>Ir a hoy</button><span class="u-muted u-small">Flechas para moverte, Intro para elegir</span></div>
        </div>
      </Popover>
    </>
  );
}
