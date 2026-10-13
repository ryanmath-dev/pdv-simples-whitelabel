import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="flex h-full items-center justify-center bg-slate-900 text-brand-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold">PDV Mercadinho</h1>
        <p className="mt-2 text-slate-400">Fundação pronta. Demais fases em construção.</p>
      </div>
    </div>
  </React.StrictMode>,
);
