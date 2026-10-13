import type { BaseEntity } from '@/domain/types';
import type { Product, Category } from '@/domain/product';
import type { Sale, SaleItem, Payment } from '@/domain/sale';
import type { StockMovement, StockBalance } from '@/domain/stock';
import type { CashSession, CashMovement } from '@/domain/cash-register';
import type { User } from '@/domain/user';
import type { StoreSettings } from '@/domain/settings';
import type { AuditLog } from '@/domain/audit';
import type { OutboxEntry } from '@/domain/outbox';

/**
 * Repositório de entidades sincronizáveis. As implementações (Dexie) devem,
 * em `put`/`softDelete`, gravar um registro de outbox NA MESMA transação.
 */
export interface Repository<T extends BaseEntity> {
  get(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  /** Insere ou atualiza; enfileira outbox (UPSERT). */
  put(entity: T): Promise<void>;
  /** Marca deletedAt e enfileira outbox (DELETE). */
  softDelete(id: string): Promise<void>;
}

export interface ProductRepository extends Repository<Product> {
  getByBarcode(barcode: string): Promise<Product | undefined>;
  getByScaleCode(plu: string): Promise<Product | undefined>;
  search(term: string): Promise<Product[]>;
}

export interface SaleRepository extends Repository<Sale> {
  /** Próximo número sequencial de venda para o terminal. */
  nextNumber(terminalId: string): Promise<number>;
  listBySession(cashSessionId: string): Promise<Sale[]>;
  listByPeriod(startIso: string, endIso: string): Promise<Sale[]>;
}

export interface SaleItemRepository extends Repository<SaleItem> {
  listBySale(saleId: string): Promise<SaleItem[]>;
}

export interface PaymentRepository extends Repository<Payment> {
  listBySale(saleId: string): Promise<Payment[]>;
  listBySaleIds(saleIds: string[]): Promise<Payment[]>;
}

export interface StockMovementRepository extends Repository<StockMovement> {
  listByProduct(productId: string): Promise<StockMovement[]>;
  listAll(): Promise<StockMovement[]>;
}

/** Cache derivado; não sincroniza (recalculável a partir do ledger). */
export interface StockBalanceRepository {
  get(productId: string): Promise<StockBalance | undefined>;
  getAll(): Promise<StockBalance[]>;
  put(balance: StockBalance): Promise<void>;
  clear(): Promise<void>;
}

export interface CashSessionRepository extends Repository<CashSession> {
  getOpenSession(terminalId: string): Promise<CashSession | undefined>;
}

export interface CashMovementRepository extends Repository<CashMovement> {
  listBySession(cashSessionId: string): Promise<CashMovement[]>;
}

export interface UserRepository extends Repository<User> {
  getByName(name: string): Promise<User | undefined>;
}

export interface SettingsRepository {
  get(): Promise<StoreSettings | undefined>;
  put(settings: StoreSettings): Promise<void>;
}

export interface AuditLogRepository extends Repository<AuditLog> {
  listRecent(limit: number): Promise<AuditLog[]>;
}

/** Fila de saída para sincronização. Não enfileira a si mesma. */
export interface OutboxRepository {
  enqueue(entry: OutboxEntry): Promise<void>;
  peek(limit: number): Promise<OutboxEntry[]>;
  count(): Promise<number>;
  remove(ids: string[]): Promise<void>;
  markError(id: string, error: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Conjunto de repositórios + execução transacional atômica.
 * `transaction(fn)` deve rodar fn dentro de uma transação read-write que
 * cubra todas as tabelas; se fn lançar, nada é persistido.
 */
export interface Repositories {
  products: ProductRepository;
  categories: Repository<Category>;
  sales: SaleRepository;
  saleItems: SaleItemRepository;
  payments: PaymentRepository;
  stockMovements: StockMovementRepository;
  stockBalances: StockBalanceRepository;
  cashSessions: CashSessionRepository;
  cashMovements: CashMovementRepository;
  users: UserRepository;
  settings: SettingsRepository;
  auditLogs: AuditLogRepository;
  outbox: OutboxRepository;
  /** Executa fn atomicamente (tudo ou nada). */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
