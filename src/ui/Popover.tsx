import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import './pickers.css';

/**
 * Capa flotante anclada a un elemento. Se monta en <body> o en su <dialog> (portal) para que no la recorten paneles
 * ni contenedores; se coloca debajo o encima según el espacio, y en móvil se abre como panel inferior.
 */
type Props = { anchor: HTMLElement | null; open: boolean; onClose: () => void; children: ComponentChildren; width?: number | 'anchor'; label: string };

const isSheet = () => matchMedia('(max-width: 640px)').matches;

export function Popover({ anchor, open, onClose, children, width = 'anchor', label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const sheet = isSheet();

  useLayoutEffect(() => {
    if (!open || !anchor || sheet) return;
    const place = () => {
      const r = anchor.getBoundingClientRect(), w = width === 'anchor' ? Math.max(r.width, 220) : width;
      const h = ref.current?.offsetHeight ?? 300, below = innerHeight - r.bottom, up = below < h + 12 && r.top > below;
      setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.left, innerWidth - w - 8)), width: w, up });
    };
    place();
    addEventListener('resize', place); addEventListener('scroll', place, true);
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  }, [open, anchor, sheet]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor?.focus(); } };
    document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); };
  }, [open, anchor]);

  if (!open) return null;
  return createPortal(
    sheet
      ? <div class="c-sheet" role="presentation"><div class="c-sheet__scrim" onClick={onClose} /><div ref={ref} class="c-sheet__body" role="dialog" aria-label={label}><div class="c-sheet__grip" aria-hidden="true" />{children}</div></div>
      : <div ref={ref} class={`c-pop ${pos?.up ? 'c-pop--up' : ''}`} role="dialog" aria-label={label} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width }}>{children}</div>,
    // Dentro de un <dialog> modal hay que montarse en él: el modal vive en una capa superior y bloquea el resto.
    anchor?.closest('dialog') ?? document.body,
  );
}
