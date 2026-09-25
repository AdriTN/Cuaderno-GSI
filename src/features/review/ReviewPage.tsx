import { LETTERS, questionById, topicCode } from '@/core/content';
import { dueCardIds, dueQuestions, failedQuestions } from '@/core/store/selectors';
import { useDocs } from '@/core/store/store';
import { plural } from '@/core/utils/format';
import { shuffle } from '@/core/utils/random';
import { Button, Callout, Empty, Figures, Meter, Page, PageHeader, Panel } from '@/ui';
import { startTest } from '../test/session';

const LEVEL_COLORS = ['var(--bad)', '#E08A3C', '#E2B93B', '#9DBF4A', '#5DAA5E', '#2E8B57', 'var(--ok)'];

export function ReviewPage() {
  const docs = useDocs();
  const due = dueQuestions(), cards = dueCardIds().length, fails = failedQuestions();
  const seen = Object.keys(docs.srs.m).length;
  const levels = [0, 0, 0, 0, 0, 0, 0]; Object.values(docs.srs.m).forEach(e => levels[e[0]]++);
  return (
    <Page>
      <PageHeader title="Refuerzo" lede="Tus errores y tus dudas vuelven justo antes de que los olvides: al día siguiente si fallas o dudas, y cada vez más espaciados si aciertas con seguridad (3, 7, 14, 30 y 60 días)."
        actions={<>
          <Button variant="primary" icon="play" disabled={!due.length} onClick={() => startTest({ qids: due.slice(0, 30), mode: 'practice', label: 'Refuerzo del día', kind: 'repaso' })}>Reforzar {Math.min(30, due.length) || ''}</Button>
          {due.length > 30 && <Button onClick={() => startTest({ qids: due, mode: 'practice', label: 'Refuerzo completo', kind: 'repaso' })}>Todas ({due.length})</Button>}
        </>} />
      <Figures items={[{ value: due.length, label: 'errores y dudas para hoy', mark: due.length > 0 }, { value: seen, label: 'preguntas vistas en total' }, { value: fails.length, label: 'en tu registro de errores' }]} />
      {cards > 0 && <Callout action={<Button size="sm" href="#tarjetas">Ir a tarjetas</Button>}>Además tienes {plural(cards, 'tarjeta pendiente', 'tarjetas pendientes')}.</Callout>}
      {seen > 0 && (
        <Panel title="Consolidación" subtitle="Cuanto más a la derecha, más asentado está lo que has visto.">
          <Meter size="lg" parts={levels.map((n, i) => ({ value: (100 * n) / seen, color: LEVEL_COLORS[i], label: `Nivel ${i}: ${n}` }))} />
          <div class="u-spread u-small u-muted" style={{ marginTop: 'var(--space-2)' }}><span>Recién fallado</span><span>Consolidado</span></div>
        </Panel>
      )}
      <Panel title="Registro de errores" subtitle={fails.length ? `Tus últimas ${fails.length} preguntas falladas` : undefined}
        actions={fails.length > 0 && <Button size="sm" onClick={() => startTest({ qids: shuffle(fails.slice(0, 50).map(([id]) => id)), mode: 'practice', label: 'Test de errores' })}>Hacer test con ellas</Button>}>
        {fails.length ? fails.map(([id, e]) => { const q = questionById[id]; return (
          <details class="t-review" style={{ borderTop: '1px solid var(--line)', padding: 'var(--space-3) 0' }}>
            <summary><span class="u-muted u-small u-num" style={{ minWidth: 60 }}>{topicCode(q.t)}</span><span style={{ flex: 1 }}>{q.s}</span><span class="u-muted u-small">{plural(e[3], 'fallo', 'fallos')}</span></summary>
            <p class="u-small" style={{ margin: 0 }}><strong>Correcta: {LETTERS[q.c]}) {q.a[q.c]}</strong><br />{q.f}</p>
          </details>); }) : <Empty>Sin errores registrados todavía.</Empty>}
      </Panel>
    </Page>
  );
}
