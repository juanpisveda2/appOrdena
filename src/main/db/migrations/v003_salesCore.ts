export const salesCoreMigration = {
  version: 3,
  name: 'v003_sales_core',
  sql: `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_text TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (length(trim(name)) > 0),
      CHECK (length(trim(phone_text)) > 0)
    );

    CREATE INDEX IF NOT EXISTS customers_phone_text_idx
      ON customers (phone_text);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_number INTEGER NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      sale_date TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      paid_cents INTEGER NOT NULL,
      balance_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (total_cents >= 0),
      CHECK (paid_cents >= 0),
      CHECK (balance_cents >= 0),
      CHECK (balance_cents = total_cents - paid_cents),
      CHECK (
        status IN ('pending_payment', 'partial_payment', 'paid', 'cancelled')
      ),
      CHECK (
        cancellation_reason IS NULL OR status = 'cancelled'
      ),
      CHECK (
        customer_id IS NOT NULL OR (balance_cents = 0 AND status IN ('paid', 'cancelled'))
      )
    );

    CREATE INDEX IF NOT EXISTS sales_sale_number_idx
      ON sales (sale_number);

    CREATE INDEX IF NOT EXISTS sales_customer_id_idx
      ON sales (customer_id);

    CREATE INDEX IF NOT EXISTS sales_status_idx
      ON sales (status);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      reusable_product_id INTEGER NOT NULL REFERENCES reusable_products(id),
      quantity INTEGER NOT NULL,
      price_type TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      line_subtotal_cents INTEGER NOT NULL,
      consignment_status TEXT NOT NULL DEFAULT 'pending_settlement',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (quantity > 0),
      CHECK (price_type IN ('cash', 'list')),
      CHECK (unit_price_cents >= 0),
      CHECK (line_subtotal_cents >= 0),
      CHECK (consignment_status IN ('pending_settlement', 'settled'))
    );

    CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx
      ON sale_items (sale_id);

    CREATE INDEX IF NOT EXISTS sale_items_reusable_product_id_idx
      ON sale_items (reusable_product_id);

    CREATE INDEX IF NOT EXISTS sale_items_consignment_status_idx
      ON sale_items (consignment_status);

    CREATE TABLE IF NOT EXISTS sale_item_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
      stock_intake_id INTEGER NOT NULL REFERENCES stock_intakes(id),
      consumed_quantity INTEGER NOT NULL,
      historical_supplier_unit_cost_cents INTEGER NOT NULL,
      historical_profit_percentage_basis_points INTEGER NOT NULL,
      historical_cash_price_cents INTEGER NOT NULL,
      historical_list_price_cents INTEGER NOT NULL,
      historical_personalization_amount_cents INTEGER,
      historical_personalization_percentage_basis_points INTEGER,
      historical_personalization_expected_profit_cents INTEGER,
      allocation_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (consumed_quantity > 0),
      CHECK (historical_supplier_unit_cost_cents >= 0),
      CHECK (historical_profit_percentage_basis_points >= 0),
      CHECK (historical_cash_price_cents >= 0),
      CHECK (historical_list_price_cents >= 0),
      CHECK (
        historical_personalization_amount_cents IS NULL
        OR historical_personalization_amount_cents >= 0
      ),
      CHECK (
        historical_personalization_percentage_basis_points IS NULL
        OR historical_personalization_percentage_basis_points >= 0
      ),
      CHECK (
        historical_personalization_expected_profit_cents IS NULL
        OR historical_personalization_expected_profit_cents >= 0
      ),
      CHECK (allocation_order > 0)
    );

    CREATE INDEX IF NOT EXISTS sale_item_allocations_sale_item_id_idx
      ON sale_item_allocations (sale_item_id);

    CREATE INDEX IF NOT EXISTS sale_item_allocations_stock_intake_id_idx
      ON sale_item_allocations (stock_intake_id);

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      payment_date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payment_method TEXT,
      note TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (amount_cents > 0),
      CHECK (
        payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer')
      ),
      CHECK (
        cancelled_at IS NULL OR length(trim(cancellation_reason)) > 0
      )
    );

    CREATE INDEX IF NOT EXISTS payments_sale_id_idx
      ON payments (sale_id);

    CREATE INDEX IF NOT EXISTS payments_cancelled_at_idx
      ON payments (cancelled_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail_json TEXT
    );

    CREATE INDEX IF NOT EXISTS audit_logs_operation_type_idx
      ON audit_logs (operation_type);

    CREATE INDEX IF NOT EXISTS audit_logs_entity_type_entity_id_idx
      ON audit_logs (entity_type, entity_id);
  `
} as const;
