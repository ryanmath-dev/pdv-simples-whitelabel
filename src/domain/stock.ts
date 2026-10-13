import { z } from 'zod';
import { baseEntitySchema, type BaseEntity, type IsoDate } from './types';
import { sumMilli, type Milli } from './quantity';
import type { Cents } from './money';

/**
 * Tipos de movimento do ledger de estoque. O ledger é a fonte da verdade:
 * o saldo é sempre recalculável somando as quantidades (com sinal).
 * Convenção de sinal: entradas positivas, saídas negativas.
 */
export type StockMovementType =
  | 'SALE' // saída por venda (negativo)
  | 'SALE_CANCEL' // estorno de venda (positivo)
  | 'PURCHASE' // entrada de mercadoria (positivo)
  | 'ADJUSTMENT' // ajuste manual (qualquer sinal)
  | 'INVENTORY' // acerto por inventário (qualquer sinal)
  | 'LOSS'; // perda/quebra/vencimento (negativo)

export const stockMovementTypeSchema = z.enum([
  'SALE',
  'SALE_CANCEL',
  'PURCHASE',
  'ADJUSTMENT',
  'INVENTORY',
  'LOSS',
]);

export interface StockMovement extends BaseEntity {
  productId: string;
  type: StockMovementType;
  quantity: Milli; // milésimos, com sinal
  unitCostCents?: Cents | null;
  refType?: string | null; // ex.: 'SALE', 'PURCHASE'
  refId?: string | null; // id da venda/entrada que originou
  reason?: string | null;
  userId: string;
}

export const stockMovementSchema = baseEntitySchema.extend({
  productId: z.string(),
  type: stockMovementTypeSchema,
  quantity: z.number().int(),
  unitCostCents: z.number().int().nonnegative().nullable().optional(),
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  userId: z.string(),
});

export interface StockBalance {
  productId: string;
  quantity: Milli; // saldo em milésimos
  updatedAt: IsoDate;
}

/**
 * Calcula o saldo de um produto somando as quantidades (com sinal) dos
 * movimentos do ledger. Ignora movimentos com soft delete.
 */
export function balanceFromMovements(
  movements: Pick<StockMovement, 'quantity' | 'deletedAt'>[],
): Milli {
  return sumMilli(movements.filter((m) => !m.deletedAt).map((m) => m.quantity));
}

/**
 * Recalcula os saldos de todos os produtos a partir da lista completa de
 * movimentos. Retorna um mapa productId -> quantidade.
 * Função pura: a persistência (cache stockBalances) é responsabilidade do repo.
 */
export function rebuildBalances(
  movements: Pick<StockMovement, 'productId' | 'quantity' | 'deletedAt'>[],
): Map<string, Milli> {
  const byProduct = new Map<string, Milli>();
  for (const m of movements) {
    if (m.deletedAt) continue;
    byProduct.set(m.productId, (byProduct.get(m.productId) ?? 0) + m.quantity);
  }
  return byProduct;
}

/** Verdadeiro se o saldo está abaixo do mínimo configurado. */
export function isBelowMinimum(balanceMilli: Milli, minStockMilli: Milli): boolean {
  return balanceMilli < minStockMilli;
}
