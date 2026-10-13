import { sumCents, type Cents } from './money';
import type { Sale, SaleItem, Payment, PaymentMethod } from './sale';

export interface DailySales {
  date: string; // YYYY-MM-DD
  totalCents: Cents;
  count: number;
}

/** Agrupa vendas finalizadas por dia (data local). */
export function salesByDay(sales: Sale[]): DailySales[] {
  const map = new Map<string, { total: Cents; count: number }>();
  for (const s of sales) {
    if (s.status !== 'FINALIZED') continue;
    const date = (s.finalizedAt ?? s.createdAt).slice(0, 10);
    const cur = map.get(date) ?? { total: 0, count: 0 };
    cur.total += s.totalCents;
    cur.count += 1;
    map.set(date, cur);
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, totalCents: v.total, count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Total e ticket médio de uma lista de vendas finalizadas. */
export function salesTotals(sales: Sale[]): { totalCents: Cents; count: number; avgTicketCents: Cents } {
  const finalized = sales.filter((s) => s.status === 'FINALIZED');
  const total = sumCents(finalized.map((s) => s.totalCents));
  const count = finalized.length;
  return { totalCents: total, count, avgTicketCents: count > 0 ? Math.round(total / count) : 0 };
}

/** Soma por forma de pagamento. */
export function paymentsByMethod(payments: Payment[]): Record<PaymentMethod, Cents> {
  const acc: Record<PaymentMethod, Cents> = {
    CASH: 0,
    PIX: 0,
    DEBIT: 0,
    CREDIT: 0,
    STORE_CREDIT: 0,
  };
  for (const p of payments) acc[p.method] += p.amountCents;
  return acc;
}

export interface ProductSales {
  productId: string;
  description: string;
  quantity: number; // milésimos
  revenueCents: Cents;
  costCents: Cents;
  marginCents: Cents;
}

/**
 * Agrega vendas por produto a partir dos itens (não cancelados).
 * O custo vem de um mapa productId -> custo unitário (centavos).
 */
export function productSales(
  items: SaleItem[],
  costByProduct: Map<string, Cents>,
): ProductSales[] {
  const map = new Map<string, ProductSales>();
  for (const i of items) {
    if (i.canceled) continue;
    const cur =
      map.get(i.productId) ??
      {
        productId: i.productId,
        description: i.description,
        quantity: 0,
        revenueCents: 0,
        costCents: 0,
        marginCents: 0,
      };
    cur.quantity += i.quantity;
    cur.revenueCents += i.totalCents;
    const unitCost = costByProduct.get(i.productId) ?? 0;
    cur.costCents += Math.round((unitCost * i.quantity) / 1000);
    cur.marginCents = cur.revenueCents - cur.costCents;
    map.set(i.productId, cur);
  }
  return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

export type AbcClass = 'A' | 'B' | 'C';

export interface AbcItem extends ProductSales {
  abc: AbcClass;
  cumulativePercent: number;
}

/**
 * Curva ABC simples por receita: A até 80% acumulado, B até 95%, C o resto.
 * Espera a lista já ordenada por receita desc (como productSales retorna).
 */
export function abcCurve(sales: ProductSales[]): AbcItem[] {
  const total = sumCents(sales.map((s) => s.revenueCents));
  if (total === 0) return sales.map((s) => ({ ...s, abc: 'C', cumulativePercent: 0 }));
  let acc = 0;
  return sales.map((s) => {
    acc += s.revenueCents;
    const pct = (acc / total) * 100;
    const abc: AbcClass = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
    return { ...s, abc, cumulativePercent: pct };
  });
}
