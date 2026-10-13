import Dexie, { type Table } from 'dexie';
import type { Product, Category } from '@/domain/product';
import type { Sale, SaleItem, Payment } from '@/domain/sale';
import type { StockMovement, StockBalance } from '@/domain/stock';
import type { CashSession, CashMovement } from '@/domain/cash-register';
import type { User } from '@/domain/user';
import type { StoreSettings } from '@/domain/settings';
import type { AuditLog } from '@/domain/audit';
import type { OutboxEntry } from '@/domain/outbox';

export const DB_NAME = 'pdv-mercadinho';

/**
 * Banco local (IndexedDB via Dexie). Migrações versionadas desde a v1.
 * Ao evoluir o schema, adicione um novo `this.version(n).stores({...})`
 * e, se necessário, `.upgrade(tx => ...)`.
 */
export class PdvDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  payments!: Table<Payment, string>;
  stockMovements!: Table<StockMovement, string>;
  stockBalances!: Table<StockBalance, string>;
  cashSessions!: Table<CashSession, string>;
  cashMovements!: Table<CashMovement, string>;
  users!: Table<User, string>;
  settings!: Table<StoreSettings, string>;
  auditLogs!: Table<AuditLog, string>;
  outbox!: Table<OutboxEntry, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      products: 'id, barcode, scaleCode, categoryId, name, active, updatedAt',
      categories: 'id, name, updatedAt',
      sales: 'id, number, terminalId, cashSessionId, status, createdAt, finalizedAt, updatedAt',
      saleItems: 'id, saleId, productId, updatedAt',
      payments: 'id, saleId, method, updatedAt',
      stockMovements: 'id, productId, type, refId, createdAt, updatedAt',
      stockBalances: 'productId, updatedAt',
      cashSessions: 'id, terminalId, closedAt, openedAt, updatedAt',
      cashMovements: 'id, cashSessionId, type, updatedAt',
      users: 'id, name, role, updatedAt',
      settings: 'id, updatedAt',
      auditLogs: 'id, action, createdAt, updatedAt',
      outbox: 'id, entity, entityId, createdAt',
    });
  }
}

/** Todas as tabelas que participam de transações read-write atômicas. */
export function allTables(db: PdvDatabase): Table[] {
  return [
    db.products,
    db.categories,
    db.sales,
    db.saleItems,
    db.payments,
    db.stockMovements,
    db.stockBalances,
    db.cashSessions,
    db.cashMovements,
    db.users,
    db.settings,
    db.auditLogs,
    db.outbox,
  ];
}
