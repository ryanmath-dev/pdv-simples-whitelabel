import type { ReceiptData, ReceiptPrinter } from '@/application/ports/printer';
import { renderReceiptHtml } from './receipt-template';

const PRINT_NODE_ID = 'receipt-print';

/**
 * Impressora de cupom via navegador: injeta o HTML do cupom em um nó dedicado
 * (#receipt-print, isolado por CSS @media print) e chama window.print().
 * Adapter futuro: ESC/POS via WebUSB/WebSerial.
 */
export class BrowserReceiptPrinter implements ReceiptPrinter {
  readonly name = 'browser';

  async print(data: ReceiptData): Promise<void> {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    let node = document.getElementById(PRINT_NODE_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = PRINT_NODE_ID;
      document.body.appendChild(node);
    }
    node.innerHTML = renderReceiptHtml(data);

    await new Promise<void>((resolve) => {
      const done = () => {
        window.removeEventListener('afterprint', done);
        resolve();
      };
      window.addEventListener('afterprint', done);
      window.print();
      // Fallback: alguns navegadores não disparam afterprint.
      setTimeout(done, 1500);
    });
  }
}
