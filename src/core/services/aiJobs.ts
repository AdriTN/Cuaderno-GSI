/**
 * Respuestas de IA en curso o ya recibidas (explicaciones, esquemas…), guardadas por clave fuera de los componentes.
 * Si cambias de pantalla mientras la IA responde, la petición sigue en segundo plano y, al volver, ves el
 * resultado en vez de haberlo perdido (y sin gastar otra consulta de tu suscripción).
 * Se conservan mientras la app está abierta; lo que quieras guardar para siempre, añádelo a tus notas.
 */
import { signal } from '@preact/signals';
import { onReset } from '../store/store';

export type AiJob = { text: string; busy: boolean };
export const aiJobs = signal<Record<string, AiJob>>({});
onReset(() => { aiJobs.value = {}; });

const set = (key: string, job: AiJob) => { aiJobs.value = { ...aiJobs.value, [key]: job }; };
export const aiJob = (key: string): AiJob | undefined => aiJobs.value[key];

/** Lanza (una sola vez a la vez por clave) una consulta de texto que va escribiendo su progreso en `aiJobs`. */
export async function runAiJob(key: string, placeholder: string, ask: (onText: (t: string) => void) => Promise<string>, onError: (e: unknown) => string) {
  if (aiJobs.value[key]?.busy) return;
  set(key, { text: placeholder, busy: true });
  try { set(key, { text: await ask(t => set(key, { text: t, busy: true })), busy: false }); }
  catch (e) { set(key, { text: onError(e), busy: false }); }
}
