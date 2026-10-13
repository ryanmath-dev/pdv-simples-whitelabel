import { formatBRL } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import type { ReceiptData } from '@/application/ports/printer';
import type { PaymentMethod } from '@/domain/sale';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  STORE_CREDIT: 'Crédito na loja',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renderiza o cupom NÃO fiscal como HTML (função pura, testável).
 * Largura 58mm (~32 colunas) ou 80mm (~48 colunas) via CSS.
 */
export function renderReceiptHtml(data: ReceiptData): string {
  const widthMm = data.width === '58mm' ? 58 : 80;
  const dt = new Date(data.createdAt);
  const dateStr = dt.toLocaleString('pt-BR');

  const itemsHtml = data.items
    .map((i) => {
      const qty = formatQuantity(i.quantity, i.unit);
      const line1 = `<div class="it-name">${escapeHtml(i.description)}</div>`;
      const line2 =
        `<div class="it-calc">` +
        `<span>${qty} ${i.unit} x ${formatBRL(i.unitPriceCents)}` +
        (i.discountCents > 0 ? ` (-${formatBRL(i.discountCents)})` : '') +
        `</span>` +
        `<span class="it-total">${formatBRL(i.totalCents)}</span>` +
        `</div>`;
      return `<div class="item">${line1}${line2}</div>`;
    })
    .join('');

  const paymentsHtml = data.payments
    .map(
      (p) =>
        `<div class="row"><span>${METHOD_LABELS[p.method]}</span><span>${formatBRL(p.amountCents)}</span></div>`,
    )
    .join('');

  const fiscalHtml = data.fiscal
    ? `<div class="sep"></div><div class="center fiscal">` +
      (data.fiscal.extraLines ?? []).map((l) => `<div>${escapeHtml(l)}</div>`).join('') +
      (data.fiscal.qrCodeData
        ? `<div class="qr">QR: ${escapeHtml(data.fiscal.qrCodeData)}</div>`
        : '') +
      `</div>`
    : '';

  return `
<div class="receipt w-${widthMm}">
  <style>
    #receipt-print .receipt { font-family: 'Courier New', monospace; color: #000; }
    #receipt-print .w-58 { width: 58mm; font-size: 10px; }
    #receipt-print .w-80 { width: 80mm; font-size: 12px; }
    #receipt-print .center { text-align: center; }
    #receipt-print .bold { font-weight: bold; }
    #receipt-print .big { font-size: 1.4em; font-weight: bold; }
    #receipt-print .sep { border-top: 1px dashed #000; margin: 4px 0; }
    #receipt-print .row { display: flex; justify-content: space-between; }
    #receipt-print .item { margin-bottom: 2px; }
    #receipt-print .it-calc { display: flex; justify-content: space-between; }
    #receipt-print .it-total { white-space: nowrap; }
    #receipt-print .fiscal { font-size: 0.85em; word-break: break-all; }
    #receipt-print .qr { margin-top: 2px; word-break: break-all; }
  </style>
  <div class="center bold">${escapeHtml(data.storeName)}</div>
  ${data.cnpj ? `<div class="center">CNPJ: ${escapeHtml(data.cnpj)}</div>` : ''}
  ${data.address ? `<div class="center">${escapeHtml(data.address)}</div>` : ''}
  ${data.phone ? `<div class="center">${escapeHtml(data.phone)}</div>` : ''}
  <div class="sep"></div>
  <div class="center bold">DOCUMENTO SEM VALOR FISCAL</div>
  <div class="row"><span>Venda #${data.saleNumber}</span><span>${data.terminalId}</span></div>
  <div class="row"><span>${dateStr}</span></div>
  <div class="row"><span>Operador: ${escapeHtml(data.operatorName)}</span></div>
  <div class="sep"></div>
  ${itemsHtml}
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${formatBRL(data.subtotalCents)}</span></div>
  ${data.discountCents > 0 ? `<div class="row"><span>Descontos</span><span>-${formatBRL(data.discountCents)}</span></div>` : ''}
  <div class="row big"><span>TOTAL</span><span>${formatBRL(data.totalCents)}</span></div>
  <div class="sep"></div>
  ${paymentsHtml}
  ${data.changeCents > 0 ? `<div class="row bold"><span>Troco</span><span>${formatBRL(data.changeCents)}</span></div>` : ''}
  ${fiscalHtml}
  <div class="sep"></div>
  <div class="center">Obrigado pela preferência!</div>
</div>`;
}
