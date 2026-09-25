import { calibration } from '@/core/domain/stats';
import { num, pct } from '@/core/utils/format';
import { Panel } from '@/ui';
import './test.css';

const VERDICT = {
  blank: (n: number) => <>Tus respuestas dudosas te restan {num(-n)} netos. Con tu nivel actual, <strong>en las dudosas te conviene dejar en blanco</strong> salvo que puedas descartar dos opciones.</>,
  careful: (n: number) => <>Tus respuestas dudosas apenas suman ({num(n)} netos). Arriesga solo cuando descartes al menos una opción con seguridad.</>,
  risk: (n: number) => <>Tus respuestas dudosas te suman {num(n)} netos: <strong>arriesgar te compensa</strong>, no dejes en blanco por miedo.</>,
};

/** ¿Arriesgas bien? Compara aciertos con y sin duda y el aporte neto de las dudosas. */
export function Calibration({ sure, doubt, title = '¿Arriesgas bien?' }: { sure: [number, number]; doubt: [number, number]; title?: string }) {
  const c = calibration(sure, doubt);
  if (!c) return null;
  const nS = sure[0] + sure[1], nD = doubt[0] + doubt[1];
  return (
    <Panel title={title}>
      <dl class="t-kv">
        <dt>Aciertos en respuestas seguras</dt><dd>{nS ? `${pct(sure[0], nS)} % (${sure[0]}/${nS})` : 'sin respuestas'}</dd>
        <dt>Aciertos en respuestas con duda</dt><dd>{pct(doubt[0], nD)} % ({doubt[0]}/{nD})</dd>
        <dt>Netos que aportan las dudosas</dt><dd>{num(c.doubtNet)}</dd>
      </dl>
      <p style={{ margin: 'var(--space-3) 0 0' }}>{VERDICT[c.verdict](c.doubtNet)}</p>
    </Panel>
  );
}
