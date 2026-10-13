import { useEffect, useState } from 'react';
import { useContainer } from '@/ui/container-context';
import { useSession } from './session-store';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '@/ui/container-context';
import { Button } from '@/ui/components/Button';
import type { User } from '@/domain/user';
import { cn } from '@/ui/lib/cn';

const ROLE_LABELS: Record<User['role'], string> = {
  OPERATOR: 'Operador',
  MANAGER: 'Gerente',
  ADMIN: 'Administrador',
};

export function LoginPage() {
  const container = useContainer();
  const db = useDb();
  const login = useSession((s) => s.login);
  const demoMode = container.demoMode;

  const users = useLiveQuery(async () => {
    const all = await db.users.toArray();
    return all.filter((u) => !u.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  }, [db]);

  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (users && users.length === 1 && !selected) setSelected(users[0]!);
  }, [users, selected]);

  async function submit() {
    if (!selected) return;
    const ok = await login(container, selected.id, pin);
    if (!ok) {
      setError('PIN incorreto.');
      setPin('');
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-brand-800">PDV Mercadinho</h1>
        <p className="mb-4 text-center text-slate-500">Selecione o usuário e informe o PIN.</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(users ?? []).map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setSelected(u);
                setPin('');
                setError('');
              }}
              className={cn(
                'rounded-lg border px-3 py-2 text-left',
                selected?.id === u.id
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <div className="font-medium text-slate-800">{u.name}</div>
              <div className="text-xs text-slate-400">{ROLE_LABELS[u.role]}</div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-3">
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="PIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
            <Button className="w-full" size="lg" onClick={submit}>
              Entrar
            </Button>
          </div>
        )}

        {demoMode && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
            Modo demonstração — usuários: <b>admin / 1234</b> e <b>caixa / 0000</b>
          </div>
        )}
      </div>
    </div>
  );
}
