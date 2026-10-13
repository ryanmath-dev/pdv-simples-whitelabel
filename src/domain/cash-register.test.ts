import { describe, it, expect } from 'vitest';
import { computeCloseSummary, cashDifference } from './cash-register';

describe('cash register', () => {
  it('computeCloseSummary calcula esperado e por forma', () => {
    const s = computeCloseSummary({
      openingCents: 10000, // R$100 fundo
      payments: [
        { method: 'CASH', amountCents: 5000 },
        { method: 'CASH', amountCents: 3000 },
        { method: 'PIX', amountCents: 2000 },
        { method: 'CREDIT', amountCents: 4000 },
      ],
      movements: [
        { type: 'SUPPLY', amountCents: 2000 },
        { type: 'WITHDRAWAL', amountCents: 1500 },
      ],
    });
    expect(s.cashSalesCents).toBe(8000);
    expect(s.supplyCents).toBe(2000);
    expect(s.withdrawalCents).toBe(1500);
    // 10000 + 8000 + 2000 - 1500
    expect(s.expectedCents).toBe(18500);
    expect(s.byMethod.CASH).toBe(8000);
    expect(s.byMethod.PIX).toBe(2000);
    expect(s.byMethod.CREDIT).toBe(4000);
    expect(s.totalSalesCents).toBe(14000);
  });

  it('cashDifference: sobra e falta', () => {
    expect(cashDifference(18500, 18500)).toBe(0);
    expect(cashDifference(18000, 18500)).toBe(-500); // falta
    expect(cashDifference(19000, 18500)).toBe(500); // sobra
  });
});
