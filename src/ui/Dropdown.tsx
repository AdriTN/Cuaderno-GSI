import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';
import { Popover } from './Popover';

export type Option<T> = { value: T; label: string; hint?: string; group?: string; disabled?: boolean };
type Props<T> = {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string;
  searchable?: boolean; size?: 'sm' | 'md'; block?: boolean; placeholder?: string; renderValue?: (o: Option<T> | undefined) => string;
};

/** Desplegable propio (patrón listbox de WAI-ARIA): teclado, búsqueda opcional y grupos. */
export function Dropdown<T extends string | number>({ value, options, onChange, label, searchable, size = 'md', block, placeholder = 'Elegir…', renderValue }: Props<T>) {
  const btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLUListElement>(null), search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [active, setActive] = useState(0);
  const selected = options.find(o => o.value === value);
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return n ? options.filter(o => (o.label + ' ' + (o.hint ?? '')).toLowerCase().includes(n)) : options; }, [q, options]);
  const id = useMemo(() => 'dd' + Math.random().toString(36).slice(2, 8), []);

  const openList = () => { setQ(''); setActive(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true); };
  const choose = (o?: Option<T>) => { if (!o || o.disabled) return; onChange(o.value); setOpen(false); btn.current?.focus(); };
  useEffect(() => { if (open) setTimeout(() => (searchable ? search.current : list.current)?.focus(), 10); }, [open]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  useEffect(() => { setActive(0); }, [q]);

  const onKey = (e: KeyboardEvent) => {
    const max = shown.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(max, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(max); }
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) { e.preventDefault(); choose(shown[active]); }
    else if (!searchable && e.key.length === 1) { const i = shown.findIndex(o => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) setActive(i); }
  };
  let lastGroup: string | undefined;

  return (
    <>
      <button ref={btn} type="button" class={`c-dd ${size === 'sm' ? 'c-dd--sm' : ''} ${block ? 'c-dd--block' : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); } }}>
        <span class="c-dd__value">{renderValue ? renderValue(selected) : selected?.label ?? placeholder}</span><Icon name="right" size={16} class="c-dd__chev" />
      </button>
      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)} label={label} width={searchable ? 360 : 'anchor'}>
        <div class="c-pop__title">{label}</div>
        {searchable && <div class="c-dd__search"><input ref={search} type="search" placeholder="Buscar…" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} onKeyDown={onKey} aria-controls={id} aria-activedescendant={`${id}-${active}`} /></div>}
        <ul ref={list} id={id} class="c-dd__list" role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-${active}`} onKeyDown={onKey}>
          {shown.map((o, i) => {
            const head = o.group && o.group !== lastGroup ? (lastGroup = o.group) : null;
            return <>
              {head && <li class="c-dd__group" role="presentation">{head}</li>}
              <li id={`${id}-${i}`} data-i={i} role="option" aria-selected={o.value === value} aria-disabled={o.disabled} class={`c-dd__opt ${i === active ? 'is-active' : ''}`} onPointerEnter={() => setActive(i)} onClick={() => choose(o)}>
                <span class="c-dd__label">{o.label}{o.hint && <span class="c-dd__hint">{o.hint}</span>}</span>{o.value === value && <Icon name="check" size={16} />}
              </li>
            </>;
          })}
          {!shown.length && <li class="c-dd__empty" role="presentation">Sin resultados</li>}
        </ul>
      </Popover>
    </>
  );
}
