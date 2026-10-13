import { useEffect, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { useRepos } from '@/ui/container-context';
import { useToasts } from '@/ui/components/toast-store';
import { hashPin, type User, type UserRole } from '@/domain/user';
import { makeBase, now } from '@/domain/types';

export function UserFormModal({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
}) {
  const repos = useRepos();
  const show = useToasts((s) => s.show);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '');
      setRole(user?.role ?? 'OPERATOR');
      setPin('');
    }
  }, [open, user]);

  async function save() {
    if (!name.trim()) {
      show('Nome é obrigatório.', 'error');
      return;
    }
    if (!user && pin.trim().length < 4) {
      show('PIN deve ter ao menos 4 dígitos.', 'error');
      return;
    }
    if (user) {
      const next: User = {
        ...user,
        name: name.trim(),
        role,
        pinHash: pin.trim() ? await hashPin(pin.trim()) : user.pinHash,
        updatedAt: now(),
        version: user.version + 1,
      };
      await repos.users.put(next);
    } else {
      const next: User = {
        ...makeBase(),
        name: name.trim(),
        role,
        pinHash: await hashPin(pin.trim()),
      };
      await repos.users.put(next);
    }
    show('Usuário salvo.', 'success');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Editar usuário' : 'Novo usuário'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Papel" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="OPERATOR">Operador</option>
          <option value="MANAGER">Gerente</option>
          <option value="ADMIN">Administrador</option>
        </Select>
        <Input
          label={user ? 'Novo PIN (deixe vazio para manter)' : 'PIN'}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
      </div>
    </Modal>
  );
}
