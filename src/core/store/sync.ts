import { signal } from '@preact/signals';
import type { DocKey } from '../types';
import { useCapability } from '../services/platform';
import { connections, githubSyncEnabled, saveConnections } from '../services/connections';
import { forgetGithubShas, githubGet, githubSet } from '../services/githubStore';
import { mergeDoc } from '../domain/merge';
import { DOC_KEYS } from './defaults';
import { dirtyDocs, docs, emitReset, onCommit, replaceDoc } from './store';

/**
 * Sincronización del progreso entre dispositivos, con dos almacenes posibles:
 *  - claude: la base de datos del artifact, cuando la app se abre dentro de Claude (con tu cuenta).
 *  - github: el repositorio privado del agente, en la versión web, si lo activas en Ajustes → Tus datos.
 * Reglas (iguales para los dos): un borrado o importación posterior («época» más reciente) gana siempre;
 * dentro de la misma época gana la modificación más reciente de cada documento.
 */
export type SyncState = 'local' | 'ok' | 'error';
export type SyncBackend = 'claude' | 'github';
export const syncState = signal<SyncState>('local');
export const syncMessage = signal('');
export const syncBackend = signal<SyncBackend | null>(null);
export const lastSync = signal<number | null>(null);

interface Remote { get(k: DocKey): Promise<any | null>; set(k: DocKey, v: unknown, urgent?: boolean): Promise<void>; delay: number }

const MAX_DOC_BYTES = 250_000;
let remote: Remote | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;
let listening = false;
const afterPull: (() => void)[] = [];
/** Tras traer datos de la nube (p. ej. para completar el plan si faltaba). */
export const onPulled = (fn: () => void) => { afterPull.push(fn); };

/**
 * Versión de cada documento en la última sincronización (su marca `u`). Sirve para saber quién ha cambiado desde
 * entonces: si cambiaron los dos lados, se fusionan (domain/merge.ts) en vez de quedarse solo con el más reciente.
 * Se guarda en el navegador, aparte de los datos, y por almacén.
 */
let base: Partial<Record<DocKey, number>> = {};
const baseKey = () => `cuaderno-gsi-sync-base:${syncBackend.value}`;
function loadBase() { try { base = JSON.parse(localStorage.getItem(baseKey()) ?? '{}') ?? {}; } catch { base = {}; } }
function setBase(k: DocKey, u: number) { base[k] = u; try { localStorage.setItem(baseKey(), JSON.stringify(base)); } catch { /* */ } }

const claudeRemote = (ref: any): Remote => ({
  delay: 1200,
  async get(k) { const snap = await ref.doc(k).get(); return snap.exists ? JSON.parse(JSON.stringify(snap.data())) : null; },
  async set(k, v) { await ref.doc(k).set(v); },
});
/** Cada guardado en GitHub es un commit: se agrupan los cambios de 10 s (y se sube en cuanto sales de la app). */
const githubRemote = (): Remote => ({ delay: 10_000, get: k => githubGet(k), set: (k, v, urgent) => githubSet(k, v, urgent) });

/** Si otro dispositivo borró o importó después (época más reciente), sus datos sustituyen a los locales. */
function adoptNewerEpoch(remotes: [DocKey, any][]) {
  const stale = remotes.filter(([k, r]) => (r?.e ?? 0) > (docs[k].e ?? 0));
  if (!stale.length) return false;
  emitReset();
  for (const [k, r] of stale) { dirtyDocs.delete(k); replaceDoc(k, r); setBase(k, r.u ?? 0); }
  return true;
}

/** Remoto de la misma época que cambió desde la última sincronización y también en local: se fusionan en local. */
function mergeIfBothChanged(k: DocKey, r: any): boolean {
  if (!r || (r.e ?? 0) !== (docs[k].e ?? 0)) return false;
  const remoteU = r.u ?? 0, localU = docs[k].u ?? 0, b = base[k] ?? 0;
  if (remoteU <= b || remoteU === localU || localU <= b) return false;
  replaceDoc(k, mergeDoc(k, docs[k] as any, r), true);
  return true;
}

function fail(msg: string) { syncState.value = 'error'; syncMessage.value = msg; }
function ok() { syncState.value = 'ok'; syncMessage.value = ''; lastSync.value = Date.now(); }

async function doFlush(urgent = false) {
  if (!remote) return;
  let merged = false;
  for (const k of [...dirtyDocs]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Antes de subir: ¿hubo un borrado posterior en otro dispositivo, o cambios que haya que fusionar?
      try {
        const r = await remote.get(k);
        if (r && adoptNewerEpoch([[k, r]])) { afterPull.forEach(fn => fn()); break; }
        if (mergeIfBothChanged(k, r)) merged = true;
      } catch { /* sin conexión: se intenta subir igualmente y, si falla, queda pendiente */ }
      if (!dirtyDocs.has(k)) break;
      const body = JSON.stringify(docs[k]);
      if (body.length > MAX_DOC_BYTES) { fail(`Hay demasiados datos en «${k}» para sincronizar. Exporta una copia y reduce notas, tarjetas o supuestos.`); return; }
      dirtyDocs.delete(k);
      try { await remote.set(k, JSON.parse(body), urgent); setBase(k, docs[k].u ?? 0); break; }
      catch (e: any) {
        dirtyDocs.add(k);
        if (e?.code === 'conflict' && attempt === 0) continue;   // otro dispositivo subió justo ahora: volver a leer y fusionar
        fail(`No se pudo sincronizar (${e?.code ?? e?.message ?? 'error'}). Tus datos siguen guardados en este dispositivo.`); return;
      }
    }
  }
  if (merged) afterPull.forEach(fn => fn());
  ok();
}
/** Sube lo pendiente; nunca dos subidas a la vez (en GitHub se pisarían las versiones). */
export function flush(urgent = false): Promise<void> {
  clearTimeout(timer);
  const run = () => doFlush(urgent);
  flushing = (flushing ?? Promise.resolve()).then(run, run).finally(() => { flushing = null; });
  return flushing;
}

/** Trae de la nube lo que cambió en otros dispositivos, fusiona si cambió en los dos lados y sube lo local. */
export async function pull(): Promise<boolean> {
  if (!remote) return false;
  let changed = false;
  const remotes: [DocKey, any][] = [];
  try {
    for (const k of DOC_KEYS as DocKey[]) remotes.push([k, await remote.get(k)]);
  } catch { fail('No se pudo leer tu progreso en la nube.'); return false; }
  // 1) Un borrado o importación hecho en otro dispositivo gana siempre, aunque aquí haya cambios sin subir.
  if (adoptNewerEpoch(remotes.filter(([, r]) => r))) changed = true;
  // 2) Misma época: lo que solo cambió en un lado se copia al otro; lo que cambió en los dos, se fusiona.
  for (const [k, r] of remotes) {
    const localU = docs[k].u || 0, b = base[k] ?? 0;
    if (r && (r.e ?? 0) === (docs[k].e ?? 0)) {
      const remoteU = r.u || 0;
      if (mergeIfBothChanged(k, r)) changed = true;
      else if (remoteU > localU && localU <= b) { dirtyDocs.delete(k); replaceDoc(k, r); setBase(k, remoteU); changed = true; }
      else if (remoteU > localU && !dirtyDocs.has(k)) { replaceDoc(k, r); setBase(k, remoteU); changed = true; }
      else if (localU > remoteU) dirtyDocs.add(k);
      else setBase(k, remoteU);
    } else if (!r && localU) dirtyDocs.add(k);
    else if (r && (docs[k].e ?? 0) > (r.e ?? 0)) dirtyDocs.add(k);
  }
  if (dirtyDocs.size) await flush(); else ok();
  if (changed) afterPull.forEach(fn => fn());
  return changed;
}

function listen() {
  if (listening) return;
  listening = true;
  onCommit(() => { if (!remote) return; clearTimeout(timer); timer = setTimeout(flush, remote.delay); });
  // Al pasar a segundo plano (cambiar de app, bloquear el móvil, cerrar la pestaña) se sube en el acto,
  // con peticiones que el navegador completa aunque la página se cierre.
  document.addEventListener('visibilitychange', () => { if (!remote) return; if (document.visibilityState === 'visible') void pull(); else if (dirtyDocs.size) void flush(true); });
  addEventListener('pagehide', () => { if (remote && dirtyDocs.size) void flush(true); });
}

export async function initSync() {
  const [db, user] = await Promise.all([useCapability('db'), useCapability('user')]);
  const id = db && user ? await user.id().catch(() => null) : null;
  if (db && id) { remote = claudeRemote(db.collection('data/users/' + id)); syncBackend.value = 'claude'; }
  else if (githubSyncEnabled()) { remote = githubRemote(); syncBackend.value = 'github'; }
  else return;
  loadBase();
  listen();
  await pull();
}

/* ---------------------------------------------------------------- GitHub: activar y desactivar */

/** Hay progreso real (no solo el plan que se genera al abrir la app por primera vez). */
export function hasProgress(d: Partial<Record<DocKey, any>>) {
  const c = d.core;
  return !!(c && (c.hist?.length || Object.keys(c.topics ?? {}).length || Object.keys(c.time ?? {}).length || Object.keys(c.ownExams ?? {}).length))
    || !!d.misc?.cur
    || (['srs', 'notes', 'cases', 'cards', 'gen'] as DocKey[]).some(k => { const x = d[k]; return x && Object.values(x).some(v => v && typeof v === 'object' && Object.keys(v).length); });
}

/** Lee lo que hay guardado en GitHub, sin cambiar nada, para decidir cómo empezar. */
export async function peekGithub(): Promise<{ data: Partial<Record<DocKey, any>>; progress: boolean; updated: number }> {
  forgetGithubShas();
  const data: Partial<Record<DocKey, any>> = {};
  for (const k of DOC_KEYS as DocKey[]) data[k] = await githubGet(k);
  const updated = Math.max(0, ...Object.values(data).map(x => x?.u ?? 0));
  return { data, progress: hasProgress(data), updated };
}

/**
 * Activa la sincronización con GitHub. Si los dos lados tienen progreso, decides tú:
 *  - 'remote': este dispositivo adopta lo que hay en GitHub.
 *  - 'local': lo de este dispositivo sustituye a lo de GitHub (y, al abrirla, a los demás dispositivos).
 *  - 'merge': cuando solo uno de los lados tiene datos, se combinan con las reglas normales.
 */
export async function startGithubSync(mode: 'remote' | 'local' | 'merge', peek?: Awaited<ReturnType<typeof peekGithub>>) {
  saveConnections({ ...connections.value, agent: { ...connections.value.agent, sync: true } });
  remote = githubRemote(); syncBackend.value = 'github';
  base = {}; try { localStorage.removeItem(baseKey()); } catch { /* */ }
  listen();
  if (mode === 'remote' && peek) {
    emitReset();
    for (const k of DOC_KEYS as DocKey[]) if (peek.data[k]) { dirtyDocs.delete(k); replaceDoc(k, peek.data[k]); setBase(k, peek.data[k].u ?? 0); }
    afterPull.forEach(fn => fn());
    await pull();
  } else if (mode === 'local') {
    // Nueva «época»: los demás dispositivos adoptarán estos datos aunque tengan cambios más recientes.
    const epoch = Date.now();
    for (const k of DOC_KEYS as DocKey[]) { docs[k].e = epoch; docs[k].u = epoch; dirtyDocs.add(k); replaceDoc(k, docs[k]); }
    await flush();
  } else await pull();
}

/** Desactiva la sincronización con GitHub en este dispositivo. Con `upload = false` se corta al momento, sin subir nada. */
export async function stopGithubSync(upload = true) {
  if (upload && syncBackend.value === 'github' && dirtyDocs.size) await flush().catch(() => {});
  clearTimeout(timer);
  saveConnections({ ...connections.value, agent: { ...connections.value.agent, sync: false } });
  if (syncBackend.value === 'github') { remote = null; syncBackend.value = null; syncState.value = 'local'; syncMessage.value = ''; forgetGithubShas(); }
}
