export const catalogStockMigration = {
  version: 2,
  name: 'v002_catalog_stock',
  sql: `
    CREATE TABLE IF NOT EXISTS reusable_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      material TEXT NOT NULL,
      variant TEXT NOT NULL,
      search_text_normalized TEXT NOT NULL,
      duplicate_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS reusable_products_search_text_normalized_idx
      ON reusable_products (search_text_normalized);

    CREATE INDEX IF NOT EXISTS reusable_products_duplicate_key_idx
      ON reusable_products (duplicate_key);

    CREATE TABLE IF NOT EXISTS settings_margin_rules (
      category TEXT NOT NULL,
      material_normalized TEXT NOT NULL,
      material_label TEXT,
      profit_percentage_basis_points INTEGER NOT NULL,
      personalization_percentage_basis_points INTEGER NOT NULL,
      PRIMARY KEY (category, material_normalized)
    );

    INSERT OR IGNORE INTO settings_margin_rules (
      category,
      material_normalized,
      material_label,
      profit_percentage_basis_points,
      personalization_percentage_basis_points
    ) VALUES
      ('jewelry', 'gold', 'Gold', 300, 500),
      ('jewelry', 'silver', 'Silver', 1000, 500),
      ('mate', '', NULL, 1000, 500),
      ('clothing', '', NULL, 1000, 500);

    CREATE TABLE IF NOT EXISTS stock_intakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reusable_product_id INTEGER NOT NULL REFERENCES reusable_products(id),
      entered_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      supplier_unit_cost_cents INTEGER NOT NULL,
      cash_price_cents INTEGER NOT NULL,
      list_price_cents INTEGER NOT NULL,
      profit_percentage_basis_points INTEGER NOT NULL,
      expected_profit_cents INTEGER NOT NULL,
      personalization_amount_cents INTEGER,
      personalization_percentage_basis_points INTEGER,
      personalization_expected_profit_cents INTEGER,
      intake_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (entered_quantity > 0),
      CHECK (available_quantity >= 0),
      CHECK (available_quantity <= entered_quantity),
      CHECK (supplier_unit_cost_cents >= 0),
      CHECK (cash_price_cents >= 0),
      CHECK (list_price_cents >= 0),
      CHECK (profit_percentage_basis_points >= 0),
      CHECK (
        personalization_amount_cents IS NULL
        OR personalization_amount_cents >= 0
      ),
      CHECK (
        personalization_percentage_basis_points IS NULL
        OR personalization_percentage_basis_points >= 0
      ),
      CHECK (
        personalization_expected_profit_cents IS NULL
        OR personalization_expected_profit_cents >= 0
      )
    );

    CREATE INDEX IF NOT EXISTS stock_intakes_reusable_product_id_idx
      ON stock_intakes (reusable_product_id);

    CREATE INDEX IF NOT EXISTS stock_intakes_intake_date_idx
      ON stock_intakes (intake_date);
  `
} as const;
