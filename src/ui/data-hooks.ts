import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '@/ui/container-context';
import type { Product, Category } from '@/domain/product';
import type { StockBalance } from '@/domain/stock';

/** Lista reativa de produtos não deletados. */
export function useProducts(): Product[] {
  const db = useDb();
  return (
    useLiveQuery(async () => {
      const all = await db.products.toArray();
      return all.filter((p) => !p.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
    }, [db]) ?? []
  );
}

/** Lista reativa de categorias. */
export function useCategories(): Category[] {
  const db = useDb();
  return (
    useLiveQuery(async () => {
      const all = await db.categories.toArray();
      return all.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
    }, [db]) ?? []
  );
}

/** Mapa reativo productId -> saldo (milésimos). */
export function useBalances(): Map<string, number> {
  const db = useDb();
  const list = useLiveQuery(() => db.stockBalances.toArray(), [db]) ?? [];
  return new Map(list.map((b: StockBalance) => [b.productId, b.quantity]));
}
