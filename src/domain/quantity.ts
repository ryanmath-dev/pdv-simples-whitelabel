/**
 * Quantidades em milésimos (inteiro). 1000 = 1 unidade ou 1 kg.
 * Permite representar frações de kg (ex.: 1500 = 1,5 kg) sem usar float.
 */
export type Milli = number;

export type Unit = 'UN' | 'KG';

export class QuantityError extends Error {}

export const ONE_UNIT: Milli = 1000;

export function assertMilli(value: number): asserts value is Milli {
  if (!Number.isInteger(value)) {
    throw new QuantityError(`Quantidade deve ser inteira em milésimos: ${value}`);
  }
}

/** Converte unidades "humanas" (ex.: 1,5) para milésimos (1500). */
export function toMilli(value: number): Milli {
  return Math.round(value * 1000);
}

/** Converte milésimos para unidades "humanas" (1500 -> 1,5). Só para exibição/cálculo. */
export function fromMilli(value: Milli): number {
  assertMilli(value);
  return value / 1000;
}

/** Soma quantidades em milésimos. */
export function sumMilli(values: Milli[]): Milli {
  return values.reduce((acc, v) => {
    assertMilli(v);
    return acc + v;
  }, 0);
}

/**
 * Formata uma quantidade para exibição conforme a unidade.
 * UN: inteiro quando possível (3), senão com 3 casas.
 * KG: sempre 3 casas decimais (1,500).
 */
export function formatQuantity(milli: Milli, unit: Unit): string {
  assertMilli(milli);
  if (unit === 'UN') {
    if (milli % 1000 === 0) {
      return String(milli / 1000);
    }
    return (milli / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }
  // KG
  return (milli / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Faz o parse de uma quantidade digitada (pt-BR) para milésimos.
 * Para unidade UN, aceita apenas inteiros (não faz sentido vender 1,5 un).
 * Retorna null se inválido.
 */
export function parseQuantity(input: string, unit: Unit): Milli | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === 'UN' && !Number.isInteger(value)) return null;
  return toMilli(value);
}
