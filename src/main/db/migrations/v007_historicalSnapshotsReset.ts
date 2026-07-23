export const historicalSnapshotsResetMigration = {
  version: 7,
  name: 'v007_historical_snapshots_reset',
  sql: `
    ALTER TABLE sales ADD COLUMN customer_name_snapshot TEXT;
    ALTER TABLE sales ADD COLUMN customer_phone_snapshot TEXT;
    ALTER TABLE sales ADD COLUMN customer_note_snapshot TEXT;

    UPDATE sales
    SET customer_name_snapshot = COALESCE(customer_name_snapshot, (
          SELECT customers.name FROM customers WHERE customers.id = sales.customer_id
        )),
        customer_phone_snapshot = COALESCE(customer_phone_snapshot, (
          SELECT customers.phone_text FROM customers WHERE customers.id = sales.customer_id
        )),
        customer_note_snapshot = COALESCE(customer_note_snapshot, (
          SELECT customers.note FROM customers WHERE customers.id = sales.customer_id
        ));

    CREATE INDEX IF NOT EXISTS sales_customer_name_snapshot_idx
      ON sales (customer_name_snapshot);

    ALTER TABLE sale_items ADD COLUMN product_category_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_name_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_material_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_variant_snapshot TEXT;

    UPDATE sale_items
    SET product_category_snapshot = COALESCE(product_category_snapshot, (
          SELECT reusable_products.category FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_name_snapshot = COALESCE(product_name_snapshot, (
          SELECT reusable_products.name FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_material_snapshot = COALESCE(product_material_snapshot, (
          SELECT reusable_products.material FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_variant_snapshot = COALESCE(product_variant_snapshot, (
          SELECT reusable_products.variant FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        ));

    CREATE INDEX IF NOT EXISTS sale_items_product_name_snapshot_idx
      ON sale_items (product_name_snapshot);

    CREATE INDEX IF NOT EXISTS consignment_batches_batch_number_idx
      ON consignment_batches (batch_number);

    CREATE INDEX IF NOT EXISTS consignment_batch_items_sale_item_id_idx
      ON consignment_batch_items (sale_item_id);
  `
} as const;
