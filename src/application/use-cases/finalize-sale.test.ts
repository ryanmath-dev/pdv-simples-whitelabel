import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, seedProduct, type TestContext } from '@/test/harness';
import { finalizeSale, FinalizeSaleError } from './finalize-sale';
import { balanceFromMovements, rebuildBalances } from '@/domain/stock';

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await ctx.close();
});

describe('finalizeSale (atomicidade e estoque)', () => {
  it('grava venda, itens, pagamentos, movimentos e outbox atomicamente', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos, { priceCents: 500, unit: 'UN' });

    const outboxBefore = await ctx.repos.outbox.count();

    const result = await finalizeSale(
      { repos: ctx.repos, events: ctx.events },
      {
        terminalId: 'TERM-01',
        cashSessionId: 'sess-1',
        userId: 'u1',
        items: [
          {
            productId: product.id,
            description: product.name,
            unit: 'UN',
            quantity: 3000,
            unitPriceCents: 500,
            discountCents: 0,
          },
        ],
        payments: [{ method: 'CASH', amountCents: 1500, receivedCents: 2000 }],
      },
    );

    expect(result.sale.totalCents).toBe(1500);
    expect(result.sale.changeCents).toBe(500);
    expect(result.sale.status).toBe('FINALIZED');

    // Persistência
    const savedSale = await ctx.repos.sales.get(result.sale.id);
    expect(savedSale).toBeDefined();
    const items = await ctx.repos.saleItems.listBySale(result.sale.id);
    expect(items).toHaveLength(1);
    const payments = await ctx.repos.payments.listBySale(result.sale.id);
    expect(payments).toHaveLength(1);
    const movements = await ctx.repos.stockMovements.listByProduct(product.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantity).toBe(-3000);

    // Outbox: sale + item + payment + movement = 4 novas entradas
    const outboxAfter = await ctx.repos.outbox.count();
    expect(outboxAfter - outboxBefore).toBe(4);

    // Saldo cache == rebuild do ledger
    const balance = await ctx.repos.stockBalances.get(product.id);
    expect(balance!.quantity).toBe(-3000);
    const allMovs = await ctx.repos.stockMovements.listAll();
    expect(balanceFromMovements(allMovs)).toBe(-3000);
    expect(rebuildBalances(allMovs).get(product.id)).toBe(balance!.quantity);
  });

  it('reverte tudo se uma escrita falhar no meio da transação', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos);

    // Sabota o put de pagamento para forçar erro após gravar a venda.
    const original = ctx.repos.payments.put.bind(ctx.repos.payments);
    ctx.repos.payments.put = () => Promise.reject(new Error('falha simulada'));

    const salesBefore = (await ctx.repos.sales.getAll()).length;
    const movsBefore = (await ctx.repos.stockMovements.listAll()).length;

    await expect(
      finalizeSale(
        { repos: ctx.repos, events: ctx.events },
        {
          terminalId: 'TERM-01',
          cashSessionId: 'sess-1',
          userId: 'u1',
          items: [
            {
              productId: product.id,
              description: product.name,
              unit: 'UN',
              quantity: 1000,
              unitPriceCents: 500,
              discountCents: 0,
            },
          ],
          payments: [{ method: 'CASH', amountCents: 500 }],
        },
      ),
    ).rejects.toThrow();

    ctx.repos.payments.put = original;

    // Nada deve ter sido persistido (rollback atômico).
    expect((await ctx.repos.sales.getAll()).length).toBe(salesBefore);
    expect((await ctx.repos.stockMovements.listAll()).length).toBe(movsBefore);
    const balance = await ctx.repos.stockBalances.get(product.id);
    expect(balance).toBeUndefined();
  });

  it('rejeita venda sem itens', async () => {
    ctx = await createTestContext();
    await expect(
      finalizeSale(
        { repos: ctx.repos, events: ctx.events },
        {
          terminalId: 'TERM-01',
          cashSessionId: 'sess-1',
          userId: 'u1',
          items: [],
          payments: [],
        },
      ),
    ).rejects.toThrow(FinalizeSaleError);
  });

  it('rejeita pagamento insuficiente', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos, { priceCents: 1000 });
    await expect(
      finalizeSale(
        { repos: ctx.repos, events: ctx.events },
        {
          terminalId: 'TERM-01',
          cashSessionId: 'sess-1',
          userId: 'u1',
          items: [
            {
              productId: product.id,
              description: product.name,
              unit: 'UN',
              quantity: 1000,
              unitPriceCents: 1000,
              discountCents: 0,
            },
          ],
          payments: [{ method: 'CASH', amountCents: 500 }],
        },
      ),
    ).rejects.toThrow(/insuficiente/i);
  });

  it('publica SaleFinalized e StockChanged após commit', async () => {
    ctx = await createTestContext();
    const product = await seedProduct(ctx.repos);
    let finalizedFired = false;
    let stockFired = false;
    ctx.events.on('SaleFinalized', () => {
      finalizedFired = true;
    });
    ctx.events.on('StockChanged', () => {
      stockFired = true;
    });

    await finalizeSale(
      { repos: ctx.repos, events: ctx.events },
      {
        terminalId: 'TERM-01',
        cashSessionId: 'sess-1',
        userId: 'u1',
        items: [
          {
            productId: product.id,
            description: product.name,
            unit: 'UN',
            quantity: 1000,
            unitPriceCents: 500,
            discountCents: 0,
          },
        ],
        payments: [{ method: 'PIX', amountCents: 500 }],
      },
    );

    expect(finalizedFired).toBe(true);
    expect(stockFired).toBe(true);
  });
});
