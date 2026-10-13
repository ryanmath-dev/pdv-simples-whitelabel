import { useEffect, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { useRepos } from '@/ui/container-context';
import { useCategories } from '@/ui/data-hooks';
import { centsToReal, parseBRLToCents } from '@/domain/money';
import { isValidEan } from '@/domain/barcode';
import { createProduct, type Product } from '@/domain/product';
import { now } from '@/domain/types';
import type { Unit } from '@/domain/quantity';

export interface ProductFormModalProps {
  open: boolean;
  product: Product | null; // null = novo
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  sku: string;
  name: string;
  barcode: string;
  categoryId: string;
  unit: Unit;
  price: string;
  cost: string;
  minStock: string;
  scaleCode: string;
  active: boolean;
}

function toForm(p: Product | null): FormState {
  if (!p)
    return {
      sku: '',
      name: '',
      barcode: '',
      categoryId: '',
      unit: 'UN',
      price: '',
      cost: '',
      minStock: '0',
      scaleCode: '',
      active: true,
    };
  return {
    sku: p.sku,
    name: p.name,
    barcode: p.barcode ?? '',
    categoryId: p.categoryId ?? '',
    unit: p.unit,
    price: centsToReal(p.priceCents).toFixed(2).replace('.', ','),
    cost: centsToReal(p.costCents).toFixed(2).replace('.', ','),
    minStock: (p.minStock / 1000).toString().replace('.', ','),
    scaleCode: p.scaleCode ?? '',
    active: p.active,
  };
}

export function ProductFormModal({ open, product, onClose, onSaved }: ProductFormModalProps) {
  const repos = useRepos();
  const categories = useCategories();
  const [form, setForm] = useState<FormState>(toForm(product));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(toForm(product));
      setErrors({});
    }
  }, [open, product]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const errs: Record<string, string> = {};
    if (!form.sku.trim()) errs.sku = 'Obrigatório';
    if (!form.name.trim()) errs.name = 'Obrigatório';
    const price = parseBRLToCents(form.price);
    if (price == null) errs.price = 'Preço inválido';
    const cost = form.cost ? parseBRLToCents(form.cost) : 0;
    if (cost == null) errs.cost = 'Custo inválido';
    if (form.barcode && !isValidEan(form.barcode)) errs.barcode = 'EAN inválido';
    const minUnits = form.minStock ? Number(form.minStock.replace(',', '.')) : 0;
    if (!Number.isFinite(minUnits) || minUnits < 0) errs.minStock = 'Inválido';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const base = product ?? createProduct({ sku: form.sku, name: form.name, unit: form.unit, priceCents: 0 });
    const next: Product = {
      ...base,
      sku: form.sku.trim(),
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId || null,
      unit: form.unit,
      priceCents: price!,
      costCents: cost!,
      minStock: Math.round(minUnits * 1000),
      scaleCode: form.scaleCode.trim() || null,
      active: form.active,
      ...(product ? { updatedAt: now(), version: product.version + 1 } : {}),
    };

    await repos.products.put(next);
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar produto' : 'Novo produto'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="SKU" value={form.sku} onChange={(e) => set('sku', e.target.value)} error={errors.sku} />
        <Input
          label="Código de barras (EAN)"
          value={form.barcode}
          onChange={(e) => set('barcode', e.target.value)}
          error={errors.barcode}
        />
        <div className="col-span-2">
          <Input label="Nome" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        </div>
        <Select label="Categoria" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">— sem categoria —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Unidade" value={form.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
          <option value="UN">Unidade (UN)</option>
          <option value="KG">Peso (KG)</option>
        </Select>
        <Input label="Preço (R$)" value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
        <Input label="Custo (R$)" value={form.cost} onChange={(e) => set('cost', e.target.value)} error={errors.cost} />
        <Input
          label="Estoque mínimo"
          value={form.minStock}
          onChange={(e) => set('minStock', e.target.value)}
          error={errors.minStock}
        />
        <Input
          label="Código de balança (PLU)"
          value={form.scaleCode}
          onChange={(e) => set('scaleCode', e.target.value)}
        />
        <label className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span className="text-sm text-slate-700">Produto ativo</span>
        </label>
      </div>
    </Modal>
  );
}
