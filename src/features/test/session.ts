/**
 * Sesión de test en curso. La UI lee `session` y llama a estas funciones; se guarda y sincroniza en `docs.misc.cur`.
 */
import { signal } from '@preact/signals';
import { navigate, route } from '@/app/router';
import { questionById, topicById } from '@/core/content';
import { EXAM_SECONDS, SECONDS_PER_QUESTION, defaultSources, pickAdaptive, questionPool, type Filter, type Sources } from '@/core/domain/exam';
import type { QuestionResult } from '@/core/domain/srs';
import { netScore } from '@/core/domain/stats';
import { answerQuestion, logActivity, logStudyTime, recordTest, saveAnswers } from '@/core/store/actions';
import { isExcluded } from '@/core/store/selectors';
import { commit, docs, onReset } from '@/core/store/store';
import { onPulled } from '@/core/store/sync';
import type { HistEntry, Question, StoredSession } from '@/core/types';
import { today, todayISO } from '@/core/utils/date';
import { shuffle } from '@/core/utils/random';
import { confirmDialog, toast } from '@/ui';
import { isTimerRunning } from '../layout/studyTimer';

export type Mode = 'practice' | 'exam';
/** -2 sin tocar, -1 en blanco, 0-3 opción elegida */
export interface Session {
  qs: Question[]; ans: number[]; doubt: boolean[]; flag: boolean[]; time: number[]; revealed: boolean[];
  i: number; mode: Mode; label: string; kind: string; startedAt: number; qStartedAt: number; limit: number;
  done: boolean; result?: HistEntry;
}
/**
 * El test en curso se guarda en el documento sincronizado `misc` (sin las preguntas, solo sus identificadores):
 * sobrevive a recargas y puedes seguirlo en otro dispositivo. En los exámenes el reloj corre en tiempo real,
 * como en el examen de verdad: si lo retomas más tarde, cuenta el tiempo que ha pasado.
 */
const OLD_LS_KEY = 'cuaderno-gsi-session'; // versiones anteriores lo guardaban solo en este navegador

function fromStored(raw: StoredSession | null | undefined): Session | null {
  if (!raw?.qids?.length) return null;
  const qs = raw.qids.map((id: string) => questionById[id]).filter(Boolean);
  if (qs.length !== raw.qids.length) return null;
  const { qids, at, ...rest } = raw;
  return { ...rest, qs, qStartedAt: Date.now(), done: false };
}
function toStored(s: Session): StoredSession {
  return { qids: s.qs.map(q => q.i), ans: s.ans, doubt: s.doubt, flag: s.flag, time: s.time, revealed: s.revealed,
    i: s.i, mode: s.mode, label: s.label, kind: s.kind, startedAt: s.startedAt, limit: s.limit, at: Date.now() };
}
function restore(): Session | null {
  try {
    const old = localStorage.getItem(OLD_LS_KEY);
    if (old) { localStorage.removeItem(OLD_LS_KEY); if (!docs.misc.cur) { const { qids, ...r } = JSON.parse(old); docs.misc.cur = { qids, ...r, at: Date.now() }; commit('misc'); } }
  } catch { /* copia antigua ilegible: se ignora */ }
  return fromStored(docs.misc.cur);
}

export const session = signal<Session | null>(restore());

/** Firma de lo que importa guardar: evita escribir (y sincronizar) si nada ha cambiado. */
const fingerprint = (s: Session | null) => (s && !s.done ? JSON.stringify([s.qs.length, s.ans, s.doubt, s.flag, s.revealed, s.i, s.startedAt]) : '');
let saved = fingerprint(session.peek());
let applyingRemote = false;
// Borrar o importar: se descarta el test en memoria sin escribirlo (los documentos ya se sustituyen enteros).
onReset(() => { applyingRemote = true; session.value = null; saved = ''; applyingRemote = false; });
session.subscribe(s => {
  if (applyingRemote) return;
  const f = fingerprint(s);
  if (f === saved) return;
  saved = f;
  docs.misc.cur = s && !s.done ? toStored(s) : null;
  commit('misc');
});

/** Al traer datos de otro dispositivo: si allí se avanzó (o se terminó) el test, se continúa desde ahí. */
onPulled(() => {
  const remote = docs.misc.cur, local = session.peek();
  if (local?.done) return;                                   // estás viendo un resultado: no se toca
  const localFp = fingerprint(local), next = fromStored(remote);
  if (fingerprint(next) === localFp) return;
  applyingRemote = true;
  session.value = next;
  saved = fingerprint(next);
  applyingRemote = false;
  if (!next && local && route.peek().name === 'run') { toast('Terminaste este test en otro dispositivo'); navigate('entrenamiento'); }
});
export const activeSession = () => (session.value && !session.value.done ? session.value : null);
export const discard = () => { session.value = null; };
const resultOf = (q: Question, k: number, doubt: boolean): QuestionResult => (k < 0 ? 'blank' : k !== q.c ? 'wrong' : doubt ? 'doubt' : 'right');
const touch = () => { session.value = { ...session.value! }; };

export interface StartOptions { qids?: string[]; topics?: string[]; count?: number; mode: Mode; label: string; kind?: string; sources?: Sources; filter?: Filter; limit?: number }

/**
 * Empieza un test. Si hay otro a medias con respuestas, pregunta antes de sustituirlo: nunca se pierde sin avisar.
 * Devuelve false si no se empezó (cancelado o sin preguntas).
 */
export async function startTest(o: StartOptions): Promise<boolean> {
  const cur = activeSession();
  if (cur) {
    const answered = cur.ans.filter(a => a !== -2).length;
    if (answered > 0) {
      const ok = await confirmDialog({
        title: 'Tienes un test sin terminar',
        message: `«${cur.label}»: ${answered} de ${cur.qs.length} respondidas.\n\nSi empiezas otro, ese se descarta (las respuestas ya corregidas se conservan en tu progreso). Si prefieres terminarlo, cancela y pulsa «Continuar».`,
        confirm: 'Descartarlo y empezar', danger: true,
      });
      if (!ok) return false;
    }
  }
  let qs: Question[];
  if (o.qids) qs = o.qids.map(id => questionById[id]).filter(Boolean);
  else {
    const sources = o.sources ?? defaultSources(docs.core.settings.ai);
    const base = { topics: o.topics ?? [], sources, srs: docs.srs.m, excluded: isExcluded };
    let pool = questionPool({ ...base, filter: o.filter ?? 'all' });
    if (!pool.length && o.filter && o.filter !== 'all') pool = questionPool({ ...base, filter: 'all' });
    qs = o.filter === 'weak' ? pickAdaptive(pool, o.count ?? 25, docs.srs.m, today()) : shuffle(pool).slice(0, o.count ?? 25);
  }
  if (!qs.length) { toast('No hay preguntas con esos filtros'); return false; }
  const n = qs.length, now = Date.now();
  session.value = {
    qs, ans: Array(n).fill(-2), doubt: Array(n).fill(false), flag: Array(n).fill(false), time: Array(n).fill(0), revealed: Array(n).fill(false),
    i: 0, mode: o.mode, label: o.label, kind: o.kind ?? 'test', startedAt: now, qStartedAt: now,
    limit: o.limit ?? (o.mode === 'exam' ? Math.min(EXAM_SECONDS, n * SECONDS_PER_QUESTION) : 0), done: false,
  };
  navigate('run');
  return true;
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
