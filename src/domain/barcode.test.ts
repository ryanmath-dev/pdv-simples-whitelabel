import { describe, it, expect } from 'vitest';
import {
  eanCheckDigit,
  isValidEan,
  makeEan13,
  isScaleBarcode,
  parseScaleBarcode,
  parseScannerInput,
  DEFAULT_SCALE_CONFIG,
  type ScaleLabelConfig,
} from './barcode';

describe('EAN', () => {
  it('eanCheckDigit calcula dígito conhecido (EAN-13)', () => {
    // 7891000100103 -> body 789100010010, check 3
    expect(eanCheckDigit('789100010010')).toBe(3);
  });

  it('eanCheckDigit calcula dígito conhecido (EAN-8)', () => {
    // 40170725 -> body 4017072, check 5
    expect(eanCheckDigit('4017072')).toBe(5);
  });

  it('isValidEan valida EAN-13 correto', () => {
    expect(isValidEan('7891000100103')).toBe(true);
  });

  it('isValidEan rejeita EAN-13 com dígito errado', () => {
    expect(isValidEan('7891000100104')).toBe(false);
  });

  it('isValidEan valida EAN-8', () => {
    expect(isValidEan('40170725')).toBe(true);
  });

  it('isValidEan rejeita comprimento inválido ou não numérico', () => {
    expect(isValidEan('123')).toBe(false);
    expect(isValidEan('78910001001ab')).toBe(false);
  });

  it('makeEan13 anexa verificador correto', () => {
    expect(makeEan13('789100010010')).toBe('7891000100103');
    expect(isValidEan(makeEan13('200000012990'))).toBe(true);
  });
});

describe('etiqueta de balança', () => {
  it('isScaleBarcode detecta prefixo 2 em EAN-13', () => {
    expect(isScaleBarcode('2000001299903')).toBe(true);
    expect(isScaleBarcode('7891000100103')).toBe(false);
    expect(isScaleBarcode('20000')).toBe(false);
  });

  it('parseScaleBarcode retorna null para não-balança', () => {
    expect(parseScaleBarcode('7891000100103')).toBeNull();
  });

  it('parseScaleBarcode (WEIGHT padrão): extrai PLU e peso', () => {
    // 2 | 000012 | 01500 | C  => PLU "000012", peso 1500 milésimos (1,5 kg)
    const body = '2' + '000012' + '01500';
    const code = makeEan13(body);
    const label = parseScaleBarcode(code, DEFAULT_SCALE_CONFIG);
    expect(label).not.toBeNull();
    expect(label!.plu).toBe('000012');
    expect(label!.weightMilli).toBe(1500);
    expect(label!.priceCents).toBeUndefined();
  });

  it('parseScaleBarcode (PRICE): extrai PLU e preço em centavos', () => {
    // 2 | 000012 | 01299 | C => PLU "000012", preço R$ 12,99 = 1299 centavos
    const cfg: ScaleLabelConfig = { embeddedType: 'PRICE', pluDigits: 6, valueDigits: 5 };
    const body = '2' + '000012' + '01299';
    const code = makeEan13(body);
    const label = parseScaleBarcode(code, cfg);
    expect(label).not.toBeNull();
    expect(label!.plu).toBe('000012');
    expect(label!.priceCents).toBe(1299);
    expect(label!.weightMilli).toBeUndefined();
  });

  it('parseScaleBarcode preserva zeros à esquerda do PLU', () => {
    const code = makeEan13('2' + '000007' + '00250');
    const label = parseScaleBarcode(code);
    expect(label!.plu).toBe('000007');
  });

  it('parseScaleBarcode retorna null se layout não couber em 13 dígitos', () => {
    const cfg: ScaleLabelConfig = { embeddedType: 'WEIGHT', pluDigits: 7, valueDigits: 7 };
    const code = makeEan13('2' + '000012' + '01500');
    expect(parseScaleBarcode(code, cfg)).toBeNull();
  });
});

describe('parseScannerInput', () => {
  it('código puro assume 1 unidade', () => {
    expect(parseScannerInput('7891000100103')).toEqual({
      quantityMilli: 1000,
      code: '7891000100103',
    });
  });

  it('multiplicador inteiro', () => {
    expect(parseScannerInput('3*7891000100103')).toEqual({
      quantityMilli: 3000,
      code: '7891000100103',
    });
  });

  it('multiplicador fracionado (kg)', () => {
    expect(parseScannerInput('1,5*789')).toEqual({ quantityMilli: 1500, code: '789' });
  });

  it('ignora espaços', () => {
    expect(parseScannerInput('  2 * 789  ')).toEqual({ quantityMilli: 2000, code: '789' });
  });

  it('rejeita vazio e inválidos', () => {
    expect(parseScannerInput('')).toBeNull();
    expect(parseScannerInput('0*789')).toBeNull();
    expect(parseScannerInput('3*')).toBeNull();
  });
});
