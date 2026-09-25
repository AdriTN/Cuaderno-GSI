/**
 * Sesión de test en curso (estado efímero, no persistido). La UI lee `session` y llama a estas funciones.
 */
import { signal } from '@preact/signals';
import { navigate } from '@/app/router';
import { questionById, topicById } from '@/core/content';
import { EXAM_SECONDS, SECONDS_PER_QUESTION, pickAdaptive, questionPool, type Filter, type Sources } from '@/core/domain/exam';
import type { QuestionResult } from '@/core/domain/srs';
import { netScore } from '@/core/domain/stats';
import { answerQuestion, logActivity, logStudyTime, recordTest, saveAnswers } from '@/core/store/actions';
import { isExcluded } from '@/core/store/selectors';
import { docs, onReset } from '@/core/store/store';
import type { HistEntry, Question } from '@/core/types';
import { today, todayISO } from '@/core/utils/date';
import { shuffle } from '@/core/utils/random';
import { toast } from '@/ui';
import { isTimerRunning } from '../layout/studyTimer';

export type Mode = 'practice' | 'exam';
/** -2 sin tocar, -1 en blanco, 0-3 opción elegida */
export interface Session {
  qs: Question[]; ans: number[]; doubt: boolean[]; flag: boolean[]; time: number[]; revealed: boolean[];
  i: number; mode: Mode; label: string; kind: string; startedAt: number; qStartedAt: number; limit: number;
  done: boolean; result?: HistEntry;
}
/** El test en curso se guarda en el navegador para no perderlo al recargar (clave aparte de los datos sincronizados). */
const LS_KEY = 'cuaderno-gsi-session';
export const session = signal<Session | null>(restore());
onReset(() => { session.value = null; });

function restore(): Session | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (!raw?.qids?.length) return null;
    const qs = raw.qids.map((id: string) => questionById[id]).filter(Boolean);
    if (qs.length !== raw.qids.length) return null;
    return { ...raw, qs, qStartedAt: Date.now(), done: false };
  } catch { return null; }
}
session.subscribe(s => {
  try {
    if (!s || s.done) localStorage.removeItem(LS_KEY);
    else { const { qs, ...rest } = s; localStorage.setItem(LS_KEY, JSON.stringify({ ...rest, qids: qs.map(q => q.i) })); }
  } catch { /* sin espacio: no pasa nada, el test sigue en memoria */ }
});
export const activeSession = () => (session.value && !session.value.done ? session.value : null);
export const discard = () => { session.value = null; };
const resultOf = (q: Question, k: number, doubt: boolean): QuestionResult => (k < 0 ? 'blank' : k !== q.c ? 'wrong' : doubt ? 'doubt' : 'right');
const touch = () => { session.value = { ...session.value! }; };

export interface StartOptions { qids?: string[]; topics?: string[]; count?: number; mode: Mode; label: string; kind?: string; sources?: Sources; filter?: Filter; limit?: number }

export function startTest(o: StartOptions) {
  let qs: Question[];
  if (o.qids) qs = o.qids.map(id => questionById[id]).filter(Boolean);
  else {
    const sources = o.sources ?? { O: true, M: true, I: docs.core.settings.ai };
    const base = { topics: o.topics ?? [], sources, srs: docs.srs.m, excluded: isExcluded };
    let pool = questionPool({ ...base, filter: o.filter ?? 'all' });
    if (!pool.length && o.filter && o.filter !== 'all') pool = questionPool({ ...base, filter: 'all' });
    qs = o.filter === 'weak' ? pickAdaptive(pool, o.count ?? 25, docs.srs.m, today()) : shuffle(pool).slice(0, o.count ?? 25);
  }
  if (!qs.length) { toast('No hay preguntas con esos filtros'); return; }
  const n = qs.length, now = Date.now();
  session.value = {
    qs, ans: Array(n).fill(-2), doubt: Array(n).fill(false), flag: Array(n).fill(false), time: Array(n).fill(0), revealed: Array(n).fill(false),
    i: 0, mode: o.mode, label: o.label, kind: o.kind ?? 'test', startedAt: now, qStartedAt: now,
    limit: o.limit ?? (o.mode === 'exam' ? Math.min(EXAM_SECONDS, n * SECONDS_PER_QUESTION) : 0), done: false,
  };
  navigate('run');
}

function accrueTime(s: Session) { const now = Date.now(); s.time[s.i] += (now - s.qStartedAt) / 1000; s.qStartedAt = now; }

export function choose(k: number) {
  const s = session.value; if (!s || s.done) return;
  if (s.mode === 'practice') {
    if (s.revealed[s.i]) return;
    accrueTime(s); s.ans[s.i] = k; s.revealed[s.i] = true;
    const q = s.qs[s.i];
    answerQuestion(q.i, resultOf(q, k, s.doubt[s.i])); saveAnswers(); logActivity(1);
  } else s.ans[s.i] = s.ans[s.i] === k ? -2 : k;
  touch();
}
export function toggleDoubt() { const s = session.value; if (!s || s.revealed[s.i]) return; s.doubt[s.i] = !s.doubt[s.i]; touch(); }
export function toggleFlag() { const s = session.value; if (!s) return; s.flag[s.i] = !s.flag[s.i]; touch(); }
export function goTo(i: number) { const s = session.value; if (!s || i < 0 || i >= s.qs.length) return; accrueTime(s); s.i = i; touch(); window.scrollTo(0, 0); }
export function next() { const s = session.value; if (!s) return; if (s.i < s.qs.length - 1) goTo(s.i + 1); else finish(); }

export function finish(partial = false) {
  const s = session.value; if (!s || s.done) return;
  accrueTime(s);
  const upto = partial && s.mode === 'practice' ? s.revealed.lastIndexOf(true) + 1 : s.qs.length;
  const qs = s.qs.slice(0, upto), ans = s.ans.slice(0, upto).map(a => (a === -2 ? -1 : a));
  let ok = 0, ko = 0, bl = 0; const byBlock: HistEntry['b'] = {}; const cs: [number, number] = [0, 0], cd: [number, number] = [0, 0];
  qs.forEach((q, k) => {
    const b = (byBlock[topicById[q.t].b] ??= [0, 0, 0]);
    if (ans[k] === -1) { bl++; b[2]++; return; }
    const good = ans[k] === q.c; good ? (ok++, b[0]++) : (ko++, b[1]++);
    (s.doubt[k] ? cd : cs)[good ? 0 : 1]++;
  });
  if (s.mode === 'exam') {
    let n = 0;
    // Las que dejaste en blanco y nunca habías visto no entran en el repaso para no inundarlo.
    qs.forEach((q, k) => { if (ans[k] === -1 && !docs.srs.m[q.i]) return; n++; answerQuestion(q.i, resultOf(q, ans[k], s.doubt[k])); });
    saveAnswers(); logActivity(n);
  }
  const dur = Math.round((Date.now() - s.startedAt) / 1000);
  const result: HistEntry = { d: todayISO(), k: s.kind, lbl: s.label, n: qs.length, ok, ko, bl, net: Math.round(netScore(ok, ko) * 100) / 100, dur, b: byBlock, cs, cd,
    tq: qs.length ? Math.round(s.time.slice(0, upto).reduce((a, b) => a + b, 0) / qs.length) : 0 };
  recordTest(result);
  if (!isTimerRunning()) logStudyTime('test', dur);
  session.value = { ...s, qs, ans, doubt: s.doubt.slice(0, upto), flag: s.flag.slice(0, upto), time: s.time.slice(0, upto), done: true, result };
  navigate('resultado');
}
/** Salir sin responder: vuelve a la sección desde la que se empezó. */
export const abandon = () => { const k = session.value?.kind; session.value = null; navigate(k === 'repaso' ? 'refuerzo' : k === 'sim' || k === 'exam' ? 'examen' : 'entrenamiento'); };
