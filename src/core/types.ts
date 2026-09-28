/** Modelo de contenido (generado por scripts/prepare_content.py) y de estado del usuario. */

export type BlockId = 'B1' | 'B2' | 'B3' | 'B4';
/** O: oficial INAP · P: examen anterior de GSI recopilado por PreparaTIC · M: curada del material · I: generada con IA. */
export type Origin = 'O' | 'P' | 'M' | 'I';

export interface Block { id: BlockId; n: number; title: string }
export interface Topic { id: string; b: BlockId; n: number; title: string; sup: string }
export interface Question {
  i: string; t: string; o: Origin; s: string; a: string[]; c: number; f: string;
  /** Procedencia legible (documento y localización) de las preguntas no oficiales. */
  p?: string;
  /** Preguntas de examen (oficiales y de PreparaTIC): año, orden en el cuadernillo y si es de reserva. */
  e?: string; n?: number; r?: 0 | 1;
  /** Solo PreparaTIC: examen anterior del que procede (id de `pastExams`). */
  x?: string;
}
/** Examen anterior de GSI (PreparaTIC) completo, en su orden; puede incluir preguntas que viven en otro examen. */
export interface PastExam { id: string; label: string; year: string; turno: 'LI' | 'PI'; q: string[] }
export interface OfficialCase { id: string; sim: number; opt: string; title: string; st: string; q: string[]; check: string[]; sol: string }
export interface Pack { id: string; name: string; cuaderno?: string; solucionario?: string }
export interface AutoCard { i: string; t: string; c: string; f: string; b: string; z?: 1 }
export interface ContentUpdate { topics: string[]; title: string; summary: string; date: string }
export interface InapCase { id: string; year: string; n: number; title: string; st: string; q: string[]; criteria: string }
/** exam: exámenes y corrección · results: aprobados, notas de corte y nombramientos · interim: listas de interinos. */
export type LibraryKind = 'exam' | 'results' | 'interim';
export interface LibraryDoc { label: string; url: string; kind?: LibraryKind }
export interface LibraryEntry { year: number; status: string; page: string; docs: LibraryDoc[] }
export interface NewsItem { id: string; date: string; source: string; title: string; url: string }
export interface Live { checked: string | null; news: NewsItem[]; library: { year: number | null; name: string; page: string; docs: { label: string; url: string }[] }[] }

export interface Content {
  blocks: Block[]; topics: Topic[]; content: Record<string, string>; questions: Question[];
  cases: OfficialCase[]; officialCases: InapCase[]; library: LibraryEntry[]; key2025: { main: string; reserve: string; status: string };
  cards: AutoCard[]; packs: Pack[]; updates: ContentUpdate[];
  source: { program: string; repo_date: string };
  /** Añadidos por build.mjs desde data/preparatic.json. */
  pastExams: PastExam[]; preparatic?: { url: string; version: string | null; imported: string };
}

/* ---------- estado persistido (el formato es compatible con versiones anteriores) ---------- */

/** [nivel 0-6, díaVencimiento, aciertos, fallos, díaÚltimaVez] */
export type SrsEntry = [number, number, number, number, number];
export type TopicStatus = 0 | 1 | 2 | 3;
export type WeekType = 'n' | 'h' | 'v';
export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  start: string; exam: string; ai: boolean; theme: Theme; hours: number;
  /** Días de estudio, 0 = lunes … 6 = domingo. */
  days: number[]; order: BlockId[]; b1inter: boolean; f0: number; f2: number; f3: number; exclFlag: boolean;
}
export interface HistEntry {
  d: string; k: string; lbl: string; n: number; ok: number; ko: number; bl: number; net: number; dur: number;
  b: Record<string, [number, number, number]>; cs?: [number, number]; cd?: [number, number]; tq?: number;
}
export interface CoreDoc {
  u: number; e?: number; settings: Settings;
  plan: { assign: Record<string, number>; pin: Record<string, 1>; wtype: Record<number, WeekType>; gen?: number };
  topics: Record<string, { st: TopicStatus; d?: string }>;
  hist: HistEntry[]; act: Record<string, number>; time: Record<string, Record<string, number>>;
  qflags: Record<string, { n: string; d: string }>;
  /** Respuestas del opositor a un examen real (p. ej. el de 2025), para corregirlas con la plantilla. */
  ownExams: Record<string, string>;
}
export interface Highlight { t: string; o: number }
export interface AiScore { technical: number; analysis: number; systematic: number; expression: number; total: number; summary?: string; questions?: { strengths: string; improvements: string }[] }
export interface CaseState { a: string[]; t: number; st: 0 | 1 | 2; qt: number[]; ai?: AiScore; d?: string }
export interface OwnCard { t: string; f: string; b: string; s: 'u' | 'ia'; d: string }
export interface GeneratedCase { id: string; title: string; st: string; q: string[]; check: string[]; guide: string; focus: string; d: string }

/**
 * Todos los documentos llevan `u` (última modificación) y `e` (época): la época cambia al borrar o importar,
 * y una época más reciente gana siempre, para que un dispositivo con datos viejos no deshaga un borrado.
 */
export interface Docs {
  core: CoreDoc;
  srs: { u: number; e?: number; m: Record<string, SrsEntry> };
  notes: { u: number; e?: number; m: Record<string, string>; hl: Record<string, Highlight[]> };
  cases: { u: number; e?: number; m: Record<string, CaseState> };
  cards: { u: number; e?: number; m: Record<string, SrsEntry>; own: Record<string, OwnCard> };
  gen: { u: number; e?: number; m: Record<string, GeneratedCase> };
  /** Estado en curso que también viaja entre dispositivos: el test o examen a medias y la última novedad vista. */
  misc: { u: number; e?: number; cur: StoredSession | null; cards: CardRun | null; news: string };
}
export type DocKey = keyof Docs;
/** Repaso de tarjetas a medias: la cola, por dónde vas y el recuento; `at` es su último cambio. */
export interface CardRun { label: string; queue: string[]; i: number; shown: boolean; tally: [number, number, number]; at?: number }
/** Test o examen sin terminar, guardado por identificadores de pregunta; `at` es su último cambio. */
export interface StoredSession {
  qids: string[]; ans: number[]; doubt: boolean[]; flag: boolean[]; time: number[]; revealed: boolean[];
  i: number; mode: 'practice' | 'exam'; label: string; kind: string; startedAt: number; limit: number; at: number;
}
