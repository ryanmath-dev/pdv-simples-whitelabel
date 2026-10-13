import { z } from 'zod';
import { baseEntitySchema, type BaseEntity, type IsoDate } from './types';
import { sumCents, type Cents } from './money';
import type { PaymentMethod } from './sale';

export type CashMovementType = 'SUPPLY' | 'WITHDRAWAL'; // suprimento / sangria

export interface CashSession extends BaseEntity {
  terminalId: string;
  userId: string;
  openedAt: IsoDate;
  openingCents: Cents; // fundo de troco
  closedAt?: IsoDate | null;
  countedCents?: Cents | null; // valor contado (fechamento cego)
  expectedCents?: Cents | null; // valor esperado calculado
  differenceCents?: Cents | null;
}

export interface CashMovement extends BaseEntity {
  cashSessionId: string;
  type: CashMovementType;
  amountCents: Cents;
  reason: string;
  userId: string;
}

export const cashSessionSchema = baseEntitySchema.extend({
  terminalId: z.string(),
  userId: z.string(),
  openedAt: z.string(),
  openingCents: z.number().int().nonnegative(),
  closedAt: z.string().nullable().optional(),
  countedCents: z.number().int().nonnegative().nullable().optional(),
  expectedCents: z.number().int().nullable().optional(),
  differenceCents: z.number().int().nullable().optional(),
});

export const cashMovementSchema = baseEntitySchema.extend({
  cashSessionId: z.string(),
  type: z.enum(['SUPPLY', 'WITHDRAWAL']),
  amountCents: z.number().int().nonnegative(),
  reason: z.string().min(1, 'Motivo obrigatório'),
  userId: z.string(),
});

export interface CashCloseSummary {
  openingCents: Cents;
  /** Total recebido em dinheiro nas vendas. */
  cashSalesCents: Cents;
  supplyCents: Cents;
  withdrawalCents: Cents;
  /** Esperado na gaveta = abertura + vendas em dinheiro + suprimentos - sangrias. */
  expectedCents: Cents;
  /** Resumo por forma de pagamento (todas as vendas da sessão). */
  byMethod: Record<PaymentMethod, Cents>;
  totalSalesCents: Cents;
}

const EMPTY_BY_METHOD: Record<PaymentMethod, Cents> = {
  CASH: 0,
  PIX: 0,
  DEBIT: 0,
  CREDIT: 0,
  STORE_CREDIT: 0,
};

/**
 * Calcula o resumo de fechamento (esperado) a partir dos dados da sessão.
 * Apenas dinheiro impacta a gaveta física; demais formas entram no resumo.
 */
export function computeCloseSummary(params: {
  openingCents: Cents;
  payments: { method: PaymentMethod; amountCents: Cents }[];
  movements: { type: CashMovementType; amountCents: Cents }[];
}): CashCloseSummary {
  const byMethod: Record<PaymentMethod, Cents> = { ...EMPTY_BY_METHOD };
  for (const p of params.payments) {
    byMethod[p.method] += p.amountCents;
  }
  const cashSales = byMethod.CASH;
  const supply = sumCents(
    params.movements.filter((m) => m.type === 'SUPPLY').map((m) => m.amountCents),
  );
  const withdrawal = sumCents(
    params.movements.filter((m) => m.type === 'WITHDRAWAL').map((m) => m.amountCents),
  );
  const expected = params.openingCents + cashSales + supply - withdrawal;
  const totalSales = sumCents(Object.values(byMethod));
  return {
    openingCents: params.openingCents,
    cashSalesCents: cashSales,
    supplyCents: supply,
    withdrawalCents: withdrawal,
    expectedCents: expected,
    byMethod,
    totalSalesCents: totalSales,
  };
}

/** Diferença no fechamento cego: contado - esperado (negativo = falta). */
export function cashDifference(countedCents: Cents, expectedCents: Cents): Cents {
  return countedCents - expectedCents;
}
