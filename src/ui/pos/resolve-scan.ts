import {
  isScaleBarcode,
  parseScaleBarcode,
  parseScannerInput,
  type ScaleLabelConfig,
} from '@/domain/barcode';
import type { Cents } from '@/domain/money';
import type { Product } from '@/domain/product';
import type { ProductRepository } from '@/application/ports/repositories';
import type { StoreSettings } from '@/domain/settings';

export interface ScanResolution {
  product: Product;
  quantityMilli: number;
  /** Preço sobrescrito (etiqueta de balança com preço embutido). */
  priceOverrideCents?: Cents;
}

export type ScanError =
  | { kind: 'EMPTY' }
  | { kind: 'INVALID' }
  | { kind: 'NOT_FOUND'; code: string };

/**
 * Resolve a entrada do campo de código do caixa em um produto + quantidade.
 * Trata multiplicador (3*cod), etiquetas de balança (prefixo 2) com peso ou
 * preço embutido, e busca por código de barras ou SKU.
 */
export async function resolveScan(
  products: ProductRepository,
  settings: StoreSettings,
  raw: string,
): Promise<ScanResolution | ScanError> {
  const parsed = parseScannerInput(raw);
  if (!parsed) return { kind: raw.trim() === '' ? 'EMPTY' : 'INVALID' };

  const { quantityMilli, code } = parsed;

  // Etiqueta de balança (EAN-13 prefixo 2).
  if (isScaleBarcode(code)) {
    const cfg: ScaleLabelConfig = {
      embeddedType: settings.scaleEmbeddedType,
      pluDigits: settings.scalePluDigits,
      valueDigits: settings.scaleValueDigits,
    };
    const label = parseScaleBarcode(code, cfg);
    if (label) {
      const product =
        (await products.getByScaleCode(label.plu)) ??
        (await products.getByScaleCode(String(Number(label.plu)))); // tolera zeros à esquerda
      if (!product) return { kind: 'NOT_FOUND', code: label.plu };
      if (label.weightMilli != null) {
        return { product, quantityMilli: label.weightMilli };
      }
      if (label.priceCents != null) {
        return { product, quantityMilli, priceOverrideCents: label.priceCents };
      }
      return { product, quantityMilli };
    }
  }

  // Código de barras comum.
  const byBarcode = await products.getByBarcode(code);
  if (byBarcode) return { product: byBarcode, quantityMilli };

  // Busca por SKU exato como fallback.
  const results = await products.search(code);
  const bySku = results.find((p) => p.sku.toLowerCase() === code.toLowerCase());
  if (bySku) return { product: bySku, quantityMilli };

  return { kind: 'NOT_FOUND', code };
}
