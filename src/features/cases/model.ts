/** Vista unificada de supuestos oficiales y generados con IA. */
import { caseById, inapCaseById } from '@/core/content';
import { docs } from '@/core/store/store';
import { htmlToText } from '@/core/utils/text';

export type CaseKind = 'material' | 'inap' | 'ai';
export interface CaseView { id: string; title: string; statement: string; questions: string[]; checklist: string[]; group: string; kind: CaseKind; generated: boolean; guideHtml?: string; guideText: string }

export function getCase(id: string): CaseView | null {
  const o = caseById[id];
  if (o) return { id, title: o.title, statement: o.st, questions: o.q, checklist: o.check, group: `Simulacro ${o.sim}`, kind: 'material', generated: false, guideHtml: o.sol, guideText: htmlToText(o.sol) };
  const i = inapCaseById[id];
  if (i) return { id, title: i.title, statement: i.st, questions: i.q, checklist: [], group: `Examen oficial ${i.year}`, kind: 'inap', generated: false, guideText: i.criteria };
  const g = docs.gen.m[id];
  if (g) return { id, title: g.title, statement: g.st, questions: g.q, checklist: g.check, group: 'Generado con IA', kind: 'ai', generated: true, guideText: g.guide };
  return null;
}
export const ANSWER_TEMPLATE = 'Análisis del caso y supuestos asumidos:\n\n\nPropuesta:\n\n\nJustificación (ventajas e inconvenientes):\n\n\nNormativa aplicable:\n\n\nRiesgos, implantación y siguientes pasos:\n\n';
export const CASE_SECONDS = 10800;
export const SECONDS_PER_CASE_QUESTION = 35 * 60;
