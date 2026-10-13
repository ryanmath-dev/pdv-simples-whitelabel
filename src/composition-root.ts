/**
 * Composition root: ÚNICO lugar onde escolhemos quais adapters usar.
 * Trocar um provider (fiscal, pagamento, sync, impressora) é mudar apenas
 * aqui — o resto do app depende somente das ports.
 */
import { PdvDatabase } from '@/infrastructure/db/schema';
import { createRepositories } from '@/infrastructure/db/repositories';
import { EventBus } from '@/application/events';
import { registerFiscalHandler } from '@/application/fiscal-handler';

import type { FiscalProvider } from '@/application/ports/fiscal-provider';
import type { PaymentProvider } from '@/application/ports/payment-provider';
import type { ReceiptPrinter } from '@/application/ports/printer';
import type { SyncAdapter } from '@/application/ports/sync-adapter';
import type { Repositories } from '@/application/ports/repositories';

import { NoopFiscalProvider } from '@/infrastructure/fiscal/noop-fiscal-provider';
import { FakeFiscalProvider } from '@/infrastructure/fiscal/fake-fiscal-provider';
import { ManualPaymentProvider } from '@/infrastructure/payment/manual-payment-provider';
import { LocalOnlySyncAdapter } from '@/infrastructure/sync/local-only-sync-adapter';
import { HttpSyncAdapter } from '@/infrastructure/sync/http-sync-adapter';
import { BrowserReceiptPrinter } from '@/infrastructure/printing/browser-receipt-printer';

export interface AppContainer {
  db: PdvDatabase;
  repos: Repositories;
  events: EventBus;
  fiscal: FiscalProvider;
  payment: PaymentProvider;
  printer: ReceiptPrinter;
  sync: SyncAdapter;
  demoMode: boolean;
}

export interface CompositionOptions {
  /** Sobrescreve a escolha de provider fiscal ('noop' | 'fake'). */
  fiscalProvider?: string;
  /** URL de sync; se definida, usa HttpSyncAdapter. */
  syncUrl?: string;
  demoMode?: boolean;
  dbName?: string;
}

function pickFiscalProvider(name: string | undefined): FiscalProvider {
  switch (name) {
    case 'fake':
      return new FakeFiscalProvider();
    case 'noop':
    default:
      return new NoopFiscalProvider();
  }
}

function pickSyncAdapter(syncUrl: string | undefined): SyncAdapter {
  if (syncUrl && syncUrl.trim() !== '') {
    return new HttpSyncAdapter(syncUrl.trim());
  }
  return new LocalOnlySyncAdapter();
}

/** Monta o container da aplicação a partir das opções (ou do import.meta.env). */
export function createContainer(options: CompositionOptions = {}): AppContainer {
  const fiscalName = options.fiscalProvider ?? import.meta.env.VITE_FISCAL_PROVIDER;
  const syncUrl = options.syncUrl ?? import.meta.env.VITE_SYNC_URL;
  const demoMode =
    options.demoMode ?? String(import.meta.env.VITE_DEMO_MODE).toLowerCase() === 'true';

  const db = new PdvDatabase(options.dbName);
  const repos = createRepositories(db);
  const events = new EventBus();

  const fiscal = pickFiscalProvider(fiscalName);
  const payment = new ManualPaymentProvider();
  const printer = new BrowserReceiptPrinter();
  const sync = pickSyncAdapter(syncUrl);

  // Assina o evento fiscal (NFC-e futura): ligar um provider real é só trocar
  // pickFiscalProvider acima — o fluxo do caixa não muda.
  registerFiscalHandler(repos, events, fiscal);

  return { db, repos, events, fiscal, payment, printer, sync, demoMode };
}
