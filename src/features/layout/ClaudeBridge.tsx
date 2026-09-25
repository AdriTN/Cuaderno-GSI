import { useEffect, useState } from 'preact/hooks';
import { AiError, manualRequest } from '@/core/services/ai';
import { Button, Field, Modal, TextArea, toast } from '@/ui';

/**
 * Puente con claude.ai para usar la suscripción fuera de Claude: la app prepara la consulta,
 * tú la pegas en Claude y traes la respuesta. La app la procesa igual que una respuesta automática.
 */
export function ClaudeBridge() {
  const r = manualRequest.value;
  const [answer, setAnswer] = useState(''), [copied, setCopied] = useState(false), [error, setError] = useState('');
  useEffect(() => { setAnswer(''); setCopied(false); setError(''); }, [r]);
  const close = () => { r?.reject(new AiError('Consulta cancelada.', 'cancelled')); manualRequest.value = null; };
  const copy = async () => {
    try { await navigator.clipboard.writeText(r!.prompt); setCopied(true); }
    catch { setError('No se pudo copiar automáticamente: selecciona el texto de la consulta y cópialo a mano.'); }
  };
  const use = () => {
    const t = answer.trim(); if (!t) return;
    if (r!.json && !/[[{]/.test(t)) { setError('Esta respuesta debería contener datos entre llaves o corchetes. Copia la respuesta completa de Claude.'); return; }
    r!.resolve(t); manualRequest.value = null; toast('Respuesta aplicada');
  };
  return (
    <Modal open={!!r} title="Usar tu suscripción de Claude" onClose={close}
      actions={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button variant="primary" icon="check" disabled={!answer.trim()} onClick={use}>Usar esta respuesta</Button></>}>
      <ol class="cb-steps">
        <li><div><strong>Copia la consulta</strong><span class="u-muted u-small"> que ha preparado la app.</span></div><Button size="sm" variant={copied ? 'secondary' : 'primary'} icon={copied ? 'check' : 'download'} onClick={copy}>{copied ? 'Copiada' : 'Copiar consulta'}</Button></li>
        <li><div><strong>Pégala en un chat nuevo de Claude</strong><span class="u-muted u-small"> y espera la respuesta.</span></div><Button size="sm" href="https://claude.ai/new" target="_blank" rel="noopener" onClick={() => { if (!copied) void copy(); }}>Abrir Claude</Button></li>
        <li><div><strong>Copia la respuesta de Claude</strong><span class="u-muted u-small"> (botón copiar bajo su mensaje) y pégala aquí.</span></div></li>
      </ol>
      <Field label="Respuesta de Claude"><TextArea value={answer} onInput={e => setAnswer((e.target as HTMLTextAreaElement).value)} style={{ minHeight: 120 }} placeholder="Pega aquí la respuesta completa" /></Field>
      {error && <p class="u-small" style={{ color: 'var(--bad)', margin: 0 }}>{error}</p>}
      <details><summary class="u-small u-muted" style={{ cursor: 'pointer' }}>Ver la consulta</summary><pre class="cb-prompt">{r?.prompt}</pre></details>
    </Modal>
  );
}
