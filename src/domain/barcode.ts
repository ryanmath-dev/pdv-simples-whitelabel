/**
 * Códigos de barras: EAN-8 / EAN-13 e etiquetas de balança (prefixo 2).
 *
 * Etiquetas de balança no varejo brasileiro usam EAN-13 iniciando em "2".
 * O layout é configurável porque varia por balança (Toledo, Filizola, etc.):
 *   [prefixo 2][código PLU][valor embutido][dígito verificador]
 * O "valor embutido" pode ser PREÇO (em centavos) ou PESO (em milésimos de kg).
 */

import type { Milli } from './quantity';
import type { Cents } from './money';

/** Calcula o dígito verificador de um código numérico (EAN-8/13/GTIN). */
export function eanCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  // O peso 3/1 é aplicado da direita para a esquerda sobre os dígitos de dados.
  const reversed = digitsWithoutCheck.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    const d = Number(reversed[i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Valida o dígito verificador de um EAN-8 ou EAN-13. */
export function isValidEan(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (code.length !== 8 && code.length !== 13) return false;
  const body = code.slice(0, -1);
  const check = Number(code.slice(-1));
  return eanCheckDigit(body) === check;
}

/** Gera um EAN-13 válido a partir de 12 dígitos (anexa o verificador). */
export function makeEan13(twelveDigits: string): string {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error('makeEan13 requer exatamente 12 dígitos');
  }
  return twelveDigits + String(eanCheckDigit(twelveDigits));
}

/** Verdadeiro se o código parece uma etiqueta de balança (EAN-13 começando com 2). */
export function isScaleBarcode(code: string): boolean {
  return /^2\d{12}$/.test(code);
}

export type ScaleEmbeddedType = 'PRICE' | 'WEIGHT';

export interface ScaleLabelConfig {
  /** O que o valor embutido representa. */
  embeddedType: ScaleEmbeddedType;
  /** Nº de dígitos do código PLU (após o prefixo "2"). Padrão 6. */
  pluDigits: number;
  /** Nº de dígitos do valor embutido. Padrão 5. */
  valueDigits: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleLabelConfig = {
  embeddedType: 'WEIGHT',
  pluDigits: 6,
  valueDigits: 5,
};

export interface ScaleLabel {
  /** Código PLU do produto (string, preserva zeros à esquerda). */
  plu: string;
  /** Preço embutido em centavos, se a etiqueta for do tipo PRICE. */
  priceCents?: Cents;
  /** Peso embutido em milésimos (kg), se a etiqueta for do tipo WEIGHT. */
  weightMilli?: Milli;
}

/**
 * Faz o parse de uma etiqueta de balança EAN-13 (prefixo 2).
 * Retorna null se o código não for uma etiqueta de balança válida ou
 * se o layout configurado não couber nos 13 dígitos.
 *
 * Layout: "2" + PLU(pluDigits) + valor(valueDigits) + verificador(1) = 13.
 */
export function parseScaleBarcode(
  code: string,
  config: ScaleLabelConfig = DEFAULT_SCALE_CONFIG,
): ScaleLabel | null {
  if (!isScaleBarcode(code)) return null;

  const { pluDigits, valueDigits, embeddedType } = config;
  // 1 (prefixo) + plu + valor + 1 (verificador) deve ser 13.
  if (1 + pluDigits + valueDigits + 1 !== 13) return null;

  const plu = code.slice(1, 1 + pluDigits);
  const valueStr = code.slice(1 + pluDigits, 1 + pluDigits + valueDigits);
  const value = Number(valueStr);

  if (embeddedType === 'PRICE') {
    // Valor em centavos (2 casas): "01299" => R$ 12,99 => 1299 centavos.
    return { plu, priceCents: value };
  }
  // WEIGHT: valor em gramas => milésimos de kg. "01500" => 1,500 kg => 1500 milésimos.
  return { plu, weightMilli: value };
}

export interface ScannerInput {
  /** Quantidade multiplicadora (em milésimos). ONE_UNIT (1000) se não informada. */
  quantityMilli: number;
  /** Código escaneado/digitado. */
  code: string;
}

/**
 * Interpreta a entrada do campo de código do caixa.
 * Aceita "3*7891234567890" => quantidade 3 x código.
 * Aceita "1,5*789..." para peso/kg.
 * Sem multiplicador, assume 1 unidade (1000 milésimos).
 */
export function parseScannerInput(raw: string): ScannerInput | null {
  const input = raw.trim();
  if (input === '') return null;

  const starIdx = input.indexOf('*');
  if (starIdx === -1) {
    return { quantityMilli: 1000, code: input };
  }

  const qtyStr = input.slice(0, starIdx).trim().replace(',', '.');
  const code = input.slice(starIdx + 1).trim();
  const qty = Number(qtyStr);
  if (!Number.isFinite(qty) || qty <= 0 || code === '') return null;
  return { quantityMilli: Math.round(qty * 1000), code };
}
