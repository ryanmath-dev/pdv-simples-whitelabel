import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { formatBRL } from '@/domain/money';
import type { Product } from '@/domain/product';
import { useRepos } from '@/ui/container-context';
import { cn } from '@/ui/lib/cn';

export interface ProductSearchModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (product: Product) => void;
}

export function ProductSearchModal({ open, onClose, onPick }: ProductSearchModalProps) {
  const repos = useRepos();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTerm('');
      setResults([]);
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = term.trim()
        ? await repos.products.search(term)
        : (await repos.products.getAll()).slice(0, 30);
      if (active) {
        setResults(list.filter((p) => p.active).slice(0, 50));
        setIndex(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [term, repos, open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = results[index];
      if (picked) onPick(picked);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar produto (F2)" size="lg">
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Nome, SKU ou código de barras"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        {results.length === 0 ? (
          <div className="p-4 text-center text-slate-400">Nenhum produto encontrado</div>
        ) : (
          <ul>
            {results.map((p, i) => (
              <li
                key={p.id}
                onClick={() => onPick(p)}
                onMouseEnter={() => setIndex(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between px-3 py-2',
                  i === index ? 'bg-brand-50' : 'hover:bg-slate-50',
                )}
              >
                <span>
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="ml-2 text-sm text-slate-400">
                    {p.sku}
                    {p.unit === 'KG' ? ' · por kg' : ''}
                  </span>
                </span>
                <span className="font-semibold text-slate-700">{formatBRL(p.priceCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">↑↓ navegar · Enter selecionar · Esc fechar</p>
    </Modal>
  );
}
