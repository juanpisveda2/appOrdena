import { afterEach, describe, expect, it, vi } from 'vitest';
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
      currentCashExpectedProfitCents: 12000,
      currentListExpectedProfitCents: 12500,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 12000,
      currentListTotalExpectedProfitCents: 12500,
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('loads the lightweight hub summary from existing sales and consignments sources', async () => {
    const listHistory = vi.fn().mockResolvedValue([
      {
        saleId: 1,
        saleNumber: 1,
        saleDate: '2026-07-14',
        status: 'pending_payment',
        totalCents: 120000,
        paidCents: 0,
        balanceCents: 120000,
        customerName: 'Ana',
        customerPhoneText: null,
        totalProfitCents: 25000
      },
      {
        saleId: 2,
        saleNumber: 2,
        saleDate: '2026-07-15',
        status: 'partial_payment',
        totalCents: 150000,
        paidCents: 50000,
        balanceCents: 100000,
        customerName: 'Luz',
        customerPhoneText: null,
        totalProfitCents: 30000
      },
      {
        saleId: 3,
        saleNumber: 3,
        saleDate: '2026-07-16',
        status: 'paid',
        totalCents: 100000,
        paidCents: 100000,
        balanceCents: 0,
        customerName: null,
        customerPhoneText: null,
        totalProfitCents: 20000
      }
    ]);
    const listPendingItems = vi.fn().mockResolvedValue([
      {
        saleItemId: 1,
        saleId: 1,
        saleStatus: 'pending_payment',
        productName: 'Aros',
        saleNumber: 1,
        saleDate: '2026-07-14',
        buyerName: 'Ana',
        amountCents: 90000,
        gainCents: 30000
      },
      {
        saleItemId: 2,
        saleId: 2,
        saleStatus: 'partial_payment',
        productName: 'Mate',
        saleNumber: 2,
        saleDate: '2026-07-15',
        buyerName: 'Luz',
        amountCents: 70000,
        gainCents: 20000
      }
    ]);
    const bridge = createBridge({
      sales: {
        listHistory,
        getById: vi.fn(),
        confirmDraft: vi.fn(),
        registerPayment: vi.fn(),
        cancelPayment: vi.fn(),
        assignCustomerForPaymentRecovery: vi.fn(),
        cancelSale: vi.fn()
      },
      consignments: {
        listPendingItems,
        confirmBatch: vi.fn(),
        listBatchHistory: vi.fn(),
        getBatchDetail: vi.fn(),
        exportBatchExcel: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    await actions.loadHubSummary();

    expect(listHistory).toHaveBeenCalledWith({ limit: 100 });
    expect(listPendingItems).toHaveBeenCalledWith({ limit: 200 });
    expect(harness.getState().pendingSalesCount).toBe(2);
    expect(harness.getState().pendingSettlementCount).toBe(2);
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

  it('opens the existing-product intake flow with current product defaults and today\'s date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));

    const bridge = createBridge({
      catalog: {
        list: vi.fn().mockResolvedValue({ recentProducts: [], products: [] }),
        getProductDetail: vi.fn().mockResolvedValue({
          reusableProductId: 2,
          category: 'mate',
          name: 'Mate camionero',
          description: null,
          material: 'Cuero',
          variant: 'Premium',
          availableQuantity: 4,
          currentCashPriceCents: 120000,
          currentListPriceCents: 125000,
          currentProfitPercentageBasisPoints: 1000,
          currentCashExpectedProfitCents: 12000,
          currentListExpectedProfitCents: 12500,
          currentPersonalizationExpectedProfitCents: null,
          currentCashTotalExpectedProfitCents: 12000,
          currentListTotalExpectedProfitCents: 12500,
          recentIntakes: []
        }),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness(createInitialCatalogStockState('2026-07-14'));
    const actions = createCatalogStockActions({ bridge, ...harness });

    await actions.openNewIntake({
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    });

    expect(harness.getState().view).toBe('new-intake');
    expect(harness.getState().intakeProduct?.reusableProductId).toBe(2);
    expect(harness.getState().intakeForm.enteredQuantity).toBe('');
    expect(harness.getState().intakeForm.supplierUnitCostCents).toBe('');
    expect(harness.getState().intakeForm.cashPriceCents).toBe('1200');
    expect(harness.getState().intakeForm.listPriceCents).toBe('1250');
    expect(harness.getState().intakeForm.profitPercentageBasisPoints).toBe('10');
    expect(harness.getState().intakeForm.intakeDate).toBe('2026-07-28');
  });

  it('falls back to the latest intake supplier cost when reopening an existing product intake', async () => {
    const bridge = createBridge({
      catalog: {
        list: vi.fn().mockResolvedValue({ recentProducts: [], products: [] }),
        getProductDetail: vi.fn().mockResolvedValue({
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
              intakeDate: '2026-07-10',
              notes: 'Costo vigente.'
            }
          ]
        }),
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    await actions.openNewIntake({
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    });

    expect(harness.getState().intakeForm.supplierUnitCostCents).toBe('1000.5');
    expect(harness.getState().intakeForm.notes).toBe('');
  });

  it('confirms an existing-product save as an additional intake and shows the real resulting stock', async () => {
    const saveIntake = vi.fn().mockResolvedValue({
      kind: 'saved',
      stockIntakeId: 8,
      reusableProductId: 2
    });
    const getProductDetail = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        reusableProductId: 2,
        category: 'mate',
        name: 'Mate camionero',
        description: null,
        material: 'Cuero',
        variant: 'Premium',
        availableQuantity: 7,
        currentCashPriceCents: 150000,
        currentListPriceCents: 165000,
        currentProfitPercentageBasisPoints: 1200,
        currentCashExpectedProfitCents: 18000,
        currentListExpectedProfitCents: 19800,
        currentPersonalizationExpectedProfitCents: null,
        currentCashTotalExpectedProfitCents: 18000,
        currentListTotalExpectedProfitCents: 19800,
        recentIntakes: []
      });
    const bridge = createBridge({
      catalog: {
        list: vi.fn().mockResolvedValue({ recentProducts: [], products: [] }),
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

    await actions.openNewIntake({
      reusableProductId: 2,
      category: 'mate',
      name: 'Mate camionero',
      material: 'Cuero',
      variant: 'Premium'
    });
    actions.updateIntakeField('enteredQuantity', '3');
    actions.updateIntakeField('supplierUnitCostCents', '1000');
    actions.updateIntakeField('cashPriceCents', '1500');
    actions.updateIntakeField('listPriceCents', '1650');
    actions.updateIntakeField('profitPercentageBasisPoints', '12');

    await actions.submit();

    expect(saveIntake).toHaveBeenCalledWith(
      expect.objectContaining({ reusableProductId: 2, enteredQuantity: 3, availableQuantity: 3 })
    );
    expect(harness.getState().submitMessage).toBe(
      'Registramos un ingreso adicional de 3 unidades para Mate camionero · Premium. Quedaron 7 unidades disponibles ahora.'
    );
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
      cashExpectedProfitCents: 2500,
      listExpectedProfitCents: 2800
    });
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
        currentCashExpectedProfitCents: 12000,
        currentListExpectedProfitCents: 12500,
        currentPersonalizationExpectedProfitCents: null,
        currentCashTotalExpectedProfitCents: 12000,
        currentListTotalExpectedProfitCents: 12500,
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
        currentCashExpectedProfitCents: 12000,
        currentListExpectedProfitCents: 12500,
        currentPersonalizationExpectedProfitCents: null,
        currentCashTotalExpectedProfitCents: 12000,
        currentListTotalExpectedProfitCents: 12500,
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
      currentCashExpectedProfitCents: 12000,
      currentListExpectedProfitCents: 12500,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 12000,
      currentListTotalExpectedProfitCents: 12500,
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

  it('checks similar products earlier while drafting a new product', async () => {
    const search = vi.fn().mockResolvedValue([
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
        category: 'mate',
        name: 'Mate camionero',
        material: 'Cuero',
        variant: 'Premium',
        availableQuantity: 1,
        isOutOfStock: false
      }
    ]);
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        getProductDetail: vi.fn(),
        search,
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewProduct();
    actions.updateNewProduct('name', 'Aros de plata');
    actions.updateNewProduct('material', 'Plata');
    actions.updateNewProduct('variant', '18 mm');

    await actions.loadEarlyDuplicateMatches();

    expect(search).toHaveBeenCalledWith({ query: 'Aros de plata Plata 18 mm', limit: 8 });
    expect(harness.getState().earlyDuplicateCheck.matches).toHaveLength(1);
    expect(harness.getState().earlyDuplicateCheck.matches[0]?.reusableProductId).toBe(1);
  });

  it('redirects the duplicate shortcut into the existing new-intake flow', async () => {
    const getProductDetail = vi.fn().mockResolvedValue({
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
      currentCashExpectedProfitCents: 12000,
      currentListExpectedProfitCents: 12500,
      currentPersonalizationExpectedProfitCents: null,
      currentCashTotalExpectedProfitCents: 12000,
      currentListTotalExpectedProfitCents: 12500,
      recentIntakes: []
    });
    const bridge = createBridge({
      catalog: {
        list: vi.fn(),
        getProductDetail,
        search: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      }
    });
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.openNewProduct();
    harness.setState((current) => ({
      ...current,
      earlyDuplicateCheck: {
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
      }
    }));

    await actions.openDuplicateMatch(1);

    expect(getProductDetail).toHaveBeenCalledWith({ reusableProductId: 1, recentIntakesLimit: 5 });
    expect(harness.getState().view).toBe('new-intake');
    expect(harness.getState().intakeProduct?.reusableProductId).toBe(1);
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

  it('resets pagination when search or category changes', () => {
    const bridge = createBridge();
    const harness = createHarness();
    const actions = createCatalogStockActions({ bridge, ...harness });

    actions.setHubPage(3);
    expect(harness.getState().hubPage).toBe(3);

    actions.setHubSearchQuery('plata');
    expect(harness.getState().hubPage).toBe(1);

    actions.setHubPage(2);
    actions.setCategoryFilter('jewelry');
    expect(harness.getState().hubPage).toBe(1);
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
          currentCashExpectedProfitCents: 12000,
          currentListExpectedProfitCents: 12500,
          currentPersonalizationExpectedProfitCents: null,
          currentCashTotalExpectedProfitCents: 12000,
          currentListTotalExpectedProfitCents: 12500,
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
