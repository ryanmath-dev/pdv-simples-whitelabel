import { parseCsv, toCsv } from '@/ui/lib/csv';
import { parseBRLToCents, centsToReal } from '@/domain/money';
import { isValidEan } from '@/domain/barcode';
import type { Product } from '@/domain/product';
import type { Unit } from '@/domain/quantity';
import type { ParsedProductRow } from '@/application/use-cases/import-products';

export type { ParsedProductRow };

export const CSV_HEADERS = [
  'sku',
  'nome',
  'codigo_barras',
  'categoria',
  'unidade',
  'preco',
  'custo',
  'estoque_minimo',
  'codigo_balanca',
  'ativo',
] as const;

/** Modelo CSV para download (cabeçalho + 2 exemplos). */
export function csvTemplate(): string {
  return toCsv([
    [...CSV_HEADERS],
    ['ARROZ5', 'Arroz 5kg', '7891000100103', 'Mercearia', 'UN', '25,90', '19,00', '5', '', 'sim'],
    ['BANANA', 'Banana Prata kg', '', 'Hortifruti', 'KG', '5,99', '3,50', '2', '000012', 'sim'],
  ]);
}

export interface CsvRowError {
  row: number; // 1-based (linha do arquivo, excluindo cabeçalho)
  message: string;
}

export interface ParseResult {
  rows: ParsedProductRow[];
  errors: CsvRowError[];
}

function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === 'sim' || s === 'true' || s === '1' || s === 's' || s === '';
}

/** Interpreta e valida um CSV de produtos. */
export function parseProductsCsv(text: string): ParseResult {
  const matrix = parseCsv(text);
  const rows: ParsedProductRow[] = [];
  const errors: CsvRowError[] = [];
  if (matrix.length === 0) return { rows, errors };

  // Primeira linha = cabeçalho (ignorada por posição).
  const dataRows = matrix.slice(1);

  dataRows.forEach((cols, idx) => {
    const rowNum = idx + 1;
    const get = (i: number) => (cols[i] ?? '').trim();
    const sku = get(0);
    const name = get(1);
    const barcodeRaw = get(2);
    const categoryName = get(3) || null;
    const unitRaw = get(4).toUpperCase();
    const price = parseBRLToCents(get(5));
    const costRaw = get(6);
    const cost = costRaw ? parseBRLToCents(costRaw) : 0;
    const minRaw = get(7);
    const scaleCode = get(8) || null;
    const active = parseBool(get(9));

    if (!sku) {
      errors.push({ row: rowNum, message: 'SKU obrigatório.' });
      return;
    }
    if (!name) {
      errors.push({ row: rowNum, message: 'Nome obrigatório.' });
      return;
    }
    if (unitRaw !== 'UN' && unitRaw !== 'KG') {
      errors.push({ row: rowNum, message: `Unidade inválida "${unitRaw}" (use UN ou KG).` });
      return;
    }
    if (price == null) {
      errors.push({ row: rowNum, message: 'Preço inválido.' });
      return;
    }
    if (barcodeRaw && !isValidEan(barcodeRaw)) {
      errors.push({ row: rowNum, message: `Código de barras inválido: ${barcodeRaw}.` });
      return;
    }
    const minUnits = minRaw ? Number(minRaw.replace(',', '.')) : 0;
    if (!Number.isFinite(minUnits) || minUnits < 0) {
      errors.push({ row: rowNum, message: 'Estoque mínimo inválido.' });
      return;
    }

    rows.push({
      sku,
      name,
      barcode: barcodeRaw || null,
      categoryName,
      unit: unitRaw as Unit,
      priceCents: price,
      costCents: cost ?? 0,
      minStock: Math.round(minUnits * 1000),
      scaleCode,
      active,
    });
  });

  return { rows, errors };
}

/** Monta as linhas CSV de exportação a partir dos produtos. */
export function productsToCsv(
  products: Product[],
  categoryNameById: Map<string, string>,
): string {
  const rows: (string | number)[][] = [[...CSV_HEADERS]];
  for (const p of products) {
    rows.push([
      p.sku,
      p.name,
      p.barcode ?? '',
      p.categoryId ? (categoryNameById.get(p.categoryId) ?? '') : '',
      p.unit,
      centsToReal(p.priceCents).toFixed(2).replace('.', ','),
      centsToReal(p.costCents).toFixed(2).replace('.', ','),
      (p.minStock / 1000).toString().replace('.', ','),
      p.scaleCode ?? '',
      p.active ? 'sim' : 'nao',
    ]);
  }
  return toCsv(rows);
}
