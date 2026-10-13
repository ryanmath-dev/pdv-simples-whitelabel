import { now } from '@/domain/types';
import { buildFiscalSnapshot } from '@/domain/fiscal-snapshot';
import { defaultSettings } from '@/domain/settings';
import type { FiscalProvider } from '@/application/ports/fiscal-provider';
import type { Repositories } from '@/application/ports/repositories';
import type { EventBus } from '@/application/events';

/**
 * Registra o handler fiscal: assina SaleFinalized, monta o snapshot e aciona
 * o provider para emitir. O resultado atualiza fiscalStatus/fiscalRef da venda.
 * Nunca bloqueia o caixa — roda após a venda já finalizada e isola erros.
 *
 * Retorna uma função para desinscrever (útil em testes/HMR).
 */
export function registerFiscalHandler(
  repos: Repositories,
  events: EventBus,
  provider: FiscalProvider,
): () => void {
  return events.on('SaleFinalized', async ({ sale }) => {
    if (!provider.isEnabled()) return; // Noop: mantém NOT_REQUIRED.

    const [items, payments, settings] = await Promise.all([
      repos.saleItems.listBySale(sale.id),
      repos.payments.listBySale(sale.id),
      repos.settings.get(),
    ]);

    const snapshot = buildFiscalSnapshot({
      sale,
      items,
      payments,
      settings: settings ?? defaultSettings(),
    });

    const result = await provider.issue(snapshot);

    const current = await repos.sales.get(sale.id);
    if (!current) return;
    await repos.sales.put({
      ...current,
      fiscalStatus: result.status,
      fiscalRef: result.ref ?? null,
      updatedAt: now(),
      version: current.version + 1,
    });
  });
}
