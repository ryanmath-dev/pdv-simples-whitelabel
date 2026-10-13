import type { ReceiptData } from '@/application/ports/printer';
import type { FiscalReceiptExtras } from '@/application/ports/fiscal-provider';
import type { Sale, SaleItem, Payment } from '@/domain/sale';
import type { StoreSettings } from '@/domain/settings';

/** Monta os dados do cupom a partir de uma venda finalizada. */
export function buildReceiptData(params: {
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
  settings: StoreSettings;
  operatorName: string;
  fiscal?: FiscalReceiptExtras | null;
}): ReceiptData {
  const { sale, items, payments, settings, operatorName, fiscal } = params;
  return {
    storeName: settings.storeName,
    cnpj: settings.cnpj,
    address: settings.address,
    phone: settings.phone,
    terminalId: settings.terminalId,
    saleNumber: sale.number,
    createdAt: sale.finalizedAt ?? sale.createdAt,
    operatorName,
    width: settings.receiptWidth,
    items: items
      .filter((i) => !i.canceled)
      .map((i) => ({
        description: i.description,
        unit: i.unit,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        discountCents: i.discountCents,
        totalCents: i.totalCents,
      })),
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    totalCents: sale.totalCents,
    payments: payments.map((p) => ({
      method: p.method,
      amountCents: p.amountCents,
      receivedCents: p.receivedCents,
    })),
    changeCents: sale.changeCents,
    fiscal: fiscal ?? null,
  };
}
