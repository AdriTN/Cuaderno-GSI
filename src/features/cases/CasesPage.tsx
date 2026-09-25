import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { CONTENT, topicOptions } from '@/core/content';
import { aiErrorMessage, aiStatus } from '@/core/services/ai';
import { MAX_GENERATED, caseState, deleteGeneratedCase } from '@/core/store/actions';
import { onReset, useDocs } from '@/core/store/store';
import { num, words } from '@/core/utils/format';
import { navigate } from '@/app/router';
import { Button, Callout, confirmDialog, Dropdown, Field, List, Page, PageHeader, Panel, Row, StatusDot, Tag, toast } from '@/ui';
import { FOCUS_LABEL, generateCase, type Focus } from './generator';
import './cases.css';

const form = signal<{ focus: Focus; topic: string; hard: boolean }>({ focus: 'dev', topic: '', hard: false });
onReset(() => { form.value = { focus: 'dev', topic: '', hard: false }; });

function CaseRow({ id, title, generated }: { id: string; title: string; generated?: boolean }) {
  const st = caseState(id), w = words(st.a.join(' '));
  const status = st.st === 2 ? 3 : w ? 1 : 0;
  const meta = `${st.st === 2 ? 'Terminado' : w ? `En curso, ${w} palabras` : 'Sin empezar'}${st.ai ? `. Corrección IA: ${num(st.ai.total)} / 50` : ''}`;
  return <li><Row href={`#supuesto/${id}`} icon={<StatusDot status={status} />} title={title} meta={meta}
    action={generated && <Button size="sm" variant="ghost" icon="trash" iconOnly aria-label="Borrar supuesto" onClick={async () => { if (await confirmDialog({ title: 'Borrar supuesto', message: 'Se borrará este supuesto generado junto con tus respuestas.', confirm: 'Borrar', danger: true })) deleteGeneratedCase(id); }} />} /></li>;
}

function Generator({ count }: { count: number }) {
  const f = form.value; const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async () => {
    if (count >= MAX_GENERATED) return toast(`Tienes ${MAX_GENERATED} supuestos guardados: borra alguno para crear otro`);
    setBusy(true); setError('');
    try { const id = await generateCase(f.focus, f.topic, f.hard); toast('Supuesto creado'); navigate(`supuesto/${id}`); }
    catch (e) { setError(aiErrorMessage(e)); }
    setBusy(false);
  };
  return (
    <Panel title="Crear un supuesto nuevo con IA" subtitle="Un caso al estilo del examen con su guía de corrección oculta hasta que termines. Tarda uno o dos minutos.">
      <div class="x-gen">
        <div class="x-gen__wide"><Field group label="Tema central (opcional)"><Dropdown block searchable label="Tema central" value={f.topic} onChange={topic => (form.value = { ...f, topic })} options={[{ value: '', label: 'Cualquiera del enfoque' }, ...topicOptions(t => t.b !== 'B1')]} /></Field></div>
        <Field group label="Enfoque"><Dropdown block label="Enfoque" value={f.focus} onChange={(focus: Focus) => (form.value = { ...f, focus })} options={(Object.keys(FOCUS_LABEL) as Focus[]).map(k => ({ value: k, label: FOCUS_LABEL[k] }))} /></Field>
        <Field group label="Dificultad"><Dropdown block label="Dificultad" value={f.hard ? 'hard' : 'std'} onChange={v => (form.value = { ...f, hard: v === 'hard' })} options={[{ value: 'std', label: 'Como el examen' }, { value: 'hard', label: 'Más exigente', hint: 'Más datos, más restricciones y decisiones más discutibles' }]} /></Field>
      </div>
      <div class="u-row" style={{ marginTop: 'var(--space-4)' }}><Button variant="primary" icon="spark" disabled={busy} onClick={run}>{busy ? 'Generando…' : 'Generar supuesto'}</Button><span class="u-muted u-small">{count} de {MAX_GENERATED} guardados</span></div>
      {error && <div style={{ marginTop: 'var(--space-3)' }}><Callout tone="bad">{error}</Callout></div>}
    </Panel>
  );
}

export function CasesPage() {
  const docs = useDocs();
  const generated = Object.values(docs.gen.m).sort((a, b) => b.d.localeCompare(a.d));
  const sims = [...new Set(CONTENT.cases.map(c => c.sim))];
  return (
    <Page>
      <PageHeader title="Supuestos prácticos" lede="El segundo ejercicio: eliges uno de dos supuestos y respondes 5 preguntas en 180 minutos. El tribunal puntúa aplicación técnica (30), análisis (10), sistemática (5) y expresión escrita (5)." />
      {aiStatus.value !== 'off' && <Generator count={generated.length} />}
      {generated.length > 0 && <Panel title="Tus supuestos generados" actions={<Tag tone="warn">IA</Tag>}><List>{generated.map(g => <CaseRow id={g.id} title={g.title} generated />)}</List></Panel>}
      <Panel title="Supuestos oficiales del INAP" subtitle="Los enunciados reales del segundo ejercicio: en el examen eliges uno de los dos de cada convocatoria." actions={<Tag tone="ok">Oficial</Tag>}>
        <List>{[...CONTENT.officialCases].reverse().map(c => <CaseRow id={c.id} title={c.title} />)}</List>
      </Panel>
      {sims.map(s => <Panel title={`Simulacro ${s} del material`}><List>{CONTENT.cases.filter(c => c.sim === s).map(c => <CaseRow id={c.id} title={c.title} />)}</List></Panel>)}
      <p class="u-muted u-small">Más casos para practicar en <a href="#cuadernos">Cuadernos prácticos</a>.</p>
    </Page>
  );
}
