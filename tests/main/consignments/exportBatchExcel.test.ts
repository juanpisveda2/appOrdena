import { describe, expect, it } from 'vitest';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import { exportConsignmentBatchExcel } from '../../../src/main/reporting/exportConsignmentBatchExcel';
import { confirmConsignmentBatch, getConsignmentBatchDetail } from '../../../src/main/services/consignments/service';
import { confirmSaleDraft } from '../../../src/main/services/sales/service';
import { loadWorkbook, readSheetRows } from '../../support/excelWorkbook';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

describe('exportConsignmentBatchExcel', () => {
  it('exports a single-item liquidation with exact summary and detail parity', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-single-');
    let writtenBuffer: Buffer | null = null;

    const seeded = seedProduct(initialized, {
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000
    });
    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [{ reusableProductId: seeded.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    });
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: null
    });
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    const result = await exportConsignmentBatchExcel(
      initialized.database,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
        }),
        writeFile: (_filePath, contents) => {
          writtenBuffer = Buffer.from(contents);
        }
      },
      { batchId: batch.batchId }
    );

    expect(result).toEqual({
      status: 'saved',
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      generatedAt: expect.any(String),
      filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
    });

    const workbook = await loadWorkbook(writtenBuffer);
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(['Resumen', 'Detalle']);
    expect(readSheetRows(workbook, 'Resumen')).toEqual([
      ['Número de liquidación', 1],
      ['Fecha de liquidación', '20/07/2026'],
      ['Cantidad de artículos', 1],
      ['Ventas incluidas', 1],
      ['Total vendido', 1200],
      ['Total cobrado al cliente', 1200],
      ['Total liquidado al proveedor', 1080],
      ['Ganancia de la liquidación', detail.totalGainCents / 100],
      ['Saldo proveedor después de liquidar', 0]
    ]);

    const detailRows = readSheetRows(workbook, 'Detalle');
    expect(detailRows[1]).toEqual([
      '16/07/2026',
      sale.saleNumber,
      'Aros de plata',
      'Joyas',
      'Ana',
      1200,
      '',
      1200,
      'Pagado',
      'Efectivo: $\u00a01.200,00',
      1080,
      0,
      1080,
      0,
      detail.items[0]!.gainCents / 100,
      '20/07/2026'
    ]);
    expect(detailRows[2]).toEqual([
      'Totales', '', '', '', '', '', '', 1200, '', '', 1080, 0, 1080, 0, detail.totalGainCents / 100, ''
    ]);
    expect(detail.items[0]?.amountCents).toBe(108_000);
    expect(detail.items[0]?.gainCents).toBe(detail.totalGainCents);
    expect(workbook.getWorksheet('Resumen')?.views).toEqual(
      expect.arrayContaining([expect.objectContaining({ state: 'frozen', ySplit: 1, topLeftCell: 'A2' })])
    );
  });

  it('exports multi-item liquidations with personalization and exact financial sums', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-multi-');
    let writtenBuffer: Buffer | null = null;

    const firstProduct = seedProduct(initialized, {
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000
    });
    const secondProduct = seedProduct(initialized, {
      name: 'Mate grabado',
      material: 'Calabaza',
      variant: 'Premium',
      supplierUnitCostCents: 200_000,
      cashPriceCents: 260_000,
      listPriceCents: 270_000,
      profitPercentageBasisPoints: 1_500,
      personalizationAmountCents: 20_000,
      personalizationPercentageBasisPoints: 5_000
    });
    const firstSale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [{ reusableProductId: firstProduct.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    });
    const secondSale = confirmSaleDraft(initialized.database, {
      draftItems: [{
        reusableProductId: secondProduct.reusableProductId,
        quantity: 1,
        priceType: 'cash',
        personalizationAmountCents: 20_000,
        personalizationPercentageBasisPoints: 5_000
      }],
      initialPayment: {
        amountCents: 280_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-17T12:00:00.000Z'
    });
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [firstSale.items[0]!.saleItemId, secondSale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: 'Primera quincena'
    });
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    await exportConsignmentBatchExcel(
      initialized.database,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
        }),
        writeFile: (_filePath, contents) => {
          writtenBuffer = Buffer.from(contents);
        }
      },
      { batchId: batch.batchId }
    );

    const workbook = await loadWorkbook(writtenBuffer);
    const summaryRows = readSheetRows(workbook, 'Resumen');
    expect(summaryRows[2]).toEqual(['Cantidad de artículos', 2]);
    expect(summaryRows[4]).toEqual(['Total vendido', 4000]);
    expect(summaryRows[5]).toEqual(['Total cobrado al cliente', 4000]);
    expect(summaryRows[6]).toEqual(['Total liquidado al proveedor', 3390]);
    expect(summaryRows[7]).toEqual(['Ganancia de la liquidación', detail.totalGainCents / 100]);
    expect(summaryRows[8]).toEqual(['Saldo proveedor después de liquidar', 0]);

    const exportedRows = readSheetRows(workbook, 'Detalle');
    expect(exportedRows[1]).toEqual([
      '17/07/2026',
      secondSale.saleNumber,
      'Mate grabado',
      'Mates',
      'Venta de mostrador',
      2800,
      200,
      2800,
      'Pagado',
      'Efectivo: $\u00a02.800,00',
      2310,
      0,
      2310,
      0,
      detail.items.find((item) => item.productName === 'Mate grabado')!.gainCents / 100,
      '20/07/2026'
    ]);
    expect(exportedRows[2]).toEqual([
      '16/07/2026',
      firstSale.saleNumber,
      'Aros de plata',
      'Joyas',
      'Ana',
      1200,
      '',
      1200,
      'Pagado',
      'Efectivo: $\u00a01.200,00',
      1080,
      0,
      1080,
      0,
      detail.items.find((item) => item.productName === 'Aros de plata')!.gainCents / 100,
      '20/07/2026'
    ]);
    expect(exportedRows[3]).toEqual([
      'Totales', '', '', '', '', '', '', 4000, '', '', 3390, 0, 3390, 0, detail.totalGainCents / 100, ''
    ]);
    expect(detail.totalCents).toBe(339_000);
    expect(detail.totalGainCents).toBe(61_000);
    const personalizedItem = detail.items.find((item) => item.productName === 'Mate grabado');
    expect(personalizedItem?.personalizationCents).toBe(20_000);
    expect(personalizedItem?.personalizationGainCents).toBe(10_000);
  });

  it('supports export right after confirmation and re-export from history detail without current catalog drift', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-history-');
    let writtenBuffer: Buffer | null = null;

    const seeded = seedProduct(initialized, {
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000
    });
    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [{ reusableProductId: seeded.reusableProductId, quantity: 1, priceType: 'cash' }],
      saleDate: '2026-07-16T10:00:00.000Z'
    });
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: null
    });

    initialized.database.client
      .prepare(
        `
          UPDATE reusable_products
          SET name = 'Producto cambiado', material = 'Acero', variant = 'Otro', category = 'mate'
          WHERE id = ?
        `
      )
      .run(seeded.reusableProductId);
    initialized.database.client
      .prepare("UPDATE customers SET name = 'Ana editada', phone_text = '0000000000' WHERE id = 1")
      .run();

    const exportResult = await exportConsignmentBatchExcel(
      initialized.database,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
        }),
        writeFile: (_filePath, contents) => {
          writtenBuffer = Buffer.from(contents);
        }
      },
      { batchId: batch.batchId }
    );
    expect(exportResult.status).toBe('saved');

    const historyDetail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });
    const detailRow = readSheetRows(await loadWorkbook(writtenBuffer), 'Detalle')[1];

    expect(detailRow[2]).toBe(historyDetail.items[0]?.productName);
    expect(detailRow[4]).toBe('Ana');
    expect(detailRow[5]).toBe(historyDetail.items[0]!.unitPriceCents / 100);
    expect(detailRow[7]).toBe(historyDetail.items[0]!.saleTotalCents / 100);
    expect(detailRow[10]).toBe(historyDetail.items[0]!.amountCents / 100);
    expect(detailRow[14]).toBe(historyDetail.items[0]!.gainCents / 100);
  });

  it('exports the corrected mixed-intake historical gains without drifting to current intake values', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-mixed-intake-');
    let writtenBuffer: Buffer | null = null;

    const seeded = seedProduct(initialized, {
      name: 'Aros históricos mixtos',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 240_000,
      listPriceCents: 245_000,
      profitPercentageBasisPoints: 1_000
    });
    saveStockIntake(initialized.database, {
      reusableProductId: seeded.reusableProductId,
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 200_000,
      cashPriceCents: 260_000,
      listPriceCents: 265_000,
      profitPercentageBasisPoints: 2_500,
      intakeDate: '2026-07-15'
    });

    const sale = confirmSaleDraft(initialized.database, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [
        {
          reusableProductId: seeded.reusableProductId,
          quantity: 2,
          priceType: 'cash',
          personalizationAmountCents: 10_000,
          personalizationPercentageBasisPoints: 500
        }
      ],
      initialPayment: {
        amountCents: 540_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
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
      .run(seeded.reusableProductId);

    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: null
    });
    const detail = getConsignmentBatchDetail(initialized.database, { batchId: batch.batchId });

    await exportConsignmentBatchExcel(
      initialized.database,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: 'C:/exports/liquidacion-mixta-2026-07-20.xlsx'
        }),
        writeFile: (_filePath, contents) => {
          writtenBuffer = Buffer.from(contents);
        }
      },
      { batchId: batch.batchId }
    );

    const detailRows = readSheetRows(await loadWorkbook(writtenBuffer), 'Detalle');

    expect(detail.totalGainCents).toBeGreaterThan(0);
    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        amountCents: 450_000,
        gainCents: detail.totalGainCents
      })
    );
    expect(detail.items[0]!.productGainCents + detail.items[0]!.personalizationGainCents).toBe(detail.items[0]!.gainCents);
    expect(detailRows[1]).toEqual([
      '16/07/2026',
      sale.saleNumber,
      'Aros históricos mixtos',
      'Joyas',
      'Ana',
      2700,
      200,
      5400,
      'Pagado',
      'Efectivo: $\u00a05.400,00',
      4500,
      0,
      4500,
      0,
      detail.items[0]!.gainCents / 100,
      '20/07/2026'
    ]);
    expect(detailRows[2]).toEqual([
      'Totales', '', '', '', '', '', '', 5400, '', '', 4500, 0, 4500, 0, detail.totalGainCents / 100, ''
    ]);
  });

  it('returns cancelled without writing when save is dismissed', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-cancel-');
    let written = false;

    const seeded = seedProduct(initialized, {
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000
    });
    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [{ reusableProductId: seeded.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    });
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: null
    });

    const result = await exportConsignmentBatchExcel(
      initialized.database,
      {
        showSaveDialog: async () => ({ canceled: true }),
        writeFile: () => {
          written = true;
        }
      },
      { batchId: batch.batchId }
    );

    expect(result).toEqual({
      status: 'cancelled',
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      generatedAt: expect.any(String)
    });
    expect(written).toBe(false);
  });

  it('surfaces write failures and skips audit persistence when saving fails', async () => {
    const initialized = createInitializedApp('project-mama-consignment-export-write-failure-');
    const readExportAuditCount = () =>
      (initialized.database.client
        .prepare("SELECT COUNT(*) as count FROM audit_logs WHERE operation_type = 'consignment_batch_excel_exported'")
        .get() as { count: number }).count;

    const seeded = seedProduct(initialized, {
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm',
      supplierUnitCostCents: 100_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000
    });
    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [{ reusableProductId: seeded.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 120_000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    });
    const batch = confirmConsignmentBatch(initialized.database, {
      saleItemIds: [sale.items[0]!.saleItemId],
      liquidationDate: '2026-07-20',
      notes: null
    });
    const exportAuditCountBefore = readExportAuditCount();

    await expect(
      exportConsignmentBatchExcel(
        initialized.database,
        {
          showSaveDialog: async () => ({
            canceled: false,
            filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
          }),
          writeFile: () => {
            throw new Error('Disk full');
          }
        },
        { batchId: batch.batchId }
      )
    ).rejects.toThrow('Disk full');

    expect(readExportAuditCount()).toBe(exportAuditCountBefore);
  });
});

function seedProduct(
  initialized: ReturnType<typeof createInitializedApp>,
  input: {
    name: string;
    material: string;
    variant: string;
    supplierUnitCostCents: number;
    cashPriceCents: number;
    listPriceCents: number;
    profitPercentageBasisPoints: number;
    personalizationAmountCents?: number | null;
    personalizationPercentageBasisPoints?: number | null;
  }
): { reusableProductId: number } {
  const saved = saveStockIntake(initialized.database, {
    newReusableProduct: {
      category: input.name.includes('Mate') ? 'mate' : 'jewelry',
      name: input.name,
      material: input.material,
      variant: input.variant
    },
    enteredQuantity: 1,
    availableQuantity: 1,
    supplierUnitCostCents: input.supplierUnitCostCents,
    cashPriceCents: input.cashPriceCents,
    listPriceCents: input.listPriceCents,
    profitPercentageBasisPoints: input.profitPercentageBasisPoints,
    intakeDate: '2026-07-14'
  });

  if (saved.kind !== 'saved') {
    throw new Error('Expected stock intake to be saved.');
  }

  if (input.personalizationAmountCents != null) {
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
        input.personalizationAmountCents,
        input.personalizationPercentageBasisPoints ?? 500,
        Math.round(input.personalizationAmountCents * ((input.personalizationPercentageBasisPoints ?? 500) / 10_000)),
        saved.stockIntakeId
      );
  }

  return { reusableProductId: saved.reusableProductId };
}
