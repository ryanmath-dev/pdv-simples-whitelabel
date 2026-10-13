import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { useProducts, useBalances } from '@/ui/data-hooks';
import { formatQuantity } from '@/domain/quantity';
import { applyInventory } from '@/application/use-cases/apply-inventory';
import { cn } from '@/ui/lib/cn';

export function InventoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const container = useContainer();
  const user = useSession((s) => s.currentUser);
  const show = useToasts((s) => s.show);
  const products = useProducts();
  const balances = useBalances();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [term, setTerm] = useState('');

  const filtered = term.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(term.toLowerCase()))
    : products;

  async function save() {
    if (!user) return;
    const entries = Object.entries(counts).filter(([, v]) => v.trim() !== '');
    if (entries.length === 0) {
      show('Informe ao menos uma contagem.', 'error');
      return;
    }
    const list = entries.map(([productId, v]) => {
      const product = products.find((p) => p.id === productId)!;
      const num = Number(v.replace(',', '.'));
      return { productId, countedQuantity: Math.round(num * 1000), unit: product.unit };
    });
    const movs = await applyInventory(
      { repos: container.repos, events: container.events },
      { userId: user.id, counts: list.map((l) => ({ productId: l.productId, countedQuantity: l.countedQuantity })) },
    );
    show(`Inventário aplicado: ${movs.length} ajuste(s).`, 'success');
    setCounts({});
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inventário / contagem"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Aplicar inventário</Button>
        </>
      }
    >
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Filtrar produtos…"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-500">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Sistema</th>
              <th className="px-3 py-2 text-right">Contado</th>
              <th className="px-3 py-2 text-right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const sys = balances.get(p.id) ?? 0;
              const raw = counts[p.id];
              const counted = raw && raw.trim() !== '' ? Math.round(Number(raw.replace(',', '.')) * 1000) : null;
              const diff = counted != null ? counted - sys : null;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {formatQuantity(sys, p.unit)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={raw ?? ''}
                      onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                      placeholder="—"
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
                    />
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right',
                      diff != null && diff !== 0 && (diff < 0 ? 'text-red-600' : 'text-green-600'),
                    )}
                  >
                    {diff != null ? formatQuantity(Math.abs(diff), p.unit) : '—'}
                    {diff != null && diff !== 0 ? (diff < 0 ? ' ↓' : ' ↑') : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
