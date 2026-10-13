import type { Cents } from '@/domain/money';
import type { PaymentMethod } from '@/domain/sale';
import type { Unit } from '@/domain/quantity';
import type { ReceiptWidth } from '@/domain/settings';
import type { FiscalReceiptExtras } from './fiscal-provider';

/** Dados prontos para renderizar um cupom não fiscal. */
export interface ReceiptData {
  storeName: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  terminalId: string;
  saleNumber: number;
  createdAt: string;
  operatorName: string;
  width: ReceiptWidth;
  items: {
    description: string;
    unit: Unit;
    quantity: number;
    unitPriceCents: Cents;
    discountCents: Cents;
    totalCents: Cents;
  }[];
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  payments: { method: PaymentMethod; amountCents: Cents; receivedCents?: Cents | null }[];
  changeCents: Cents;
  /** Extras fiscais (QR Code, chave) quando houver provider real. */
  fiscal?: FiscalReceiptExtras | null;
}

/** Port de impressão. Adapter atual usa window.print(); futuro: ESC/POS. */
export interface ReceiptPrinter {
  readonly name: string;
  print(data: ReceiptData): Promise<void>;
}
