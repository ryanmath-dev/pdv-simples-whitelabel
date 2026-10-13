import type { Cents } from '@/domain/money';
import type { PaymentMethod } from '@/domain/sale';

export interface PaymentRequest {
  saleId: string;
  method: PaymentMethod;
  amountCents: Cents;
}

export interface PaymentOutcome {
  status: 'CONFIRMED' | 'FAILED';
  providerRef?: string | null;
  message?: string | null;
}

/**
 * Port de pagamento. O adapter atual (manual) apenas confirma o valor
 * informado pelo operador. Adapters futuros: TEF, PIX dinâmico (QR).
 */
export interface PaymentProvider {
  readonly name: string;
  /** True se exige integração externa (TEF/PIX) antes de confirmar. */
  requiresCapture(method: PaymentMethod): boolean;
  capture(request: PaymentRequest): Promise<PaymentOutcome>;
}
