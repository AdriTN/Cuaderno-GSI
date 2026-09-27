/**
 * Almacén de documentos en el repositorio PRIVADO del agente: un archivo sync/<documento>.json por documento,
 * leído y escrito con la API de contenidos de GitHub y el mismo token que usa el agente (Contents: Read and write).
 * Gratis, sin cuentas nuevas, y los datos no salen de tu cuenta de GitHub.
 */
import { AgentError, fromB64, gh, toB64 } from './agent';

const DIR = 'sync';
/** sha de la última versión conocida de cada archivo: GitHub lo exige para sobrescribir. */
const shas = new Map<string, string>();

export async function githubGet(key: string): Promise<any | null> {
  const r = await gh(`/contents/${DIR}/${key}.json?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) { shas.delete(key); return null; }
  if (!r.ok) throw new AgentError(`GitHub respondió ${r.status} al leer tu progreso.`, 'sync');
  const f = await r.json();
  shas.set(key, f.sha);
  return JSON.parse(fromB64(f.content));
}

/**
 * Sube un documento. Si otro dispositivo lo cambió desde la última lectura (sha distinto), NO se sobrescribe:
 * se lanza un error «conflict» para que el sincronizador vuelva a leerlo y fusione antes de subir.
 * Con `urgent` (al salir de la app) se usa keepalive, que el navegador completa aunque se cierre la página
 * (solo admite cuerpos pequeños; los grandes se envían igual, sin esa garantía).
 */
export async function githubSet(key: string, value: unknown, urgent = false): Promise<void> {
  const body = JSON.stringify({ message: `Progreso: ${key}`, content: toB64(JSON.stringify(value)), ...(shas.has(key) ? { sha: shas.get(key) } : {}) });
  const r = await gh(`/contents/${DIR}/${key}.json`, { method: 'PUT', body, keepalive: urgent && body.length < 60_000 });
  if (r.status === 409 || r.status === 422) { shas.delete(key); throw new AgentError('Otro dispositivo acaba de guardar cambios.', 'conflict'); }
  if (!r.ok) throw new AgentError(`GitHub respondió ${r.status} al guardar tu progreso.`, String(r.status));
  shas.set(key, (await r.json()).content.sha);
}

export const forgetGithubShas = () => shas.clear();
