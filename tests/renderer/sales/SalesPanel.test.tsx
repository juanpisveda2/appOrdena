// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import { SalesPanel } from '../../../src/renderer/features/sales/SalesPanel';
import { createInitialSalesState } from '../../../src/renderer/features/sales/model';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  afterEach(() => {
    document.body.innerHTML = '';
  });

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
        cashExpectedProfitCents: 12000,
        listExpectedProfitCents: 12500,
        personalizationExpectedProfitCents: null,
        quantity: 1,
        priceType: 'cash'
      }
    ];

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Ventas');
    expect(markup).toContain('1. Buscar y agregar productos');
    expect(markup).not.toContain('1 unidad agregada a la venta.');
    expect(markup).toContain('Agregado');
    expect(markup).toContain('En la venta: 1 unidad');
    expect(markup).toContain('✓ Agregado');
    expect(markup).toContain('2. Armar venta');
    expect(markup).toContain('Sacar');
    expect(markup).toContain('3. Cliente y pago inicial');
    expect(markup).not.toContain('Nueva venta');
    expect(markup).not.toContain('Historial de ventas</p><h3');
    expect(markup).not.toContain('Priorizá producto, cantidad, precio usado y subtotal. La personalización aparece solo cuando la necesitás.');
    expect(markup).not.toContain('Nombre, categoría, material o variante');
    expect(markup).not.toContain('Ganancia: $ 100,00');
    expect(markup).not.toContain('<dt>Ganancia</dt>');
    expect(markup).toContain('Saldo');
    expect(markup).toContain('$ 1.200,00');
    expect(markup).toContain('$ 120,00');
    expect(markup).toContain('Ganancia producto');
    expect(markup).not.toContain('Ganancia total');
    expect(markup).toContain('Cierre rápido antes de revisar');
    expect(markup).toContain('Ya agregaste 1 unidad a esta venta.');
    expect(markup).toContain('Seguir a revisión');
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
        cashExpectedProfitCents: 12000,
        listExpectedProfitCents: 12500,
        personalizationExpectedProfitCents: null,
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
        cashExpectedProfitCents: 8000,
        listExpectedProfitCents: 8500,
        personalizationExpectedProfitCents: 500,
        quantity: 2,
        priceType: 'list'
      }
    ];
    state.initialPayment.amount = '1000';
    state.customer.name = 'Ana';
    state.customer.phoneText = '3510000000';

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('4. Revisar y confirmar');
    expect(markup).toContain('Lo que se va a guardar');
    expect(markup).toContain('Aros de plata');
    expect(markup).toContain('Pulsera de plata');
    expect(markup).toContain('Base: $ 1.200,00 · Total: $ 1.200,00');
    expect(markup).toContain('Base: $ 1.700,00 · Total: $ 1.700,00');
    expect(markup).toContain('Cierre final');
    expect(markup).toContain('Cliente');
    expect(markup).toContain('Ana · 3510000000');
    expect(markup).toContain('Total');
    expect(markup).toContain('$ 2.900,00');
    expect(markup).toContain('Pago inicial');
    expect(markup).toContain('$ 1.000,00');
    expect(markup).toContain('Saldo');
    expect(markup).toContain('$ 1.900,00');
    expect(markup).toContain('Ganancia producto');
    expect(markup).toContain('$ 290,00');
    expect(markup).toContain('Volver y ajustar');
    expect(markup).toContain('Confirmar y guardar venta');
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
    expect(markup).toContain('Fecha: 16/07/2026');
    expect(markup).toContain('Ana · 3510000000');
    expect(markup).toContain('Cobrado: $ 200,00');
    expect(markup).toContain('Ganancia: $ 300,00');
    expect(markup).toContain('Ver detalle');
  });

  it('reuses the same history entry action when mounted from an external history CTA', async () => {
    const bridge = createBridge();
    vi.mocked(bridge.sales.listHistory).mockResolvedValue([]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SalesPanel bridge={bridge} entryPoint="history" />);
      await Promise.resolve();
    });

    expect(bridge.sales.listHistory).toHaveBeenCalledWith({ query: '', limit: 60 });
    expect(container.textContent).toContain('Historial de ventas');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('does not render out-of-stock products in the search/add flow', () => {
    const state = createInitialSalesState();
    state.searchStatus = 'ready';
    state.searchResults = [
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 2,
        isOutOfStock: false
      },
      {
        reusableProductId: 2,
        category: 'jewelry',
        name: 'Anillo sin stock',
        material: 'Plata',
        variant: '10 mm',
        availableQuantity: 0,
        isOutOfStock: true
      }
    ];

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Aros de plata');
    expect(markup).not.toContain('Anillo sin stock');
  });

  it('switches the add CTA into an added state and shows the visible quantity after adding a product', async () => {
    const bridge = createBridge();
    vi.mocked(bridge.catalog.getProductDetail).mockResolvedValue({
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
      currentCashExpectedProfitCents: 12000,
      currentListExpectedProfitCents: 12500,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 12000,
      currentListTotalExpectedProfitCents: 12500,
      recentIntakes: []
    });
    const state = createInitialSalesState();
    state.searchStatus = 'ready';
    state.searchResults = [
      {
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 3,
        isOutOfStock: false
      }
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SalesPanel bridge={bridge} initialState={state} />);
      await Promise.resolve();
    });

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Sumar a la venta');
    if (!(addButton instanceof HTMLButtonElement)) {
      throw new Error('Add button not found');
    }

    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Agregado');
    expect(container.textContent).toContain('En la venta: 1 unidad');
    expect(container.textContent).toContain('Ya agregaste 1 unidad a esta venta.');
    expect(container.textContent).toContain('✓ Agregado');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('redirects to sales history after confirming and keeps the success feedback visible', async () => {
    const bridge = createBridge();
    vi.mocked(bridge.sales.confirmDraft).mockResolvedValue({
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
    vi.mocked(bridge.sales.listHistory).mockResolvedValue([
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
        cashExpectedProfitCents: 12000,
        listExpectedProfitCents: 12500,
        personalizationExpectedProfitCents: null,
        quantity: 1,
        priceType: 'cash'
      }
    ];
    state.customer.name = 'Ana';
    state.customer.phoneText = '3510000000';
    state.initialPayment.amount = '200';

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SalesPanel bridge={bridge} initialState={state} />);
      await Promise.resolve();
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Confirmar y guardar venta'
    );
    if (!(confirmButton instanceof HTMLButtonElement)) {
      throw new Error('Confirm button not found');
    }

    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bridge.sales.confirmDraft).toHaveBeenCalled();
    expect(bridge.sales.listHistory).toHaveBeenCalledWith({ query: '', limit: 60 });
    expect(container.textContent).toContain('Historial de ventas');
    expect(container.textContent).toContain('La venta #12 quedó confirmada.');
    expect(container.textContent).not.toContain('Resumen confirmado');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
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
    expect(historyMarkup).toContain('Cobrado: $ 1.200,00');
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
        cashExpectedProfitCents: 8000,
        listExpectedProfitCents: 8500,
        personalizationExpectedProfitCents: 500,
        quantity: 1,
        priceType: 'list'
      }
    ];

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Ganancia por lista: $ 85,00 · Ganancia personalización: $ 5,00 · Ganancia total: $ 90,00');
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
        cashExpectedProfitCents: 12000,
        listExpectedProfitCents: 12500,
        personalizationExpectedProfitCents: null,
        quantity: 1,
        priceType: 'cash'
      }
    ];
    draftState.initialPayment.amount = '1200';

    const draftMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={draftState} />);

    expect(draftMarkup).toContain('Cierre rápido antes de revisar');
    expect(draftMarkup).toContain('Sin saldo pendiente');

    const reviewState = createInitialSalesState();
    reviewState.view = 'review';
    reviewState.draftItems = draftState.draftItems;
    reviewState.initialPayment.amount = '1200';

    const reviewMarkup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={reviewState} />);

    expect(reviewMarkup).toContain('Cierre final');
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
        cashExpectedProfitCents: 12000,
        listExpectedProfitCents: 12500,
        personalizationExpectedProfitCents: null,
        quantity: 1,
        priceType: 'cash'
      }
    ];

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Lo que se va a guardar');
    expect(markup).not.toContain('<dt>Ganancia</dt>');
    expect(markup).toContain('<dt>Ganancia producto</dt>');
    expect(markup).not.toContain('<dt>Ganancia total</dt>');
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
    expect(markup).toContain('Ganancia producto');
    expect(markup).not.toContain('Ganancia por personalización');
    expect(markup).toContain('Cargar pago');
    expect(markup).toContain('Guardar pago');
    expect(markup).toContain('Acciones delicadas sobre pagos');
    expect(markup).toContain('Motivo para anular este pago');
    expect(markup).toContain('Anular pago');
    expect(markup).toContain('Motivo de cancelación: Pago duplicado');
    expect(markup).toContain('Cancelar esta venta');
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
    expect(markup).toContain('Acción especial para corregir pagos');
    expect(markup).toContain('Guardar cliente para esta corrección');
  });

  it('renders history pagination after filtering results and honors the current page', () => {
    const state = createInitialSalesState();
    state.view = 'history';
    state.historyStatus = 'ready';
    state.historyPage = 2;
    state.historyResults = Array.from({ length: 7 }, (_, index) => ({
      saleId: index + 1,
      saleNumber: 100 + index,
      saleDate: '2026-07-16T10:00:00.000Z',
      status: 'paid' as const,
      totalCents: 10000 * (index + 1),
      paidCents: 10000 * (index + 1),
      balanceCents: 0,
      customerName: `Cliente ${index + 1}`,
      customerPhoneText: null,
      totalProfitCents: 2000 * (index + 1)
    }));

    const markup = renderToStaticMarkup(<SalesPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Página 2 de 2');
    expect(markup).toContain('Venta #106');
    expect(markup).not.toContain('Venta #100');
  });
});
