import type { OutboxEntry } from '@/domain/outbox';
import type {
  PullResult,
  PushResult,
  SyncAdapter,
} from '@/application/ports/sync-adapter';

/**
 * Esqueleto funcional de sync contra um backend REST genérico.
 * Ativado por VITE_SYNC_URL. Contrato documentado em docs/sync-contract.md.
 *
 *   POST {baseUrl}/sync/push   body: { entries: OutboxEntry[] }
 *   GET  {baseUrl}/sync/pull?since=<cursor>
 *
 * A rede NUNCA está no caminho crítico da venda: este adapter só é chamado
 * pelo serviço de sync em segundo plano.
 */
export class HttpSyncAdapter implements SyncAdapter {
  readonly name = 'http';

  constructor(
    private baseUrl: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  isRemote(): boolean {
    return true;
  }

  async push(batch: OutboxEntry[]): Promise<PushResult> {
    if (batch.length === 0) return { acceptedIds: [], errors: {} };
    const res = await this.fetchImpl(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: batch }),
    });
    if (!res.ok) {
      throw new Error(`push falhou: HTTP ${res.status}`);
    }
    // Espera-se { acceptedIds: string[], errors: Record<string,string> }
    const data = (await res.json()) as PushResult;
    return { acceptedIds: data.acceptedIds ?? [], errors: data.errors ?? {} };
  }

  async pull(since: string | null): Promise<PullResult> {
    const url = new URL(`${this.baseUrl}/sync/pull`);
    if (since) url.searchParams.set('since', since);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new Error(`pull falhou: HTTP ${res.status}`);
    }
    const data = (await res.json()) as PullResult;
    return { changes: data.changes ?? [], cursor: data.cursor ?? null };
  }
}
