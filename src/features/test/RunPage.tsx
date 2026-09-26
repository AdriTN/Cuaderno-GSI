import { confirmDialog } from '@/ui';
import { useEffect } from 'preact/hooks';
import { LETTERS, ORIGIN_LABEL, topicById, topicCode } from '@/core/content';
import { clock, truncate } from '@/core/utils/format';
import { Button, Empty, Kbd, Page, Tag } from '@/ui';
import { tick } from '../layout/studyTimer';
import { ExplainButton, FlagButton } from './QuestionTools';
import { abandon, choose, finish, goTo, next, session, toggleDoubt, toggleFlag } from './session';
import './test.css';

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = session.value;
      if (!s || s.done || (e.target as HTMLElement).matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase(); const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      if (k in map) { e.preventDefault(); choose(map[k]); }
      else if (k === 'x') { e.preventDefault(); toggleDoubt(); }
      else if ((k === 'enter' || k === 'arrowright') && (s.mode === 'exam' || s.revealed[s.i])) { e.preventDefault(); next(); }
      else if (k === 'arrowleft' && s.mode === 'exam') goTo(s.i - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

function Countdown() {
  void tick.value;
  const s = session.value!; const left = s.limit - (Date.now() - s.startedAt) / 1000;
  useEffect(() => { if (left <= 0 && !s.done) finish(); }, [left <= 0]);
  return <span class={`t-timer ${left < 300 ? 't-timer--low' : ''}`} aria-label="Tiempo restante">{clock(left)}</span>;
}

export function RunPage() {
  useKeyboard();
  const s = session.value;
  if (!s || s.done) return <Empty title="No hay ningún test en marcha" action={<Button variant="primary" href="#entrenamiento">Ir a entrenamiento</Button>} />;
  const q = s.qs[s.i], a = s.ans[s.i], revealed = s.mode === 'practice' && s.revealed[s.i];
  const answered = s.ans.filter(x => x !== -2).length;
  const progress = s.mode === 'practice' ? s.i + (revealed ? 1 : 0) : answered;
  const optClass = (k: number) => revealed ? (k === q.c ? 't-opt--right' : k === a ? 't-opt--wrong' : '') : k === a ? 't-opt--selected' : '';
  const right = a === q.c;

  return (
    <Page class="t-run">
      <div class="t-top"><span class="t-top__label">{s.label}</span><span class="u-row">{s.limit > 0 && <Countdown />}<span class="u-muted">Pregunta {s.i + 1} de {s.qs.length}</span></span></div>
      <div class="t-progress" role="progressbar" aria-valuenow={progress} aria-valuemax={s.qs.length}><span style={{ width: `${(100 * progress) / s.qs.length}%` }} /></div>
      <div class="t-meta"><Tag tone={q.o === 'O' ? 'ok' : q.o === 'P' ? 'accent' : q.o === 'I' ? 'warn' : 'neutral'}>{ORIGIN_LABEL[q.o]}{q.e ? ` ${q.e}` : ''}</Tag><span>{topicCode(q.t)}. {truncate(topicById[q.t].title, 90)}</span></div>
      <p class="t-question">{q.s}</p>
      {!revealed && <button class="t-doubt" aria-pressed={s.doubt[s.i]} onClick={toggleDoubt} title="Tecla X">{s.doubt[s.i] ? 'Marcada con duda' : '¿Dudas? Márcalo antes de responder'}</button>}
      <div class="t-options" role="group" aria-label="Opciones">
        {q.a.map((txt, k) => <button class={`t-opt ${optClass(k)}`} disabled={revealed} onClick={() => choose(k)}><span class="t-opt__key">{LETTERS[k]}</span><span>{txt}</span></button>)}
      </div>
      {revealed && (
        <div class={`t-feedback ${a === -1 ? '' : right ? 't-feedback--right' : 't-feedback--wrong'} u-enter`}>
          <h3>{a === -1 ? 'En blanco' : right ? 'Correcto' : `Incorrecto: es la ${LETTERS[q.c]}`}{s.doubt[s.i] && a >= 0 && <span class="u-muted u-small"> (con duda)</span>}</h3>
          <p style={{ margin: 0 }}>{q.f}</p>
          {(q.p || q.e) && <p class="u-muted u-small" style={{ margin: 0 }}>Procedencia: {q.p ?? `Examen oficial INAP ${q.e}, pregunta ${q.n}`}</p>}
          <div class="u-row"><Button size="sm" variant="ghost" href={`#tema/${q.t}`}>Ir al tema</Button><FlagButton id={q.i} /><ExplainButton q={q} answer={a} /></div>
        </div>
      )}
      {s.mode === 'exam' && (
        <details><summary class="u-muted" style={{ cursor: 'pointer' }}>Mapa de preguntas ({answered} respondidas)</summary>
          <div class="t-grid">{s.qs.map((_, k) => <button class={[s.ans[k] >= 0 && 'is-answered', s.flag[k] && 'is-flagged', k === s.i && 'is-current'].filter(Boolean).join(' ')} onClick={() => goTo(k)} aria-label={`Pregunta ${k + 1}`}>{k + 1}</button>)}</div>
        </details>
      )}
      <div class="t-footer">
        {s.mode === 'practice' ? <>
          <Button variant="ghost" onClick={() => (s.revealed.some(Boolean) ? finish(true) : abandon())}>Terminar</Button>
          {revealed ? <Button variant="primary" icon="right" onClick={next}>{s.i === s.qs.length - 1 ? 'Ver resultado' : 'Siguiente'}</Button> : <Button onClick={() => choose(-1)}>No lo sé</Button>}
        </> : <>
          <div class="u-row"><Button icon="left" iconOnly aria-label="Anterior" disabled={!s.i} onClick={() => goTo(s.i - 1)} /><Button variant="ghost" icon="flag" onClick={toggleFlag}>{s.flag[s.i] ? 'Quitar marca' : 'Marcar'}</Button>{a >= 0 && <Button variant="ghost" onClick={() => choose(-2)}>Dejar en blanco</Button>}</div>
          <div class="u-row"><Button icon="right" iconOnly aria-label="Siguiente" disabled={s.i === s.qs.length - 1} onClick={() => goTo(s.i + 1)} /><Button variant="primary" onClick={async () => { const bl = s.ans.filter(x => x < 0).length, fl = s.flag.filter(Boolean).length; if (await confirmDialog({ title: '¿Entregar el examen?', message: [bl && `${bl} preguntas quedarán en blanco.`, fl && `Tienes ${fl} marcadas para revisar.`].filter(Boolean).join('\n') || 'Has respondido todas las preguntas.', confirm: 'Entregar' })) finish(); }}>Entregar</Button></div>
        </>}
      </div>
      <p class="u-muted u-small" style={{ margin: 0 }}>Teclado: <Kbd>A</Kbd>–<Kbd>D</Kbd> responder, <Kbd>X</Kbd> dudo, <Kbd>Enter</Kbd> siguiente.</p>
    </Page>
  );
}
