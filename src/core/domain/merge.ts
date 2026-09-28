/**
 * Fusión de dos versiones de un mismo documento cuando se han modificado en dos dispositivos a la vez
 * (entre una sincronización y la siguiente). Sin fusión ganaría el documento entero más reciente y se
 * perderían los cambios del otro: p. ej. las preguntas respondidas en el móvil mientras el PC seguía abierto.
 *
 * Reglas: se une todo lo que es acumulativo (respuestas, historial, tiempo, notas, tarjetas…) y, cuando un mismo
 * elemento cambió en los dos lados, se queda el más avanzado (más intentos, más tiempo, estado más alto) o,
 * si no hay forma de compararlo, el del documento modificado más tarde. Lo que se borró en un lado mientras
 * el otro lo tenía puede reaparecer: es preferible a perder progreso.
 * Lógica pura: sin DOM ni estado global.
 */
import type { DocKey, SrsEntry } from '../types';

type Obj = Record<string, any>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/** Une dos diccionarios; `pick(a, b)` decide cuando la misma clave existe en los dos (a = el más reciente). */
function unionBy<T>(newer: Record<string, T> = {}, older: Record<string, T> = {}, pick: (a: T, b: T) => T = a => a): Record<string, T> {
  const out: Record<string, T> = { ...older };
  for (const [k, v] of Object.entries(newer)) out[k] = k in older ? pick(v, older[k]) : v;
  return out;
}
/** Repaso espaciado: gana la entrada con más intentos y, a igualdad, la practicada más tarde. */
const pickSrs = (a: SrsEntry, b: SrsEntry): SrsEntry => {
  if (!Array.isArray(a)) return b; if (!Array.isArray(b)) return a;
  const na = (a[2] ?? 0) + (a[3] ?? 0), nb = (b[2] ?? 0) + (b[3] ?? 0);
  return na !== nb ? (na > nb ? a : b) : (a[4] ?? 0) >= (b[4] ?? 0) ? a : b;
};
const maxNum = (a: number, b: number) => Math.max(+a || 0, +b || 0);
/** Tiempo de estudio: por día y contexto, el mayor (cada dispositivo suma su propio tiempo sobre la misma base). */
const pickDay = (a: Obj, b: Obj) => unionBy(a, b, maxNum);

function mergeCore(n: Obj, o: Obj): Obj {
  const hist = [...(o.hist ?? []), ...(n.hist ?? [])];
  const seen = new Set<string>();
  const uniq = hist.filter(h => { const k = `${h.d}|${h.lbl}|${h.n}|${h.ok}|${h.ko}|${h.dur}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => String(a.d).localeCompare(String(b.d)));
  return {
    ...o, ...n,                                  // ajustes y plan: los del documento más reciente
    hist: uniq.slice(-300),
    act: unionBy(n.act, o.act, maxNum),
    time: unionBy(n.time, o.time, pickDay),
    topics: unionBy(n.topics, o.topics, (a: Obj, b: Obj) => ((a?.st ?? 0) >= (b?.st ?? 0) ? a : b)),
    qflags: unionBy(n.qflags, o.qflags),
    ownExams: unionBy(n.ownExams, o.ownExams),
  };
}

function mergeNotes(n: Obj, o: Obj): Obj {
  const hl: Obj = { ...(o.hl ?? {}) };
  for (const [t, arr] of Object.entries<any[]>(n.hl ?? {})) {
    const all = [...(hl[t] ?? []), ...arr], seen = new Set<string>();
    hl[t] = all.filter(h => { const k = `${h.t}|${h.o}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  return { ...o, ...n, m: unionBy(n.m, o.m), hl };
}

/** Supuestos: gana el más avanzado (terminado > en curso) y, a igualdad, el que tiene más escrito. */
const pickCase = (a: Obj, b: Obj) => {
  if ((a?.st ?? 0) !== (b?.st ?? 0)) return (a?.st ?? 0) > (b?.st ?? 0) ? a : b;
  const len = (x: Obj) => (x?.a ?? []).join('').length;
  return len(a) >= len(b) ? a : b;
};

/**
 * Devuelve la fusión de `local` y `remote` (documentos completos del mismo tipo y la misma época).
 * La marca de modificación resultante es la mayor de las dos más uno, para que se suba y gane a ambas.
 */
export function mergeDoc(key: DocKey, local: Obj, remote: Obj): Obj {
  if (!isObj(remote)) return local;
  if (!isObj(local)) return remote;
  const localNewer = (local.u ?? 0) >= (remote.u ?? 0);
  const n = localNewer ? local : remote, o = localNewer ? remote : local;
  let out: Obj;
  switch (key) {
    case 'core': out = mergeCore(n, o); break;
    case 'srs': out = { ...o, ...n, m: unionBy(n.m, o.m, pickSrs) }; break;
    case 'cards': out = { ...o, ...n, m: unionBy(n.m, o.m, pickSrs), own: unionBy(n.own, o.own) }; break;
    case 'notes': out = mergeNotes(n, o); break;
    case 'cases': out = { ...o, ...n, m: unionBy(n.m, o.m, pickCase) }; break;
    case 'gen': out = { ...o, ...n, m: unionBy(n.m, o.m) }; break;
    // Test a medias: el que se tocó por última vez (terminarlo en un dispositivo lo quita del otro).
    case 'misc': out = { ...o, ...n,
      cur: (n.cur?.at ?? n.u ?? 0) >= (o.cur?.at ?? 0) ? n.cur : o.cur,
      cards: (n.cards?.at ?? n.u ?? 0) >= (o.cards?.at ?? 0) ? n.cards : o.cards,
      news: n.news || o.news }; break;
    default: out = { ...n };
  }
  out.u = Math.max(local.u ?? 0, remote.u ?? 0) + 1;
  return out;
}
