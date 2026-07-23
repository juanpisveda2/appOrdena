export const consignmentBatchGainMigration = {
  version: 6,
  name: 'v006_consignment_batch_gain',
  sql: `
    ALTER TABLE consignment_batches
      ADD COLUMN total_gain_cents INTEGER NOT NULL DEFAULT 0;

    UPDATE consignment_batches
    SET total_gain_cents = COALESCE((
      SELECT SUM(
        sia.consumed_quantity * (
          ROUND(
            (
              sia.historical_supplier_unit_cost_cents
              * sia.historical_profit_percentage_basis_points
            ) / 10000.0
          )
          + COALESCE(sia.historical_personalization_expected_profit_cents, 0)
        )
      )
      FROM consignment_batch_items cbi
      INNER JOIN sale_item_allocations sia ON sia.sale_item_id = cbi.sale_item_id
      WHERE cbi.batch_id = consignment_batches.id
    ), 0);
  `
} as const;
