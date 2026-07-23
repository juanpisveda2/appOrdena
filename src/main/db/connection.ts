import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export interface PreparedStatementLike<TResult> {
  get(...params: unknown[]): TResult | undefined;
}

type BetterSqlite3Client = InstanceType<typeof BetterSqlite3>;
type DrizzleDatabaseLike = ReturnType<typeof drizzle>;

export interface SqliteDatabaseLike {
  client: BetterSqlite3Client;
  orm: DrizzleDatabaseLike;
  exec(sql: string): void;
  prepare<TResult>(sql: string): PreparedStatementLike<TResult>;
  close(): void;
}

export interface OpenSqliteDatabaseOptions {
  databaseFilePath: string;
  ensureDirectory?: (path: string, options: { recursive: true }) => void;
  openDatabase?: (databaseFilePath: string) => SqliteDatabaseLike;
}

export function openSqliteDatabase({
  databaseFilePath,
  ensureDirectory = mkdirSync,
  openDatabase = createDrizzleSqliteDatabase
}: OpenSqliteDatabaseOptions): SqliteDatabaseLike {
  ensureDirectory(dirname(databaseFilePath), { recursive: true });

  return openDatabase(databaseFilePath);
}

function createDrizzleSqliteDatabase(databaseFilePath: string): SqliteDatabaseLike {
  const client = new BetterSqlite3(databaseFilePath);
  const orm = drizzle({ client });

  return {
    client,
    orm,
    exec(sql: string) {
      client.exec(sql);
    },
    prepare<TResult>(sql: string) {
      return client.prepare(sql) as PreparedStatementLike<TResult>;
    },
    close() {
      client.close();
    }
  };
}
