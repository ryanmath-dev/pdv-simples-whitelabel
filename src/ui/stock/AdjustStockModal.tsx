import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { ProductPicker } from '@/ui/components/ProductPicker';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { useBalances } from '@/ui/data-hooks';
import { formatQuantity, parseQuantity } from '@/domain/quantity';
import type { Product } from '@/domain/product';
import { adjustStock } from '@/application/use-cases/adjust-stock';

export function AdjustStockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const container = useContainer();
  const user = useSession((s) => s.currentUser);
  const show = useToasts((s) => s.show);
  const balances = useBalances();
  const [product, setProduct] = useState<Product | null>(null);
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT');
  const [type, setType] = useState<'ADJUSTMENT' | 'LOSS'>('LOSS');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');

  async function save() {
    if (!user || !product) {
      show('Selecione um produto.', 'error');
      return;
    }
    const q = parseQuantity(qty, product.unit);
    if (q == null) {
      show('Quantidade inválida.', 'error');
      return;
    }
    if (!reason.trim()) {
      show('Motivo é obrigatório.', 'error');
      return;
    }
    const signed = direction === 'OUT' ? -q : q;
    await adjustStock(
      { repos: container.repos, events: container.events },
      { productId: product.id, userId: user.id, quantity: signed, type, reason },
    );
    show('Ajuste registrado.', 'success');
    setProduct(null);
    setQty('');
    setReason('');
    onClose();
  }

  const current = product ? (balances.get(product.id) ?? 0) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajuste de estoque"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Registrar ajuste</Button>
        </>
      }
    >
      <div className="space-y-3">
        {product ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2">
            <span>
              <b>{product.name}</b> — saldo atual: {formatQuantity(current, product.unit)} {product.unit}
            </span>
            <button className="text-sm text-brand-700" onClick={() => setProduct(null)}>
              trocar
            </button>
          </div>
        ) : (
          <ProductPicker onPick={setProduct} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Operação" value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}>
            <option value="OUT">Saída (−)</option>
            <option value="IN">Entrada (+)</option>
          </Select>
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as 'ADJUSTMENT' | 'LOSS')}>
            <option value="LOSS">Perda / quebra / vencimento</option>
            <option value="ADJUSTMENT">Ajuste manual</option>
          </Select>
        </div>
        <Input
          label="Quantidade"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={product?.unit === 'KG' ? '1,5' : '3'}
        />
        <Input label="Motivo (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
