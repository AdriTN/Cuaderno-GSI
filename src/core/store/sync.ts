import { signal } from '@preact/signals';
import type { DocKey } from '../types';
import { useCapability } from '../services/platform';
import { DOC_KEYS } from './defaults';
import { dirtyDocs, docs, emitReset, onCommit, replaceDoc } from './store';

export type SyncState = 'local' | 'ok' | 'error';
export const syncState = signal<SyncState>('local');
export const syncMessage = signal('');

const MAX_DOC_BYTES = 250_000;
let ref: any = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const afterPull: (() => void)[] = [];
/** Tras traer datos de la nube (p. ej. para completar el plan si faltaba). */
export const onPulled = (fn: () => void) => { afterPull.push(fn); };

/** Si otro dispositivo borró o importó después (época más reciente), sus datos sustituyen a los locales. */
function adoptNewerEpoch(remotes: [DocKey, any][]) {
  const stale = remotes.filter(([k, r]) => (r?.e ?? 0) > (docs[k].e ?? 0));
  if (!stale.length) return false;
  emitReset();
  for (const [k, r] of stale) { dirtyDocs.delete(k); replaceDoc(k, r); }
  return true;
}

async function flush() {
  if (!ref) return;
  for (const k of [...dirtyDocs]) {
    // Antes de subir, comprobar que no hubo un borrado posterior en otro dispositivo.
    try {
      const snap = await ref.doc(k).get();
      if (snap.exists && adoptNewerEpoch([[k, JSON.parse(JSON.stringify(snap.data()))]])) { afterPull.forEach(fn => fn()); continue; }
    } catch { /* sin conexión: se intenta subir igualmente y, si falla, queda pendiente */ }
    if (!dirtyDocs.has(k)) continue;
    const body = JSON.stringify(docs[k]);
    if (body.length > MAX_DOC_BYTES) { fail(`Hay demasiados datos en «${k}» para sincronizar. Exporta una copia y reduce notas, tarjetas o supuestos.`); return; }
    dirtyDocs.delete(k);
    try { await ref.doc(k).set(JSON.parse(body)); }
    catch (e: any) { dirtyDocs.add(k); fail(`No se pudo sincronizar (${e?.code ?? 'error'}). Tus datos siguen guardados en este dispositivo.`); return; }
  }
  syncState.value = 'ok'; syncMessage.value = '';
}
function fail(msg: string) { syncState.value = 'error'; syncMessage.value = msg; }

/** Trae de la nube los documentos más recientes que los locales y sube los locales más nuevos. */
export async function pull(): Promise<boolean> {
  if (!ref) return false;
  let changed = false;
  const remotes: [DocKey, any][] = [];
  try {
    for (const k of DOC_KEYS as DocKey[]) { const snap = await ref.doc(k).get(); remotes.push([k, snap.exists ? JSON.parse(JSON.stringify(snap.data())) : null]); }
  } catch { fail('No se pudo leer tu progreso en la nube.'); return false; }
  // 1) Un borrado o importación hecho en otro dispositivo gana siempre, aunque aquí haya cambios sin subir.
  if (adoptNewerEpoch(remotes.filter(([, r]) => r))) changed = true;
  // 2) Mismo periodo: gana la modificación más reciente de cada documento.
  for (const [k, remote] of remotes) {
    const localU = docs[k].u || 0;
    if (remote && (remote.e ?? 0) === (docs[k].e ?? 0)) {
      if ((remote.u || 0) > localU && !dirtyDocs.has(k)) { replaceDoc(k, remote); changed = true; }
      else if (localU > (remote.u || 0)) dirtyDocs.add(k);
    } else if (!remote && localU) dirtyDocs.add(k);
    else if (remote && (docs[k].e ?? 0) > (remote.e ?? 0)) dirtyDocs.add(k);
  }
  if (dirtyDocs.size) await flush(); else syncState.value = 'ok';
  if (changed) afterPull.forEach(fn => fn());
  return changed;
}

export async function initSync() {
  const [db, user] = await Promise.all([useCapability('db'), useCapability('user')]);
  if (!db || !user) return;
  const id = await user.id().catch(() => null);
  if (!id) return;
  ref = db.collection('data/users/' + id);
  onCommit(() => { clearTimeout(timer); timer = setTimeout(flush, 1200); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); else flush(); });
  await pull();
}
