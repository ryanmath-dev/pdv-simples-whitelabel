import { describe, it, expect, afterEach } from 'vitest';
import { parseProductsCsv, csvTemplate } from './product-csv';
import { importProducts } from '@/application/use-cases/import-products';
import { createTestContext, type TestContext } from '@/test/harness';

describe('parseProductsCsv', () => {
  it('interpreta o modelo sem erros', () => {
    const res = parseProductsCsv(csvTemplate());
    expect(res.errors).toHaveLength(0);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]!.priceCents).toBe(2590);
    expect(res.rows[1]!.unit).toBe('KG');
    expect(res.rows[1]!.minStock).toBe(2000);
  });

  it('reporta erros de EAN e preço', () => {
    const csv = [
      'sku,nome,codigo_barras,categoria,unidade,preco,custo,estoque_minimo,codigo_balanca,ativo',
      'X,Produto,1234567890123,Cat,UN,abc,,,,sim', // EAN inválido + preço inválido
      ',SemSku,,,UN,10,,,,sim', // sem sku
    ].join('\n');
    const res = parseProductsCsv(csv);
    expect(res.rows).toHaveLength(0);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('importProducts', () => {
  let ctx: TestContext;
  afterEach(async () => {
    if (ctx) await ctx.close();
  });

  it('cria produtos e categorias, e atualiza por SKU', async () => {
    ctx = await createTestContext();
    const first = parseProductsCsv(csvTemplate()).rows;
    const r1 = await importProducts(ctx.repos, first);
    expect(r1.created).toBe(2);
    expect(r1.categoriesCreated).toBe(2);

    // Reimportar atualiza (não duplica).
    const r2 = await importProducts(ctx.repos, first);
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(2);

    const all = await ctx.repos.products.getAll();
    expect(all).toHaveLength(2);
    const cats = await ctx.repos.categories.getAll();
    expect(cats).toHaveLength(2);
  });
});
