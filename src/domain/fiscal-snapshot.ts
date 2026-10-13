import type { Cents } from './money';
import type { Unit } from './quantity';
import type { Sale, SaleItem, Payment, PaymentMethod } from './sale';
import type { StoreSettings } from './settings';

/**
 * Snapshot imutável de uma venda, com tudo que um emissor fiscal (ex.: NFC-e
 * modelo 65) precisaria. Vive no domínio e é montado por função pura.
 */
export interface FiscalSaleSnapshot {
  saleId: string;
  number: number;
  createdAt: string;
  emitter: {
    storeName: string;
    cnpj?: string | null;
    address?: string | null;
  };
  customer?: { document?: string | null } | null;
  items: {
    description: string;
    unit: Unit;
    quantity: number; // milésimos
    unitPriceCents: Cents;
    discountCents: Cents;
    totalCents: Cents;
    ncm?: string | null;
    cfop?: string | null;
  }[];
  payments: { method: PaymentMethod; amountCents: Cents }[];
  totalCents: Cents;
  discountCents: Cents;
}

/** Monta (de forma pura) o snapshot fiscal de uma venda. */
export function buildFiscalSnapshot(params: {
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
  settings: Pick<StoreSettings, 'storeName' | 'cnpj' | 'address'>;
  itemFiscal?: Record<string, { ncm?: string | null; cfop?: string | null }>;
}): FiscalSaleSnapshot {
  const { sale, items, payments, settings, itemFiscal } = params;
  return {
    saleId: sale.id,
    number: sale.number,
    createdAt: sale.createdAt,
    emitter: {
      storeName: settings.storeName,
      cnpj: settings.cnpj ?? null,
      address: settings.address ?? null,
    },
    customer: sale.customerDocument ? { document: sale.customerDocument } : null,
    items: items
      .filter((i) => !i.canceled)
      .map((i) => ({
        description: i.description,
        unit: i.unit,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        discountCents: i.discountCents,
        totalCents: i.totalCents,
        ncm: itemFiscal?.[i.productId]?.ncm ?? null,
        cfop: itemFiscal?.[i.productId]?.cfop ?? null,
      })),
    payments: payments.map((p) => ({ method: p.method, amountCents: p.amountCents })),
    totalCents: sale.totalCents,
    discountCents: sale.discountCents,
  };
}
