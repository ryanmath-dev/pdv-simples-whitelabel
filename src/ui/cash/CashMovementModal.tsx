import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { useRepos } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { parseBRLToCents } from '@/domain/money';
import { registerCashMovement } from '@/application/use-cases/cash-movement';
import type { CashMovementType } from '@/domain/cash-register';

export function CashMovementModal({
  open,
  type,
  cashSessionId,
  onClose,
}: {
  open: boolean;
  type: CashMovementType;
  cashSessionId: string;
  onClose: () => void;
}) {
  const repos = useRepos();
  const user = useSession((s) => s.currentUser);
  const show = useToasts((s) => s.show);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const isSupply = type === 'SUPPLY';

  async function save() {
    const cents = parseBRLToCents(value);
    if (cents == null || cents <= 0) {
      show('Valor inválido.', 'error');
      return;
    }
    if (!reason.trim()) {
      show('Motivo é obrigatório.', 'error');
      return;
    }
    if (!user) return;
    await registerCashMovement(repos, {
      cashSessionId,
      userId: user.id,
      type,
      amountCents: cents,
      reason,
    });
    show(isSupply ? 'Suprimento registrado.' : 'Sangria registrada.', 'success');
    setValue('');
    setReason('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSupply ? 'Suprimento (entrada de troco)' : 'Sangria (retirada)'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Registrar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Valor (R$)" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
