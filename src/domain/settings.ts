import { z } from 'zod';
import { baseEntitySchema, type BaseEntity } from './types';
import type { ScaleEmbeddedType } from './barcode';

/** Largura da bobina de impressão do cupom. */
export type ReceiptWidth = '58mm' | '80mm';

/**
 * Configurações da loja/terminal. Armazenadas como uma única entidade
 * (singleton) na tabela settings, chave fixa SETTINGS_ID.
 */
export interface StoreSettings extends BaseEntity {
  storeName: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  terminalId: string;
  receiptWidth: ReceiptWidth;
  // Regras operacionais
  allowNegativeStock: boolean;
  operatorDiscountLimitPercent: number; // acima disso exige PIN de gerente
  requireManagerPinForCancel: boolean;
  // Balança
  scaleEmbeddedType: ScaleEmbeddedType;
  scalePluDigits: number;
  scaleValueDigits: number;
}

export const SETTINGS_ID = 'store-settings';

export const storeSettingsSchema = baseEntitySchema.extend({
  storeName: z.string().min(1, 'Nome da loja obrigatório'),
  cnpj: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  terminalId: z.string().min(1),
  receiptWidth: z.enum(['58mm', '80mm']),
  allowNegativeStock: z.boolean(),
  operatorDiscountLimitPercent: z.number().min(0).max(100),
  requireManagerPinForCancel: z.boolean(),
  scaleEmbeddedType: z.enum(['PRICE', 'WEIGHT']),
  scalePluDigits: z.number().int().positive(),
  scaleValueDigits: z.number().int().positive(),
});

export function defaultSettings(): StoreSettings {
  const ts = new Date().toISOString();
  return {
    id: SETTINGS_ID,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    version: 1,
    storeName: 'Mercadinho do Bairro',
    cnpj: null,
    address: null,
    phone: null,
    terminalId: 'TERM-01',
    receiptWidth: '80mm',
    allowNegativeStock: true,
    operatorDiscountLimitPercent: 10,
    requireManagerPinForCancel: true,
    scaleEmbeddedType: 'WEIGHT',
    scalePluDigits: 6,
    scaleValueDigits: 5,
  };
}
