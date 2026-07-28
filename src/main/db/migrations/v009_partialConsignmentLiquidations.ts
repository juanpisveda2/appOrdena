export const partialConsignmentLiquidationsMigration = {
  version: 9,
  name: 'v009_partial_consignment_liquidations',
  sql: `
    PRAGMA foreign_keys = OFF;

    ALTER TABLE consignment_batch_items RENAME TO consignment_batch_items_legacy;

    DROP INDEX IF EXISTS consignment_batch_items_batch_id_idx;
    DROP INDEX IF EXISTS consignment_batch_items_sale_item_id_idx;

    CREATE TABLE consignment_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES consignment_batches(id),
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (amount_cents >= 0)
    );

    CREATE INDEX consignment_batch_items_batch_id_idx
      ON consignment_batch_items (batch_id);

    CREATE INDEX consignment_batch_items_sale_item_id_idx
      ON consignment_batch_items (sale_item_id);

    INSERT INTO consignment_batch_items (id, batch_id, sale_item_id, amount_cents, created_at)
      SELECT id, batch_id, sale_item_id, amount_cents, created_at
      FROM consignment_batch_items_legacy;

    DROP TABLE consignment_batch_items_legacy;

    PRAGMA foreign_keys = ON;
  `
} as const;
