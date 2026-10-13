import { useState } from 'react';
import { useProducts, useBalances } from '@/ui/data-hooks';
import { formatQuantity } from '@/domain/quantity';
import { formatBRL } from '@/domain/money';
import type { Product } from '@/domain/product';
import { Button } from '@/ui/components/Button';
import { ReceiveGoodsModal } from './ReceiveGoodsModal';
import { AdjustStockModal } from './AdjustStockModal';
import { InventoryModal } from './InventoryModal';
import { KardexModal } from './KardexModal';
import { cn } from '@/ui/lib/cn';

export function StockPage() {
  const products = useProducts();
  const balances = useBalances();
  const [onlyLow, setOnlyLow] = useState(false);
  const [term, setTerm] = useState('');
  const [modal, setModal] = useState<'none' | 'receive' | 'adjust' | 'inventory'>('none');
  const [kardex, setKardex] = useState<Product | null>(null);

  const rows = products
    .map((p) => ({ product: p, balance: balances.get(p.id) ?? 0 }))
    .filter((r) => {
      if (onlyLow && r.balance >= r.product.minStock) return false;
      if (term && !r.product.name.toLowerCase().includes(term.toLowerCase())) return false;
      return true;
    });

  const belowCount = products.filter((p) => (balances.get(p.id) ?? 0) < p.minStock).length;
  const stockValue = products.reduce(
    (sum, p) => sum + Math.round(((balances.get(p.id) ?? 0) * p.costCents) / 1000),
    0,
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filtrar produto…"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Apenas abaixo do mínimo ({belowCount})
        </label>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setModal('receive')}>Entrada</Button>
          <Button variant="secondary" onClick={() => setModal('adjust')}>
            Ajuste
          </Button>
          <Button variant="secondary" onClick={() => setModal('inventory')}>
            Inventário
          </Button>
        </div>
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-slate-600">
          Valor em estoque (a custo): <b>{formatBRL(stockValue)}</b>
        </span>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-500">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product: p, balance }) => {
              const low = balance < p.minStock;
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className={cn('px-3 py-2 text-right', low && 'font-semibold text-red-600')}>
                    {formatQuantity(balance, p.unit)} {p.unit}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {formatQuantity(p.minStock, p.unit)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
                      )}
                    >
                      {low ? 'Abaixo' : 'OK'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setKardex(p)}>
                      Kardex
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ReceiveGoodsModal open={modal === 'receive'} onClose={() => setModal('none')} />
      <AdjustStockModal open={modal === 'adjust'} onClose={() => setModal('none')} />
      <InventoryModal open={modal === 'inventory'} onClose={() => setModal('none')} />
      <KardexModal open={kardex !== null} product={kardex} onClose={() => setKardex(null)} />
    </div>
  );
}
