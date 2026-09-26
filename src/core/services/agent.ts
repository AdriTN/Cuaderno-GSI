/**
 * Cliente del agente en GitHub (repositorio privado con agente/.github/workflows/ia.yml).
 * La consulta se sube como archivo a requests/, el workflow la responde en responses/ y aquí se recoge.
 */
import { connections } from './connections';

export class AgentError extends Error { constructor(message: string, public code?: string) { super(message); } }
const API = 'https://api.github.com';
const repoPath = () => { const a = connections.value.agent; return `${API}/repos/${encodeURIComponent(a.owner)}/${encodeURIComponent(a.repo)}`; };
const headers = () => ({ Authorization: `Bearer ${connections.value.agent.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
const toB64 = (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b))); return btoa(bin); };
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function gh(path: string, init: RequestInit = {}) {
  let r: Response;
  try { r = await fetch(repoPath() + path, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } }); }
  catch { throw new AgentError('Sin conexión con GitHub.', 'network'); }
  if (r.status === 401) throw new AgentError('El token de GitHub no es válido o ha caducado.', 'auth');
  if (r.status === 403) throw new AgentError('El token de GitHub no tiene permiso sobre ese repositorio (necesita «Contents: Read and write»).', 'forbidden');
  return r;
}

/** Comprueba que el repositorio existe, es PRIVADO y el token puede escribir en él. */
export async function checkAgent(): Promise<string> {
  const r = await gh('');
  if (r.status === 404) throw new AgentError('No se encuentra el repositorio. Revisa el usuario, el nombre y que el token tenga acceso a él.', 'missing');
  const repo = await r.json();
  if (!repo.private) throw new AgentError('El repositorio es público: cualquiera vería tus consultas y respuestas. Hazlo privado en Settings → General → Danger Zone.', 'public');
  if (repo.permissions && !repo.permissions.push) throw new AgentError('El token solo puede leer el repositorio; necesita permiso de escritura en «Contents».', 'forbidden');
  const wf = await gh('/contents/.github/workflows/ia.yml');
  if (wf.status === 404) throw new AgentError('Falta el workflow .github/workflows/ia.yml en el repositorio. Sube el contenido de la carpeta «agente».', 'workflow');
  return repo.full_name;
}

async function readFile(path: string): Promise<{ json: any; sha: string } | null> {
  const r = await gh(`/contents/${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new AgentError(`GitHub respondió ${r.status} al leer la respuesta.`);
  const f = await r.json();
  return { json: JSON.parse(fromB64(f.content)), sha: f.sha };
}

export type AgentProgress = (phase: 'sent' | 'waiting', elapsedMs: number) => void;
export type Cancel = { cancelled: boolean };

/** Envía una consulta al agente y espera la respuesta (normalmente 1-3 minutos). */
export async function agentAsk(prompt: string, onProgress?: AgentProgress, cancel?: Cancel): Promise<string> {
  const id = newId(), started = Date.now();
  const put = await gh(`/contents/requests/${id}.json`, { method: 'PUT', body: JSON.stringify({ message: 'Consulta de la app', content: toB64(JSON.stringify({ id, prompt, created: new Date().toISOString() })) }) });
  if (!put.ok) throw new AgentError(`No se pudo enviar la consulta a GitHub (${put.status}).`);
  onProgress?.('sent', 0);
  const deadline = started + 10 * 60 * 1000;
  let wait = 20000; // GitHub tarda en arrancar: no tiene sentido mirar antes
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, wait)); wait = 6000;
    if (cancel?.cancelled) throw new AgentError('Consulta cancelada.', 'cancelled');
    onProgress?.('waiting', Date.now() - started);
    const res = await readFile(`responses/${id}.json`);
    if (!res) continue;
    // Se borra para no dejar datos en el repositorio (si falla, el agente lo limpia en 24 h).
    gh(`/contents/responses/${id}.json`, { method: 'DELETE', body: JSON.stringify({ message: 'Respuesta recogida', sha: res.sha }) }).catch(() => {});
    if (res.json.error) throw new AgentError(res.json.error, res.json.code);
    return String(res.json.text ?? '');
  }
  throw new AgentError('El agente no ha respondido en 10 minutos. Revisa la pestaña Actions del repositorio.', 'timeout');
}

export async function agentUsage() { const f = await readFile('responses/_uso.json'); return f?.json ?? null; }
