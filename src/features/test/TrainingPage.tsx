import { PendingSession } from './PendingSession';
import { signal } from '@preact/signals';
import { BLOCKS, TOPICS, topicsOfBlock } from '@/core/content';
import { defaultSources, questionPool, type Filter, type Sources } from '@/core/domain/exam';
import { isExcluded, planFrame, topicStatus, weekTopics } from '@/core/store/selectors';
import { onReset, useDocs } from '@/core/store/store';
import { plural } from '@/core/utils/format';
import { Button, Checkbox, Page, PageHeader, Panel, Segmented, toast } from '@/ui';
import { startTest } from './session';
import './test.css';

/** Configuración del entrenamiento: se conserva mientras la app está abierta. */
const initial = () => ({ topics: new Set<string>(), count: 25, filter: 'all' as Filter, sources: null as Sources | null });
const cfg = signal(initial());
onReset(() => { cfg.value = initial(); });
const set = (patch: Partial<typeof cfg.value>) => { cfg.value = { ...cfg.value, ...patch }; };
const withTopics = (fn: (s: Set<string>) => void) => { const s = new Set(cfg.value.topics); fn(s); set({ topics: s }); };

export function TrainingPage() {
  const docs = useDocs();
  const c = cfg.value, sources = c.sources ?? defaultSources(docs.core.settings.ai);
  const available = questionPool({ topics: [...c.topics], sources, filter: c.filter, srs: docs.srs.m, excluded: isExcluded }).length;
  const presetWeek = () => { const f = planFrame(), w = f.weeks[Math.max(0, Math.min(f.current, f.weeks.length - 1))]; const ids = w.phase === 2 ? w.review : weekTopics(w.i); if (!ids.length) toast('Esta semana no tiene temas asignados'); set({ topics: new Set(ids) }); };

  return (
    <Page>
      <PageHeader title="Entrenamiento" lede="Practica por bloques y temas con corrección inmediata, explicación y procedencia de cada pregunta. Marca «Dudo» cuando no estés seguro: esas preguntas volverán en el refuerzo y verás si arriesgas bien." />
      <PendingSession />
      <Panel title="Temas" subtitle={`${c.topics.size} de ${TOPICS.length} seleccionados`}
        actions={<>
          <Button size="sm" onClick={() => set({ topics: new Set(TOPICS.map(t => t.id)) })}>Todo</Button>
          <Button size="sm" onClick={presetWeek}>Esta semana</Button>
          <Button size="sm" onClick={() => set({ topics: new Set(TOPICS.filter(t => topicStatus(t.id) >= 1).map(t => t.id)) })}>Ya estudiados</Button>
          <Button size="sm" variant="ghost" onClick={() => set({ topics: new Set() })}>Ninguno</Button>
        </>}>
        <div class="t-topics">
          {BLOCKS.map(b => {
            const ts = topicsOfBlock(b.id), sel = ts.filter(t => c.topics.has(t.id)).length;
            return (
              <details open={sel > 0}>
                <summary>Bloque {b.n}. {b.title} <span class="u-muted u-small">({sel}/{ts.length})</span></summary>
                <Checkbox checked={sel === ts.length} onChange={v => withTopics(s => ts.forEach(t => (v ? s.add(t.id) : s.delete(t.id))))}><strong>Todo el bloque</strong></Checkbox>
                {ts.map(t => <Checkbox checked={c.topics.has(t.id)} onChange={v => withTopics(s => (v ? s.add(t.id) : s.delete(t.id)))}><span class="u-muted u-num">Tema {t.n}.</span> {t.title}</Checkbox>)}
              </details>
            );
          })}
        </div>
      </Panel>
      <Panel title="Preguntas">
        <div class="t-config">
          <div><div class="c-field__label" style={{ marginBottom: 6 }}>Cuántas</div><Segmented block label="Número de preguntas" options={[[10, '10'], [25, '25'], [50, '50'], [100, '100']]} value={c.count} onChange={count => set({ count })} /></div>
          <div><div class="c-field__label" style={{ marginBottom: 6 }}>Cuáles</div><Segmented block label="Qué preguntas" options={[['all', 'Todas'], ['weak', 'Puntos débiles'], ['new', 'No vistas'], ['fail', 'Últimos errores']]} value={c.filter} onChange={filter => set({ filter })} /></div>
        </div>
        {c.filter === 'weak' && <p class="u-muted u-small" style={{ margin: 'var(--space-3) 0 0' }}>Prioriza tus temas con peor porcentaje, lo que has fallado y lo pendiente de refuerzo.</p>}
        <div class="t-sources"><span class="c-field__label">Origen</span>
          <Checkbox checked={sources.O} onChange={v => set({ sources: { ...sources, O: v } })}>Oficiales del INAP</Checkbox>
          <Checkbox checked={sources.P} onChange={v => set({ sources: { ...sources, P: v } })}>Exámenes anteriores (PreparaTIC)</Checkbox>
          <Checkbox checked={sources.M} onChange={v => set({ sources: { ...sources, M: v } })}>Curadas del material</Checkbox>
          <Checkbox checked={sources.I} onChange={v => set({ sources: { ...sources, I: v } })}>Generadas con IA</Checkbox>
        </div>
      </Panel>
      <div class="t-footer">
        <span class="u-muted" style={{ alignSelf: 'center' }}>{plural(available, 'pregunta disponible', 'preguntas disponibles')}</span>
        <Button variant="primary" size="lg" icon="play" disabled={!available} onClick={() => startTest({ topics: [...c.topics], count: c.count, mode: 'practice', sources, filter: c.filter, label: c.filter === 'weak' ? 'Puntos débiles' : c.filter === 'fail' ? 'Últimos errores' : `Entrenamiento de ${plural(c.topics.size, 'tema', 'temas')}` })}>Empezar</Button>
      </div>
    </Page>
  );
}
