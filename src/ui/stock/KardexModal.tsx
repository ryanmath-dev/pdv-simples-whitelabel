import { useEffect, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { useRepos } from '@/ui/container-context';
import { formatQuantity } from '@/domain/quantity';
import { formatBRL } from '@/domain/money';
import type { Product } from '@/domain/product';
import type { StockMovement, StockMovementType } from '@/domain/stock';

const TYPE_LABELS: Record<StockMovementType, string> = {
  SALE: 'Venda',
  SALE_CANCEL: 'Estorno venda',
  PURCHASE: 'Entrada',
  ADJUSTMENT: 'Ajuste',
  INVENTORY: 'Inventário',
  LOSS: 'Perda',
};

export function KardexModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  const repos = useRepos();
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (open && product) {
      repos.stockMovements.listByProduct(product.id).then((list) => {
        setMovements(
          [...list]
            .filter((m) => !m.deletedAt)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      });
    }
  }, [open, product, repos]);

  // Saldo acumulado (do mais antigo ao mais novo).
  const asc = [...movements].reverse();
  const running = new Map<string, number>();
  let acc = 0;
  for (const m of asc) {
    acc += m.quantity;
    running.set(m.id, acc);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Kardex — ${product?.name ?? ''}`} size="lg">
      <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500">
                  {new Date(m.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2">{TYPE_LABELS[m.type]}</td>
                <td className={`px-3 py-2 text-right ${m.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {product ? formatQuantity(Math.abs(m.quantity), product.unit) : m.quantity}
                </td>
                <td className="px-3 py-2 text-right">
                  {product ? formatQuantity(running.get(m.id) ?? 0, product.unit) : ''}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {m.reason ?? ''}
                  {m.unitCostCents != null ? ` (custo ${formatBRL(m.unitCostCents)})` : ''}
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhum movimento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
