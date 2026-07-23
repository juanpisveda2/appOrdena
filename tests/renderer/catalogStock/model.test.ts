import { describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import type { CatalogListResult } from '../../../src/shared/contracts/catalog';
import {
  buildSaveStockIntakeRequest,
  createCatalogStockActions,
  createInitialCatalogStockState,
  getPricingPreview,
  hasUnsavedChanges,
  type CatalogStockState
} from '../../../src/renderer/features/catalog-stock/model';

function createHarness(initialState = createInitialCatalogStockState('2026-07-14')) {
  let state = initialState;
  const setState = (
    update: CatalogStockState | ((current: CatalogStockState) => CatalogStockState)
  ) => {
    state = typeof update === 'function' ? update(state) : update;
  };

  return {
    getState: () => state,
    setState
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createBridge(overrides?: Partial<AppBridge>): AppBridge {
  const catalog = overrides?.catalog ?? {
    list: vi.fn().mockResolvedValue({ recentProducts: [], products: [] }),
    getProductDetail: vi.fn().mockResolvedValue({
      reusableProductId: 1,
      category: 'jewelry',
      name: 'Aros de plata',
      description: null,
      material: 'Plata',
      variant: '18 mm',
      availableQuantity: 1,
      currentCashPriceCents: 120000,
      currentListPriceCents: 125000,
      currentProfitPercentageBasisPoints: 1000,
      currentExpectedProfitCents: 10000,
      currentPersonalizationExpectedProfitCents: null,
      currentTotalExpectedProfitCents: 10000,
      recentIntakes: []
    }),
    search: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn()
  };
  const stock = overrides?.stock ?? {
    saveIntake: vi.fn()
  };

  return {
    health: overrides?.health ?? vi.fn(),
    catalog,
    stock,
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

describe('catalog stock renderer model', () => {
  it('loads the hub with an empty search and keeps the general catalog visible', async () => {
    const list = vi.fn().mockResolvedValue({
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
    });
    const bridge = createBridge({
      catalog: {
        list,
        getProductDetail: vi.fn(),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    await actions.loadCatalogHub();

    expect(list).toHaveBeenCalledWith({ query: '', category: 'all', limit: 200 });
    expect(harness.getState().hubError).toBeNull();
    expect(harness.getState().catalogProducts).toHaveLength(1);
  });

  it('combines the category filter with the typed search query', async () => {
    const list = vi.fn().mockResolvedValue({ recentProducts: [], products: [] });
    const bridge = createBridge({
      catalog: {
        list,
        getProductDetail: vi.fn(),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.setHubSearchQuery('  plata  ');
    actions.setCategoryFilter('jewelry');

    await actions.loadCatalogHub();

    expect(list).toHaveBeenCalledWith({ query: 'plata', category: 'jewelry', limit: 200 });
  });

  it('ignores stale hub responses so typing keeps the latest filtered catalog', async () => {
    const initialCatalogRequest = createDeferred<CatalogListResult>();
    const typedSearchRequest = createDeferred<CatalogListResult>();
    const list = vi
      .fn<AppBridge['catalog']['list']>()
      .mockImplementationOnce(() => initialCatalogRequest.promise)
      .mockImplementationOnce(() => typedSearchRequest.promise);
    const bridge = createBridge({
      catalog: {
        list,
        getProductDetail: vi.fn(),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    const initialLoad = actions.loadCatalogHub();

    actions.setHubSearchQuery('plata');
    const typedLoad = actions.loadCatalogHub();

    typedSearchRequest.resolve({
      recentProducts: [],
      products: [
        {
          reusableProductId: 2,
          category: 'jewelry',
          name: 'Aros de plata',
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 1,
          isOutOfStock: false,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000
        }
      ]
    });
    await typedLoad;

    initialCatalogRequest.resolve({
      recentProducts: [],
      products: [
        {
          reusableProductId: 1,
          category: 'mate',
          name: 'Mate camionero',
          material: 'Cuero',
          variant: 'Premium',
          availableQuantity: 4,
          isOutOfStock: false,
          currentCashPriceCents: 150000,
          currentListPriceCents: 165000
        }
      ]
    });
    await initialLoad;

    expect(harness.getState().hubSearchQuery).toBe('plata');
    expect(harness.getState().catalogProducts).toHaveLength(1);
    expect(harness.getState().catalogProducts[0]?.name).toBe('Aros de plata');
  });

  it('opens the existing-product intake flow with the product already selected', () => {
    const bridge = createBridge();
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewIntake({
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    });

    expect(harness.getState().view).toBe('new-intake');
    expect(harness.getState().intakeProduct?.reusableProductId).toBe(2);
  });

  it('auto-maps available quantity to the entered quantity in the separate intake form', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.name = 'Mate camionero';
    state.newProduct.material = 'Cuero';
    state.intakeForm.enteredQuantity = '3';
    state.intakeForm.supplierUnitCostCents = '1000,50';
    state.intakeForm.cashPriceCents = '1250';
    state.intakeForm.listPriceCents = '1300,75';
    state.intakeForm.profitPercentageBasisPoints = '12,5';

    expect(buildSaveStockIntakeRequest(state)).toMatchObject({
      enteredQuantity: 3,
      availableQuantity: 3,
      supplierUnitCostCents: 100050,
      cashPriceCents: 125000,
      listPriceCents: 130075,
      profitPercentageBasisPoints: 1250
    });
  });

  it('copies supplier cost into cash price until the user edits cash manually', () => {
    const bridge = createBridge();
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewProduct();
    actions.updateIntakeField('supplierUnitCostCents', '1000');
    expect(harness.getState().intakeForm.cashPriceCents).toBe('1000');

    actions.updateIntakeField('cashPriceCents', '1200');
    actions.updateIntakeField('supplierUnitCostCents', '1500');

    expect(harness.getState().intakeForm.cashPriceCents).toBe('1200');
  });

  it('suggests jewelry profit percentages from the selected controlled material', () => {
    const bridge = createBridge();
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewProduct();
    actions.updateJewelryMaterialOption('silver');
    expect(harness.getState().newProduct.material).toBe('Plata');
    expect(harness.getState().intakeForm.profitPercentageBasisPoints).toBe('10');

    actions.updateJewelryMaterialOption('gold');
    expect(harness.getState().newProduct.material).toBe('Oro');
    expect(harness.getState().intakeForm.profitPercentageBasisPoints).toBe('3');
  });

  it('keeps personalization out of clothing payloads and still shows renderer pricing previews', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.category = 'clothing';
    state.newProduct.name = 'Remera básica';
    state.newProduct.material = 'Algodón';
    state.newProduct.variant = 'M';
    state.intakeForm.enteredQuantity = '1';
    state.intakeForm.supplierUnitCostCents = '200';
    state.intakeForm.cashPriceCents = '250';
    state.intakeForm.listPriceCents = '280';
    state.intakeForm.profitPercentageBasisPoints = '10';

    expect(buildSaveStockIntakeRequest(state)).toEqual({
      newReusableProduct: {
        category: 'clothing',
        name: 'Remera básica',
        description: null,
        material: 'Algodón',
        variant: 'M'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 20000,
      cashPriceCents: 25000,
      listPriceCents: 28000,
      profitPercentageBasisPoints: 1000,
      intakeDate: '2026-07-14',
      notes: null,
      allowDuplicate: false
    });

    expect(getPricingPreview(state)).toMatchObject({
      expectedProfitCents: 2000,
      totalExpectedProfitCents: 2000
    });
    expect(getPricingPreview(state)).not.toHaveProperty('suggestedPriceCents');
  });

  it('allows clothing products to persist with empty material', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.category = 'clothing';
    state.newProduct.name = 'Remera básica';
    state.newProduct.variant = 'M';
    state.intakeForm.enteredQuantity = '1';
    state.intakeForm.supplierUnitCostCents = '200';
    state.intakeForm.cashPriceCents = '200';
    state.intakeForm.listPriceCents = '280';
    state.intakeForm.profitPercentageBasisPoints = '10';

    expect(buildSaveStockIntakeRequest(state)).toMatchObject({
      newReusableProduct: expect.objectContaining({
        category: 'clothing',
        material: ''
      })
    });
  });

  it('reuses the product form for editing and saves catalog-only changes without touching history', async () => {
    const updateProduct = vi.fn().mockResolvedValue({ reusableProductId: 1 });
    const getProductDetail = vi
      .fn()
      .mockResolvedValueOnce({
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros de plata',
        description: null,
        material: 'Plata',
        variant: '18 mm',
        availableQuantity: 1,
        currentCashPriceCents: 120000,
        currentListPriceCents: 125000,
        currentProfitPercentageBasisPoints: 1000,
        currentExpectedProfitCents: 10000,
        currentPersonalizationExpectedProfitCents: null,
        currentTotalExpectedProfitCents: 10000,
        recentIntakes: []
      })
      .mockResolvedValueOnce({
        reusableProductId: 1,
        category: 'jewelry',
        name: 'Aros finos',
        description: 'Actualizado',
        material: 'Oro',
        variant: '',
        availableQuantity: 1,
        currentCashPriceCents: 120000,
        currentListPriceCents: 125000,
        currentProfitPercentageBasisPoints: 1000,
        currentExpectedProfitCents: 10000,
        currentPersonalizationExpectedProfitCents: null,
        currentTotalExpectedProfitCents: 10000,
        recentIntakes: []
      });
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        getProductDetail,
        search: vi.fn(),
        updateProduct,
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    await actions.openProductDetail(1);
    actions.openEditProduct();
    actions.updateNewProduct('name', 'Aros finos');
    actions.updateJewelryMaterialOption('gold');
    actions.updateNewProduct('variant', '');
    actions.updateNewProduct('description', 'Actualizado');
    await actions.saveProductChanges();

    expect(updateProduct).toHaveBeenCalledWith({
      reusableProductId: 1,
      product: {
        category: 'jewelry',
        name: 'Aros finos',
        description: 'Actualizado',
        material: 'Oro',
        variant: ''
      }
    });
    expect(harness.getState().view).toBe('detail');
    expect(harness.getState().detailProduct?.name).toBe('Aros finos');
  });

  it('keeps the duplicate confirmation flow in the renderer and reopens the saved product detail', async () => {
    const saveIntake = vi
      .fn<AppBridge['stock']['saveIntake']>()
      .mockResolvedValueOnce({
        kind: 'duplicate-warning',
        matches: [
          {
            reusableProductId: 1,
            category: 'jewelry',
            name: 'Aros de plata',
            material: 'Plata',
            variant: '18 mm',
            availableQuantity: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        kind: 'saved',
        stockIntakeId: 2,
        reusableProductId: 3
      });
    const getProductDetail = vi.fn().mockResolvedValue({
      reusableProductId: 3,
      category: 'jewelry',
      name: 'Aros de plata',
      description: null,
      material: 'Plata',
      variant: '18 mm',
      availableQuantity: 1,
      currentCashPriceCents: 120000,
      currentListPriceCents: 125000,
      currentProfitPercentageBasisPoints: 1000,
      currentExpectedProfitCents: 10000,
      currentPersonalizationExpectedProfitCents: null,
      currentTotalExpectedProfitCents: 10000,
      recentIntakes: []
    });
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        getProductDetail,
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      },
      stock: {
        saveIntake
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewProduct();
    actions.updateNewProduct('name', 'Aros de plata');
    actions.updateNewProduct('material', 'Plata');
    actions.updateNewProduct('variant', '18 mm');
    actions.updateIntakeField('enteredQuantity', '1');
    actions.updateIntakeField('supplierUnitCostCents', '1000');
    actions.updateIntakeField('cashPriceCents', '1200');
    actions.updateIntakeField('listPriceCents', '1250');
    actions.updateIntakeField('profitPercentageBasisPoints', '10');

    await actions.submit();

    expect(harness.getState().duplicateWarning?.matches).toHaveLength(1);

    await actions.confirmDuplicateWarning();

    expect(saveIntake).toHaveBeenNthCalledWith(2, expect.objectContaining({ allowDuplicate: true }));
    expect(getProductDetail).toHaveBeenCalledWith({ reusableProductId: 3, recentIntakesLimit: 5 });
    expect(harness.getState().view).toBe('detail');
    expect(harness.getState().detailProduct?.reusableProductId).toBe(3);
  });

  it('shows user-friendly validation text without internal field names', () => {
    const state = createInitialCatalogStockState('2026-07-14');
    state.view = 'new-product';
    state.newProduct.name = 'Aros de plata';
    state.newProduct.material = 'Plata';
    state.intakeForm.enteredQuantity = '1';
    state.intakeForm.profitPercentageBasisPoints = '10';

    expect(() => buildSaveStockIntakeRequest(state)).toThrowError(
      'Completá el costo unitario del proveedor.'
    );
  });

  it('warns before leaving a dirty form and can block navigation', () => {
    const bridge = createBridge();
    const harness = createHarness();
    const confirmLeave = vi.fn().mockReturnValue(false);
    const actions = createCatalogStockActions({ bridge, ...harness, confirmLeave });

    actions.openNewProduct();
    actions.updateNewProduct('name', 'Aros de plata');

    expect(hasUnsavedChanges(harness.getState())).toBe(true);

    actions.goToHub();

    expect(confirmLeave).toHaveBeenCalledWith('Hay cambios sin guardar. ¿Querés salir igual?');
    expect(harness.getState().view).toBe('new-product');
  });

  it('confirms deletion with the product name and removes it from the active catalog safely', async () => {
    const deleteProduct = vi.fn().mockResolvedValue({ reusableProductId: 1 });
    const list = vi.fn().mockResolvedValue({ recentProducts: [], products: [] });
    const bridge = createBridge({
      catalog: {
        list,
        getProductDetail: vi.fn().mockResolvedValue({
          reusableProductId: 1,
          category: 'jewelry',
          name: 'Aros de plata',
          description: null,
          material: 'Plata',
          variant: '18 mm',
          availableQuantity: 1,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000,
          currentProfitPercentageBasisPoints: 1000,
          currentExpectedProfitCents: 10000,
          currentPersonalizationExpectedProfitCents: null,
          currentTotalExpectedProfitCents: 10000,
          recentIntakes: []
        }),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct
      }
    });
    const harness = createHarness();
    const confirmDeleteProduct = vi.fn().mockReturnValue(true);
    const actions = createCatalogStockActions({ bridge, ...harness, confirmDeleteProduct });

    await actions.openProductDetail(1);
    await actions.deleteProduct();

    expect(confirmDeleteProduct).toHaveBeenCalledWith('¿Querés eliminar "Aros de plata" del catálogo activo?');
    expect(deleteProduct).toHaveBeenCalledWith({ reusableProductId: 1 });
    expect(harness.getState().view).toBe('hub');
    expect(harness.getState().submitMessage).toContain('historial');
  });
});
