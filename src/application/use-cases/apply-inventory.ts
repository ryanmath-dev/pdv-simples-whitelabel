import { makeBase } from '@/domain/types';
import type { StockMovement } from '@/domain/stock';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';
import { applyMovementsToBalances } from './stock-helpers';

export interface InventoryCount {
  productId: string;
  /** Quantidade contada fisicamente (milésimos). */
  countedQuantity: number;
}

export interface ApplyInventoryInput {
  userId: string;
  counts: InventoryCount[];
}

export interface ApplyInventoryDeps {
  repos: Repositories;
  events: EventBus;
}

/**
 * Inventário: para cada contagem, gera um movimento INVENTORY com a diferença
 * (contado - saldo atual). Produtos sem diferença não geram movimento.
 */
export async function applyInventory(
  deps: ApplyInventoryDeps,
  input: ApplyInventoryInput,
): Promise<StockMovement[]> {
  const { repos, events } = deps;

  const movements = await repos.transaction(async () => {
    const movs: StockMovement[] = [];
    for (const count of input.counts) {
      const balance = await repos.stockBalances.get(count.productId);
      const current = balance?.quantity ?? 0;
      const diff = count.countedQuantity - current;
      if (diff === 0) continue;
      movs.push({
        ...makeBase(),
        productId: count.productId,
        type: 'INVENTORY',
        quantity: diff,
        unitCostCents: null,
        refType: 'INVENTORY',
        refId: null,
        reason: `Inventário: contado ${count.countedQuantity}, sistema ${current}`,
        userId: input.userId,
      });
    }
    for (const m of movs) await repos.stockMovements.put(m);
    await applyMovementsToBalances(repos, movs);
    return movs;
  });

  if (movements.length > 0) {
    await events.emit('StockChanged', { productIds: movements.map((m) => m.productId) });
  }
  return movements;
}
