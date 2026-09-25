import type { AutoCard, Block, Content, InapCase, Live, OfficialCase, Pack, Question, Topic } from './types';

/** El contenido va incrustado en index.html por build.mjs para que la app sea un único archivo. */
function readEmbedded(): Content {
  const el = document.getElementById('gsi-content');
  if (!el?.textContent) throw new Error('No se encontró el contenido incrustado.');
  return JSON.parse(el.textContent) as Content;
}

export const CONTENT = readEmbedded();

const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map(x => [x.id, x])) as Record<string, T>;

export const BLOCKS: Block[] = CONTENT.blocks;
export const TOPICS: Topic[] = CONTENT.topics;
export const QUESTIONS: Question[] = CONTENT.questions;
export const topicById = byId(TOPICS);
export const blockById = byId(BLOCKS);
export const caseById: Record<string, OfficialCase> = byId(CONTENT.cases);
export const inapCaseById: Record<string, InapCase> = byId(CONTENT.officialCases);
export const packById: Record<string, Pack> = byId(CONTENT.packs);
export const questionById: Record<string, Question> = Object.fromEntries(QUESTIONS.map(q => [q.i, q]));
export const autoCardById: Record<string, AutoCard> = Object.fromEntries(CONTENT.cards.map(c => [c.i, c]));
export const questionsByTopic: Record<string, Question[]> = {};
for (const q of QUESTIONS) (questionsByTopic[q.t] ??= []).push(q);

export const ORIGIN_LABEL = { O: 'Oficial INAP', M: 'Curada', I: 'Generada con IA' } as const;
export const LETTERS = ['A', 'B', 'C', 'D'];

/** Código legible corto de un tema: "B1-T05". */
export const topicCode = (id: string) => { const t = topicById[id]; return t ? `B${t.b.slice(1)}-T${String(t.n).padStart(2, '0')}` : id; };
export const topicsOfBlock = (b: string) => TOPICS.filter(t => t.b === b);

/** Temas como opciones de desplegable, agrupados por bloque. */
export const topicOptions = (filter: (t: Topic) => boolean = () => true) =>
  TOPICS.filter(filter).map(t => ({ value: t.id, label: `${topicCode(t.id)}. ${t.title}`, group: `Bloque ${t.b.slice(1)}. ${blockById[t.b].title}` }));

/** Novedades vigiladas automáticamente (BOE e INAP) en el momento de compilar la app. */
export const LIVE: Live = (() => {
  try { const l = JSON.parse(document.getElementById('gsi-live')?.textContent || '{}'); return { checked: l.checked ?? null, news: l.news ?? [], library: l.library ?? [] }; }
  catch { return { checked: null, news: [], library: [] }; }
})();
/** Biblioteca oficial: la del contenido más los documentos nuevos que haya encontrado el vigilante. */
export const LIBRARY = CONTENT.library.map(l => {
  const extra = LIVE.library.find(x => x.year === l.year)?.docs ?? [];
  const known = new Set(l.docs.map(d => d.url));
  return { ...l, docs: [...l.docs, ...extra.filter(d => !known.has(d.url)).map(d => ({ ...d, isNew: true }))] };
});
