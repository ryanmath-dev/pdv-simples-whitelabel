import { allTables, type PdvDatabase } from './schema';

export interface BackupFile {
  app: 'pdv-mercadinho';
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Exporta todas as tabelas do banco para um objeto serializável. */
export async function exportDatabase(db: PdvDatabase): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const table of allTables(db)) {
    tables[table.name] = await table.toArray();
  }
  return {
    app: 'pdv-mercadinho',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Limpa todas as tabelas do banco (dentro de uma transação). */
export async function clearDatabase(db: PdvDatabase): Promise<void> {
  const tables = allTables(db);
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear();
  });
}

/** Restaura o banco a partir de um backup (substitui todo o conteúdo). */
export async function importDatabase(db: PdvDatabase, backup: BackupFile): Promise<void> {
  if (backup.app !== 'pdv-mercadinho') {
    throw new Error('Arquivo de backup inválido.');
  }
  const tables = allTables(db);
  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.clear();
      const rows = backup.tables[table.name];
      if (Array.isArray(rows) && rows.length > 0) {
        await table.bulkPut(rows as never[]);
      }
    }
  });
}
