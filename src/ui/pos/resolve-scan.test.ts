import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '@/test/harness';
import { createProduct } from '@/domain/product';
import { defaultSettings } from '@/domain/settings';
import { makeEan13 } from '@/domain/barcode';
import { resolveScan } from './resolve-scan';

let ctx: TestContext;
afterEach(async () => {
  if (ctx) await ctx.close();
});

describe('resolveScan', () => {
  it('resolve código de barras comum com multiplicador', async () => {
    ctx = await createTestContext();
    const ean = makeEan13('789100010010');
    const product = createProduct({ sku: 'A', name: 'Arroz', unit: 'UN', priceCents: 2500, barcode: ean });
    await ctx.repos.products.put(product);

    const res = await resolveScan(ctx.repos.products, defaultSettings(), `3*${ean}`);
    expect('product' in res).toBe(true);
    if ('product' in res) {
      expect(res.product.id).toBe(product.id);
      expect(res.quantityMilli).toBe(3000);
    }
  });

  it('resolve etiqueta de balança por peso (prefixo 2)', async () => {
    ctx = await createTestContext();
    const product = createProduct({
      sku: 'B',
      name: 'Banana',
      unit: 'KG',
      priceCents: 599,
      scaleCode: '000012',
    });
    await ctx.repos.products.put(product);

    const code = makeEan13('2' + '000012' + '01500'); // peso 1,5 kg
    const res = await resolveScan(ctx.repos.products, defaultSettings(), code);
    expect('product' in res).toBe(true);
    if ('product' in res) {
      expect(res.product.id).toBe(product.id);
      expect(res.quantityMilli).toBe(1500);
    }
  });

  it('retorna NOT_FOUND para código desconhecido', async () => {
    ctx = await createTestContext();
    const res = await resolveScan(ctx.repos.products, defaultSettings(), '7899999999994');
    expect('kind' in res && res.kind === 'NOT_FOUND').toBe(true);
  });
});
