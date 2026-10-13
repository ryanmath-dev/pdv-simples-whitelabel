import { z } from 'zod';
import { uuidv7 } from 'uuidv7';

/** Timestamp ISO 8601 (ex.: "2026-10-13T12:00:00.000Z"). */
export type IsoDate = string;

/** Gera um novo ID UUID v7 (ordenável no tempo, gerado no cliente). */
export function newId(): string {
  return uuidv7();
}

/** Timestamp atual em ISO 8601. */
export function now(): IsoDate {
  return new Date().toISOString();
}

/**
 * Campos comuns a toda entidade sincronizável.
 * - version: inteiro incremental usado para last-write-wins no sync.
 * - deletedAt: soft delete.
 */
export interface BaseEntity {
  id: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  deletedAt?: IsoDate | null;
  version: number;
}

export const baseEntitySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  version: z.number().int().nonnegative(),
});

/** Cria os campos base para uma nova entidade. */
export function makeBase(id: string = newId()): BaseEntity {
  const ts = now();
  return { id, createdAt: ts, updatedAt: ts, deletedAt: null, version: 1 };
}

/** Retorna uma cópia com updatedAt renovado e version incrementada. */
export function touch<T extends BaseEntity>(entity: T): T {
  return { ...entity, updatedAt: now(), version: entity.version + 1 };
}
