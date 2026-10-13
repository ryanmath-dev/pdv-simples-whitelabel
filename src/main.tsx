import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { createContainer } from '@/composition-root';
import { ContainerProvider } from '@/ui/container-context';
import { App } from '@/ui/App';
import { registerServiceWorker } from '@/ui/pwa';

// Solicita armazenamento persistente para o IndexedDB não ser descartado.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => void 0);
}

const container = createContainer();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ContainerProvider container={container}>
      <App />
    </ContainerProvider>
  </React.StrictMode>,
);

registerServiceWorker();
