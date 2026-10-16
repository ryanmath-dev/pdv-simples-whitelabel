import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '@/test/harness';
import { seedDemoData, isDatabaseEmpty } from './demo-seed';
import { rebuildBalances } from '@/domain/stock';

let ctx: TestContext;
afterEach(async () => {
  if (ctx) await ctx.close();
});

describe('seedDemoData', () => {
  it('popula produtos, usuários, vendas e saldos consistentes com o ledger', async () => {
    ctx = await createTestContext();
    expect(await isDatabaseEmpty(ctx.db)).toBe(true);

    await seedDemoData(ctx.db);

    const products = await ctx.db.products.toArray();
    expect(products.length).toBeGreaterThanOrEqual(60);

    const users = await ctx.db.users.toArray();
    expect(users.map((u) => u.name).sort()).toEqual(['admin', 'caixa']);

    const sales = await ctx.db.sales.toArray();
    expect(sales.length).toBeGreaterThan(50);
    expect(sales.every((s) => s.status === 'FINALIZED')).toBe(true);

    // Itens e pagamentos devem referenciar vendas existentes (sem órfãos).
    const saleIds = new Set(sales.map((s) => s.id));
    const items = await ctx.db.saleItems.toArray();
    const payments = await ctx.db.payments.toArray();
    expect(items.length).toBeGreaterThan(0);
    expect(payments.length).toBe(sales.length);
    expect(items.every((i) => saleIds.has(i.saleId))).toBe(true);
    expect(payments.every((p) => saleIds.has(p.saleId))).toBe(true);

    // Saldo cache deve bater com o ledger recalculado.
    const movements = await ctx.db.stockMovements.toArray();
    const expected = rebuildBalances(movements);
    const balances = await ctx.db.stockBalances.toArray();
    for (const b of balances) {
      expect(b.quantity).toBe(expected.get(b.productId) ?? 0);
    }

    // Deve haver alguns produtos abaixo do mínimo (para relatórios/alertas).
    const below = products.filter((p) => (expected.get(p.id) ?? 0) < p.minStock);
    expect(below.length).toBeGreaterThan(0);

    expect(await isDatabaseEmpty(ctx.db)).toBe(false);
  });
});
