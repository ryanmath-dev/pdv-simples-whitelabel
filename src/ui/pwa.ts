import { registerSW } from 'virtual:pwa-register';

/**
 * Registra o service worker. Quando houver nova versão, dispara um evento
 * 'pwa:need-refresh' que a UI (Fase 8) pode usar para mostrar "Atualizar".
 * Por ora, expõe window.__pdvUpdate() para aplicar a atualização.
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('pwa:need-refresh'));
      (window as unknown as { __pdvUpdate?: () => void }).__pdvUpdate = () => updateSW(true);
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
    },
  });
}
