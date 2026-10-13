import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { formatBRL } from '@/domain/money';
import { computeCloseSummary } from '@/domain/cash-register';
import type { User } from '@/domain/user';
import { Button } from '@/ui/components/Button';
import { OpenCashModal } from '@/ui/pos/OpenCashModal';
import { CashMovementModal } from './CashMovementModal';
import { CloseCashModal } from './CloseCashModal';
import { UserFormModal } from './UserFormModal';
import { cn } from '@/ui/lib/cn';

type Tab = 'caixa' | 'usuarios' | 'auditoria';

export function CashSessionPage() {
  const [tab, setTab] = useState<Tab>('caixa');
  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(
          [
            ['caixa', 'Caixa'],
            ['usuarios', 'Usuários'],
            ['auditoria', 'Auditoria'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium',
              tab === id ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'caixa' && <CaixaTab />}
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'auditoria' && <AuditTab />}
    </div>
  );
}

function CaixaTab() {
  const db = useDb();
  const { cashSession } = useSession();
  const [modal, setModal] = useState<'none' | 'open' | 'supply' | 'withdrawal' | 'close'>('none');

  const movements =
    useLiveQuery(
      () => (cashSession ? db.cashMovements.where('cashSessionId').equals(cashSession.id).toArray() : []),
      [db, cashSession?.id],
    ) ?? [];

  const summary = useLiveQuery(async () => {
    if (!cashSession) return null;
    const sales = (await db.sales.where('cashSessionId').equals(cashSession.id).toArray()).filter(
      (s) => s.status === 'FINALIZED',
    );
    const payments = await db.payments.where('saleId').anyOf(sales.map((s) => s.id)).toArray();
    const movs = await db.cashMovements.where('cashSessionId').equals(cashSession.id).toArray();
    return computeCloseSummary({
      openingCents: cashSession.openingCents,
      payments: payments.map((p) => ({ method: p.method, amountCents: p.amountCents })),
      movements: movs.map((m) => ({ type: m.type, amountCents: m.amountCents })),
    });
  }, [db, cashSession?.id]);

  if (!cashSession) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <h3 className="text-xl font-semibold text-slate-700">Caixa fechado</h3>
        <Button onClick={() => setModal('open')}>Abrir caixa</Button>
        <OpenCashModal open={modal === 'open'} onClose={() => setModal('none')} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 overflow-auto md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-800">Resumo da sessão</h3>
        {summary && (
          <div className="space-y-1 text-sm">
            <Row label="Aberto em" value={new Date(cashSession.openedAt).toLocaleString('pt-BR')} />
            <Row label="Fundo de troco" value={formatBRL(summary.openingCents)} />
            <Row label="Vendas em dinheiro" value={formatBRL(summary.cashSalesCents)} />
            <Row label="Suprimentos" value={formatBRL(summary.supplyCents)} />
            <Row label="Sangrias" value={`-${formatBRL(summary.withdrawalCents)}`} />
            <div className="my-2 border-t border-slate-200" />
            <Row label="Esperado em caixa" value={formatBRL(summary.expectedCents)} bold />
            <div className="my-2 border-t border-slate-200" />
            <div className="font-medium text-slate-600">Por forma de pagamento</div>
            {(Object.keys(summary.byMethod) as (keyof typeof summary.byMethod)[])
              .filter((m) => summary.byMethod[m] > 0)
              .map((m) => (
                <Row key={m} label={m} value={formatBRL(summary.byMethod[m])} />
              ))}
            <Row label="Total vendido" value={formatBRL(summary.totalSalesCents)} bold />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal('supply')}>
            Suprimento
          </Button>
          <Button variant="secondary" onClick={() => setModal('withdrawal')}>
            Sangria
          </Button>
          <Button variant="danger" onClick={() => setModal('close')}>
            Fechar caixa
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-800">Movimentos de gaveta</h3>
        {movements.length === 0 ? (
          <p className="text-slate-400">Nenhum suprimento ou sangria.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex justify-between border-b border-slate-100 py-1">
                <span>
                  {m.type === 'SUPPLY' ? 'Suprimento' : 'Sangria'} — {m.reason}
                </span>
                <span className={m.type === 'SUPPLY' ? 'text-green-600' : 'text-red-600'}>
                  {m.type === 'SUPPLY' ? '+' : '-'}
                  {formatBRL(m.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CashMovementModal
        open={modal === 'supply'}
        type="SUPPLY"
        cashSessionId={cashSession.id}
        onClose={() => setModal('none')}
      />
      <CashMovementModal
        open={modal === 'withdrawal'}
        type="WITHDRAWAL"
        cashSessionId={cashSession.id}
        onClose={() => setModal('none')}
      />
      {modal === 'close' && (
        <CloseCashModal open session={cashSession} onClose={() => setModal('none')} />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between', bold && 'font-bold text-slate-800')}>
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function UsersTab() {
  const db = useDb();
  const { currentUser } = useSession();
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  const canManage = currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';
  const users =
    useLiveQuery(async () => (await db.users.toArray()).filter((u) => !u.deletedAt), [db]) ?? [];

  const roleLabel: Record<User['role'], string> = {
    OPERATOR: 'Operador',
    MANAGER: 'Gerente',
    ADMIN: 'Administrador',
  };

  return (
    <div className="overflow-auto">
      {canManage && (
        <div className="mb-3">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Novo usuário
          </Button>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-500">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{u.name}</td>
                <td className="px-3 py-2 text-slate-500">{roleLabel[u.role]}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(u);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserFormModal open={open} user={editing} onClose={() => setOpen(false)} />
      {!canManage && (
        <p className="mt-3 text-sm text-slate-400">
          Apenas gerentes/administradores podem gerenciar usuários.
        </p>
      )}
    </div>
  );
}

function AuditTab() {
  const db = useDb();
  const logs =
    useLiveQuery(
      async () =>
        (await db.auditLogs.orderBy('createdAt').reverse().limit(200).toArray()).filter(
          (l) => !l.deletedAt,
        ),
      [db],
    ) ?? [];

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 text-slate-500">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Ação</th>
            <th className="px-3 py-2">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                {new Date(l.createdAt).toLocaleString('pt-BR')}
              </td>
              <td className="px-3 py-2 font-medium text-slate-700">{l.action}</td>
              <td className="px-3 py-2 text-slate-600">{l.detail}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                Nenhum registro de auditoria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
