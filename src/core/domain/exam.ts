import { BLOCKS, QUESTIONS, TOPICS, pastExamById, questionById, topicById } from '../content';
import type { Origin, Question, SrsEntry } from '../types';
import { shuffle, weightedSample } from '../utils/random';
import { topicStats } from './stats';

export type Sources = Record<Origin, boolean>;
/** Orígenes por defecto: todo menos lo generado con IA, que depende del ajuste. */
export const defaultSources = (ai: boolean): Sources => ({ O: true, P: true, M: true, I: ai });
export type Filter = 'all' | 'weak' | 'new' | 'fail';
export const SECONDS_PER_QUESTION = 54;
export const EXAM_SECONDS = 5400;

interface PoolOptions { topics: string[]; sources: Sources; filter: Filter; srs: Record<string, SrsEntry>; excluded: (id: string) => boolean }

export function questionPool({ topics, sources, filter, srs, excluded }: PoolOptions): Question[] {
  const set = new Set(topics);
  return QUESTIONS.filter(q => set.has(q.t) && sources[q.o] && !excluded(q.i) && (
    filter === 'all' || filter === 'weak' ||
    (filter === 'new' && !srs[q.i]) ||
    (filter === 'fail' && !!srs[q.i] && srs[q.i][3] > 0)));
}

/** Selección adaptativa: pesa más los temas flojos, lo fallado y lo pendiente de repaso. */
export function pickAdaptive(pool: Question[], n: number, srs: Record<string, SrsEntry>, day: number): Question[] {
  const topicWeight = new Map<string, number>();
  const weight = (q: Question) => {
    if (!topicWeight.has(q.t)) { const s = topicStats(srs, q.t); topicWeight.set(q.t, (s.wrong + 1) / (s.right + s.wrong + 2)); }
    let w = topicWeight.get(q.t)!;
    const e = srs[q.i];
    if (!e) w *= 1.2;
    else { if (e[1] <= day) w *= 2.2; if (e[3] > 0 && e[0] < 3) w *= 2; if (e[0] >= 4) w *= 0.2; }
    return w;
  };
  return weightedSample(pool, weight, n);
}

/** Examen oficial en su orden; las anuladas se completan con las de reserva hasta 100. */
export function officialExam(year: string): string[] {
  const all = QUESTIONS.filter(q => q.o === 'O' && q.e === year);
  const main = all.filter(q => !q.r).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  const reserve = all.filter(q => q.r).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  return [...main, ...reserve.slice(0, Math.max(0, 100 - main.length))].map(q => q.i);
}
/** Examen anterior de PreparaTIC completo y en su orden. */
export const pastExam = (id: string): string[] => (pastExamById[id]?.q ?? []).filter(q => questionById[q]);
export const OFFICIAL_YEARS = [...new Set(QUESTIONS.filter(q => q.o === 'O').map(q => q.e!))].sort().reverse();

/** Simulacro aleatorio de 100 preguntas con cuotas por bloque proporcionales a su nº de temas. */
export function randomMock(includeAi: boolean, excluded: (id: string) => boolean): string[] {
  const ids: string[] = [];
  for (const b of BLOCKS) {
    const quota = Math.round((100 * TOPICS.filter(t => t.b === b.id).length) / TOPICS.length);
    const pool = QUESTIONS.filter(q => topicById[q.t].b === b.id && (q.o !== 'I' || includeAi) && !excluded(q.i));
    ids.push(...shuffle(pool).slice(0, quota).map(q => q.i));
  }
  return shuffle(ids).slice(0, 100);
}

/** Corrige unas respuestas contra una plantilla oficial ("-" o espacio = en blanco). */
export function scoreAgainstKey(answers: string, key: string) {
  let right = 0, wrong = 0, blank = 0;
  const detail = [...key].map((k, i) => {
    const a = (answers[i] ?? '').toLowerCase();
    if (!'abcd'.includes(a) || !a) { blank++; return 'blank' as const; }
    if (a === k) { right++; return 'right' as const; }
    wrong++; return 'wrong' as const;
  });
  return { right, wrong, blank, net: right - wrong / 3, detail };
}
