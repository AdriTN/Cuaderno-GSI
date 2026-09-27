/**
 * Conexiones de IA con la suscripción, guardadas SOLO en este navegador (no se sincronizan ni se exportan):
 *  - puente: el programa del PC que usa Claude Code (dirección + código de emparejamiento).
 *  - agente: repositorio privado de GitHub con el workflow de IA (usuario, repositorio y token).
 *    Con `sync`, ese mismo repositorio guarda también tu progreso para compartirlo entre dispositivos.
 */
import { signal } from '@preact/signals';

export type Connections = { bridge: { url: string; token: string }; agent: { owner: string; repo: string; token: string; sync?: boolean } };
const KEY = 'cuaderno-gsi-conexiones';
export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:47821';
const empty = (): Connections => ({ bridge: { url: DEFAULT_BRIDGE_URL, token: '' }, agent: { owner: '', repo: 'cuaderno-gsi-agente', token: '' } });

function load(): Connections {
  try { const c = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return c ? { bridge: { ...empty().bridge, ...c.bridge }, agent: { ...empty().agent, ...c.agent } } : empty(); }
  catch { return empty(); }
}
export const connections = signal<Connections>(load());
export function saveConnections(c: Connections) { connections.value = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* */ } }
/**
 * Se borran solo con «Borrar todo» (no al importar una copia): si no, importar en un dispositivo
 * sincronizado desactivaría la sincronización sin avisar y la copia no llegaría a los demás.
 */
export function clearConnections() { try { localStorage.removeItem(KEY); } catch { /* */ } connections.value = empty(); }

export const bridgeConfigured = () => !!connections.value.bridge.token;
export const agentConfigured = () => { const a = connections.value.agent; return !!(a.owner && a.repo && a.token); };
export const githubSyncEnabled = () => agentConfigured() && !!connections.value.agent.sync;
