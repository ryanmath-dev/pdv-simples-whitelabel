import type { IsoDate } from './types';

export type OutboxOp = 'UPSERT' | 'DELETE';

/**
 * Registro da outbox: toda escrita no banco gera uma entrada aqui, na mesma
 * transação. O SyncAdapter consome a outbox para enviar ao backend.
 */
export interface OutboxEntry {
  id: string;
  entity: string; // nome da tabela/entidade
  entityId: string;
  op: OutboxOp;
  payload: unknown; // snapshot da entidade (ou null para DELETE)
  createdAt: IsoDate;
  attempts: number;
  lastError?: string | null;
}
