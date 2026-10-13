import { z } from 'zod';
import { baseEntitySchema, type BaseEntity } from './types';

export type AuditAction =
  | 'SALE_ITEM_CANCEL'
  | 'SALE_CANCEL'
  | 'DISCOUNT_OVER_LIMIT'
  | 'STOCK_ADJUSTMENT'
  | 'CASH_OPEN'
  | 'CASH_CLOSE'
  | 'CASH_WITHDRAWAL'
  | 'CASH_SUPPLY'
  | 'DEMO_RESET';

export interface AuditLog extends BaseEntity {
  action: AuditAction;
  userId: string;
  detail: string;
  refType?: string | null;
  refId?: string | null;
}

export const auditLogSchema = baseEntitySchema.extend({
  action: z.enum([
    'SALE_ITEM_CANCEL',
    'SALE_CANCEL',
    'DISCOUNT_OVER_LIMIT',
    'STOCK_ADJUSTMENT',
    'CASH_OPEN',
    'CASH_CLOSE',
    'CASH_WITHDRAWAL',
    'CASH_SUPPLY',
    'DEMO_RESET',
  ]),
  userId: z.string(),
  detail: z.string(),
  refType: z.string().nullable().optional(),
  refId: z.string().nullable().optional(),
});
