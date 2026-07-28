import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const appMetadataTable = sqliteTable('app_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const reusableProductsTable = sqliteTable(
  'reusable_products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    category: text('category').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    material: text('material').notNull(),
    variant: text('variant').notNull(),
    searchTextNormalized: text('search_text_normalized').notNull(),
    duplicateKey: text('duplicate_key').notNull(),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    searchIndex: index('reusable_products_search_text_normalized_idx').on(table.searchTextNormalized),
    duplicateKeyIndex: index('reusable_products_duplicate_key_idx').on(table.duplicateKey)
  })
);

export const settingsMarginRulesTable = sqliteTable(
  'settings_margin_rules',
  {
    category: text('category').notNull(),
    materialNormalized: text('material_normalized').notNull(),
    materialLabel: text('material_label'),
    profitPercentageBasisPoints: integer('profit_percentage_basis_points').notNull(),
    personalizationPercentageBasisPoints: integer('personalization_percentage_basis_points').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.category, table.materialNormalized] })
  })
);

export const stockIntakesTable = sqliteTable(
  'stock_intakes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reusableProductId: integer('reusable_product_id')
      .notNull()
      .references(() => reusableProductsTable.id),
    enteredQuantity: integer('entered_quantity').notNull(),
    availableQuantity: integer('available_quantity').notNull(),
    supplierUnitCostCents: integer('supplier_unit_cost_cents').notNull(),
    cashPriceCents: integer('cash_price_cents').notNull(),
    listPriceCents: integer('list_price_cents').notNull(),
    profitPercentageBasisPoints: integer('profit_percentage_basis_points').notNull(),
    expectedProfitCents: integer('expected_profit_cents').notNull(),
    expectedListProfitCents: integer('expected_list_profit_cents').notNull().default(0),
    personalizationAmountCents: integer('personalization_amount_cents'),
    personalizationPercentageBasisPoints: integer('personalization_percentage_basis_points'),
    personalizationExpectedProfitCents: integer('personalization_expected_profit_cents'),
    intakeDate: text('intake_date').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    productIndex: index('stock_intakes_reusable_product_id_idx').on(table.reusableProductId),
    intakeDateIndex: index('stock_intakes_intake_date_idx').on(table.intakeDate)
  })
);

export const customersTable = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phoneText: text('phone_text').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    phoneIndex: index('customers_phone_text_idx').on(table.phoneText)
  })
);

export const salesTable = sqliteTable(
  'sales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleNumber: integer('sale_number').notNull(),
    customerId: integer('customer_id').references(() => customersTable.id),
    customerNameSnapshot: text('customer_name_snapshot'),
    customerPhoneSnapshot: text('customer_phone_snapshot'),
    customerNoteSnapshot: text('customer_note_snapshot'),
    saleDate: text('sale_date').notNull(),
    totalCents: integer('total_cents').notNull(),
    paidCents: integer('paid_cents').notNull(),
    balanceCents: integer('balance_cents').notNull(),
    status: text('status').notNull(),
    cancellationReason: text('cancellation_reason'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleNumberIndex: index('sales_sale_number_idx').on(table.saleNumber),
    customerIndex: index('sales_customer_id_idx').on(table.customerId),
    statusIndex: index('sales_status_idx').on(table.status)
  })
);

export const saleItemsTable = sqliteTable(
  'sale_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => salesTable.id),
    reusableProductId: integer('reusable_product_id')
      .notNull()
      .references(() => reusableProductsTable.id),
    productCategorySnapshot: text('product_category_snapshot').notNull(),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    productMaterialSnapshot: text('product_material_snapshot').notNull(),
    productVariantSnapshot: text('product_variant_snapshot').notNull(),
    quantity: integer('quantity').notNull(),
    priceType: text('price_type').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    unitBasePriceCents: integer('unit_base_price_cents'),
    unitPersonalizationAmountCents: integer('unit_personalization_amount_cents'),
    personalizationPercentageBasisPoints: integer('personalization_percentage_basis_points'),
    lineSubtotalCents: integer('line_subtotal_cents').notNull(),
    lineBaseSubtotalCents: integer('line_base_subtotal_cents'),
    linePersonalizationSubtotalCents: integer('line_personalization_subtotal_cents'),
    productGainCents: integer('product_gain_cents'),
    personalizationGainCents: integer('personalization_gain_cents'),
    totalGainCents: integer('total_gain_cents'),
    consignmentStatus: text('consignment_status').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleIndex: index('sale_items_sale_id_idx').on(table.saleId),
    productIndex: index('sale_items_reusable_product_id_idx').on(table.reusableProductId),
    consignmentStatusIndex: index('sale_items_consignment_status_idx').on(table.consignmentStatus)
  })
);

export const saleItemAllocationsTable = sqliteTable(
  'sale_item_allocations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleItemId: integer('sale_item_id')
      .notNull()
      .references(() => saleItemsTable.id),
    stockIntakeId: integer('stock_intake_id')
      .notNull()
      .references(() => stockIntakesTable.id),
    consumedQuantity: integer('consumed_quantity').notNull(),
    historicalSupplierUnitCostCents: integer('historical_supplier_unit_cost_cents').notNull(),
    historicalProfitPercentageBasisPoints: integer('historical_profit_percentage_basis_points').notNull(),
    historicalCashPriceCents: integer('historical_cash_price_cents').notNull(),
    historicalListPriceCents: integer('historical_list_price_cents').notNull(),
    historicalPersonalizationAmountCents: integer('historical_personalization_amount_cents'),
    historicalPersonalizationPercentageBasisPoints: integer('historical_personalization_percentage_basis_points'),
    historicalPersonalizationExpectedProfitCents: integer('historical_personalization_expected_profit_cents'),
    allocationOrder: integer('allocation_order').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleItemIndex: index('sale_item_allocations_sale_item_id_idx').on(table.saleItemId),
    stockIntakeIndex: index('sale_item_allocations_stock_intake_id_idx').on(table.stockIntakeId)
  })
);

export const paymentsTable = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => salesTable.id),
    paymentDate: text('payment_date').notNull(),
    amountCents: integer('amount_cents').notNull(),
    paymentMethod: text('payment_method'),
    note: text('note'),
    cancelledAt: text('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleIndex: index('payments_sale_id_idx').on(table.saleId),
    activeIndex: index('payments_cancelled_at_idx').on(table.cancelledAt)
  })
);

export const consignmentBatchesTable = sqliteTable(
  'consignment_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchNumber: integer('batch_number').notNull(),
    liquidationDate: text('liquidation_date').notNull(),
    totalCents: integer('total_cents').notNull(),
    totalGainCents: integer('total_gain_cents').notNull().default(0),
    remainingCents: integer('remaining_cents').notNull().default(0),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    batchNumberIndex: index('consignment_batches_batch_number_idx').on(table.batchNumber),
    liquidationDateIndex: index('consignment_batches_liquidation_date_idx').on(table.liquidationDate)
  })
);

export const consignmentBatchItemsTable = sqliteTable(
  'consignment_batch_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchId: integer('batch_id')
      .notNull()
      .references(() => consignmentBatchesTable.id),
    saleItemId: integer('sale_item_id')
      .notNull()
      .references(() => saleItemsTable.id),
    amountCents: integer('amount_cents').notNull(),
    productGainCents: integer('product_gain_cents').notNull().default(0),
    personalizationGainCents: integer('personalization_gain_cents').notNull().default(0),
    gainCents: integer('gain_cents').notNull().default(0),
    snapshotSaleStatus: text('snapshot_sale_status'),
    snapshotSalePaidCents: integer('snapshot_sale_paid_cents'),
    snapshotSaleBalanceCents: integer('snapshot_sale_balance_cents'),
    snapshotBuyerName: text('snapshot_buyer_name'),
    snapshotPaymentMethodSummary: text('snapshot_payment_method_summary'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    batchIndex: index('consignment_batch_items_batch_id_idx').on(table.batchId),
    saleItemIndex: index('consignment_batch_items_sale_item_id_idx').on(table.saleItemId)
  })
);

export const auditLogsTable = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    occurredAt: text('occurred_at').notNull(),
    operationType: text('operation_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull(),
    detailJson: text('detail_json')
  },
  (table) => ({
    operationIndex: index('audit_logs_operation_type_idx').on(table.operationType),
    entityIndex: index('audit_logs_entity_type_entity_id_idx').on(table.entityType, table.entityId)
  })
);
