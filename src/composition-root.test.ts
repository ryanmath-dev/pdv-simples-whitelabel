import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { createContainer, type AppContainer } from './composition-root';
import { createProduct } from '@/domain/product';
import { defaultSettings } from '@/domain/settings';
import { finalizeSale } from '@/application/use-cases/finalize-sale';

let container: AppContainer;

afterEach(async () => {
  if (container) {
    container.db.close();
    await container.db.delete();
  }
});

async function setup(fiscalProvider: string): Promise<AppContainer> {
  const c = createContainer({
    fiscalProvider,
    demoMode: false,
    dbName: `pdv-comp-${Date.now()}-${Math.random()}`,
  });
  await c.db.open();
  await c.repos.settings.put(defaultSettings());
  return c;
}

async function sellOne(c: AppContainer) {
  const product = createProduct({ sku: 'X', name: 'Café', unit: 'UN', priceCents: 1000 });
  await c.repos.products.put(product);
  return finalizeSale(
    { repos: c.repos, events: c.events },
    {
      terminalId: 'T1',
      cashSessionId: 's1',
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
      payments: [{ method: 'CASH', amountCents: 1000, receivedCents: 1000 }],
    },
  );
}

describe('composition-root: troca de provider fiscal', () => {
  it('NoopFiscalProvider mantém a venda como NOT_REQUIRED', async () => {
    container = await setup('noop');
    const { sale } = await sellOne(container);
    const saved = await container.repos.sales.get(sale.id);
    expect(saved!.fiscalStatus).toBe('NOT_REQUIRED');
    expect(await container.fiscal.receiptExtras(sale.id)).toBeNull();
  });

  it('FakeFiscalProvider marca AUTHORIZED e adiciona QR fictício ao cupom', async () => {
    container = await setup('fake');
    const { sale } = await sellOne(container);
    const saved = await container.repos.sales.get(sale.id);
    expect(saved!.fiscalStatus).toBe('AUTHORIZED');
    expect(saved!.fiscalRef).toBeTruthy();
    const extras = await container.fiscal.receiptExtras(sale.id);
    expect(extras).not.toBeNull();
    expect(extras!.qrCodeData).toContain('nfce');
    expect(extras!.accessKey).toHaveLength(44);
  });
});
