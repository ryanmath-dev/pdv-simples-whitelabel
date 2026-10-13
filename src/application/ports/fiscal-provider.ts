import type { FiscalStatus } from '@/domain/sale';
import type { FiscalSaleSnapshot } from '@/domain/fiscal-snapshot';

export type { FiscalSaleSnapshot };

export interface FiscalResult {
  status: FiscalStatus;
  /** Chave de acesso / protocolo / id externo. */
  ref?: string | null;
  message?: string | null;
}

export interface FiscalReceiptExtras {
  /** Texto do QR Code (NFC-e) ou payload equivalente. */
  qrCodeData?: string | null;
  accessKey?: string | null;
  protocol?: string | null;
  /** Linha(s) de texto adicional para imprimir no rodapé do cupom. */
  extraLines?: string[];
}

/**
 * Port fiscal (pensado para NFC-e modelo 65, mas genérico).
 * NUNCA bloqueia o caixa: a emissão acontece após a venda já finalizada
 * localmente, acionada por um handler do evento SaleFinalized.
 */
export interface FiscalProvider {
  readonly name: string;
  isEnabled(): boolean;
  issue(sale: FiscalSaleSnapshot): Promise<FiscalResult>;
  cancel(saleId: string, reason: string): Promise<FiscalResult>;
  /** Reprocessa emissões pendentes/contingência quando a conexão voltar. */
  retryPending(): Promise<void>;
  receiptExtras(saleId: string): Promise<FiscalReceiptExtras | null>;
}
