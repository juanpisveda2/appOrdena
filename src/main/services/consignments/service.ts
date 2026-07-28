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
import type { SaleStatus } from '../../../shared/contracts/sales';
import {
  confirmConsignmentBatchRequestSchema,
  getConsignmentBatchDetailRequestSchema,
  listConsignmentBatchHistoryRequestSchema,
  listPendingConsignmentItemsRequestSchema
} from '../../../shared/validation/consignments';
import {
  allocateConsignmentBatchGain,
  calculateSupplierLiquidationTotalCents,
  allocateSaleLiquidationAmounts,
  summarizeConsignmentLiquidationSelection,
  type ConsignmentLiquidationSourceItem
} from '../../../shared/consignments/liquidation';
import type { SqliteDatabaseLike } from '../../db/connection';
import {
  type HistoricalSaleItemFinancials,
  loadHistoricalSaleItemFinancialsMap
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
  | 'SALE_ITEM_WITHOUT_HISTORICAL_COST'
  | 'NO_LIQUIDATION_DUE'
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
  saleId: number;
  saleStatus: SaleStatus;
  saleItemId: number;
  productName: string;
  saleNumber: number;
  saleDate: string;
  buyerName: string | null;
  saleTotalCents: number;
  salePaidCents: number;
  saleBalanceCents: number;
  supplierTotalToLiquidateCents: number;
  liquidatedPreviouslyCents: number;
  gainCents: number;
}

interface SaleItemValidationRow {
  saleItemId: number;
  saleNumber: number;
  saleId: number;
  saleStatus: SaleStatus;
  consignmentStatus: string;
  salePaidCents: number;
  saleBalanceCents: number;
}

interface BatchHistoryRow extends ConsignmentBatchHistoryListItem {}

interface BatchDetailHeaderRow {
  batchId: number;
  batchNumber: number;
  liquidationDate: string;
  totalCents: number;
  totalGainCents: number;
  remainingCents: number;
  notes: string | null;
  createdAt: string;
  itemCount: number;
}

interface BatchDetailItemRow extends ConsignmentBatchDetailItem {
  saleItemId: number;
  saleId: number;
}

export function listPendingConsignmentItems(
  database: SqliteDatabaseLike,
  request: ListPendingConsignmentItemsRequest = {}
): PendingConsignmentItem[] {
  const payload = listPendingConsignmentItemsRequestSchema.parse(request);
  const limit = payload.limit ?? 200;

  return loadPendingConsignmentRows(database, limit).map(({ supplierTotalToLiquidateCents, ...row }) => ({
    ...row,
    saleStatus: row.saleStatus as PendingConsignmentItem['saleStatus'],
    amountCents: Math.max(supplierTotalToLiquidateCents - row.liquidatedPreviouslyCents, 0)
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
    const selectedSaleItems = loadSaleItemsForSettlement(database, normalizedIds);
    const pendingRows = loadPendingConsignmentRows(database);
    const pendingRowsBySaleItemId = new Map(pendingRows.map((row) => [row.saleItemId, row]));

    selectedSaleItems.forEach((saleItem) => {
      const source = pendingRowsBySaleItemId.get(saleItem.saleItemId);

      if (!source || source.supplierTotalToLiquidateCents <= 0) {
        throw new ConsignmentServiceError(
          'SALE_ITEM_WITHOUT_HISTORICAL_COST',
          `Sale item ${saleItem.saleItemId} does not have a liquidation base.`
        );
      }
    });

    const allocationSummary = summarizeConsignmentLiquidationSelection(
      pendingRows,
      normalizedIds
    );

    if (allocationSummary.totalDueNowCents <= 0) {
      throw new ConsignmentServiceError(
        'NO_LIQUIDATION_DUE',
        'The selected consignment items have no remaining liquidation amount right now.'
      );
    }

    const financialsMap = loadHistoricalSaleItemFinancialsMap(database, normalizedIds);
    const paymentSummaryMap = buildPaymentSummaryMap(
      database,
      [...new Set(selectedSaleItems.map((saleItem) => saleItem.saleId))]
    );
    const selectedAllocationMap = new Map(
      allocationSummary.items.map((item) => [item.saleItemId, item])
    );
    const batchGainBySaleItemId = new Map<number, HistoricalSaleItemFinancials>();

    normalizedIds.forEach((saleItemId) => {
      const source = pendingRowsBySaleItemId.get(saleItemId);
      const allocation = selectedAllocationMap.get(saleItemId);
      const financials = financialsMap.get(saleItemId);

      if (!source || !allocation || !financials) {
        return;
      }

      const batchGain = allocateConsignmentBatchGain({
        supplierTotalToLiquidateCents: source.supplierTotalToLiquidateCents,
        liquidatedPreviouslyCents: source.liquidatedPreviouslyCents,
        amountToLiquidateCents: allocation.amountDueNowCents,
        productHistoricalGainCents: financials.productGainCents,
        personalizationHistoricalGainCents: financials.personalizationGainCents
      });

      batchGainBySaleItemId.set(saleItemId, {
        personalizationCents: financials.personalizationCents,
        productGainCents: batchGain.productGainCents,
        personalizationGainCents: batchGain.personalizationGainCents,
        totalGainCents: batchGain.gainCents
      });
    });

    const totalGainCents = normalizedIds.reduce(
      (sum, saleItemId) => sum + (batchGainBySaleItemId.get(saleItemId)?.totalGainCents ?? 0),
      0
    );
    const remainingCents = Math.max(
      allocationSummary.totalRemainingBalanceCents - allocationSummary.totalDueNowCents,
      0
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
            remaining_cents,
            notes,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        batchNumber,
        liquidationDate,
        allocationSummary.totalDueNowCents,
        totalGainCents,
        remainingCents,
        notes,
        createdAt
      );
    const batchId = Number(batchInsert.lastInsertRowid);
    const batchItemInsert = database.client.prepare(
      `
        INSERT INTO consignment_batch_items (
          batch_id,
          sale_item_id,
          amount_cents,
          product_gain_cents,
          personalization_gain_cents,
          gain_cents,
          snapshot_sale_status,
          snapshot_sale_paid_cents,
          snapshot_sale_balance_cents,
          snapshot_buyer_name,
          snapshot_payment_method_summary,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    const selectedAllocations = allocationSummary.items.filter((item) => normalizedIds.includes(item.saleItemId));

    selectedAllocations.forEach((allocation) => {
      if (allocation.amountDueNowCents > 0) {
        const source = pendingRowsBySaleItemId.get(allocation.saleItemId);
        const batchGain = batchGainBySaleItemId.get(allocation.saleItemId);

        batchItemInsert.run(
          batchId,
          allocation.saleItemId,
          allocation.amountDueNowCents,
          batchGain?.productGainCents ?? 0,
          batchGain?.personalizationGainCents ?? 0,
          batchGain?.totalGainCents ?? 0,
          source?.saleStatus ?? null,
          source?.salePaidCents ?? null,
          source?.saleBalanceCents ?? null,
          source?.buyerName ?? null,
          paymentSummaryMap.get(source?.saleId ?? 0) ?? 'Sin pagos registrados',
          createdAt
        );
      }
    });

    selectedSaleItems.forEach((saleItem) => {
      const source = pendingRowsBySaleItemId.get(saleItem.saleItemId);

      if (!source) {
        return;
      }

      const amountDueNowCents = allocationSummary.items.find((item) => item.saleItemId === saleItem.saleItemId)?.amountDueNowCents ?? 0;
      const accumulated = (source.liquidatedPreviouslyCents ?? 0) + amountDueNowCents;
      const historicalAmount = source.supplierTotalToLiquidateCents;

      if (accumulated >= historicalAmount) {
        database.client
          .prepare(
            `
              UPDATE sale_items
              SET consignment_status = ?
              WHERE id = ?
            `
          )
          .run(STATUS_SETTLED, saleItem.saleItemId);
      }
    });

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
        quantity: selectedSaleItems.length,
        totalCents: allocationSummary.totalDueNowCents,
        totalGainCents,
        note: notes,
        createdAt
      })
    });

    return {
      batchId,
      batchNumber,
      liquidationDate,
      itemCount: selectedAllocations.filter((item) => item.amountDueNowCents > 0).length,
      totalCents: allocationSummary.totalDueNowCents,
      totalGainCents,
      remainingCents,
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
          cb.remaining_cents AS remainingCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.remaining_cents, cb.notes, cb.created_at
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
          cb.remaining_cents AS remainingCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        WHERE cb.id = ?
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.remaining_cents, cb.notes, cb.created_at
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
          cbi.id AS batchItemId,
          s.id AS saleId,
          COALESCE(cbi.snapshot_sale_status, s.status) AS saleStatus,
          COALESCE(cbi.snapshot_sale_paid_cents, s.paid_cents) AS salePaidCents,
          COALESCE(cbi.snapshot_sale_balance_cents, s.balance_cents) AS saleBalanceCents,
          si.id AS saleItemId,
          si.product_name_snapshot AS productName,
          si.product_category_snapshot AS category,
          si.product_material_snapshot AS material,
          si.product_variant_snapshot AS variant,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          COALESCE(cbi.snapshot_buyer_name, s.customer_name_snapshot) AS buyerName,
          si.unit_price_cents AS unitPriceCents,
          si.line_subtotal_cents AS saleTotalCents,
          cbi.amount_cents AS amountCents,
          cbi.product_gain_cents AS productGainCents,
          cbi.personalization_gain_cents AS personalizationGainCents,
          cbi.gain_cents AS gainCents,
          cbi.snapshot_payment_method_summary AS paymentMethodSummary,
          COALESCE((
            SELECT SUM(previous.amount_cents)
            FROM consignment_batch_items previous
            WHERE previous.sale_item_id = si.id
              AND previous.id < cbi.id
          ), 0) AS liquidatedPreviouslyCents,
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

  const saleItemIds = items.map((item) => item.saleItemId);
  const financialsMap = loadHistoricalSaleItemFinancialsMap(database, saleItemIds);
  const paymentSummaryMap = buildPaymentSummaryMap(database, [...new Set(items.map((item) => item.saleId))]);
  const normalizedItems = items.map(({ saleId, saleItemId, liquidatedPreviouslyCents = 0, ...item }) => {
    const historicalFinancials = financialsMap.get(saleItemId);
    const historicalAmountCents = calculateSupplierLiquidationTotalCents(
      item.saleTotalCents,
      historicalFinancials?.productGainCents ?? item.productGainCents,
      historicalFinancials?.totalGainCents ?? item.gainCents
    );
    const totalAccumulatedCents = liquidatedPreviouslyCents + item.amountCents;

    return {
      ...item,
      saleStatus: item.saleStatus as ConsignmentBatchDetailItem['saleStatus'],
      salePaidCents: item.salePaidCents,
      saleBalanceCents: item.saleBalanceCents,
      paymentMethodSummary: item.paymentMethodSummary?.trim()
        ? item.paymentMethodSummary
        : (paymentSummaryMap.get(saleId) ?? 'Sin pagos registrados'),
      personalizationCents: financialsMap.get(saleItemId)?.personalizationCents ?? null,
      productGainCents: item.productGainCents,
      personalizationGainCents: item.personalizationGainCents,
      gainCents: item.gainCents,
      liquidatedPreviouslyCents,
      totalAccumulatedCents,
      remainingBalanceCents: Math.max(historicalAmountCents - totalAccumulatedCents, 0)
    };
  });

  return {
    ...header,
    remainingCents: header.remainingCents,
    items: normalizedItems
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
          s.id AS saleId,
          s.sale_number AS saleNumber,
          s.status AS saleStatus,
          si.consignment_status AS consignmentStatus,
          s.paid_cents AS salePaidCents,
          s.balance_cents AS saleBalanceCents
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

function loadPendingConsignmentRows(database: SqliteDatabaseLike, limit?: number): PendingRow[] {
  const query = `
    WITH liquidations AS (
      SELECT
        sale_item_id AS saleItemId,
        COALESCE(SUM(amount_cents), 0) AS liquidatedPreviouslyCents
      FROM consignment_batch_items
      GROUP BY sale_item_id
    )
    SELECT
      si.id AS saleItemId,
      s.id AS saleId,
      s.status AS saleStatus,
      s.sale_number AS saleNumber,
      s.sale_date AS saleDate,
      s.customer_name_snapshot AS buyerName,
      si.line_subtotal_cents AS saleTotalCents,
      s.paid_cents AS salePaidCents,
      s.balance_cents AS saleBalanceCents,
      si.product_name_snapshot AS productName,
      COALESCE(liquidations.liquidatedPreviouslyCents, 0) AS liquidatedPreviouslyCents
    FROM sale_items si
    INNER JOIN sales s ON s.id = si.sale_id
    LEFT JOIN liquidations ON liquidations.saleItemId = si.id
    WHERE s.status <> ?
      AND si.consignment_status = ?
    ORDER BY s.sale_date DESC, s.sale_number DESC, si.id DESC
    ${limit == null ? '' : 'LIMIT ?'}
  `;

  const rows = limit == null
    ? (database.client.prepare(query).all(STATUS_CANCELLED, STATUS_PENDING_SETTLEMENT) as PendingRow[])
    : (database.client.prepare(query).all(STATUS_CANCELLED, STATUS_PENDING_SETTLEMENT, limit) as PendingRow[]);

  return hydratePendingRowGains(database, rows);
}

function hydratePendingRowGains(database: SqliteDatabaseLike, rows: PendingRow[]): PendingRow[] {
  const financialsMap = loadHistoricalSaleItemFinancialsMap(
    database,
    rows.map((row) => row.saleItemId)
  );
  const rowsBySaleId = new Map<number, PendingRow[]>();

  rows.forEach((row) => {
    const current = rowsBySaleId.get(row.saleId) ?? [];
    current.push(row);
    rowsBySaleId.set(row.saleId, current);
  });

  const gainBySaleItemId = new Map<number, number>();

  rowsBySaleId.forEach((saleRows) => {
    const liquidationRows = saleRows.map((row) => {
      const financials = financialsMap.get(row.saleItemId);

      return {
        ...row,
        supplierTotalToLiquidateCents: calculateSupplierLiquidationTotalCents(
          row.saleTotalCents,
          financials?.productGainCents ?? 0,
          financials?.totalGainCents ?? 0
        )
      };
    });
    const allocationPlan = allocateSaleLiquidationAmounts(liquidationRows);

    allocationPlan.forEach((allocation) => {
      const financials = financialsMap.get(allocation.saleItemId);

      if (!financials) {
        gainBySaleItemId.set(allocation.saleItemId, 0);
        return;
      }

      gainBySaleItemId.set(
        allocation.saleItemId,
        allocateConsignmentBatchGain({
          supplierTotalToLiquidateCents: allocation.supplierTotalToLiquidateCents,
          liquidatedPreviouslyCents: allocation.liquidatedPreviouslyCents,
          amountToLiquidateCents: allocation.amountDueNowCents,
          productHistoricalGainCents: financials.productGainCents,
          personalizationHistoricalGainCents: financials.personalizationGainCents
        }).gainCents
      );
    });
  });

  return rows.map((row) => ({
    ...row,
    supplierTotalToLiquidateCents: calculateSupplierLiquidationTotalCents(
      row.saleTotalCents,
      financialsMap.get(row.saleItemId)?.productGainCents ?? 0,
      financialsMap.get(row.saleItemId)?.totalGainCents ?? 0
    ),
    gainCents: gainBySaleItemId.get(row.saleItemId) ?? 0
  }));
}

function buildPaymentSummaryMap(database: SqliteDatabaseLike, saleIds: number[]): Map<number, string> {
  if (saleIds.length === 0) {
    return new Map();
  }

  const rows = database.client
    .prepare(
      `
        SELECT
          sale_id AS saleId,
          payment_method AS paymentMethod,
          amount_cents AS amountCents
        FROM payments
        WHERE sale_id IN (${createPlaceholders(saleIds.length)})
          AND cancelled_at IS NULL
        ORDER BY created_at ASC, id ASC
      `
    )
    .all(...saleIds) as Array<{ saleId: number; paymentMethod: string | null; amountCents: number }>;

  const grouped = new Map<number, Array<{ paymentMethod: string | null; amountCents: number }>>();

  rows.forEach((row) => {
    const current = grouped.get(row.saleId) ?? [];
    current.push({ paymentMethod: row.paymentMethod, amountCents: row.amountCents });
    grouped.set(row.saleId, current);
  });

  const labels = new Map<number, string>();

  grouped.forEach((payments, saleId) => {
    labels.set(
      saleId,
      payments
        .map((payment) => `${formatPaymentMethodLabel(payment.paymentMethod)}: ${formatCurrencyCents(payment.amountCents)}`)
        .join(' / ')
    );
  });

  return labels;
}

function formatPaymentMethodLabel(value: string | null): string {
  switch (value) {
    case 'cash':
      return 'Efectivo';
    case 'bank_transfer':
      return 'Transferencia';
    default:
      return 'Sin método';
  }
}

function formatCurrencyCents(amountCents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amountCents / 100);
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
