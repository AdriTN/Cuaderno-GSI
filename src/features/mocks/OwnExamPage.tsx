import { confirmDialog } from '@/ui';
import { useState } from 'preact/hooks';
import { CONTENT } from '@/core/content';
import { scoreAgainstKey } from '@/core/domain/exam';
import { saveOwnExam } from '@/core/store/actions';
import { useDocs } from '@/core/store/store';
import { num } from '@/core/utils/format';
import { Button, Callout, Field, Figures, Page, PageHeader, Panel, TextArea, toast } from '@/ui';
import './exam.css';

const KEY = CONTENT.key2025;
const TOTAL = 100;
const EMPTY = '-'.repeat(TOTAL);
/** Acepta "a b c", "1a 2b", "abcd-" …: se quedan las letras a-d y los huecos marcados con "-" o ".". */
const parseSequence = (s: string) => s.toLowerCase().replace(/\d+[.)]?/g, ' ').replace(/[^abcd.\-]/g, '').replace(/\./g, '-').slice(0, TOTAL).padEnd(TOTAL, '-');

export function OwnExamPage() {
  const docs = useDocs();
  const saved = docs.core.ownExams['2025'] ?? EMPTY;
  const [paste, setPaste] = useState('');
  const answers = saved.padEnd(TOTAL, '-');
  const score = scoreAgainstKey(answers, KEY.main);
  const filled = answers.split('').filter(a => a !== '-').length;
  const setAt = (i: number, v: string) => { const a = answers.split(''); a[i] = a[i] === v ? '-' : v; saveOwnExam('2025', a.join('')); };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Examen', href: '#examen' }, { label: 'Tu examen de 2025' }]} title="Corrige tu examen de 2025"
        lede="Pasa aquí las respuestas de tu copia de la hoja del primer ejercicio (23 de mayo de 2026). Se corrigen con la plantilla provisional del INAP y se guardan en tu cuenta." />
      <Callout tone="warn">La plantilla es <strong>provisional</strong>: tras las alegaciones pueden anularse preguntas y entrar las de reserva. El tribunal transforma los netos en la nota sobre 50 según el número de aprobados, así que esto es una estimación.</Callout>
      <Figures items={[
        { value: num(score.net), label: 'netos (aciertos menos errores entre 3)', mark: filled > 0 },
        { value: `${score.right} / ${score.wrong} / ${score.blank}`, label: 'aciertos, errores y en blanco' },
        { value: filled ? (score.net >= 30 ? 'Por encima' : 'Por debajo') : '–', label: 'del corte de 2024 (30 netos), que cambia cada año' },
      ]} />
      <Panel title="Pegar respuestas" subtitle="Si las tienes apuntadas, pega la secuencia: «a c d - b…» o «1a 2c 3d…». Usa «-» para las que dejaste en blanco.">
        <Field label="Secuencia de respuestas"><TextArea value={paste} onInput={e => setPaste((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 80 }} placeholder="dcd-cbd…" /></Field>
        <div class="u-row" style={{ marginTop: 'var(--space-3)' }}>
          <Button variant="primary" disabled={!paste.trim()} onClick={() => { saveOwnExam('2025', parseSequence(paste)); setPaste(''); toast('Respuestas cargadas'); }}>Cargar</Button>
          <Button variant="ghost" onClick={async () => { if (await confirmDialog({ title: 'Vaciar respuestas', message: 'Se borrarán todas las respuestas que has introducido de tu examen.', confirm: 'Vaciar', danger: true })) saveOwnExam('2025', EMPTY); }}>Vaciar</Button>
        </div>
      </Panel>
      <Panel title="Tus respuestas" subtitle={`${filled} de ${TOTAL} marcadas. Pulsa de nuevo una letra para dejarla en blanco. En verde, la respuesta correcta cuando fallaste.`}>
        <div class="o-grid">
          {Array.from({ length: TOTAL }, (_, i) => {
            const d = score.detail[i];
            return (
              <div class={`o-q ${d === 'right' ? 'is-right' : d === 'wrong' ? 'is-wrong' : ''}`}>
                <span class="o-q__n">{i + 1}</span>
                <span class="o-q__opts" role="group" aria-label={`Pregunta ${i + 1}`}>
                  {['a', 'b', 'c', 'd'].map(l => <button type="button" aria-pressed={answers[i] === l} onClick={() => setAt(i, l)}>{l.toUpperCase()}</button>)}
                </span>
                <span class="o-key" title="Clave provisional">{d === 'wrong' ? KEY.main[i].toUpperCase() : ''}</span>
              </div>
            );
          })}
        </div>
      </Panel>
      <p class="u-muted u-small">Las 5 de reserva (clave {KEY.reserve.toUpperCase().split('').join(', ')}) solo cuentan si se anula alguna pregunta. Los documentos originales están en la biblioteca de <a href="#examen">Examen</a>.</p>
    </Page>
  );
}
