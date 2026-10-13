import type { OutboxEntry } from '@/domain/outbox';

export interface PushResult {
  /** IDs de outbox aceitos pelo servidor (podem ser removidos localmente). */
  acceptedIds: string[];
  /** Erros por entrada (id -> mensagem). */
  errors: Record<string, string>;
}

export interface PullChange {
  entity: string;
  entityId: string;
  op: 'UPSERT' | 'DELETE';
  payload: unknown;
  updatedAt: string;
  version: number;
}

export interface PullResult {
  changes: PullChange[];
  /** Novo cursor para a próxima chamada pull. */
  cursor: string | null;
}

/**
 * Port de sincronização. A rede nunca está no caminho crítico da venda.
 * push: envia a outbox. pull: busca mudanças do servidor desde um cursor.
 */
export interface SyncAdapter {
  readonly name: string;
  isRemote(): boolean;
  push(batch: OutboxEntry[]): Promise<PushResult>;
  pull(since: string | null): Promise<PullResult>;
}
