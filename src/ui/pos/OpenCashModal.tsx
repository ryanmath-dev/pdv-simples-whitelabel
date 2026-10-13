import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { parseBRLToCents } from '@/domain/money';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { openCashRegister } from '@/application/use-cases/open-cash-register';

export function OpenCashModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const container = useContainer();
  const { currentUser, settings, refreshCashSession } = useSession();
  const [value, setValue] = useState('0,00');
  const [error, setError] = useState('');

  async function submit() {
    const cents = parseBRLToCents(value);
    if (cents == null || cents < 0) {
      setError('Valor inválido');
      return;
    }
    if (!currentUser || !settings) return;
    await openCashRegister(container.repos, {
      terminalId: settings.terminalId,
      userId: currentUser.id,
      openingCents: cents,
    });
    await refreshCashSession(container);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abrir caixa"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Abrir caixa</Button>
        </>
      }
    >
      <Input
        label="Fundo de troco (R$)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
        autoFocus
      />
    </Modal>
  );
}
