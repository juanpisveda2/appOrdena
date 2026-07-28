// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import { CatalogStockPanel } from '../../../src/renderer/features/catalog-stock/CatalogStockPanel';
import { createInitialCatalogStockState } from '../../../src/renderer/features/catalog-stock/model';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createBridge(): AppBridge {
  return {
    health: vi.fn(),
    catalog: {
      list: vi.fn().mockResolvedValue({ recentProducts: [], products: [] }),
      getProductDetail: vi.fn(),
      search: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn()
    },
    stock: {
      saveIntake: vi.fn()
    },
    sales: {
      listHistory: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      confirmDraft: vi.fn(),
      registerPayment: vi.fn(),
      cancelPayment: vi.fn(),
      assignCustomerForPaymentRecovery: vi.fn(),
      cancelSale: vi.fn()
    },
    consignments: {
      listPendingItems: vi.fn().mockResolvedValue([]),
      confirmBatch: vi.fn(),
      listBatchHistory: vi.fn(),
      getBatchDetail: vi.fn(),
      exportBatchExcel: vi.fn()
    }
  };
}

describe('CatalogStockPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders the hub as a single work list with search and category filters', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';
    state.hubSummaryStatus = 'ready';
    state.pendingSalesCount = 2;
    state.pendingSettlementCount = 3;
    state.catalogProducts = [
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
    ];

    const markup = renderToStaticMarkup(
      <CatalogStockPanel bridge={createBridge()} initialState={state} onOpenSales={() => undefined} onOpenConsignments={() => undefined} />
    );

    expect(markup).toContain('Catálogo y stock');
    expect(markup).toContain('Agregar producto');
    expect(markup).not.toContain('Volver');
    expect(markup).toContain('Consultá el catálogo activo, revisá el stock y seguí ventas o liquidaciones pendientes desde el inicio.');
    expect(markup).not.toContain('Inicio operativo');
    expect(markup).toContain('Pendientes de venta');
    expect(markup).toContain('Pendientes de liquidación');
    expect(markup).toContain('Ver ventas');
    expect(markup).toContain('Ver liquidaciones');
    expect(markup).toContain('Buscá por nombre, categoría, material o variante');
    expect(markup).toContain('Todas');
    expect(markup).toContain('Joyas');
    expect(markup).toContain('Mates');
    expect(markup).toContain('Ropa');
    expect(markup).not.toContain('Productos recientes');
    expect(markup).not.toContain('Catálogo general');
    expect(markup).toContain('Ver producto');
    expect(markup).toContain('Registrar ingreso adicional');
    expect(markup).toContain('Sin stock');
    expect(markup).toContain('Mostrando 1 de 1 productos.');
  });

  it('renders the empty catalog state without an initial search error', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('No hay productos para mostrar.');
    expect(markup).not.toContain('Ingresá un término de búsqueda para continuar.');
  });

  it('renders product detail with current state first, separated history, and the new action hierarchy', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'detail';
    state.detailStatus = 'ready';
    state.detailProduct = {
      reusableProductId: 1,
      category: 'jewelry',
      name: 'Aros de plata',
      description: 'Par clásico.',
      material: 'Plata',
      variant: '18 mm',
      availableQuantity: 2,
      currentCashPriceCents: 120000,
      currentListPriceCents: 125000,
      currentProfitPercentageBasisPoints: 1000,
      currentCashExpectedProfitCents: 12000,
      currentListExpectedProfitCents: 12500,
      currentPersonalizationExpectedProfitCents: 250,
      currentCashTotalExpectedProfitCents: 12250,
      currentListTotalExpectedProfitCents: 12750,
      recentIntakes: [
        {
          stockIntakeId: 4,
          enteredQuantity: 2,
          availableQuantity: 2,
          supplierUnitCostCents: 100000,
          cashPriceCents: 120000,
          listPriceCents: 125000,
          profitPercentageBasisPoints: 1000,
          cashExpectedProfitCents: 12000,
          listExpectedProfitCents: 12500,
          personalizationAmountCents: 5000,
          personalizationPercentageBasisPoints: 500,
          personalizationExpectedProfitCents: 250,
          cashTotalExpectedProfitCents: 12250,
          listTotalExpectedProfitCents: 12750,
          intakeDate: '2026-07-14',
          notes: 'Con grabado.'
        }
      ]
    };

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Estado actual del producto y ultimos movimientos de stock.');
    expect(markup).toContain('Volver al catálogo');
    expect(markup).toContain('Editar producto');
    expect(markup).toContain('Registrar ingreso adicional');
    expect(markup).toContain('Eliminar producto');
    expect(markup).toContain('Joyas');
    expect(markup).toContain('Plata');
    expect(markup).toContain('18 mm');
    expect(markup).toContain('Estado actual');
    expect(markup).toContain('Stock disponible');
    expect(markup).toContain('2 unidades listas para vender');
    expect(markup).toContain('Precio contado');
    expect(markup).toContain('Precio de lista');
    expect(markup).toContain('Margen');
    expect(markup).toContain('10%');
    expect(markup).toContain('Ingresos recientes');
    expect(markup).toContain('Mostramos hasta 5 ingresos recientes.');
    expect(markup).toContain('14 jul 2026');
    expect(markup).toContain('Ingreso de 2');
    expect(markup).toContain('Stock despues de este ingreso: 2');
  });

  it('renders the redesigned add-product flow as three steps in one screen', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.name = 'Aros de plata';
    state.newProduct.material = 'Plata';
    state.intakeForm.enteredQuantity = '1';
    state.intakeForm.supplierUnitCostCents = '1000';
    state.intakeForm.cashPriceCents = '1000';
    state.intakeForm.listPriceCents = '1500';
    state.intakeForm.profitPercentageBasisPoints = '10';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Agregar producto');
    expect(markup).toContain('Creá el producto y registrá su primer ingreso en este mismo paso.');
    expect(markup).toContain('Datos del producto');
    expect(markup).toContain('Primer ingreso');
    expect(markup).toContain('Revisar y guardar');
    expect(markup).toContain('Se usa como stock disponible inicial.');
    expect(markup).toContain('Ganancia estimada contado');
    expect(markup).toContain('Ganancia estimada lista');
    expect(markup).toContain('Variante opcional');
    expect(markup).toContain('Cancelar y volver al catálogo');
  });

  it('renders the early duplicate prompt with the existing-product shortcut', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.name = 'Aros de plata';
    state.earlyDuplicateCheck = {
      status: 'ready',
      query: 'Aros de plata Plata 18 mm',
      dismissedQuery: null,
      matches: [
        {
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 2,
          isOutOfStock: false
        }
      ]
    };

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Ya existe un producto muy parecido');
    expect(markup).toContain('Ir al producto');
    expect(markup).toContain('Seguir creando igual');
  });

  it('renders the existing-product intake flow with the product already selected', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-intake';
    state.detailProduct = {
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      description: null,
      material: 'Cuero',
      variant: 'Premium',
      availableQuantity: 4,
      currentCashPriceCents: 150000,
      currentListPriceCents: 165000,
      currentProfitPercentageBasisPoints: 1200,
      currentCashExpectedProfitCents: 18000,
      currentListExpectedProfitCents: 19800,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 18000,
      currentListTotalExpectedProfitCents: 19800,
      recentIntakes: []
    };
    state.intakeProduct = {
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    };

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Registrar ingreso adicional');
    expect(markup).toContain('Sumá stock a un producto existente y ajustá los valores de este ingreso si hace falta.');
    expect(markup).toContain('Producto seleccionado');
    expect(markup).toContain('Mate camionero');
    expect(markup).toContain('Stock actual: 4');
    expect(markup).toContain('Ingreso adicional');
    expect(markup).toContain('Cantidad que se agrega');
    expect(markup).toContain('Esta cantidad se agrega al stock actual.');
  });

  it('opens the existing-product intake shortcut from the hub and prefills current values with today\'s date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));

    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';
    state.hubSummaryStatus = 'ready';
    state.catalogProducts = [
      {
        reusableProductId: 2,
        category: 'mate',
        name: 'Mate camionero',
        material: 'Cuero',
        variant: 'Premium',
        availableQuantity: 4,
        isOutOfStock: false,
        currentCashPriceCents: 150000,
        currentListPriceCents: 165000
      }
    ];
    const bridge = createBridge();
    vi.mocked(bridge.catalog.list).mockResolvedValue({ recentProducts: [], products: state.catalogProducts });
    vi.mocked(bridge.catalog.getProductDetail).mockResolvedValue({
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      description: null,
      material: 'Cuero',
      variant: 'Premium',
      availableQuantity: 4,
      currentCashPriceCents: 150000,
      currentListPriceCents: 165000,
      currentProfitPercentageBasisPoints: 1200,
      currentCashExpectedProfitCents: 18000,
      currentListExpectedProfitCents: 19800,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 18000,
      currentListTotalExpectedProfitCents: 19800,
      recentIntakes: [
        {
          stockIntakeId: 4,
          enteredQuantity: 2,
          availableQuantity: 2,
          supplierUnitCostCents: 100050,
          cashPriceCents: 150000,
          listPriceCents: 165000,
          profitPercentageBasisPoints: 1200,
          cashExpectedProfitCents: 18000,
          listExpectedProfitCents: 19800,
          personalizationAmountCents: null,
          personalizationPercentageBasisPoints: null,
          personalizationExpectedProfitCents: null,
          cashTotalExpectedProfitCents: 18000,
          listTotalExpectedProfitCents: 19800,
          intakeDate: '2026-07-25',
          notes: 'Costo vigente.'
        }
      ]
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CatalogStockPanel bridge={bridge} initialState={state} />);
      await Promise.resolve();
    });

    await act(async () => {
      const intakeButtons = Array.from(container.querySelectorAll('button')).filter(
        (button) => button.textContent?.trim() === 'Registrar ingreso adicional'
      );
      const shortcutButton = intakeButtons[0];
      if (!(shortcutButton instanceof HTMLButtonElement)) {
        throw new Error('Intake shortcut button not found');
      }
      shortcutButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dateInput = container.querySelector('input[type="date"]');
    const quantityInput = Array.from(container.querySelectorAll('input')).find(
      (input) => input.getAttribute('placeholder') === 'Ej: 12'
    );
    const supplierInput = Array.from(container.querySelectorAll('input')).find(
      (input) => input.getAttribute('placeholder') === 'Ej: 12500 o 12500,50'
    );

    expect(container.textContent).toContain('Producto seleccionado');
    expect(container.textContent).toContain('Mate camionero');
    expect(container.textContent).toContain('Precargado desde el producto actual.');
    expect(container.textContent).toContain('Precargado desde el ultimo ingreso.');
    expect(quantityInput).toHaveProperty('value', '');
    expect(supplierInput).toHaveProperty('value', '1000.5');
    expect(dateInput).toHaveProperty('value', '2026-07-28');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('hides personalization inputs for clothing products', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.category = 'clothing';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).not.toContain('Importe de personalización');
    expect(markup).not.toContain('Porcentaje de personalización');
  });

  it('paginates the filtered catalog six products per page', async () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';
    state.hubSummaryStatus = 'ready';
    state.catalogProducts = Array.from({ length: 7 }, (_, index) => ({
      reusableProductId: index + 1,
      category: 'jewelry' as const,
      name: `Producto ${index + 1}`,
      material: 'Plata',
      variant: `${index + 1}`,
      availableQuantity: index + 1,
      isOutOfStock: false,
      currentCashPriceCents: 100000,
      currentListPriceCents: 110000
    }));
    const bridge = createBridge();
    vi.mocked(bridge.catalog.list).mockResolvedValue({ recentProducts: [], products: state.catalogProducts });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CatalogStockPanel bridge={bridge} initialState={state} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Producto 1');
    expect(container.textContent).toContain('Producto 6');
    expect(container.textContent).not.toContain('Producto 7');

    await act(async () => {
      const nextButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Siguiente');
      if (!(nextButton instanceof HTMLButtonElement)) {
        throw new Error('Next button not found');
      }
      nextButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Producto 1');
    expect(container.textContent).toContain('Producto 7');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });
});
