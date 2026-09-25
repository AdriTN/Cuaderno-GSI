import { signal } from '@preact/signals';
import { Button } from './Button';
import { Modal } from './Modal';

/** Confirmaciones propias en lugar de confirm() del navegador. Uso: `if (await confirmDialog({...})) …` */
type Req = { title: string; message?: string; confirm?: string; cancel?: string; danger?: boolean; resolve: (ok: boolean) => void };
const current = signal<Req | null>(null);

export function confirmDialog(o: Omit<Req, 'resolve'>): Promise<boolean> {
  return new Promise(resolve => { current.value?.resolve(false); current.value = { ...o, resolve }; });
}
const close = (ok: boolean) => { const r = current.value; current.value = null; r?.resolve(ok); };

export function DialogHost() {
  const r = current.value;
  return (
    <Modal open={!!r} title={r?.title ?? ''} onClose={() => close(false)}
      actions={r && <><Button variant="ghost" onClick={() => close(false)}>{r.cancel ?? 'Cancelar'}</Button><Button variant={r.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{r.confirm ?? 'Aceptar'}</Button></>}>
      {r?.message && <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.message}</p>}
    </Modal>
  );
}
