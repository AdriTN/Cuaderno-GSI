import { signal } from '@preact/signals';
import { CONTENT, topicById, topicCode } from '@/core/content';
import { allCards } from '@/core/domain/cards';
import { askJSON, aiErrorMessage } from '@/core/services/ai';
import { cardsPrompt } from '@/core/services/prompts';
import { addOwnCard } from '@/core/store/actions';
import { docs, onReset } from '@/core/store/store';
import { plural } from '@/core/utils/format';
import { htmlToText } from '@/core/utils/text';
import { toast } from '@/ui';

/** Pide a la IA 10 tarjetas nuevas de un tema y las guarda como propias. Devuelve cuántas creó. */
async function cardsForTopic(topicId: string): Promise<number> {
  const existing = allCards(docs.cards.own).filter(c => c.t === topicId).map(c => c.f).slice(0, 60);
  let res = await askJSON<any>(cardsPrompt(topicById[topicId].title, htmlToText(CONTENT.content[topicId]).slice(0, 15000), existing));
  if (!Array.isArray(res)) res = res?.cards ?? res?.tarjetas ?? [];
  let n = 0;
  for (const c of res.slice(0, 12)) if (c?.f && c?.b && addOwnCard(topicId, String(c.f), String(c.b), 'ia')) n++;
  return n;
}

export async function generateCards(topicId: string) {
  toast('Creando tarjetas… puede tardar hasta un minuto');
  try { toast(plural(await cardsForTopic(topicId), 'tarjeta creada', 'tarjetas creadas')); }
  catch (e) { toast(aiErrorMessage(e)); }
}

/* ---------- generación en bloque (sigue aunque cambies de pantalla) ---------- */
export type BulkJob = { topics: string[]; done: number; created: number; current?: string; errors: string[]; cancelled: boolean; finished: boolean };
export const bulkJob = signal<BulkJob | null>(null);
onReset(() => { if (bulkJob.value) bulkJob.value = { ...bulkJob.value, cancelled: true }; bulkJob.value = null; });

export const aiCardsOf = (topicId: string) => Object.values(docs.cards.own).filter(c => c.t === topicId && c.s === 'ia').length;

export async function generateBulk(topics: string[]) {
  if (bulkJob.value && !bulkJob.value.finished) return;
  const job: BulkJob = { topics, done: 0, created: 0, errors: [], cancelled: false, finished: false };
  bulkJob.value = job;
  for (const t of topics) {
    if (bulkJob.value?.cancelled || !bulkJob.value || bulkJob.value.topics !== topics) break;
    bulkJob.value = { ...job, cancelled: bulkJob.value.cancelled, current: t };
    try { job.created += await cardsForTopic(t); }
    catch (e: any) {
      job.errors.push(`${topicCode(t)}: ${aiErrorMessage(e)}`);
      // Errores que afectarán a todos los temas: se detiene en lugar de repetir el fallo.
      if (['auth', 'limit', 'unavailable', 'not_granted', 'forbidden'].includes(e?.code)) { job.cancelled = true; }
    }
    job.done++;
    if (bulkJob.value?.topics === topics) bulkJob.value = { ...job, cancelled: job.cancelled || bulkJob.value.cancelled, current: undefined };
  }
  if (bulkJob.value?.topics === topics) {
    bulkJob.value = { ...job, cancelled: job.cancelled || bulkJob.value.cancelled, finished: true, current: undefined };
    toast(`${plural(job.created, 'tarjeta creada', 'tarjetas creadas')} en ${plural(job.done, 'tema', 'temas')}${job.errors.length ? `, con ${job.errors.length} errores` : ''}`);
  }
}
export const cancelBulk = () => { const j = bulkJob.value; if (j && !j.finished) bulkJob.value = { ...j, cancelled: true }; };
export const clearBulk = () => { if (bulkJob.value?.finished || bulkJob.value?.cancelled) bulkJob.value = null; };
