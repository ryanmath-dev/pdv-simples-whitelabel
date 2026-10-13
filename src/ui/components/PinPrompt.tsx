import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useRepos } from '@/ui/container-context';
import { verifyPin, type UserRole } from '@/domain/user';

export interface PinPromptProps {
  open: boolean;
  title?: string;
  /** Papéis autorizados (ex.: gerente/admin). */
  roles?: UserRole[];
  onCancel: () => void;
  onSuccess: (userId: string) => void;
}

/** Solicita um PIN e valida contra usuários com os papéis permitidos. */
export function PinPrompt({
  open,
  title = 'Autorização de gerente',
  roles = ['MANAGER', 'ADMIN'],
  onCancel,
  onSuccess,
}: PinPromptProps) {
  const repos = useRepos();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function submit() {
    const users = (await repos.users.getAll()).filter((u) => roles.includes(u.role));
    for (const u of users) {
      if (await verifyPin(pin, u.pinHash)) {
        onSuccess(u.id);
        return;
      }
    }
    setError('PIN inválido ou sem permissão.');
    setPin('');
    inputRef.current?.focus();
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit}>
            Confirmar
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="PIN"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
