/** Todas las mutaciones del estado pasan por aquí. Los componentes nunca modifican `docs` directamente. */
import { buildFrame, redistribute } from '../domain/plan';
import { gradeCard, gradeQuestion, type CardGrade, type QuestionResult } from '../domain/srs';
import type { AiScore, CaseState, GeneratedCase, HistEntry, Highlight, Settings, TopicStatus, WeekType } from '../types';
import { today, todayISO } from '../utils/date';
import { uid } from '../utils/random';
import { DOC_KEYS } from './defaults';
import { topicStatus } from './selectors';
import { commit, docs, emitReset, replaceDoc } from './store';

const trimKeys = (o: Record<string, unknown>, max: number) => { const k = Object.keys(o).sort(); while (k.length > max) delete o[k.shift()!]; };

/* ---------- actividad y tiempo ---------- */
export function logActivity(n = 1) { const k = todayISO(); docs.core.act[k] = (docs.core.act[k] ?? 0) + n; trimKeys(docs.core.act, 400); commit('core'); }
export function logStudyTime(context: string, seconds: number) {
  if (seconds < 5) return;
  const day = (docs.core.time[todayISO()] ??= {});
  day[context] = Math.round((day[context] ?? 0) + seconds);
  trimKeys(docs.core.time, 400);
  commit('core');
}

/* ---------- temario ---------- */
export function setTopicStatus(id: string, st: TopicStatus) { docs.core.topics[id] = { st, d: todayISO() }; logActivity(1); }
export function markTopicOpened(id: string) { if (topicStatus(id) === 0) setTopicStatus(id, 1); }
export function saveNote(id: string, text: string) { if (text) docs.notes.m[id] = text.slice(0, 30000); else delete docs.notes.m[id]; commit('notes'); }
export function addHighlight(topicId: string, h: Highlight) { const arr = (docs.notes.hl[topicId] ??= []); if (arr.length >= 200) return false; arr.push(h); commit('notes'); return true; }
export function removeHighlight(topicId: string, index: number) { const arr = docs.notes.hl[topicId] ?? []; arr.splice(index, 1); if (!arr.length) delete docs.notes.hl[topicId]; commit('notes'); }

/* ---------- preguntas ---------- */
export function answerQuestion(id: string, result: QuestionResult) { docs.srs.m[id] = gradeQuestion(docs.srs.m[id], result, today()); }
/** Programa una pregunta para el refuerzo de hoy (acción explícita del usuario). */
export function reinforce(id: string) { const e = docs.srs.m[id] ?? [0, 0, 0, 0, 0]; docs.srs.m[id] = [Math.min(e[0], 1), today(), e[2], e[3], e[4] || today()]; commit('srs'); }
export function saveAnswers() { commit('srs'); }
export function recordTest(entry: HistEntry) { docs.core.hist.push(entry); if (docs.core.hist.length > 300) docs.core.hist.splice(0, docs.core.hist.length - 300); commit('core'); }
export function flagQuestion(id: string, note: string) { docs.core.qflags[id] = { n: note.slice(0, 300), d: todayISO() }; commit('core'); }
export function unflagQuestion(id: string) { delete docs.core.qflags[id]; commit('core'); }

/* ---------- tarjetas ---------- */
export const MAX_OWN_CARDS = 1200;
export function gradeStudyCard(id: string, g: CardGrade) { docs.cards.m[id] = gradeCard(docs.cards.m[id], g, today()); commit('cards'); logActivity(1); }
export function addOwnCard(topic: string, front: string, back: string, source: 'u' | 'ia' = 'u') {
  if (Object.keys(docs.cards.own).length >= MAX_OWN_CARDS) return false;
  docs.cards.own[(source === 'ia' ? 'IA-' : 'U-') + uid()] = { t: topic, f: front.slice(0, 400), b: back.slice(0, 800), s: source, d: todayISO() };
  commit('cards'); return true;
}
export function deleteOwnCard(id: string) { delete docs.cards.own[id]; delete docs.cards.m[id]; commit('cards'); }

/* ---------- supuestos ---------- */
export const emptyCase = (): CaseState => ({ a: ['', '', '', '', ''], t: 0, st: 0, qt: [0, 0, 0, 0, 0] });
export const caseState = (id: string) => docs.cases.m[id] ?? emptyCase();
const editCase = (id: string) => (docs.cases.m[id] ??= emptyCase());
export function saveCaseAnswer(id: string, k: number, text: string) { const c = editCase(id); c.a = [...c.a]; c.a[k] = text.slice(0, 12000); c.st ||= 1; c.d = todayISO(); commit('cases'); }
export function saveCaseTime(id: string, total: number, perQuestion: number[]) { const c = editCase(id); c.t = total; c.qt = perQuestion; commit('cases'); }
export function toggleCaseDone(id: string) { const c = editCase(id); c.st = c.st === 2 ? 1 : 2; commit('cases'); logActivity(5); }
export function saveCaseScore(id: string, score: AiScore) { editCase(id).ai = score; commit('cases'); }
export function resetCase(id: string) { delete docs.cases.m[id]; commit('cases'); }
export const MAX_GENERATED = 15;
export function saveGeneratedCase(c: Omit<GeneratedCase, 'id' | 'd'>) { const id = 'G-' + uid(); docs.gen.m[id] = { ...c, id, d: new Date().toISOString() }; commit('gen'); return id; }
export function deleteGeneratedCase(id: string) { delete docs.gen.m[id]; delete docs.cases.m[id]; commit('gen', 'cases'); }

/* ---------- plan ---------- */
function applyPlan(fromWeek: number, reorder: boolean) {
  const s = docs.core.settings, frame = buildFrame(s, docs.core.plan.wtype, today());
  const next = redistribute(frame, docs.core.plan, s, topicStatus, fromWeek < 0 ? Math.max(0, frame.current) : fromWeek, reorder);
  docs.core.plan = { ...docs.core.plan, ...next, gen: Date.now() };
  commit('core');
}
export function ensurePlan() { const a = docs.core.plan.assign; if (!a || Object.keys(a).length < 57) applyPlan(0, true); }
export const reschedulePending = () => applyPlan(-1, false);
export const regeneratePlan = () => applyPlan(-1, true);
export function moveTopic(id: string, week: number) { docs.core.plan.assign[id] = week; docs.core.plan.pin[id] = 1; commit('core'); }
export function setWeekType(week: number, type: WeekType) { if (type === 'n') delete docs.core.plan.wtype[week]; else docs.core.plan.wtype[week] = type; applyPlan(-1, false); }
export function updateSettings(patch: Partial<Settings>, replan = false) {
  Object.assign(docs.core.settings, patch);
  if (replan) { docs.core.plan.wtype = {}; applyPlan(-1, true); } else commit('core');
}

/* ---------- datos ---------- */
export function saveOwnExam(key: string, answers: string) { docs.core.ownExams[key] = answers.slice(0, 120); commit('core'); }

export const exportData = () => JSON.stringify({ app: 'cuaderno-gsi', v: 3, exported: new Date().toISOString(), data: docs });
/** Valida una copia y devuelve un resumen para confirmar antes de importar. */
export function inspectBackup(json: string) {
  let o: any;
  try { o = JSON.parse(json); } catch { throw new Error('El archivo no es un JSON válido'); }
  if (o?.app !== 'cuaderno-gsi' || !o.data || typeof o.data !== 'object') throw new Error('Ese archivo no es una copia de Cuaderno GSI');
  if (!o.data.core || typeof o.data.core !== 'object') throw new Error('La copia está incompleta: falta el progreso principal');
  const d = o.data;
  return {
    json, date: o.exported ? new Date(o.exported).toLocaleDateString('es-ES') : 'fecha desconocida',
    tests: Array.isArray(d.core.hist) ? d.core.hist.length : 0,
    seen: d.srs?.m ? Object.keys(d.srs.m).length : 0,
    topics: d.core.topics ? Object.values(d.core.topics).filter((t: any) => t?.st >= 2).length : 0,
    cards: d.cards?.own ? Object.keys(d.cards.own).length : 0,
  };
}
export function importData(json: string) {
  const o = JSON.parse(inspectBackup(json).json);
  emitReset();
  const epoch = Date.now();
  for (const k of DOC_KEYS) { replaceDoc(k, o.data[k], true); docs[k].e = epoch; }
  commit(...DOC_KEYS);
  ensurePlan();
}
/** Borra todo: primero se detienen cronómetros y sesiones en memoria para que no escriban después. */
export function resetAll() {
  emitReset();
  const epoch = Date.now();
  for (const k of DOC_KEYS) { replaceDoc(k, null, true); docs[k].e = epoch; }
  commit(...DOC_KEYS);
  ensurePlan();
}
