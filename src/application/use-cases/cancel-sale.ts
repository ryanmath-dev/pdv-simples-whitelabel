import { makeBase, now } from '@/domain/types';
import type { Sale } from '@/domain/sale';
import type { StockMovement } from '@/domain/stock';
import type { AuditLog } from '@/domain/audit';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';
import { applyMovementsToBalances } from './stock-helpers';

export class CancelSaleError extends Error {}

export interface CancelSaleInput {
  saleId: string;
  userId: string;
  reason: string;
}

export interface CancelSaleDeps {
  repos: Repositories;
  events: EventBus;
}

/**
 * Cancela uma venda finalizada: marca status CANCELED e gera movimentos
 * SALE_CANCEL (positivos) que estornam o estoque — tudo atômico. Registra
 * auditoria. Após commit, publica SaleCanceled e StockChanged.
 */
export async function cancelSale(deps: CancelSaleDeps, input: CancelSaleInput): Promise<Sale> {
  const { repos, events } = deps;

  const { sale, productIds } = await repos.transaction(async () => {
    const existing = await repos.sales.get(input.saleId);
    if (!existing) throw new CancelSaleError('Venda não encontrada.');
    if (existing.status === 'CANCELED') throw new CancelSaleError('Venda já cancelada.');
    if (existing.status !== 'FINALIZED') {
      throw new CancelSaleError('Apenas vendas finalizadas podem ser canceladas.');
    }

    const items = await repos.saleItems.listBySale(input.saleId);
    const activeItems = items.filter((i) => !i.canceled);

    const movements: StockMovement[] = activeItems.map((i) => ({
      ...makeBase(),
      productId: i.productId,
      type: 'SALE_CANCEL',
      quantity: i.quantity, // estorno (positivo)
      unitCostCents: null,
      refType: 'SALE_CANCEL',
      refId: input.saleId,
      reason: input.reason,
      userId: input.userId,
    }));

    const canceled: Sale = {
      ...existing,
      status: 'CANCELED',
      updatedAt: now(),
      version: existing.version + 1,
    };

    const audit: AuditLog = {
      ...makeBase(),
      action: 'SALE_CANCEL',
      userId: input.userId,
      detail: `Venda nº ${existing.number} cancelada: ${input.reason}`,
      refType: 'SALE',
      refId: existing.id,
    };

    await repos.sales.put(canceled);
    for (const movement of movements) await repos.stockMovements.put(movement);
    await applyMovementsToBalances(repos, movements);
    await repos.auditLogs.put(audit);

    return { sale: canceled, productIds: movements.map((m) => m.productId) };
  });

  await events.emit('SaleCanceled', { saleId: input.saleId, reason: input.reason });
  if (productIds.length > 0) await events.emit('StockChanged', { productIds });

  return sale;
}
