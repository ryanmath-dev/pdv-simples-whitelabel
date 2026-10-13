import { z } from 'zod';
import { baseEntitySchema, type BaseEntity } from './types';
import { multiplyByQuantity, sumCents, type Cents } from './money';
import { unitSchema } from './product';
import type { Unit } from './quantity';

export type SaleStatus = 'OPEN' | 'FINALIZED' | 'CANCELED';
export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'STORE_CREDIT';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';
export type FiscalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CONTINGENCY';

export const paymentMethodSchema = z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT', 'STORE_CREDIT']);

export interface SaleItem extends BaseEntity {
  saleId: string;
  productId: string;
  description: string; // snapshot do nome
  unit: Unit;
  quantity: number; // milésimos
  unitPriceCents: Cents; // snapshot
  discountCents: Cents;
  totalCents: Cents;
  canceled: boolean;
}

export interface Payment extends BaseEntity {
  saleId: string;
  method: PaymentMethod;
  amountCents: Cents;
  receivedCents?: Cents | null; // para dinheiro (base do troco)
  providerRef?: string | null;
  status: PaymentStatus;
}

export interface Sale extends BaseEntity {
  number: number; // sequencial local por terminal
  terminalId: string;
  cashSessionId: string;
  userId: string;
  status: SaleStatus;
  subtotalCents: Cents;
  discountCents: Cents; // desconto aplicado na venda (além dos descontos de item)
  totalCents: Cents;
  changeCents: Cents;
  customerDocument?: string | null;
  fiscalStatus: FiscalStatus;
  fiscalRef?: string | null;
  finalizedAt?: string | null;
}

export const saleItemSchema = baseEntitySchema.extend({
  saleId: z.string(),
  productId: z.string(),
  description: z.string(),
  unit: unitSchema,
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  canceled: z.boolean(),
});

export const paymentSchema = baseEntitySchema.extend({
  saleId: z.string(),
  method: paymentMethodSchema,
  amountCents: z.number().int().nonnegative(),
  receivedCents: z.number().int().nonnegative().nullable().optional(),
  providerRef: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED']),
});

export const saleSchema = baseEntitySchema.extend({
  number: z.number().int().nonnegative(),
  terminalId: z.string(),
  cashSessionId: z.string(),
  userId: z.string(),
  status: z.enum(['OPEN', 'FINALIZED', 'CANCELED']),
  subtotalCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  changeCents: z.number().int().nonnegative(),
  customerDocument: z.string().nullable().optional(),
  fiscalStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'AUTHORIZED', 'REJECTED', 'CONTINGENCY']),
  fiscalRef: z.string().nullable().optional(),
  finalizedAt: z.string().nullable().optional(),
});

/**
 * Calcula o total de um item: (preço unitário x quantidade) - desconto.
 * Usa centavos inteiros e quantidade em milésimos.
 */
export function computeItemTotal(
  unitPriceCents: Cents,
  quantityMilli: number,
  discountCents: Cents = 0,
): Cents {
  const gross = multiplyByQuantity(unitPriceCents, quantityMilli);
  const total = gross - discountCents;
  return total < 0 ? 0 : total;
}

export interface SaleTotals {
  subtotalCents: Cents;
  itemDiscountCents: Cents;
  saleDiscountCents: Cents;
  totalCents: Cents;
}

/**
 * Calcula os totais de uma venda a partir dos itens (ignorando cancelados)
 * e de um desconto adicional de venda.
 * - subtotal: soma dos totais brutos dos itens (antes de descontos de item).
 * - total: subtotal - descontos de item - desconto de venda.
 */
export function computeSaleTotals(
  items: Pick<SaleItem, 'unitPriceCents' | 'quantity' | 'discountCents' | 'canceled'>[],
  saleDiscountCents: Cents = 0,
): SaleTotals {
  const active = items.filter((i) => !i.canceled);
  const grossPerItem = active.map((i) => multiplyByQuantity(i.unitPriceCents, i.quantity));
  const subtotal = sumCents(grossPerItem);
  const itemDiscount = sumCents(active.map((i) => i.discountCents));
  const afterItems = subtotal - itemDiscount;
  const total = Math.max(0, afterItems - saleDiscountCents);
  return {
    subtotalCents: subtotal,
    itemDiscountCents: itemDiscount,
    saleDiscountCents,
    totalCents: total,
  };
}

/** Soma dos pagamentos confirmados/pendentes de uma venda. */
export function sumPayments(payments: Pick<Payment, 'amountCents'>[]): Cents {
  return sumCents(payments.map((p) => p.amountCents));
}

export interface PaymentBalance {
  /** Total a pagar. */
  totalCents: Cents;
  /** Total informado nos pagamentos. */
  paidCents: Cents;
  /** Quanto ainda falta (0 se quitado). */
  remainingCents: Cents;
  /** Troco a devolver (0 se não há excedente). */
  changeCents: Cents;
}

/**
 * Calcula saldo e troco de uma venda.
 * Troco só é devido sobre pagamentos em dinheiro (received > amount),
 * mas para simplificar o modelo o troco é o excedente total pago sobre o total.
 */
export function computePaymentBalance(
  totalCents: Cents,
  payments: Pick<Payment, 'method' | 'amountCents' | 'receivedCents'>[],
): PaymentBalance {
  const paid = sumCents(payments.map((p) => p.amountCents));
  // Excedente em dinheiro (ex.: cliente deu R$ 50 numa compra de R$ 43).
  const cashReceived = sumCents(
    payments
      .filter((p) => p.method === 'CASH')
      .map((p) => (p.receivedCents ?? p.amountCents)),
  );
  const nonCashPaid = sumCents(
    payments.filter((p) => p.method !== 'CASH').map((p) => p.amountCents),
  );
  const totalReceived = cashReceived + nonCashPaid;
  const remaining = Math.max(0, totalCents - paid);
  const change = Math.max(0, totalReceived - totalCents);
  return { totalCents, paidCents: paid, remainingCents: remaining, changeCents: change };
}

/** Uma venda está quitada quando os pagamentos cobrem o total. */
export function isSaleSettled(
  totalCents: Cents,
  payments: Pick<Payment, 'amountCents'>[],
): boolean {
  return sumPayments(payments) >= totalCents;
}
