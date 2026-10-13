import { makeBase } from '@/domain/types';
import type { Cents } from '@/domain/money';
import type { StockMovement } from '@/domain/stock';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';
import { applyMovementsToBalances } from './stock-helpers';

export interface ReceiveGoodsItem {
  productId: string;
  quantity: number; // milésimos (positivo)
  unitCostCents: Cents;
}

export interface ReceiveGoodsInput {
  userId: string;
  supplier?: string | null;
  invoiceNumber?: string | null;
  items: ReceiveGoodsItem[];
}

export class ReceiveGoodsError extends Error {}

export interface ReceiveGoodsDeps {
  repos: Repositories;
  events: EventBus;
}

/**
 * Entrada de mercadoria: gera movimentos PURCHASE (positivos) com custo
 * unitário e atualiza saldos. Opcionalmente atualiza o custo do produto.
 */
export async function receiveGoods(
  deps: ReceiveGoodsDeps,
  input: ReceiveGoodsInput,
): Promise<StockMovement[]> {
  const { repos, events } = deps;
  if (input.items.length === 0) throw new ReceiveGoodsError('Nenhum item na entrada.');
  if (input.items.some((i) => i.quantity <= 0)) {
    throw new ReceiveGoodsError('Quantidade deve ser positiva.');
  }

  const reason = [input.supplier && `Fornecedor: ${input.supplier}`, input.invoiceNumber && `NF: ${input.invoiceNumber}`]
    .filter(Boolean)
    .join(' | ');

  const movements = await repos.transaction(async () => {
    const movs: StockMovement[] = input.items.map((i) => ({
      ...makeBase(),
      productId: i.productId,
      type: 'PURCHASE',
      quantity: i.quantity,
      unitCostCents: i.unitCostCents,
      refType: 'PURCHASE',
      refId: null,
      reason: reason || null,
      userId: input.userId,
    }));

    for (const m of movs) await repos.stockMovements.put(m);

    // Atualiza o custo mais recente do produto (última entrada).
    for (const i of input.items) {
      const product = await repos.products.get(i.productId);
      if (product && product.costCents !== i.unitCostCents) {
        await repos.products.put({
          ...product,
          costCents: i.unitCostCents,
          updatedAt: new Date().toISOString(),
          version: product.version + 1,
        });
      }
    }

    await applyMovementsToBalances(repos, movs);
    return movs;
  });

  await events.emit('StockChanged', { productIds: movements.map((m) => m.productId) });
  return movements;
}
