import { TOPICS } from '../content';
import type { BlockId, Settings, TopicStatus, WeekType } from '../types';
import { addDays, dayNum, mondayOf, parseISO, weekdayIdx } from '../utils/date';

export type Phase = 0 | 1 | 2 | 3;
export const PHASE_LABEL = ['Diagnóstico', 'Primera vuelta', 'Segunda vuelta y supuestos', 'Simulacros'] as const;
export const PHASE_TIP = [
  'Mide tu punto de partida: haz un examen oficial completo en condiciones reales y revisa en qué bloques fallas más.',
  'Estudia los temas del día con el método: esquema, recuerdo sin mirar, subrayado y test del tema al terminar.',
  'Repasa los temas indicados, haz test mezclados dos días a la semana y un supuesto práctico completo el sábado.',
  'Un simulacro completo cada semana (test de 90 minutos y supuesto de 180) y repaso de tus errores. Nada de temas nuevos al final.',
] as const;

export interface Week { i: number; n: number; from: Date; to: Date; phase: Phase; type: WeekType; review: string[] }
export interface PlanFrame { start: Date; exam: Date; weeks: Week[]; current: number; phaseWeeks: [number, number, number, number] }
export interface PlanState { assign: Record<string, number>; pin: Record<string, 1>; wtype: Record<number, WeekType> }

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const isChristmas = (from: Date) => Array.from({ length: 7 }, (_, d) => addDays(from, d)).some(x => (x.getMonth() === 11 && x.getDate() >= 24) || (x.getMonth() === 0 && x.getDate() <= 1));

/** Semanas y fases del plan a partir de los ajustes. Las fases se recortan si no caben. */
export function buildFrame(s: Settings, wtype: Record<number, WeekType>, todayNum: number): PlanFrame {
  const start = mondayOf(parseISO(s.start)), exam = parseISO(s.exam);
  const total = Math.max(8, Math.floor((dayNum(exam) - dayNum(start)) / 7) + 1);
  let f0 = clamp(s.f0, 0, 4), f2 = clamp(s.f2, 0, 16), f3 = clamp(s.f3, 1, 12), f1 = total - f0 - f2 - f3;
  const steal = (have: number, min: number) => { const c = Math.max(0, Math.min(have - min, 4 - f1)); f1 += c; return have - c; };
  if (f1 < 4) f2 = steal(f2, 0);
  if (f1 < 4) f3 = steal(f3, 1);
  if (f1 < 4) f0 = steal(f0, 0);
  const weeks: Week[] = Array.from({ length: total }, (_, i) => {
    const from = addDays(start, 7 * i);
    const phase: Phase = i < f0 ? 0 : i < f0 + f1 ? 1 : i < f0 + f1 + f2 ? 2 : 3;
    const type = wtype[i] ?? (isChristmas(from) && (phase === 1 || phase === 2) ? 'h' : 'n');
    return { i, n: i + 1, from, to: addDays(from, 6), phase, type, review: [] };
  });
  // Segunda vuelta: todo el temario repartido por bloques; la última semana, temas débiles.
  const reviewWeeks = weeks.filter(w => w.phase === 2 && w.type !== 'v');
  const order = (['B1', 'B2', 'B4', 'B3'] as BlockId[]).flatMap(b => TOPICS.filter(t => t.b === b).map(t => t.id));
  const slots = Math.max(1, reviewWeeks.length - 1), per = Math.ceil(order.length / slots);
  reviewWeeks.forEach((w, k) => { w.review = k < slots ? order.slice(k * per, (k + 1) * per) : []; });
  return { start, exam, weeks, current: Math.floor((todayNum - dayNum(start)) / 7), phaseWeeks: [f0, f1, f2, f3] };
}

/** Orden de estudio de la primera vuelta; opcionalmente reparte el Bloque 1 entre los técnicos. */
export function studyOrder(s: Settings): string[] {
  const order = s.order?.length === 4 ? s.order : (['B1', 'B2', 'B4', 'B3'] as BlockId[]);
  const ofBlock = (b: BlockId) => TOPICS.filter(t => t.b === b).map(t => t.id);
  if (!s.b1inter) return order.flatMap(ofBlock);
  const legal = ofBlock('B1'), tech = order.filter(b => b !== 'B1').flatMap(ofBlock);
  const total = legal.length + tech.length, step = total / legal.length, out: string[] = [];
  let li = 0, ti = 0;
  for (let k = 0; k < total; k++) out.push(li < legal.length && (k >= Math.floor(li * step) || ti >= tech.length) ? legal[li++] : tech[ti++]);
  return out;
}

/**
 * Reparte los temas pendientes desde la semana `fromWeek`, respetando los estudiados y los fijados a mano.
 * Con `reorder` usa el orden de los ajustes; si no, conserva el orden que ya tenían en el plan.
 */
export function redistribute(frame: PlanFrame, plan: PlanState, settings: Settings, status: (id: string) => TopicStatus, fromWeek: number, reorder: boolean): PlanState {
  const next: PlanState = { assign: { ...plan.assign }, pin: { ...plan.pin }, wtype: { ...plan.wtype } };
  const from = Math.max(0, fromWeek);
  const seq = studyOrder(settings), pos = new Map(seq.map((id, k) => [id, k]));
  const keep = (id: string) => status(id) >= 2 || (next.pin[id] && (next.assign[id] ?? -1) >= from);
  const pending = seq.filter(id => !keep(id));
  if (!reorder) pending.sort((a, b) => ((next.assign[a] ?? 1e9) - (next.assign[b] ?? 1e9)) || (pos.get(a)! - pos.get(b)!));
  let target = frame.weeks.filter(w => w.phase === 1 && w.i >= from && w.type !== 'v');
  if (!target.length) target = frame.weeks.filter(w => w.phase === 2 && w.i >= from && w.type !== 'v');
  if (!target.length) target = [frame.weeks[Math.min(from, frame.weeks.length - 1)]];
  const units = target.map(w => (w.type === 'h' ? 0.5 : 1)), total = units.reduce((a, b) => a + b, 0);
  let acc = 0, prev = 0;
  target.forEach((w, k) => {
    acc += units[k];
    const upto = Math.round((pending.length * acc) / total);
    for (const id of pending.slice(prev, upto)) { next.assign[id] = w.i; delete next.pin[id]; }
    prev = upto;
  });
  const fallback = (frame.weeks.find(w => w.phase === 1 && w.i >= from) ?? frame.weeks.find(w => w.phase === 1) ?? target[0]).i;
  for (const id of seq) next.assign[id] ??= fallback;
  return next;
}

export function topicsOfWeek(plan: PlanState, settings: Settings, week: number): string[] {
  const order = studyOrder(settings);
  return order.filter(id => plan.assign[id] === week);
}

/** Temas atrasados (pendientes de semanas ya pasadas) y adelantados (estudiados antes de su semana). */
export function progressVsPlan(frame: PlanFrame, plan: PlanState, status: (id: string) => TopicStatus) {
  const late: string[] = []; let ahead = 0;
  for (const t of TOPICS) {
    const w = plan.assign[t.id], done = status(t.id) >= 2;
    if (w < frame.current && !done) late.push(t.id);
    if (w > frame.current && done) ahead++;
  }
  return { late, ahead };
}

/** Temas que tocan hoy: los pendientes de la semana repartidos entre los días de estudio que quedan. */
export function todaysTopics(weekTopics: string[], status: (id: string) => TopicStatus, studyDays: number[], now = new Date()) {
  const pending = weekTopics.filter(id => status(id) < 2);
  const dow = weekdayIdx(now), remaining = studyDays.filter(d => d >= dow).length, isStudyDay = studyDays.includes(dow);
  const n = isStudyDay && remaining ? Math.ceil(pending.length / remaining) : 0;
  return { pending, today: pending.slice(0, n), isStudyDay };
}
