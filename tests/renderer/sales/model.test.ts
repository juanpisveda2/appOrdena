import { describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import {
  buildAssignCustomerForPaymentRecoveryRequest,
  buildCancelPaymentRequest,
  buildConfirmSaleDraftRequest,
  canAssignCustomerForPaymentRecovery,
    createInitialSalesState,
    createSalesActions,
    getCustomerRuleFeedback,
    getDraftGainTotals,
    getDraftItemGainPreview,
    shouldShowExpectedProfit,
    shouldShowPendingBalance,
    type SalesState
  } from '../../../src/renderer/features/sales/model';

function createHarness(initialState = createInitialSalesState()) {
  let state = initialState;
  const setState = (update: SalesState | ((current: SalesState) => SalesState)) => {
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
      search: vi.fn().mockResolvedValue([]),
      getProductDetail: vi.fn().mockResolvedValue({
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        description: null,
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 3,
        currentCashPriceCents: 120000,
        currentListPriceCents: 125000,
        currentProfitPercentageBasisPoints: 1000,
        currentExpectedProfitCents: 10000,
        currentPersonalizationExpectedProfitCents: null,
        currentTotalExpectedProfitCents: 10000,
      recentIntakes: []
      }),
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

describe('sales renderer model', () => {
  it('requires customer name and phone when the draft keeps a pending balance', () => {
    const state = createInitialSalesState();
    state.draftItems = [
      {
        reusableProductId: 1,
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 2,
        cashPriceCents: 120000,
        listPriceCents: 125000,
        expectedProfitCents: 10000,
        personalizationExpectedProfitCents: null,
        totalExpectedProfitCents: 10000,
        quantity: 1,
        priceType: 'cash'
      }
    ];
    state.initialPayment.amount = '200';

    expect(getCustomerRuleFeedback(state)).toBe(
      'Para dejar saldo pendiente necesitás cargar nombre y teléfono del cliente.'
    );
    expect(() => buildConfirmSaleDraftRequest(state)).toThrow(/saldo pendiente/i);
  });

  it('adds a searched product into the draft and builds a confirm request with walk-in payment', async () => {
    const bridge = createBridge();
    const harness = createHarness();
    const actions = createSalesActions({ bridge, ...harness });

    await actions.addProduct(1);
    actions.updateInitialPaymentField('amount', '1200');

    expect(harness.getState().draftItems).toHaveLength(1);
    expect(buildConfirmSaleDraftRequest(harness.getState())).toEqual({
      customer: undefined,
      draftItems: [{ reusableProductId: 1, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 120000,
        paymentMethod: 'cash',
        note: null
      }
    });
    expect(harness.getState().draftItems[0]).toEqual(
      expect.objectContaining({
        productExpectedProfitCents: 10000,
        hasPersonalization: false,
        personalizationPercentage: '5'
      })
    );
  });

  it('scales the gain preview from the product snapshot by quantity and totals it across the draft', () => {
    const state = createInitialSalesState();
    state.draftItems = [
      {
        reusableProductId: 1,
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 4,
        cashPriceCents: 120000,
        listPriceCents: 125000,
        expectedProfitCents: 10000,
        personalizationExpectedProfitCents: 500,
        totalExpectedProfitCents: 10500,
        quantity: 2,
        priceType: 'cash'
      },
      {
        reusableProductId: 2,
        name: 'Pulsera de plata',
        material: 'Plata',
        variant: '16 mm',
        availableQuantity: 2,
        cashPriceCents: 80000,
        listPriceCents: 85000,
        expectedProfitCents: 8000,
        personalizationExpectedProfitCents: null,
        totalExpectedProfitCents: 8000,
        quantity: 1,
        priceType: 'list'
      }
    ];

    expect(getDraftItemGainPreview(state.draftItems[0])).toEqual({
      productGainCents: 20000,
      personalizationGainCents: 1000,
      totalExpectedProfitCents: 21000
    });
    expect(getDraftGainTotals(state)).toEqual({
      productGainCents: 28000,
      personalizationGainCents: 1000,
      totalExpectedProfitCents: 29000
    });
  });

  it('hides duplicate expected profit labels and zero balances in presentation helpers', () => {
    expect(shouldShowExpectedProfit(10000, 10000)).toBe(false);
    expect(shouldShowExpectedProfit(10000, 12000)).toBe(true);
    expect(shouldShowExpectedProfit(10000, null)).toBe(true);
    expect(shouldShowPendingBalance(0)).toBe(false);
    expect(shouldShowPendingBalance(1)).toBe(true);
  });

  it('searches products from the first typed character and clears results when emptied', async () => {
    const search = vi.fn().mockResolvedValue([
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
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        search,
        getProductDetail: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createSalesActions({ bridge, ...harness });

    actions.setSearchQuery('a');
    await actions.searchProducts();

    expect(search).toHaveBeenCalledWith({ query: 'a', limit: 12 });
    expect(harness.getState().searchResults).toHaveLength(1);

    actions.setSearchQuery('');
    await actions.searchProducts();

    expect(harness.getState().searchStatus).toBe('idle');
    expect(harness.getState().searchResults).toEqual([]);
  });

  it('removes a draft item before confirmation so only the remaining item reaches review', async () => {
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        search: vi.fn().mockResolvedValue([]),
        getProductDetail: vi
          .fn()
          .mockResolvedValueOnce({
            reusableProductId: 1,
            category: 'jewelry',
            name: 'Aros de plata',
            description: null,
            material: 'Plata',
            variant: '18 mm',
            availableQuantity: 3,
            currentCashPriceCents: 120000,
            currentListPriceCents: 125000,
            currentProfitPercentageBasisPoints: 1000,
            currentExpectedProfitCents: 10000,
            currentPersonalizationExpectedProfitCents: null,
            currentTotalExpectedProfitCents: 10000,
            recentIntakes: []
          })
          .mockResolvedValueOnce({
            reusableProductId: 2,
            category: 'jewelry',
            name: 'Pulsera de plata',
            description: null,
            material: 'Plata',
            variant: '16 mm',
            availableQuantity: 2,
            currentCashPriceCents: 80000,
            currentListPriceCents: 85000,
            currentProfitPercentageBasisPoints: 1000,
            currentExpectedProfitCents: 10000,
            currentPersonalizationExpectedProfitCents: null,
            currentTotalExpectedProfitCents: 10000,
            recentIntakes: []
          }),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createSalesActions({ bridge, ...harness });

    await actions.addProduct(1);
    await actions.addProduct(2);
    actions.updateInitialPaymentField('amount', '800');
    actions.removeDraftItem(1);
    actions.goToReview();

    expect(harness.getState().view).toBe('review');
    expect(harness.getState().draftItems).toEqual([
      expect.objectContaining({
        reusableProductId: 2,
        name: 'Pulsera de plata'
      })
    ]);
    expect(buildConfirmSaleDraftRequest(harness.getState())).toEqual({
      customer: undefined,
      draftItems: [{ reusableProductId: 2, quantity: 1, priceType: 'cash' }],
      initialPayment: {
        amountCents: 80000,
        paymentMethod: 'cash',
        note: null
      }
    });
  });

  it('loads the sales history and opens an existing sale detail without resetting the draft flow', async () => {
    const listHistory = vi.fn().mockResolvedValue([
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
    ]);
    const getById = vi.fn().mockResolvedValue({
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
    });
    const bridge = createBridge({
      sales: {
        listHistory,
        getById,
        confirmDraft: vi.fn(),
        registerPayment: vi.fn(),
        cancelPayment: vi.fn(),
        assignCustomerForPaymentRecovery: vi.fn(),
        cancelSale: vi.fn()
      }
    });
    const state = createInitialSalesState();
    state.draftItems = [
      {
        reusableProductId: 1,
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 2,
        cashPriceCents: 120000,
        listPriceCents: 125000,
        expectedProfitCents: 10000,
        personalizationExpectedProfitCents: null,
        totalExpectedProfitCents: 10000,
        quantity: 1,
        priceType: 'cash'
      }
    ];
    const harness = createHarness(state);
    const actions = createSalesActions({ bridge, ...harness });

    await actions.openHistory();

    expect(listHistory).toHaveBeenCalledWith({ query: '', limit: 20 });
    expect(harness.getState().view).toBe('history');
    expect(harness.getState().historyReturnView).toBe('draft');
    expect(harness.getState().historyResults).toHaveLength(1);

    await actions.openSaleDetail(7);

    expect(getById).toHaveBeenCalledWith({ saleId: 7 });
    expect(harness.getState().view).toBe('detail');
    expect(harness.getState().detailOrigin).toBe('history');
    expect(harness.getState().currentSale?.saleId).toBe(7);

    actions.backFromDetail();

    expect(harness.getState().view).toBe('history');

    actions.returnFromHistory();

    expect(harness.getState().view).toBe('draft');
    expect(harness.getState().draftItems).toHaveLength(1);
  });

  it('confirms the sale, then registers a later payment and updates the detail snapshot', async () => {
    const confirmDraft = vi.fn().mockResolvedValue({
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
      payments: [{ paymentId: 1, paymentDate: '2026-07-16', amountCents: 20000, paymentMethod: 'cash', note: null, cancelledAt: null, cancellationReason: null, isActive: true }],
      totalProfitCents: 30000,
      canRegisterPayment: true,
      canCancelSale: true
    });
    const registerPayment = vi.fn().mockResolvedValue({
      saleId: 7,
      saleNumber: 12,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'paid',
      totalCents: 120000,
      paidCents: 120000,
      balanceCents: 0,
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
      canRegisterPayment: false,
      canCancelSale: true
    });
    const bridge = createBridge({
      sales: {
        listHistory: vi.fn(),
        getById: vi.fn(),
        confirmDraft,
        registerPayment,
        cancelPayment: vi.fn(),
        assignCustomerForPaymentRecovery: vi.fn(),
        cancelSale: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createSalesActions({ bridge, ...harness });

    await actions.addProduct(1);
    actions.updateCustomerField('name', 'Ana');
    actions.updateCustomerField('phoneText', '3510000000');
    actions.updateInitialPaymentField('amount', '200');
    actions.goToReview();
    await actions.confirmSale();

    expect(harness.getState().view).toBe('detail');
    expect(confirmDraft).toHaveBeenCalled();

    actions.updateDetailPaymentField('amount', '1000');
    actions.updateDetailPaymentField('paymentMethod', 'bank_transfer');
    await actions.registerPayment();

    expect(registerPayment).toHaveBeenCalledWith({
      saleId: 7,
      amountCents: 100000,
      paymentMethod: 'bank_transfer',
      note: null
    });
    expect(harness.getState().currentSale?.status).toBe('paid');
  });

  it('requires a reason to cancel an active payment and sends the approved cancellation request', async () => {
    const cancelPayment = vi.fn().mockResolvedValue({
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
      payments: [
        {
          paymentId: 1,
          paymentDate: '2026-07-16',
          amountCents: 100000,
          paymentMethod: 'cash',
          note: null,
          cancelledAt: '2026-07-16T11:00:00.000Z',
          cancellationReason: 'Pago cargado dos veces',
          isActive: false
        },
        {
          paymentId: 2,
          paymentDate: '2026-07-16',
          amountCents: 20000,
          paymentMethod: 'bank_transfer',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        }
      ],
      totalProfitCents: 20000,
      canRegisterPayment: true,
      canCancelSale: true
    });
    const bridge = createBridge({
      sales: {
        listHistory: vi.fn(),
        getById: vi.fn(),
        confirmDraft: vi.fn(),
        registerPayment: vi.fn(),
        cancelPayment,
        assignCustomerForPaymentRecovery: vi.fn(),
        cancelSale: vi.fn()
      }
    });
    const state = createInitialSalesState();
    state.view = 'detail';
    state.currentSale = {
      saleId: 7,
      saleNumber: 12,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'paid',
      totalCents: 120000,
      paidCents: 120000,
      balanceCents: 0,
      cancellationReason: null,
      customer: {
        customerId: 1,
        name: 'Ana',
        phoneText: '3510000000',
        note: null
      },
      items: [],
      payments: [
        {
          paymentId: 1,
          paymentDate: '2026-07-16',
          amountCents: 100000,
          paymentMethod: 'cash',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        },
        {
          paymentId: 2,
          paymentDate: '2026-07-16',
          amountCents: 20000,
          paymentMethod: 'bank_transfer',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        }
      ],
      totalProfitCents: 120000,
      canRegisterPayment: false,
      canCancelSale: true
    };
    const harness = createHarness(state);
    const actions = createSalesActions({ bridge, ...harness });

    expect(() => buildCancelPaymentRequest(harness.getState(), 1)).toThrow(/motivo/i);

    await actions.cancelPayment(1);
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(harness.getState().submitMessage).toBe('Escribí el motivo antes de cancelar el pago.');

    actions.updatePaymentCancellationReason(1, 'Pago cargado dos veces');

    expect(buildCancelPaymentRequest(harness.getState(), 1)).toEqual({
      saleId: 7,
      paymentId: 1,
      reason: 'Pago cargado dos veces'
    });

    await actions.cancelPayment(1);

    expect(cancelPayment).toHaveBeenCalledWith({
      saleId: 7,
      paymentId: 1,
      reason: 'Pago cargado dos veces'
    });
    expect(harness.getState().currentSale?.payments[0].isActive).toBe(false);
    expect(harness.getState().submitMessage).toBe('Cancelamos el pago y actualizamos el saldo de la venta.');
    expect(harness.getState().paymentCancellationReasons[1]).toBeUndefined();
  });

  it('assigns a customer through the narrow payment-recovery path for a fully paid walk-in sale', async () => {
    const assignCustomerForPaymentRecovery = vi.fn().mockResolvedValue({
      saleId: 9,
      saleNumber: 14,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'paid',
      totalCents: 120000,
      paidCents: 120000,
      balanceCents: 0,
      cancellationReason: null,
      customer: {
        customerId: 4,
        name: 'Elena',
        phoneText: '3514444444',
        note: null
      },
      items: [],
      payments: [
        {
          paymentId: 1,
          paymentDate: '2026-07-16',
          amountCents: 120000,
          paymentMethod: 'cash',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        }
      ],
      totalProfitCents: 120000,
      canRegisterPayment: false,
      canCancelSale: true
    });
    const bridge = createBridge({
      sales: {
        listHistory: vi.fn(),
        getById: vi.fn(),
        confirmDraft: vi.fn(),
        registerPayment: vi.fn(),
        cancelPayment: vi.fn(),
        assignCustomerForPaymentRecovery,
        cancelSale: vi.fn()
      }
    });
    const state = createInitialSalesState();
    state.view = 'detail';
    state.currentSale = {
      saleId: 9,
      saleNumber: 14,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'paid',
      totalCents: 120000,
      paidCents: 120000,
      balanceCents: 0,
      cancellationReason: null,
      customer: {
        customerId: null,
        name: null,
        phoneText: null,
        note: null
      },
      items: [],
      payments: [
        {
          paymentId: 1,
          paymentDate: '2026-07-16',
          amountCents: 120000,
          paymentMethod: 'cash',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        }
      ],
      totalProfitCents: 120000,
      canRegisterPayment: false,
      canCancelSale: true
    };
    const harness = createHarness(state);
    const actions = createSalesActions({ bridge, ...harness });

    expect(canAssignCustomerForPaymentRecovery(harness.getState().currentSale)).toBe(true);
    expect(() => buildAssignCustomerForPaymentRecoveryRequest(harness.getState())).toThrow(/nombre y teléfono/i);

    actions.updateRecoveryCustomerField('name', 'Elena');
    actions.updateRecoveryCustomerField('phoneText', '3514444444');

    expect(buildAssignCustomerForPaymentRecoveryRequest(harness.getState())).toEqual({
      saleId: 9,
      name: 'Elena',
      phoneText: '3514444444'
    });

    await actions.assignCustomerForPaymentRecovery();

    expect(assignCustomerForPaymentRecovery).toHaveBeenCalledWith({
      saleId: 9,
      name: 'Elena',
      phoneText: '3514444444'
    });
    expect(harness.getState().currentSale?.customer.name).toBe('Elena');
    expect(harness.getState().submitMessage).toBe(
      'Asignamos el cliente para que puedas cancelar el pago sin romper las reglas de saldo.'
    );
  });
});
