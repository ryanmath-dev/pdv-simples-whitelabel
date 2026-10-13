import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { ProductPicker } from '@/ui/components/ProductPicker';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { formatBRL, parseBRLToCents } from '@/domain/money';
import { parseQuantity } from '@/domain/quantity';
import type { Product } from '@/domain/product';
import { receiveGoods } from '@/application/use-cases/receive-goods';

interface Line {
  product: Product;
  qty: string;
  cost: string;
}

export function ReceiveGoodsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const container = useContainer();
  const user = useSession((s) => s.currentUser);
  const show = useToasts((s) => s.show);
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  function addProduct(p: Product) {
    if (lines.some((l) => l.product.id === p.id)) return;
    setLines((prev) => [
      ...prev,
      { product: p, qty: '', cost: (p.costCents / 100).toFixed(2).replace('.', ',') },
    ]);
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }

  async function save() {
    if (!user) return;
    const items = [];
    for (const l of lines) {
      const qty = parseQuantity(l.qty, l.product.unit);
      const cost = parseBRLToCents(l.cost);
      if (qty == null || cost == null) {
        show(`Dados inválidos para ${l.product.name}.`, 'error');
        return;
      }
      items.push({ productId: l.product.id, quantity: qty, unitCostCents: cost });
    }
    if (items.length === 0) {
      show('Adicione ao menos um item.', 'error');
      return;
    }
    await receiveGoods(
      { repos: container.repos, events: container.events },
      { userId: user.id, supplier: supplier || null, invoiceNumber: invoice || null, items },
    );
    show(`Entrada registrada: ${items.length} item(ns).`, 'success');
    setLines([]);
    setSupplier('');
    setInvoice('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Entrada de mercadoria"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={lines.length === 0}>
            Registrar entrada
          </Button>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Input label="Fornecedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        <Input label="Nº da nota" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
      </div>
      <div className="mb-3">
        <span className="mb-1 block text-sm font-medium text-slate-700">Adicionar produto</span>
        <ProductPicker onPick={addProduct} />
      </div>
      {lines.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Produto</th>
              <th className="py-1">Qtd</th>
              <th className="py-1">Custo unit. (R$)</th>
              <th className="py-1 text-right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const qty = parseQuantity(l.qty, l.product.unit) ?? 0;
              const cost = parseBRLToCents(l.cost) ?? 0;
              const total = Math.round((qty * cost) / 1000);
              return (
                <tr key={l.product.id} className="border-t border-slate-100">
                  <td className="py-1">{l.product.name}</td>
                  <td className="py-1">
                    <input
                      value={l.qty}
                      onChange={(e) => updateLine(l.product.id, { qty: e.target.value })}
                      placeholder={l.product.unit === 'KG' ? '1,5' : '10'}
                      className="w-20 rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      value={l.cost}
                      onChange={(e) => updateLine(l.product.id, { cost: e.target.value })}
                      className="w-24 rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-1 text-right">{formatBRL(total)}</td>
                  <td className="py-1 text-right">
                    <button onClick={() => removeLine(l.product.id)} className="text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
