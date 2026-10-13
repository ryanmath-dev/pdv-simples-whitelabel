import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, seedProduct, type TestContext } from '@/test/harness';
import { finalizeSale } from './finalize-sale';
import { cancelSale } from './cancel-sale';
import { openCashRegister, OpenCashRegisterError } from './open-cash-register';
import { closeCashRegister } from './close-cash-register';
import { registerCashMovement } from './cash-movement';

let ctx: TestContext;
afterEach(async () => {
  if (ctx) await ctx.close();
});

describe('cancelSale', () => {
  it('estorna o estoque e marca a venda como CANCELED', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos, { priceCents: 1000 });
    const deps = { repos: ctx.repos, events: ctx.events };

    const { sale } = await finalizeSale(deps, {
      terminalId: 'T1',
      cashSessionId: 's1',
      userId: 'u1',
      items: [
        {
          productId: product.id,
          description: product.name,
          unit: 'UN',
          quantity: 2000,
          unitPriceCents: 1000,
          discountCents: 0,
        },
      ],
      payments: [{ method: 'CASH', amountCents: 2000, receivedCents: 2000 }],
    });

    expect((await ctx.repos.stockBalances.get(product.id))!.quantity).toBe(-2000);

    const canceled = await cancelSale(deps, {
      saleId: sale.id,
      userId: 'u1',
      reason: 'teste',
    });

    expect(canceled.status).toBe('CANCELED');
    // Estoque volta a zero (saída -2000 + estorno +2000).
    expect((await ctx.repos.stockBalances.get(product.id))!.quantity).toBe(0);
    const audits = await ctx.repos.auditLogs.listRecent(10);
    expect(audits.some((a) => a.action === 'SALE_CANCEL')).toBe(true);
  });
});

describe('caixa (sessão)', () => {
  it('abre, impede abertura dupla, registra movimentos e fecha com diferença', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos, { priceCents: 1000 });
    const deps = { repos: ctx.repos, events: ctx.events };

    const session = await openCashRegister(ctx.repos, {
      terminalId: 'T1',
      userId: 'u1',
      openingCents: 10000, // R$100 fundo
    });

    await expect(
      openCashRegister(ctx.repos, { terminalId: 'T1', userId: 'u1', openingCents: 5000 }),
    ).rejects.toThrow(OpenCashRegisterError);

    // Venda em dinheiro de R$20
    await finalizeSale(deps, {
      terminalId: 'T1',
      cashSessionId: session.id,
      userId: 'u1',
      items: [
        {
          productId: product.id,
          description: product.name,
          unit: 'UN',
          quantity: 2000,
          unitPriceCents: 1000,
          discountCents: 0,
        },
      ],
      payments: [{ method: 'CASH', amountCents: 2000, receivedCents: 2000 }],
    });

    await registerCashMovement(ctx.repos, {
      cashSessionId: session.id,
      userId: 'u1',
      type: 'SUPPLY',
      amountCents: 3000,
      reason: 'troco extra',
    });
    await registerCashMovement(ctx.repos, {
      cashSessionId: session.id,
      userId: 'u1',
      type: 'WITHDRAWAL',
      amountCents: 1000,
      reason: 'sangria',
    });

    // Esperado = 10000 + 2000 (venda) + 3000 (suprimento) - 1000 (sangria) = 14000
    const { session: closed, summary } = await closeCashRegister(ctx.repos, {
      sessionId: session.id,
      userId: 'u1',
      countedCents: 13900, // faltam 100
    });

    expect(summary.expectedCents).toBe(14000);
    expect(closed.differenceCents).toBe(-100);
    expect(closed.closedAt).toBeTruthy();
  });
});
