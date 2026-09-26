import { useEffect, useState } from 'preact/hooks';
import { checkAgent } from '@/core/services/agent';
import { bridgeStatus, forgetBridgeStatus, type BridgeStatus } from '@/core/services/bridge';
import { agentConfigured, bridgeConfigured, connections, DEFAULT_BRIDGE_URL, saveConnections } from '@/core/services/connections';
import { refreshUsage, usage, usageError, usageLoading, type Window } from '@/core/services/usage';
import { Button, Callout, Field, Input, Panel, Tag, toast } from '@/ui';

/* ---------- uso de la suscripción ---------- */
const until = (iso: string | null) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ya se ha reiniciado';
  const h = Math.floor(ms / 3.6e6), m = Math.round((ms % 3.6e6) / 6e4);
  if (h >= 24) return `se reinicia el ${new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })} a las ${new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  return `se reinicia en ${h ? `${h} h ` : ''}${m} min`;
};
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };
const tone = (p: number) => (p >= 90 ? 'var(--bad)' : p >= 70 ? 'var(--warn)' : 'var(--accent)');

function UsageBar({ label, w }: { label: string; w: Window }) {
  if (!w) return <div class="ai-usage__row"><div class="u-spread"><strong>{label}</strong><span class="u-muted u-small">sin datos</span></div></div>;
  const left = Math.max(0, 100 - w.pct);
  return (
    <div class="ai-usage__row">
      <div class="u-spread"><strong>{label}</strong><span class="u-num"><strong>{Math.round(left)} %</strong> <span class="u-muted">disponible</span></span></div>
      <div class="c-meter c-meter--lg" role="img" aria-label={`${label}: ${Math.round(w.pct)} % usado`}><span style={{ width: `${Math.min(100, w.pct)}%`, background: tone(w.pct) }} /></div>
      <div class="u-muted u-small">{Math.round(w.pct)} % usado, {until(w.resetsAt)}</div>
    </div>
  );
}

export function UsagePanel() {
  const u = usage.value, configured = bridgeConfigured() || agentConfigured();
  useEffect(() => { if (configured) void refreshUsage(); }, []);
  return (
    <Panel title="Uso de tu suscripción" subtitle="Lo mismo que muestra /usage en Claude Code: la ventana de 5 horas (sesión) y la semanal."
      actions={configured && <Button size="sm" variant="ghost" icon="sync" disabled={usageLoading.value} onClick={() => refreshUsage()}>{usageLoading.value ? 'Actualizando…' : 'Actualizar'}</Button>}>
      {u ? <div class="ai-usage">
        <UsageBar label="Sesión (5 horas)" w={u.fiveHour} />
        <UsageBar label="Semana" w={u.sevenDay} />
        <p class="u-muted u-small" style={{ margin: 0 }}>Dato de tu cuenta vía {u.source === 'puente' ? 'el puente del PC' : 'el agente de GitHub'}, {ago(u.fetchedAt)}. Procede de un servicio no oficial de Anthropic: si deja de funcionar, la IA sigue funcionando, solo que sin este indicador.</p>
      </div> : <p class="u-muted" style={{ margin: 0 }}>{configured ? (usageError.value || 'Aún no hay datos: se leen al conectar el puente o tras la primera consulta del agente.') : 'Configura el puente del PC o el agente de GitHub para ver aquí cuánto uso te queda.'}</p>}
      {u && usageError.value && <p class="u-small" style={{ color: 'var(--warn)', margin: 'var(--space-2) 0 0' }}>{usageError.value}</p>}
    </Panel>
  );
}

/* ---------- puente del PC ---------- */
function BridgeCard() {
  const c = connections.value;
  const [url, setUrl] = useState(c.bridge.url), [token, setToken] = useState(c.bridge.token);
  const [status, setStatus] = useState<BridgeStatus | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { if (c.bridge.token) bridgeStatus(true).then(setStatus); }, []);
  const save = async () => {
    saveConnections({ ...connections.value, bridge: { url: url.trim() || DEFAULT_BRIDGE_URL, token: token.trim() } });
    forgetBridgeStatus(); setBusy(true);
    const s = await bridgeStatus(true); setStatus(s); setBusy(false);
    if (s.ok) { toast('Puente conectado'); void refreshUsage(); }
  };
  const origin = location.origin.startsWith('http') ? location.origin : 'https://tu-usuario.github.io';
  return (
    <div class="ai-card">
      <div class="ai-card__head"><div><span class="ai-card__step">1</span><strong>Puente en tu PC</strong><span class="u-muted u-small"> · respuestas en segundos</span></div>
        {status && (status.ok ? <Tag tone="ok">Conectado</Tag> : <Tag tone="neutral">No disponible</Tag>)}</div>
      {status?.ok && <p class="u-small u-muted" style={{ margin: 0 }}>Puente {status.version}, {status.claude ?? 'Claude Code'}.</p>}
      {status && !status.ok && c.bridge.token && <p class="u-small u-muted" style={{ margin: 0 }}>{status.reason} La app usará la siguiente vía.</p>}
      <div class="ai-card__fields">
        <Field label="Dirección"><Input value={url} onInput={e => setUrl((e.target as HTMLInputElement).value)} spellcheck={false} /></Field>
        <Field label="Código de emparejamiento"><Input type="password" value={token} autoComplete="off" onInput={e => setToken((e.target as HTMLInputElement).value)} placeholder="Lo muestra el puente al arrancar" /></Field>
      </div>
      <div class="u-row"><Button variant="primary" size="sm" icon="check" disabled={busy || !token.trim()} onClick={save}>{busy ? 'Probando…' : 'Guardar y probar'}</Button>
        {c.bridge.token && <Button size="sm" variant="ghost" onClick={() => { saveConnections({ ...connections.value, bridge: { url: DEFAULT_BRIDGE_URL, token: '' } }); setToken(''); setStatus(null); }}>Desconectar</Button>}</div>
      <details class="ai-card__help"><summary>Cómo ponerlo en marcha</summary>
        <ol>
          <li>Instala <strong>Node.js</strong> (nodejs.org) y <strong>Claude Code</strong>; abre una terminal, ejecuta <code>claude</code> e inicia sesión con tu cuenta (<code>/login</code>).</li>
          <li>En la carpeta del proyecto, abre <code>bridge\iniciar-puente.cmd</code> la primera vez con tu web: <code>node bridge\cuaderno-bridge.mjs --origen {origin}</code></li>
          <li>Copia aquí el código de emparejamiento que muestra y pulsa «Guardar y probar».</li>
          <li>Para que arranque solo con Windows: <code>node bridge\cuaderno-bridge.mjs --instalar</code></li>
        </ol>
        <p>El puente solo es accesible desde este mismo ordenador. En el móvil, la app usará el agente de GitHub.</p>
      </details>
    </div>
  );
}

/* ---------- agente de GitHub ---------- */
function AgentCard() {
  const a = connections.value.agent;
  const [owner, setOwner] = useState(a.owner), [repo, setRepo] = useState(a.repo), [token, setToken] = useState(a.token);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);
  const save = async () => {
    saveConnections({ ...connections.value, agent: { owner: owner.trim(), repo: repo.trim(), token: token.trim() } });
    setBusy(true);
    try { const name = await checkAgent(); setState({ ok: true, text: `Conectado a ${name} (privado).` }); toast('Agente conectado'); }
    catch (e: any) { setState({ ok: false, text: e.message }); }
    setBusy(false);
  };
  return (
    <div class="ai-card">
      <div class="ai-card__head"><div><span class="ai-card__step">2</span><strong>Agente en GitHub</strong><span class="u-muted u-small"> · desde cualquier sitio, 1-3 min por consulta</span></div>
        {state && (state.ok ? <Tag tone="ok">Conectado</Tag> : <Tag tone="bad">Revisar</Tag>)}</div>
      {state && <p class="u-small" style={{ margin: 0, color: state.ok ? 'var(--muted)' : 'var(--bad)' }}>{state.text}</p>}
      <div class="ai-card__fields ai-card__fields--3">
        <Field label="Usuario de GitHub"><Input value={owner} onInput={e => setOwner((e.target as HTMLInputElement).value)} spellcheck={false} /></Field>
        <Field label="Repositorio privado"><Input value={repo} onInput={e => setRepo((e.target as HTMLInputElement).value)} spellcheck={false} /></Field>
        <Field label="Token de GitHub"><Input type="password" value={token} autoComplete="off" onInput={e => setToken((e.target as HTMLInputElement).value)} placeholder="github_pat_…" /></Field>
      </div>
      <div class="u-row"><Button variant="primary" size="sm" icon="check" disabled={busy || !owner.trim() || !repo.trim() || !token.trim()} onClick={save}>{busy ? 'Comprobando…' : 'Guardar y probar'}</Button>
        {a.token && <Button size="sm" variant="ghost" onClick={() => { saveConnections({ ...connections.value, agent: { owner: '', repo: 'cuaderno-gsi-agente', token: '' } }); setToken(''); setState(null); }}>Desconectar</Button>}</div>
      <details class="ai-card__help"><summary>Cómo ponerlo en marcha</summary>
        <ol>
          <li>Crea un repositorio <strong>privado</strong> llamado <code>cuaderno-gsi-agente</code> y sube el contenido de la carpeta <code>agente</code> del proyecto.</li>
          <li>Ejecuta <code>claude setup-token</code> en tu PC y guarda el token como secreto <code>CLAUDE_CODE_OAUTH_TOKEN</code> de ese repositorio.</li>
          <li>Crea un <em>fine-grained token</em> de GitHub con acceso <strong>solo</strong> a ese repositorio y permiso <strong>Contents: Read and write</strong>, y pégalo aquí.</li>
        </ol>
        <p>La app se niega a usar un repositorio público: tus consultas nunca quedan a la vista.</p>
      </details>
    </div>
  );
}

export function SubscriptionSettings() {
  return (
    <div class="st-form">
      <p style={{ margin: 0 }}>Todo usa <strong>tu suscripción de Claude</strong>, sin API. Al pulsar un botón de IA, la app prueba por orden:</p>
      <BridgeCard />
      <AgentCard />
      <div class="ai-card ai-card--muted"><div class="ai-card__head"><div><span class="ai-card__step">3</span><strong>Copiar y pegar en Claude</strong><span class="u-muted u-small"> · siempre disponible</span></div></div>
        <p class="u-small u-muted" style={{ margin: 0 }}>Si no hay puente ni agente, la app prepara la consulta para que la pegues en claude.ai y traigas la respuesta.</p></div>
      <Callout tone="info">Las conexiones se guardan solo en este navegador: no están en la web publicada, no se sincronizan y no van en las copias exportadas.</Callout>
    </div>
  );
}
