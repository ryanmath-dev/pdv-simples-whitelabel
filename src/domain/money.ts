/**
 * Dinheiro em centavos (inteiro). Nunca usar float para valores monetários.
 * Um `Cents` é sempre um inteiro representando centavos de BRL.
 */
export type Cents = number;

export class MoneyError extends Error {}

/** Garante que um valor é um número inteiro de centavos. */
export function assertCents(value: number): asserts value is Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Valor monetário deve ser inteiro em centavos: ${value}`);
  }
}

/** Soma uma lista de centavos. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => {
    assertCents(v);
    return acc + v;
  }, 0);
}

/** Converte reais (ex.: 12.34) para centavos (1234), arredondando corretamente. */
export function realToCents(reais: number): Cents {
  // Arredonda para evitar erros de ponto flutuante (ex.: 0.1 + 0.2).
  return Math.round(reais * 100);
}

/** Converte centavos para reais (ex.: 1234 -> 12.34). Usar só para exibição. */
export function centsToReal(cents: Cents): number {
  assertCents(cents);
  return cents / 100;
}

/**
 * Multiplica um preço (centavos) por uma quantidade em milésimos.
 * Ex.: 500 centavos * 3000 milésimos (3 un) = 1500 centavos.
 * Ex.: 1290 centavos/kg * 1500 milésimos (1,5 kg) = 1935 centavos.
 * O resultado é arredondado para o centavo mais próximo.
 */
export function multiplyByQuantity(unitPriceCents: Cents, quantityMilli: number): Cents {
  assertCents(unitPriceCents);
  if (!Number.isInteger(quantityMilli)) {
    throw new MoneyError(`Quantidade deve ser inteira em milésimos: ${quantityMilli}`);
  }
  return Math.round((unitPriceCents * quantityMilli) / 1000);
}

/**
 * Aplica um desconto percentual (ex.: 10 = 10%) a um valor em centavos.
 * Retorna o valor do desconto em centavos (arredondado).
 */
export function percentOf(cents: Cents, percent: number): Cents {
  assertCents(cents);
  return Math.round((cents * percent) / 100);
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata centavos como moeda BRL, ex.: 1234 -> "R$ 12,34". */
export function formatBRL(cents: Cents): string {
  assertCents(cents);
  return brlFormatter.format(cents / 100);
}

/**
 * Faz o parse de uma string digitada pelo usuário (pt-BR) para centavos.
 * Aceita "12,34", "12.34", "R$ 12,34", "1234" (interpretado como reais).
 * Retorna null se não for possível interpretar.
 */
export function parseBRLToCents(input: string): Cents | null {
  const cleaned = input
    .trim()
    .replace(/r\$/i, '')
    .replace(/\s/g, '');
  if (cleaned === '') return null;

  let normalized: string;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Assume "." como separador de milhar e "," como decimal (padrão pt-BR).
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return realToCents(value);
}
