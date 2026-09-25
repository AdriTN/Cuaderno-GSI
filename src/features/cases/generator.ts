import { TOPICS, topicById, topicCode } from '@/core/content';
import { askJSON } from '@/core/services/ai';
import { generateCasePrompt } from '@/core/services/prompts';
import { saveGeneratedCase } from '@/core/store/actions';
import type { BlockId } from '@/core/types';
import { shuffle } from '@/core/utils/random';

export type Focus = 'dev' | 'sys' | 'mix';
export const FOCUS_LABEL: Record<Focus, string> = { dev: 'Desarrollo de sistemas', sys: 'Sistemas y comunicaciones', mix: 'Mixto' };
const FOCUS_BLOCKS: Record<Focus, BlockId[]> = { dev: ['B3', 'B2'], sys: ['B4', 'B2'], mix: ['B3', 'B4', 'B2'] };

/** Genera un supuesto nuevo apoyado en el "enfoque para supuesto" de temas del programa. Devuelve su id. */
export async function generateCase(focus: Focus, topic: string, hard: boolean): Promise<string> {
  const pool = TOPICS.filter(t => FOCUS_BLOCKS[focus].includes(t.b));
  let picked = shuffle(pool).slice(0, 7);
  if (topic && topicById[topic]) picked = [topicById[topic], ...picked.filter(t => t.id !== topic).slice(0, 5)];
  const legal = shuffle(TOPICS.filter(t => t.b === 'B1' && t.n >= 6)).slice(0, 2);
  const context = [...picked, ...legal].map(t => `- ${topicCode(t.id)} ${t.title}\n  Enfoque para supuesto: ${t.sup || '(sin notas)'}`).join('\n');
  const r = await askJSON<any>(generateCasePrompt(FOCUS_LABEL[focus].toLowerCase(), hard, context));
  if (!r?.statement || !Array.isArray(r.questions) || r.questions.length < 3) throw new SyntaxError('Formato inesperado');
  const q = r.questions.slice(0, 5).map((x: unknown) => String(x).slice(0, 900));
  while (q.length < 5) q.push('');
  return saveGeneratedCase({ title: String(r.title || 'Supuesto generado').slice(0, 140), st: String(r.statement).slice(0, 8000), q, check: (r.checklist ?? []).slice(0, 8).map((x: unknown) => String(x).slice(0, 300)), guide: String(r.guide ?? '').slice(0, 12000), focus });
}
