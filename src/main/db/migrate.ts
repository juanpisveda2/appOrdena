import { initialSchemaMigration } from './migrations/v001_initialSchema';
import { catalogStockMigration } from './migrations/v002_catalogStock';
import { salesCoreMigration } from './migrations/v003_salesCore';
import { consignmentsCoreMigration } from './migrations/v004_consignmentsCore';
import { catalogSoftDeleteMigration } from './migrations/v005_catalogSoftDelete';
import { consignmentBatchGainMigration } from './migrations/v006_consignmentBatchGain';
import { historicalSnapshotsResetMigration } from './migrations/v007_historicalSnapshotsReset';
import { saleItemPersonalizationSnapshotsMigration } from './migrations/v008_saleItemPersonalizationSnapshots';
import { partialConsignmentLiquidationsMigration } from './migrations/v009_partialConsignmentLiquidations';
import { profitRuleByPriceBaseMigration } from './migrations/v010_profitRuleByPriceBase';
import { consignmentLiquidationSnapshotsMigration } from './migrations/v011_consignmentLiquidationSnapshots';
import { appBrandingMetadataMigration } from './migrations/v012_appBrandingMetadata';
import type { SqliteDatabaseLike } from './connection';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  appliedVersions: number[];
}

const foundationMigrations: readonly Migration[] = [
  initialSchemaMigration,
  catalogStockMigration,
  salesCoreMigration,
  consignmentsCoreMigration,
  catalogSoftDeleteMigration,
  consignmentBatchGainMigration,
  historicalSnapshotsResetMigration,
  saleItemPersonalizationSnapshotsMigration,
  partialConsignmentLiquidationsMigration,
  profitRuleByPriceBaseMigration,
  consignmentLiquidationSnapshotsMigration,
  appBrandingMetadataMigration
];

export function getSchemaVersion(database: SqliteDatabaseLike): number {
  const row = database.prepare<{ user_version: number }>('PRAGMA user_version').get();

  return typeof row?.user_version === 'number' ? row.user_version : 0;
}

export function runMigrations(
  database: SqliteDatabaseLike,
  migrations: readonly Migration[] = foundationMigrations
): MigrationResult {
  const fromVersion = getSchemaVersion(database);
  const pendingMigrations = migrations
    .filter((migration) => migration.version > fromVersion)
    .sort((left, right) => left.version - right.version);

  for (const migration of pendingMigrations) {
    applyMigration(database, migration);
  }

  return {
    fromVersion,
    toVersion: getSchemaVersion(database),
    appliedVersions: pendingMigrations.map((migration) => migration.version)
  };
}

function applyMigration(database: SqliteDatabaseLike, migration: Migration): void {
  try {
    database.exec('BEGIN IMMEDIATE');
    database.exec(migration.sql);
    database.exec(`PRAGMA user_version = ${migration.version}`);
    database.exec('COMMIT');
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Ignore rollback failures so the original migration error is preserved.
    }

    throw error;
  }
}
