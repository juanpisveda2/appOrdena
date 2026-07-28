import { eq } from 'drizzle-orm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { getSchemaVersion, runMigrations } from '../../../src/main/db/migrate';
import { appMetadataTable, settingsMarginRulesTable } from '../../../src/main/db/schema';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

describe('initializeApp', () => {
  it('creates the userData SQLite bootstrap and runs the current non-destructive snapshot schema migration', () => {
    const initialized = createInitializedApp('project-mama-app-');
    const userDataDirectory = initialized.paths.userDataDirectory;

    const metadataRow = initialized.database.orm
      .select({ value: appMetadataTable.value })
      .from(appMetadataTable)
      .where(eq(appMetadataTable.key, 'app_id'))
      .get();
    const marginRules = initialized.database.orm
      .select({
        category: settingsMarginRulesTable.category,
        materialNormalized: settingsMarginRulesTable.materialNormalized,
        profitPercentageBasisPoints: settingsMarginRulesTable.profitPercentageBasisPoints,
        personalizationPercentageBasisPoints:
          settingsMarginRulesTable.personalizationPercentageBasisPoints
      })
      .from(settingsMarginRulesTable)
      .all();

    expect(initialized.paths.userDataDirectory).toBe(userDataDirectory);
    expect(initialized.paths.databaseFilePath).toBe(join(userDataDirectory, 'ordena.sqlite'));
    expect(initialized.state).toEqual({ dbReady: true, schemaVersion: 12 });
    expect(getSchemaVersion(initialized.database)).toBe(12);
    expect(metadataRow?.value).toBe('ordena');
    expect(marginRules).toEqual([
      {
        category: 'jewelry',
        materialNormalized: 'gold',
        profitPercentageBasisPoints: 300,
        personalizationPercentageBasisPoints: 500
      },
      {
        category: 'jewelry',
        materialNormalized: 'silver',
        profitPercentageBasisPoints: 1000,
        personalizationPercentageBasisPoints: 500
      },
      {
        category: 'mate',
        materialNormalized: '',
        profitPercentageBasisPoints: 1000,
        personalizationPercentageBasisPoints: 500
      },
      {
        category: 'clothing',
        materialNormalized: '',
        profitPercentageBasisPoints: 1000,
        personalizationPercentageBasisPoints: 500
      }
    ]);

    initialized.database.close();
  });

  it('preserves existing commercial data and backfills the latest liquidation snapshots when upgrading an existing database', () => {
    const userDataDirectory = mkdtempSync(join(tmpdir(), 'project-mama-v7-reset-'));
    const database = openSqliteDatabase({
      databaseFilePath: join(userDataDirectory, 'ordena.sqlite')
    });

    try {
      runMigrations(database, [
        initialSchemaMigration,
        catalogStockMigration,
        salesCoreMigration,
        consignmentsCoreMigration,
        catalogSoftDeleteMigration,
        consignmentBatchGainMigration,
        historicalSnapshotsResetMigration,
        saleItemPersonalizationSnapshotsMigration,
        partialConsignmentLiquidationsMigration,
        profitRuleByPriceBaseMigration
      ]);

      const product = saveStockIntake(database, {
        newReusableProduct: {
          category: 'jewelry',
          name: 'Aros anteriores',
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

      if (product.kind !== 'saved') {
        throw new Error('Expected stock intake seed to be saved.');
      }

      database.client
        .prepare(
          `
            INSERT INTO customers (name, phone_text, note, created_at, updated_at)
            VALUES ('Ana', '3510000000', NULL, '2026-07-16T09:00:00.000Z', '2026-07-16T09:00:00.000Z')
          `
        )
        .run();
      database.client
        .prepare(
          `
            INSERT INTO sales (
              sale_number,
              customer_id,
              sale_date,
              total_cents,
              paid_cents,
              balance_cents,
              status,
              cancellation_reason,
              created_at,
              updated_at
            ) VALUES (1, 1, '2026-07-16T10:00:00.000Z', 120000, 20000, 100000, 'partial_payment', NULL, '2026-07-16T10:00:00.000Z', '2026-07-16T10:00:00.000Z')
          `
        )
        .run();
      database.client
        .prepare(
          `
            INSERT INTO sale_items (
              sale_id,
              reusable_product_id,
              quantity,
              price_type,
              unit_price_cents,
              line_subtotal_cents,
              consignment_status,
              created_at
            ) VALUES (1, 1, 1, 'cash', 120000, 120000, 'pending_settlement', '2026-07-16T10:00:00.000Z')
          `
        )
        .run();
      database.client
        .prepare(
          `
            INSERT INTO sale_item_allocations (
              sale_item_id,
              stock_intake_id,
              consumed_quantity,
              historical_supplier_unit_cost_cents,
              historical_profit_percentage_basis_points,
              historical_cash_price_cents,
              historical_list_price_cents,
              historical_personalization_amount_cents,
              historical_personalization_percentage_basis_points,
              historical_personalization_expected_profit_cents,
              allocation_order,
              created_at
            ) VALUES (1, 1, 1, 100000, 1000, 120000, 125000, NULL, NULL, NULL, 1, '2026-07-16T10:00:00.000Z')
          `
        )
        .run();

      expect(getSchemaVersion(database)).toBe(10);
        expect(countRows(database, 'sales')).toBe(1);

      expect(countRows(database, 'sales')).toBe(1);
      expect(countRows(database, 'customers')).toBe(1);
      expect(countRows(database, 'reusable_products')).toBe(1);

      const snapshotColumns = database.client
        .prepare("PRAGMA table_info('sale_items')")
        .all() as Array<{ name: string }>;
      expect(snapshotColumns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          'product_category_snapshot',
          'product_name_snapshot',
          'product_material_snapshot',
          'product_variant_snapshot'
        ])
      );

      runMigrations(database, [consignmentLiquidationSnapshotsMigration, appBrandingMetadataMigration]);

      expect(getSchemaVersion(database)).toBe(12);

      const metadataRow = database.client
        .prepare("SELECT value FROM app_metadata WHERE key = 'app_id'")
        .get() as { value: string } | undefined;

      expect(metadataRow?.value).toBe('ordena');

      const saleItemFinancialRow = database.client
        .prepare(
          `
            SELECT
              unit_base_price_cents AS unitBasePriceCents,
              unit_personalization_amount_cents AS unitPersonalizationAmountCents,
              line_base_subtotal_cents AS lineBaseSubtotalCents,
              line_personalization_subtotal_cents AS linePersonalizationSubtotalCents,
              product_gain_cents AS productGainCents,
              personalization_gain_cents AS personalizationGainCents,
              total_gain_cents AS totalGainCents
            FROM sale_items
            WHERE id = 1
          `
        )
        .get() as {
          unitBasePriceCents: number | null;
          unitPersonalizationAmountCents: number | null;
          lineBaseSubtotalCents: number | null;
          linePersonalizationSubtotalCents: number | null;
          productGainCents: number | null;
          personalizationGainCents: number | null;
          totalGainCents: number | null;
        };
      expect(saleItemFinancialRow).toEqual(
        expect.objectContaining({
          unitBasePriceCents: null,
          unitPersonalizationAmountCents: null,
          lineBaseSubtotalCents: null,
          linePersonalizationSubtotalCents: null,
          productGainCents: null,
          personalizationGainCents: null,
          totalGainCents: null
        })
      );

      const consignmentColumns = database.client
        .prepare("PRAGMA table_info('consignment_batch_items')")
        .all() as Array<{ name: string }>;
      expect(consignmentColumns.map((column) => column.name)).toEqual(
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
      rmSync(userDataDirectory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50
      });
    }
  });
});

function countRows(database: ReturnType<typeof openSqliteDatabase>, tableName: string): number {
  const row = database.client.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number };

  return row.count;
}
