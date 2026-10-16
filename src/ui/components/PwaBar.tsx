import { useEffect, useState } from 'react';
import { useContainer } from '@/ui/container-context';
import { Button } from './Button';
import { Modal } from './Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Banner de demo + botão de instalar + aviso de atualização do app. */
export function PwaBar() {
  const { demoMode } = useContainer();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onNeedRefresh = () => setNeedRefresh(true);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('pwa:need-refresh', onNeedRefresh);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('pwa:need-refresh', onNeedRefresh);
    };
  }, []);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  async function install() {
    if (installEvent) {
      await installEvent.prompt();
      setInstallEvent(null);
    } else if (isIos) {
      setIosHelp(true);
    }
  }

  function update() {
    const fn = (window as unknown as { __pdvUpdate?: () => void }).__pdvUpdate;
    if (fn) fn();
    else window.location.reload();
  }

  const showInstall = !standalone && (installEvent !== null || isIos);

  return (
    <>
      {demoMode && (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-800">
          Demonstração — dados fictícios. Nenhuma informação é enviada a servidores.
        </div>
      )}
      {needRefresh && (
        <div className="flex items-center justify-center gap-3 bg-brand-700 px-4 py-1 text-sm text-white">
          <span>Nova versão disponível.</span>
          <button onClick={update} className="rounded bg-white/20 px-2 py-0.5 font-medium hover:bg-white/30">
            Atualizar
          </button>
        </div>
      )}
      {showInstall && (
        <div className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-1 text-sm text-white">
          <span>Instale o PDV no dispositivo para usar offline.</span>
          <button onClick={install} className="rounded bg-brand-600 px-2 py-0.5 font-medium hover:bg-brand-500">
            Instalar app
          </button>
        </div>
      )}
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Instalar no iPhone/iPad" size="sm"
        footer={<Button onClick={() => setIosHelp(false)}>Entendi</Button>}>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
          <li>Abra este site no Safari.</li>
          <li>Toque no botão Compartilhar (quadrado com seta).</li>
          <li>Escolha “Adicionar à Tela de Início”.</li>
          <li>Confirme em “Adicionar”.</li>
        </ol>
      </Modal>
    </>
  );
}
