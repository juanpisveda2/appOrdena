import type {
  AssignSaleCustomerForPaymentRecoveryRequest,
  CancelSalePaymentRequest,
  CancelSaleRequest,
  ConfirmSaleDraftRequest,
  GetSaleDetailRequest,
  ListSalesHistoryRequest,
  SaleCustomerSummary,
  SalesHistoryListItem,
  SaleItemAllocationSnapshot,
  SaleItemSnapshot,
  SalePaymentSnapshot,
  SalePriceType,
  SaleSnapshot,
  SaleStatus,
  RegisterSalePaymentRequest
} from '../../../shared/contracts/sales';
import {
  DEFAULT_PERSONALIZATION_BASIS_POINTS,
  calculateExpectedProfitCents,
  isPersonalizationAllowed
} from '../../../shared/catalog/pricing';
import {
  assignSaleCustomerForPaymentRecoveryRequestSchema,
  cancelSalePaymentRequestSchema,
  cancelSaleRequestSchema,
  confirmSaleDraftRequestSchema,
  getSaleDetailRequestSchema,
  listSalesHistoryRequestSchema,
  registerSalePaymentRequestSchema
} from '../../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../../db/connection';
import {
  loadHistoricalSaleItemFinancialsMap,
  loadHistoricalSaleItemProfitMap,
  sumHistoricalSaleItemProfits
} from './profit';

type PaymentMethod = 'cash' | 'bank_transfer' | null;

interface ProductPricingRow {
  reusableProductId: number;
  category: string;
  name: string;
  material: string;
  variant: string;
  currentCashPriceCents: number | null;
  currentListPriceCents: number | null;
  currentExpectedProfitCents: number | null;
}

interface ResolvedCustomerSnapshot {
  customerId: number | null;
  name: string | null;
  phoneText: string | null;
  note: string | null;
}

interface AllocationSourceRow {
  stockIntakeId: number;
  reusableProductId: number;
  availableQuantity: number;
  supplierUnitCostCents: number;
  cashPriceCents: number;
  listPriceCents: number;
  profitPercentageBasisPoints: number;
  personalizationAmountCents: number | null;
  personalizationPercentageBasisPoints: number | null;
  personalizationExpectedProfitCents: number | null;
}

interface SaleRow {
  saleId: number;
  saleNumber: number;
  saleDate: string;
  status: SaleStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  cancellationReason: string | null;
  customerId: number | null;
  customerNameSnapshot: string | null;
  customerPhoneSnapshot: string | null;
  customerNoteSnapshot: string | null;
}

interface SaleItemRow {
  saleItemId: number;
  reusableProductId: number;
  productCategory: string;
  productName: string;
  productMaterial: string;
  productVariant: string;
  quantity: number;
  priceType: SalePriceType;
  unitPriceCents: number;
  unitBasePriceCents: number | null;
  unitPersonalizationAmountCents: number | null;
  personalizationPercentageBasisPoints: number | null;
  lineSubtotalCents: number;
  lineBaseSubtotalCents: number | null;
  linePersonalizationSubtotalCents: number | null;
  productGainCents: number | null;
  personalizationGainCents: number | null;
  totalGainCents: number | null;
  consignmentStatus: 'pending_settlement' | 'settled';
}

interface AllocationRow extends SaleItemAllocationSnapshot {
  saleItemId: number;
}

interface HistoricalSaleItemFinancialsSnapshot {
  productGainCents: number;
  personalizationGainCents: number;
  totalGainCents: number;
}

interface PaymentRow {
  paymentId: number;
  paymentDate: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  note: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

interface SalesHistoryRow {
  saleId: number;
  saleNumber: number;
  saleDate: string;
  status: SaleStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  customerName: string | null;
  customerPhoneText: string | null;
}

interface SaleHistoryItemRow {
  saleId: number;
  saleItemId: number;
}

const STATUS_PENDING: SaleStatus = 'pending_payment';
const STATUS_PARTIAL: SaleStatus = 'partial_payment';
const STATUS_PAID: SaleStatus = 'paid';
const STATUS_CANCELLED: SaleStatus = 'cancelled';

export function listSalesHistory(
  database: SqliteDatabaseLike,
  request: ListSalesHistoryRequest = {}
): SalesHistoryListItem[] {
  const payload = listSalesHistoryRequestSchema.parse(request);
  const query = payload.query?.trim() ?? '';
  const limit = payload.limit ?? 20;
  const likeQuery = `%${escapeLikePattern(query)}%`;

  const rows = database.client
    .prepare(
      `
        SELECT
          s.id AS saleId,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.status AS status,
          s.total_cents AS totalCents,
          s.paid_cents AS paidCents,
          s.balance_cents AS balanceCents,
          s.customer_name_snapshot AS customerName,
          s.customer_phone_snapshot AS customerPhoneText
        FROM sales s
        WHERE (
          ? = ''
          OR CAST(s.sale_number AS TEXT) LIKE ? ESCAPE '\\'
          OR COALESCE(s.customer_name_snapshot, '') LIKE ? ESCAPE '\\'
          OR COALESCE(s.customer_phone_snapshot, '') LIKE ? ESCAPE '\\'
        )
        ORDER BY s.sale_date DESC, s.sale_number DESC, s.id DESC
        LIMIT ?
      `
    )
    .all(query, likeQuery, likeQuery, likeQuery, limit) as SalesHistoryRow[];

  const historyItemRows = rows.length
    ? (database.client
        .prepare(
          `
            SELECT id AS saleItemId, sale_id AS saleId
            FROM sale_items
            WHERE sale_id IN (${rows.map(() => '?').join(', ')})
          `
        )
        .all(...rows.map((row) => row.saleId)) as SaleHistoryItemRow[])
    : [];
  const profitMap = loadHistoricalSaleItemProfitMap(
    database,
    historyItemRows.map((row) => row.saleItemId)
  );
  const itemIdsBySaleId = new Map<number, number[]>();

  historyItemRows.forEach((row) => {
    itemIdsBySaleId.set(row.saleId, [...(itemIdsBySaleId.get(row.saleId) ?? []), row.saleItemId]);
  });

  return rows.map((row) => ({
    ...row,
    totalProfitCents: sumHistoricalSaleItemProfits(profitMap, itemIdsBySaleId.get(row.saleId) ?? [])
  }));
}

export function getSaleDetail(
  database: SqliteDatabaseLike,
  request: GetSaleDetailRequest
): SaleSnapshot {
  const payload = getSaleDetailRequestSchema.parse(request);

  return getSaleSnapshot(database, payload.saleId);
}

export function confirmSaleDraft(
  database: SqliteDatabaseLike,
  request: ConfirmSaleDraftRequest
): SaleSnapshot {
  const payload = confirmSaleDraftRequestSchema.parse(request);
  const saleDate = payload.saleDate ?? new Date().toISOString();
  const initialPaymentAmount = payload.initialPayment?.amountCents ?? 0;

  const transaction = database.client.transaction(() => {
    const pricingStatement = database.client.prepare(
      `
        SELECT
          rp.id AS reusableProductId,
          rp.category AS category,
          rp.name AS name,
          rp.material AS material,
          rp.variant AS variant,
          (
            SELECT si.cash_price_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentCashPriceCents,
          (
            SELECT si.list_price_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentListPriceCents
          ,(
            SELECT si.expected_profit_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentExpectedProfitCents
        FROM reusable_products rp
        WHERE rp.id = ? AND rp.deleted_at IS NULL
        LIMIT 1
      `
    );

    const draftItems = payload.draftItems.map((item) => {
      const pricing = pricingStatement.get(item.reusableProductId) as ProductPricingRow | undefined;

      if (!pricing) {
        throw new Error(`Reusable product ${item.reusableProductId} was not found.`);
      }

      const unitPriceCents =
        item.priceType === 'cash' ? pricing.currentCashPriceCents : pricing.currentListPriceCents;

      if (unitPriceCents == null) {
        throw new Error(`Reusable product ${item.reusableProductId} does not have a current ${item.priceType} price.`);
      }

      return {
        ...item,
        category: pricing.category,
        name: pricing.name,
        material: pricing.material,
        variant: pricing.variant,
        unitBasePriceCents: unitPriceCents,
        unitPersonalizationAmountCents: resolveSaleItemPersonalizationAmountCents(item, pricing.category),
        personalizationPercentageBasisPoints: resolveSaleItemPersonalizationPercentage(item),
        unitPersonalizationExpectedProfitCents:
          item.personalizationAmountCents == null
            ? null
            : calculateExpectedProfitCents(
                resolveSaleItemPersonalizationAmountCents(item, pricing.category) ?? 0,
                resolveSaleItemPersonalizationPercentage(item) ?? DEFAULT_PERSONALIZATION_BASIS_POINTS
              )
      };
    });
    const finalizedDraftItems = draftItems.map((item) => {
      const lineBaseSubtotalCents = item.unitBasePriceCents * item.quantity;
      const linePersonalizationSubtotalCents = (item.unitPersonalizationAmountCents ?? 0) * item.quantity;

      return {
        ...item,
        unitPriceCents: item.unitBasePriceCents + (item.unitPersonalizationAmountCents ?? 0),
        lineBaseSubtotalCents,
        linePersonalizationSubtotalCents,
        lineSubtotalCents: lineBaseSubtotalCents + linePersonalizationSubtotalCents
      };
    });
    const totalCents = finalizedDraftItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);

    if (initialPaymentAmount > totalCents) {
      throw new Error('Initial payment cannot be greater than the sale total.');
    }

    const balanceCents = totalCents - initialPaymentAmount;
    const customer = resolveCustomerSnapshot(database, payload.customer ?? null, balanceCents);
    const saleNumber = nextSaleNumber(database);
    const status = computeSaleStatus(totalCents, initialPaymentAmount, false);
    const saleInsert = database.client
      .prepare(
        `
          INSERT INTO sales (
            sale_number,
            customer_id,
            customer_name_snapshot,
            customer_phone_snapshot,
            customer_note_snapshot,
            sale_date,
            total_cents,
            paid_cents,
            balance_cents,
            status,
            cancellation_reason,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        `
      )
      .run(
        saleNumber,
        customer.customerId,
        customer.name,
        customer.phoneText,
        customer.note,
        saleDate,
        totalCents,
        initialPaymentAmount,
        balanceCents,
        status,
        saleDate,
        saleDate
      );
    const saleId = Number(saleInsert.lastInsertRowid);
    const itemInsertStatement = database.client.prepare(
      `
        INSERT INTO sale_items (
          sale_id,
          reusable_product_id,
          product_category_snapshot,
          product_name_snapshot,
          product_material_snapshot,
          product_variant_snapshot,
          quantity,
          price_type,
          unit_price_cents,
          line_subtotal_cents,
          consignment_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_settlement', ?)
      `
    );
    const allocationInsertStatement = database.client.prepare(
      `
        INSERT INTO sale_item_allocations (
          sale_item_id,
          stock_intake_id,
          consumed_quantity,
          historical_supplier_unit_cost_cents,
          historical_profit_percentage_basis_points,
          historical_cash_price_cents,
          historical_list_price_cents,
          historical_personalization_amount_cents,
          historical_personalization_percentage_basis_points,
          historical_personalization_expected_profit_cents,
          allocation_order,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const stockUpdateStatement = database.client.prepare(
      'UPDATE stock_intakes SET available_quantity = available_quantity - ? WHERE id = ?'
    );

    for (const item of finalizedDraftItems) {
        const saleItemInsert = itemInsertStatement.run(
          saleId,
          item.reusableProductId,
          item.category,
          item.name,
          item.material,
          item.variant,
          item.quantity,
          item.priceType,
          item.unitPriceCents,
          item.lineSubtotalCents,
          saleDate
        );
      const saleItemId = Number(saleItemInsert.lastInsertRowid);
      const allocations = allocateStock(database, item.reusableProductId, item.quantity);
      const financials = calculateHistoricalSaleItemFinancials(item, allocations);

      database.client
        .prepare(
          `
            UPDATE sale_items
            SET unit_base_price_cents = ?,
                unit_personalization_amount_cents = ?,
                personalization_percentage_basis_points = ?,
                line_base_subtotal_cents = ?,
                line_personalization_subtotal_cents = ?,
                product_gain_cents = ?,
                personalization_gain_cents = ?,
                total_gain_cents = ?
            WHERE id = ?
          `
        )
        .run(
          item.unitBasePriceCents,
          item.unitPersonalizationAmountCents,
          item.personalizationPercentageBasisPoints,
          item.lineBaseSubtotalCents,
          item.linePersonalizationSubtotalCents,
          financials.productGainCents,
          financials.personalizationGainCents,
          financials.totalGainCents,
          saleItemId
        );

      allocations.forEach((allocation, index) => {
        stockUpdateStatement.run(allocation.consumedQuantity, allocation.stockIntakeId);
        allocationInsertStatement.run(
          saleItemId,
          allocation.stockIntakeId,
          allocation.consumedQuantity,
          allocation.historicalSupplierUnitCostCents,
          allocation.historicalProfitPercentageBasisPoints,
          allocation.historicalCashPriceCents,
          allocation.historicalListPriceCents,
          item.unitPersonalizationAmountCents,
          item.personalizationPercentageBasisPoints,
          item.unitPersonalizationExpectedProfitCents,
          index + 1,
          saleDate
        );
      });
    }

    if (payload.initialPayment) {
      createPayment(database, {
        saleId,
        paymentDate: saleDate,
        amountCents: payload.initialPayment.amountCents,
        paymentMethod: payload.initialPayment.paymentMethod ?? null,
        note: payload.initialPayment.note ?? null
      });
    }

    insertAuditLog(database, {
      occurredAt: saleDate,
      operationType: 'sale_confirmed',
      entityType: 'sale',
      entityId: String(saleId),
      summary: `Confirmed sale #${saleNumber}.`,
      detailJson: JSON.stringify({ saleId, totalCents, paidCents: initialPaymentAmount, balanceCents })
    });

    syncSaleTotals(database, saleId, saleDate);

    return getSaleSnapshot(database, saleId);
  });

  return transaction();
}

export function registerSalePayment(
  database: SqliteDatabaseLike,
  request: RegisterSalePaymentRequest
): SaleSnapshot {
  const payload = registerSalePaymentRequestSchema.parse(request);
  const paymentDate = payload.paymentDate ?? new Date().toISOString();

  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);

    if (sale.status === STATUS_CANCELLED) {
      throw new Error('Cancelled sales do not accept new payments.');
    }

    if (payload.amountCents > sale.balanceCents) {
      throw new Error('Payment amount cannot be greater than the remaining balance.');
    }

    createPayment(database, {
      saleId: payload.saleId,
      paymentDate,
      amountCents: payload.amountCents,
      paymentMethod: payload.paymentMethod ?? null,
      note: payload.note ?? null
    });

    insertAuditLog(database, {
      occurredAt: paymentDate,
      operationType: 'sale_payment_registered',
      entityType: 'sale',
      entityId: String(payload.saleId),
      summary: `Registered payment for sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, amountCents: payload.amountCents })
    });

    syncSaleTotals(database, payload.saleId, paymentDate);

    return getSaleSnapshot(database, payload.saleId);
  });

  return transaction();
}

export function cancelSalePayment(
  database: SqliteDatabaseLike,
  request: CancelSalePaymentRequest
): SaleSnapshot {
  const payload = cancelSalePaymentRequestSchema.parse(request);
  const cancelledAt = payload.cancelledAt ?? new Date().toISOString();

  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);

    if (sale.status === STATUS_CANCELLED) {
      throw new Error('Cancelled sales do not allow payment cancellation changes.');
    }

    const payment = database.client
      .prepare(
        `
          SELECT id, amount_cents AS amountCents, cancelled_at AS cancelledAt
          FROM payments
          WHERE id = ? AND sale_id = ?
          LIMIT 1
        `
      )
      .get(payload.paymentId, payload.saleId) as
      | { id: number; amountCents: number; cancelledAt: string | null }
      | undefined;

    if (!payment) {
      throw new Error(`Payment ${payload.paymentId} was not found for sale ${payload.saleId}.`);
    }

    if (payment.cancelledAt) {
      throw new Error('The selected payment is already cancelled.');
    }

    const nextBalance = sale.balanceCents + payment.amountCents;

    if (nextBalance > 0 && sale.customerId == null) {
      throw new Error('A walk-in sale cannot become pending after cancelling a payment.');
    }

    database.client
      .prepare(
        'UPDATE payments SET cancelled_at = ?, cancellation_reason = ? WHERE id = ? AND sale_id = ?'
      )
      .run(cancelledAt, payload.reason, payload.paymentId, payload.saleId);

    insertAuditLog(database, {
      occurredAt: cancelledAt,
      operationType: 'sale_payment_cancelled',
      entityType: 'payment',
      entityId: String(payload.paymentId),
      summary: `Cancelled payment ${payload.paymentId} for sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, paymentId: payload.paymentId, reason: payload.reason })
    });

    syncSaleTotals(database, payload.saleId, cancelledAt);

    return getSaleSnapshot(database, payload.saleId);
  });

  return transaction();
}

export function cancelSale(database: SqliteDatabaseLike, request: CancelSaleRequest): SaleSnapshot {
  const payload = cancelSaleRequestSchema.parse(request);
  const cancelledAt = payload.cancelledAt ?? new Date().toISOString();

  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);

    if (sale.status === STATUS_CANCELLED) {
      throw new Error('The selected sale is already cancelled.');
    }

    const settledItem = database.client
      .prepare(
        `
          SELECT id
          FROM sale_items
          WHERE sale_id = ? AND consignment_status = 'settled'
          LIMIT 1
        `
      )
      .get(payload.saleId) as { id: number } | undefined;

    if (settledItem) {
      throw new Error('The sale cannot be cancelled because it has settled items.');
    }

    const allocations = database.client
      .prepare(
        `
          SELECT stock_intake_id AS stockIntakeId, consumed_quantity AS consumedQuantity
          FROM sale_item_allocations
          WHERE sale_item_id IN (
            SELECT id FROM sale_items WHERE sale_id = ?
          )
          ORDER BY allocation_order ASC, id ASC
        `
      )
      .all(payload.saleId) as Array<{ stockIntakeId: number; consumedQuantity: number }>;

    const stockRestoreStatement = database.client.prepare(
      'UPDATE stock_intakes SET available_quantity = available_quantity + ? WHERE id = ?'
    );

    allocations.forEach((allocation) => {
      stockRestoreStatement.run(allocation.consumedQuantity, allocation.stockIntakeId);
    });

    database.client
      .prepare(
        `
          UPDATE sales
          SET status = ?,
              cancellation_reason = ?,
              updated_at = ?
          WHERE id = ?
        `
      )
      .run(STATUS_CANCELLED, payload.reason, cancelledAt, payload.saleId);

    insertAuditLog(database, {
      occurredAt: cancelledAt,
      operationType: 'sale_cancelled',
      entityType: 'sale',
      entityId: String(payload.saleId),
      summary: `Cancelled sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, reason: payload.reason })
    });

    return getSaleSnapshot(database, payload.saleId);
  });

  return transaction();
}

export function assignSaleCustomerForPaymentRecovery(
  database: SqliteDatabaseLike,
  request: AssignSaleCustomerForPaymentRecoveryRequest
): SaleSnapshot {
  const payload = assignSaleCustomerForPaymentRecoveryRequestSchema.parse(request);
  const assignedAt = new Date().toISOString();

  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);

    if (sale.status === STATUS_CANCELLED) {
      throw new Error('Cancelled sales do not allow recovery customer assignment.');
    }

    if (sale.customerId != null) {
      throw new Error('The selected sale already has a customer assigned.');
    }

    if (sale.balanceCents !== 0 || sale.status !== STATUS_PAID) {
      throw new Error('Recovery customer assignment is limited to fully paid walk-in sales.');
    }

    const customerId = createCustomer(database, {
      name: payload.name,
      phoneText: payload.phoneText,
      note: null,
      timestamp: assignedAt
    });
    const customer = getCustomerSnapshotById(database, customerId);

    database.client
      .prepare(
        `
          UPDATE sales
          SET customer_id = ?,
              customer_name_snapshot = ?,
              customer_phone_snapshot = ?,
              customer_note_snapshot = ?,
              updated_at = ?
          WHERE id = ?
        `
      )
      .run(customerId, customer.name, customer.phoneText, customer.note, assignedAt, payload.saleId);

    insertAuditLog(database, {
      occurredAt: assignedAt,
      operationType: 'sale_customer_assigned_for_payment_recovery',
      entityType: 'sale',
      entityId: String(payload.saleId),
      summary: `Assigned a customer to fully paid walk-in sale #${sale.saleNumber} for payment recovery.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, customerId })
    });

    return getSaleSnapshot(database, payload.saleId);
  });

  return transaction();
}

function resolveCustomerSnapshot(
  database: SqliteDatabaseLike,
  customer: ConfirmSaleDraftRequest['customer'],
  balanceCents: number
): ResolvedCustomerSnapshot {
  if (!customer) {
    if (balanceCents > 0) {
      throw new Error('A customer with name and phone is required when the sale has a pending balance.');
    }

    return {
      customerId: null,
      name: null,
      phoneText: null,
      note: null
    };
  }

  if (customer.customerId != null) {
    const existingCustomer = getCustomerSnapshotById(database, customer.customerId);

    if (
      balanceCents > 0 &&
      (!(existingCustomer.name ?? '').trim() || !(existingCustomer.phoneText ?? '').trim())
    ) {
      throw new Error('The selected customer must include both name and phone for a pending sale.');
    }

    return existingCustomer;
  }

  const name = customer.name?.trim() ?? '';
  const phoneText = customer.phoneText?.trim() ?? '';
  const note = customer.note?.trim() || null;
  const wantsCustomerRecord = name.length > 0 || phoneText.length > 0 || note != null;

  if (!wantsCustomerRecord) {
    if (balanceCents > 0) {
      throw new Error('A customer with name and phone is required when the sale has a pending balance.');
    }

    return {
      customerId: null,
      name: null,
      phoneText: null,
      note: null
    };
  }

  if (!name || !phoneText) {
    throw new Error('Customer name and phone are both required when customer details are provided.');
  }

  const customerId = createCustomer(database, {
    name,
    phoneText,
    note,
    timestamp: new Date().toISOString()
  });

  return getCustomerSnapshotById(database, customerId);
}

function getCustomerSnapshotById(database: SqliteDatabaseLike, customerId: number): ResolvedCustomerSnapshot {
  const existingCustomer = database.client
    .prepare(
      `
        SELECT id AS customerId, name, phone_text AS phoneText, note
        FROM customers
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(customerId) as ResolvedCustomerSnapshot | undefined;

  if (!existingCustomer) {
    throw new Error(`Customer ${customerId} was not found.`);
  }

  return existingCustomer;
}

function createCustomer(
  database: SqliteDatabaseLike,
  input: {
    name: string;
    phoneText: string;
    note: string | null;
    timestamp: string;
  }
): number {
  const result = database.client
    .prepare(
      `
        INSERT INTO customers (name, phone_text, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(input.name.trim(), input.phoneText.trim(), input.note, input.timestamp, input.timestamp);

  return Number(result.lastInsertRowid);
}

function nextSaleNumber(database: SqliteDatabaseLike): number {
  const row = database.client
    .prepare('SELECT COALESCE(MAX(sale_number), 0) + 1 AS nextSaleNumber FROM sales')
    .get() as { nextSaleNumber: number };

  return row.nextSaleNumber;
}

function allocateStock(
  database: SqliteDatabaseLike,
  reusableProductId: number,
  quantity: number
): Array<Omit<SaleItemAllocationSnapshot, 'allocationId' | 'allocationOrder'>> {
  const rows = database.client
    .prepare(
      `
        SELECT
          id AS stockIntakeId,
          reusable_product_id AS reusableProductId,
          available_quantity AS availableQuantity,
          supplier_unit_cost_cents AS supplierUnitCostCents,
          cash_price_cents AS cashPriceCents,
          list_price_cents AS listPriceCents,
          profit_percentage_basis_points AS profitPercentageBasisPoints,
          personalization_amount_cents AS personalizationAmountCents,
          personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
          personalization_expected_profit_cents AS personalizationExpectedProfitCents
        FROM stock_intakes
        WHERE reusable_product_id = ? AND available_quantity > 0
        ORDER BY intake_date ASC, created_at ASC, id ASC
      `
    )
    .all(reusableProductId) as AllocationSourceRow[];
  let remaining = quantity;
  const allocations: Array<Omit<SaleItemAllocationSnapshot, 'allocationId' | 'allocationOrder'>> = [];

  for (const row of rows) {
    if (remaining === 0) {
      break;
    }

    const consumedQuantity = Math.min(remaining, row.availableQuantity);

    allocations.push({
      stockIntakeId: row.stockIntakeId,
      consumedQuantity,
      historicalSupplierUnitCostCents: row.supplierUnitCostCents,
      historicalProfitPercentageBasisPoints: row.profitPercentageBasisPoints,
      historicalCashPriceCents: row.cashPriceCents,
      historicalListPriceCents: row.listPriceCents,
      historicalPersonalizationAmountCents: row.personalizationAmountCents,
      historicalPersonalizationPercentageBasisPoints: row.personalizationPercentageBasisPoints,
      historicalPersonalizationExpectedProfitCents: row.personalizationExpectedProfitCents
    });
    remaining -= consumedQuantity;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock for reusable product ${reusableProductId}.`);
  }

  return allocations;
}

function resolveSaleItemPersonalizationAmountCents(
  item: ConfirmSaleDraftRequest['draftItems'][number],
  category: string
): number | null {
  if (item.personalizationAmountCents == null) {
    return null;
  }

  if (!isPersonalizationAllowed(category as 'jewelry' | 'mate' | 'clothing')) {
    throw new Error(`Personalization is not allowed for ${category} products.`);
  }

  return item.personalizationAmountCents;
}

function resolveSaleItemPersonalizationPercentage(
  item: ConfirmSaleDraftRequest['draftItems'][number]
): number | null {
  if (item.personalizationAmountCents == null) {
    return null;
  }

  return item.personalizationPercentageBasisPoints ?? DEFAULT_PERSONALIZATION_BASIS_POINTS;
}

function calculateHistoricalSaleItemFinancials(
  item: {
    quantity: number;
    unitPersonalizationExpectedProfitCents: number | null;
  },
  allocations: Array<Omit<SaleItemAllocationSnapshot, 'allocationId' | 'allocationOrder'>>
): HistoricalSaleItemFinancialsSnapshot {
  const productGainCents = allocations.reduce(
    (sum, allocation) =>
      sum +
      allocation.consumedQuantity *
        calculateExpectedProfitCents(
          allocation.historicalSupplierUnitCostCents,
          allocation.historicalProfitPercentageBasisPoints
        ),
    0
  );
  const personalizationGainCents = (item.unitPersonalizationExpectedProfitCents ?? 0) * item.quantity;

  return {
    productGainCents,
    personalizationGainCents,
    totalGainCents: productGainCents + personalizationGainCents
  };
}

function createPayment(
  database: SqliteDatabaseLike,
  input: {
    saleId: number;
    paymentDate: string;
    amountCents: number;
    paymentMethod: PaymentMethod;
    note: string | null;
  }
): number {
  const result = database.client
    .prepare(
      `
        INSERT INTO payments (
          sale_id,
          payment_date,
          amount_cents,
          payment_method,
          note,
          cancelled_at,
          cancellation_reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
      `
    )
    .run(input.saleId, input.paymentDate, input.amountCents, input.paymentMethod, input.note, input.paymentDate);

  return Number(result.lastInsertRowid);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function syncSaleTotals(database: SqliteDatabaseLike, saleId: number, updatedAt: string): void {
  const sale = getSaleRecord(database, saleId);
  const paymentRow = database.client
    .prepare(
      `
        SELECT COALESCE(SUM(amount_cents), 0) AS paidCents
        FROM payments
        WHERE sale_id = ? AND cancelled_at IS NULL
      `
    )
    .get(saleId) as { paidCents: number };
  const paidCents = paymentRow.paidCents;
  const balanceCents = sale.totalCents - paidCents;
  const status = computeSaleStatus(sale.totalCents, paidCents, sale.status === STATUS_CANCELLED);

  if (balanceCents > 0 && sale.customerId == null) {
    throw new Error('A sale with pending balance must have a customer.');
  }

  database.client
    .prepare(
      `
        UPDATE sales
        SET paid_cents = ?,
            balance_cents = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(paidCents, balanceCents, status, updatedAt, saleId);
}

function computeSaleStatus(totalCents: number, paidCents: number, isCancelled: boolean): SaleStatus {
  if (isCancelled) {
    return STATUS_CANCELLED;
  }

  if (paidCents <= 0) {
    return STATUS_PENDING;
  }

  return paidCents >= totalCents ? STATUS_PAID : STATUS_PARTIAL;
}

function getSaleRecord(database: SqliteDatabaseLike, saleId: number): SaleRow {
  const sale = database.client
    .prepare(
      `
        SELECT
          s.id AS saleId,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.status AS status,
          s.total_cents AS totalCents,
          s.paid_cents AS paidCents,
          s.balance_cents AS balanceCents,
          s.cancellation_reason AS cancellationReason,
          s.customer_id AS customerId,
          s.customer_name_snapshot AS customerNameSnapshot,
          s.customer_phone_snapshot AS customerPhoneSnapshot,
          s.customer_note_snapshot AS customerNoteSnapshot
        FROM sales s
        WHERE s.id = ?
        LIMIT 1
      `
    )
    .get(saleId) as SaleRow | undefined;

  if (!sale) {
    throw new Error(`Sale ${saleId} was not found.`);
  }

  return sale;
}

function getSaleSnapshot(database: SqliteDatabaseLike, saleId: number): SaleSnapshot {
  const sale = getSaleRecord(database, saleId);
  const itemRows = database.client
    .prepare(
      `
        SELECT
          id AS saleItemId,
          reusable_product_id AS reusableProductId,
          product_category_snapshot AS productCategory,
          product_name_snapshot AS productName,
          product_material_snapshot AS productMaterial,
          product_variant_snapshot AS productVariant,
          quantity,
          price_type AS priceType,
          unit_price_cents AS unitPriceCents,
          unit_base_price_cents AS unitBasePriceCents,
          unit_personalization_amount_cents AS unitPersonalizationAmountCents,
          personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
          line_subtotal_cents AS lineSubtotalCents,
          line_base_subtotal_cents AS lineBaseSubtotalCents,
          line_personalization_subtotal_cents AS linePersonalizationSubtotalCents,
          product_gain_cents AS productGainCents,
          personalization_gain_cents AS personalizationGainCents,
          total_gain_cents AS totalGainCents,
          consignment_status AS consignmentStatus
        FROM sale_items
        WHERE sale_id = ?
        ORDER BY id ASC
      `
    )
    .all(saleId) as SaleItemRow[];
  const allocationRows = database.client
    .prepare(
      `
        SELECT
          id AS allocationId,
          sale_item_id AS saleItemId,
          stock_intake_id AS stockIntakeId,
          consumed_quantity AS consumedQuantity,
          allocation_order AS allocationOrder,
          historical_supplier_unit_cost_cents AS historicalSupplierUnitCostCents,
          historical_profit_percentage_basis_points AS historicalProfitPercentageBasisPoints,
          historical_cash_price_cents AS historicalCashPriceCents,
          historical_list_price_cents AS historicalListPriceCents,
          historical_personalization_amount_cents AS historicalPersonalizationAmountCents,
          historical_personalization_percentage_basis_points AS historicalPersonalizationPercentageBasisPoints,
          historical_personalization_expected_profit_cents AS historicalPersonalizationExpectedProfitCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = ?)
        ORDER BY sale_item_id ASC, allocation_order ASC, id ASC
      `
    )
    .all(saleId) as AllocationRow[];
  const paymentRows = database.client
    .prepare(
      `
        SELECT
          id AS paymentId,
          payment_date AS paymentDate,
          amount_cents AS amountCents,
          payment_method AS paymentMethod,
          note,
          cancelled_at AS cancelledAt,
          cancellation_reason AS cancellationReason
        FROM payments
        WHERE sale_id = ?
        ORDER BY created_at ASC, id ASC
      `
    )
    .all(saleId) as PaymentRow[];
  const allocationsByItem = new Map<number, SaleItemAllocationSnapshot[]>();

  allocationRows.forEach((row) => {
    const current = allocationsByItem.get(row.saleItemId) ?? [];
    current.push({
      allocationId: row.allocationId,
      stockIntakeId: row.stockIntakeId,
      consumedQuantity: row.consumedQuantity,
      allocationOrder: row.allocationOrder,
      historicalSupplierUnitCostCents: row.historicalSupplierUnitCostCents,
      historicalProfitPercentageBasisPoints: row.historicalProfitPercentageBasisPoints,
      historicalCashPriceCents: row.historicalCashPriceCents,
      historicalListPriceCents: row.historicalListPriceCents,
      historicalPersonalizationAmountCents: row.historicalPersonalizationAmountCents,
      historicalPersonalizationPercentageBasisPoints: row.historicalPersonalizationPercentageBasisPoints,
      historicalPersonalizationExpectedProfitCents: row.historicalPersonalizationExpectedProfitCents
    });
    allocationsByItem.set(row.saleItemId, current);
  });

  const customer: SaleCustomerSummary = {
    customerId: sale.customerId,
    name: sale.customerNameSnapshot,
    phoneText: sale.customerPhoneSnapshot,
    note: sale.customerNoteSnapshot
  };
  const saleItemIds = itemRows.map((item) => item.saleItemId);
  const financialsByItem = loadHistoricalSaleItemFinancialsMap(database, saleItemIds);
  const items: SaleItemSnapshot[] = itemRows.map((item) => ({
    ...item,
    unitBasePriceCents: item.unitBasePriceCents ?? item.unitPriceCents,
    unitPersonalizationAmountCents: item.unitPersonalizationAmountCents,
    personalizationPercentageBasisPoints: item.personalizationPercentageBasisPoints,
    lineBaseSubtotalCents: item.lineBaseSubtotalCents ?? item.lineSubtotalCents,
    linePersonalizationSubtotalCents: item.linePersonalizationSubtotalCents ?? 0,
    productGainCents: item.productGainCents ?? financialsByItem.get(item.saleItemId)?.productGainCents ?? 0,
    personalizationGainCents:
      item.personalizationGainCents ?? financialsByItem.get(item.saleItemId)?.personalizationGainCents ?? 0,
    totalGainCents: item.totalGainCents ?? financialsByItem.get(item.saleItemId)?.totalGainCents ?? 0,
    allocations: allocationsByItem.get(item.saleItemId) ?? []
  }));
  const payments: SalePaymentSnapshot[] = paymentRows.map((payment) => ({
    ...payment,
    isActive: payment.cancelledAt == null
  }));
  const totalProfitCents = sumHistoricalSaleItemProfits(
    loadHistoricalSaleItemProfitMap(database, saleItemIds),
    saleItemIds
  );
  const totalProductGainCents = items.reduce((sum, item) => sum + (item.productGainCents ?? 0), 0);
  const totalPersonalizationGainCents = items.reduce(
    (sum, item) => sum + (item.personalizationGainCents ?? 0),
    0
  );

  return {
    saleId: sale.saleId,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    status: sale.status,
    totalCents: sale.totalCents,
    paidCents: sale.paidCents,
    balanceCents: sale.balanceCents,
    cancellationReason: sale.cancellationReason,
    customer,
    items,
    payments,
    totalProductGainCents,
    totalPersonalizationGainCents,
    totalProfitCents,
    canRegisterPayment: sale.status !== STATUS_CANCELLED && sale.balanceCents > 0,
    canCancelSale: sale.status !== STATUS_CANCELLED && items.every((item) => item.consignmentStatus !== 'settled')
  };
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
