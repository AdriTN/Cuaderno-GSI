import { questionById } from '../content';
import { dueCards, newCards } from '../domain/cards';
import { buildFrame, topicsOfWeek } from '../domain/plan';
import { topicStats } from '../domain/stats';
import type { TopicStatus } from '../types';
import { addDays, mondayOf, toISO, today, todayISO } from '../utils/date';
import { docs } from './store';

export const topicStatus = (id: string): TopicStatus => docs.core.topics[id]?.st ?? 0;
export const isFlagged = (id: string) => !!docs.core.qflags[id];
export const isExcluded = (id: string) => docs.core.settings.exclFlag && isFlagged(id);
export const statsOf = (topicId: string) => topicStats(docs.srs.m, topicId);

export const dueQuestions = () => {
  const d = today();
  return Object.entries(docs.srs.m).filter(([id, e]) => e[1] <= d && questionById[id] && !isExcluded(id)).sort((a, b) => a[1][1] - b[1][1]).map(([id]) => id);
};
export const failedQuestions = (limit = 60) =>
  Object.entries(docs.srs.m).filter(([id, e]) => e[3] > 0 && questionById[id]).sort((a, b) => b[1][4] - a[1][4]).slice(0, limit);

export const dueCardIds = () => dueCards(docs.cards.m, docs.cards.own, today());
export const newCardIds = (topics?: string[]) => newCards(docs.cards.m, docs.cards.own, topicStatus, topics);

export const planFrame = () => buildFrame(docs.core.settings, docs.core.plan.wtype, today());
export const weekTopics = (week: number) => topicsOfWeek(docs.core.plan, docs.core.settings, week);

const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
export const secondsOnDay = (iso: string) => sum(docs.core.time[iso]);
export const secondsToday = () => secondsOnDay(todayISO());
export const secondsThisWeek = () => { const m = mondayOf(new Date()); let s = 0; for (let i = 0; i < 7; i++) s += secondsOnDay(toISO(addDays(m, i))); return s; };
export const secondsOnTopic = (id: string) => Object.values(docs.core.time).reduce((a, d) => a + (d[id] ?? 0), 0);

export function streakDays(): number {
  let n = 0;
  for (let i = 0; i < 400; i++) { if (docs.core.act[toISO(addDays(new Date(), -i))]) n++; else if (i > 0) break; }
  return n;
}
