import type { AppBridge } from '../../../shared/contracts/app';
import {
  DEFAULT_PERSONALIZATION_BASIS_POINTS,
  calculateExpectedProfitCents,
  isPersonalizationAllowed
} from '../../../shared/catalog/pricing';
import type { CatalogProductDetail, CatalogSearchResult } from '../../../shared/contracts/catalog';
import type { ReusableProductCategory } from '../../../shared/contracts/catalog';
import type {
  AssignSaleCustomerForPaymentRecoveryRequest,
  CancelSalePaymentRequest,
  ConfirmSaleDraftRequest,
  SalesHistoryListItem,
  PaymentMethod,
  RegisterSalePaymentRequest,
  SalePriceType,
  SaleSnapshot
} from '../../../shared/contracts/sales';

export type SalesView = 'draft' | 'review' | 'history' | 'detail';

export interface SalesDraftItem {
  reusableProductId: number;
  category?: ReusableProductCategory;
  name: string;
  material: string;
  variant: string;
  availableQuantity: number;
  baseCashPriceCents?: number;
  baseListPriceCents?: number;
  productExpectedProfitCents?: number | null;
  cashPriceCents?: number;
  listPriceCents?: number;
  expectedProfitCents?: number | null;
  personalizationExpectedProfitCents?: number | null;
  totalExpectedProfitCents?: number | null;
  quantity: number;
  priceType: SalePriceType;
  hasPersonalization?: boolean;
  personalizationAmount?: string;
  personalizationPercentage?: string;
}

export interface SalesDraftGainPreview {
  productGainCents: number | null;
  personalizationGainCents: number | null;
  totalExpectedProfitCents: number | null;
}

export interface SalesState {
  view: SalesView;
  historyReturnView: 'draft' | 'review' | null;
  detailOrigin: 'draft' | 'history';
  searchQuery: string;
  searchStatus: 'idle' | 'loading' | 'ready' | 'error';
  searchError: string | null;
  searchResults: CatalogSearchResult[];
  historyQuery: string;
  historyStatus: 'idle' | 'loading' | 'ready' | 'error';
  historyError: string | null;
  historyResults: SalesHistoryListItem[];
  draftItems: SalesDraftItem[];
  customer: {
    name: string;
    phoneText: string;
    note: string;
  };
  initialPayment: {
    amount: string;
    paymentMethod: PaymentMethod;
    note: string;
  };
  detailPayment: {
    amount: string;
    paymentMethod: PaymentMethod;
    note: string;
  };
  recoveryCustomer: {
    name: string;
    phoneText: string;
  };
  paymentCancellationReasons: Record<number, string>;
  cancellationReason: string;
  submitStatus: 'idle' | 'saving' | 'error';
  submitMessage: string | null;
  currentSale: SaleSnapshot | null;
}

export type SalesStateSetter = (update: SalesState | ((current: SalesState) => SalesState)) => void;

interface SalesActionDependencies {
  bridge: AppBridge;
  getState: () => SalesState;
  setState: SalesStateSetter;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2
});

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(',', '.');
}

function parseCurrencyAmount(value: string, fieldLabel: string): number {
  const normalized = normalizeDecimalInput(value);

  if (!normalized) {
    throw new Error(`Completá ${fieldLabel.toLowerCase()}.`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldLabel} debe ser un monto válido.`);
  }

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} debe ser mayor a cero.`);
  }

  return Math.round(parsed * 100);
}

function buildCustomerPayload(state: SalesState): ConfirmSaleDraftRequest['customer'] | undefined {
  const name = state.customer.name.trim();
  const phoneText = state.customer.phoneText.trim();
  const note = state.customer.note.trim();

  if (!name && !phoneText && !note) {
    return undefined;
  }

  return {
    name: name || undefined,
    phoneText: phoneText || undefined,
    note: note || null
  };
}

export function formatCurrencyFromCents(amountCents: number): string {
  return currencyFormatter.format(amountCents / 100);
}

export function formatVariantLabel(variant: string): string {
  return variant.trim() ? variant : 'Sin variante';
}

export function getDraftItemUnitPrice(item: SalesDraftItem): number {
  return getDraftItemBaseUnitPrice(item) + getDraftItemPersonalizationUnitPrice(item);
}

export function getDraftItemBaseUnitPrice(item: SalesDraftItem): number {
  const cashPriceCents = item.baseCashPriceCents ?? item.cashPriceCents ?? 0;
  const listPriceCents = item.baseListPriceCents ?? item.listPriceCents ?? cashPriceCents;

  return item.priceType === 'cash' ? cashPriceCents : listPriceCents;
}

export function getDraftItemPersonalizationUnitPrice(item: SalesDraftItem): number {
  if (!item.hasPersonalization) {
    return 0;
  }

  return parseOptionalCurrencyAmount(item.personalizationAmount ?? '') ?? 0;
}

export function getDraftTotals(state: SalesState): {
  totalCents: number;
  initialPaymentCents: number;
  balanceCents: number;
} {
  const totalCents = state.draftItems.reduce((sum, item) => sum + getDraftItemUnitPrice(item) * item.quantity, 0);
  const amount = state.initialPayment.amount.trim();
  const initialPaymentCents = amount ? parseCurrencyAmount(amount, 'el pago inicial') : 0;

  if (initialPaymentCents > totalCents) {
    throw new Error('El pago inicial no puede superar el total de la venta.');
  }

  return {
    totalCents,
    initialPaymentCents,
    balanceCents: totalCents - initialPaymentCents
  };
}

export function getDraftItemGainPreview(item: SalesDraftItem): SalesDraftGainPreview {
  const personalizationAmountCents = item.hasPersonalization
    ? parseOptionalCurrencyAmount(item.personalizationAmount ?? '')
    : null;
  const personalizationPercentageBasisPoints = item.hasPersonalization
    ? parseOptionalPercentageAmount(item.personalizationPercentage ?? '') ?? DEFAULT_PERSONALIZATION_BASIS_POINTS
    : null;
  const legacyProductGainCents = item.expectedProfitCents == null ? null : item.expectedProfitCents * item.quantity;
  const legacyPersonalizationGainCents = item.personalizationExpectedProfitCents == null
    ? null
    : item.personalizationExpectedProfitCents * item.quantity;
  const productGainCents = item.productExpectedProfitCents == null
    ? legacyProductGainCents
    : item.productExpectedProfitCents * item.quantity;
  const personalizationGainCents = personalizationAmountCents == null || personalizationPercentageBasisPoints == null
    ? legacyPersonalizationGainCents
    : calculateExpectedProfitCents(personalizationAmountCents, personalizationPercentageBasisPoints) * item.quantity;

  return {
    productGainCents,
    personalizationGainCents,
    totalExpectedProfitCents:
      item.totalExpectedProfitCents != null && !item.hasPersonalization
        ? item.totalExpectedProfitCents * item.quantity
        : productGainCents == null && personalizationGainCents == null
        ? null
        : (productGainCents ?? 0) + (personalizationGainCents ?? 0)
  };
}

export function shouldShowPendingBalance(balanceCents: number): boolean {
  return balanceCents > 0;
}

export function shouldShowExpectedProfit(
  expectedProfitCents: number | null,
  totalExpectedProfitCents: number | null
): boolean {
  if (expectedProfitCents == null) {
    return false;
  }

  if (totalExpectedProfitCents == null) {
    return true;
  }

  return expectedProfitCents !== totalExpectedProfitCents;
}

export function getDraftGainTotals(state: SalesState): SalesDraftGainPreview {
  const previews = state.draftItems.map(getDraftItemGainPreview);
  const hasExpectedProfit = previews.some((preview) => preview.productGainCents != null);
  const hasPersonalizationGain = previews.some((preview) => preview.personalizationGainCents != null);
  const hasTotalGain = previews.some((preview) => preview.totalExpectedProfitCents != null);

  return {
    productGainCents: hasExpectedProfit
      ? previews.reduce((sum, preview) => sum + (preview.productGainCents ?? 0), 0)
      : null,
    personalizationGainCents: hasPersonalizationGain
      ? previews.reduce((sum, preview) => sum + (preview.personalizationGainCents ?? 0), 0)
      : null,
    totalExpectedProfitCents: hasTotalGain
      ? previews.reduce((sum, preview) => sum + (preview.totalExpectedProfitCents ?? 0), 0)
      : null
  };
}

export function getCustomerRuleFeedback(state: SalesState): string | null {
  if (state.draftItems.length === 0) {
    return 'Agregá al menos un producto antes de confirmar.';
  }

  for (const item of state.draftItems) {
    if (!item.hasPersonalization) {
      continue;
    }

    if (!item.category || !isPersonalizationAllowed(item.category)) {
      return 'Solo Joyas y Mates pueden llevar personalización en la venta.';
    }

    if (parseOptionalCurrencyAmount(item.personalizationAmount ?? '') == null) {
      return 'Completá el importe de personalización en cada producto que la tenga.';
    }

    if (
      (item.personalizationPercentage ?? '').trim().length > 0 &&
      parseOptionalPercentageAmount(item.personalizationPercentage ?? '') == null
    ) {
      return 'Revisá el porcentaje de personalización. Debe ser un número válido.';
    }
  }

  const { balanceCents } = getDraftTotals(state);
  const name = state.customer.name.trim();
  const phoneText = state.customer.phoneText.trim();
  const hasAnyCustomerField = Boolean(name || phoneText || state.customer.note.trim());

  if (balanceCents > 0 && (!name || !phoneText)) {
    return 'Para dejar saldo pendiente necesitás cargar nombre y teléfono del cliente.';
  }

  if (hasAnyCustomerField && (!name || !phoneText)) {
    return 'Si cargás datos del cliente, completá nombre y teléfono.';
  }

  return null;
}

export function buildConfirmSaleDraftRequest(state: SalesState): ConfirmSaleDraftRequest {
  const feedback = getCustomerRuleFeedback(state);

  if (feedback) {
    throw new Error(feedback);
  }

  const { initialPaymentCents } = getDraftTotals(state);

  return {
    customer: buildCustomerPayload(state),
    draftItems: state.draftItems.map((item) => ({
      reusableProductId: item.reusableProductId,
      quantity: item.quantity,
      priceType: item.priceType,
      personalizationAmountCents: item.hasPersonalization
        ? parseCurrencyAmount(item.personalizationAmount ?? '', 'el importe de personalización')
        : undefined,
      personalizationPercentageBasisPoints: item.hasPersonalization
        ? parseOptionalPercentageAmount(item.personalizationPercentage ?? '') ?? DEFAULT_PERSONALIZATION_BASIS_POINTS
        : undefined
    })),
    initialPayment:
      initialPaymentCents > 0
        ? {
            amountCents: initialPaymentCents,
            paymentMethod: state.initialPayment.paymentMethod,
            note: state.initialPayment.note.trim() || null
          }
        : undefined
  };
}

export function buildRegisterPaymentRequest(state: SalesState): RegisterSalePaymentRequest {
  if (!state.currentSale) {
    throw new Error('Todavía no hay una venta confirmada para registrar pagos.');
  }

  return {
    saleId: state.currentSale.saleId,
    amountCents: parseCurrencyAmount(state.detailPayment.amount, 'el pago'),
    paymentMethod: state.detailPayment.paymentMethod,
    note: state.detailPayment.note.trim() || null
  };
}

export function buildCancelPaymentRequest(
  state: SalesState,
  paymentId: number
): CancelSalePaymentRequest {
  if (!state.currentSale) {
    throw new Error('Todavía no hay una venta confirmada para cancelar pagos.');
  }

  const payment = state.currentSale.payments.find((entry) => entry.paymentId === paymentId);

  if (!payment || !payment.isActive) {
    throw new Error('Elegí un pago activo para cancelarlo.');
  }

  const reason = state.paymentCancellationReasons[paymentId]?.trim() ?? '';

  if (!reason) {
    throw new Error('Escribí el motivo antes de cancelar el pago.');
  }

  return {
    saleId: state.currentSale.saleId,
    paymentId,
    reason
  };
}

export function canAssignCustomerForPaymentRecovery(sale: SaleSnapshot | null): boolean {
  return Boolean(
    sale &&
      sale.status === 'paid' &&
      sale.balanceCents === 0 &&
      sale.customer.customerId == null &&
      sale.payments.some((payment) => payment.isActive)
  );
}

export function buildAssignCustomerForPaymentRecoveryRequest(
  state: SalesState
): AssignSaleCustomerForPaymentRecoveryRequest {
  const sale = state.currentSale;

  if (!canAssignCustomerForPaymentRecovery(sale) || !sale) {
    throw new Error('Esta venta no admite asignar cliente por esta vía de recuperación.');
  }

  const name = state.recoveryCustomer.name.trim();
  const phoneText = state.recoveryCustomer.phoneText.trim();

  if (!name || !phoneText) {
    throw new Error('Completá nombre y teléfono para asignar el cliente.');
  }

  return {
    saleId: sale.saleId,
    name,
    phoneText
  };
}

export function getSaleCustomerLabel(sale: SaleSnapshot | null): string {
  if (!sale) {
    return 'Venta de mostrador';
  }

  return sale.customer.name?.trim() ? sale.customer.name : 'Venta de mostrador';
}

export function createInitialSalesState(): SalesState {
  return {
    view: 'draft',
    historyReturnView: null,
    detailOrigin: 'draft',
    searchQuery: '',
    searchStatus: 'idle',
    searchError: null,
    searchResults: [],
    historyQuery: '',
    historyStatus: 'idle',
    historyError: null,
    historyResults: [],
    draftItems: [],
    customer: {
      name: '',
      phoneText: '',
      note: ''
    },
    initialPayment: {
      amount: '',
      paymentMethod: 'cash',
      note: ''
    },
    detailPayment: {
      amount: '',
      paymentMethod: 'cash',
      note: ''
    },
    recoveryCustomer: {
      name: '',
      phoneText: ''
    },
    paymentCancellationReasons: {},
    cancellationReason: '',
    submitStatus: 'idle',
    submitMessage: null,
    currentSale: null
  };
}

function mergeDraftItem(current: SalesDraftItem[], detail: CatalogProductDetail): SalesDraftItem[] {
  const existing = current.find((item) => item.reusableProductId === detail.reusableProductId);

  if (!existing) {
    return current.concat({
      reusableProductId: detail.reusableProductId,
      category: detail.category,
      name: detail.name,
      material: detail.material,
      variant: detail.variant,
      availableQuantity: detail.availableQuantity,
      baseCashPriceCents: detail.currentCashPriceCents ?? 0,
      baseListPriceCents: detail.currentListPriceCents ?? detail.currentCashPriceCents ?? 0,
      productExpectedProfitCents: detail.currentExpectedProfitCents,
      quantity: 1,
      priceType: 'cash',
      hasPersonalization: false,
      personalizationAmount: '',
      personalizationPercentage: String(DEFAULT_PERSONALIZATION_BASIS_POINTS / 100)
    });
  }

  return current.map((item) =>
    item.reusableProductId === detail.reusableProductId
      ? {
          ...item,
          availableQuantity: detail.availableQuantity,
          category: detail.category,
          baseCashPriceCents: detail.currentCashPriceCents ?? item.baseCashPriceCents,
          baseListPriceCents: detail.currentListPriceCents ?? item.baseListPriceCents,
          productExpectedProfitCents: detail.currentExpectedProfitCents,
          quantity: Math.min(item.quantity + 1, Math.max(detail.availableQuantity, 1))
        }
      : item
  );
}

function resetAfterConfirmation(current: SalesState, sale: SaleSnapshot, message: string): SalesState {
  return {
    ...createInitialSalesState(),
    view: 'detail',
    detailOrigin: 'draft',
    submitStatus: 'idle',
    submitMessage: message,
    currentSale: sale,
    detailPayment: {
      amount: '',
      paymentMethod: 'cash',
      note: ''
    },
    cancellationReason: ''
  };
}

function hasOngoingDraft(state: SalesState): boolean {
  return Boolean(
    state.draftItems.length > 0 ||
      state.customer.name.trim() ||
      state.customer.phoneText.trim() ||
      state.customer.note.trim() ||
      state.initialPayment.amount.trim() ||
      state.initialPayment.note.trim()
  );
}

export function createSalesActions({ bridge, getState, setState }: SalesActionDependencies) {
  const loadHistory = async (): Promise<void> => {
    const query = getState().historyQuery.trim();

    setState((current) => ({
      ...current,
      historyStatus: 'loading',
      historyError: null
    }));

    try {
      const historyResults = await bridge.sales.listHistory({ query, limit: 20 });

      setState((current) => ({
        ...current,
        historyStatus: 'ready',
        historyError: null,
        historyResults
      }));
    } catch {
      setState((current) => ({
        ...current,
        historyStatus: 'error',
        historyError: 'No pudimos cargar las ventas en este momento.',
        historyResults: []
      }));
    }
  };

  return {
    setSearchQuery(searchQuery: string): void {
      setState((current) => ({
        ...current,
        searchQuery,
        searchError: null
      }));
    },
    setHistoryQuery(historyQuery: string): void {
      setState((current) => ({
        ...current,
        historyQuery,
        historyError: null
      }));
    },
    async loadSalesHistory(): Promise<void> {
      await loadHistory();
    },
    async openHistory(): Promise<void> {
      setState((current) => ({
        ...current,
        view: 'history',
        historyReturnView:
          current.view === 'draft' || current.view === 'review' ? current.view : current.historyReturnView,
        submitMessage: null,
        submitStatus: 'idle'
      }));

      await loadHistory();
    },
    returnFromHistory(): void {
      setState((current) => ({
        ...current,
        view: current.historyReturnView ?? 'draft',
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    async openSaleDetail(saleId: number): Promise<void> {
      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const sale = await bridge.sales.getById({ saleId });

        setState((current) => ({
          ...current,
          view: 'detail',
          detailOrigin: 'history',
          currentSale: sale,
          submitStatus: 'idle',
          submitMessage: `Abriste la venta #${sale.saleNumber}.`
        }));
      } catch {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: 'No pudimos abrir el detalle de la venta seleccionada.'
        }));
      }
    },
    backFromDetail(): void {
      setState((current) => ({
        ...current,
        view: current.detailOrigin === 'history' ? 'history' : 'draft',
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    async searchProducts(): Promise<void> {
      const query = getState().searchQuery.trim();

      if (query.length === 0) {
        setState((current) => ({
          ...current,
          searchStatus: 'idle',
          searchError: null,
          searchResults: []
        }));

        return;
      }

      setState((current) => ({
        ...current,
        searchStatus: 'loading',
        searchError: null
      }));

      try {
        const searchResults = await bridge.catalog.search({ query, limit: 12 });

        setState((current) => {
          if (current.searchQuery.trim() !== query) {
            return current;
          }

          return {
            ...current,
            searchStatus: 'ready',
            searchError: null,
            searchResults
          };
        });
      } catch {
        setState((current) => {
          if (current.searchQuery.trim() !== query) {
            return current;
          }

          return {
            ...current,
            searchStatus: 'error',
            searchError: 'No pudimos buscar productos en este momento.',
            searchResults: []
          };
        });
      }
    },
    async addProduct(reusableProductId: number): Promise<void> {
      try {
        const detail = await bridge.catalog.getProductDetail({ reusableProductId, recentIntakesLimit: 1 });

        setState((current) => ({
          ...current,
          draftItems: mergeDraftItem(current.draftItems, detail),
          submitMessage: null,
          submitStatus: 'idle'
        }));
      } catch {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: 'No pudimos sumar este producto a la venta.'
        }));
      }
    },
    removeDraftItem(reusableProductId: number): void {
      setState((current) => ({
        ...current,
        draftItems: current.draftItems.filter((item) => item.reusableProductId !== reusableProductId),
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateDraftItemQuantity(reusableProductId: number, quantityText: string): void {
      const quantity = Math.max(1, Number.parseInt(quantityText, 10) || 1);

      setState((current) => ({
        ...current,
        draftItems: current.draftItems.map((item) =>
          item.reusableProductId === reusableProductId
            ? { ...item, quantity: Math.min(quantity, Math.max(item.availableQuantity, 1)) }
            : item
        ),
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateDraftItemPriceType(reusableProductId: number, priceType: SalePriceType): void {
      setState((current) => ({
        ...current,
        draftItems: current.draftItems.map((item) =>
          item.reusableProductId === reusableProductId ? { ...item, priceType } : item
        ),
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateDraftItemPersonalizationToggle(reusableProductId: number, hasPersonalization: boolean): void {
      setState((current) => ({
        ...current,
        draftItems: current.draftItems.map((item) =>
          item.reusableProductId === reusableProductId
            ? {
                ...item,
                hasPersonalization,
                personalizationAmount: hasPersonalization ? item.personalizationAmount : '',
                personalizationPercentage: hasPersonalization
                  ? item.personalizationPercentage || String(DEFAULT_PERSONALIZATION_BASIS_POINTS / 100)
                  : ''
              }
            : item
        ),
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateDraftItemPersonalizationField(
      reusableProductId: number,
      field: 'personalizationAmount' | 'personalizationPercentage',
      value: string
    ): void {
      setState((current) => ({
        ...current,
        draftItems: current.draftItems.map((item) =>
          item.reusableProductId === reusableProductId ? { ...item, [field]: value } : item
        ),
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateCustomerField(field: keyof SalesState['customer'], value: string): void {
      setState((current) => ({
        ...current,
        customer: {
          ...current.customer,
          [field]: value
        },
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateInitialPaymentField(field: keyof SalesState['initialPayment'], value: string): void {
      setState((current) => ({
        ...current,
        initialPayment: {
          ...current.initialPayment,
          [field]: value
        },
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateDetailPaymentField(field: keyof SalesState['detailPayment'], value: string): void {
      setState((current) => ({
        ...current,
        detailPayment: {
          ...current.detailPayment,
          [field]: value
        },
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    updateRecoveryCustomerField(field: keyof SalesState['recoveryCustomer'], value: string): void {
      setState((current) => ({
        ...current,
        recoveryCustomer: {
          ...current.recoveryCustomer,
          [field]: value
        },
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    setCancellationReason(cancellationReason: string): void {
      setState((current) => ({
        ...current,
        cancellationReason,
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    goToReview(): void {
      try {
        const feedback = getCustomerRuleFeedback(getState());

        if (feedback) {
          throw new Error(feedback);
        }

        setState((current) => ({
          ...current,
          view: 'review',
          submitStatus: 'idle',
          submitMessage: null
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá la venta antes de continuar.'
        }));
      }
    },
    backToDraft(): void {
      setState((current) => ({
        ...current,
        view: 'draft',
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    async confirmSale(): Promise<void> {
      let request: ConfirmSaleDraftRequest;

      try {
        request = buildConfirmSaleDraftRequest(getState());
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá la venta antes de confirmar.'
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const sale = await bridge.sales.confirmDraft(request);

        setState((current) =>
          resetAfterConfirmation(current, sale, `La venta #${sale.saleNumber} quedó confirmada.`)
        );
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'No pudimos confirmar la venta.'
        }));
      }
    },
    async registerPayment(): Promise<void> {
      let request: RegisterSalePaymentRequest;

      try {
        request = buildRegisterPaymentRequest(getState());
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá el pago antes de guardarlo.'
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const sale = await bridge.sales.registerPayment(request);

        setState((current) => ({
          ...current,
          currentSale: sale,
          detailPayment: {
            amount: '',
            paymentMethod: 'cash',
            note: ''
          },
          submitStatus: 'idle',
          submitMessage: 'Registramos el pago y actualizamos el saldo.'
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'No pudimos registrar el pago.'
        }));
      }
    },
    async cancelSale(): Promise<void> {
      const sale = getState().currentSale;
      const reason = getState().cancellationReason.trim();

      if (!sale) {
        return;
      }

      if (!reason) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: 'Escribí el motivo antes de cancelar la venta.'
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const cancelledSale = await bridge.sales.cancelSale({ saleId: sale.saleId, reason });

        setState((current) => ({
          ...current,
          currentSale: cancelledSale,
          submitStatus: 'idle',
          submitMessage: 'La venta quedó cancelada y el stock se devolvió a sus ingresos originales.'
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'No pudimos cancelar la venta.'
        }));
      }
    },
    async assignCustomerForPaymentRecovery(): Promise<void> {
      let request: AssignSaleCustomerForPaymentRecoveryRequest;

      try {
        request = buildAssignCustomerForPaymentRecoveryRequest(getState());
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá los datos del cliente antes de continuar.'
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const sale = await bridge.sales.assignCustomerForPaymentRecovery(request);

        setState((current) => ({
          ...current,
          currentSale: sale,
          recoveryCustomer: {
            name: '',
            phoneText: ''
          },
          submitStatus: 'idle',
          submitMessage: 'Asignamos el cliente para que puedas cancelar el pago sin romper las reglas de saldo.'
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'No pudimos asignar el cliente a la venta.'
        }));
      }
    },
    startNewSale(): void {
      setState(createInitialSalesState());
    },
    hasOngoingDraft(): boolean {
      return hasOngoingDraft(getState());
    },
    updatePaymentCancellationReason(paymentId: number, reason: string): void {
      setState((current) => ({
        ...current,
        paymentCancellationReasons: {
          ...current.paymentCancellationReasons,
          [paymentId]: reason
        },
        submitMessage: null,
        submitStatus: 'idle'
      }));
    },
    async cancelPayment(paymentId: number): Promise<void> {
      let request: CancelSalePaymentRequest;

      try {
        request = buildCancelPaymentRequest(getState(), paymentId);
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage: error instanceof Error ? error.message : 'Revisá el pago antes de cancelarlo.'
        }));

        return;
      }

      setState((current) => ({
        ...current,
        submitStatus: 'saving',
        submitMessage: null
      }));

      try {
        const sale = await bridge.sales.cancelPayment(request);

        setState((current) => {
          const nextReasons = { ...current.paymentCancellationReasons };
          delete nextReasons[paymentId];

          return {
            ...current,
            currentSale: sale,
            paymentCancellationReasons: nextReasons,
            submitStatus: 'idle',
            submitMessage: 'Cancelamos el pago y actualizamos el saldo de la venta.'
          };
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          submitStatus: 'error',
          submitMessage:
            error instanceof Error && /walk-in sale/i.test(error.message)
              ? 'Antes de cancelar este pago, asigná nombre y teléfono del cliente porque la venta volvería a tener saldo pendiente.'
              : error instanceof Error
                ? error.message
                : 'No pudimos cancelar el pago.'
        }));
      }
    }
  };
}

function parseOptionalCurrencyAmount(value: string): number | null {
  const normalized = normalizeDecimalInput(value);

  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number.parseFloat(normalized) * 100);
}

function parseOptionalPercentageAmount(value: string): number | null {
  const normalized = normalizeDecimalInput(value);

  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number.parseFloat(normalized) * 100);
}
