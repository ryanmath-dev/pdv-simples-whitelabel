import { describe, it, expect } from 'vitest';
import {
  assertCents,
  centsToReal,
  formatBRL,
  multiplyByQuantity,
  parseBRLToCents,
  percentOf,
  realToCents,
  sumCents,
  MoneyError,
} from './money';

describe('money', () => {
  it('assertCents aceita inteiros e rejeita floats', () => {
    expect(() => assertCents(100)).not.toThrow();
    expect(() => assertCents(12.5)).toThrow(MoneyError);
  });

  it('sumCents soma corretamente', () => {
    expect(sumCents([100, 200, 50])).toBe(350);
    expect(sumCents([])).toBe(0);
  });

  it('realToCents arredonda sem erro de float', () => {
    expect(realToCents(12.34)).toBe(1234);
    expect(realToCents(0.1 + 0.2)).toBe(30);
    expect(realToCents(19.99)).toBe(1999);
    expect(realToCents(100)).toBe(10000);
  });

  it('centsToReal converte', () => {
    expect(centsToReal(1234)).toBe(12.34);
  });

  it('multiplyByQuantity: unidades inteiras', () => {
    expect(multiplyByQuantity(500, 3000)).toBe(1500); // R$5,00 x 3
  });

  it('multiplyByQuantity: peso em kg', () => {
    expect(multiplyByQuantity(1290, 1500)).toBe(1935); // R$12,90/kg x 1,5kg
  });

  it('multiplyByQuantity arredonda corretamente', () => {
    // R$0,99 x 0,333kg = 32,967 centavos -> 33
    expect(multiplyByQuantity(99, 333)).toBe(33);
  });

  it('percentOf calcula desconto', () => {
    expect(percentOf(1000, 10)).toBe(100);
    expect(percentOf(1999, 15)).toBe(300); // 299.85 -> 300
  });

  it('formatBRL formata em pt-BR', () => {
    const f = formatBRL(1234);
    expect(f).toContain('12,34');
    expect(f).toContain('R$');
  });

  describe('parseBRLToCents', () => {
    it('aceita vírgula decimal', () => {
      expect(parseBRLToCents('12,34')).toBe(1234);
    });
    it('aceita ponto decimal', () => {
      expect(parseBRLToCents('12.34')).toBe(1234);
    });
    it('aceita prefixo R$', () => {
      expect(parseBRLToCents('R$ 12,34')).toBe(1234);
    });
    it('aceita separador de milhar pt-BR', () => {
      expect(parseBRLToCents('1.234,56')).toBe(123456);
    });
    it('interpreta inteiro como reais', () => {
      expect(parseBRLToCents('1234')).toBe(123400);
    });
    it('retorna null para entrada inválida', () => {
      expect(parseBRLToCents('abc')).toBeNull();
      expect(parseBRLToCents('')).toBeNull();
    });
  });
});
