import { CONTENT, autoCardById } from '../content';
import type { OwnCard, SrsEntry, TopicStatus } from '../types';

export interface StudyCard { i: string; t: string; c?: string; f: string; b: string; own?: 'u' | 'ia' }

export const allCards = (own: Record<string, OwnCard>): StudyCard[] => [
  ...CONTENT.cards,
  ...Object.entries(own).map(([i, c]) => ({ i, t: c.t, f: c.f, b: c.b, own: c.s })),
];
export function cardById(id: string, own: Record<string, OwnCard>): StudyCard | null {
  const a = autoCardById[id]; if (a) return a;
  const o = own[id]; return o ? { i: id, t: o.t, f: o.f, b: o.b, own: o.s } : null;
}
export const dueCards = (m: Record<string, SrsEntry>, own: Record<string, OwnCard>, day: number) =>
  Object.entries(m).filter(([id, e]) => e[1] <= day && cardById(id, own)).map(([id]) => id);
/** Tarjetas nuevas: de los temas indicados o, si no, de los que ya se han leído. */
export const newCards = (m: Record<string, SrsEntry>, own: Record<string, OwnCard>, status: (id: string) => TopicStatus, topics?: string[]) => {
  const set = topics ? new Set(topics) : null;
  return allCards(own).filter(c => !m[c.i] && (set ? set.has(c.t) : status(c.t) >= 1)).map(c => c.i);
};
