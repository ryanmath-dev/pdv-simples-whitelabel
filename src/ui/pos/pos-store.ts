import { create } from 'zustand';
import { newId } from '@/domain/types';
import type { Cents } from '@/domain/money';
import type { Unit } from '@/domain/quantity';
import type { Product } from '@/domain/product';
import { computeItemTotal, computeSaleTotals } from '@/domain/sale';

/** Item do carrinho (em memória, antes de finalizar). */
export interface CartItem {
  lineId: string;
  productId: string;
  description: string;
  unit: Unit;
  quantity: number; // milésimos
  unitPriceCents: Cents;
  discountCents: Cents;
}

/** Venda suspensa (em espera). */
export interface HeldSale {
  id: string;
  items: CartItem[];
  saleDiscountCents: Cents;
  heldAt: string;
}

interface PosState {
  items: CartItem[];
  saleDiscountCents: Cents;
  held: HeldSale[];
  addProduct: (product: Product, quantityMilli: number, priceOverrideCents?: Cents) => void;
  updateQuantity: (lineId: string, quantityMilli: number) => void;
  setItemDiscount: (lineId: string, discountCents: Cents) => void;
  removeItem: (lineId: string) => void;
  setSaleDiscount: (cents: Cents) => void;
  clear: () => void;
  holdCurrent: () => void;
  resume: (heldId: string) => void;
  discardHeld: (heldId: string) => void;
  totals: () => { subtotalCents: Cents; discountCents: Cents; totalCents: Cents };
}

export const usePos = create<PosState>((set, get) => ({
  items: [],
  saleDiscountCents: 0,
  held: [],

  addProduct(product, quantityMilli, priceOverrideCents) {
    const price = priceOverrideCents ?? product.priceCents;
    set((state) => {
      // Agrupa por produto+preço quando for UN (mesma linha), soma a quantidade.
      const existing = state.items.find(
        (i) => i.productId === product.id && i.unitPriceCents === price && i.unit === 'UN',
      );
      if (existing && product.unit === 'UN') {
        return {
          items: state.items.map((i) =>
            i.lineId === existing.lineId
              ? { ...i, quantity: i.quantity + quantityMilli }
              : i,
          ),
        };
      }
      const item: CartItem = {
        lineId: newId(),
        productId: product.id,
        description: product.name,
        unit: product.unit,
        quantity: quantityMilli,
        unitPriceCents: price,
        discountCents: 0,
      };
      return { items: [...state.items, item] };
    });
  },

  updateQuantity(lineId, quantityMilli) {
    set((state) => ({
      items: state.items.map((i) =>
        i.lineId === lineId ? { ...i, quantity: quantityMilli } : i,
      ),
    }));
  },

  setItemDiscount(lineId, discountCents) {
    set((state) => ({
      items: state.items.map((i) =>
        i.lineId === lineId ? { ...i, discountCents } : i,
      ),
    }));
  },

  removeItem(lineId) {
    set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) }));
  },

  setSaleDiscount(cents) {
    set({ saleDiscountCents: cents });
  },

  clear() {
    set({ items: [], saleDiscountCents: 0 });
  },

  holdCurrent() {
    const { items, saleDiscountCents, held } = get();
    if (items.length === 0) return;
    set({
      held: [
        ...held,
        { id: newId(), items, saleDiscountCents, heldAt: new Date().toISOString() },
      ],
      items: [],
      saleDiscountCents: 0,
    });
  },

  resume(heldId) {
    const { held, items } = get();
    const target = held.find((h) => h.id === heldId);
    if (!target) return;
    // Se houver venda em andamento, segura antes de retomar.
    const remaining = held.filter((h) => h.id !== heldId);
    if (items.length > 0) {
      remaining.push({
        id: newId(),
        items,
        saleDiscountCents: get().saleDiscountCents,
        heldAt: new Date().toISOString(),
      });
    }
    set({
      items: target.items,
      saleDiscountCents: target.saleDiscountCents,
      held: remaining,
    });
  },

  discardHeld(heldId) {
    set((state) => ({ held: state.held.filter((h) => h.id !== heldId) }));
  },

  totals() {
    const { items, saleDiscountCents } = get();
    const t = computeSaleTotals(
      items.map((i) => ({
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
        discountCents: i.discountCents,
        canceled: false,
      })),
      saleDiscountCents,
    );
    return {
      subtotalCents: t.subtotalCents,
      discountCents: t.itemDiscountCents + t.saleDiscountCents,
      totalCents: t.totalCents,
    };
  },
}));

/** Calcula o total de uma linha (para exibição). */
export function cartItemTotal(item: CartItem): Cents {
  return computeItemTotal(item.unitPriceCents, item.quantity, item.discountCents);
}
