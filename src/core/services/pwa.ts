/**
 * Instalación como app (PWA). Solo aplica a la versión web (GitHub Pages u otro servidor HTTPS):
 * dentro de Claude no se registra nada.
 */
import { signal } from '@preact/signals';
import { insideClaude } from './ai';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallEvent | null = null;

/** Hay aviso de instalación nativo disponible (Chrome, Edge y Samsung Internet en Android y escritorio). */
export const canInstall = signal(false);
export const isStandalone = signal(matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const pwaSupported = !insideClaude && location.protocol !== 'file:';

export function initPwa(onUpdated: () => void) {
  if (!pwaSupported) return;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; canInstall.value = true; });
  addEventListener('appinstalled', () => { deferred = null; canInstall.value = false; isStandalone.value = true; });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onUpdated(); });
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin service worker la app funciona igual, solo que no sin conexión */ });
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; canInstall.value = false;
  return outcome === 'accepted';
}
