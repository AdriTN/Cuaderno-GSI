import { topicById, topicCode } from '@/core/content';
import { PHASE_LABEL, progressVsPlan } from '@/core/domain/plan';
import { moveTopic, regeneratePlan, reschedulePending, setWeekType } from '@/core/store/actions';
import { planFrame, topicStatus, weekTopics } from '@/core/store/selectors';
import { useDocs } from '@/core/store/store';
import type { WeekType } from '@/core/types';
import { fmtLong, fmtShort } from '@/core/utils/date';
import { plural } from '@/core/utils/format';
import { Button, Callout, confirmDialog, Dropdown, Page, PageHeader, Panel, toast } from '@/ui';
import './plan.css';

const WEEK_TYPES: [WeekType, string, string][] = [['n', 'Normal', 'Carga completa de temas'], ['h', 'Media carga', 'La mitad de temas (fiestas, viajes…)'], ['v', 'Vacaciones', 'Sin temas: se reparten en otras semanas']];

export function PlanPage() {
  const docs = useDocs();
  const f = planFrame(), p = docs.core.plan, status = progressVsPlan(f, p, topicStatus);
  const movable = f.weeks.filter(w => (w.phase === 1 || w.phase === 2) && w.type !== 'v');
  const [f0, f1, f2, f3] = f.phaseWeeks;
  return (
    <Page>
      <PageHeader title="Plan" lede={<>{f.weeks.length} semanas del {fmtLong(f.start)} al examen ({fmtLong(f.exam)}): {f0} de diagnóstico, {f1} de primera vuelta, {f2} de segunda vuelta y {f3} de simulacros. Horas, días, orden y fases se cambian en <a href="#ajustes">Ajustes</a>.</>}
        actions={<><Button variant="primary" icon="calendar" onClick={() => { reschedulePending(); toast('Pendientes repartidos desde esta semana'); }}>Reprogramar pendientes</Button><Button onClick={async () => { if (await confirmDialog({ title: 'Regenerar el plan', message: 'Se recalcula el orden de todos los temas pendientes según tus ajustes. Los estudiados y los fijados a mano se mantienen.', confirm: 'Regenerar' })) { regeneratePlan(); toast('Plan regenerado'); } }}>Regenerar plan</Button></>} />
      <Callout tone={status.late.length ? 'warn' : 'ok'}>
        {status.late.length ? `${plural(status.late.length, 'tema atrasado', 'temas atrasados')}.` : 'Vas al día con el plan.'}{status.ahead ? ` ${plural(status.ahead, 'tema adelantado', 'temas adelantados')}.` : ''} Mueve cualquier tema con su desplegable (queda fijado con un alfiler) o marca semanas de media carga o vacaciones: el resto se reorganiza solo.
      </Callout>
      <Panel>
        {f.weeks.map(w => {
          const ts = weekTopics(w.i), editable = w.phase === 1 || w.phase === 2;
          return (
            <div class={`pl-week ${w.i === f.current ? 'is-current' : ''}`}>
              <div>
                <div class="pl-week__n">Semana {w.n}</div>
                <div class="pl-week__dates">{fmtShort(w.from)} – {fmtShort(w.to)}</div>
                <div class="pl-week__phase">{PHASE_LABEL[w.phase]}</div>
                {editable && <div class="pl-type"><Dropdown size="sm" label={`Tipo de la semana ${w.n}`} value={w.type} onChange={(v: WeekType) => { setWeekType(w.i, v); toast('Plan reorganizado'); }} options={WEEK_TYPES.map(([k, l, h]) => ({ value: k, label: l, hint: h }))} /></div>}
              </div>
              <div class="u-stack" style={{ gap: 'var(--space-2)' }}>
                {ts.length > 0 && <div class="pl-chips">{ts.map(id => (
                  <span class={`pl-chip ${topicStatus(id) >= 2 ? 'is-done' : ''}`}>
                    <a href={`#tema/${id}`} title={topicById[id].title}>{topicCode(id)}</a>{p.pin[id] && <span title="Fijado a mano" aria-label="Fijado">📌</span>}
                    <Dropdown size="sm" label={`Mover ${topicCode(id)} a otra semana`} value={w.i} renderValue={o => o ? `S${(o.value as number) + 1}` : ''}
                      onChange={(to: number) => { moveTopic(id, to); toast(`${topicCode(id)} movido a la semana ${to + 1}`); }}
                      options={movable.map(m => ({ value: m.i, label: `Semana ${m.n}`, hint: `${fmtShort(m.from)} – ${fmtShort(m.to)}${m.type === 'h' ? ', media carga' : ''}`, group: PHASE_LABEL[m.phase] }))} />
                  </span>))}</div>}
                <span class="u-muted u-small">
                  {w.phase === 0 && 'Examen oficial de diagnóstico y preparación del material.'}
                  {w.phase === 1 && !ts.length && (w.type === 'v' ? 'Vacaciones.' : 'Sin temas asignados.')}
                  {w.phase === 2 && (w.review.length ? `Repaso: ${w.review.map(topicCode).join(', ')}. Supuesto el sábado.` : 'Repaso de temas débiles y supuesto.')}
                  {w.phase === 3 && (w.i === f.weeks.length - 1 ? 'Repaso ligero. Descansa.' : 'Simulacro completo y repaso de errores.')}
                </span>
              </div>
            </div>
          );
        })}
      </Panel>
    </Page>
  );
}
