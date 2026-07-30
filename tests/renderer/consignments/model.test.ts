import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import {
  buildConfirmConsignmentBatchRequest,
  createConsignmentActions,
  createInitialConsignmentsState,
  getSelectablePendingIds,
  getCurrentBusinessDate,
  summarizeSelection,
  toggleAllPendingSelections,
  togglePendingSelection,
  type ConsignmentsState
} from '../../../src/renderer/features/consignments/model';

function createHarness(initialState = createInitialConsignmentsState()) {
  let state = initialState;
  const setState = (update: ConsignmentsState | ((current: ConsignmentsState) => ConsignmentsState)) => {
    state = typeof update === 'function' ? update(state) : update;
  };

  return {
    getState: () => state,
    setState
  };
}

function createBridge(overrides?: Partial<AppBridge>): AppBridge {
  return {
    health: overrides?.health ?? vi.fn(),
    catalog: overrides?.catalog ?? {
      list: vi.fn(),
      search: vi.fn(),
      getProductDetail: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn()
    },
    stock: overrides?.stock ?? {
      saveIntake: vi.fn()
    },
    sales: overrides?.sales ?? {
      listHistory: vi.fn(),
      getById: vi.fn(),
      confirmDraft: vi.fn(),
      registerPayment: vi.fn(),
      cancelPayment: vi.fn(),
      assignCustomerForPaymentRecovery: vi.fn(),
      cancelSale: vi.fn()
    },
    consignments: overrides?.consignments ?? {
      listPendingItems: vi.fn(),
      confirmBatch: vi.fn(),
      listBatchHistory: vi.fn(),
      getBatchDetail: vi.fn(),
      exportBatchExcel: vi.fn()
    }
  };
}

describe('consignments renderer model', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads pending items, supports multi-select, and updates count plus total', async () => {
    const bridge = createBridge({
      consignments: {
        listPendingItems: vi.fn().mockResolvedValue([
          {
            saleItemId: 10,
            productName: 'Aros de plata',
            saleNumber: 12,
            saleDate: '2026-07-16T10:00:00.000Z',
            buyerName: 'Ana',
            amountCents: 90000,
            gainCents: 30000
          },
          {
            saleItemId: 11,
            productName: 'Pulsera de plata',
            saleNumber: 13,
            saleDate: '2026-07-17T10:00:00.000Z',
            buyerName: null,
            amountCents: 80000,
            gainCents: 20000
          }
        ]),
        confirmBatch: vi.fn(),
        listBatchHistory: vi.fn(),
        getBatchDetail: vi.fn(),
        exportBatchExcel: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createConsignmentActions({ bridge, ...harness });

    await actions.loadPending();

    expect(harness.getState().pendingItems).toHaveLength(2);
    expect(summarizeSelection(harness.getState())).toMatchObject({
      count: 0,
      totalCents: 0,
      remainingCents: 0,
      totalGainCents: 0
    });

    actions.toggleSelection(10);
    actions.toggleSelection(11);

    expect(togglePendingSelection([10], 10)).toEqual([]);
    expect(getSelectablePendingIds(harness.getState().pendingItems)).toEqual([10, 11]);
    expect(toggleAllPendingSelections([], harness.getState().pendingItems)).toEqual([10, 11]);
    expect(toggleAllPendingSelections([10, 11], harness.getState().pendingItems)).toEqual([]);
    expect(summarizeSelection(harness.getState())).toMatchObject({
      count: 2,
      totalCents: 170000,
      remainingCents: 170000,
      totalGainCents: 50000
    });
  });

  it('keeps selection gain aligned with the current liquidation batch instead of repeating the full historical gain', () => {
    const state = createInitialConsignmentsState();
    state.pendingItems = [
      {
        saleItemId: 10,
        saleId: 5,
        productName: 'Aros parciales',
        saleNumber: 12,
        saleDate: '2026-07-16T10:00:00.000Z',
        buyerName: 'Ana',
        saleStatus: 'partial_payment',
        salePaidCents: 20_000,
        saleBalanceCents: 100_000,
        amountCents: 90_000,
        liquidatedPreviouslyCents: 0,
        gainCents: 2_000
      }
    ];
    state.selectedIds = [10];

    expect(summarizeSelection(state)).toMatchObject({
      count: 1,
      totalCents: 20_000,
      remainingCents: 90_000,
      totalGainCents: 2_000,
      items: [
        expect.objectContaining({
          amountDueNowCents: 20_000,
          remainingBalanceCents: 90_000,
          gainCents: 2_000
        })
      ]
    });
  });

  it('disables confirmation semantics with no selection and builds the confirmation request with optional notes', () => {
    const emptyState = createInitialConsignmentsState();

    expect(() => buildConfirmConsignmentBatchRequest(emptyState)).toThrow(/seleccioná/i);

    const state = createInitialConsignmentsState();
    state.selectedIds = [10, 11];
    state.notes = ' Primera quincena ';

    expect(buildConfirmConsignmentBatchRequest(state)).toEqual({
      saleItemIds: [10, 11],
      liquidationDate: state.liquidationDate,
      notes: 'Primera quincena'
    });
  });

  it('derives the default liquidation date from the Argentina business day at UTC boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T02:30:00.000Z'));

    expect(getCurrentBusinessDate()).toBe('2026-07-17');
    expect(createInitialConsignmentsState().liquidationDate).toBe('2026-07-17');
  });

  it('runs the confirmation flow, refreshes pending data after success, loads history, and opens batch detail', async () => {
    const listPendingItems = vi
      .fn()
      .mockResolvedValueOnce([
        {
          saleItemId: 10,
          productName: 'Aros de plata',
          saleNumber: 12,
          saleDate: '2026-07-16T10:00:00.000Z',
          buyerName: 'Ana',
          amountCents: 90000,
          gainCents: 30000
        }
      ])
      .mockResolvedValueOnce([]);
    const listBatchHistory = vi.fn().mockResolvedValue([
      {
        batchId: 4,
        batchNumber: 22,
        liquidationDate: '2026-07-20',
        itemCount: 1,
        totalCents: 90000,
        totalGainCents: 30000,
        remainingCents: 0,
        notes: 'Primera quincena',
        createdAt: '2026-07-20T12:00:00.000Z'
      }
    ]);
    const getBatchDetail = vi.fn().mockResolvedValue({
      batchId: 4,
      batchNumber: 22,
      liquidationDate: '2026-07-20',
      itemCount: 1,
      totalCents: 90000,
      totalGainCents: 30000,
      remainingCents: 0,
      notes: 'Primera quincena',
      createdAt: '2026-07-20T12:00:00.000Z',
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
          saleStatus: 'paid',
          salePaidCents: 120000,
          saleBalanceCents: 0,
          paymentMethodSummary: 'Efectivo: $ 1.200,00',
          liquidatedPreviouslyCents: 0,
          totalAccumulatedCents: 90000,
          remainingBalanceCents: 0,
          productGainCents: 30000,
          personalizationGainCents: 0,
          gainCents: 30000,
          liquidationDate: '2026-07-20'
        }
      ]
    });
    const bridge = createBridge({
      consignments: {
        listPendingItems,
        confirmBatch: vi.fn().mockResolvedValue({
          batchId: 4,
          batchNumber: 22,
          liquidationDate: '2026-07-20',
          itemCount: 1,
          totalCents: 90000,
          totalGainCents: 30000,
          remainingCents: 0,
          notes: 'Primera quincena',
          createdAt: '2026-07-20T12:00:00.000Z'
        }),
        listBatchHistory,
        getBatchDetail,
        exportBatchExcel: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createConsignmentActions({ bridge, ...harness });

    await actions.loadPending();
    actions.toggleSelection(10);
    actions.setNotes('Primera quincena');
    await actions.confirmBatch();

    expect(bridge.consignments.confirmBatch).toHaveBeenCalledWith({
      saleItemIds: [10],
      liquidationDate: harness.getState().liquidationDate,
      notes: 'Primera quincena'
    });
    expect(harness.getState().pendingItems).toEqual([]);
    expect(harness.getState().historyItems).toEqual([
      expect.objectContaining({ batchNumber: 22, itemCount: 1 })
    ]);
    expect(harness.getState().statusMessage).toBe('Liquidación 22 confirmada correctamente.');

    await actions.loadHistory();
    await actions.openDetail(4);

    expect(getBatchDetail).toHaveBeenCalledWith({ batchId: 4 });
    expect(harness.getState().detail).toEqual(expect.objectContaining({ batchNumber: 22 }));
  });
});
