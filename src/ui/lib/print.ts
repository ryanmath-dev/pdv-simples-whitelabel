/**
 * Injeta um HTML no nó dedicado de impressão (#receipt-print, isolado por CSS
 * @media print) e dispara window.print(). Reutilizado por cupom e relatórios.
 */
export function printHtml(html: string): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve();
  let node = document.getElementById('receipt-print');
  if (!node) {
    node = document.createElement('div');
    node.id = 'receipt-print';
    document.body.appendChild(node);
  }
  node.innerHTML = html;
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('afterprint', done);
      resolve();
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  });
}
