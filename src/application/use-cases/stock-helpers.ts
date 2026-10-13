import { now } from '@/domain/types';
import type { StockMovement } from '@/domain/stock';
import type { Repositories } from '@/application/ports/repositories';

/**
 * Aplica uma lista de movimentos ao cache de saldos (stockBalances),
 * somando a quantidade (com sinal) ao saldo atual de cada produto.
 * Deve ser chamado DENTRO da mesma transação que grava os movimentos.
 * Retorna os ids de produtos afetados.
 */
export async function applyMovementsToBalances(
  repos: Repositories,
  movements: StockMovement[],
): Promise<string[]> {
  const affected = new Set<string>();
  const deltaByProduct = new Map<string, number>();
  for (const m of movements) {
    deltaByProduct.set(m.productId, (deltaByProduct.get(m.productId) ?? 0) + m.quantity);
    affected.add(m.productId);
  }
  const ts = now();
  for (const [productId, delta] of deltaByProduct) {
    const current = await repos.stockBalances.get(productId);
    const quantity = (current?.quantity ?? 0) + delta;
    await repos.stockBalances.put({ productId, quantity, updatedAt: ts });
  }
  return [...affected];
}
