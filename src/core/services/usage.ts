/**
 * Uso de la suscripción de Claude (ventana de 5 horas = «sesión», y ventana semanal).
 * Viene del puente del PC o, si no está, del último dato que dejó el agente de GitHub.
 * El dato procede de un servicio NO oficial de Anthropic (el mismo que usa /usage en Claude Code):
 * si cambia o falla, la app solo deja de mostrarlo.
 */
import { signal } from '@preact/signals';
import { onReset } from '../store/store';
import { agentUsage } from './agent';
import { bridgeStatus, bridgeUsage } from './bridge';
import { agentConfigured, bridgeConfigured } from './connections';

export type Window = { pct: number; resetsAt: string | null } | null;
export type Usage = { fiveHour: Window; sevenDay: Window; fetchedAt: string; source: 'puente' | 'agente' };
const KEY = 'cuaderno-gsi-uso';
const read = (): Usage | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
export const usage = signal<Usage | null>(read());
export const usageError = signal('');
export const usageLoading = signal(false);
onReset(() => { try { localStorage.removeItem(KEY); } catch { /* */ } usage.value = null; usageError.value = ''; });

const store = (u: Usage) => { usage.value = u; usageError.value = ''; try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* */ } };
const valid = (u: any): u is Usage => u && (u.fiveHour || u.sevenDay) && u.fetchedAt;

export async function refreshUsage(): Promise<void> {
  if (usageLoading.value) return;
  usageLoading.value = true;
  try {
    if (bridgeConfigured() && (await bridgeStatus()).ok) {
      const u = await bridgeUsage();
      if (valid(u)) return store(u);
      usageError.value = u?.error || 'El puente no pudo leer el uso.';
      return;
    }
    if (agentConfigured()) {
      const u = await agentUsage();
      if (valid(u)) return store(u);
      usageError.value = 'El agente aún no ha podido leer el uso (con algunos tokens no está disponible).';
      return;
    }
    usageError.value = '';
  } catch (e: any) { usageError.value = e?.message || 'No se pudo consultar el uso.'; }
  finally { usageLoading.value = false; }
}

/** Refresco periódico mientras la app está visible. */
export function initUsage() {
  if (!bridgeConfigured() && !agentConfigured()) return;
  void refreshUsage();
  setInterval(() => { if (document.visibilityState === 'visible') void refreshUsage(); }, 5 * 60 * 1000);
}
