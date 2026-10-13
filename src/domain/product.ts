import { z } from 'zod';
import { baseEntitySchema, makeBase, type BaseEntity } from './types';
import type { Unit } from './quantity';
import { isValidEan } from './barcode';

export const unitSchema = z.enum(['UN', 'KG']);

export interface Category extends BaseEntity {
  name: string;
}

export const categorySchema = baseEntitySchema.extend({
  name: z.string().min(1, 'Nome obrigatório'),
});

export interface Product extends BaseEntity {
  sku: string;
  barcode?: string | null;
  name: string;
  categoryId?: string | null;
  unit: Unit;
  priceCents: number;
  costCents: number;
  minStock: number; // em milésimos
  active: boolean;
  scaleCode?: string | null; // código PLU de balança
  // Campos fiscais opcionais (não usados agora, reservados para NFC-e).
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  origin?: string | null;
  taxProfileId?: string | null;
}

export const productSchema = baseEntitySchema.extend({
  sku: z.string().min(1, 'SKU obrigatório'),
  barcode: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidEan(v), 'Código de barras EAN inválido')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  name: z.string().min(1, 'Nome obrigatório'),
  categoryId: z.string().nullable().optional(),
  unit: unitSchema,
  priceCents: z.number().int().nonnegative('Preço inválido'),
  costCents: z.number().int().nonnegative('Custo inválido'),
  minStock: z.number().int().nonnegative(),
  active: z.boolean(),
  scaleCode: z.string().nullable().optional(),
  ncm: z.string().nullable().optional(),
  cest: z.string().nullable().optional(),
  cfop: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  taxProfileId: z.string().nullable().optional(),
});

export interface NewProductInput {
  sku: string;
  barcode?: string | null;
  name: string;
  categoryId?: string | null;
  unit: Unit;
  priceCents: number;
  costCents?: number;
  minStock?: number;
  active?: boolean;
  scaleCode?: string | null;
}

/** Cria um Product novo com campos base e padrões. */
export function createProduct(input: NewProductInput): Product {
  return {
    ...makeBase(),
    sku: input.sku,
    barcode: input.barcode ?? null,
    name: input.name,
    categoryId: input.categoryId ?? null,
    unit: input.unit,
    priceCents: input.priceCents,
    costCents: input.costCents ?? 0,
    minStock: input.minStock ?? 0,
    active: input.active ?? true,
    scaleCode: input.scaleCode ?? null,
    ncm: null,
    cest: null,
    cfop: null,
    origin: null,
    taxProfileId: null,
  };
}
