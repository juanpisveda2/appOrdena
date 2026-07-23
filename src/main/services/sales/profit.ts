import type { SqliteDatabaseLike } from '../../db/connection';
import { calculateExpectedProfitCents } from '../../../shared/catalog/pricing';

interface SaleItemSnapshotFinancialRow {
  saleItemId: number;
  personalizationCents: number | null;
  productGainCents: number | null;
  personalizationGainCents: number | null;
  totalGainCents: number | null;
}

interface HistoricalSaleItemProfitRow {
  saleItemId: number;
  consumedQuantity: number;
  historicalSupplierUnitCostCents: number;
  historicalProfitPercentageBasisPoints: number;
  historicalPersonalizationAmountCents: number | null;
  historicalPersonalizationExpectedProfitCents: number | null;
}

export interface HistoricalSaleItemFinancials {
  personalizationCents: number | null;
  productGainCents: number;
  personalizationGainCents: number;
  totalGainCents: number;
}

export function loadHistoricalSaleItemFinancialsMap(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): Map<number, HistoricalSaleItemFinancials> {
  if (saleItemIds.length === 0) {
    return new Map<number, HistoricalSaleItemFinancials>();
  }

  const snapshotRows = loadSaleItemSnapshotFinancialRows(database, saleItemIds);
  const financialMap = new Map<number, HistoricalSaleItemFinancials>();
  const missingSaleItemIds: number[] = [];

  snapshotRows.forEach((row) => {
    if (row.productGainCents == null || row.personalizationGainCents == null || row.totalGainCents == null) {
      missingSaleItemIds.push(row.saleItemId);
      return;
    }

    financialMap.set(row.saleItemId, {
      personalizationCents: row.personalizationCents,
      productGainCents: row.productGainCents,
      personalizationGainCents: row.personalizationGainCents,
      totalGainCents: row.totalGainCents
    });
  });

  const rows = loadHistoricalSaleItemProfitRows(database, missingSaleItemIds);

  rows.forEach((row) => {
    const productGainCents = row.consumedQuantity * calculateExpectedProfitCents(
      row.historicalSupplierUnitCostCents,
      row.historicalProfitPercentageBasisPoints
    );
    const personalizationGainCents = row.consumedQuantity * (row.historicalPersonalizationExpectedProfitCents ?? 0);
    const current = financialMap.get(row.saleItemId) ?? {
      personalizationCents: null,
      productGainCents: 0,
      personalizationGainCents: 0,
      totalGainCents: 0
    };

    financialMap.set(row.saleItemId, {
      personalizationCents: row.historicalPersonalizationAmountCents == null
        ? current.personalizationCents
        : (current.personalizationCents ?? 0) + row.consumedQuantity * row.historicalPersonalizationAmountCents,
      productGainCents: current.productGainCents + productGainCents,
      personalizationGainCents: current.personalizationGainCents + personalizationGainCents,
      totalGainCents: current.totalGainCents + productGainCents + personalizationGainCents
    });
  });

  return financialMap;
}

export function loadHistoricalSaleItemProfitMap(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): Map<number, number> {
  return new Map(
    Array.from(loadHistoricalSaleItemFinancialsMap(database, saleItemIds).entries()).map(([saleItemId, financials]) => [
      saleItemId,
      financials.totalGainCents
    ])
  );
}

export function sumHistoricalSaleItemProfits(profitMap: Map<number, number>, saleItemIds: number[]): number {
  return saleItemIds.reduce((sum, saleItemId) => sum + (profitMap.get(saleItemId) ?? 0), 0);
}

function loadHistoricalSaleItemProfitRows(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): HistoricalSaleItemProfitRow[] {
  if (saleItemIds.length === 0) {
    return [];
  }

  const placeholders = saleItemIds.map(() => '?').join(', ');

  return database.client
    .prepare(
      `
        SELECT
          sale_item_id AS saleItemId,
          consumed_quantity AS consumedQuantity,
          historical_supplier_unit_cost_cents AS historicalSupplierUnitCostCents,
          historical_profit_percentage_basis_points AS historicalProfitPercentageBasisPoints,
          historical_personalization_amount_cents AS historicalPersonalizationAmountCents,
          historical_personalization_expected_profit_cents AS historicalPersonalizationExpectedProfitCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (${placeholders})
        ORDER BY sale_item_id ASC, allocation_order ASC, id ASC
      `
    )
    .all(...saleItemIds) as HistoricalSaleItemProfitRow[];
}

function loadSaleItemSnapshotFinancialRows(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): SaleItemSnapshotFinancialRow[] {
  const placeholders = saleItemIds.map(() => '?').join(', ');

  return database.client
    .prepare(
      `
        SELECT
          id AS saleItemId,
          unit_personalization_amount_cents * quantity AS personalizationCents,
          product_gain_cents AS productGainCents,
          personalization_gain_cents AS personalizationGainCents,
          total_gain_cents AS totalGainCents
        FROM sale_items
        WHERE id IN (${placeholders})
      `
    )
    .all(...saleItemIds) as SaleItemSnapshotFinancialRow[];
}
