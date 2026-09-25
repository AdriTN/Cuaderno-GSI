import { PendingSession } from '../test/PendingSession';
import { NewsCallout } from '../mocks/NewsPanel';
import { PHASE_LABEL, PHASE_TIP, progressVsPlan, todaysTopics } from '@/core/domain/plan';
import { topicById, topicCode } from '@/core/content';
import { reschedulePending, setTopicStatus } from '@/core/store/actions';
import { dueCardIds, dueQuestions, planFrame, secondsOnDay, secondsThisWeek, streakDays, topicStatus, weekTopics } from '@/core/store/selectors';
import { useDocs } from '@/core/store/store';
import { WEEKDAYS_SHORT, addDays, dayNum, fmtLong, fmtShort, fmtToday, mondayOf, toISO, today } from '@/core/utils/date';
import { hours, num, plural } from '@/core/utils/format';
import { TOPICS } from '@/core/content';
import { Button, Callout, Figures, Icon, Meter, Page, Panel, Ring, type IconName } from '@/ui';
import { pendingSeconds, tick } from '../layout/studyTimer';
import { startTest } from '../test/session';
import './today.css';

function AgendaTopic({ id }: { id: string }) {
  const done = topicStatus(id) >= 2;
  return (
    <li class={done ? 'p-agenda__done' : ''}>
      <button class="p-agenda__check" aria-pressed={done} aria-label={done ? 'Marcar como pendiente' : 'Marcar como estudiado'} onClick={() => setTopicStatus(id, done ? 1 : 2)}><Icon name="check" size={16} /></button>
      <div class="p-agenda__body"><a class="p-agenda__title" href={`#tema/${id}`}>{topicById[id].title}</a><div class="p-agenda__meta">{topicCode(id)}</div></div>
    </li>
  );
}
const AgendaLink = ({ icon, title, meta, href, onClick }: { icon: IconName; title: string; meta?: string; href?: string; onClick?: () => void }) => (
  <li><span class="p-agenda__icon"><Icon name={icon} /></span><div class="p-agenda__body">{href ? <a class="p-agenda__title" href={href}>{title}</a> : <button class="p-agenda__title" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={onClick}>{title}</button>}{meta && <div class="p-agenda__meta">{meta}</div>}</div></li>
);

function WeekStrip({ studyDays }: { studyDays: number[] }) {
  void tick.value;
  const monday = mondayOf(new Date()), t = today();
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(monday, i); const isToday = dayNum(d) === t; return { d, i, isToday, sec: secondsOnDay(toISO(d)) + (isToday ? pendingSeconds() : 0) }; });
  const max = Math.max(3600, ...days.map(x => x.sec));
  return (
    <div class="p-week" role="list" aria-label="Esta semana">
      {days.map(({ d, i, isToday, sec }) => (
        <div role="listitem" class={`p-day ${studyDays.includes(i) ? '' : 'p-day--rest'} ${isToday ? 'p-day--today' : ''}`} title={`${fmtShort(d)}: ${hours(sec)}${studyDays.includes(i) ? '' : ' (descanso)'}`}>
          <span class="p-day__name">{WEEKDAYS_SHORT[i]}</span><span class="p-day__num">{d.getDate()}</span>
          <span class="p-day__bar"><span style={{ height: `${(100 * sec) / max}%` }} /></span>
          <span class="p-day__min">{sec >= 60 ? Math.round(sec / 60) + "'" : '·'}</span>
        </div>
      ))}
    </div>
  );
}

/** Línea temporal del plan: cuatro fases proporcionales y un marcador en la semana actual. */
function PhaseLine({ frame }: { frame: ReturnType<typeof planFrame> }) {
  const total = frame.weeks.length, pos = Math.max(0, Math.min(1, (frame.current + 0.5) / total));
  return (
    <div class="p-phases" aria-label="Fases del plan">
      <div class="p-phases__bar">
        {frame.phaseWeeks.map((w, i) => w > 0 && <div class={`p-phases__seg p-phases__seg--${i}`} style={{ flex: w }} title={`${PHASE_LABEL[i]}: ${w} semanas`} />)}
        {frame.current >= 0 && frame.current < total && <div class="p-phases__now" style={{ left: `${pos * 100}%` }} title="Estás aquí" />}
      </div>
      <ul class="p-phases__legend">
        {frame.phaseWeeks.map((w, i) => w > 0 && (
          <li class={frame.weeks[Math.max(0, Math.min(frame.current, total - 1))]?.phase === i && frame.current >= 0 && frame.current < total ? 'is-current' : ''}>
            <i class={`p-phases__dot p-phases__seg--${i}`} />{PHASE_LABEL[i]}<span>{w} sem.</span>
          </li>))}
      </ul>
    </div>
  );
}

export function TodayPage() {
  const docs = useDocs(); void tick.value;
  const s = docs.core.settings, frame = planFrame();
  const idx = Math.max(0, Math.min(frame.current, frame.weeks.length - 1)), week = frame.weeks[idx];
  const before = frame.current < 0, after = frame.current >= frame.weeks.length;
  const wt = before || after ? [] : weekTopics(idx);
  const plan = todaysTopics(wt, topicStatus, s.days);
  const status = progressVsPlan(frame, docs.core.plan, topicStatus);
  const dq = dueQuestions().length, dc = dueCardIds().length;
  const weekSec = secondsThisWeek() + pendingSeconds(), goal = s.hours * 3600;
  const last = docs.core.hist.at(-1), streak = streakDays();
  const isSaturday = new Date().getDay() === 6;
  const studied = TOPICS.filter(t => topicStatus(t.id) >= 2).length;
  const doneToday = wt.filter(id => topicStatus(id) >= 2 && docs.core.topics[id]?.d === toISO(new Date()));

  const context = before ? `El plan empieza el ${fmtLong(frame.start)}` : after ? 'Has llegado al final del plan' : `Semana ${week.n} de ${frame.weeks.length}, ${PHASE_LABEL[week.phase].toLowerCase()}${week.type === 'h' ? ' (carga reducida)' : week.type === 'v' ? ' (vacaciones)' : ''}`;

  const agenda = (
    <ul class="p-agenda">
      {week.phase === 0 && <AgendaLink icon="timer" title="Examen oficial de 2024 en condiciones reales" meta="100 preguntas, 90 minutos: tu punto de partida" href="#examen" />}
      {(week.phase === 1 || week.phase === 2) && week.type === 'v' && <li><span class="p-agenda__icon"><Icon name="today" /></span><div class="p-agenda__body"><strong>Semana de vacaciones.</strong><div class="p-agenda__meta">No hay temas nuevos. Si te apetece, un refuerzo corto mantiene lo aprendido.</div></div></li>}
      {week.phase === 1 && week.type !== 'v' && plan.isStudyDay && [...doneToday, ...plan.today.filter(id => !doneToday.includes(id))].map(id => <AgendaTopic id={id} />)}
      {week.phase === 1 && week.type !== 'v' && !plan.isStudyDay && <li><span class="p-agenda__icon"><Icon name="today" /></span><div class="p-agenda__body"><strong>Hoy descansas.</strong><div class="p-agenda__meta">{plan.pending.length ? `Te ${plural(plan.pending.length, 'queda un tema', 'quedan temas')} esta semana (${plan.pending.length}).` : 'Semana completada.'}</div></div></li>}
      {week.phase === 1 && week.type !== 'v' && plan.isStudyDay && !plan.today.length && !doneToday.length && <li><span class="p-agenda__icon"><Icon name="check" /></span><div class="p-agenda__body"><strong>Temas de la semana terminados.</strong><div class="p-agenda__meta">Buen momento para repasar o adelantar.</div></div></li>}
      {week.phase === 2 && week.type !== 'v' && week.review.length > 0 && <AgendaLink icon="book" title={`Repaso de ${plural(week.review.length, 'tema', 'temas')}: ${week.review.slice(0, 4).map(topicCode).join(', ')}${week.review.length > 4 ? '…' : ''}`} meta="Relee tus esquemas y haz test mezclados" onClick={() => startTest({ topics: week.review, count: 40, mode: 'practice', label: `Repaso de la semana ${week.n}` })} />}
      {week.phase === 2 && week.type !== 'v' && isSaturday && <AgendaLink icon="pen" title="Supuesto práctico completo (180 minutos)" href="#supuestos" />}
      {week.phase === 3 && <AgendaLink icon="timer" title="Simulacro completo" meta="Test de 90 minutos y supuesto de 180" href="#examen" />}
      {dq > 0 && <AgendaLink icon="repeat" title={`Repasar ${plural(dq, 'pregunta', 'preguntas')}`} meta="Pendientes según tu repaso espaciado" href="#refuerzo" />}
      {dc > 0 && <AgendaLink icon="cards" title={`Repasar ${plural(dc, 'tarjeta', 'tarjetas')}`} href="#tarjetas" />}
    </ul>
  );

  return (
    <Page class="p-today">
      <header class="p-today__head">
        <div class="c-page__head" style={{ margin: 0 }}>
          <p class="p-today__meta" style={{ margin: 0 }}>{context}</p>
          <h1 class="p-today__date">{fmtToday()}</h1>
          {!after && <p class="c-page__lede">{PHASE_TIP[week.phase]}</p>}
        </div>
        <Ring value={studied / TOPICS.length} label={`${studied} de ${TOPICS.length} temas estudiados`}>
          <span class="p-ring__n">{studied}</span><span class="p-ring__l">de {TOPICS.length} temas</span>
        </Ring>
      </header>
      <PhaseLine frame={frame} />

      <PendingSession />
      <NewsCallout />
      {status.late.length > 0 && !before && <Callout tone="warn" action={<Button size="sm" onClick={() => reschedulePending()}>Reprogramar desde hoy</Button>}>Vas con {plural(status.late.length, 'tema', 'temas')} de semanas anteriores sin estudiar.</Callout>}
      {status.late.length === 0 && status.ahead > 0 && <Callout tone="ok">Vas {plural(status.ahead, 'tema', 'temas')} por delante del plan.</Callout>}

      <div class="p-today__grid">
        <div class="p-today__main">
      <Panel title="Agenda de hoy" actions={week.phase === 1 && plan.today.length > 0 && <Button variant="primary" size="sm" icon="test" onClick={() => startTest({ topics: plan.today, count: Math.min(30, plan.today.length * 12), mode: 'practice', label: 'Test de hoy' })}>Test de hoy</Button>}>
        {agenda}
      </Panel>

      <Panel title="Esta semana" subtitle="Minutos de estudio por día. Los días con borde discontinuo son de descanso.">
        <WeekStrip studyDays={s.days} />
      </Panel>

        </div>
        <div class="p-today__side">
      <Figures items={[
        { value: Math.max(0, dayNum(frame.exam) - today()), label: `días para el examen (estimado el ${fmtLong(frame.exam)})`, mark: true },
        { value: hours(weekSec), label: `de ${s.hours} h de objetivo esta semana`, extra: <Meter parts={[{ value: (100 * weekSec) / goal, color: 'var(--accent)', label: `${Math.round((100 * weekSec) / goal)} % del objetivo` }]} /> },
        { value: streak, label: streak === 1 ? 'día de racha' : 'días seguidos estudiando' },
      ]} />

      <div class="p-today__side-grid">
        <Panel title="Último test">
          {last ? <>
            <p style={{ margin: 0 }}><strong>{last.lbl}</strong></p>
            <p class="u-muted u-small">{plural(last.ok, 'acierto', 'aciertos')}, {plural(last.ko, 'error', 'errores')} y {last.bl} en blanco: <strong>{num(last.net)} netos</strong> de {last.n}.</p>
            <Button size="sm" href="#progreso">Ver progreso</Button>
          </> : <p class="u-muted" style={{ margin: 0 }}>Aún no has hecho ningún test.</p>}
        </Panel>
        <Panel title="Práctica rápida">
          <div class="u-row">
            <Button size="sm" icon="target" onClick={() => { const ids = Object.keys(topicById).filter(id => topicStatus(id) >= 1); if (!ids.length) return void startTest({ topics: Object.keys(topicById), count: 25, mode: 'practice', label: 'Test general' }); startTest({ topics: ids, count: 25, mode: 'practice', filter: 'weak', label: 'Puntos débiles' }); }}>Puntos débiles</Button>
            <Button size="sm" icon="timer" href="#examen">Simulacro</Button>
            <Button size="sm" icon="pen" href="#supuestos">Supuesto</Button>
          </div>
        </Panel>
      </div>
        </div>
      </div>
    </Page>
  );
}
