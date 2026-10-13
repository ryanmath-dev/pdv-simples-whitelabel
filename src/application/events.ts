import type { Sale } from '@/domain/sale';

/**
 * Event bus simples e síncrono-assíncrono. Casos de uso publicam eventos de
 * domínio APÓS a transação commitar; handlers (ex.: fiscal, sync) assinam.
 */
export interface DomainEvents {
  SaleFinalized: { sale: Sale };
  SaleCanceled: { saleId: string; reason: string };
  StockChanged: { productIds: string[] };
}

export type DomainEventName = keyof DomainEvents;

type Handler<E extends DomainEventName> = (payload: DomainEvents[E]) => void | Promise<void>;

// Handler genérico armazenado internamente (sem o parâmetro estreito).
type AnyHandler = (payload: never) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<DomainEventName, Set<AnyHandler>>();

  on<E extends DomainEventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => set!.delete(handler as AnyHandler);
  }

  /** Publica um evento. Erros de handlers são isolados (não quebram o caixa). */
  async emit<E extends DomainEventName>(event: E, payload: DomainEvents[E]): Promise<void> {
    const set = this.handlers.get(event) as Set<Handler<E>> | undefined;
    if (!set) return;
    for (const handler of set) {
      try {
        await handler(payload);
      } catch (err) {
        // Nunca propaga: o fluxo do caixa não pode parar por um handler.
        console.error(`[EventBus] handler de ${event} falhou:`, err);
      }
    }
  }
}
