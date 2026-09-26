import { aiActivity, cancelAiActivity } from '@/core/services/ai';
import { clock } from '@/core/utils/format';
import { Button } from '@/ui';
import { tick } from './studyTimer';

/** Aviso flotante mientras Claude trabaja con tu suscripción (sobre todo útil con el agente, que tarda minutos). */
export function AiActivity() {
  void tick.value;
  const a = aiActivity.value;
  if (!a) return null;
  const s = (Date.now() - a.startedAt) / 1000;
  const text = a.via === 'puente' ? 'Claude responde desde tu PC' : a.phase === 'waiting' ? 'Claude trabaja en GitHub (suele tardar 1-3 min)' : 'Enviando la consulta a GitHub';
  return (
    <div class="l-ai" role="status" aria-live="polite">
      <span class="l-ai__dot" aria-hidden="true" />
      <span>{text}</span><span class="u-num u-muted">{clock(s)}</span>
      {a.via === 'agente' && <Button size="sm" variant="ghost" onClick={cancelAiActivity}>Cancelar</Button>}
    </div>
  );
}
