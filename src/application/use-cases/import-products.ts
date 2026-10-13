import { makeBase, now } from '@/domain/types';
import type { Category, Product } from '@/domain/product';
import { createProduct } from '@/domain/product';
import type { Unit } from '@/domain/quantity';
import type { Repositories } from '@/application/ports/repositories';

/** Linha de produto já validada, pronta para importação (upsert por SKU). */
export interface ParsedProductRow {
  sku: string;
  name: string;
  barcode: string | null;
  categoryName: string | null;
  unit: Unit;
  priceCents: number;
  costCents: number;
  minStock: number; // milésimos
  scaleCode: string | null;
  active: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  categoriesCreated: number;
}

/**
 * Importa produtos a partir de linhas já validadas. Faz upsert por SKU e
 * cria categorias por nome quando necessário — tudo em uma transação.
 */
export async function importProducts(
  repos: Repositories,
  rows: ParsedProductRow[],
): Promise<ImportResult> {
  return repos.transaction(async () => {
    const existing = await repos.products.getAll();
    const bySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]));

    const categories = await repos.categories.getAll();
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

    let created = 0;
    let updated = 0;
    let categoriesCreated = 0;

    for (const row of rows) {
      let categoryId: string | null = null;
      if (row.categoryName) {
        const key = row.categoryName.toLowerCase();
        let cat = catByName.get(key);
        if (!cat) {
          cat = { ...makeBase(), name: row.categoryName } satisfies Category;
          await repos.categories.put(cat);
          catByName.set(key, cat);
          categoriesCreated++;
        }
        categoryId = cat.id;
      }

      const prior = bySku.get(row.sku.toLowerCase());
      if (prior) {
        const next: Product = {
          ...prior,
          name: row.name,
          barcode: row.barcode,
          categoryId,
          unit: row.unit,
          priceCents: row.priceCents,
          costCents: row.costCents,
          minStock: row.minStock,
          scaleCode: row.scaleCode,
          active: row.active,
          updatedAt: now(),
          version: prior.version + 1,
        };
        await repos.products.put(next);
        updated++;
      } else {
        const next: Product = {
          ...createProduct({
            sku: row.sku,
            name: row.name,
            barcode: row.barcode,
            categoryId,
            unit: row.unit,
            priceCents: row.priceCents,
            costCents: row.costCents,
            minStock: row.minStock,
            scaleCode: row.scaleCode,
            active: row.active,
          }),
        };
        await repos.products.put(next);
        created++;
      }
    }

    return { created, updated, categoriesCreated };
  });
}
