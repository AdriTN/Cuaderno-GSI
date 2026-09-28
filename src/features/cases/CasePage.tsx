import { confirmDialog } from '@/ui';
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { aiErrorMessage, aiStatus, askJSON } from '@/core/services/ai';
import { gradeCasePrompt } from '@/core/services/prompts';
import { caseState, resetCase, saveCaseAnswer, saveCaseScore, saveCaseTime, toggleCaseDone } from '@/core/store/actions';
import { onReset, useDocs } from '@/core/store/store';
import type { AiScore } from '@/core/types';
import { clock, num, words } from '@/core/utils/format';
import { Button, Callout, Empty, Page, PageHeader, Panel, TextArea, toast } from '@/ui';
import { tick } from '../layout/studyTimer';
import { ANSWER_TEMPLATE, CASE_SECONDS, SECONDS_PER_CASE_QUESTION, getCase } from './model';
import '@/styles/reading.css';
import './cases.css';

/** Cronómetro del supuesto: acumula tiempo total y por pregunta (la que tiene el foco). */
const clockState = signal<{ id: string; since: number; base: number; qt: number[]; focus: number } | null>(null);
function stopClock() {
  const c = clockState.value; if (!c) return;
  saveCaseTime(c.id, c.base + (Date.now() - c.since) / 1000, c.qt);
  clockState.value = null;
}
/**
 * Al salir del supuesto con el reloj en marcha, el tiempo se guarda y el reloj se pausa (no cuenta mientras
 * estás en otra sección). Al volver a ese mismo supuesto, se reanuda solo.
 */
let resumeOnReturn: string | null = null;
function leaveCase(id: string) {
  if (clockState.value?.id === id) { resumeOnReturn = id; stopClock(); }
}
setInterval(() => {
  const c = clockState.value; if (!c) return;
  if (c.focus >= 0) c.qt[c.focus] = (c.qt[c.focus] ?? 0) + 1;
  if (c.base + (Date.now() - c.since) / 1000 >= CASE_SECONDS) { stopClock(); toast('Se acabaron los 180 minutos'); }
}, 1000);
addEventListener('beforeunload', stopClock);
/** Al borrar o importar datos, el cronómetro se descarta sin guardar. */
onReset(() => { clockState.value = null; resumeOnReturn = null; });

function ScoreView({ s }: { s: AiScore }) {
  const rows: [string, number, number][] = [['Aplicación técnica', s.technical, 30], ['Capacidad de análisis', s.analysis, 10], ['Sistemática', s.systematic, 5], ['Expresión escrita', s.expression, 5]];
  return <div class="u-stack">
    <h3 style={{ fontSize: 'var(--text-lg)' }}>Corrección orientativa: {num(s.total)} / 50</h3>
    <div class="x-score">{rows.map(([l, v, m]) => <><span>{l}</span><div class="c-meter"><span style={{ width: `${(100 * v) / m}%`, background: 'var(--accent)' }} /></div><strong class="u-num">{num(v)} / {m}</strong></>)}</div>
    {s.summary && <p style={{ margin: 0 }}>{s.summary}</p>}
    {s.questions?.map((q, k) => <details class="c-panel c-panel--sunken"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Pregunta {k + 1}</summary><p class="u-small"><strong>Bien:</strong> {q.strengths}</p><p class="u-small" style={{ margin: 0 }}><strong>A mejorar:</strong> {q.improvements}</p></details>)}
    <p class="u-muted u-small" style={{ margin: 0 }}>Es una estimación para orientarte, no la nota del tribunal.</p>
  </div>;
}

export function CasePage({ id }: { id: string }) {
  useDocs(); void tick.value;
  const c = getCase(id);
  const [showGuide, setShowGuide] = useState(false); const [grading, setGrading] = useState(false); const [error, setError] = useState('');
  const guideRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (resumeOnReturn === id) {
      resumeOnReturn = null;
      const st0 = caseState(id);
      if (st0.st !== 2) clockState.value = { id, since: Date.now(), base: st0.t, qt: [...(st0.qt ?? [0, 0, 0, 0, 0])], focus: -1 };
    }
    return () => leaveCase(id);
  }, [id]);
  useEffect(() => { setShowGuide(false); setError(''); }, [id]);
  if (!c) return <Empty title="Supuesto no encontrado" action={<Button href="#supuestos">Ver supuestos</Button>}>Si lo creaste en otro dispositivo, espera a que se sincronice.</Empty>;

  const st = caseState(id), running = clockState.value?.id === id;
  const used = running ? clockState.value!.base + (Date.now() - clockState.value!.since) / 1000 : st.t;
  const qt = running ? clockState.value!.qt : st.qt ?? [0, 0, 0, 0, 0];
  const toggleClock = () => { if (running) stopClock(); else { stopClock(); clockState.value = { id, since: Date.now(), base: st.t, qt: [...(st.qt ?? [0, 0, 0, 0, 0])], focus: -1 }; } };
  const setFocus = (k: number) => { if (clockState.value?.id === id) clockState.value.focus = k; };

  const grade = async () => {
    if (st.a.join('').trim().length < 200) return toast('Escribe tus respuestas antes de pedir la corrección');
    setGrading(true); setError('');
    try {
      const r = await askJSON<AiScore>(gradeCasePrompt(c.statement, c.questions, st.a, c.guideText));
      const cap = (v: unknown, m: number) => Math.min(m, Math.max(0, Number(v) || 0));
      const score: AiScore = { ...r, technical: cap(r.technical, 30), analysis: cap(r.analysis, 10), systematic: cap(r.systematic, 5), expression: cap(r.expression, 5), total: 0 };
      score.total = Math.round((score.technical + score.analysis + score.systematic + score.expression) * 10) / 10;
      saveCaseScore(id, score);
    } catch (e) { setError(aiErrorMessage(e)); }
    setGrading(false);
  };
  const openGuide = async () => {
    if (st.st !== 2 && !(await confirmDialog({ title: '¿Ver la solución?', message: 'Aún no has marcado el supuesto como terminado. Si ves la guía ahora, ya no podrás practicarlo sin conocer la respuesta.', confirm: 'Verla igualmente' }))) return;
    setShowGuide(true); setTimeout(() => guideRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <Page>
      <PageHeader compact crumbs={[{ label: 'Supuestos', href: '#supuestos' }, { label: c.group }]} title={c.title} />
      <Panel>
        <div class="x-timer">
          <div><div class="u-muted u-small">Tiempo restante</div><div class={`x-timer__value ${CASE_SECONDS - used < 900 ? 'is-low' : ''}`}>{clock(CASE_SECONDS - used)}</div></div>
          <div class="u-row"><Button variant={running ? 'secondary' : 'primary'} icon={running ? 'pause' : 'play'} onClick={toggleClock}>{running ? 'Pausar' : st.t ? 'Continuar' : 'Empezar 180 minutos'}</Button>
            <Button variant="ghost" icon="repeat" onClick={async () => { if (await confirmDialog({ title: 'Reiniciar el supuesto', message: 'Se borrarán tus respuestas, el tiempo y la corrección de este supuesto.', confirm: 'Reiniciar', danger: true })) { stopClock(); resetCase(id); } }}>Reiniciar</Button></div>
        </div>
      </Panel>
      <Panel title="Enunciado"><div class="x-statement">{c.statement.split(/\n\n+/).map(p => <p>{p}</p>)}</div></Panel>
      {c.checklist.length > 0 && <details class="c-panel"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Comprobaciones antes de escribir</summary><ul style={{ marginBottom: 0 }}>{c.checklist.map(x => <li>{x}</li>)}</ul></details>}
      {c.questions.map((q, k) => (
        <Panel>
          <div class="x-q__head"><span class="x-q__num">{k + 1}</span><p style={{ margin: 0 }}>{q}</p></div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <TextArea rows={10} aria-label={`Respuesta a la pregunta ${k + 1}`} value={st.a[k] ?? ''} onFocus={() => setFocus(k)} onBlur={() => setFocus(-1)} onInput={e => saveCaseAnswer(id, k, (e.target as HTMLTextAreaElement).value)} />
          </div>
          <div class="x-q__foot">
            <span>{words(st.a[k])} palabras. <button class="c-btn c-btn--ghost c-btn--sm" onClick={() => saveCaseAnswer(id, k, (st.a[k]?.trim() ? st.a[k] + '\n\n' : '') + ANSWER_TEMPLATE)}>Insertar estructura</button></span>
            <span class={qt[k] > SECONDS_PER_CASE_QUESTION ? 'u-num' : 'u-num'} style={{ color: qt[k] > SECONDS_PER_CASE_QUESTION ? 'var(--bad)' : undefined }}>Tiempo en esta pregunta: {clock(qt[k] ?? 0)} de 35:00</span>
          </div>
        </Panel>
      ))}
      <Panel title="Al terminar">
        <div class="u-row">
          <Button icon="check" onClick={() => { stopClock(); toggleCaseDone(id); }}>{st.st === 2 ? 'Marcar como en curso' : 'Marcar como terminado'}</Button>
          <Button onClick={openGuide}>{c.kind === 'inap' ? 'Ver criterios oficiales' : c.kind === 'ai' ? 'Ver guía de corrección' : 'Ver solucionario'}</Button>
          {aiStatus.value !== 'off' && <Button variant="primary" icon="spark" disabled={grading} onClick={grade}>{grading ? 'Corrigiendo… (hasta 2 min)' : 'Corregir con IA'}</Button>}
        </div>
        {error && <div style={{ marginTop: 'var(--space-3)' }}><Callout tone="bad">{error}</Callout></div>}
        {st.ai && <div style={{ marginTop: 'var(--space-5)' }}><ScoreView s={st.ai} /></div>}
      </Panel>
      {showGuide && <div ref={guideRef}><Panel title={c.kind === 'inap' ? 'Criterios oficiales de corrección' : c.kind === 'ai' ? 'Guía de corrección' : 'Solucionario y guía de corrección'} subtitle={c.kind === 'inap' ? 'El INAP publica los criterios generales, no una solución. Para una valoración de tus respuestas usa «Corregir con IA».' : undefined}>
        {c.guideHtml ? <div class="reading" style={{ maxWidth: 'none' }} dangerouslySetInnerHTML={{ __html: c.guideHtml }} /> : <div class="x-statement">{c.guideText.split(/\n\n+/).map(p => <p>{p}</p>)}</div>}
      </Panel></div>}
    </Page>
  );
}
