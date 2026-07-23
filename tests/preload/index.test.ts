import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_HEALTH_CHANNEL,
  APP_HEALTH_REQUEST,
  CATALOG_DELETE_PRODUCT_CHANNEL,
  CATALOG_LIST_CHANNEL,
  CATALOG_PRODUCT_DETAIL_CHANNEL,
  CATALOG_SEARCH_CHANNEL,
  CATALOG_UPDATE_PRODUCT_CHANNEL,
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
  STOCK_SAVE_INTAKE_CHANNEL,
  type AppBridge,
  type AppHealthResponse
} from '../../src/shared/contracts/app';
import type {
  ConfirmConsignmentBatchRequest,
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ExportConsignmentBatchExcelRequest,
  ExportConsignmentBatchExcelResult,
  ConsignmentBatchHistoryListItem,
  GetConsignmentBatchDetailRequest,
  ListConsignmentBatchHistoryRequest,
  ListPendingConsignmentItemsRequest,
  PendingConsignmentItem
} from '../../src/shared/contracts/consignments';
import type {
  AssignSaleCustomerForPaymentRecoveryRequest,
  CancelSalePaymentRequest,
  CancelSaleRequest,
  ConfirmSaleDraftRequest,
  GetSaleDetailRequest,
  ListSalesHistoryRequest,
  RegisterSalePaymentRequest,
  SaleSnapshot,
  SalesHistoryListItem
} from '../../src/shared/contracts/sales';
import type { CatalogListResult, CatalogProductDetail, CatalogSearchResult, SaveStockIntakeResult } from '../../src/shared/contracts/catalog';

const exposeInMainWorld = vi.fn();
const invoke = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke
  }
}));

describe('preload app bridge', () => {
  beforeEach(() => {
    exposeInMainWorld.mockReset();
    invoke.mockReset();
    vi.resetModules();
  });

  it('wires window.app health, catalog list/detail/search, and stock save methods through the preload bridge', async () => {
    const healthResponse: AppHealthResponse = {
      ok: true,
      appVersion: '0.1.0',
      runtime: 'desktop-foundation',
      dbReady: true,
      schemaVersion: 5
    };
    const searchResponse: CatalogSearchResult[] = [
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ];
    const listResponse: CatalogListResult = {
      recentProducts: [],
      products: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 0,
          isOutOfStock: true,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000
        }
      ]
    };
    const detailResponse: CatalogProductDetail = {
      reusableProductId: 1,
      category: 'jewelry',
      name: 'Aros de plata',
      description: null,
      material: 'Plata',
      variant: '18 mm',
      availableQuantity: 0,
      currentCashPriceCents: 120000,
      currentListPriceCents: 125000,
      currentProfitPercentageBasisPoints: 1000,
      currentExpectedProfitCents: 10000,
      currentPersonalizationExpectedProfitCents: null,
      currentTotalExpectedProfitCents: 10000,
      recentIntakes: []
    };
    const saveResponse: SaveStockIntakeResult = {
      kind: 'saved',
      stockIntakeId: 2,
      reusableProductId: 1
    };
    const saleResponse: SaleSnapshot = {
      saleId: 7,
      saleNumber: 12,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'partial_payment',
      totalCents: 120000,
      paidCents: 20000,
      balanceCents: 100000,
      cancellationReason: null,
      customer: {
        customerId: 1,
        name: 'Ana',
        phoneText: '3510000000',
        note: null
      },
      items: [],
      payments: [],
      totalProfitCents: 30000,
      canRegisterPayment: true,
      canCancelSale: true
    };
    const historyResponse: SalesHistoryListItem[] = [
      {
        saleId: 7,
        saleNumber: 12,
        saleDate: '2026-07-16T10:00:00.000Z',
        status: 'partial_payment',
        totalCents: 120000,
        paidCents: 20000,
        balanceCents: 100000,
        customerName: 'Ana',
        customerPhoneText: '3510000000',
        totalProfitCents: 30000
      }
    ];
    const pendingConsignmentsResponse: PendingConsignmentItem[] = [
      {
        saleItemId: 10,
        productName: 'Aros de plata',
        saleNumber: 12,
        saleDate: '2026-07-16T10:00:00.000Z',
      buyerName: 'Ana',
      amountCents: 90000,
      gainCents: 30000
      }
    ];
    const confirmConsignmentResponse: ConfirmConsignmentBatchResult = {
      batchId: 3,
      batchNumber: 18,
      liquidationDate: '2026-07-20',
      itemCount: 1,
      totalCents: 90000,
      totalGainCents: 30000,
      notes: null,
      createdAt: '2026-07-20T10:00:00.000Z'
    };
    const consignmentHistoryResponse: ConsignmentBatchHistoryListItem[] = [
      {
        batchId: 3,
        batchNumber: 18,
        liquidationDate: '2026-07-20',
        itemCount: 1,
        totalCents: 90000,
        totalGainCents: 30000,
        notes: null,
        createdAt: '2026-07-20T10:00:00.000Z'
      }
    ];
    const consignmentDetailResponse: ConsignmentBatchDetail = {
      batchId: 3,
      batchNumber: 18,
      liquidationDate: '2026-07-20',
      itemCount: 1,
      totalCents: 90000,
      totalGainCents: 30000,
      notes: null,
      createdAt: '2026-07-20T10:00:00.000Z',
      items: [
        {
          productName: 'Aros de plata',
          category: 'jewelry',
          material: 'Plata',
          variant: '18 mm',
          saleNumber: 12,
          saleDate: '2026-07-16T10:00:00.000Z',
          buyerName: 'Ana',
          unitPriceCents: 120000,
          personalizationCents: null,
          saleTotalCents: 120000,
          amountCents: 90000,
          productGainCents: 30000,
          personalizationGainCents: 0,
          gainCents: 30000,
          liquidationDate: '2026-07-20'
        }
      ]
    };
    const exportBatchResponse: ExportConsignmentBatchExcelResult = {
      status: 'saved',
      batchId: 3,
      batchNumber: 18,
      generatedAt: '2026-07-21T15:30:00.000Z',
      filePath: 'C:/exports/liquidacion-18-2026-07-20.xlsx'
    };

    invoke
      .mockResolvedValueOnce(healthResponse)
      .mockResolvedValueOnce(listResponse)
      .mockResolvedValueOnce(detailResponse)
      .mockResolvedValueOnce(searchResponse)
      .mockResolvedValueOnce({ reusableProductId: 1 })
      .mockResolvedValueOnce({ reusableProductId: 1 })
      .mockResolvedValueOnce(saveResponse)
      .mockResolvedValueOnce(historyResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(saleResponse)
      .mockResolvedValueOnce(pendingConsignmentsResponse)
      .mockResolvedValueOnce(confirmConsignmentResponse)
      .mockResolvedValueOnce(consignmentHistoryResponse)
      .mockResolvedValueOnce(consignmentDetailResponse)
      .mockResolvedValueOnce(exportBatchResponse);

    await import('../../src/preload/index');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(exposeInMainWorld).toHaveBeenCalledWith('app', expect.any(Object));

    const bridge = exposeInMainWorld.mock.calls[0][1] as AppBridge;

    expect(Object.keys(bridge)).toEqual(['health', 'catalog', 'stock', 'sales', 'consignments']);
    await expect(bridge.health()).resolves.toEqual(healthResponse);
    expect(invoke).toHaveBeenCalledWith(APP_HEALTH_CHANNEL, APP_HEALTH_REQUEST);

    await expect(bridge.catalog.list({ category: 'all' })).resolves.toEqual(listResponse);
    expect(invoke).toHaveBeenCalledWith(CATALOG_LIST_CHANNEL, { category: 'all' });

    await expect(bridge.catalog.getProductDetail({ reusableProductId: 1 })).resolves.toEqual(
      detailResponse
    );
    expect(invoke).toHaveBeenCalledWith(CATALOG_PRODUCT_DETAIL_CHANNEL, { reusableProductId: 1 });

    await expect(bridge.catalog.search({ query: 'aros plata', limit: 5 })).resolves.toEqual(
      searchResponse
    );
    expect(invoke).toHaveBeenCalledWith(CATALOG_SEARCH_CHANNEL, { query: 'aros plata', limit: 5 });

    await expect(
      bridge.catalog.updateProduct({
        reusableProductId: 1,
        product: {
          category: 'jewelry',
          name: 'Aros de plata',
          description: null,
          material: 'Plata',
          variant: '18 mm'
        }
      })
    ).resolves.toEqual({ reusableProductId: 1 });
    expect(invoke).toHaveBeenCalledWith(CATALOG_UPDATE_PRODUCT_CHANNEL, {
      reusableProductId: 1,
      product: {
        category: 'jewelry',
        name: 'Aros de plata',
        description: null,
        material: 'Plata',
        variant: '18 mm'
      }
    });

    await expect(bridge.catalog.deleteProduct({ reusableProductId: 1 })).resolves.toEqual({ reusableProductId: 1 });
    expect(invoke).toHaveBeenCalledWith(CATALOG_DELETE_PRODUCT_CHANNEL, { reusableProductId: 1 });

    await expect(
      bridge.stock.saveIntake({
        reusableProductId: 1,
        enteredQuantity: 1,
        availableQuantity: 1,
        supplierUnitCostCents: 100_000,
        cashPriceCents: 110_000,
        listPriceCents: 120_000,
        profitPercentageBasisPoints: 1_000,
        intakeDate: '2026-07-14'
      })
    ).resolves.toEqual(saveResponse);
    expect(invoke).toHaveBeenCalledWith(STOCK_SAVE_INTAKE_CHANNEL, {
      reusableProductId: 1,
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 100_000,
      cashPriceCents: 110_000,
      listPriceCents: 120_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    const historyRequest: ListSalesHistoryRequest = {
      query: 'Ana',
      limit: 10
    };
    await expect(bridge.sales.listHistory(historyRequest)).resolves.toEqual(historyResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_HISTORY_LIST_CHANNEL, historyRequest);

    const getSaleRequest: GetSaleDetailRequest = {
      saleId: 7
    };
    await expect(bridge.sales.getById(getSaleRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_DETAIL_CHANNEL, getSaleRequest);

    const confirmRequest: ConfirmSaleDraftRequest = {
      draftItems: [{ reusableProductId: 1, quantity: 1, priceType: 'cash' }]
    };
    await expect(bridge.sales.confirmDraft(confirmRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_CONFIRM_DRAFT_CHANNEL, confirmRequest);

    const paymentRequest: RegisterSalePaymentRequest = {
      saleId: 7,
      amountCents: 10000,
      paymentMethod: 'cash'
    };
    await expect(bridge.sales.registerPayment(paymentRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_REGISTER_PAYMENT_CHANNEL, paymentRequest);

    const cancelPaymentRequest: CancelSalePaymentRequest = {
      saleId: 7,
      paymentId: 2,
      reason: 'Correction'
    };
    await expect(bridge.sales.cancelPayment(cancelPaymentRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_CANCEL_PAYMENT_CHANNEL, cancelPaymentRequest);

    const assignCustomerRequest: AssignSaleCustomerForPaymentRecoveryRequest = {
      saleId: 7,
      name: 'Elena',
      phoneText: '3514444444'
    };
    await expect(bridge.sales.assignCustomerForPaymentRecovery(assignCustomerRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(
      SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL,
      assignCustomerRequest
    );

    const cancelSaleRequest: CancelSaleRequest = {
      saleId: 7,
      reason: 'Customer changed mind'
    };
    await expect(bridge.sales.cancelSale(cancelSaleRequest)).resolves.toEqual(saleResponse);
    expect(invoke).toHaveBeenCalledWith(SALES_CANCEL_CHANNEL, cancelSaleRequest);

    const pendingConsignmentsRequest: ListPendingConsignmentItemsRequest = {};
    await expect(bridge.consignments.listPendingItems(pendingConsignmentsRequest)).resolves.toEqual(
      pendingConsignmentsResponse
    );
    expect(invoke).toHaveBeenCalledWith(CONSIGNMENTS_PENDING_LIST_CHANNEL, pendingConsignmentsRequest);

    const confirmConsignmentRequest: ConfirmConsignmentBatchRequest = {
      saleItemIds: [10],
      liquidationDate: '2026-07-20',
      notes: null
    };
    await expect(bridge.consignments.confirmBatch(confirmConsignmentRequest)).resolves.toEqual(
      confirmConsignmentResponse
    );
    expect(invoke).toHaveBeenCalledWith(CONSIGNMENTS_CONFIRM_BATCH_CHANNEL, confirmConsignmentRequest);

    const consignmentHistoryRequest: ListConsignmentBatchHistoryRequest = {};
    await expect(bridge.consignments.listBatchHistory(consignmentHistoryRequest)).resolves.toEqual(
      consignmentHistoryResponse
    );
    expect(invoke).toHaveBeenCalledWith(CONSIGNMENTS_HISTORY_LIST_CHANNEL, consignmentHistoryRequest);

    const consignmentDetailRequest: GetConsignmentBatchDetailRequest = {
      batchId: 3
    };
    await expect(bridge.consignments.getBatchDetail(consignmentDetailRequest)).resolves.toEqual(
      consignmentDetailResponse
    );
    expect(invoke).toHaveBeenCalledWith(CONSIGNMENTS_DETAIL_CHANNEL, consignmentDetailRequest);

    const exportBatchRequest: ExportConsignmentBatchExcelRequest = {
      batchId: 3
    };
    await expect(bridge.consignments.exportBatchExcel(exportBatchRequest)).resolves.toEqual(exportBatchResponse);
    expect(invoke).toHaveBeenCalledWith(CONSIGNMENTS_EXPORT_EXCEL_CHANNEL, exportBatchRequest);
  });
});
