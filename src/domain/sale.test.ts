import { describe, it, expect } from 'vitest';
import {
  computeItemTotal,
  computeSaleTotals,
  computePaymentBalance,
  isSaleSettled,
  type SaleItem,
  type Payment,
} from './sale';

function item(partial: Partial<SaleItem>): SaleItem {
  return {
    id: 'i',
    createdAt: '',
    updatedAt: '',
    version: 1,
    saleId: 's',
    productId: 'p',
    description: 'x',
    unit: 'UN',
    quantity: 1000,
    unitPriceCents: 100,
    discountCents: 0,
    totalCents: 0,
    canceled: false,
    ...partial,
  };
}

describe('computeItemTotal', () => {
  it('unidades sem desconto', () => {
    expect(computeItemTotal(500, 3000)).toBe(1500);
  });
  it('peso kg', () => {
    expect(computeItemTotal(1290, 1500)).toBe(1935);
  });
  it('com desconto', () => {
    expect(computeItemTotal(1000, 2000, 300)).toBe(1700);
  });
  it('nunca negativo', () => {
    expect(computeItemTotal(100, 1000, 500)).toBe(0);
  });
});

describe('computeSaleTotals', () => {
  it('soma itens e aplica descontos', () => {
    const items = [
      item({ unitPriceCents: 500, quantity: 2000, discountCents: 0 }), // 1000
      item({ unitPriceCents: 1290, quantity: 1500, discountCents: 35 }), // 1935 - 35
    ];
    const t = computeSaleTotals(items, 100);
    expect(t.subtotalCents).toBe(1000 + 1935);
    expect(t.itemDiscountCents).toBe(35);
    expect(t.saleDiscountCents).toBe(100);
    expect(t.totalCents).toBe(2935 - 35 - 100);
  });

  it('ignora itens cancelados', () => {
    const items = [
      item({ unitPriceCents: 1000, quantity: 1000 }),
      item({ unitPriceCents: 9999, quantity: 1000, canceled: true }),
    ];
    const t = computeSaleTotals(items);
    expect(t.subtotalCents).toBe(1000);
    expect(t.totalCents).toBe(1000);
  });

  it('total nunca negativo', () => {
    const items = [item({ unitPriceCents: 100, quantity: 1000 })];
    expect(computeSaleTotals(items, 99999).totalCents).toBe(0);
  });
});

function pay(partial: Partial<Payment>): Payment {
  return {
    id: 'p',
    createdAt: '',
    updatedAt: '',
    version: 1,
    saleId: 's',
    method: 'CASH',
    amountCents: 0,
    receivedCents: null,
    status: 'CONFIRMED',
    ...partial,
  };
}

describe('computePaymentBalance', () => {
  it('troco em dinheiro', () => {
    // Compra R$43,00, cliente dá R$50,00 em dinheiro.
    const b = computePaymentBalance(4300, [
      pay({ method: 'CASH', amountCents: 4300, receivedCents: 5000 }),
    ]);
    expect(b.remainingCents).toBe(0);
    expect(b.changeCents).toBe(700);
  });

  it('pagamento dividido sem troco', () => {
    const b = computePaymentBalance(5000, [
      pay({ method: 'PIX', amountCents: 2000 }),
      pay({ method: 'CREDIT', amountCents: 3000 }),
    ]);
    expect(b.paidCents).toBe(5000);
    expect(b.remainingCents).toBe(0);
    expect(b.changeCents).toBe(0);
  });

  it('pagamento parcial deixa saldo', () => {
    const b = computePaymentBalance(5000, [pay({ method: 'DEBIT', amountCents: 2000 })]);
    expect(b.remainingCents).toBe(3000);
    expect(b.changeCents).toBe(0);
  });

  it('dinheiro + cartão com troco no dinheiro', () => {
    // Total 100. Cartão 60, dinheiro recebido 50 (amount 40). Troco 10.
    const b = computePaymentBalance(10000, [
      pay({ method: 'CREDIT', amountCents: 6000 }),
      pay({ method: 'CASH', amountCents: 4000, receivedCents: 5000 }),
    ]);
    expect(b.remainingCents).toBe(0);
    expect(b.changeCents).toBe(1000);
  });
});

describe('isSaleSettled', () => {
  it('quitada quando cobre o total', () => {
    expect(isSaleSettled(1000, [pay({ amountCents: 1000 })])).toBe(true);
    expect(isSaleSettled(1000, [pay({ amountCents: 999 })])).toBe(false);
  });
});
