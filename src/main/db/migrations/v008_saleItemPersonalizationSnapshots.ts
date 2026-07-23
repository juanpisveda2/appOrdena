export const saleItemPersonalizationSnapshotsMigration = {
  version: 8,
  name: 'v008_sale_item_personalization_snapshots',
  sql: `
    ALTER TABLE sale_items ADD COLUMN unit_base_price_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN unit_personalization_amount_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN personalization_percentage_basis_points INTEGER;
    ALTER TABLE sale_items ADD COLUMN line_base_subtotal_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN line_personalization_subtotal_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN product_gain_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN personalization_gain_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN total_gain_cents INTEGER;

    UPDATE sale_items
    SET unit_base_price_cents = COALESCE(unit_base_price_cents, unit_price_cents),
        line_base_subtotal_cents = COALESCE(line_base_subtotal_cents, line_subtotal_cents),
        line_personalization_subtotal_cents = COALESCE(line_personalization_subtotal_cents, 0),
        product_gain_cents = COALESCE(product_gain_cents, (
          SELECT COALESCE(SUM(
            sale_item_allocations.consumed_quantity * CAST(ROUND(
              sale_item_allocations.historical_supplier_unit_cost_cents
              * sale_item_allocations.historical_profit_percentage_basis_points
              / 10000.0
            ) AS INTEGER)
          ), 0)
          FROM sale_item_allocations
          WHERE sale_item_allocations.sale_item_id = sale_items.id
        )),
        personalization_gain_cents = COALESCE(personalization_gain_cents, (
          SELECT COALESCE(SUM(
            sale_item_allocations.consumed_quantity
            * COALESCE(sale_item_allocations.historical_personalization_expected_profit_cents, 0)
          ), 0)
          FROM sale_item_allocations
          WHERE sale_item_allocations.sale_item_id = sale_items.id
        )),
        total_gain_cents = COALESCE(total_gain_cents,
          COALESCE(product_gain_cents, (
            SELECT COALESCE(SUM(
              sale_item_allocations.consumed_quantity * CAST(ROUND(
                sale_item_allocations.historical_supplier_unit_cost_cents
                * sale_item_allocations.historical_profit_percentage_basis_points
                / 10000.0
              ) AS INTEGER)
            ), 0)
            FROM sale_item_allocations
            WHERE sale_item_allocations.sale_item_id = sale_items.id
          ))
          +
          COALESCE(personalization_gain_cents, (
            SELECT COALESCE(SUM(
              sale_item_allocations.consumed_quantity
              * COALESCE(sale_item_allocations.historical_personalization_expected_profit_cents, 0)
            ), 0)
            FROM sale_item_allocations
            WHERE sale_item_allocations.sale_item_id = sale_items.id
          ))
        );

    CREATE INDEX IF NOT EXISTS sale_items_total_gain_cents_idx
      ON sale_items (total_gain_cents);
  `
} as const;
