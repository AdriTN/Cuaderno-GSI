import { questionsByTopic } from '../content';
import type { SrsEntry } from '../types';

export interface TopicStats { total: number; seen: number; right: number; wrong: number; accuracy: number | null }

export function topicStats(srs: Record<string, SrsEntry>, topicId: string): TopicStats {
  let right = 0, wrong = 0, seen = 0;
  const qs = questionsByTopic[topicId] ?? [];
  for (const q of qs) { const e = srs[q.i]; if (e) { seen++; right += e[2]; wrong += e[3]; } }
  return { total: qs.length, seen, right, wrong, accuracy: right + wrong ? right / (right + wrong) : null };
}

/** Netos del test: aciertos menos un tercio de los errores. */
export const netScore = (ok: number, ko: number) => ok - ko / 3;

export type Calibration = { sure: [number, number]; doubt: [number, number]; doubtNet: number; verdict: 'blank' | 'careful' | 'risk' } | null;

/** ¿Compensa responder cuando dudas? Compara el aporte neto de las respuestas marcadas con duda. */
export function calibration(sure: [number, number], doubt: [number, number]): Calibration {
  const n = doubt[0] + doubt[1];
  if (n < 3) return null;
  const doubtNet = netScore(doubt[0], doubt[1]);
  const verdict = doubtNet < 0 ? 'blank' : doubtNet < n * 0.15 ? 'careful' : 'risk';
  return { sure, doubt, doubtNet, verdict };
}
