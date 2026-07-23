import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showSaveDialog: vi.fn()
  }
}));
import {
  APP_HEALTH_CHANNEL,
  APP_HEALTH_REQUEST,
  CATALOG_DELETE_PRODUCT_CHANNEL,
  CATALOG_LIST_CHANNEL,
  CATALOG_PRODUCT_DETAIL_CHANNEL,
  CATALOG_SEARCH_CHANNEL,
  CONSIGNMENTS_CONFIRM_BATCH_CHANNEL,
  CONSIGNMENTS_DETAIL_CHANNEL,
  CONSIGNMENTS_EXPORT_EXCEL_CHANNEL,
  CONSIGNMENTS_HISTORY_LIST_CHANNEL,
  CONSIGNMENTS_PENDING_LIST_CHANNEL,
  SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL,
  SALES_CANCEL_CHANNEL,
  SALES_CANCEL_PAYMENT_CHANNEL,
  SALES_CONFIRM_DRAFT_CHANNEL,
  SALES_DETAIL_CHANNEL,
  SALES_HISTORY_LIST_CHANNEL,
  SALES_REGISTER_PAYMENT_CHANNEL,
  STOCK_SAVE_INTAKE_CHANNEL
} from '../../../src/shared/contracts/app';
import { registerIpc } from '../../../src/main/ipc/registerIpc';
import type { IpcMainLike } from '../../../src/main/ipc/registerValidatedIpc';
import { loadWorkbook } from '../../support/excelWorkbook';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

function createInitializedAppForTest() {
  return createInitializedApp('project-mama-ipc-');
}

describe('registerIpc', () => {
  it('registers and serves the catalog stock bridge channels against the main database', async () => {
    const initialized = createInitializedAppForTest();
    const handlers = new Map<string, (event: unknown, payload: unknown) => unknown>();
    const ipcMainLike: IpcMainLike = {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      }
    };
    let writtenBuffer: Buffer | null = null;

    registerIpc({
      bootstrapState: initialized.state,
      database: initialized.database,
      getAppVersion: () => '0.1.0',
      ipcMainLike,
      showConsignmentExportSaveDialog: async () => ({
        canceled: false,
        filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
      }),
      writeConsignmentExportFile: (_filePath, contents) => {
        writtenBuffer = Buffer.from(contents);
      }
    });

    expect(await handlers.get(APP_HEALTH_CHANNEL)?.({}, APP_HEALTH_REQUEST)).toEqual({
      ok: true,
      appVersion: '0.1.0',
      runtime: 'desktop-foundation',
      dbReady: true,
      schemaVersion: 8
    });

    expect(
      await handlers.get(STOCK_SAVE_INTAKE_CHANNEL)?.({}, {
        newReusableProduct: {
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm'
        },
        enteredQuantity: 2,
        availableQuantity: 2,
        supplierUnitCostCents: 100_000,
        cashPriceCents: 120_000,
        listPriceCents: 125_000,
        profitPercentageBasisPoints: 1_000,
        intakeDate: '2026-07-14'
      })
    ).toEqual({
      kind: 'saved',
      stockIntakeId: 1,
      reusableProductId: 1
    });

    expect(await handlers.get(CATALOG_SEARCH_CHANNEL)?.({}, { query: 'aros plata', limit: 5 })).toEqual([
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 2,
        isOutOfStock: false
      }
    ]);

    expect(await handlers.get(CATALOG_LIST_CHANNEL)?.({}, { category: 'all' })).toEqual({
      recentProducts: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 2,
          isOutOfStock: false,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000
        }
      ],
      products: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 2,
          isOutOfStock: false,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000
        }
      ]
    });

    expect(
      await handlers.get(CATALOG_PRODUCT_DETAIL_CHANNEL)?.({}, { reusableProductId: 1 })
    ).toEqual({
      reusableProductId: 1,
      category: 'jewelry',
      name: 'Aros de plata',
      description: null,
      material: 'Plata',
      variant: '18 mm',
      availableQuantity: 2,
      currentCashPriceCents: 120000,
      currentListPriceCents: 125000,
      currentProfitPercentageBasisPoints: 1000,
      currentExpectedProfitCents: 10000,
      currentPersonalizationExpectedProfitCents: null,
      currentTotalExpectedProfitCents: 10000,
      recentIntakes: [
        {
          stockIntakeId: 1,
          enteredQuantity: 2,
          availableQuantity: 2,
          supplierUnitCostCents: 100000,
          cashPriceCents: 120000,
          listPriceCents: 125000,
          profitPercentageBasisPoints: 1000,
          expectedProfitCents: 10000,
          personalizationAmountCents: null,
          personalizationPercentageBasisPoints: null,
          personalizationExpectedProfitCents: null,
          totalExpectedProfitCents: 10000,
          intakeDate: '2026-07-14',
          notes: null
        }
      ]
    });

    expect(await handlers.get(SALES_HISTORY_LIST_CHANNEL)?.({}, { query: 'Ana', limit: 10 })).toEqual([]);

    const confirmedSale = (await handlers.get(SALES_CONFIRM_DRAFT_CHANNEL)?.({}, {
      customer: {
        name: 'Ana',
        phoneText: '3510000000'
      },
      draftItems: [
        {
          reusableProductId: 1,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 20000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T10:00:00.000Z'
    })) as {
      saleId: number;
      saleNumber: number;
      status: string;
      balanceCents: number;
      payments: Array<{ paymentId: number }>;
    };

    expect(confirmedSale.status).toBe('partial_payment');
    expect(confirmedSale.balanceCents).toBe(100000);

    expect(await handlers.get(SALES_HISTORY_LIST_CHANNEL)?.({}, { query: 'Ana', limit: 10 })).toEqual([
      expect.objectContaining({
        saleId: confirmedSale.saleId,
        saleNumber: confirmedSale.saleNumber,
        customerName: 'Ana',
        customerPhoneText: '3510000000'
      })
    ]);

    expect(await handlers.get(SALES_DETAIL_CHANNEL)?.({}, { saleId: confirmedSale.saleId })).toEqual(
      expect.objectContaining({ saleId: confirmedSale.saleId, saleNumber: confirmedSale.saleNumber })
    );

    const paidSale = (await handlers.get(SALES_REGISTER_PAYMENT_CHANNEL)?.({}, {
      saleId: confirmedSale.saleId,
      amountCents: 100000,
      paymentMethod: 'bank_transfer'
    })) as { status: string; balanceCents: number; payments: Array<{ paymentId: number }> };

    expect(paidSale.status).toBe('paid');
    expect(paidSale.balanceCents).toBe(0);

    const recoveredWalkInSale = (await handlers.get(SALES_CONFIRM_DRAFT_CHANNEL)?.({}, {
      draftItems: [
        {
          reusableProductId: 1,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 120000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-16T12:00:00.000Z'
    })) as { saleId: number; customer: { customerId: number | null }; payments: Array<{ paymentId: number }> };

    const recoveredWithCustomer = (await handlers.get(SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL)?.({}, {
      saleId: recoveredWalkInSale.saleId,
      name: 'Elena',
      phoneText: '3514444444'
    })) as { customer: { name: string | null; phoneText: string | null } };

    expect(recoveredWithCustomer.customer.name).toBe('Elena');
    expect(recoveredWithCustomer.customer.phoneText).toBe('3514444444');

    const reopenedSale = (await handlers.get(SALES_CANCEL_PAYMENT_CHANNEL)?.({}, {
      saleId: confirmedSale.saleId,
      paymentId: paidSale.payments[1]?.paymentId,
      reason: 'Correction'
    })) as { status: string; balanceCents: number };

    expect(reopenedSale.status).toBe('partial_payment');
    expect(reopenedSale.balanceCents).toBe(100000);

    const recoveredReopenedSale = (await handlers.get(SALES_CANCEL_PAYMENT_CHANNEL)?.({}, {
      saleId: recoveredWalkInSale.saleId,
      paymentId: recoveredWalkInSale.payments[0]?.paymentId,
      reason: 'Correction'
    })) as { status: string; balanceCents: number; customer: { name: string | null } };

    expect(recoveredReopenedSale.status).toBe('pending_payment');
    expect(recoveredReopenedSale.balanceCents).toBe(120000);
    expect(recoveredReopenedSale.customer.name).toBe('Elena');

    const cancelledSale = (await handlers.get(SALES_CANCEL_CHANNEL)?.({}, {
      saleId: confirmedSale.saleId,
      reason: 'Customer changed mind'
    })) as { status: string; cancellationReason: string | null };

    expect(cancelledSale.status).toBe('cancelled');
    expect(cancelledSale.cancellationReason).toBe('Customer changed mind');

    expect(await handlers.get(CONSIGNMENTS_PENDING_LIST_CHANNEL)?.({}, {})).toEqual([
      expect.objectContaining({ productName: 'Aros de plata', saleNumber: 2 })
    ]);

    await handlers.get(STOCK_SAVE_INTAKE_CHANNEL)?.({}, {
      reusableProductId: 1,
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 90000,
      cashPriceCents: 120000,
      listPriceCents: 125000,
      profitPercentageBasisPoints: 1000,
      intakeDate: '2026-07-17'
    });

    const consignmentSale = (await handlers.get(SALES_CONFIRM_DRAFT_CHANNEL)?.({}, {
      draftItems: [
        {
          reusableProductId: 1,
          quantity: 1,
          priceType: 'cash'
        }
      ],
      initialPayment: {
        amountCents: 120000,
        paymentMethod: 'cash'
      },
      saleDate: '2026-07-17T10:00:00.000Z'
    })) as { items: Array<{ saleItemId: number }> };

    const pendingConsignments = (await handlers.get(CONSIGNMENTS_PENDING_LIST_CHANNEL)?.({}, {})) as Array<{
      saleItemId: number;
      productName: string;
    }>;
    expect(pendingConsignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ saleItemId: consignmentSale.items[0]?.saleItemId, productName: 'Aros de plata' })
    ]));

    const confirmedBatch = (await handlers.get(CONSIGNMENTS_CONFIRM_BATCH_CHANNEL)?.({}, {
      saleItemIds: [consignmentSale.items[0]?.saleItemId],
      liquidationDate: '2026-07-20',
      notes: 'Primera quincena'
    })) as { batchId: number; batchNumber: number; itemCount: number };
    expect(confirmedBatch.batchNumber).toBe(1);
    expect(confirmedBatch.itemCount).toBe(1);

    expect(await handlers.get(CONSIGNMENTS_HISTORY_LIST_CHANNEL)?.({}, {})).toEqual([
      expect.objectContaining({ batchId: confirmedBatch.batchId, batchNumber: 1, itemCount: 1 })
    ]);

    expect(await handlers.get(CONSIGNMENTS_DETAIL_CHANNEL)?.({}, { batchId: confirmedBatch.batchId })).toEqual(
      expect.objectContaining({
        batchId: confirmedBatch.batchId,
        batchNumber: 1,
        items: [expect.objectContaining({ productName: 'Aros de plata' })]
      })
    );

    expect(await handlers.get(CATALOG_DELETE_PRODUCT_CHANNEL)?.({}, { reusableProductId: 1 })).toEqual({
      reusableProductId: 1
    });

    expect(await handlers.get(CONSIGNMENTS_EXPORT_EXCEL_CHANNEL)?.({}, { batchId: confirmedBatch.batchId })).toEqual({
      status: 'saved',
      batchId: confirmedBatch.batchId,
      batchNumber: 1,
      generatedAt: expect.any(String),
      filePath: 'C:/exports/liquidacion-1-2026-07-20.xlsx'
    });

    const workbook = await loadWorkbook(writtenBuffer);
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(['Summary', 'Detail']);

    initialized.database.close();
  });
});
