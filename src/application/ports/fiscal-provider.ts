import type { Cents } from '@/domain/money';
import type { FiscalStatus, PaymentMethod } from '@/domain/sale';
import type { Unit } from '@/domain/quantity';

/** Snapshot imutável de uma venda, montado por função pura no domínio. */
export interface FiscalSaleSnapshot {
  saleId: string;
  number: number;
  createdAt: string;
  emitter: {
    storeName: string;
    cnpj?: string | null;
    address?: string | null;
  };
  customer?: {
    document?: string | null;
  } | null;
  items: {
    description: string;
    unit: Unit;
    quantity: number; // milésimos
    unitPriceCents: Cents;
    discountCents: Cents;
    totalCents: Cents;
    // Campos fiscais (hoje opcionais/ausentes)
    ncm?: string | null;
    cfop?: string | null;
  }[];
  payments: {
    method: PaymentMethod;
    amountCents: Cents;
  }[];
  totalCents: Cents;
  discountCents: Cents;
}

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
