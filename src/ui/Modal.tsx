import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Button } from './Button';
import './overlay.css';

type Props = { open: boolean; title: string; onClose: () => void; children: ComponentChildren; actions?: ComponentChildren };

/** Diálogo modal nativo (<dialog>): gestiona foco, Escape y fondo sin librerías. */
export function Modal({ open, title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} class="c-modal" onClose={onClose} onCancel={onClose} aria-label={title}>
      {open && <>
        <div class="c-modal__head"><h2 class="c-modal__title">{title}</h2><Button variant="ghost" size="sm" icon="close" iconOnly aria-label="Cerrar" onClick={onClose} /></div>
        <div class="c-modal__body">{children}</div>
        {actions && <div class="c-modal__foot">{actions}</div>}
      </>}
    </dialog>
  );
}
