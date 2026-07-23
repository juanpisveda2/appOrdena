export const consignmentsCoreMigration = {
  version: 4,
  name: 'v004_consignments_core',
  sql: `
    CREATE TABLE IF NOT EXISTS consignment_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number INTEGER NOT NULL UNIQUE,
      liquidation_date TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (batch_number > 0),
      CHECK (total_cents >= 0)
    );

    CREATE INDEX IF NOT EXISTS consignment_batches_liquidation_date_idx
      ON consignment_batches (liquidation_date);

    CREATE TABLE IF NOT EXISTS consignment_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES consignment_batches(id),
      sale_item_id INTEGER NOT NULL UNIQUE REFERENCES sale_items(id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (amount_cents >= 0)
    );

    CREATE INDEX IF NOT EXISTS consignment_batch_items_batch_id_idx
      ON consignment_batch_items (batch_id);
  `
} as const;
