import { describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../../src/main/db/connection';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import {
  confirmConsignmentBatch,
  getConsignmentBatchDetail,
  listConsignmentBatchHistory,
  listPendingConsignmentItems
} from '../../../src/main/services/consignments/service';
import {
  assignSaleCustomerForPaymentRecovery,
  cancelSale,
  confirmSaleDraft,
  getSaleDetail
} from '../../../src/main/services/sales/service';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

function createInitializedAppForTest() {
  return createInitializedApp('project-mama-consignments-');
}

function seedReusableProduct(
  initialized: ReturnType<typeof createInitializedAppForTest>,
  options: {
    name: string;
    enteredQuantity: number;
    availableQuantity: number;
    intakeDate: string;
    supplierUnitCostCents?: number;
    cashPriceCents?: number;
    listPriceCents?: number;
    profitPercentageBasisPoints?: number;
    personalizationAmountCents?: number;
    personalizationPercentageBasisPoints?: number;
  }
) {
  const result = saveStockIntake(initialized.database, {
    newReusableProduct: {
      category: 'jewelry',
      name: options.name,
      material: 'Plata',
      variant: '18 mm'
    },
    enteredQuantity: options.enteredQuantity,
    availableQuantity: options.availableQuantity,
    supplierUnitCostCents: options.supplierUnitCostCents ?? 100_000,
    cashPriceCents: options.cashPriceCents ?? 120_000,
    listPriceCents: options.listPriceCents ?? 125_000,
    profitPercentageBasisPoints: options.profitPercentageBasisPoints ?? 1_000,
    intakeDate: options.intakeDate
  });

  if (result.kind !== 'saved') {
    throw new Error('Expected stock intake seed to be saved.');
  }

  if (options.personalizationAmountCents != null) {
    initialized.database.client
      .prepare(
        `
          UPDATE stock_intakes
          SET personalization_amount_cents = ?,
              personalization_percentage_basis_points = ?,
              personalization_expected_profit_cents = ?
          WHERE id = ?
        `
      )
      .run(
        options.personalizationAmountCents,
        options.personalizationPercentageBasisPoints ?? 500,
        Math.round(options.personalizationAmountCents * ((options.personalizationPercentageBasisPoints ?? 500) / 10_000)),
        result.stockIntakeId
      );
  }

  return result;
}

function seedSoldItem(
  initialized: ReturnType<typeof createInitializedAppForTest>,
  options: {
    name: string;
    saleDate?: string;
    buyerName?: string;
    phoneText?: string;
    supplierUnitCostCents?: number;
    cashPriceCents?: number;
    profitPercentageBasisPoints?: number;
    personalizationAmountCents?: number;
    personalizationPercentageBasisPoints?: number;
    secondIntake?: {
      enteredQuantity: number;
      availableQuantity: number;
      intakeDate: string;
      supplierUnitCostCents: number;
      cashPriceCents?: number;
      listPriceCents?: number;
      profitPercentageBasisPoints?: number;
    };
    quantity?: number;
  }
) {
  const quantity = options.quantity ?? 1;
  const personalizationAmountCents = options.personalizationAmountCents ?? 0;
  const firstIntake = seedReusableProduct(initialized, {
    name: options.name,
    enteredQuantity: options.secondIntake
      ? Math.max(quantity - options.secondIntake.availableQuantity, 1)
      : quantity,
    availableQuantity: options.secondIntake
      ? Math.max(quantity - options.secondIntake.availableQuantity, 1)
      : quantity,
    intakeDate: '2026-07-01',
    supplierUnitCostCents: options.supplierUnitCostCents ?? 90_000,
    cashPriceCents: options.cashPriceCents ?? 120_000,
    listPriceCents: 125_000,
    profitPercentageBasisPoints: options.profitPercentageBasisPoints,
    personalizationAmountCents: options.personalizationAmountCents,
    personalizationPercentageBasisPoints: options.personalizationPercentageBasisPoints
  });

  if (options.secondIntake) {
      saveStockIntake(initialized.database, {
      reusableProductId: firstIntake.reusableProductId,
      enteredQuantity: options.secondIntake.enteredQuantity,
      availableQuantity: options.secondIntake.availableQuantity,
      supplierUnitCostCents: options.secondIntake.supplierUnitCostCents,
      cashPriceCents: options.secondIntake.cashPriceCents ?? 125_000,
      listPriceCents: options.secondIntake.listPriceCents ?? 130_000,
      profitPercentageBasisPoints: options.secondIntake.profitPercentageBasisPoints ?? 1_000,
      intakeDate: options.secondIntake.intakeDate
    });
  }

  const sale = confirmSaleDraft(initialized.database, {
    customer: options.buyerName
      ? {
          name: options.buyerName,
          phoneText: options.phoneText ?? '3510000000'
        }
      : undefined,
    draftItems: [
        {
          reusableProductId: firstIntake.reusableProductId,
          quantity,
          priceType: 'cash',
          personalizationAmountCents: options.personalizationAmountCents,
          personalizationPercentageBasisPoints: options.personalizationPercentageBasisPoints
        }
      ],
    initialPayment: {
        amountCents: ((options.secondIntake?.cashPriceCents ?? (options.secondIntake ? 125_000 : (options.cashPriceCents ?? 120_000))) + personalizationAmountCents) * quantity,
        paymentMethod: 'cash'
      },
    saleDate: options.saleDate ?? '2026-07-16T10:00:00.000Z'
  });

  return {
    product: firstIntake,
    sale,
    saleItemId: sale.items[0]?.saleItemId ?? 0
  };
}

describe('consignments service', () => {
  it('rejects empty selection', () => {
    const initialized = createInitializedAppForTest();

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [],
        liquidationDate: '2026-07-16'
      })
    ).toThrow();

    initialized.database.close();
  });

  it('rejects duplicated ids explicitly', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros repetidos' });

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId, sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/duplicate/i);

    initialized.database.close();
  });

  it('rejects nonexistent items and mixtures of valid plus invalid ids', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros inexistentes' });

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [9999],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/not found/i);

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId, 9999],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/not found/i);

    initialized.database.close();
  });

  it('rejects already settled items', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros liquidados' });

    initialized.database.client
      .prepare("UPDATE sale_items SET consignment_status = 'settled' WHERE id = ?")
      .run(sold.saleItemId);

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/not pending settlement/i);

    initialized.database.close();
  });

  it('rejects already associated items even if status drift exists', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros asociados' });

    initialized.database.client
      .prepare(
        `
          INSERT INTO consignment_batches (batch_number, liquidation_date, total_cents, total_gain_cents, notes, created_at)
          VALUES (1, '2026-07-16', 90000, 30000, NULL, '2026-07-16T11:00:00.000Z')
        `
      )
      .run();
    initialized.database.client
      .prepare(
        `
          INSERT INTO consignment_batch_items (batch_id, sale_item_id, amount_cents, created_at)
          VALUES (1, ?, 90000, '2026-07-16T11:00:00.000Z')
        `
      )
      .run(sold.saleItemId);

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/already associated/i);

    initialized.database.close();
  });

  it('rejects items from cancelled sales', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros cancelados',
      buyerName: 'Ana'
    });

    cancelSale(initialized.database, {
      saleId: sold.sale.saleId,
      reason: 'Cancelled by test'
    });

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/cancelled sale/i);

    initialized.database.close();
  });

  it('calculates settlement totals from historical allocation cost instead of current pricing', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros históricos',
      quantity: 2,
      supplierUnitCostCents: 90_000,
      secondIntake: {
        enteredQuantity: 1,
        availableQuantity: 1,
        intakeDate: '2026-07-10',
        supplierUnitCostCents: 95_000
      }
    });

    initialized.database.client
      .prepare('UPDATE stock_intakes SET supplier_unit_cost_cents = 999999 WHERE reusable_product_id = ?')
      .run(sold.product.reusableProductId);

    const result = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-16'
    });

    expect(result.totalCents).toBe(185_000);

    initialized.database.close();
  });

  it('uses the same profit calculation as sales for pending, confirmed, history, and detail views', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros ganancia compartida',
      supplierUnitCostCents: 90_000
    });

    const saleDetail = getSaleDetail(initialized.database, { saleId: sold.sale.saleId });
    const pending = listPendingConsignmentItems(initialized.database);
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-18'
    });
    const history = listConsignmentBatchHistory(initialized.database)[0];
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(pending[0]?.gainCents).toBe(saleDetail.totalProfitCents);
    expect(batch.totalGainCents).toBe(saleDetail.totalProfitCents);
    expect(history?.totalGainCents).toBe(saleDetail.totalProfitCents);
    expect(detail.totalGainCents).toBe(saleDetail.totalProfitCents);
    expect(detail.items[0]?.gainCents).toBe(saleDetail.totalProfitCents);

    initialized.database.close();
  });

  it('uses sale item profit snapshots for pending selection totals and persisted history', () => {
    const initialized = createInitializedAppForTest();
    const productOnly = seedSoldItem(initialized, {
      name: 'Aros snapshot producto',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 200_000,
      profitPercentageBasisPoints: 3_000
    });
    const withPersonalization = seedSoldItem(initialized, {
      name: 'Aros snapshot personalización',
      supplierUnitCostCents: 50_000,
      cashPriceCents: 140_000,
      profitPercentageBasisPoints: 5_000,
      personalizationAmountCents: 50_000,
      personalizationPercentageBasisPoints: 500
    });
    const third = seedSoldItem(initialized, {
      name: 'Aros snapshot múltiple',
      supplierUnitCostCents: 75_000,
      cashPriceCents: 180_000,
      profitPercentageBasisPoints: 1_000
    });

    initialized.database.client
      .prepare(
        `
          UPDATE stock_intakes
          SET expected_profit_cents = 1,
              personalization_expected_profit_cents = 1,
              profit_percentage_basis_points = 1
        `
      )
      .run();

    const saleDetail = getSaleDetail(initialized.database, { saleId: withPersonalization.sale.saleId });
    const pending = listPendingConsignmentItems(initialized.database);
    const pendingGainById = new Map(pending.map((item) => [item.saleItemId, item.gainCents]));
    const selectedGain =
      (pendingGainById.get(productOnly.saleItemId) ?? 0) +
      (pendingGainById.get(withPersonalization.saleItemId) ?? 0) +
      (pendingGainById.get(third.saleItemId) ?? 0);

    expect(saleDetail.totalProfitCents).toBe(27_500);
    expect(pendingGainById.get(productOnly.saleItemId)).toBe(30_000);
    expect(pendingGainById.get(withPersonalization.saleItemId)).toBe(27_500);
    expect(pendingGainById.get(third.saleItemId)).toBe(7_500);
    expect(selectedGain).toBe(65_000);

    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [productOnly.saleItemId, withPersonalization.saleItemId, third.saleItemId],
      liquidationDate: '2026-07-18'
    });
    const history = listConsignmentBatchHistory(initialized.database)[0];
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(batch.totalGainCents).toBe(65_000);
    expect(history?.totalGainCents).toBe(65_000);
    expect(detail.totalGainCents).toBe(65_000);
    expect(detail.items.map((item) => item.gainCents).sort((left, right) => left - right)).toEqual([
      7_500,
      27_500,
      30_000
    ]);

    const persistedBatch = initialized.database.client
      .prepare('SELECT total_gain_cents AS totalGainCents FROM consignment_batches WHERE id = ?')
      .get(batch.batchId) as { totalGainCents: number };
    expect(persistedBatch.totalGainCents).toBe(65_000);

    initialized.database.close();
  });

  it('keeps mixed-intake historical gains aligned across sales and liquidation surfaces', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros mixtos exactos',
      quantity: 2,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 240_000,
      profitPercentageBasisPoints: 1_000,
      personalizationAmountCents: 10_000,
      personalizationPercentageBasisPoints: 500,
      secondIntake: {
        enteredQuantity: 1,
        availableQuantity: 1,
        intakeDate: '2026-07-10',
        supplierUnitCostCents: 200_000,
        cashPriceCents: 260_000,
        listPriceCents: 265_000,
        profitPercentageBasisPoints: 2_500
      }
    });

    initialized.database.client
      .prepare(
        `
          UPDATE stock_intakes
          SET expected_profit_cents = 1,
              personalization_expected_profit_cents = 1,
              profit_percentage_basis_points = 1
          WHERE reusable_product_id = ?
        `
      )
      .run(sold.product.reusableProductId);

    const saleDetail = getSaleDetail(initialized.database, { saleId: sold.sale.saleId });
    const pending = listPendingConsignmentItems(initialized.database);
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-18'
    });
    const history = listConsignmentBatchHistory(initialized.database)[0];
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(saleDetail.totalProfitCents).toBe(61_000);
    expect(pending[0]?.gainCents).toBe(61_000);
    expect(batch.totalGainCents).toBe(61_000);
    expect(history?.totalGainCents).toBe(61_000);
    expect(detail.totalGainCents).toBe(61_000);
    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        productGainCents: 60_000,
        personalizationGainCents: 1_000,
        gainCents: 61_000
      })
    );

    initialized.database.close();
  });

  it('creates batch associations, updates statuses, writes audit, and serves pending/history/detail reads', () => {
    const initialized = createInitializedAppForTest();
    const first = seedSoldItem(initialized, { name: 'Aros pendientes', buyerName: 'Ana' });
    const second = seedSoldItem(initialized, { name: 'Pulsera pendiente' });

    const pendingBefore = listPendingConsignmentItems(initialized.database);
    expect(pendingBefore).toEqual([
      expect.objectContaining({ saleItemId: second.saleItemId, productName: 'Pulsera pendiente' }),
      expect.objectContaining({ saleItemId: first.saleItemId, productName: 'Aros pendientes', buyerName: 'Ana' })
    ]);

    const result = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [first.saleItemId, second.saleItemId],
      liquidationDate: '2026-07-18',
      notes: 'Primera quincena'
    });

    const statuses = initialized.database.client
      .prepare('SELECT consignment_status AS consignmentStatus FROM sale_items WHERE id IN (?, ?) ORDER BY id ASC')
      .all(first.saleItemId, second.saleItemId) as Array<{ consignmentStatus: string }>;
    expect(statuses).toEqual([
      { consignmentStatus: 'settled' },
      { consignmentStatus: 'settled' }
    ]);

    const associations = initialized.database.client
      .prepare('SELECT sale_item_id AS saleItemId, amount_cents AS amountCents FROM consignment_batch_items WHERE batch_id = ? ORDER BY id ASC')
      .all(result.batchId) as Array<{ saleItemId: number; amountCents: number }>;
    expect(associations).toHaveLength(2);

    const auditRow = initialized.database.client
      .prepare(
        `
          SELECT entity_id AS entityId, detail_json AS detailJson
          FROM audit_logs
          WHERE operation_type = 'consignment_batch_confirmed'
          LIMIT 1
        `
      )
      .get() as { entityId: string; detailJson: string };
    expect(auditRow.entityId).toBe(String(result.batchId));
    expect(JSON.parse(auditRow.detailJson)).toEqual(
      expect.objectContaining({
        batchId: result.batchId,
        batchNumber: result.batchNumber,
        liquidationDate: '2026-07-18',
        saleItemIds: [first.saleItemId, second.saleItemId],
        quantity: 2,
        totalCents: result.totalCents,
        note: 'Primera quincena'
      })
    );

    expect(listPendingConsignmentItems(initialized.database)).toEqual([]);
    expect(listConsignmentBatchHistory(initialized.database)).toEqual([
      expect.objectContaining({ batchNumber: result.batchNumber, itemCount: 2, totalCents: result.totalCents, notes: 'Primera quincena' })
    ]);
    expect(getConsignmentBatchDetail(initialized.database, { batchId: result.batchId })).toEqual(
      expect.objectContaining({
        batchNumber: result.batchNumber,
        itemCount: 2,
        totalCents: result.totalCents,
        items: expect.arrayContaining([
          expect.objectContaining({ productName: 'Aros pendientes', saleNumber: first.sale.saleNumber }),
          expect.objectContaining({ productName: 'Pulsera pendiente', saleNumber: second.sale.saleNumber })
        ])
      })
    );

    initialized.database.close();
  });

  it('maps per-item gain by sale item id instead of batch detail row order', () => {
    const initialized = createInitializedAppForTest();
    const first = seedSoldItem(initialized, {
      name: 'Aros orden cruzado',
      saleDate: '2026-07-16T10:00:00.000Z',
      supplierUnitCostCents: 90_000
    });
    const second = seedSoldItem(initialized, {
      name: 'Pulsera orden cruzado',
      saleDate: '2026-07-18T10:00:00.000Z',
      supplierUnitCostCents: 80_000
    });

    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [first.saleItemId, second.saleItemId],
      liquidationDate: '2026-07-19'
    });
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(detail.items).toEqual([
      expect.objectContaining({ productName: 'Pulsera orden cruzado', gainCents: 8_000 }),
      expect.objectContaining({ productName: 'Aros orden cruzado', gainCents: 9_000 })
    ]);

    initialized.database.close();
  });

  it('keeps pending and settled consignment views on historical snapshots after product and customer edits', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros snapshot liquidación',
      buyerName: 'Ana'
    });

    initialized.database.client
      .prepare(
        `
          UPDATE reusable_products
          SET name = 'Producto editado', category = 'mate', material = 'Acero', variant = 'Otro'
          WHERE id = ?
        `
      )
      .run(sold.product.reusableProductId);
    initialized.database.client
      .prepare("UPDATE customers SET name = 'Ana editada', phone_text = '0000000000' WHERE id = 1")
      .run();

    const pending = listPendingConsignmentItems(initialized.database);
    expect(pending[0]).toEqual(
      expect.objectContaining({
        productName: 'Aros snapshot liquidación',
        buyerName: 'Ana'
      })
    );

    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-18'
    });
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        productName: 'Aros snapshot liquidación',
        buyerName: 'Ana'
      })
    );

    initialized.database.close();
  });

  it('shows a later-assigned walk-in customer in liquidation history detail surfaces', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, {
      name: 'Aros walk-in recuperado'
    });

    assignSaleCustomerForPaymentRecovery(initialized.database, {
      saleId: sold.sale.saleId,
      name: 'Elena',
      phoneText: '3514444444'
    });

    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-18'
    });
    const history = listConsignmentBatchHistory(initialized.database);
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    expect(history[0]).toEqual(expect.objectContaining({ batchId: batch.batchId }));
    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        productName: 'Aros walk-in recuperado',
        buyerName: 'Elena'
      })
    );

    initialized.database.close();
  });

  it('rolls back the whole batch when a later step fails', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros rollback' });

    initialized.database.client.exec(`
      CREATE TRIGGER fail_consignment_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.operation_type = 'consignment_batch_confirmed'
      BEGIN
        SELECT RAISE(FAIL, 'audit failed');
      END;
    `);

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/audit failed/i);

    const batchCount = initialized.database.client
      .prepare('SELECT COUNT(*) AS count FROM consignment_batches')
      .get() as { count: number };
    const statusRow = initialized.database.client
      .prepare('SELECT consignment_status AS consignmentStatus FROM sale_items WHERE id = ?')
      .get(sold.saleItemId) as { consignmentStatus: string };

    expect(batchCount.count).toBe(0);
    expect(statusRow.consignmentStatus).toBe('pending_settlement');

    initialized.database.close();
  });

  it('prevents a stale second connection from settling the same item twice', () => {
    const initialized = createInitializedAppForTest();
    const sold = seedSoldItem(initialized, { name: 'Aros concurrentes' });
    const secondConnection = openSqliteDatabase({
      databaseFilePath: initialized.paths.databaseFilePath
    });

    const pendingFromSecondConnection = listPendingConsignmentItems(secondConnection);
    expect(pendingFromSecondConnection).toHaveLength(1);

    confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sold.saleItemId],
      liquidationDate: '2026-07-16'
    });

    expect(() =>
      confirmConsignmentBatch(secondConnection, {
        saleItemIds: [sold.saleItemId],
        liquidationDate: '2026-07-16'
      })
    ).toThrow(/not pending settlement|already associated/i);

    secondConnection.close();
    initialized.database.close();
  });

  it('generates sequential non-reused batch numbers across success and rollback', () => {
    const initialized = createInitializedAppForTest();
    const first = seedSoldItem(initialized, { name: 'Lote 1' });
    const second = seedSoldItem(initialized, { name: 'Lote 2' });
    const third = seedSoldItem(initialized, { name: 'Lote 3' });

    const firstBatch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [first.saleItemId],
      liquidationDate: '2026-07-16'
    });
    expect(firstBatch.batchNumber).toBe(1);

    initialized.database.client.exec(`
      CREATE TRIGGER fail_consignment_audit_again
      BEFORE INSERT ON audit_logs
      WHEN NEW.operation_type = 'consignment_batch_confirmed'
      BEGIN
        SELECT RAISE(FAIL, 'audit failed again');
      END;
    `);

    expect(() =>
      confirmConsignmentBatch(initialized.database, {
        saleItemIds: [second.saleItemId],
        liquidationDate: '2026-07-17'
      })
    ).toThrow(/audit failed again/i);

    initialized.database.client.exec('DROP TRIGGER fail_consignment_audit_again');

    const thirdBatch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [third.saleItemId],
      liquidationDate: '2026-07-18'
    });

    expect(thirdBatch.batchNumber).toBe(2);

    initialized.database.close();
  });
});
