import { openSqliteDatabase, type OpenSqliteDatabaseOptions, type SqliteDatabaseLike } from '../db/connection';
import { runMigrations, type MigrationResult } from '../db/migrate';
import { resolveAppPaths, type AppPathProvider, type AppPaths } from '../platform/appPaths';

export interface AppBootstrapState {
  dbReady: boolean;
  schemaVersion: number;
}

export interface InitializedApp {
  paths: AppPaths;
  database: SqliteDatabaseLike;
  state: AppBootstrapState;
}

export interface InitializeAppOptions {
  pathProvider: AppPathProvider;
  openDatabase?: (options: OpenSqliteDatabaseOptions) => SqliteDatabaseLike;
  migrateDatabase?: (database: SqliteDatabaseLike) => MigrationResult;
}

export function initializeApp({
  pathProvider,
  openDatabase = openSqliteDatabase,
  migrateDatabase = runMigrations
}: InitializeAppOptions): InitializedApp {
  const paths = resolveAppPaths({ pathProvider });
  const database = openDatabase({ databaseFilePath: paths.databaseFilePath });

  try {
    const migrationResult = migrateDatabase(database);

    return {
      paths,
      database,
      state: {
        dbReady: true,
        schemaVersion: migrationResult.toVersion
      }
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
