import { makeBase, now } from '@/domain/types';
import type { Cents } from '@/domain/money';
import type { Unit } from '@/domain/quantity';
import {
  computeItemTotal,
  computePaymentBalance,
  computeSaleTotals,
  type Payment,
  type PaymentMethod,
  type Sale,
  type SaleItem,
} from '@/domain/sale';
import type { StockMovement } from '@/domain/stock';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';
import { applyMovementsToBalances } from './stock-helpers';

export interface DraftItem {
  productId: string;
  description: string;
  unit: Unit;
  quantity: number; // milésimos
  unitPriceCents: Cents;
  discountCents: Cents;
}

export interface DraftPayment {
  method: PaymentMethod;
  amountCents: Cents;
  receivedCents?: Cents | null;
  providerRef?: string | null;
}

export interface FinalizeSaleInput {
  terminalId: string;
  cashSessionId: string;
  userId: string;
  items: DraftItem[];
  saleDiscountCents?: Cents;
  payments: DraftPayment[];
  customerDocument?: string | null;
}

export interface FinalizeSaleResult {
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
}

export class FinalizeSaleError extends Error {}

export interface FinalizeSaleDeps {
  repos: Repositories;
  events: EventBus;
}

/**
 * Finaliza uma venda atomicamente: grava venda, itens, pagamentos, movimentos
 * de estoque (SALE, negativos) e atualiza o cache de saldos — tudo na mesma
 * transação (via repos.transaction + auto-outbox). Após commit, publica
 * SaleFinalized e StockChanged (o handler fiscal nunca bloqueia o caixa).
 */
export async function finalizeSale(
  deps: FinalizeSaleDeps,
  input: FinalizeSaleInput,
): Promise<FinalizeSaleResult> {
  const { repos, events } = deps;

  if (input.items.length === 0) {
    throw new FinalizeSaleError('Venda sem itens não pode ser finalizada.');
  }

  const saleDiscount = input.saleDiscountCents ?? 0;
  const totals = computeSaleTotals(
    input.items.map((i) => ({
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      discountCents: i.discountCents,
      canceled: false,
    })),
    saleDiscount,
  );

  const balance = computePaymentBalance(
    totals.totalCents,
    input.payments.map((p) => ({
      method: p.method,
      amountCents: p.amountCents,
      receivedCents: p.receivedCents ?? null,
    })),
  );

  if (balance.remainingCents > 0) {
    throw new FinalizeSaleError('Pagamento insuficiente para finalizar a venda.');
  }

  const result = await repos.transaction(async () => {
    const number = await repos.sales.nextNumber(input.terminalId);
    const ts = now();

    const sale: Sale = {
      ...makeBase(),
      number,
      terminalId: input.terminalId,
      cashSessionId: input.cashSessionId,
      userId: input.userId,
      status: 'FINALIZED',
      subtotalCents: totals.subtotalCents,
      discountCents: totals.itemDiscountCents + totals.saleDiscountCents,
      totalCents: totals.totalCents,
      changeCents: balance.changeCents,
      customerDocument: input.customerDocument ?? null,
      fiscalStatus: 'NOT_REQUIRED',
      fiscalRef: null,
      finalizedAt: ts,
    };

    const items: SaleItem[] = input.items.map((i) => ({
      ...makeBase(),
      saleId: sale.id,
      productId: i.productId,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      discountCents: i.discountCents,
      totalCents: computeItemTotal(i.unitPriceCents, i.quantity, i.discountCents),
      canceled: false,
    }));

    const payments: Payment[] = input.payments.map((p) => ({
      ...makeBase(),
      saleId: sale.id,
      method: p.method,
      amountCents: p.amountCents,
      receivedCents: p.receivedCents ?? null,
      providerRef: p.providerRef ?? null,
      status: 'CONFIRMED',
    }));

    const movements: StockMovement[] = input.items.map((i) => ({
      ...makeBase(),
      productId: i.productId,
      type: 'SALE',
      quantity: -i.quantity, // saída (negativo)
      unitCostCents: null,
      refType: 'SALE',
      refId: sale.id,
      reason: null,
      userId: input.userId,
    }));

    await repos.sales.put(sale);
    for (const item of items) await repos.saleItems.put(item);
    for (const payment of payments) await repos.payments.put(payment);
    for (const movement of movements) await repos.stockMovements.put(movement);
    await applyMovementsToBalances(repos, movements);

    return { sale, items, payments };
  });

  // Fora da transação: eventos de domínio (handlers não bloqueiam o caixa).
  await events.emit('SaleFinalized', { sale: result.sale });
  await events.emit('StockChanged', {
    productIds: result.items.map((i) => i.productId),
  });

  return result;
}
