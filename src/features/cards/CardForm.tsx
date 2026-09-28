import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { topicOptions } from '@/core/content';
import { addOwnCard } from '@/core/store/actions';
import { onReset } from '@/core/store/store';
import { Button, Dropdown, Field, Modal, TextArea, toast } from '@/ui';

type Props = { open: boolean; onClose: () => void; topic: string; front?: string; back?: string };

/**
 * Borrador de la tarjeta que estás escribiendo. Si la ventana se cierra sin querer (tecla Esc, clic fuera o cambiar
 * de sección), al volver a abrirla sigue ahí; solo se descarta con «Cancelar» o al guardarla.
 */
const draft = signal<{ t: string; f: string; b: string } | null>(null);
onReset(() => { draft.value = null; });

export function CardForm({ open, onClose, topic, front = '', back = '' }: Props) {
  const [t, setT] = useState(topic), [f, setF] = useState(front), [b, setB] = useState(back);
  useEffect(() => {
    if (!open) return;
    const d = draft.value;
    if (d && !front && !back) { setT(d.t); setF(d.f); setB(d.b); } else { setT(topic); setF(front); setB(back); }
  }, [open]);
  useEffect(() => { if (open) draft.value = f.trim() || b.trim() ? { t, f, b } : null; }, [t, f, b]);
  const save = () => {
    if (!f.trim() || !b.trim()) return toast('Escribe la pregunta y la respuesta');
    if (!addOwnCard(t, f.trim(), b.trim())) return toast('Has llegado al máximo de tarjetas propias');
    draft.value = null; toast('Tarjeta guardada'); onClose();
  };
  const cancel = () => { draft.value = null; onClose(); };
  return (
    <Modal open={open} title="Nueva tarjeta" onClose={onClose} actions={<><Button variant="ghost" onClick={cancel}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar tarjeta</Button></>}>
      <Field group label="Tema"><Dropdown block searchable label="Tema" value={t} onChange={setT} options={topicOptions()} /></Field>
      <Field label="Pregunta"><TextArea value={f} onInput={e => setF((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 70 }} placeholder="Por ejemplo: ¿cada cuánto se audita un sistema de categoría MEDIA en el ENS?" /></Field>
      <Field label="Respuesta"><TextArea value={b} onInput={e => setB((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 90 }} /></Field>
    </Modal>
  );
}
