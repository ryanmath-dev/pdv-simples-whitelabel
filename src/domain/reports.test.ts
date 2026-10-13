import { describe, it, expect } from 'vitest';
import { salesByDay, salesTotals, paymentsByMethod, productSales, abcCurve } from './reports';
import type { Sale, SaleItem, Payment } from './sale';

function sale(p: Partial<Sale>): Sale {
  return {
    id: 's',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '',
    version: 1,
    number: 1,
    terminalId: 'T',
    cashSessionId: 'c',
    userId: 'u',
    status: 'FINALIZED',
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    changeCents: 0,
    fiscalStatus: 'NOT_REQUIRED',
    finalizedAt: '2026-10-10T10:00:00.000Z',
    ...p,
  };
}

describe('reports', () => {
  it('salesByDay agrupa por dia', () => {
    const r = salesByDay([
      sale({ totalCents: 1000, finalizedAt: '2026-10-10T10:00:00Z' }),
      sale({ totalCents: 2000, finalizedAt: '2026-10-10T15:00:00Z' }),
      sale({ totalCents: 500, finalizedAt: '2026-10-11T09:00:00Z' }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2026-10-10', totalCents: 3000, count: 2 });
    expect(r[1]!.totalCents).toBe(500);
  });

  it('salesTotals calcula ticket médio', () => {
    const t = salesTotals([sale({ totalCents: 1000 }), sale({ totalCents: 3000 })]);
    expect(t.totalCents).toBe(4000);
    expect(t.count).toBe(2);
    expect(t.avgTicketCents).toBe(2000);
  });

  it('paymentsByMethod soma', () => {
    const payments: Payment[] = [
      { method: 'CASH', amountCents: 1000 } as Payment,
      { method: 'PIX', amountCents: 500 } as Payment,
      { method: 'CASH', amountCents: 200 } as Payment,
    ];
    const r = paymentsByMethod(payments);
    expect(r.CASH).toBe(1200);
    expect(r.PIX).toBe(500);
  });

  it('productSales e curva ABC', () => {
    const items: SaleItem[] = [
      { productId: 'a', description: 'A', quantity: 1000, totalCents: 8000, canceled: false } as SaleItem,
      { productId: 'b', description: 'B', quantity: 1000, totalCents: 1500, canceled: false } as SaleItem,
      { productId: 'c', description: 'C', quantity: 1000, totalCents: 500, canceled: false } as SaleItem,
    ];
    const cost = new Map([['a', 4000]]);
    const ps = productSales(items, cost);
    expect(ps[0]!.productId).toBe('a');
    expect(ps[0]!.marginCents).toBe(8000 - 4000);

    const abc = abcCurve(ps);
    expect(abc[0]!.abc).toBe('A'); // 80%
    expect(abc[1]!.abc).toBe('B'); // 95%
    expect(abc[2]!.abc).toBe('C'); // resto
  });
});
