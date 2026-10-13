import { makeBase } from '@/domain/types';
import type { StockMovement, StockMovementType } from '@/domain/stock';
import type { AuditLog } from '@/domain/audit';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';
import { applyMovementsToBalances } from './stock-helpers';

export class AdjustStockError extends Error {}

export interface AdjustStockInput {
  productId: string;
  userId: string;
  /** Quantidade com sinal (milésimos). Positivo entra, negativo sai. */
  quantity: number;
  /** Tipo do movimento: ADJUSTMENT ou LOSS. */
  type: Extract<StockMovementType, 'ADJUSTMENT' | 'LOSS'>;
  reason: string;
}

export interface AdjustStockDeps {
  repos: Repositories;
  events: EventBus;
}

/** Ajuste de estoque com motivo obrigatório. Registra auditoria. */
export async function adjustStock(
  deps: AdjustStockDeps,
  input: AdjustStockInput,
): Promise<StockMovement> {
  const { repos, events } = deps;
  if (!input.reason.trim()) throw new AdjustStockError('Motivo é obrigatório.');
  if (input.quantity === 0) throw new AdjustStockError('Quantidade não pode ser zero.');

  const movement = await repos.transaction(async () => {
    const mov: StockMovement = {
      ...makeBase(),
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      unitCostCents: null,
      refType: input.type,
      refId: null,
      reason: input.reason,
      userId: input.userId,
    };

    const audit: AuditLog = {
      ...makeBase(),
      action: 'STOCK_ADJUSTMENT',
      userId: input.userId,
      detail: `${input.type} de ${input.quantity} (milésimos) no produto ${input.productId}: ${input.reason}`,
      refType: 'STOCK_MOVEMENT',
      refId: mov.id,
    };

    await repos.stockMovements.put(mov);
    await applyMovementsToBalances(repos, [mov]);
    await repos.auditLogs.put(audit);
    return mov;
  });

  await events.emit('StockChanged', { productIds: [input.productId] });
  return movement;
}
