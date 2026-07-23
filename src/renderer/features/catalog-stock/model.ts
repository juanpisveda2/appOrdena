import { calculatePricingSummary } from '../../../shared/catalog/pricing';
import type { AppBridge } from '../../../shared/contracts/app';
import type {
  CatalogCategoryFilter,
  CatalogListItem,
  CatalogListResult,
  CatalogProductDetail,
  DuplicateCandidate,
  ReusableProductCategory,
  SaveStockIntakeRequest,
  SavedStockIntakeResult,
  UpdateReusableProductRequest
} from '../../../shared/contracts/catalog';

export type CatalogStockView = 'hub' | 'detail' | 'new-product' | 'new-intake' | 'edit-product';
export type JewelryMaterialOption = 'silver' | 'gold' | 'other' | '';

export interface CatalogProductReference {
  reusableProductId: number;
  category: ReusableProductCategory;
  name: string;
  material: string;
  variant: string;
}

export interface CatalogStockState {
  view: CatalogStockView;
  hubSearchQuery: string;
  categoryFilter: CatalogCategoryFilter;
  hubStatus: 'idle' | 'loading' | 'ready' | 'error';
  hubError: string | null;
  catalogProducts: CatalogListItem[];
  detailStatus: 'idle' | 'loading' | 'ready' | 'error';
  detailError: string | null;
  detailProduct: CatalogProductDetail | null;
  intakeProduct: CatalogProductReference | null;
  newProduct: {
    category: ReusableProductCategory;
    name: string;
    material: string;
    jewelryMaterialOption: JewelryMaterialOption;
    variant: string;
    description: string;
  };
  intakeForm: {
    enteredQuantity: string;
    supplierUnitCostCents: string;
    cashPriceCents: string;
    listPriceCents: string;
    profitPercentageBasisPoints: string;
    intakeDate: string;
    notes: string;
  };
  intakeAutomation: {
    cashPriceEditedManually: boolean;
    lastSuggestedCashPriceCents: string;
    profitPercentageEditedManually: boolean;
    lastSuggestedProfitPercentageBasisPoints: string;
  };
  submitStatus: 'idle' | 'saving' | 'saved' | 'error';
  submitMessage: string | null;
  duplicateWarning: {
    matches: DuplicateCandidate[];
    pendingRequest: SaveStockIntakeRequest;
  } | null;
  lastSaved: SavedStockIntakeResult | null;
}

export interface PricingPreview {
  expectedProfitCents: number;
  totalExpectedProfitCents: number;
}

export interface CatalogStockSubmitReadiness {
  canSubmit: boolean;
  reason: string | null;
}

export type CatalogStockStateSetter = (
  update: CatalogStockState | ((current: CatalogStockState) => CatalogStockState)
) => void;

interface CatalogStockActionDependencies {
  bridge: AppBridge;
  getState: () => CatalogStockState;
  setState: CatalogStockStateSetter;
  confirmLeave?: (message: string) => boolean;
  confirmDeleteProduct?: (message: string) => boolean;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2
});

const percentageFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const categoryLabels: Record<ReusableProductCategory, string> = {
  jewelry: 'Joyas',
  mate: 'Mates',
  clothing: 'Ropa'
};

const materialLabels: Record<string, string> = {
  gold: 'Oro',
  silver: 'Plata',
  steel: 'Acero',
  leather: 'Cuero',
  cotton: 'Algodón'
};

const JEWELRY_MATERIAL_VALUES: Record<Exclude<JewelryMaterialOption, ''>, string> = {
  silver: 'Plata',
  gold: 'Oro',
  other: ''
};

const JEWELRY_PROFIT_SUGGESTIONS: Record<Exclude<JewelryMaterialOption, ''>, string> = {
  silver: '10',
  gold: '3',
  other: '10'
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialIntakeForm(now: string): CatalogStockState['intakeForm'] {
  return {
    enteredQuantity: '',
    supplierUnitCostCents: '',
    cashPriceCents: '',
    listPriceCents: '',
    profitPercentageBasisPoints: '',
    intakeDate: now,
    notes: ''
  };
}

function createInitialIntakeAutomation(): CatalogStockState['intakeAutomation'] {
  return {
    cashPriceEditedManually: false,
    lastSuggestedCashPriceCents: '',
    profitPercentageEditedManually: false,
    lastSuggestedProfitPercentageBasisPoints: ''
  };
}

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(',', '.');
}

function parseDecimalInput(
  value: string,
  fieldName: string,
  { maxDecimals, emptyMessage, invalidMessage }: { maxDecimals: number; emptyMessage: string; invalidMessage: string }
): number {
  const normalized = normalizeDecimalInput(value);

  if (normalized.length === 0) {
    throw new Error(emptyMessage);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(invalidMessage);
  }

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} debe ser un valor válido.`);
  }

  const [, decimalPart = ''] = normalized.split('.');

  if (decimalPart.length > maxDecimals) {
    throw new Error(invalidMessage);
  }

  return parsed;
}

function parseIntegerField(value: string, fieldName: string): number {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`Completá ${fieldName.toLowerCase()}.`);
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} debe ser un número entero.`);
  }

  return parsed;
}

function createProductReference(product: CatalogProductReference): CatalogProductReference {
  return {
    reusableProductId: product.reusableProductId,
    category: product.category,
    name: product.name,
    material: product.material,
    variant: product.variant
  };
}

function inferJewelryMaterialOption(material: string): JewelryMaterialOption {
  const normalizedMaterial = material.trim().toLowerCase();

  if (normalizedMaterial === 'plata') {
    return 'silver';
  }

  if (normalizedMaterial === 'oro') {
    return 'gold';
  }

  return normalizedMaterial.length > 0 ? 'other' : '';
}

function syncCashPriceWithSupplier(
  intakeForm: CatalogStockState['intakeForm'],
  intakeAutomation: CatalogStockState['intakeAutomation'],
  supplierUnitCostCents: string
): Pick<CatalogStockState, 'intakeForm' | 'intakeAutomation'> {
  const shouldSyncCashPrice =
    !intakeAutomation.cashPriceEditedManually ||
    intakeForm.cashPriceCents === intakeAutomation.lastSuggestedCashPriceCents;

  return {
    intakeForm: {
      ...intakeForm,
      supplierUnitCostCents,
      cashPriceCents: shouldSyncCashPrice ? supplierUnitCostCents : intakeForm.cashPriceCents
    },
    intakeAutomation: {
      ...intakeAutomation,
      lastSuggestedCashPriceCents: supplierUnitCostCents
    }
  };
}

function suggestProfitPercentage(
  intakeForm: CatalogStockState['intakeForm'],
  intakeAutomation: CatalogStockState['intakeAutomation'],
  suggestedProfitPercentageBasisPoints: string
): Pick<CatalogStockState, 'intakeForm' | 'intakeAutomation'> {
  const shouldApplySuggestion =
    !intakeAutomation.profitPercentageEditedManually ||
    intakeForm.profitPercentageBasisPoints === intakeAutomation.lastSuggestedProfitPercentageBasisPoints;

  return {
    intakeForm: {
      ...intakeForm,
      profitPercentageBasisPoints: shouldApplySuggestion
        ? suggestedProfitPercentageBasisPoints
        : intakeForm.profitPercentageBasisPoints
    },
    intakeAutomation: {
      ...intakeAutomation,
      lastSuggestedProfitPercentageBasisPoints: suggestedProfitPercentageBasisPoints
    }
  };
}

function applyCategoryMaterialDefaults(state: CatalogStockState): CatalogStockState {
  if (state.newProduct.category !== 'jewelry' || !state.newProduct.jewelryMaterialOption) {
    return state;
  }

  const nextMaterial =
    state.newProduct.jewelryMaterialOption === 'other'
      ? state.newProduct.material
      : JEWELRY_MATERIAL_VALUES[state.newProduct.jewelryMaterialOption];
  const nextState = {
    ...state,
    newProduct: {
      ...state.newProduct,
      material: nextMaterial
    }
  };

  return {
    ...nextState,
    ...suggestProfitPercentage(
      nextState.intakeForm,
      nextState.intakeAutomation,
      JEWELRY_PROFIT_SUGGESTIONS[state.newProduct.jewelryMaterialOption]
    )
  };
}

function getResolvedProductMaterial(state: CatalogStockState): string {
  if (state.newProduct.category !== 'jewelry') {
    return state.newProduct.material.trim();
  }

  if (state.newProduct.jewelryMaterialOption === 'silver') {
    return 'Plata';
  }

  if (state.newProduct.jewelryMaterialOption === 'gold') {
    return 'Oro';
  }

  return state.newProduct.material.trim();
}

function resetDraftState(state: CatalogStockState, now?: string): CatalogStockState {
  const resolvedNow = now ?? state.intakeForm.intakeDate ?? todayIsoDate();

  return {
    ...state,
    newProduct: {
      category: 'jewelry',
      name: '',
      material: '',
      jewelryMaterialOption: '',
      variant: '',
      description: ''
    },
    intakeForm: createInitialIntakeForm(resolvedNow),
    intakeAutomation: createInitialIntakeAutomation(),
    submitStatus: 'idle',
    submitMessage: null,
    duplicateWarning: null,
    lastSaved: null
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function formatCurrencyFromCents(amountCents: number): string {
  return currencyFormatter.format(amountCents / 100);
}

export function formatPercentageFromBasisPoints(basisPoints: number): string {
  return `${percentageFormatter.format(basisPoints / 100)}%`;
}

export function tryParseCurrencyInputToCents(value: string): number | null {
  try {
    const amount = parseDecimalInput(value, 'El monto', {
      maxDecimals: 2,
      emptyMessage: 'Completá el monto.',
      invalidMessage: 'Ingresá un monto válido en pesos. Podés usar coma o punto para los centavos.'
    });

    return Math.round(amount * 100);
  } catch {
    return null;
  }
}

export function parseCurrencyInputToCents(value: string, fieldName: string): number {
  const amount = parseDecimalInput(value, fieldName, {
    maxDecimals: 2,
    emptyMessage: `Completá ${fieldName.toLowerCase()}.`,
    invalidMessage: `${fieldName} debe ser un monto válido en pesos.`
  });

  return Math.round(amount * 100);
}

export function tryParsePercentageInputToBasisPoints(value: string): number | null {
  try {
    const amount = parseDecimalInput(value, 'El porcentaje', {
      maxDecimals: 2,
      emptyMessage: 'Completá el porcentaje.',
      invalidMessage: 'Ingresá un porcentaje válido. Podés usar hasta dos decimales.'
    });

    return Math.round(amount * 100);
  } catch {
    return null;
  }
}

export function parsePercentageInputToBasisPoints(value: string, fieldName: string): number {
  const amount = parseDecimalInput(value, fieldName, {
    maxDecimals: 2,
    emptyMessage: `Completá ${fieldName.toLowerCase()}.`,
    invalidMessage: `${fieldName} debe ser un porcentaje válido.`
  });

  return Math.round(amount * 100);
}

export function formatCategoryLabel(category: ReusableProductCategory): string {
  return categoryLabels[category];
}

export function formatMaterialLabel(material: string): string {
  const normalizedMaterial = material.trim().toLowerCase();

  return materialLabels[normalizedMaterial] ?? material;
}

export function formatVariantLabel(variant: string): string {
  return variant.trim().length > 0 ? variant : 'Sin variante';
}

export function createInitialCatalogStockState(now = todayIsoDate()): CatalogStockState {
  return {
    view: 'hub',
    hubSearchQuery: '',
    categoryFilter: 'all',
    hubStatus: 'idle',
    hubError: null,
    catalogProducts: [],
    detailStatus: 'idle',
    detailError: null,
    detailProduct: null,
    intakeProduct: null,
    newProduct: {
      category: 'jewelry',
      name: '',
      material: '',
      jewelryMaterialOption: '',
      variant: '',
      description: ''
    },
    intakeForm: createInitialIntakeForm(now),
    intakeAutomation: createInitialIntakeAutomation(),
    submitStatus: 'idle',
    submitMessage: null,
    duplicateWarning: null,
    lastSaved: null
  };
}

export function getActiveCategory(state: CatalogStockState): ReusableProductCategory {
  if (state.view === 'new-intake' && state.intakeProduct) {
    return state.intakeProduct.category;
  }

  return state.newProduct.category;
}

export function getPricingPreview(state: CatalogStockState): PricingPreview | null {
  if (state.view !== 'new-product' && state.view !== 'new-intake') {
    return null;
  }

  const supplierCost = tryParseCurrencyInputToCents(state.intakeForm.supplierUnitCostCents);
  const basisPoints = tryParsePercentageInputToBasisPoints(state.intakeForm.profitPercentageBasisPoints);

  if (supplierCost == null || basisPoints == null) {
    return null;
  }

  const summary = calculatePricingSummary({
    supplierUnitCostCents: supplierCost,
    profitPercentageBasisPoints: basisPoints
  });

  return {
    expectedProfitCents: summary.expectedProfitCents,
    totalExpectedProfitCents: summary.totalExpectedProfitCents
  };
}

export function hasUnsavedChanges(state: CatalogStockState): boolean {
  if (state.view === 'new-product') {
    return !(
      state.newProduct.category === 'jewelry' &&
      isBlank(state.newProduct.name) &&
      isBlank(state.newProduct.material) &&
      isBlank(state.newProduct.variant) &&
      isBlank(state.newProduct.description) &&
      isBlank(state.intakeForm.enteredQuantity) &&
      isBlank(state.intakeForm.supplierUnitCostCents) &&
      isBlank(state.intakeForm.cashPriceCents) &&
      isBlank(state.intakeForm.listPriceCents) &&
      isBlank(state.intakeForm.profitPercentageBasisPoints) &&
      isBlank(state.intakeForm.notes)
    );
  }

  if (state.view === 'edit-product') {
    return !(
      state.detailProduct != null &&
      state.newProduct.category === state.detailProduct.category &&
      state.newProduct.name.trim() === state.detailProduct.name &&
      getResolvedProductMaterial(state) === state.detailProduct.material &&
      state.newProduct.variant.trim() === state.detailProduct.variant &&
      state.newProduct.description.trim() === (state.detailProduct.description ?? '')
    );
  }

  if (state.view === 'new-intake') {
    return !(
      isBlank(state.intakeForm.enteredQuantity) &&
      isBlank(state.intakeForm.supplierUnitCostCents) &&
      isBlank(state.intakeForm.cashPriceCents) &&
      isBlank(state.intakeForm.listPriceCents) &&
      isBlank(state.intakeForm.profitPercentageBasisPoints) &&
      isBlank(state.intakeForm.notes)
    );
  }

  return false;
}

export function getSubmitReadiness(state: CatalogStockState): CatalogStockSubmitReadiness {
  if (state.view !== 'new-product' && state.view !== 'new-intake') {
    return {
      canSubmit: false,
      reason: null
    };
  }

  if (state.submitStatus === 'saving') {
    return {
      canSubmit: false,
      reason: 'Estamos guardando este ingreso.'
    };
  }

  if (state.duplicateWarning) {
    return {
      canSubmit: false,
      reason: 'Resolvé la revisión del posible duplicado con los botones de arriba antes de volver a guardar.'
    };
  }

  if (state.view === 'new-intake' && !state.intakeProduct) {
    return {
      canSubmit: false,
      reason: 'Elegí un producto antes de registrar un nuevo ingreso.'
    };
  }

  return {
    canSubmit: true,
    reason: null
  };
}

export function buildSaveStockIntakeRequest(
  state: CatalogStockState,
  allowDuplicate = false
): SaveStockIntakeRequest {
  const enteredQuantity = parseIntegerField(state.intakeForm.enteredQuantity, 'la cantidad ingresada');
  const request: SaveStockIntakeRequest = {
    enteredQuantity,
    availableQuantity: enteredQuantity,
    supplierUnitCostCents: parseCurrencyInputToCents(
      state.intakeForm.supplierUnitCostCents,
      'el costo unitario del proveedor'
    ),
    cashPriceCents: parseCurrencyInputToCents(state.intakeForm.cashPriceCents, 'el precio de contado'),
    listPriceCents: parseCurrencyInputToCents(state.intakeForm.listPriceCents, 'el precio de lista'),
    profitPercentageBasisPoints: parsePercentageInputToBasisPoints(
      state.intakeForm.profitPercentageBasisPoints,
      'el porcentaje de ganancia'
    ),
    intakeDate: state.intakeForm.intakeDate.trim(),
    notes: state.intakeForm.notes.trim() || null,
    allowDuplicate
  };

  if (state.view === 'new-intake') {
    if (!state.intakeProduct) {
      throw new Error('Elegí un producto antes de registrar un nuevo ingreso.');
    }

    request.reusableProductId = state.intakeProduct.reusableProductId;
  } else if (state.view === 'new-product') {
    request.newReusableProduct = {
      category: state.newProduct.category,
      name: state.newProduct.name.trim(),
      description: state.newProduct.description.trim() || null,
      material: getResolvedProductMaterial(state),
      variant: state.newProduct.variant.trim()
    };
  } else {
    throw new Error('Abrí un formulario antes de guardar un ingreso.');
  }

  return request;
}

export function buildUpdateReusableProductRequest(state: CatalogStockState): UpdateReusableProductRequest {
  if (state.view !== 'edit-product' || !state.detailProduct) {
    throw new Error('Abrí el formulario de edición antes de guardar cambios del producto.');
  }

  return {
    reusableProductId: state.detailProduct.reusableProductId,
    product: {
      category: state.newProduct.category,
      name: state.newProduct.name.trim(),
      description: state.newProduct.description.trim() || null,
      material: getResolvedProductMaterial(state),
      variant: state.newProduct.variant.trim()
    }
  };
}

function getProductIdentity(product: CatalogProductReference | null): string {
  if (!product) {
    return 'el producto';
  }

  return `${product.name} · ${formatVariantLabel(product.variant)}`;
}

function buildSavedMessage(state: CatalogStockState, duplicateConfirmed = false): string {
  const enteredQuantity = Number.parseInt(state.intakeForm.enteredQuantity.trim(), 10);
  const baseMessage = `Guardamos ${enteredQuantity === 1 ? '1 unidad' : `${enteredQuantity} unidades`} para ${
    state.view === 'new-intake'
      ? getProductIdentity(state.intakeProduct)
      : getProductIdentity({
          reusableProductId: 0,
          category: state.newProduct.category,
          name: state.newProduct.name.trim() || 'el producto nuevo',
          material: state.newProduct.material,
          variant: state.newProduct.variant
        })
  }.`;
  const availabilityMessage = ` Quedaron ${enteredQuantity === 1 ? '1 unidad' : `${enteredQuantity} unidades`} disponibles ahora.`;

  if (!duplicateConfirmed) {
    return `${baseMessage}${availabilityMessage}`;
  }

  return `${baseMessage}${availabilityMessage} Confirmaste crear un producto nuevo similar.`;
}

function shouldProceedAway(
  state: CatalogStockState,
  confirmLeave: (message: string) => boolean
): boolean {
  if (!hasUnsavedChanges(state)) {
    return true;
  }

  return confirmLeave('Hay cambios sin guardar. ¿Querés salir igual?');
}

function buildDetailSuccessState(
  current: CatalogStockState,
  detailProduct: CatalogProductDetail,
  submitMessage: string,
  lastSaved: SavedStockIntakeResult
): CatalogStockState {
  const resetState = resetDraftState(current, current.intakeForm.intakeDate);

  return {
    ...resetState,
    view: 'detail',
    detailStatus: 'ready',
    detailError: null,
    detailProduct,
    intakeProduct: null,
    submitStatus: 'saved',
    submitMessage,
    lastSaved
  };
}

export function createCatalogStockActions({
  bridge,
  getState,
  setState,
  confirmLeave = (message) => window.confirm(message),
  confirmDeleteProduct = (message) => window.confirm(message)
}: CatalogStockActionDependencies) {
  async function loadProductDetailInternal(reusableProductId: number): Promise<CatalogProductDetail> {
    return bridge.catalog.getProductDetail({ reusableProductId, recentIntakesLimit: 5 });
  }

  async function saveAndOpenDetail(
    pendingRequest: SaveStockIntakeRequest,
    duplicateConfirmed = false
  ): Promise<void> {
    try {
      const result = await bridge.stock.saveIntake(pendingRequest);

      if (result.kind === 'duplicate-warning') {
        setState((current) => ({
          ...current,
          submitStatus: 'idle',
          duplicateWarning: {
            matches: result.matches,
            pendingRequest
          },
          submitMessage: `Todavía no guardamos este ingreso. Encontramos ${
            result.matches.length === 1 ? '1 producto parecido' : `${result.matches.length} productos parecidos`
          } para que los revises antes de crear otro producto.`,
          lastSaved: null
        }));

        return;
      }

      const detailProduct = await loadProductDetailInternal(result.reusableProductId);

      setState((current) =>
        buildDetailSuccessState(current, detailProduct, buildSavedMessage(current, duplicateConfirmed), result)
      );
    } catch {
      setState((current) => ({
        ...current,
        submitStatus: 'error',
        submitMessage: 'No pudimos guardar el ingreso y no se hizo ningún cambio. Intentá de nuevo.',
        duplicateWarning: null,
        lastSaved: null
      }));
    }
  }

  return {
    setHubSearchQuery(hubSearchQuery: string): void {
      setState((current) => ({
        ...current,
        hubSearchQuery,
        hubError: null
      }));
    },
    setCategoryFilter(categoryFilter: CatalogCategoryFilter): void {
      setState((current) => ({
        ...current,
        categoryFilter,
        hubError: null
      }));
    },
    async loadCatalogHub(): Promise<void> {
      const { hubSearchQuery, categoryFilter } = getState();
      const requestQuery = hubSearchQuery.trim();
      const requestCategory = categoryFilter;

      setState((current) => ({
        ...current,
        hubStatus: 'loading',
        hubError: null
      }));

      try {
        const result: CatalogListResult = await bridge.catalog.list({
          query: requestQuery,
          category: requestCategory,
          limit: 200
        });

        setState((current) => {
          if (current.hubSearchQuery.trim() !== requestQuery || current.categoryFilter !== requestCategory) {
            return current;
          }

          return {
            ...current,
            hubStatus: 'ready',
            hubError: null,
            catalogProducts: result.products
          };
        });
      } catch {
        setState((current) => {
          if (current.hubSearchQuery.trim() !== requestQuery || current.categoryFilter !== requestCategory) {
            return current;
          }

          return {
            ...current,
            hubStatus: 'error',
            hubError: 'No pudimos cargar el catálogo. Intentá de nuevo.'
          };
        });
      }
    },
    async openProductDetail(reusableProductId: number): Promise<void> {
      const currentState = getState();

      if (!shouldProceedAway(currentState, confirmLeave)) {
        return;
      }

      setState((current) => ({
        ...current,
        view: 'detail',
        detailStatus: 'loading',
        detailError: null,
        detailProduct: null,
        submitMessage: null,
        duplicateWarning: null
      }));

      try {
        const detailProduct = await loadProductDetailInternal(reusableProductId);

        setState((current) => ({
          ...current,
          detailStatus: 'ready',
          detailError: null,
          detailProduct,
          intakeProduct: null
        }));
      } catch {
        setState((current) => ({
          ...current,
          detailStatus: 'error',
          detailError: 'No pudimos cargar este producto. Intentá de nuevo.'
        }));
      }
    },
    openNewProduct(): void {
      const currentState = getState();

      if (!shouldProceedAway(currentState, confirmLeave)) {
        return;
      }

      setState((current) => ({
        ...resetDraftState(current, current.intakeForm.intakeDate),
        view: 'new-product',
        detailStatus: 'idle',
        detailError: null,
        detailProduct: null,
        intakeProduct: null
      }));
    },
    openNewIntake(product: CatalogProductReference): void {
      const currentState = getState();

      if (!shouldProceedAway(currentState, confirmLeave)) {
        return;
      }

      setState((current) => ({
        ...resetDraftState(current, current.intakeForm.intakeDate),
        view: 'new-intake',
        intakeProduct: createProductReference(product),
        submitMessage: null,
        detailError: null
      }));
    },
    goToHub(): void {
      const currentState = getState();

      if (!shouldProceedAway(currentState, confirmLeave)) {
        return;
      }

      setState((current) => ({
        ...resetDraftState(current, current.intakeForm.intakeDate),
        view: 'hub',
        detailStatus: 'idle',
        detailError: null,
        detailProduct: null,
        intakeProduct: null,
        submitMessage: null
      }));
    },
    updateNewProduct(field: keyof CatalogStockState['newProduct'], value: string): void {
      setState((current) => {
        const nextState: CatalogStockState = {
          ...current,
          newProduct: {
            ...current.newProduct,
            [field]: value
          },
          submitStatus: 'idle',
          submitMessage: null,
          duplicateWarning: null,
          lastSaved: null
        };

        return applyCategoryMaterialDefaults(nextState);
      });
    },
    updateJewelryMaterialOption(option: JewelryMaterialOption): void {
      setState((current) => {
        const nextState: CatalogStockState = {
          ...current,
          newProduct: {
            ...current.newProduct,
            jewelryMaterialOption: option,
            material:
              option === 'silver'
                ? 'Plata'
                : option === 'gold'
                  ? 'Oro'
                  : current.newProduct.jewelryMaterialOption === 'other'
                    ? current.newProduct.material
                    : ''
          },
          submitStatus: 'idle',
          submitMessage: null,
          duplicateWarning: null,
          lastSaved: null
        };

        return applyCategoryMaterialDefaults(nextState);
      });
    },
    updateIntakeField(field: keyof CatalogStockState['intakeForm'], value: string): void {
      setState((current) => {
        if (field === 'supplierUnitCostCents') {
          const synced = syncCashPriceWithSupplier(current.intakeForm, current.intakeAutomation, value);

          return {
            ...current,
            ...synced,
            submitStatus: 'idle',
            submitMessage: null,
            lastSaved: null
          };
        }

        return {
          ...current,
          intakeForm: {
            ...current.intakeForm,
            [field]: value
          },
          intakeAutomation: {
            ...current.intakeAutomation,
            cashPriceEditedManually:
              field === 'cashPriceCents' ? true : current.intakeAutomation.cashPriceEditedManually,
            profitPercentageEditedManually:
              field === 'profitPercentageBasisPoints'
                ? true
                : current.intakeAutomation.profitPercentageEditedManually
          },
          submitStatus: 'idle',
          submitMessage: null,
          lastSaved: null
        };
      });
    },
    openEditProduct(): void {
      const current = getState();

      if (!current.detailProduct) {
        return;
      }

      setState({
        ...current,
        view: 'edit-product',
        newProduct: {
          category: current.detailProduct.category,
          name: current.detailProduct.name,
          material: current.detailProduct.material,
          jewelryMaterialOption:
            current.detailProduct.category === 'jewelry'
              ? inferJewelryMaterialOption(current.detailProduct.material)
              : '',
          variant: current.detailProduct.variant,
          description: current.detailProduct.description ?? ''
        },
        submitStatus: 'idle',
        submitMessage: null,
        duplicateWarning: null,
        lastSaved: null
      });
    },
    async saveProductChanges(): Promise<void> {
      let request: UpdateReusableProductRequest;

      try {
        request = buildUpdateReusableProductRequest(getState());
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá los datos del producto.',
          lastSaved: null
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null,
        lastSaved: null
      }));

      try {
        await bridge.catalog.updateProduct(request);
        const detailProduct = await loadProductDetailInternal(request.reusableProductId);

        setState((current) => ({
          ...current,
          view: 'detail',
          detailStatus: 'ready',
          detailError: null,
          detailProduct,
          submitStatus: 'saved',
          submitMessage: 'Guardamos los cambios del producto.',
          duplicateWarning: null,
          lastSaved: null
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage:
            error instanceof Error ? error.message : 'No pudimos guardar los cambios del producto.',
          lastSaved: null
        }));
      }
    },
    async deleteProduct(): Promise<void> {
      const current = getState();

      if (!current.detailProduct) {
        return;
      }

      if (!confirmDeleteProduct(`¿Querés eliminar "${current.detailProduct.name}" del catálogo activo?`)) {
        return;
      }

      setState((state) => ({
        ...state,
        submitStatus: 'saving',
        submitMessage: null,
        lastSaved: null
      }));

      try {
        await bridge.catalog.deleteProduct({ reusableProductId: current.detailProduct.reusableProductId });
        let catalogProducts = current.catalogProducts.filter(
          (product) => product.reusableProductId !== current.detailProduct?.reusableProductId
        );
        let hubStatus: CatalogStockState['hubStatus'] = 'ready';
        let hubError: CatalogStockState['hubError'] = null;

        try {
          const catalogResult = await bridge.catalog.list({
            query: current.hubSearchQuery.trim(),
            category: current.categoryFilter,
            limit: 200
          });
          catalogProducts = catalogResult.products;
        } catch {
          hubStatus = 'error';
          hubError = 'El producto se eliminó, pero no pudimos refrescar el catálogo en este momento.';
        }

        setState((state) => ({
          ...resetDraftState(state, state.intakeForm.intakeDate),
          view: 'hub',
          hubStatus,
          hubError,
          catalogProducts,
          detailStatus: 'idle',
          detailProduct: null,
          submitStatus: 'saved',
          submitMessage: 'El producto se eliminó del catálogo activo sin modificar el historial.',
          duplicateWarning: null,
          lastSaved: null
        }));
      } catch (error) {
        setState((state) => ({
          ...state,
          submitStatus: 'error',
          submitMessage:
            error instanceof Error ? error.message : 'No pudimos eliminar el producto del catálogo activo.',
          lastSaved: null
        }));
      }
    },
    cancelDuplicateWarning(): void {
      setState((current) => ({
        ...current,
        duplicateWarning: null,
        submitStatus: 'idle',
        submitMessage: 'No guardamos este ingreso. Revisá los productos parecidos antes de decidir.',
        lastSaved: null
      }));
    },
    async confirmDuplicateWarning(): Promise<void> {
      const duplicateWarning = getState().duplicateWarning;

      if (!duplicateWarning) {
        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      await saveAndOpenDetail(
        {
          ...duplicateWarning.pendingRequest,
          allowDuplicate: true
        },
        true
      );
    },
    async submit(): Promise<void> {
      let pendingRequest: SaveStockIntakeRequest;

      try {
        pendingRequest = buildSaveStockIntakeRequest(getState());
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá los datos ingresados.',
          duplicateWarning: null,
          lastSaved: null
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null,
        duplicateWarning: null,
        lastSaved: null
      }));

      await saveAndOpenDetail(pendingRequest);
    }
  };
}
