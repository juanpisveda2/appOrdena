import type {
  ConfirmConsignmentBatchRequest,
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ConsignmentBatchDetailItem,
  ConsignmentBatchHistoryListItem,
  GetConsignmentBatchDetailRequest,
  ListConsignmentBatchHistoryRequest,
  ListPendingConsignmentItemsRequest,
  PendingConsignmentItem
} from '../../../shared/contracts/consignments';
import {
  confirmConsignmentBatchRequestSchema,
  getConsignmentBatchDetailRequestSchema,
  listConsignmentBatchHistoryRequestSchema,
  listPendingConsignmentItemsRequestSchema
} from '../../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../../db/connection';
import {
  loadHistoricalSaleItemFinancialsMap,
  loadHistoricalSaleItemProfitMap,
  sumHistoricalSaleItemProfits
} from '../sales/profit';

const STATUS_CANCELLED = 'cancelled';
const STATUS_PENDING_SETTLEMENT = 'pending_settlement';
const STATUS_SETTLED = 'settled';

export type ConsignmentServiceErrorCode =
  | 'EMPTY_SELECTION'
  | 'DUPLICATE_ITEM_IDS'
  | 'SALE_ITEMS_NOT_FOUND'
  | 'CANCELLED_SALE_ITEM'
  | 'SALE_ITEM_NOT_PENDING_SETTLEMENT'
  | 'SALE_ITEM_ALREADY_ASSOCIATED'
  | 'SALE_ITEM_WITHOUT_HISTORICAL_COST'
  | 'BATCH_NOT_FOUND';

export class ConsignmentServiceError extends Error {
  constructor(
    public readonly code: ConsignmentServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ConsignmentServiceError';
  }
}

interface PendingRow {
  saleItemId: number;
  productName: string;
  saleNumber: number;
  saleDate: string;
  buyerName: string | null;
  amountCents: number;
  gainCents: number;
}

interface SaleItemValidationRow {
  saleItemId: number;
  saleNumber: number;
  saleStatus: string;
  consignmentStatus: string;
}

interface HistoricalAmountRow {
  saleItemId: number;
  amountCents: number;
}

interface BatchHistoryRow extends ConsignmentBatchHistoryListItem {}

interface BatchDetailHeaderRow {
  batchId: number;
  batchNumber: number;
  liquidationDate: string;
  totalCents: number;
  totalGainCents: number;
  notes: string | null;
  createdAt: string;
  itemCount: number;
}

interface BatchDetailItemRow extends ConsignmentBatchDetailItem {
  saleItemId: number;
}

interface BatchSaleItemRow {
  saleItemId: number;
}

export function listPendingConsignmentItems(
  database: SqliteDatabaseLike,
  request: ListPendingConsignmentItemsRequest = {}
): PendingConsignmentItem[] {
  const payload = listPendingConsignmentItemsRequestSchema.parse(request);
  const limit = payload.limit ?? 200;

  const rows = database.client
    .prepare(
      `
        SELECT
          si.id AS saleItemId,
          si.product_name_snapshot AS productName,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.customer_name_snapshot AS buyerName,
          COALESCE(SUM(sia.consumed_quantity * sia.historical_supplier_unit_cost_cents), 0) AS amountCents,
          0 AS gainCents
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        INNER JOIN sale_item_allocations sia ON sia.sale_item_id = si.id
        LEFT JOIN consignment_batch_items cbi ON cbi.sale_item_id = si.id
        WHERE s.status <> ?
          AND si.consignment_status = ?
          AND cbi.id IS NULL
        GROUP BY si.id, si.product_name_snapshot, s.sale_number, s.sale_date, s.customer_name_snapshot
        ORDER BY s.sale_date DESC, s.sale_number DESC, si.id DESC
        LIMIT ?
      `
    )
    .all(STATUS_CANCELLED, STATUS_PENDING_SETTLEMENT, limit) as PendingRow[];

  const profitMap = loadHistoricalSaleItemProfitMap(
    database,
    rows.map((row) => row.saleItemId)
  );

  return rows.map((row) => ({
    ...row,
    gainCents: sumHistoricalSaleItemProfits(profitMap, [row.saleItemId])
  }));
}

export function confirmConsignmentBatch(
  database: SqliteDatabaseLike,
  request: ConfirmConsignmentBatchRequest
): ConfirmConsignmentBatchResult {
  const payload = confirmConsignmentBatchRequestSchema.parse(request);
  const normalizedIds = normalizeSaleItemIds(payload.saleItemIds);
  const notes = normalizeOptionalNote(payload.notes);
  const liquidationDate = payload.liquidationDate;
  const createdAt = new Date().toISOString();

  const transaction = database.client.transaction(() => {
    const saleItems = loadSaleItemsForSettlement(database, normalizedIds);
    const historicalAmounts = loadHistoricalAmounts(database, normalizedIds);
    const totalCents = normalizedIds.reduce((sum, saleItemId) => {
      const amount = historicalAmounts.get(saleItemId);

      if (amount == null) {
        throw new ConsignmentServiceError(
          'SALE_ITEM_WITHOUT_HISTORICAL_COST',
          `Sale item ${saleItemId} does not have historical cost allocations.`
        );
      }

      return sum + amount.amountCents;
    }, 0);
    const totalGainCents = sumHistoricalSaleItemProfits(
      loadHistoricalSaleItemProfitMap(database, normalizedIds),
      normalizedIds
    );

    const batchNumber = nextBatchNumber(database);
    const batchInsert = database.client
      .prepare(
        `
          INSERT INTO consignment_batches (
            batch_number,
            liquidation_date,
            total_cents,
            total_gain_cents,
            notes,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(batchNumber, liquidationDate, totalCents, totalGainCents, notes, createdAt);
    const batchId = Number(batchInsert.lastInsertRowid);
    const batchItemInsert = database.client.prepare(
      `
        INSERT INTO consignment_batch_items (
          batch_id,
          sale_item_id,
          amount_cents,
          created_at
        ) VALUES (?, ?, ?, ?)
      `
    );

    normalizedIds.forEach((saleItemId) => {
      batchItemInsert.run(batchId, saleItemId, historicalAmounts.get(saleItemId)?.amountCents, createdAt);
    });

    database.client
      .prepare(
        `
          UPDATE sale_items
          SET consignment_status = ?
          WHERE id IN (${createPlaceholders(normalizedIds.length)})
        `
      )
      .run(STATUS_SETTLED, ...normalizedIds);

    insertAuditLog(database, {
      occurredAt: createdAt,
      operationType: 'consignment_batch_confirmed',
      entityType: 'consignment_batch',
      entityId: String(batchId),
      summary: `Confirmed consignment batch #${batchNumber}.`,
      detailJson: JSON.stringify({
        batchId,
        batchNumber,
        liquidationDate,
        saleItemIds: normalizedIds,
        quantity: saleItems.length,
        totalCents,
        totalGainCents,
        note: notes,
        createdAt
      })
    });

    return {
      batchId,
      batchNumber,
      liquidationDate,
      itemCount: saleItems.length,
      totalCents,
      totalGainCents,
      notes,
      createdAt
    };
  });

  return transaction();
}

export function listConsignmentBatchHistory(
  database: SqliteDatabaseLike,
  request: ListConsignmentBatchHistoryRequest = {}
): ConsignmentBatchHistoryListItem[] {
  const payload = listConsignmentBatchHistoryRequestSchema.parse(request);
  const limit = payload.limit ?? 100;

  const rows = database.client
    .prepare(
      `
        SELECT
          cb.id AS batchId,
          cb.batch_number AS batchNumber,
          cb.liquidation_date AS liquidationDate,
          cb.total_cents AS totalCents,
          cb.total_gain_cents AS totalGainCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.notes, cb.created_at
        ORDER BY cb.liquidation_date DESC, cb.batch_number DESC, cb.id DESC
        LIMIT ?
      `
    )
    .all(limit) as BatchHistoryRow[];

  return rows;
}

export function getConsignmentBatchDetail(
  database: SqliteDatabaseLike,
  request: GetConsignmentBatchDetailRequest
): ConsignmentBatchDetail {
  const payload = getConsignmentBatchDetailRequestSchema.parse(request);
  const header = database.client
    .prepare(
      `
        SELECT
          cb.id AS batchId,
          cb.batch_number AS batchNumber,
          cb.liquidation_date AS liquidationDate,
          cb.total_cents AS totalCents,
          cb.total_gain_cents AS totalGainCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        WHERE cb.id = ?
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.notes, cb.created_at
        LIMIT 1
      `
    )
    .get(payload.batchId) as BatchDetailHeaderRow | undefined;

  if (!header) {
    throw new ConsignmentServiceError('BATCH_NOT_FOUND', `Consignment batch ${payload.batchId} was not found.`);
  }

  const items = database.client
    .prepare(
      `
        SELECT
          si.id AS saleItemId,
          si.product_name_snapshot AS productName,
          si.product_category_snapshot AS category,
          si.product_material_snapshot AS material,
          si.product_variant_snapshot AS variant,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.customer_name_snapshot AS buyerName,
          si.unit_price_cents AS unitPriceCents,
          si.line_subtotal_cents AS saleTotalCents,
          cbi.amount_cents AS amountCents,
          0 AS personalizationCents,
          0 AS productGainCents,
          0 AS personalizationGainCents,
          0 AS gainCents,
          cb.liquidation_date AS liquidationDate
        FROM consignment_batch_items cbi
        INNER JOIN consignment_batches cb ON cb.id = cbi.batch_id
        INNER JOIN sale_items si ON si.id = cbi.sale_item_id
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE cbi.batch_id = ?
        ORDER BY s.sale_date DESC, s.sale_number DESC, cbi.id ASC
      `
    )
    .all(payload.batchId) as BatchDetailItemRow[];

  const saleItemIds = getBatchSaleItemIds(database, payload.batchId);
  const financialsMap = loadHistoricalSaleItemFinancialsMap(database, saleItemIds);

  return {
    ...header,
    items: items.map(({ saleItemId, ...item }) => ({
      ...item,
      personalizationCents: financialsMap.get(saleItemId)?.personalizationCents ?? null,
      productGainCents: financialsMap.get(saleItemId)?.productGainCents ?? 0,
      personalizationGainCents: financialsMap.get(saleItemId)?.personalizationGainCents ?? 0,
      gainCents: financialsMap.get(saleItemId)?.totalGainCents ?? 0
    }))
  };
}

function normalizeSaleItemIds(saleItemIds: number[]): number[] {
  if (saleItemIds.length === 0) {
    throw new ConsignmentServiceError('EMPTY_SELECTION', 'At least one sale item is required.');
  }

  const uniqueIds = new Set<number>();

  for (const saleItemId of saleItemIds) {
    if (uniqueIds.has(saleItemId)) {
      throw new ConsignmentServiceError('DUPLICATE_ITEM_IDS', 'Duplicate sale item ids are not allowed.');
    }

    uniqueIds.add(saleItemId);
  }

  return Array.from(uniqueIds);
}

function loadSaleItemsForSettlement(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): SaleItemValidationRow[] {
  const rows = database.client
    .prepare(
      `
        SELECT
          si.id AS saleItemId,
          s.sale_number AS saleNumber,
          s.status AS saleStatus,
          si.consignment_status AS consignmentStatus
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE si.id IN (${createPlaceholders(saleItemIds.length)})
      `
    )
    .all(...saleItemIds) as SaleItemValidationRow[];

  if (rows.length !== saleItemIds.length) {
    throw new ConsignmentServiceError(
      'SALE_ITEMS_NOT_FOUND',
      'One or more selected sale items were not found.'
    );
  }

  const associatedRows = database.client
    .prepare(
      `
        SELECT sale_item_id AS saleItemId
        FROM consignment_batch_items
        WHERE sale_item_id IN (${createPlaceholders(saleItemIds.length)})
      `
    )
    .all(...saleItemIds) as Array<{ saleItemId: number }>;

  if (associatedRows.length > 0) {
    throw new ConsignmentServiceError(
      'SALE_ITEM_ALREADY_ASSOCIATED',
      `Sale item ${associatedRows[0]?.saleItemId} is already associated with a consignment batch.`
    );
  }

  rows.forEach((row) => {
    if (row.saleStatus === STATUS_CANCELLED) {
      throw new ConsignmentServiceError(
        'CANCELLED_SALE_ITEM',
        `Sale item ${row.saleItemId} belongs to a cancelled sale.`
      );
    }

    if (row.consignmentStatus !== STATUS_PENDING_SETTLEMENT) {
      throw new ConsignmentServiceError(
        'SALE_ITEM_NOT_PENDING_SETTLEMENT',
        `Sale item ${row.saleItemId} is not pending settlement.`
      );
    }
  });

  return rows;
}

function loadHistoricalAmounts(
  database: SqliteDatabaseLike,
  saleItemIds: number[]
): Map<number, { amountCents: number }> {
  const rows = database.client
    .prepare(
      `
        SELECT
          sale_item_id AS saleItemId,
          SUM(consumed_quantity * historical_supplier_unit_cost_cents) AS amountCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (${createPlaceholders(saleItemIds.length)})
        GROUP BY sale_item_id
      `
    )
    .all(...saleItemIds) as HistoricalAmountRow[];

  return new Map(rows.map((row) => [row.saleItemId, { amountCents: row.amountCents }]));
}

function getBatchSaleItemIds(database: SqliteDatabaseLike, batchId: number): number[] {
  return (database.client
    .prepare(
      `
        SELECT sale_item_id AS saleItemId
        FROM consignment_batch_items
        WHERE batch_id = ?
        ORDER BY id ASC
      `
    )
    .all(batchId) as BatchSaleItemRow[]).map((row) => row.saleItemId);
}

function nextBatchNumber(database: SqliteDatabaseLike): number {
  const row = database.client
    .prepare('SELECT COALESCE(MAX(batch_number), 0) + 1 AS nextBatchNumber FROM consignment_batches')
    .get() as { nextBatchNumber: number };

  return row.nextBatchNumber;
}

function createPlaceholders(length: number): string {
  return Array.from({ length }, () => '?').join(', ');
}

function normalizeOptionalNote(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}

function insertAuditLog(
  database: SqliteDatabaseLike,
  input: {
    occurredAt: string;
    operationType: string;
    entityType: string;
    entityId: string;
    summary: string;
    detailJson: string | null;
  }
): void {
  database.client
    .prepare(
      `
        INSERT INTO audit_logs (
          occurred_at,
          operation_type,
          entity_type,
          entity_id,
          summary,
          detail_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.occurredAt,
      input.operationType,
      input.entityType,
      input.entityId,
      input.summary,
      input.detailJson
    );
}
