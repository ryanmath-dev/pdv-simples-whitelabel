import { formatBRL } from '@/domain/money';
import type { CashCloseSummary, CashSession } from '@/domain/cash-register';
import type { PaymentMethod } from '@/domain/sale';
import type { ReceiptWidth } from '@/domain/settings';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  STORE_CREDIT: 'Crédito loja',
};

/** Renderiza o relatório de fechamento de caixa (HTML para impressão). */
export function renderCloseReport(params: {
  storeName: string;
  terminalId: string;
  operatorName: string;
  session: CashSession;
  summary: CashCloseSummary;
  countedCents: number;
  width: ReceiptWidth;
}): string {
  const { storeName, terminalId, operatorName, session, summary, countedCents, width } = params;
  const widthMm = width === '58mm' ? 58 : 80;
  const diff = countedCents - summary.expectedCents;

  const methodRows = (Object.keys(summary.byMethod) as PaymentMethod[])
    .filter((m) => summary.byMethod[m] > 0)
    .map(
      (m) =>
        `<div class="row"><span>${METHOD_LABELS[m]}</span><span>${formatBRL(summary.byMethod[m])}</span></div>`,
    )
    .join('');

  return `
<div class="receipt w-${widthMm}">
  <style>
    #receipt-print .receipt { font-family: 'Courier New', monospace; color:#000; }
    #receipt-print .w-58 { width:58mm; font-size:10px; }
    #receipt-print .w-80 { width:80mm; font-size:12px; }
    #receipt-print .center { text-align:center; }
    #receipt-print .bold { font-weight:bold; }
    #receipt-print .sep { border-top:1px dashed #000; margin:4px 0; }
    #receipt-print .row { display:flex; justify-content:space-between; }
  </style>
  <div class="center bold">${storeName}</div>
  <div class="center">FECHAMENTO DE CAIXA</div>
  <div class="sep"></div>
  <div class="row"><span>Terminal</span><span>${terminalId}</span></div>
  <div class="row"><span>Operador</span><span>${operatorName}</span></div>
  <div class="row"><span>Abertura</span><span>${new Date(session.openedAt).toLocaleString('pt-BR')}</span></div>
  <div class="row"><span>Fechamento</span><span>${new Date().toLocaleString('pt-BR')}</span></div>
  <div class="sep"></div>
  <div class="row"><span>Fundo de troco</span><span>${formatBRL(summary.openingCents)}</span></div>
  <div class="row"><span>Vendas dinheiro</span><span>${formatBRL(summary.cashSalesCents)}</span></div>
  <div class="row"><span>Suprimentos</span><span>${formatBRL(summary.supplyCents)}</span></div>
  <div class="row"><span>Sangrias</span><span>-${formatBRL(summary.withdrawalCents)}</span></div>
  <div class="row bold"><span>Esperado em caixa</span><span>${formatBRL(summary.expectedCents)}</span></div>
  <div class="row"><span>Contado</span><span>${formatBRL(countedCents)}</span></div>
  <div class="row bold"><span>Diferença</span><span>${diff < 0 ? '-' : ''}${formatBRL(Math.abs(diff))}</span></div>
  <div class="sep"></div>
  <div class="center bold">Resumo por forma</div>
  ${methodRows}
  <div class="row bold"><span>Total vendas</span><span>${formatBRL(summary.totalSalesCents)}</span></div>
  <div class="sep"></div>
  <div class="center">Conferido por: ____________________</div>
</div>`;
}
