import { describe, it, expect } from 'vitest';
import { balanceFromMovements, rebuildBalances, isBelowMinimum } from './stock';

describe('stock ledger', () => {
  it('balanceFromMovements soma com sinal', () => {
    const movs = [
      { quantity: 10000, deletedAt: null }, // compra 10
      { quantity: -1000, deletedAt: null }, // venda 1
      { quantity: -2000, deletedAt: null }, // venda 2
    ];
    expect(balanceFromMovements(movs)).toBe(7000);
  });

  it('ignora movimentos deletados', () => {
    const movs = [
      { quantity: 10000, deletedAt: null },
      { quantity: -5000, deletedAt: '2026-01-01T00:00:00Z' },
    ];
    expect(balanceFromMovements(movs)).toBe(10000);
  });

  it('rebuildBalances agrupa por produto', () => {
    const movs = [
      { productId: 'a', quantity: 5000, deletedAt: null },
      { productId: 'a', quantity: -2000, deletedAt: null },
      { productId: 'b', quantity: 3000, deletedAt: null },
    ];
    const map = rebuildBalances(movs);
    expect(map.get('a')).toBe(3000);
    expect(map.get('b')).toBe(3000);
  });

  it('isBelowMinimum', () => {
    expect(isBelowMinimum(2000, 5000)).toBe(true);
    expect(isBelowMinimum(5000, 5000)).toBe(false);
  });
});
