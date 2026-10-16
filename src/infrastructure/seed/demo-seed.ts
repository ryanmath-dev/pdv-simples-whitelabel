import type { PdvDatabase } from '@/infrastructure/db/schema';
import { makeBase, newId, now } from '@/domain/types';
import { makeEan13 } from '@/domain/barcode';
import { hashPin, type User } from '@/domain/user';
import { createProduct, type Category, type Product } from '@/domain/product';
import {
  computeItemTotal,
  computeSaleTotals,
  type Payment,
  type PaymentMethod,
  type Sale,
  type SaleItem,
} from '@/domain/sale';
import type { StockMovement } from '@/domain/stock';
import { rebuildBalances } from '@/domain/stock';
import type { CashSession } from '@/domain/cash-register';
import { defaultSettings } from '@/domain/settings';

/** RNG determinístico simples (mulberry32) para um seed reproduzível. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedProductDef {
  name: string;
  category: string;
  unit: 'UN' | 'KG';
  price: number; // reais
  cost: number; // reais
  minUnits: number;
  scale?: boolean;
}

const CATEGORIES = [
  'Mercearia',
  'Bebidas',
  'Hortifruti',
  'Padaria',
  'Laticínios',
  'Limpeza',
  'Higiene',
  'Carnes',
];

const PRODUCTS: SeedProductDef[] = [
  // Mercearia
  { name: 'Arroz Branco 5kg', category: 'Mercearia', unit: 'UN', price: 25.9, cost: 19.5, minUnits: 8 },
  { name: 'Feijão Carioca 1kg', category: 'Mercearia', unit: 'UN', price: 8.49, cost: 6.0, minUnits: 10 },
  { name: 'Óleo de Soja 900ml', category: 'Mercearia', unit: 'UN', price: 7.29, cost: 5.4, minUnits: 12 },
  { name: 'Açúcar Refinado 1kg', category: 'Mercearia', unit: 'UN', price: 4.99, cost: 3.5, minUnits: 10 },
  { name: 'Café Torrado 500g', category: 'Mercearia', unit: 'UN', price: 15.9, cost: 11.0, minUnits: 8 },
  { name: 'Macarrão Espaguete 500g', category: 'Mercearia', unit: 'UN', price: 4.29, cost: 2.8, minUnits: 15 },
  { name: 'Farinha de Trigo 1kg', category: 'Mercearia', unit: 'UN', price: 5.49, cost: 3.6, minUnits: 8 },
  { name: 'Sal Refinado 1kg', category: 'Mercearia', unit: 'UN', price: 2.49, cost: 1.4, minUnits: 6 },
  { name: 'Molho de Tomate 340g', category: 'Mercearia', unit: 'UN', price: 3.19, cost: 2.0, minUnits: 12 },
  { name: 'Sardinha em Lata 125g', category: 'Mercearia', unit: 'UN', price: 5.99, cost: 4.1, minUnits: 10 },
  { name: 'Leite Condensado 395g', category: 'Mercearia', unit: 'UN', price: 6.49, cost: 4.6, minUnits: 8 },
  { name: 'Biscoito Recheado 130g', category: 'Mercearia', unit: 'UN', price: 2.99, cost: 1.7, minUnits: 20 },
  { name: 'Fubá Mimoso 1kg', category: 'Mercearia', unit: 'UN', price: 4.19, cost: 2.5, minUnits: 6 },
  { name: 'Extrato de Tomate 340g', category: 'Mercearia', unit: 'UN', price: 3.89, cost: 2.4, minUnits: 8 },
  // Bebidas
  { name: 'Refrigerante Cola 2L', category: 'Bebidas', unit: 'UN', price: 8.99, cost: 6.2, minUnits: 15 },
  { name: 'Refrigerante Guaraná 2L', category: 'Bebidas', unit: 'UN', price: 7.99, cost: 5.5, minUnits: 15 },
  { name: 'Água Mineral 1,5L', category: 'Bebidas', unit: 'UN', price: 2.99, cost: 1.5, minUnits: 24 },
  { name: 'Suco de Laranja 1L', category: 'Bebidas', unit: 'UN', price: 6.49, cost: 4.3, minUnits: 10 },
  { name: 'Cerveja Lata 350ml', category: 'Bebidas', unit: 'UN', price: 3.49, cost: 2.3, minUnits: 48 },
  { name: 'Energético 250ml', category: 'Bebidas', unit: 'UN', price: 7.99, cost: 5.0, minUnits: 12 },
  { name: 'Água de Coco 1L', category: 'Bebidas', unit: 'UN', price: 8.49, cost: 6.0, minUnits: 8 },
  { name: 'Chá Gelado 1,5L', category: 'Bebidas', unit: 'UN', price: 5.99, cost: 3.9, minUnits: 10 },
  // Hortifruti (KG)
  { name: 'Banana Prata', category: 'Hortifruti', unit: 'KG', price: 5.99, cost: 3.5, minUnits: 10, scale: true },
  { name: 'Maçã Gala', category: 'Hortifruti', unit: 'KG', price: 8.99, cost: 5.8, minUnits: 8, scale: true },
  { name: 'Tomate', category: 'Hortifruti', unit: 'KG', price: 6.49, cost: 3.9, minUnits: 10, scale: true },
  { name: 'Batata', category: 'Hortifruti', unit: 'KG', price: 4.99, cost: 2.9, minUnits: 15, scale: true },
  { name: 'Cebola', category: 'Hortifruti', unit: 'KG', price: 5.49, cost: 3.2, minUnits: 12, scale: true },
  { name: 'Laranja Pera', category: 'Hortifruti', unit: 'KG', price: 3.99, cost: 2.2, minUnits: 10, scale: true },
  { name: 'Cenoura', category: 'Hortifruti', unit: 'KG', price: 4.49, cost: 2.5, minUnits: 8, scale: true },
  { name: 'Alho', category: 'Hortifruti', unit: 'KG', price: 24.9, cost: 16.0, minUnits: 3, scale: true },
  // Padaria
  { name: 'Pão Francês', category: 'Padaria', unit: 'KG', price: 14.9, cost: 8.5, minUnits: 5, scale: true },
  { name: 'Pão de Forma 500g', category: 'Padaria', unit: 'UN', price: 7.49, cost: 4.9, minUnits: 8 },
  { name: 'Bolo Caseiro', category: 'Padaria', unit: 'UN', price: 12.9, cost: 7.5, minUnits: 4 },
  { name: 'Rosca Doce', category: 'Padaria', unit: 'UN', price: 6.9, cost: 3.8, minUnits: 6 },
  // Laticínios
  { name: 'Leite Integral 1L', category: 'Laticínios', unit: 'UN', price: 5.29, cost: 3.9, minUnits: 20 },
  { name: 'Manteiga 200g', category: 'Laticínios', unit: 'UN', price: 9.9, cost: 6.8, minUnits: 8 },
  { name: 'Queijo Mussarela', category: 'Laticínios', unit: 'KG', price: 39.9, cost: 28.0, minUnits: 3, scale: true },
  { name: 'Presunto Fatiado', category: 'Laticínios', unit: 'KG', price: 29.9, cost: 20.0, minUnits: 3, scale: true },
  { name: 'Iogurte Natural 170g', category: 'Laticínios', unit: 'UN', price: 3.49, cost: 2.1, minUnits: 15 },
  { name: 'Requeijão 200g', category: 'Laticínios', unit: 'UN', price: 6.99, cost: 4.5, minUnits: 10 },
  { name: 'Ovos Branco Dúzia', category: 'Laticínios', unit: 'UN', price: 11.9, cost: 8.5, minUnits: 12 },
  // Limpeza
  { name: 'Detergente 500ml', category: 'Limpeza', unit: 'UN', price: 2.79, cost: 1.5, minUnits: 20 },
  { name: 'Sabão em Pó 1kg', category: 'Limpeza', unit: 'UN', price: 12.9, cost: 8.5, minUnits: 10 },
  { name: 'Água Sanitária 2L', category: 'Limpeza', unit: 'UN', price: 6.49, cost: 3.8, minUnits: 12 },
  { name: 'Amaciante 2L', category: 'Limpeza', unit: 'UN', price: 10.9, cost: 7.0, minUnits: 8 },
  { name: 'Papel Higiênico 12un', category: 'Limpeza', unit: 'UN', price: 18.9, cost: 12.5, minUnits: 10 },
  { name: 'Esponja de Louça', category: 'Limpeza', unit: 'UN', price: 1.99, cost: 0.9, minUnits: 24 },
  { name: 'Desinfetante 2L', category: 'Limpeza', unit: 'UN', price: 8.49, cost: 5.2, minUnits: 8 },
  // Higiene
  { name: 'Sabonete 90g', category: 'Higiene', unit: 'UN', price: 2.49, cost: 1.3, minUnits: 24 },
  { name: 'Creme Dental 90g', category: 'Higiene', unit: 'UN', price: 4.99, cost: 2.9, minUnits: 15 },
  { name: 'Shampoo 350ml', category: 'Higiene', unit: 'UN', price: 13.9, cost: 9.0, minUnits: 8 },
  { name: 'Desodorante Aerosol', category: 'Higiene', unit: 'UN', price: 14.9, cost: 9.8, minUnits: 8 },
  { name: 'Absorvente 8un', category: 'Higiene', unit: 'UN', price: 6.49, cost: 3.9, minUnits: 10 },
  { name: 'Lâmina de Barbear 2un', category: 'Higiene', unit: 'UN', price: 5.99, cost: 3.5, minUnits: 12 },
  // Carnes
  { name: 'Peito de Frango', category: 'Carnes', unit: 'KG', price: 14.9, cost: 10.5, minUnits: 8, scale: true },
  { name: 'Carne Moída', category: 'Carnes', unit: 'KG', price: 29.9, cost: 22.0, minUnits: 5, scale: true },
  { name: 'Linguiça Toscana', category: 'Carnes', unit: 'KG', price: 19.9, cost: 13.5, minUnits: 5, scale: true },
  { name: 'Costela Bovina', category: 'Carnes', unit: 'KG', price: 34.9, cost: 26.0, minUnits: 4, scale: true },
  { name: 'Coxa de Frango', category: 'Carnes', unit: 'KG', price: 10.9, cost: 7.2, minUnits: 8, scale: true },
  { name: 'Bacon Fatiado', category: 'Carnes', unit: 'KG', price: 32.9, cost: 23.0, minUnits: 3, scale: true },
];

const PAYMENT_WEIGHTS: [PaymentMethod, number][] = [
  ['CASH', 0.4],
  ['PIX', 0.3],
  ['DEBIT', 0.2],
  ['CREDIT', 0.1],
];

function pickMethod(r: () => number): PaymentMethod {
  const x = r();
  let acc = 0;
  for (const [m, w] of PAYMENT_WEIGHTS) {
    acc += w;
    if (x <= acc) return m;
  }
  return 'CASH';
}

/** Verdadeiro se o banco ainda não tem produtos (demo não semeada). */
export async function isDatabaseEmpty(db: PdvDatabase): Promise<boolean> {
  return (await db.products.count()) === 0;
}

/**
 * Popula o banco com dados de demonstração: categorias, ~60 produtos com EANs
 * válidos fictícios, estoque inicial (alguns abaixo do mínimo), usuários demo e
 * ~2 semanas de vendas históricas. Escreve em massa, numa transação; o cache de
 * saldos é recalculado a partir do ledger para garantir consistência.
 */
export async function seedDemoData(db: PdvDatabase): Promise<void> {
  const r = rng(42);

  const categories: Category[] = CATEGORIES.map((name) => ({ ...makeBase(), name }));
  const catId = new Map(categories.map((c) => [c.name, c.id]));

  const products: Product[] = PRODUCTS.map((def, i) => {
    const ean = makeEan13('789' + String(i + 1).padStart(9, '0'));
    const p = createProduct({
      sku: `SKU${String(i + 1).padStart(3, '0')}`,
      name: def.name,
      barcode: ean,
      categoryId: catId.get(def.category) ?? null,
      unit: def.unit,
      priceCents: Math.round(def.price * 100),
      costCents: Math.round(def.cost * 100),
      minStock: def.minUnits * 1000,
      scaleCode: def.scale ? String(i + 1).padStart(6, '0') : null,
    });
    return p;
  });

  const movements: StockMovement[] = [];
  const userId = newId();

  // Estoque inicial (PURCHASE). Alguns produtos ficam abaixo do mínimo.
  products.forEach((p, i) => {
    const belowMin = i % 11 === 0; // ~5-6 produtos abaixo do mínimo
    const base = belowMin ? p.minStock / 2 : p.minStock * (3 + Math.floor(r() * 4));
    const qty = Math.max(1000, Math.round(base));
    movements.push({
      ...makeBase(),
      productId: p.id,
      type: 'PURCHASE',
      quantity: qty,
      unitCostCents: p.costCents,
      refType: 'SEED',
      refId: null,
      reason: 'Estoque inicial (demo)',
      userId,
    });
  });

  // Usuários demo.
  const users: User[] = [
    { ...makeBase(), id: userId, name: 'admin', role: 'ADMIN', pinHash: await hashPin('1234') },
    { ...makeBase(), name: 'caixa', role: 'OPERATOR', pinHash: await hashPin('0000') },
  ];

  // ~2 semanas de vendas históricas.
  const sales: Sale[] = [];
  const saleItems: SaleItem[] = [];
  const payments: Payment[] = [];
  const cashSessions: CashSession[] = [];
  let saleNumber = 1;
  const terminalId = 'TERM-01';

  for (let day = 14; day >= 1; day--) {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    date.setDate(date.getDate() - day);

    const session: CashSession = {
      ...makeBase(),
      createdAt: date.toISOString(),
      terminalId,
      userId,
      openedAt: date.toISOString(),
      openingCents: 10000,
      closedAt: new Date(date.getTime() + 10 * 3600_000).toISOString(),
      countedCents: null,
      expectedCents: null,
      differenceCents: null,
    };
    cashSessions.push(session);

    const salesToday = 8 + Math.floor(r() * 10);
    for (let s = 0; s < salesToday; s++) {
      const when = new Date(date.getTime() + Math.floor(r() * 9 * 3600_000));
      const nItems = 1 + Math.floor(r() * 5);
      const chosen: { product: Product; qty: number }[] = [];
      for (let k = 0; k < nItems; k++) {
        const product = products[Math.floor(r() * products.length)]!;
        const qty =
          product.unit === 'KG'
            ? Math.max(200, Math.round((0.2 + r() * 1.8) * 1000))
            : (1 + Math.floor(r() * 3)) * 1000;
        chosen.push({ product, qty });
      }

      const saleId = newId();
      const its = chosen.map(({ product, qty }) => {
        const total = computeItemTotal(product.priceCents, qty, 0);
        const item: SaleItem = {
          ...makeBase(),
          createdAt: when.toISOString(),
          saleId,
          productId: product.id,
          description: product.name,
          unit: product.unit,
          quantity: qty,
          unitPriceCents: product.priceCents,
          discountCents: 0,
          totalCents: total,
          canceled: false,
        };
        return item;
      });

      const totals = computeSaleTotals(
        its.map((i) => ({
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
          discountCents: i.discountCents,
          canceled: false,
        })),
        0,
      );

      const method = pickMethod(r);
      const sale: Sale = {
        ...makeBase(),
        id: saleId,
        createdAt: when.toISOString(),
        number: saleNumber++,
        terminalId,
        cashSessionId: session.id,
        userId,
        status: 'FINALIZED',
        subtotalCents: totals.subtotalCents,
        discountCents: 0,
        totalCents: totals.totalCents,
        changeCents: 0,
        fiscalStatus: 'NOT_REQUIRED',
        finalizedAt: when.toISOString(),
      };
      sales.push(sale);
      saleItems.push(...its);
      payments.push({
        ...makeBase(),
        createdAt: when.toISOString(),
        saleId,
        method,
        amountCents: totals.totalCents,
        receivedCents: method === 'CASH' ? totals.totalCents : null,
        providerRef: null,
        status: 'CONFIRMED',
      });

      // Movimentos de saída (SALE).
      for (const { product, qty } of chosen) {
        movements.push({
          ...makeBase(),
          createdAt: when.toISOString(),
          productId: product.id,
          type: 'SALE',
          quantity: -qty,
          unitCostCents: null,
          refType: 'SALE',
          refId: saleId,
          reason: null,
          userId,
        });
      }
    }
  }

  // Saldos recalculados a partir do ledger (garante cache == ledger).
  const balanceMap = rebuildBalances(movements);
  const ts = now();
  const balances = products.map((p) => ({
    productId: p.id,
    quantity: balanceMap.get(p.id) ?? 0,
    updatedAt: ts,
  }));

  const settings = { ...defaultSettings(), storeName: 'Mercadinho do Bairro' };

  await db.transaction(
    'rw',
    [
      db.categories,
      db.products,
      db.users,
      db.stockMovements,
      db.stockBalances,
      db.sales,
      db.saleItems,
      db.payments,
      db.cashSessions,
      db.settings,
    ],
    async () => {
      await db.categories.bulkPut(categories);
      await db.products.bulkPut(products);
      await db.users.bulkPut(users);
      await db.stockMovements.bulkPut(movements);
      await db.stockBalances.bulkPut(balances);
      await db.sales.bulkPut(sales);
      await db.saleItems.bulkPut(saleItems);
      await db.payments.bulkPut(payments);
      await db.cashSessions.bulkPut(cashSessions);
      await db.settings.put(settings);
    },
  );
}
