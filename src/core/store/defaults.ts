import type { Docs, DocKey } from '../types';

export const DEFAULT_DOCS: Docs = {
  core: {
    u: 0,
    settings: { start: '2026-09-28', exam: '2027-05-22', ai: true, theme: 'auto', hours: 15, days: [0, 1, 2, 3, 5, 6], order: ['B1', 'B2', 'B4', 'B3'], b1inter: true, f0: 2, f2: 9, f3: 7, exclFlag: true },
    plan: { assign: {}, pin: {}, wtype: {} }, topics: {}, hist: [], act: {}, time: {}, qflags: {}, ownExams: {},
  },
  srs: { u: 0, m: {} },
  notes: { u: 0, m: {}, hl: {} },
  cases: { u: 0, m: {} },
  cards: { u: 0, m: {}, own: {} },
  gen: { u: 0, m: {} },
};
export const DOC_KEYS = Object.keys(DEFAULT_DOCS) as DocKey[];

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Completa un documento guardado con los campos por defecto que falten (migraciones suaves). */
export function normalize<K extends DocKey>(key: K, raw: unknown): Docs[K] {
  const base = clone(DEFAULT_DOCS[key]) as any;
  if (!raw || typeof raw !== 'object') return base;
  const out = Object.assign(base, raw);
  for (const [f, v] of Object.entries(DEFAULT_DOCS[key])) if (v && typeof v === 'object' && !Array.isArray(v) && out[f] == null) out[f] = clone(v);
  if (key === 'core') {
    out.settings = { ...DEFAULT_DOCS.core.settings, ...(out.settings ?? {}) };
    out.plan = { assign: {}, pin: {}, wtype: {}, ...(out.plan ?? {}) };
    out.hist ??= [];
  }
  return out;
}
