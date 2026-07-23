import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import { CatalogStockPanel } from '../../../src/renderer/features/catalog-stock/CatalogStockPanel';
import { createInitialCatalogStockState } from '../../../src/renderer/features/catalog-stock/model';

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

describe('CatalogStockPanel', () => {
  it('renders the hub as a single work list with search and category filters', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';
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

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Catálogo y stock');
    expect(markup).toContain('Agregar producto');
    expect(markup).toContain('Volver');
    expect(markup).toContain('Buscá, filtrá y consultá productos del catálogo.');
    expect(markup).toContain('Buscá por nombre, categoría, material o variante');
    expect(markup).toContain('Todas');
    expect(markup).toContain('Joyas');
    expect(markup).toContain('Mates');
    expect(markup).toContain('Ropa');
    expect(markup).not.toContain('Productos recientes');
    expect(markup).not.toContain('Catálogo general');
    expect(markup).toContain('Ver producto');
    expect(markup).toContain('Sin stock');
  });

  it('renders the empty catalog state without an initial search error', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'hub';
    state.hubStatus = 'ready';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('No hay productos para mostrar.');
    expect(markup).not.toContain('Ingresá un término de búsqueda para continuar.');
  });

  it('renders product detail with back action, stock summary, prices, profit percentage, and recent intakes', () => {
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
      currentExpectedProfitCents: 10000,
      currentPersonalizationExpectedProfitCents: 250,
      currentTotalExpectedProfitCents: 10250,
      recentIntakes: [
        {
          stockIntakeId: 4,
          enteredQuantity: 2,
          availableQuantity: 2,
          supplierUnitCostCents: 100000,
          cashPriceCents: 120000,
          listPriceCents: 125000,
          profitPercentageBasisPoints: 1000,
          expectedProfitCents: 10000,
          personalizationAmountCents: 5000,
          personalizationPercentageBasisPoints: 500,
          personalizationExpectedProfitCents: 250,
          totalExpectedProfitCents: 10250,
          intakeDate: '2026-07-14',
          notes: 'Con grabado.'
        }
      ]
    };

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Volver al catálogo');
    expect(markup).toContain('Resumen del producto');
    expect(markup).toContain('Stock disponible');
    expect(markup).toContain('Precio de contado actual');
    expect(markup).toContain('Precio de lista actual');
    expect(markup).toContain('Porcentaje de ganancia actual');
    expect(markup).toContain('10%');
    expect(markup).toContain('Ingresos recientes');
    expect(markup).toContain('Registrar nuevo ingreso');
    expect(markup).toContain('Eliminar producto');
  });

  it('renders the separate new-product flow with the automatic available-quantity rule and brief summary', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.name = 'Aros de plata';
    state.newProduct.material = 'Plata';
    state.intakeForm.enteredQuantity = '1';
    state.intakeForm.supplierUnitCostCents = '1000';
    state.intakeForm.profitPercentageBasisPoints = '10';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Agregar producto');
    expect(markup).toContain('Creá el producto y registrá su primer ingreso en una pantalla separada.');
    expect(markup).toContain('La cantidad disponible inicial será igual a la cantidad ingresada.');
    expect(markup).not.toContain('Cantidad disponible ahora');
    expect(markup).toContain('Resumen esperado');
    expect(markup).toContain('Ganancia');
    expect(markup).toContain('Ganancia total');
    expect(markup).not.toContain('Precio sugerido');
  });

  it('renders the existing-product intake flow with the product already selected', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-intake';
    state.intakeProduct = {
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    };

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).toContain('Registrar nuevo ingreso');
    expect(markup).toContain('Este ingreso ya se abre con el producto seleccionado.');
    expect(markup).toContain('Producto seleccionado');
    expect(markup).toContain('Mate camionero');
  });

  it('hides personalization inputs for clothing products', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.category = 'clothing';

    const markup = renderToStaticMarkup(<CatalogStockPanel bridge={createBridge()} initialState={state} />);

    expect(markup).not.toContain('Importe de personalización');
    expect(markup).not.toContain('Porcentaje de personalización');
  });
});
