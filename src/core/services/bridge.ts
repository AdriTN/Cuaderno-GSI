/** Cliente del puente del PC (bridge/cuaderno-bridge.mjs). */
import { connections } from './connections';

export class BridgeError extends Error { constructor(message: string, public code?: string, public network = false) { super(message); } }
export type BridgeStatus = { ok: true; version: string; claude: string | null } | { ok: false; reason: string };

const base = () => connections.value.bridge.url.replace(/\/+$/, '');
const headers = () => ({ Authorization: `Bearer ${connections.value.bridge.token}`, 'Content-Type': 'application/json' });

async function call(path: string, init: RequestInit & { timeout: number }) {
  let r: Response;
  try { r = await fetch(base() + path, { ...init, headers: headers(), signal: AbortSignal.timeout(init.timeout) }); }
  catch { throw new BridgeError('El puente no está abierto en este equipo.', 'offline', true); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new BridgeError(body.error || `El puente respondió ${r.status}.`, body.code || (r.status === 401 ? 'auth' : r.status === 403 ? 'origin' : undefined));
  return body;
}

let cache: { at: number; value: BridgeStatus } | null = null;
/** Comprueba (con caché de 30 s) si el puente responde; así el orden puente → agente no retrasa cada consulta. */
export async function bridgeStatus(force = false): Promise<BridgeStatus> {
  if (!connections.value.bridge.token) return { ok: false, reason: 'Sin configurar' };
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.value;
  let value: BridgeStatus;
  try { const s = await call('/v1/estado', { method: 'GET', timeout: 2500 }); value = { ok: true, version: s.version, claude: s.claude }; }
  catch (e: any) { value = { ok: false, reason: e.message }; }
  cache = { at: Date.now(), value };
  return value;
}
export const forgetBridgeStatus = () => { cache = null; };

export async function bridgeAsk(prompt: string): Promise<string> {
  const r = await call('/v1/consulta', { method: 'POST', body: JSON.stringify({ prompt }), timeout: 6 * 60 * 1000 });
  return String(r.text ?? '');
}
export const bridgeUsage = () => call('/v1/uso', { method: 'GET', timeout: 12000 });
