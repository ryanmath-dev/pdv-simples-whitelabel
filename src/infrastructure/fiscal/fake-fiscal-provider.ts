import type {
  FiscalProvider,
  FiscalReceiptExtras,
  FiscalResult,
  FiscalSaleSnapshot,
} from '@/application/ports/fiscal-provider';

/**
 * Provider fiscal FAKE para demonstração/testes: marca toda venda como
 * AUTHORIZED, gera uma "chave de acesso" fictícia e um QR Code fictício para
 * o cupom. Serve para provar que ligar um emissor real exige mudar apenas o
 * composition-root (ver docs/fiscal-adapter.md).
 */
export class FakeFiscalProvider implements FiscalProvider {
  readonly name = 'fake';
  private extras = new Map<string, FiscalReceiptExtras>();

  isEnabled(): boolean {
    return true;
  }

  async issue(sale: FiscalSaleSnapshot): Promise<FiscalResult> {
    const accessKey = this.makeFakeKey(sale);
    const qrCodeData = `https://nfce.example.gov.br/consulta?p=${accessKey}`;
    this.extras.set(sale.saleId, {
      accessKey,
      qrCodeData,
      protocol: `FAKE-${Date.now()}`,
      extraLines: ['NFC-e FICTÍCIA (homologação/demo)', `Chave: ${accessKey}`],
    });
    return { status: 'AUTHORIZED', ref: accessKey, message: 'Autorizado (fake)' };
  }

  async cancel(saleId: string, _reason: string): Promise<FiscalResult> {
    this.extras.delete(saleId);
    return { status: 'NOT_REQUIRED', ref: null, message: 'Cancelado (fake)' };
  }

  async retryPending(): Promise<void> {
    // Fake sempre autoriza na hora; nada pendente.
  }

  async receiptExtras(saleId: string): Promise<FiscalReceiptExtras | null> {
    return this.extras.get(saleId) ?? null;
  }

  private makeFakeKey(sale: FiscalSaleSnapshot): string {
    // 44 dígitos fictícios, determinísticos a partir do id/numero.
    const base = `${sale.number}`.padStart(9, '0');
    const rand = Array.from({ length: 35 }, (_, i) => (i * 7 + sale.number) % 10).join('');
    return (base + rand).slice(0, 44);
  }
}
