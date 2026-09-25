import { BLOCKS, QUESTIONS, TOPICS, questionById, topicById, topicCode, topicsOfBlock } from '@/core/content';
import { unflagQuestion } from '@/core/store/actions';
import { secondsOnDay, secondsOnTopic, statsOf, topicStatus } from '@/core/store/selectors';
import { useDocs } from '@/core/store/store';
import { addDays, fmtShort, toISO } from '@/core/utils/date';
import { hours, num, pct } from '@/core/utils/format';
import { BarChart, Button, Empty, Figures, LineChart, List, Meter, Page, PageHeader, Panel, Row } from '@/ui';
import { contextLabel } from '../layout/studyTimer';
import { Calibration } from '../test/Calibration';
import { startTest } from '../test/session';
import '../test/test.css';

export function ProgressPage() {
  const docs = useDocs();
  const hist = docs.core.hist, seen = Object.keys(docs.srs.m).length;
  const [ok, ko] = hist.reduce(([a, b], h) => [a + h.ok, b + h.ko], [0, 0]);
  const totalSec = Object.values(docs.core.time).reduce((a, d) => a + Object.values(d).reduce((x, y) => x + y, 0), 0);
  const byContext: Record<string, number> = {};
  for (const d of Object.values(docs.core.time)) for (const [k, v] of Object.entries(d)) { const g = topicById[k] ? 'temas' : k; byContext[g] = (byContext[g] ?? 0) + v; }
  const days = Array.from({ length: 28 }, (_, i) => { const d = addDays(new Date(), i - 27); return { d, v: secondsOnDay(toISO(d)) }; });
  const weak = TOPICS.map(t => ({ t, s: statsOf(t.id) })).filter(x => x.s.right + x.s.wrong >= 8).sort((a, b) => a.s.accuracy! - b.s.accuracy!).slice(0, 8);
  const mocks = hist.filter(h => h.n >= 90);
  const cs: [number, number] = [0, 0], cd: [number, number] = [0, 0];
  hist.slice(-30).forEach(h => { if (h.cs && h.cd) { cs[0] += h.cs[0]; cs[1] += h.cs[1]; cd[0] += h.cd[0]; cd[1] += h.cd[1]; } });
  const flags = Object.entries(docs.core.qflags).filter(([id]) => questionById[id]);

  return (
    <Page>
      <PageHeader title="Progreso" />
      <Figures items={[
        { value: `${seen}`, label: `de ${QUESTIONS.length} preguntas vistas` },
        { value: ok + ko ? `${pct(ok, ok + ko)} %` : '–', label: `de acierto en ${ok + ko} respuestas` },
        { value: hours(totalSec), label: 'de estudio registradas' },
      ]} />
      <Panel title="Horas de estudio" subtitle="Últimas cuatro semanas">
        <BarChart label="Horas de estudio por día" bars={days.map(({ d, v }, i) => ({ label: fmtShort(d), value: v, title: `${fmtShort(d)}: ${hours(v)}`, tick: i % 7 === 0 ? fmtShort(d) : undefined }))} />
        {totalSec > 0
          ? <dl class="t-kv" style={{ marginTop: 'var(--space-4)' }}>{Object.entries(byContext).sort((a, b) => b[1] - a[1]).map(([k, v]) => <><dt>{k === 'temas' ? 'Lectura de temas' : contextLabel(k)}</dt><dd>{hours(v)}</dd></>)}</dl>
          : <p class="u-muted u-small" style={{ margin: 'var(--space-3) 0 0' }}>Pulsa «Estudiar» al empezar cada sesión y la app irá sumando horas por tema.</p>}
      </Panel>
      <Panel title="Temario por bloques" subtitle="Verde: dominado. Azul: estudiado. Azul claro: leído.">
        <div class="u-stack">{BLOCKS.map(b => {
          const ts = topicsOfBlock(b.id), c = [0, 0, 0, 0]; let r = 0, w = 0, sec = 0;
          ts.forEach(t => { c[topicStatus(t.id)]++; const s = statsOf(t.id); r += s.right; w += s.wrong; sec += secondsOnTopic(t.id); });
          return <div>
            <div class="u-spread u-small"><strong>Bloque {b.n}. {b.title}</strong><span class="u-muted">{c[2] + c[3]}/{ts.length} estudiados{r + w ? `, ${pct(r, r + w)} % de acierto` : ''}{sec ? `, ${hours(sec)}` : ''}</span></div>
            <div style={{ marginTop: 6 }}><Meter parts={[{ value: (100 * c[3]) / ts.length, color: 'var(--ok)', label: `${c[3]} dominados` }, { value: (100 * c[2]) / ts.length, color: 'var(--accent)', label: `${c[2]} estudiados` }, { value: (100 * c[1]) / ts.length, color: 'var(--accent-soft)', label: `${c[1]} leídos` }]} /></div>
          </div>;
        })}</div>
      </Panel>
      <Calibration sure={cs} doubt={cd} title="¿Arriesgas bien? (últimos 30 test)" />
      <Panel title="Temas más flojos" actions={weak.length > 0 && <Button size="sm" icon="target" onClick={() => startTest({ topics: TOPICS.filter(t => topicStatus(t.id) >= 1 || statsOf(t.id).seen).map(t => t.id), count: 25, mode: 'practice', filter: 'weak', label: 'Puntos débiles' })}>Test de puntos débiles</Button>}>
        {weak.length ? <List>{weak.map(({ t, s }) => <li><Row href={`#tema/${t.id}`} lead={topicCode(t.id)} title={t.title} trail={<strong>{pct(s.right, s.right + s.wrong)} %</strong>} /></li>)}</List> : <Empty>Aparecerán cuando respondas al menos 8 preguntas de un tema.</Empty>}
      </Panel>
      <Panel title="Simulacros">{mocks.length ? <LineChart label="Netos por simulacro" target={70} points={mocks.map(h => ({ x: h.d, y: h.net }))} /> : <Empty>Haz tu primer simulacro para ver la evolución de tus netos.</Empty>}</Panel>
      {flags.length > 0 && <Panel title={`Preguntas con clave señalada (${flags.length})`}><List>{flags.map(([id, f]) => <li><Row lead={topicCode(questionById[id].t)} title={questionById[id].s} meta={`Tu nota: ${f.n || '(sin nota)'}`} trail={<Button size="sm" variant="ghost" onClick={() => unflagQuestion(id)}>Quitar</Button>} /></li>)}</List></Panel>}
      <Panel title="Historial de tests" flush>
        {hist.length ? <div class="u-scroll-x" style={{ padding: '0 var(--space-6) var(--space-4)' }}><table class="c-table"><thead><tr><th>Test</th><th>Fecha</th><th class="n">Preguntas</th><th class="n">Acierto</th><th class="n">Netos</th><th class="n">s/pregunta</th></tr></thead>
          <tbody>{hist.slice(-40).reverse().map(h => <tr><td data-label="Test">{h.lbl}</td><td data-label="Fecha">{h.d}</td><td class="n" data-label="Preguntas">{h.n}</td><td class="n" data-label="Acierto">{pct(h.ok, h.ok + h.ko)} %</td><td class="n" data-label="Netos">{num(h.net)}</td><td class="n" data-label="s/pregunta">{h.tq ?? '–'}</td></tr>)}</tbody></table></div> : <Empty>Sin tests todavía.</Empty>}
      </Panel>
    </Page>
  );
}
