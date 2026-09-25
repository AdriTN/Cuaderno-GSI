import type { SrsEntry } from '../types';

/** Intervalos en días por nivel de consolidación (sistema Leitner ampliado). */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
/** `doubt`: acertada pero marcada con duda; cuenta como acierto y vuelve pronto al refuerzo. */
export type QuestionResult = 'right' | 'doubt' | 'wrong' | 'blank';
export type CardGrade = 1 | 2 | 3;

const EMPTY: SrsEntry = [0, 0, 0, 0, 0];

/** Nuevo estado de una pregunta tras responderla. Función pura. */
export function gradeQuestion(prev: SrsEntry | undefined, result: QuestionResult, day: number): SrsEntry {
  const e = [...(prev ?? EMPTY)] as SrsEntry;
  if (result === 'right') { e[0] = prev ? Math.min(e[0] + 1, 6) : 2; e[2]++; e[1] = day + INTERVALS[e[0]]; }
  else if (result === 'doubt') { e[0] = Math.min(e[0], 1); e[2]++; e[1] = day + 1; }
  else { e[0] = 0; if (result === 'wrong') e[3]++; e[1] = day + 1; }
  e[4] = day;
  return e;
}

/** Nuevo estado de una tarjeta: 1 no me acordaba, 2 me costó, 3 lo sabía. */
export function gradeCard(prev: SrsEntry | undefined, grade: CardGrade, day: number): SrsEntry {
  const e = [...(prev ?? EMPTY)] as SrsEntry;
  if (grade === 3) { e[0] = prev ? Math.min(e[0] + 1, 6) : 2; e[2]++; e[1] = day + INTERVALS[e[0]]; }
  else if (grade === 2) { e[0] = Math.max(1, Math.min(e[0], 2)); e[2]++; e[1] = day + Math.max(1, Math.round(INTERVALS[e[0]] / 2)); }
  else { e[0] = 0; e[3]++; e[1] = day + 1; }
  e[4] = day;
  return e;
}

export const isDue = (e: SrsEntry, day: number) => e[1] <= day;
