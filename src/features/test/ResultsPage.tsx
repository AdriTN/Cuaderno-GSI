import { useState } from 'preact/hooks';
import { LETTERS, ORIGIN_LABEL, blockById, topicById, topicCode } from '@/core/content';
import { reinforce } from '@/core/store/actions';
import { clock, num, pct, plural } from '@/core/utils/format';
import { shuffle } from '@/core/utils/random';
import { Button, Empty, Figures, List, Page, PageHeader, Panel, Row, Tabs, Tag, toast } from '@/ui';
import { Calibration } from './Calibration';
import { ExplainButton, FlagButton } from './QuestionTools';
import { session, startTest } from './session';
import './test.css';

type ReviewFilter = 'fail' | 'blank' | 'doubt' | 'flag' | 'slow' | 'all';

export function ResultsPage() {
  const s = session.value; const [filter, setFilter] = useState<ReviewFilter>('fail');
  if (!s?.result) return <Empty title="No hay resultados que mostrar" action={<Button variant="primary" href="#entrenamiento">Ir a entrenamiento</Button>} />;
  const r = s.result;
  const slow = s.qs.map((_, k) => k).sort((a, b) => s.time[b] - s.time[a]).slice(0, 5);
  const is = (k: number, f: ReviewFilter) => { const a = s.ans[k], q = s.qs[k]; return f === 'all' || (f === 'fail' && a >= 0 && a !== q.c) || (f === 'blank' && a === -1) || (f === 'doubt' && s.doubt[k]) || (f === 'flag' && s.flag[k]) || (f === 'slow' && slow.includes(k)); };
  const count = (f: ReviewFilter) => s.qs.filter((_, k) => is(k, f)).length;
  const items = s.qs.map((q, k) => ({ q, k, a: s.ans[k] })).filter(x => is(x.k, filter));
  const weakTopics = Object.entries(s.qs.reduce<Record<string, number>>((acc, q, k) => { if (s.ans[k] !== q.c) acc[q.t] = (acc[q.t] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Page>
      <PageHeader title={r.lbl} lede={`${plural(r.ok, 'acierto', 'aciertos')}, ${plural(r.ko, 'error', 'errores')} y ${r.bl} en blanco en ${clock(r.dur)}. Media de ${r.tq} s por pregunta${s.mode === 'exam' ? ' (en el examen dispones de 54 s)' : ''}.`} />
      <Figures items={[
        { value: num(r.net), label: `netos de ${r.n} (aciertos menos errores entre 3)`, mark: true },
        ...(r.n >= 90 ? [{ value: num((Math.max(0, r.net) * 50) / r.n), label: 'sobre 50 en escala lineal orientativa' }] : []),
        { value: `${pct(r.ok, r.ok + r.ko)} %`, label: 'de acierto en las respondidas' },
      ]} />
      {r.cs && r.cd && <Calibration sure={r.cs} doubt={r.cd} />}
      <Panel title="Por bloques" flush>
        <div class="u-scroll-x" style={{ padding: '0 var(--space-6) var(--space-4)' }}>
          <table class="c-table"><thead><tr><th>Bloque</th><th class="n">Aciertos</th><th class="n">Errores</th><th class="n">Blanco</th><th class="n">Netos</th></tr></thead>
            <tbody>{Object.entries(r.b).sort().map(([b, v]) => <tr><td data-label="Bloque">Bloque {b.slice(1)}. {blockById[b].title}</td><td class="n" data-label="Aciertos">{v[0]}</td><td class="n" data-label="Errores">{v[1]}</td><td class="n" data-label="Blanco">{v[2]}</td><td class="n" data-label="Netos">{num(v[0] - v[1] / 3)}</td></tr>)}</tbody></table>
        </div>
      </Panel>
      {weakTopics.length > 0 && <Panel title="Temas a reforzar" subtitle="Donde más has fallado o dejado en blanco en esta sesión." actions={<Button size="sm" icon="target" onClick={() => startTest({ topics: weakTopics.map(([t]) => t), count: 20, mode: 'practice', label: 'Entrenamiento de temas a reforzar' })}>Entrenar estos temas</Button>}>
        <List>{weakTopics.map(([t, n]) => <li><Row href={`#tema/${t}`} lead={topicCode(t)} title={topicById[t].title} trail={<span>{n} {n === 1 ? 'fallo' : 'fallos'}</span>} /></li>)}</List>
      </Panel>}
      <div class="u-row">
        <Button variant="primary" icon="repeat" disabled={!(r.ko + r.bl)} onClick={() => startTest({ qids: shuffle(s.qs.filter((q, k) => s.ans[k] !== q.c).map(q => q.i)), mode: 'practice', label: 'Repetición de fallos' })}>Repetir fallos y blancos</Button>
        <Button href="#entrenamiento">Nuevo entrenamiento</Button><Button variant="ghost" href="#refuerzo">Ir a refuerzo</Button>
      </div>
      <section class="u-stack">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Revisión</h2>
        <Tabs label="Filtrar revisión" value={filter} onChange={setFilter} items={([['fail', 'Fallos'], ['blank', 'En blanco'], ['doubt', 'Con duda'], ['flag', 'Marcadas'], ['slow', 'Más lentas'], ['all', 'Todas']] as [ReviewFilter, string][]).map(([k, l]) => [k, l, count(k)])} />
        {items.length ? items.map(({ q, k, a }) => (
          <details class="c-panel t-review">
            <summary><Tag tone={a === -1 ? 'neutral' : a === q.c ? 'ok' : 'bad'}>{a === -1 ? 'Blanco' : a === q.c ? 'Acierto' : 'Fallo'}</Tag>{s.doubt[k] && <Tag tone="warn">Duda</Tag>}<span>{q.s}</span></summary>
            <div class="t-options">{q.a.map((txt, j) => <div class={`t-opt ${j === q.c ? 't-opt--right' : j === a ? 't-opt--wrong' : ''}`}><span class="t-opt__key">{LETTERS[j]}</span><span>{txt}</span></div>)}</div>
            <p class="u-small" style={{ margin: 'var(--space-3) 0' }}>{q.f}</p>
            {q.p && <p class="u-muted u-small" style={{ margin: '0 0 var(--space-3)' }}>Procedencia: {q.p}</p>}
            <div class="u-row"><Tag>{ORIGIN_LABEL[q.o]}</Tag><span class="u-muted u-small">{Math.round(s.time[k])} s</span><Button size="sm" variant="ghost" icon="repeat" onClick={() => { reinforce(q.i); toast('Añadida al refuerzo de hoy'); }}>Al refuerzo</Button><Button size="sm" variant="ghost" href={`#tema/${q.t}`}>Ir al tema</Button><FlagButton id={q.i} /><ExplainButton q={q} answer={a} /></div>
          </details>
        )) : <Empty>Nada en esta lista.</Empty>}
      </section>
    </Page>
  );
}
