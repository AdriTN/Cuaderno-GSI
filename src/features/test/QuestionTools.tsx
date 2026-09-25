import { useState } from 'preact/hooks';
import { topicById } from '@/core/content';
import { aiErrorMessage, aiStatus, askText } from '@/core/services/ai';
import { explainPrompt } from '@/core/services/prompts';
import { flagQuestion, unflagQuestion } from '@/core/store/actions';
import { isFlagged } from '@/core/store/selectors';
import { useDocs } from '@/core/store/store';
import type { Question } from '@/core/types';
import { Button, Field, Modal, TextArea, toast } from '@/ui';

/** Explicación de una pregunta con IA, en línea. */
export function ExplainButton({ q, answer }: { q: Question; answer: number }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  if (aiStatus.value === 'off') return null;
  const run = async () => {
    setBusy(true); setText('Pensando…');
    try { setText(await askText(explainPrompt(q, topicById[q.t].title, answer), { onText: setText })); }
    catch (e) { setText(aiErrorMessage(e)); }
    setBusy(false);
  };
  return <>
    <Button size="sm" icon="spark" onClick={run} disabled={busy}>Explícamelo</Button>
    {text && <div class="t-ai" style={{ flexBasis: '100%' }}>{text}</div>}
  </>;
}

/** Señalar una clave que crees errónea (con nota). */
export function FlagButton({ id }: { id: string }) {
  useDocs();
  const [open, setOpen] = useState(false); const [note, setNote] = useState('');
  const flagged = isFlagged(id);
  return <>
    <Button size="sm" variant="ghost" icon="flag" onClick={() => flagged ? (unflagQuestion(id), toast('Marca retirada')) : setOpen(true)}>{flagged ? 'Clave señalada' : '¿Clave errónea?'}</Button>
    <Modal open={open} title="Señalar la clave" onClose={() => setOpen(false)}
      actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="primary" onClick={() => { flagQuestion(id, note); setOpen(false); toast('Pregunta señalada'); }}>Señalar</Button></>}>
      <p class="u-muted" style={{ margin: 0 }}>La pregunta aparecerá en Progreso y dejará de salir en tus test si así lo tienes en Ajustes.</p>
      <Field label="¿Qué crees que falla?"><TextArea value={note} onInput={e => setNote((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 90 }} placeholder="Por ejemplo: la ley cambió en 2024 y ahora el plazo es…" /></Field>
    </Modal>
  </>;
}
