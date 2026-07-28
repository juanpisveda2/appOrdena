import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import { openSqliteDatabase } from '../../../src/main/db/connection';
import { catalogStockMigration } from '../../../src/main/db/migrations/v002_catalogStock';
import { consignmentsCoreMigration } from '../../../src/main/db/migrations/v004_consignmentsCore';
import { catalogSoftDeleteMigration } from '../../../src/main/db/migrations/v005_catalogSoftDelete';
import { consignmentBatchGainMigration } from '../../../src/main/db/migrations/v006_consignmentBatchGain';
import { historicalSnapshotsResetMigration } from '../../../src/main/db/migrations/v007_historicalSnapshotsReset';
import { initialSchemaMigration } from '../../../src/main/db/migrations/v001_initialSchema';
import { salesCoreMigration } from '../../../src/main/db/migrations/v003_salesCore';
import { saleItemPersonalizationSnapshotsMigration } from '../../../src/main/db/migrations/v008_saleItemPersonalizationSnapshots';
import { partialConsignmentLiquidationsMigration } from '../../../src/main/db/migrations/v009_partialConsignmentLiquidations';
import { profitRuleByPriceBaseMigration } from '../../../src/main/db/migrations/v010_profitRuleByPriceBase';
import { consignmentLiquidationSnapshotsMigration } from '../../../src/main/db/migrations/v011_consignmentLiquidationSnapshots';
import { appBrandingMetadataMigration } from '../../../src/main/db/migrations/v012_appBrandingMetadata';
import { runMigrations } from '../../../src/main/db/migrate';

const projectRootPath = fileURLToPath(new URL('../../../', import.meta.url));

describe('reset-setup-seed script', () => {
  it('recreates the database file with the current schema and wipes pre-existing data through the explicit reset flow', () => {
    const directory = mkdtempSync(join(tmpdir(), 'project-mama-reset-script-'));
    const databaseFilePath = join(directory, 'ordena.sqlite');

    try {
      const existingDatabase = openSqliteDatabase({ databaseFilePath });

      try {
        runMigrations(existingDatabase, [
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
        ]);

        const saved = saveStockIntake(existingDatabase, {
          newReusableProduct: {
            category: 'jewelry',
            name: 'Aros previos',
            material: 'Plata',
            variant: '18 mm'
          },
          enteredQuantity: 1,
          availableQuantity: 1,
          supplierUnitCostCents: 100_000,
          cashPriceCents: 120_000,
          listPriceCents: 125_000,
          profitPercentageBasisPoints: 1_000,
          intakeDate: '2026-07-01'
        });

        if (saved.kind !== 'saved') {
          throw new Error('Expected reset-script seed stock intake to be saved.');
        }

        existingDatabase.client
          .prepare(
            `
              INSERT INTO customers (name, phone_text, note, created_at, updated_at)
              VALUES ('Ana', '3510000000', NULL, '2026-07-16T09:00:00.000Z', '2026-07-16T09:00:00.000Z')
            `
          )
          .run();
      } finally {
        existingDatabase.close();
      }

      const result = spawnSync(process.execPath, ['scripts/reset-setup-seed.cjs', databaseFilePath], {
        cwd: projectRootPath,
        encoding: 'utf8'
      });

      expect(result.status).toBe(0);

      const database = openSqliteDatabase({ databaseFilePath });

      try {
        const versionRow = database.prepare<{ user_version: number }>('PRAGMA user_version').get();
        const marginRuleCount = database.client
          .prepare('SELECT COUNT(*) AS count FROM settings_margin_rules')
          .get() as { count: number };
        const salesColumns = database.client
          .prepare("PRAGMA table_info('sales')")
          .all() as Array<{ name: string }>;
        const customerCount = database.client.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number };
        const productCount = database.client.prepare('SELECT COUNT(*) AS count FROM reusable_products').get() as { count: number };

        expect(versionRow?.user_version).toBe(12);
        expect(marginRuleCount.count).toBe(4);
        expect(customerCount.count).toBe(0);
        expect(productCount.count).toBe(0);
        expect(salesColumns.map((column) => column.name)).toEqual(
          expect.arrayContaining(['customer_name_snapshot', 'customer_phone_snapshot'])
        );
        const saleItemColumns = database.client
          .prepare("PRAGMA table_info('sale_items')")
          .all() as Array<{ name: string }>;
        expect(saleItemColumns.map((column) => column.name)).toEqual(
          expect.arrayContaining([
            'unit_base_price_cents',
            'unit_personalization_amount_cents',
            'personalization_percentage_basis_points',
            'line_base_subtotal_cents',
            'line_personalization_subtotal_cents',
            'product_gain_cents',
            'personalization_gain_cents',
            'total_gain_cents'
          ])
        );
        const consignmentBatchColumns = database.client
          .prepare("PRAGMA table_info('consignment_batch_items')")
          .all() as Array<{ name: string }>;
        expect(consignmentBatchColumns.map((column) => column.name)).toEqual(
          expect.arrayContaining([
            'product_gain_cents',
            'personalization_gain_cents',
            'gain_cents',
            'snapshot_sale_status',
            'snapshot_sale_paid_cents',
            'snapshot_sale_balance_cents',
            'snapshot_buyer_name',
            'snapshot_payment_method_summary'
          ])
        );
      } finally {
        database.close();
      }
    } finally {
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50
      });
    }
  });
});
