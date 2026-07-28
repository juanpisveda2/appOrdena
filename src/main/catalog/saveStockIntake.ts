import type { SaveStockIntakeRequest, SaveStockIntakeResult } from '../../shared/contracts/catalog';
import { calculatePricingSummary } from '../../shared/catalog/pricing';
import { saveStockIntakeRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import {
  assertReusableProductExists,
  createReusableProductRecord,
  findDuplicateReusableProducts
} from './repository';

export function saveStockIntake(
  database: SqliteDatabaseLike,
  request: SaveStockIntakeRequest
): SaveStockIntakeResult {
  const payload = saveStockIntakeRequestSchema.parse(request);

  if (payload.newReusableProduct && !payload.allowDuplicate) {
    const duplicates = findDuplicateReusableProducts(database, payload.newReusableProduct);

    if (duplicates.length > 0) {
      return {
        kind: 'duplicate-warning',
        matches: duplicates
      };
    }
  }

  const resolvedProduct = payload.reusableProductId
    ? assertReusableProductExists(database, payload.reusableProductId)
    : null;
  const newReusableProduct = payload.newReusableProduct;

  const pricingSummary = calculatePricingSummary({
    cashPriceCents: payload.cashPriceCents,
    listPriceCents: payload.listPriceCents,
    profitPercentageBasisPoints: payload.profitPercentageBasisPoints
  });

  const transaction = database.client.transaction(() => {
    const reusableProductId =
      resolvedProduct?.id ??
      createReusableProductRecord(
        database,
        newReusableProduct ?? (() => {
          throw new Error('A new reusable product payload is required when reusableProductId is missing.');
        })()
      );
    const notes = payload.notes?.trim() || null;
    const statement = database.client.prepare(
      `
        INSERT INTO stock_intakes (
          reusable_product_id,
          entered_quantity,
          available_quantity,
          supplier_unit_cost_cents,
          cash_price_cents,
          list_price_cents,
          profit_percentage_basis_points,
          expected_profit_cents,
          expected_list_profit_cents,
          personalization_amount_cents,
          personalization_percentage_basis_points,
          personalization_expected_profit_cents,
          intake_date,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const result = statement.run(
      reusableProductId,
      payload.enteredQuantity,
      payload.availableQuantity,
      payload.supplierUnitCostCents,
      payload.cashPriceCents,
      payload.listPriceCents,
      payload.profitPercentageBasisPoints,
      pricingSummary.cashExpectedProfitCents,
      pricingSummary.listExpectedProfitCents,
      null,
      null,
      null,
      payload.intakeDate,
      notes
    );

    return {
      kind: 'saved' as const,
      stockIntakeId: Number(result.lastInsertRowid),
      reusableProductId
    };
  });

  return transaction();
}
