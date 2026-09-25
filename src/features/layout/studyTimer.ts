import { signal } from '@preact/signals';
import { topicById, topicCode } from '@/core/content';
import { logStudyTime } from '@/core/store/actions';
import { onReset } from '@/core/store/store';
import { route } from '@/app/router';

/**
 * Cronómetro de sesiones de estudio. Imputa el tiempo al contexto actual (tema abierto, test, tarjetas…),
 * guarda cada minuto y se pausa solo tras 25 minutos sin actividad.
 */
const IDLE_MS = 25 * 60 * 1000;
export const timer = signal({ running: false, since: 0, context: 'gen' });
export const tick = signal(0);
let lastInput = Date.now();

export function contextFor(name: string, param?: string) {
  if (name === 'tema' && param && topicById[param]) return param;
  if (name === 'supuesto') return 'sup';
  if (['run', 'resultado', 'refuerzo', 'examen', 'entrenamiento', 'mi-examen'].includes(name)) return 'test';
  if (name === 'tarjetas') return 'cards';
  if (name === 'cuadernos' || name === 'cuaderno') return 'prac';
  return 'gen';
}
export const contextLabel = (c: string) => topicById[c] ? topicCode(c) : ({ sup: 'Supuestos', test: 'Test', cards: 'Tarjetas', prac: 'Cuadernos', gen: 'General' } as Record<string, string>)[c] ?? c;

function commitElapsed(until = Date.now()) {
  const t = timer.value; if (!t.running) return;
  logStudyTime(t.context, (until - t.since) / 1000);
  timer.value = { ...t, since: until };
}
export function toggleTimer() {
  const t = timer.value;
  if (t.running) { commitElapsed(); timer.value = { ...timer.value, running: false }; }
  else timer.value = { running: true, since: Date.now(), context: contextFor(route.value.name, route.value.param) };
}
export const pendingSeconds = () => (timer.value.running ? (Date.now() - timer.value.since) / 1000 : 0);
export const isTimerRunning = () => timer.value.running;

export function initStudyTimer() {
  onReset(() => { timer.value = { running: false, since: 0, context: 'gen' }; });
  ['keydown', 'pointerdown', 'scroll', 'input'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
  route.subscribe(r => {
    const t = timer.value; const c = contextFor(r.name, r.param);
    if (t.running && c !== t.context) { commitElapsed(); timer.value = { ...timer.value, context: c }; }
  });
  setInterval(() => {
    const t = timer.value;
    if (t.running && Date.now() - lastInput > IDLE_MS) { commitElapsed(lastInput); timer.value = { ...timer.value, running: false }; }
    else if (t.running && Date.now() - t.since > 60_000) commitElapsed();
    tick.value++;
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') commitElapsed(); });
  window.addEventListener('beforeunload', () => commitElapsed());
}
