import { useEffect, useState } from 'preact/hooks';
import { blockById } from '@/core/content';
import { useCapability } from '@/core/services/platform';
import { canInstall, isIOS, isStandalone, promptInstall, pwaSupported } from '@/core/services/pwa';
import { SubscriptionSettings, UsagePanel } from './AiConnections';
import { MODELS, aiBackend, aiErrorMessage, aiMode, apiKey, apiModel, insideClaude, setAiMode, setApiKey, testApiKey, type AiMode } from '@/core/services/ai';
import { exportData, importData, inspectBackup, resetAll, updateSettings } from '@/core/store/actions';
import { useDocs } from '@/core/store/store';
import { syncMessage, syncState } from '@/core/store/sync';
import type { BlockId, Settings, Theme } from '@/core/types';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, todayISO } from '@/core/utils/date';
import { navigate } from '@/app/router';
import { Button, Callout, Checkbox, confirmDialog, DatePicker, Dropdown, Field, Icon, Input, NumberField, Page, PageHeader, Panel, Segmented, TextArea, toast } from '@/ui';
import './settings.css';

function PlanSettings({ s }: { s: Settings }) {
  const [d, setD] = useState<Settings>({ ...s, days: [...s.days], order: [...s.order] });
  useEffect(() => setD({ ...s, days: [...s.days], order: [...s.order] }), [s.start, s.exam, s.hours, s.days.join(), s.order.join(), s.b1inter, s.f0, s.f2, s.f3]);
  const set = (p: Partial<Settings>) => setD({ ...d, ...p });
  const move = (i: number, dir: -1 | 1) => { const o = [...d.order]; [o[i], o[i + dir]] = [o[i + dir], o[i]]; set({ order: o as BlockId[] }); };
  const save = () => {
    if (!d.start || !d.exam || d.exam <= d.start) return toast('La fecha del examen debe ser posterior al inicio');
    if (!d.days.length) return toast('Elige al menos un día de estudio');
    updateSettings({ start: d.start, exam: d.exam, hours: Math.max(2, Math.min(60, +d.hours || 15)), days: [...d.days].sort(), order: d.order, b1inter: d.b1inter, f0: +d.f0, f2: +d.f2, f3: +d.f3 }, true);
    toast('Plan reorganizado'); navigate('plan');
  };
  return (
    <Panel title="Plan de estudio" subtitle="Al guardar se recolocan los temas pendientes desde esta semana. Los estudiados y los fijados a mano se respetan.">
      <div class="st-form">
        <div class="st-two"><Field group label="Inicio del plan"><DatePicker label="Inicio del plan" value={d.start} max={d.exam} onChange={start => set({ start })} /></Field><Field group label="Fecha del examen" hint="Cámbiala cuando se publique la fecha oficial."><DatePicker label="Fecha del examen" value={d.exam} min={d.start} onChange={exam => set({ exam })} /></Field></div>
        <Field group label="Horas de estudio a la semana"><NumberField label="Horas de estudio a la semana" value={d.hours} min={2} max={60} unit="h" onChange={hours => set({ hours })} /></Field>
        <div class="c-field"><span class="c-field__label">Días de estudio</span><div class="st-days">{WEEKDAYS_SHORT.map((l, i) => (
          <button type="button" aria-pressed={d.days.includes(i)} aria-label={WEEKDAYS_LONG[i]} onClick={() => set({ days: d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i] })}>{l}</button>))}</div></div>
        <div class="c-field"><span class="c-field__label">Orden de los bloques en la primera vuelta</span>
          <ol class="st-order">{d.order.map((b, i) => <li><span>Bloque {b.slice(1)}. {blockById[b].title}</span><Button size="sm" variant="ghost" icon="left" iconOnly aria-label="Subir" disabled={!i} onClick={() => move(i, -1)} class="st-up" /><Button size="sm" variant="ghost" icon="right" iconOnly aria-label="Bajar" disabled={i === 3} onClick={() => move(i, 1)} class="st-down" /></li>)}</ol>
          <Checkbox checked={d.b1inter} onChange={v => set({ b1inter: v })}>Repartir el Bloque 1 (normativa) entre todas las semanas en vez de estudiarlo seguido</Checkbox>
        </div>
        <div class="st-three">
          <Field group label="Semanas de diagnóstico"><NumberField label="Semanas de diagnóstico" value={d.f0} min={0} max={4} onChange={f0 => set({ f0 })} /></Field>
          <Field group label="Semanas de segunda vuelta"><NumberField label="Semanas de segunda vuelta" value={d.f2} min={0} max={16} onChange={f2 => set({ f2 })} /></Field>
          <Field group label="Semanas de simulacros"><NumberField label="Semanas de simulacros" value={d.f3} min={1} max={12} onChange={f3 => set({ f3 })} /></Field>
        </div>
        <div><Button variant="primary" onClick={save}>Guardar y reorganizar el plan</Button></div>
      </div>
    </Panel>
  );
}

function DataSettings() {
  const [text, setText] = useState('');
  const doExport = async () => {
    const data = exportData();
    const dl = await useCapability<{ save: (o: { filename: string; data: string }) => Promise<{ status: string }> }>('downloads');
    if (!dl) { setText(data); return; }                    // fuera de Claude: copia manual
    try { await dl.save({ filename: `cuaderno-gsi-${todayISO()}.json`, data }); toast('Copia guardada'); }
    catch (e: any) {
      if (e?.code === 'declined') return;                   // dijiste que no: no se hace nada
      if (e?.code === 'rate_limited') { toast('Ya hay una descarga pendiente de confirmar'); return; }
      setText(data);                                        // no se puede descargar aquí: copia manual
    }
  };
  const doImport = async (input: HTMLInputElement) => {
    const file = input.files?.[0]; input.value = '';        // permite volver a elegir el mismo archivo
    if (!file) return;
    let summary: ReturnType<typeof inspectBackup>;
    try { summary = inspectBackup(await file.text()); } catch (e: any) { toast(e?.message || 'Ese archivo no es una copia de Cuaderno GSI'); return; }
    if (!(await confirmDialog({ title: 'Importar copia', message: `Copia del ${summary.date}: ${summary.tests} tests, ${summary.seen} preguntas vistas, ${summary.topics} temas estudiados y ${summary.cards} tarjetas propias.\n\nSustituirá todo tu progreso actual.`, confirm: 'Importar', danger: true }))) return;
    importData(summary.json); toast('Copia importada');
  };
  const syncText = { ok: 'Tu progreso se sincroniza entre los dispositivos donde abras la app con tu cuenta de Claude.', error: syncMessage.value || 'La sincronización ha fallado. Tus datos siguen en este dispositivo.', local: 'Tu progreso se guarda en este navegador. Si abres la app desde Claude con tu cuenta, se sincroniza entre dispositivos.' }[syncState.value];
  return (
    <Panel title="Tus datos" subtitle={syncText}>
      <div class="u-row">
        <Button icon="download" onClick={doExport}>Exportar copia</Button>
        <label class="c-btn c-btn--secondary"><Icon name="sync" size={18} />Importar copia<input type="file" accept="application/json,.json" hidden onChange={e => doImport(e.target as HTMLInputElement)} /></label>
        <Button variant="danger" icon="trash" onClick={async () => { if (await confirmDialog({ title: 'Borrar todo', message: 'Se borrará todo tu progreso, notas, tarjetas y supuestos, y la clave de la API guardada en este navegador. No se puede deshacer.', confirm: 'Borrar todo', danger: true })) { resetAll(); toast('Progreso borrado'); } }}>Borrar todo</Button>
      </div>
      {text && <div class="u-stack" style={{ marginTop: 'var(--space-4)' }}><Field label="Aquí no se pueden descargar archivos: copia este texto y guárdalo como .json"><TextArea readOnly value={text} style={{ minHeight: 120 }} /></Field><div class="u-row"><Button size="sm" onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Copiado al portapapeles'), () => toast('No se pudo copiar'))}>Copiar</Button><Button size="sm" variant="ghost" onClick={() => setText('')}>Cerrar</Button></div></div>}
    </Panel>
  );
}

function InstallSettings() {
  if (!pwaSupported) return null;
  return (
    <Panel title="Instalar en el móvil" subtitle="Tenla en la pantalla de inicio como una app: pantalla completa, icono propio y funciona sin conexión.">
      {isStandalone.value ? <Callout tone="ok">Ya estás usando la app instalada.</Callout>
        : canInstall.value ? <Button variant="primary" icon="download" onClick={async () => { if (await promptInstall()) toast('Cuaderno GSI instalado'); }}>Instalar Cuaderno GSI</Button>
        : isIOS ? <ol class="st-steps"><li>Abre esta página en <strong>Safari</strong>.</li><li>Pulsa el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li><li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma.</li></ol>
        : <ol class="st-steps"><li>Abre esta página en <strong>Chrome</strong>.</li><li>Pulsa el menú <strong>⋮</strong> de arriba a la derecha.</li><li>Elige <strong>Instalar aplicación</strong> (o «Añadir a pantalla de inicio»).</li></ol>}
      <p class="u-muted u-small" style={{ margin: 'var(--space-3) 0 0' }}>Tu progreso aquí es independiente del de Claude y del de otros navegadores. Para pasarlo de un sitio a otro usa Exportar e Importar copia.</p>
    </Panel>
  );
}

function AiSettings() {
  const [key, setKey] = useState(apiKey.value), [model, setModel] = useState(apiModel.value);
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  if (insideClaude) return (
    <Panel title="Inteligencia artificial" subtitle="Estás usando la app dentro de Claude.">
      <p style={{ margin: 0 }}>{aiBackend.value === 'claude' ? 'La IA usa la cuenta de Claude de quien abre la app: la primera vez de cada sesión Claude pide permiso, y cada consulta gasta de su propio uso, nunca del tuyo si la abre otra persona.' : 'La IA no está disponible en esta vista.'}</p>
    </Panel>
  );
  const save = async () => {
    const k = key.trim();
    if (!/^sk-ant-/.test(k)) { setStatus({ tone: 'bad', text: 'Eso no parece una clave de la API de Anthropic (empiezan por «sk-ant-»).' }); return; }
    setApiKey(k, model); setBusy(true); setStatus(null);
    try { await testApiKey(); setStatus({ tone: 'ok', text: 'Clave guardada y comprobada: la IA ya funciona en este navegador.' }); }
    catch (e) { setStatus({ tone: 'bad', text: aiErrorMessage(e) }); }
    setBusy(false);
  };
  return (
    <Panel title="Inteligencia artificial" subtitle="Elige cómo funcionan los botones de IA en esta versión de la app.">
      <div class="st-form">
        <Segmented block label="Modo de IA" value={aiMode.value} onChange={(m: AiMode) => setAiMode(m)} options={[['suscripcion', 'Mi suscripción de Claude'], ['apikey', 'Clave de la API']]} />
        {aiMode.value === 'suscripcion' ? <>
          <SubscriptionSettings />
        </> : <>
          <Callout tone="warn">La API de Anthropic <strong>no usa tu suscripción</strong>: se paga aparte con créditos en platform.claude.com. A cambio, todo es automático.</Callout>
          <Callout tone="info">La clave se guarda <strong>solo en este navegador</strong>: no va dentro del archivo de la app, no se sincroniza y no se incluye en las copias exportadas.</Callout>
          <Field group label="Clave de la API" hint="Créala en platform.claude.com (la consola de desarrolladores, distinta de la app de Claude).">
            <div class="u-row" style={{ flexWrap: 'nowrap' }}>
              <Input type={show ? 'text' : 'password'} value={key} placeholder="sk-ant-…" autoComplete="off" spellcheck={false} aria-label="Clave de la API" onInput={e => setKey((e.target as HTMLInputElement).value)} />
              <Button variant="ghost" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</Button>
            </div>
          </Field>
          <Field group label="Modelo"><Dropdown block label="Modelo" value={model} onChange={setModel} options={MODELS.map(([id, l]) => ({ value: id, label: l }))} /></Field>
          <div class="u-row"><Button variant="primary" icon="check" disabled={busy || !key.trim()} onClick={save}>{busy ? 'Comprobando…' : 'Guardar y probar'}</Button>
            {apiKey.value && <Button variant="danger" icon="trash" onClick={() => { setApiKey(''); setKey(''); setStatus(null); toast('Clave borrada de este navegador'); }}>Borrar clave</Button>}</div>
          {status && <Callout tone={status.tone}>{status.text}</Callout>}
          <ul class="u-small u-muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Pon un <strong>límite de gasto mensual</strong> en la consola (Organization settings, Billing).</li>
            <li>No la guardes en ordenadores compartidos: cualquiera que use este navegador podría verla.</li>
          </ul>
        </>}
      </div>
    </Panel>
  );
}

export function SettingsPage() {
  const docs = useDocs(), s = docs.core.settings;
  return (
    <Page>
      <PageHeader title="Ajustes" />
      <PlanSettings s={s} />
      <Panel title="Preferencias">
        <Checkbox checked={s.ai} onChange={ai => updateSettings({ ai })}>Incluir por defecto las preguntas generadas con IA en tests y simulacros</Checkbox>
        <Checkbox checked={s.exclFlag} onChange={exclFlag => updateSettings({ exclFlag })}>No mostrar preguntas cuya clave he señalado como dudosa</Checkbox>
        <div class="u-row" style={{ marginTop: 'var(--space-3)' }}><span class="c-field__label">Apariencia</span><Segmented label="Apariencia" value={s.theme} onChange={(theme: Theme) => updateSettings({ theme })} options={[['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']]} /></div>
      </Panel>
      <InstallSettings />
      <AiSettings />
      {!insideClaude && aiMode.value === 'suscripcion' && <UsagePanel />}
      <DataSettings />
    </Page>
  );
}
