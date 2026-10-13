import { useMemo, useState } from 'react';
import { useRepos } from '@/ui/container-context';
import { useProducts, useCategories, useBalances } from '@/ui/data-hooks';
import { formatBRL } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import type { Product } from '@/domain/product';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { Modal } from '@/ui/components/Modal';
import { useToasts } from '@/ui/components/toast-store';
import { ProductFormModal } from './ProductFormModal';
import { ProductCsvModal } from './ProductCsvModal';
import { productsToCsv } from './product-csv';
import { downloadText } from '@/ui/lib/csv';
import { adjustPrices } from '@/application/use-cases/adjust-prices';
import { cn } from '@/ui/lib/cn';

export function ProductsPage() {
  const repos = useRepos();
  const products = useProducts();
  const categories = useCategories();
  const balances = useBalances();
  const show = useToasts((s) => s.show);

  const [term, setTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = products.filter((p) => {
    if (!showInactive && !p.active) return false;
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
    if (term) {
      const t = term.toLowerCase();
      return (
        p.name.toLowerCase().includes(t) ||
        p.sku.toLowerCase().includes(t) ||
        (p.barcode ?? '').includes(term)
      );
    }
    return true;
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setFormOpen(true);
  }

  async function toggleActive(p: Product) {
    await repos.products.put({
      ...p,
      active: !p.active,
      updatedAt: new Date().toISOString(),
      version: p.version + 1,
    });
  }

  function exportCsv() {
    downloadText('produtos.csv', productsToCsv(products, catName));
    show('Exportação gerada.', 'success');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input
            label="Buscar"
            placeholder="Nome, SKU ou código"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <Select label="Categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativos
        </label>
        <div className="ml-auto flex gap-2">
          <Button onClick={openNew}>Novo produto</Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)}>
            Ajuste em massa
          </Button>
          <Button variant="secondary" onClick={() => setCsvOpen(true)}>
            Importar CSV
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-500">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2 text-center">Ativo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const bal = balances.get(p.id) ?? 0;
              const low = bal < p.minStock;
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500">{p.sku}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.categoryId ? catName.get(p.categoryId) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{formatBRL(p.priceCents)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{formatBRL(p.costCents)}</td>
                  <td className={cn('px-3 py-2 text-right', low && 'font-semibold text-red-600')}>
                    {formatQuantity(bal, p.unit)} {p.unit}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleActive(p)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        p.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500',
                      )}
                    >
                      {p.active ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  Nenhum produto. Cadastre ou importe um CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-sm text-slate-500">{filtered.length} produto(s)</div>

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => show('Produto salvo.', 'success')}
      />
      <ProductCsvModal open={csvOpen} onClose={() => setCsvOpen(false)} onImported={(m) => show(m, 'success')} />
      <BulkPriceModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}

function BulkPriceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const repos = useRepos();
  const categories = useCategories();
  const show = useToasts((s) => s.show);
  const [categoryId, setCategoryId] = useState('');
  const [percent, setPercent] = useState('');

  async function apply() {
    const p = Number(percent.replace(',', '.'));
    if (!Number.isFinite(p) || p === 0) {
      show('Percentual inválido.', 'error');
      return;
    }
    const count = await adjustPrices(repos, { categoryId: categoryId || null, percent: p });
    show(`${count} preço(s) ajustado(s) em ${p}%.`, 'success');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajuste de preço em massa"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={apply}>Aplicar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todos os produtos</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Percentual (%) — negativo para reduzir"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="Ex.: 10 ou -5"
        />
      </div>
    </Modal>
  );
}
