import type { OutboxEntry } from '@/domain/outbox';
import type {
  PullResult,
  PushResult,
  SyncAdapter,
} from '@/application/ports/sync-adapter';

/**
 * Adapter de sync padrão da demo: não envia nada para lugar nenhum.
 * A outbox apenas acumula localmente (e pode ser limpa em Configurações).
 * push "aceita" tudo apenas se quisermos limpar; aqui NÃO aceita, para que
 * as entradas permaneçam como evidência de operações pendentes de sync.
 */
export class LocalOnlySyncAdapter implements SyncAdapter {
  readonly name = 'local-only';

  isRemote(): boolean {
    return false;
  }

  async push(_batch: OutboxEntry[]): Promise<PushResult> {
    // Não aceita nada: sem backend, nada é confirmado remotamente.
    return { acceptedIds: [], errors: {} };
  }

  async pull(_since: string | null): Promise<PullResult> {
    return { changes: [], cursor: null };
  }
}
