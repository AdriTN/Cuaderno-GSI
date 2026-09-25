import { PendingSession } from '../test/PendingSession';
import { signal } from '@preact/signals';
import { BLOCKS, CONTENT, LIBRARY, topicsOfBlock } from '@/core/content';
import { EXAM_SECONDS, OFFICIAL_YEARS, SECONDS_PER_QUESTION, officialExam, randomMock, scoreAgainstKey } from '@/core/domain/exam';
import { isExcluded } from '@/core/store/selectors';
import { onReset, useDocs } from '@/core/store/store';
import { clock, num } from '@/core/utils/format';
import { Button, Callout, Checkbox, Empty, Icon, LineChart, Page, PageHeader, Panel, Segmented, Tag } from '@/ui';
import { startTest } from '../test/session';
import '../test/test.css';
import './exam.css';
import { NewsPanel } from './NewsPanel';

const initial = () => ({ blocks: new Set(BLOCKS.map(b => b.id as string)), count: 50, minutes: 0, ai: null as boolean | null });
const custom = signal(initial());
onReset(() => { custom.value = initial(); });

export function ExamPage() {
  const docs = useDocs();
  const c = custom.value, ai = c.ai ?? docs.core.settings.ai;
  const mocks = docs.core.hist.filter(h => h.n >= 90);
  const best = (label: string) => { const xs = docs.core.hist.filter(h => h.lbl === label).map(h => h.net); return xs.length ? Math.max(...xs) : null; };
  const own = docs.core.ownExams['2025'];
  const ownScore = own ? scoreAgainstKey(own, CONTENT.key2025.main) : null;
  const seconds = c.minutes ? c.minutes * 60 : c.count * SECONDS_PER_QUESTION;
  const startCustom = () => startTest({ topics: [...c.blocks].flatMap(b => topicsOfBlock(b).map(t => t.id)), count: c.count, mode: 'exam', limit: seconds, sources: { O: true, M: true, I: ai }, label: `Examen a medida (${c.count})`, kind: 'exam' });

  return (
    <Page>
      <PageHeader title="Examen" lede="Condiciones reales: sin ver la corrección hasta entregar, con tiempo y penalización de un tercio por error. Puedes marcar dudas y preguntas para revisar." />
      <PendingSession />
      <section class="e-official">
        {OFFICIAL_YEARS.map(y => { const b = best(`Examen oficial ${y}`); return (
          <article class="e-card">
            <div class="e-card__year">{y}</div>
            <div><h2 class="e-card__title">Examen oficial del INAP</h2><p class="u-muted u-small" style={{ margin: 0 }}>100 preguntas reales en su orden, 90 minutos y plantilla definitiva.</p></div>
            <div class="u-spread"><span class="u-small">{b !== null ? <>Tu mejor marca: <strong>{num(b)} netos</strong></> : 'Sin intentos'}</span><Button variant="primary" icon="play" onClick={() => startTest({ qids: officialExam(y), mode: 'exam', limit: EXAM_SECONDS, label: `Examen oficial ${y}`, kind: 'sim' })}>Empezar</Button></div>
          </article>); })}
        <article class="e-card e-card--own">
          <div class="e-card__year">2025</div>
          <div><h2 class="e-card__title">Corrige tu examen del 23 de mayo</h2><p class="u-muted u-small" style={{ margin: 0 }}>Introduce las respuestas de tu hoja y calcula tus netos con la plantilla provisional.</p></div>
          <div class="u-spread"><span class="u-small">{ownScore ? <>Resultado: <strong>{num(ownScore.net)} netos</strong></> : 'Sin corregir'}</span><Button variant="primary" icon="check" href="#mi-examen">{ownScore ? 'Ver' : 'Corregir'}</Button></div>
        </article>
      </section>
      <div class="u-grid">
        <Panel title="Simulacro aleatorio" subtitle="100 preguntas repartidas por bloques según su peso en el temario, 90 minutos.">
          <Checkbox checked={ai} onChange={v => (custom.value = { ...c, ai: v })}>Incluir preguntas generadas con IA</Checkbox>
          <Button variant="primary" icon="play" onClick={() => startTest({ qids: randomMock(ai, isExcluded), mode: 'exam', limit: EXAM_SECONDS, label: 'Simulacro aleatorio', kind: 'sim' })}>Empezar</Button>
        </Panel>
        <Panel title="Examen a medida" subtitle="Elige bloques, número de preguntas y duración.">
          <div class="u-stack" style={{ gap: 'var(--space-3)' }}>
            <div>{BLOCKS.map(b => <Checkbox checked={c.blocks.has(b.id)} onChange={v => { const s = new Set(c.blocks); v ? s.add(b.id) : s.delete(b.id); custom.value = { ...c, blocks: s }; }}>Bloque {b.n}. {b.title}</Checkbox>)}</div>
            <Segmented block label="Preguntas" value={c.count} onChange={count => (custom.value = { ...c, count })} options={[[25, '25'], [50, '50'], [100, '100']]} />
            <Segmented block label="Duración" value={c.minutes} onChange={minutes => (custom.value = { ...c, minutes })} options={[[0, `${Math.round((c.count * SECONDS_PER_QUESTION) / 60)} min`], [30, '30 min'], [60, '60 min'], [90, '90 min']]} />
            <div><Button variant="primary" icon="play" disabled={!c.blocks.size} onClick={startCustom}>Empezar ({clock(seconds)})</Button></div>
          </div>
        </Panel>
      </div>
      <Callout>En 2024 bastaron 30 netos para aprobar el test, pero el orden final decide quién elige destino primero. Apunta a 65-70.</Callout>
      <Panel title="Evolución de tus simulacros">
        {mocks.length ? <>
          <LineChart label="Netos por simulacro" target={70} points={mocks.map(h => ({ x: h.d, y: h.net }))} />
          <div class="u-scroll-x"><table class="c-table" style={{ marginTop: 'var(--space-4)' }}><thead><tr><th>Examen</th><th>Fecha</th><th class="n">Netos</th><th class="n">Tiempo</th></tr></thead>
            <tbody>{[...mocks].reverse().map(h => <tr><td data-label="Examen">{h.lbl}</td><td data-label="Fecha">{h.d}</td><td class="n" data-label="Netos"><strong>{num(h.net)}</strong></td><td class="n" data-label="Tiempo">{clock(h.dur)}</td></tr>)}</tbody></table></div>
        </> : <Empty title="Aún no hay simulacros">Haz el examen oficial de 2024 para tener tu punto de partida.</Empty>}
      </Panel>
      <NewsPanel />
      <Panel title="Biblioteca oficial del INAP" subtitle="Cuestionarios, plantillas, supuestos y criterios. Los documentos nuevos que publique el INAP se añaden solos.">
        <div class="e-library">{LIBRARY.map(l => (
          <div class="e-library__year">
            <div class="u-spread"><strong>Convocatoria {l.year}</strong>{l.status === 'provisional' ? <Tag tone="warn">Plantilla provisional</Tag> : <Tag tone="ok">Plantilla definitiva</Tag>}</div>
            <ul>{l.docs.map(d => <li><a href={d.url} target="_blank" rel="noopener"><Icon name="download" size={16} />{d.label}</a>{(d as any).isNew && <> <Tag tone="mark">Nuevo</Tag></>}</li>)}</ul>
          </div>))}</div>
      </Panel>
    </Page>
  );
}
