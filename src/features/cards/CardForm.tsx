import { useEffect, useState } from 'preact/hooks';
import { topicOptions } from '@/core/content';
import { addOwnCard } from '@/core/store/actions';
import { Button, Dropdown, Field, Modal, TextArea, toast } from '@/ui';

type Props = { open: boolean; onClose: () => void; topic: string; front?: string; back?: string };

export function CardForm({ open, onClose, topic, front = '', back = '' }: Props) {
  const [t, setT] = useState(topic), [f, setF] = useState(front), [b, setB] = useState(back);
  useEffect(() => { if (open) { setT(topic); setF(front); setB(back); } }, [open]);
  const save = () => {
    if (!f.trim() || !b.trim()) return toast('Escribe la pregunta y la respuesta');
    if (!addOwnCard(t, f.trim(), b.trim())) return toast('Has llegado al máximo de tarjetas propias');
    toast('Tarjeta guardada'); onClose();
  };
  return (
    <Modal open={open} title="Nueva tarjeta" onClose={onClose} actions={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar tarjeta</Button></>}>
      <Field group label="Tema"><Dropdown block searchable label="Tema" value={t} onChange={setT} options={topicOptions()} /></Field>
      <Field label="Pregunta"><TextArea value={f} onInput={e => setF((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 70 }} placeholder="Por ejemplo: ¿cada cuánto se audita un sistema de categoría MEDIA en el ENS?" /></Field>
      <Field label="Respuesta"><TextArea value={b} onInput={e => setB((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 90 }} /></Field>
    </Modal>
  );
}
