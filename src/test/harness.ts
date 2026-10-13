import 'fake-indexeddb/auto';
import { PdvDatabase } from '@/infrastructure/db/schema';
import { createRepositories } from '@/infrastructure/db/repositories';
import { EventBus } from '@/application/events';
import { createProduct, type Product } from '@/domain/product';
import type { Repositories } from '@/application/ports/repositories';

let counter = 0;

export interface TestContext {
  db: PdvDatabase;
  repos: Repositories;
  events: EventBus;
  close: () => Promise<void>;
}

/** Cria um banco Dexie isolado (fake-indexeddb) para um teste. */
export async function createTestContext(): Promise<TestContext> {
  const name = `pdv-test-${Date.now()}-${counter++}`;
  const db = new PdvDatabase(name);
  await db.open();
  const repos = createRepositories(db);
  const events = new EventBus();
  return {
    db,
    repos,
    events,
    close: async () => {
      db.close();
      await db.delete();
    },
  };
}

/** Insere um produto de teste e retorna a entidade. */
export async function seedProduct(
  repos: Repositories,
  overrides: Partial<Product> = {},
): Promise<Product> {
  const product = {
    ...createProduct({
      sku: overrides.sku ?? 'SKU1',
      name: overrides.name ?? 'Produto Teste',
      unit: overrides.unit ?? 'UN',
      priceCents: overrides.priceCents ?? 500,
      costCents: overrides.costCents ?? 300,
      barcode: overrides.barcode ?? null,
    }),
    ...overrides,
  };
  await repos.products.put(product);
  return product;
}
