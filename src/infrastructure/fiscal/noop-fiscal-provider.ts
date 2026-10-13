import type {
  FiscalProvider,
  FiscalReceiptExtras,
  FiscalResult,
  FiscalSaleSnapshot,
} from '@/application/ports/fiscal-provider';

/**
 * Provider fiscal nulo (padrão da demo). Não emite documento algum:
 * toda venda fica com fiscalStatus = 'NOT_REQUIRED'.
 */
export class NoopFiscalProvider implements FiscalProvider {
  readonly name = 'noop';

  isEnabled(): boolean {
    return false;
  }

  async issue(_sale: FiscalSaleSnapshot): Promise<FiscalResult> {
    return { status: 'NOT_REQUIRED', ref: null, message: null };
  }

  async cancel(_saleId: string, _reason: string): Promise<FiscalResult> {
    return { status: 'NOT_REQUIRED', ref: null };
  }

  async retryPending(): Promise<void> {
    // Nada a fazer.
  }

  async receiptExtras(_saleId: string): Promise<FiscalReceiptExtras | null> {
    return null;
  }
}
