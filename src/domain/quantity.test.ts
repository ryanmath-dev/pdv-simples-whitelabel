import { describe, it, expect } from 'vitest';
import {
  assertMilli,
  formatQuantity,
  fromMilli,
  parseQuantity,
  QuantityError,
  sumMilli,
  toMilli,
} from './quantity';

describe('quantity', () => {
  it('assertMilli rejeita não-inteiros', () => {
    expect(() => assertMilli(1000)).not.toThrow();
    expect(() => assertMilli(1.5)).toThrow(QuantityError);
  });

  it('toMilli / fromMilli', () => {
    expect(toMilli(1.5)).toBe(1500);
    expect(toMilli(3)).toBe(3000);
    expect(fromMilli(1500)).toBe(1.5);
  });

  it('sumMilli soma', () => {
    expect(sumMilli([1000, 500, 250])).toBe(1750);
  });

  describe('formatQuantity', () => {
    it('UN inteira sem casas', () => {
      expect(formatQuantity(3000, 'UN')).toBe('3');
    });
    it('KG sempre 3 casas', () => {
      expect(formatQuantity(1500, 'KG')).toBe('1,500');
      expect(formatQuantity(1000, 'KG')).toBe('1,000');
    });
  });

  describe('parseQuantity', () => {
    it('UN aceita inteiro', () => {
      expect(parseQuantity('3', 'UN')).toBe(3000);
    });
    it('UN rejeita fracionado', () => {
      expect(parseQuantity('1,5', 'UN')).toBeNull();
    });
    it('KG aceita fracionado com vírgula', () => {
      expect(parseQuantity('1,5', 'KG')).toBe(1500);
    });
    it('rejeita zero e negativo', () => {
      expect(parseQuantity('0', 'KG')).toBeNull();
      expect(parseQuantity('-1', 'KG')).toBeNull();
    });
    it('rejeita inválido', () => {
      expect(parseQuantity('abc', 'KG')).toBeNull();
      expect(parseQuantity('', 'UN')).toBeNull();
    });
  });
});
