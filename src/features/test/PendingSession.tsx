import { Button, Callout, confirmDialog } from '@/ui';
import { activeSession, discard } from './session';

/** Aviso de test o examen sin terminar, con opción de continuar o descartarlo. */
export function PendingSession() {
  const s = activeSession();
  if (!s) return null;
  const answered = s.ans.filter(a => a !== -2).length;
  return (
    <Callout tone="warn" action={<div class="u-row"><Button size="sm" variant="primary" href="#run">Continuar</Button><Button size="sm" variant="ghost" onClick={async () => { if (await confirmDialog({ title: 'Descartar el test', message: 'Las respuestas ya corregidas se conservan en tu progreso.', confirm: 'Descartar', danger: true })) discard(); }}>Descartar</Button></div>}>
      Tienes «{s.label}» sin terminar: {answered} de {s.qs.length} respondidas.
    </Callout>
  );
}
