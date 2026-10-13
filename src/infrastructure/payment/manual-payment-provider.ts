import type {
  PaymentOutcome,
  PaymentProvider,
  PaymentRequest,
} from '@/application/ports/payment-provider';
import type { PaymentMethod } from '@/domain/sale';

/**
 * Provider de pagamento manual: o operador digita o valor e confirma.
 * Nenhuma integração externa (TEF/PIX) — sempre confirma de imediato.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual';

  requiresCapture(_method: PaymentMethod): boolean {
    return false;
  }

  async capture(_request: PaymentRequest): Promise<PaymentOutcome> {
    return { status: 'CONFIRMED', providerRef: null, message: null };
  }
}
