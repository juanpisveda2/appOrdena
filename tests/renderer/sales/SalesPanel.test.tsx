import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import { SalesPanel } from '../../../src/renderer/features/sales/SalesPanel';
import { createInitialSalesState } from '../../../src/renderer/features/sales/model';

function createBridge(): AppBridge {
  return {
    health: vi.fn(),
    catalog: {
      list: vi.fn(),
      getProductDetail: vi.fn(),
      search: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn()
    },
    stock: {
      saveIntake: vi.fn()
    },
    sales: {
      listHistory: vi.fn(),
      getById: vi.fn(),
      confirmDraft: vi.fn(),
      registerPayment: vi.fn(),
      cancelPayment: vi.fn(),
      assignCustomerForPaymentRecovery: vi.fn(),
      cancelSale: vi.fn()
    },
    consignments: {
      listPendingItems: vi.fn(),
      confirmBatch: vi.fn(),
      listBatchHistory: vi.fn(),
      getBatchDetail: vi.fn(),
      exportBatchExcel: vi.fn()
    }
  };
}

describe('SalesPanel', () => {
  it('renders the draft flow with search, draft controls, customer feedback, and review entry', () => {
    const state = createInitialSalesState();
    state.searchResults = [
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 2,
        isOutOfStock: false
      }
    ];
    state.searchStatus = 'ready';
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

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Ventas');
    expect(markup).toContain('Buscar producto');
    expect(markup).toContain('Agregar a la venta');
    expect(markup).toContain('Borrador de venta');
    expect(markup).toContain('Quitar');
    expect(markup).toContain('Cliente y pago inicial');
    expect(markup).not.toContain('Ganancia: $ 100,00');
    expect(markup).not.toContain('<dt>Ganancia</dt>');
    expect(markup).toContain('Saldo');
    expect(markup).toContain('$ 1.200,00');
    expect(markup).toContain('$ 100,00');
    expect(markup).toContain('Ganancia total');
    expect(markup).toContain('Revisar venta');
  });

  it('renders the review summary before confirmation', () => {
    const state = createInitialSalesState();
    state.view = 'review';
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
      },
      {
        reusableProductId: 2,
        name: 'Pulsera de plata',
        material: 'Plata',
        variant: '16 mm',
        availableQuantity: 3,
        cashPriceCents: 80000,
        listPriceCents: 85000,
        expectedProfitCents: 8000,
        personalizationExpectedProfitCents: 500,
        totalExpectedProfitCents: 8500,
        quantity: 2,
        priceType: 'list'
      }
    ];
    state.initialPayment.amount = '1000';
    state.customer.name = 'Ana';
    state.customer.phoneText = '3510000000';

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Resumen antes de confirmar');
    expect(markup).toContain('Aros de plata');
    expect(markup).toContain('Pulsera de plata');
    expect(markup).toContain('Base: $ 1.200,00 · Total: $ 1.200,00');
    expect(markup).toContain('Base: $ 1.700,00 · Total: $ 1.700,00');
    expect(markup).toContain('Datos de confirmación');
    expect(markup).toContain('Cliente');
    expect(markup).toContain('Ana · 3510000000');
    expect(markup).toContain('Total');
    expect(markup).toContain('$ 2.900,00');
    expect(markup).toContain('Pago inicial');
    expect(markup).toContain('$ 1.000,00');
    expect(markup).toContain('Saldo');
    expect(markup).toContain('$ 1.900,00');
    expect(markup).toContain('Ganancia total');
    expect(markup).toContain('$ 270,00');
    expect(markup).toContain('Volver a editar');
    expect(markup).toContain('Confirmar venta');
  });

  it('renders the dedicated sales history list with a direct detail entry action', () => {
    const state = createInitialSalesState();
    state.view = 'history';
    state.historyStatus = 'ready';
    state.historyResults = [
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

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Historial de ventas');
    expect(markup).toContain('Buscar por número, cliente o teléfono');
    expect(markup).toContain('Venta #12');
    expect(markup).toContain('Ana · 3510000000');
    expect(markup).toContain('Ganancia total: $ 300,00');
    expect(markup).toContain('Abrir detalle');
  });

  it('hides zero balances across history and confirmed detail views', () => {
    const historyState = createInitialSalesState();
    historyState.view = 'history';
    historyState.historyStatus = 'ready';
    historyState.historyResults = [
      {
        saleId: 9,
        saleNumber: 14,
        saleDate: '2026-07-16T10:00:00.000Z',
        status: 'paid',
        totalCents: 120000,
        paidCents: 120000,
        balanceCents: 0,
        customerName: 'Elena',
        customerPhoneText: '3514444444',
        totalProfitCents: 30000
      }
    ];

    const historyMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={historyState} />);

    expect(historyMarkup).toContain('Total: $ 1.200,00');
    expect(historyMarkup).not.toContain('Saldo: $ 0,00');

    const detailState = createInitialSalesState();
    detailState.view = 'detail';
    detailState.currentSale = {
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
      payments: [],
      totalProfitCents: 30000,
      canRegisterPayment: false,
      canCancelSale: true
    };

    const detailMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={detailState} />);

    expect(detailMarkup).toContain('Resumen confirmado');
    expect(detailMarkup).not.toContain('<dt>Saldo</dt>');
  });

  it('shows both gain labels only when expected profit differs from total profit', () => {
    const state = createInitialSalesState();
    state.view = 'review';
    state.draftItems = [
      {
        reusableProductId: 2,
        name: 'Pulsera de plata',
        material: 'Plata',
        variant: '16 mm',
        availableQuantity: 3,
        cashPriceCents: 80000,
        listPriceCents: 85000,
        expectedProfitCents: 8000,
        personalizationExpectedProfitCents: 500,
        totalExpectedProfitCents: 8500,
        quantity: 1,
        priceType: 'list'
      }
    ];

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Ganancia producto: $ 80,00 · Ganancia personalización: $ 5,00 · Ganancia total: $ 85,00');
    expect(markup).toContain('<dt>Ganancia producto</dt>');
  });

  it('hides zero balances in draft and review summaries', () => {
    const draftState = createInitialSalesState();
    draftState.draftItems = [
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
    draftState.initialPayment.amount = '1200';

    const draftMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={draftState} />);

    expect(draftMarkup).toContain('Resumen rápido');
    expect(draftMarkup).not.toContain('<dt>Saldo</dt>');

    const reviewState = createInitialSalesState();
    reviewState.view = 'review';
    reviewState.draftItems = draftState.draftItems;
    reviewState.initialPayment.amount = '1200';

    const reviewMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={reviewState} />);

    expect(reviewMarkup).toContain('Datos de confirmación');
    expect(reviewMarkup).not.toContain('<dt>Saldo</dt>');
  });

  it('hides duplicate gain in the review summary when it matches total gain', () => {
    const state = createInitialSalesState();
    state.view = 'review';
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

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Resumen antes de confirmar');
    expect(markup).not.toContain('<dt>Ganancia</dt>');
    expect(markup).toContain('<dt>Ganancia total</dt>');
    expect(markup).not.toContain('Ganancia: $ 100,00');
  });

  it('renders the confirmed sale detail with later payment and cancellation sections', () => {
    const state = createInitialSalesState();
    state.view = 'detail';
    state.currentSale = {
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
      items: [
        {
          saleItemId: 1,
          reusableProductId: 1,
          productCategory: 'jewelry',
          productName: 'Aros de plata',
          productMaterial: 'Plata',
          productVariant: '18 mm',
          quantity: 1,
          priceType: 'cash',
          unitPriceCents: 120000,
          lineSubtotalCents: 120000,
          consignmentStatus: 'pending_settlement',
          allocations: []
        }
      ],
      payments: [
        {
          paymentId: 1,
          paymentDate: '2026-07-16',
          amountCents: 20000,
          paymentMethod: 'cash',
          note: null,
          cancelledAt: null,
          cancellationReason: null,
          isActive: true
        },
        {
          paymentId: 2,
          paymentDate: '2026-07-16',
          amountCents: 10000,
          paymentMethod: 'bank_transfer',
          note: null,
          cancelledAt: '2026-07-16T11:00:00.000Z',
          cancellationReason: 'Pago duplicado',
          isActive: false
        }
      ],
      totalProfitCents: 30000,
      canRegisterPayment: true,
      canCancelSale: true
    };

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Resumen confirmado');
    expect(markup).toContain('Ganancia total');
    expect(markup).not.toContain('Ganancia por personalización');
    expect(markup).toContain('Registrar pago');
    expect(markup).toContain('Guardar pago');
    expect(markup).toContain('Motivo de cancelación del pago');
    expect(markup).toContain('Cancelar pago');
    expect(markup).toContain('Motivo de cancelación: Pago duplicado');
    expect(markup).toContain('Cancelar venta');
    expect(markup).toContain('Confirmar cancelación');
  });

  it('renders the narrow customer-recovery section for a fully paid walk-in sale', () => {
    const state = createInitialSalesState();
    state.view = 'detail';
    state.detailOrigin = 'history';
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
      totalProfitCents: 0,
      canRegisterPayment: false,
      canCancelSale: true
    };

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Volver al historial');
    expect(markup).toContain('Asignar cliente para corregir pagos');
    expect(markup).toContain('Guardar cliente para recuperación');
  });
});
