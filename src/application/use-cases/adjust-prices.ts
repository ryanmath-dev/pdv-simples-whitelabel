import { now } from '@/domain/types';
import type { Repositories } from '@/application/ports/repositories';

export interface AdjustPricesInput {
  /** Categoria alvo; null = todos os produtos. */
  categoryId: string | null;
  /** Percentual de ajuste (ex.: 10 = +10%, -5 = -5%). */
  percent: number;
}

/** Ajuste de preço em massa por categoria. Arredonda ao centavo. */
export async function adjustPrices(
  repos: Repositories,
  input: AdjustPricesInput,
): Promise<number> {
  return repos.transaction(async () => {
    const products = await repos.products.getAll();
    const targets = input.categoryId
      ? products.filter((p) => p.categoryId === input.categoryId)
      : products;
    let count = 0;
    for (const p of targets) {
      const next = Math.max(0, Math.round(p.priceCents * (1 + input.percent / 100)));
      if (next === p.priceCents) continue;
      await repos.products.put({
        ...p,
        priceCents: next,
        updatedAt: now(),
        version: p.version + 1,
      });
      count++;
    }
    return count;
  });
}
