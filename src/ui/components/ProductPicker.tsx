import { useMemo, useState } from 'react';
import { useProducts } from '@/ui/data-hooks';
import type { Product } from '@/domain/product';
import { cn } from '@/ui/lib/cn';

/** Combobox simples para escolher um produto por nome/SKU/código. */
export function ProductPicker({
  onPick,
  placeholder = 'Buscar produto…',
}: {
  onPick: (product: Product) => void;
  placeholder?: string;
}) {
  const products = useProducts();
  const [term, setTerm] = useState('');
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    if (!term.trim()) return [];
    const t = term.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          p.sku.toLowerCase().includes(t) ||
          (p.barcode ?? '').includes(term),
      )
      .slice(0, 8);
  }, [term, products]);

  return (
    <div className="relative">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      {focused && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((p) => (
            <li
              key={p.id}
              onClick={() => {
                onPick(p);
                setTerm('');
              }}
              className={cn('cursor-pointer px-3 py-2 hover:bg-brand-50')}
            >
              <span className="font-medium text-slate-800">{p.name}</span>
              <span className="ml-2 text-sm text-slate-400">{p.sku}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
