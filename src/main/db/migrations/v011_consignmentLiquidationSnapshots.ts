export const consignmentLiquidationSnapshotsMigration = {
  version: 11,
  name: 'v011_consignment_liquidation_snapshots',
  sql: `
    ALTER TABLE consignment_batches
      ADD COLUMN remaining_cents INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE consignment_batch_items
      ADD COLUMN product_gain_cents INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE consignment_batch_items
      ADD COLUMN personalization_gain_cents INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE consignment_batch_items
      ADD COLUMN gain_cents INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE consignment_batch_items
      ADD COLUMN snapshot_sale_status TEXT;

    ALTER TABLE consignment_batch_items
      ADD COLUMN snapshot_sale_paid_cents INTEGER;

    ALTER TABLE consignment_batch_items
      ADD COLUMN snapshot_sale_balance_cents INTEGER;

    ALTER TABLE consignment_batch_items
      ADD COLUMN snapshot_buyer_name TEXT;

    ALTER TABLE consignment_batch_items
      ADD COLUMN snapshot_payment_method_summary TEXT;

    WITH historical_amounts AS (
      SELECT
        sale_item_id AS sale_item_id,
        SUM(consumed_quantity * historical_supplier_unit_cost_cents) AS historical_supplier_amount_cents
      FROM sale_item_allocations
      GROUP BY sale_item_id
    ), item_progress AS (
      SELECT
        cbi.id AS batch_item_id,
        cbi.batch_id AS batch_id,
        cbi.sale_item_id AS sale_item_id,
        cbi.amount_cents AS amount_cents,
        COALESCE(historical_amounts.historical_supplier_amount_cents, 0) AS historical_supplier_amount_cents,
        COALESCE(si.product_gain_cents, 0) AS historical_product_gain_cents,
        COALESCE(si.personalization_gain_cents, 0) AS historical_personalization_gain_cents,
        SUM(cbi.amount_cents) OVER (
          PARTITION BY cbi.sale_item_id
          ORDER BY cbi.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_amount_cents
      FROM consignment_batch_items cbi
      LEFT JOIN historical_amounts ON historical_amounts.sale_item_id = cbi.sale_item_id
      LEFT JOIN sale_items si ON si.id = cbi.sale_item_id
    ), gain_backfill AS (
      SELECT
        item_progress.batch_item_id AS batch_item_id,
        CASE
          WHEN item_progress.historical_supplier_amount_cents <= 0 THEN 0
          ELSE CAST(
            (
              item_progress.historical_product_gain_cents
              * MIN(item_progress.cumulative_amount_cents, item_progress.historical_supplier_amount_cents)
            ) / item_progress.historical_supplier_amount_cents AS INTEGER
          ) - CAST(
            (
              item_progress.historical_product_gain_cents
              * MIN(
                MAX(item_progress.cumulative_amount_cents - item_progress.amount_cents, 0),
                item_progress.historical_supplier_amount_cents
              )
            ) / item_progress.historical_supplier_amount_cents AS INTEGER
          )
        END AS product_gain_cents,
        CASE
          WHEN item_progress.historical_supplier_amount_cents <= 0 THEN 0
          ELSE CAST(
            (
              item_progress.historical_personalization_gain_cents
              * MIN(item_progress.cumulative_amount_cents, item_progress.historical_supplier_amount_cents)
            ) / item_progress.historical_supplier_amount_cents AS INTEGER
          ) - CAST(
            (
              item_progress.historical_personalization_gain_cents
              * MIN(
                MAX(item_progress.cumulative_amount_cents - item_progress.amount_cents, 0),
                item_progress.historical_supplier_amount_cents
              )
            ) / item_progress.historical_supplier_amount_cents AS INTEGER
          )
        END AS personalization_gain_cents,
        MAX(item_progress.historical_supplier_amount_cents - item_progress.cumulative_amount_cents, 0) AS remaining_after_batch_cents
      FROM item_progress
    )
    UPDATE consignment_batch_items
    SET product_gain_cents = COALESCE((
          SELECT gain_backfill.product_gain_cents
          FROM gain_backfill
          WHERE gain_backfill.batch_item_id = consignment_batch_items.id
        ), 0),
        personalization_gain_cents = COALESCE((
          SELECT gain_backfill.personalization_gain_cents
          FROM gain_backfill
          WHERE gain_backfill.batch_item_id = consignment_batch_items.id
        ), 0),
        gain_cents = COALESCE((
          SELECT gain_backfill.product_gain_cents + gain_backfill.personalization_gain_cents
          FROM gain_backfill
          WHERE gain_backfill.batch_item_id = consignment_batch_items.id
        ), 0),
        snapshot_sale_status = (
          SELECT sales.status
          FROM sale_items
          INNER JOIN sales ON sales.id = sale_items.sale_id
          WHERE sale_items.id = consignment_batch_items.sale_item_id
        ),
        snapshot_sale_paid_cents = (
          SELECT sales.paid_cents
          FROM sale_items
          INNER JOIN sales ON sales.id = sale_items.sale_id
          WHERE sale_items.id = consignment_batch_items.sale_item_id
        ),
        snapshot_sale_balance_cents = (
          SELECT sales.balance_cents
          FROM sale_items
          INNER JOIN sales ON sales.id = sale_items.sale_id
          WHERE sale_items.id = consignment_batch_items.sale_item_id
        ),
        snapshot_buyer_name = (
          SELECT sales.customer_name_snapshot
          FROM sale_items
          INNER JOIN sales ON sales.id = sale_items.sale_id
          WHERE sale_items.id = consignment_batch_items.sale_item_id
        );

    WITH historical_amounts AS (
      SELECT
        sale_item_id AS sale_item_id,
        SUM(consumed_quantity * historical_supplier_unit_cost_cents) AS historical_supplier_amount_cents
      FROM sale_item_allocations
      GROUP BY sale_item_id
    ), item_progress AS (
      SELECT
        cbi.id AS batch_item_id,
        cbi.batch_id AS batch_id,
        MAX(
          COALESCE(historical_amounts.historical_supplier_amount_cents, 0)
          - SUM(cbi.amount_cents) OVER (
            PARTITION BY cbi.sale_item_id
            ORDER BY cbi.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ),
          0
        ) AS remaining_after_batch_cents
      FROM consignment_batch_items cbi
      LEFT JOIN historical_amounts ON historical_amounts.sale_item_id = cbi.sale_item_id
    ), batch_totals AS (
      SELECT
        item_progress.batch_id AS batch_id,
        SUM(item_progress.remaining_after_batch_cents) AS remaining_cents,
        COALESCE((
          SELECT SUM(consignment_batch_items.gain_cents)
          FROM consignment_batch_items
          WHERE consignment_batch_items.batch_id = item_progress.batch_id
        ), 0) AS total_gain_cents
      FROM item_progress
      GROUP BY item_progress.batch_id
    )
    UPDATE consignment_batches
    SET remaining_cents = COALESCE((
          SELECT batch_totals.remaining_cents
          FROM batch_totals
          WHERE batch_totals.batch_id = consignment_batches.id
        ), 0),
        total_gain_cents = COALESCE((
          SELECT batch_totals.total_gain_cents
          FROM batch_totals
          WHERE batch_totals.batch_id = consignment_batches.id
        ), 0);
  `
} as const;
