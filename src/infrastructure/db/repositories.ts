import Dexie, { type Table } from 'dexie';
import { newId, now, type BaseEntity } from '@/domain/types';
import type { OutboxEntry } from '@/domain/outbox';
import type {
  AuditLogRepository,
  CashMovementRepository,
  CashSessionRepository,
  OutboxRepository,
  PaymentRepository,
  ProductRepository,
  Repositories,
  Repository,
  SaleItemRepository,
  SaleRepository,
  SettingsRepository,
  StockBalanceRepository,
  StockMovementRepository,
  UserRepository,
} from '@/application/ports/repositories';
import type { Product, Category } from '@/domain/product';
import type { Sale, SaleItem, Payment } from '@/domain/sale';
import type { StockMovement, StockBalance } from '@/domain/stock';
import type { CashSession, CashMovement } from '@/domain/cash-register';
import type { User } from '@/domain/user';
import type { StoreSettings } from '@/domain/settings';
import { SETTINGS_ID } from '@/domain/settings';
import type { AuditLog } from '@/domain/audit';
import { allTables, type PdvDatabase } from './schema';

/** Enfileira uma entrada de outbox (usa a transação ambiente, se houver). */
async function putOutbox(
  outboxTable: Table<OutboxEntry, string>,
  entity: string,
  entityId: string,
  op: 'UPSERT' | 'DELETE',
  payload: unknown,
): Promise<void> {
  const entry: OutboxEntry = {
    id: newId(),
    entity,
    entityId,
    op,
    payload,
    createdAt: now(),
    attempts: 0,
    lastError: null,
  };
  await outboxTable.put(entry);
}

/**
 * Repositório base: grava a entidade e a entrada de outbox atomicamente.
 * Se já houver uma transação em andamento, participa dela; caso contrário,
 * abre uma transação própria cobrindo a tabela e a outbox.
 */
class DexieSyncedRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    protected db: PdvDatabase,
    protected table: Table<T, string>,
    protected entityName: string,
  ) {}

  protected get outbox(): Table<OutboxEntry, string> {
    return this.db.outbox;
  }

  /** Executa fn na transação ambiente ou em uma nova rw cobrindo table+outbox. */
  protected atomic<R>(fn: () => Promise<R>): Promise<R> {
    if (Dexie.currentTransaction) return fn();
    return this.db.transaction('rw', this.table, this.outbox, fn);
  }

  get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  async getAll(): Promise<T[]> {
    const all = await this.table.toArray();
    return all.filter((e) => !e.deletedAt);
  }

  put(entity: T): Promise<void> {
    return this.atomic(async () => {
      await this.table.put(entity);
      await putOutbox(this.outbox, this.entityName, entity.id, 'UPSERT', entity);
    });
  }

  softDelete(id: string): Promise<void> {
    return this.atomic(async () => {
      const current = await this.table.get(id);
      if (!current) return;
      const deleted = { ...current, deletedAt: now(), version: current.version + 1 };
      await this.table.put(deleted);
      await putOutbox(this.outbox, this.entityName, id, 'DELETE', deleted);
    });
  }
}

class DexieProductRepository extends DexieSyncedRepository<Product> implements ProductRepository {
  constructor(db: PdvDatabase) {
    super(db, db.products, 'products');
  }
  async getByBarcode(barcode: string): Promise<Product | undefined> {
    const p = await this.table.where('barcode').equals(barcode).first();
    return p && !p.deletedAt ? p : undefined;
  }
  async getByScaleCode(plu: string): Promise<Product | undefined> {
    const p = await this.table.where('scaleCode').equals(plu).first();
    return p && !p.deletedAt ? p : undefined;
  }
  async search(term: string): Promise<Product[]> {
    const lower = term.toLowerCase();
    const all = await this.table.toArray();
    return all.filter(
      (p) =>
        !p.deletedAt &&
        (p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          (p.barcode ?? '').includes(term)),
    );
  }
}

class DexieSaleRepository extends DexieSyncedRepository<Sale> implements SaleRepository {
  constructor(db: PdvDatabase) {
    super(db, db.sales, 'sales');
  }
  async nextNumber(terminalId: string): Promise<number> {
    const sales = await this.table.where('terminalId').equals(terminalId).toArray();
    const max = sales.reduce((m, s) => Math.max(m, s.number), 0);
    return max + 1;
  }
  async listBySession(cashSessionId: string): Promise<Sale[]> {
    return this.table.where('cashSessionId').equals(cashSessionId).toArray();
  }
  async listByPeriod(startIso: string, endIso: string): Promise<Sale[]> {
    const all = await this.table.where('createdAt').between(startIso, endIso, true, true).toArray();
    return all.filter((s) => !s.deletedAt);
  }
}

class DexieSaleItemRepository
  extends DexieSyncedRepository<SaleItem>
  implements SaleItemRepository
{
  constructor(db: PdvDatabase) {
    super(db, db.saleItems, 'saleItems');
  }
  listBySale(saleId: string): Promise<SaleItem[]> {
    return this.table.where('saleId').equals(saleId).toArray();
  }
}

class DexiePaymentRepository extends DexieSyncedRepository<Payment> implements PaymentRepository {
  constructor(db: PdvDatabase) {
    super(db, db.payments, 'payments');
  }
  listBySale(saleId: string): Promise<Payment[]> {
    return this.table.where('saleId').equals(saleId).toArray();
  }
  listBySaleIds(saleIds: string[]): Promise<Payment[]> {
    return this.table.where('saleId').anyOf(saleIds).toArray();
  }
}

class DexieStockMovementRepository
  extends DexieSyncedRepository<StockMovement>
  implements StockMovementRepository
{
  constructor(db: PdvDatabase) {
    super(db, db.stockMovements, 'stockMovements');
  }
  listByProduct(productId: string): Promise<StockMovement[]> {
    return this.table.where('productId').equals(productId).toArray();
  }
  listAll(): Promise<StockMovement[]> {
    return this.table.toArray();
  }
}

/** Cache derivado: não enfileira outbox. */
class DexieStockBalanceRepository implements StockBalanceRepository {
  constructor(private db: PdvDatabase) {}
  get(productId: string): Promise<StockBalance | undefined> {
    return this.db.stockBalances.get(productId);
  }
  getAll(): Promise<StockBalance[]> {
    return this.db.stockBalances.toArray();
  }
  async put(balance: StockBalance): Promise<void> {
    await this.db.stockBalances.put(balance);
  }
  async clear(): Promise<void> {
    await this.db.stockBalances.clear();
  }
}

class DexieCashSessionRepository
  extends DexieSyncedRepository<CashSession>
  implements CashSessionRepository
{
  constructor(db: PdvDatabase) {
    super(db, db.cashSessions, 'cashSessions');
  }
  async getOpenSession(terminalId: string): Promise<CashSession | undefined> {
    const sessions = await this.table.where('terminalId').equals(terminalId).toArray();
    return sessions.find((s) => !s.closedAt && !s.deletedAt);
  }
}

class DexieCashMovementRepository
  extends DexieSyncedRepository<CashMovement>
  implements CashMovementRepository
{
  constructor(db: PdvDatabase) {
    super(db, db.cashMovements, 'cashMovements');
  }
  listBySession(cashSessionId: string): Promise<CashMovement[]> {
    return this.table.where('cashSessionId').equals(cashSessionId).toArray();
  }
}

class DexieUserRepository extends DexieSyncedRepository<User> implements UserRepository {
  constructor(db: PdvDatabase) {
    super(db, db.users, 'users');
  }
  async getByName(name: string): Promise<User | undefined> {
    const u = await this.table.where('name').equals(name).first();
    return u && !u.deletedAt ? u : undefined;
  }
}

class DexieSettingsRepository implements SettingsRepository {
  constructor(private db: PdvDatabase) {}
  get(): Promise<StoreSettings | undefined> {
    return this.db.settings.get(SETTINGS_ID);
  }
  async put(settings: StoreSettings): Promise<void> {
    const run = async () => {
      await this.db.settings.put(settings);
      await putOutbox(this.db.outbox, 'settings', settings.id, 'UPSERT', settings);
    };
    if (Dexie.currentTransaction) return run();
    await this.db.transaction('rw', this.db.settings, this.db.outbox, run);
  }
}

class DexieAuditLogRepository
  extends DexieSyncedRepository<AuditLog>
  implements AuditLogRepository
{
  constructor(db: PdvDatabase) {
    super(db, db.auditLogs, 'auditLogs');
  }
  async listRecent(limit: number): Promise<AuditLog[]> {
    return this.table.orderBy('createdAt').reverse().limit(limit).toArray();
  }
}

class DexieOutboxRepository implements OutboxRepository {
  constructor(private db: PdvDatabase) {}
  async enqueue(entry: OutboxEntry): Promise<void> {
    await this.db.outbox.put(entry);
  }
  peek(limit: number): Promise<OutboxEntry[]> {
    return this.db.outbox.orderBy('createdAt').limit(limit).toArray();
  }
  count(): Promise<number> {
    return this.db.outbox.count();
  }
  async remove(ids: string[]): Promise<void> {
    await this.db.outbox.bulkDelete(ids);
  }
  async markError(id: string, error: string): Promise<void> {
    const entry = await this.db.outbox.get(id);
    if (!entry) return;
    await this.db.outbox.put({ ...entry, attempts: entry.attempts + 1, lastError: error });
  }
  async clear(): Promise<void> {
    await this.db.outbox.clear();
  }
}

/** Monta o conjunto de repositórios Dexie com execução transacional. */
export function createRepositories(db: PdvDatabase): Repositories {
  return {
    products: new DexieProductRepository(db),
    categories: new DexieSyncedRepository<Category>(db, db.categories, 'categories'),
    sales: new DexieSaleRepository(db),
    saleItems: new DexieSaleItemRepository(db),
    payments: new DexiePaymentRepository(db),
    stockMovements: new DexieStockMovementRepository(db),
    stockBalances: new DexieStockBalanceRepository(db),
    cashSessions: new DexieCashSessionRepository(db),
    cashMovements: new DexieCashMovementRepository(db),
    users: new DexieUserRepository(db),
    settings: new DexieSettingsRepository(db),
    auditLogs: new DexieAuditLogRepository(db),
    outbox: new DexieOutboxRepository(db),
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      return db.transaction('rw', allTables(db), fn);
    },
  };
}
