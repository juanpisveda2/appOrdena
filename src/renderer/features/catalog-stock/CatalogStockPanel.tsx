import React, { useEffect, useMemo, useState } from 'react';
import type { AppBridge } from '../../../shared/contracts/app';
import { REUSABLE_PRODUCT_CATEGORIES, type CatalogListItem } from '../../../shared/contracts/catalog';
import { Badge, Banner, Button, EmptyState, Field, PageHeader, Surface } from '../../ui';
import {
  buildEarlyDuplicateQuery,
  createCatalogStockActions,
  createInitialCatalogStockState,
  formatCategoryLabel,
  formatCurrencyFromCents,
  formatDateLabel,
  formatMaterialLabel,
  formatPercentageFromBasisPoints,
  formatVariantLabel,
  getActiveCategory,
  getPricingPreview,
  getSubmitReadiness,
  hasUnsavedChanges,
  tryParseCurrencyInputToCents,
  tryParsePercentageInputToBasisPoints,
  type CatalogProductReference,
  type CatalogStockState
} from './model';

interface CatalogStockPanelProps {
  bridge: AppBridge;
  initialState?: CatalogStockState;
  onBack?: () => void;
  onOpenSales?: () => void;
  onOpenConsignments?: () => void;
}

const HUB_PAGE_SIZE = 6;

type GainEntries = Array<{ label: string; amountCents: number }>;

function renderGainSummaryEntries(entries: GainEntries): JSX.Element[] {
  return entries.map((entry) => (
    <React.Fragment key={entry.label}>
      <dt>{entry.label}</dt>
      <dd>{formatCurrencyFromCents(entry.amountCents)}</dd>
    </React.Fragment>
  ));
}

function renderGainText(entries: GainEntries): string {
  return entries.map((entry) => `${entry.label}: ${formatCurrencyFromCents(entry.amountCents)}`).join(' · ');
}

function renderCatalogGainEntries({
  cashGainCents,
  listGainCents,
  personalizationGainCents,
  cashTotalGainCents,
  listTotalGainCents
}: {
  cashGainCents: number | null;
  listGainCents: number | null;
  personalizationGainCents: number | null;
  cashTotalGainCents: number | null;
  listTotalGainCents: number | null;
}): Array<{ label: string; amountCents: number }> {
  const entries: Array<{ label: string; amountCents: number }> = [];

  if (cashGainCents != null) {
    entries.push({ label: 'Ganancia contado', amountCents: cashGainCents });
  }

  if (listGainCents != null) {
    entries.push({ label: 'Ganancia lista', amountCents: listGainCents });
  }

  if ((personalizationGainCents ?? 0) > 0) {
    entries.push({ label: 'Ganancia personalización', amountCents: personalizationGainCents ?? 0 });

    if (cashTotalGainCents != null) {
      entries.push({ label: 'Ganancia total contado', amountCents: cashTotalGainCents });
    }

    if (listTotalGainCents != null) {
      entries.push({ label: 'Ganancia total lista', amountCents: listTotalGainCents });
    }
  }

  return entries;
}

function getMoneyHelper(value: string): { text: string; tone: 'default' | 'error' } {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { text: 'Ingresá el monto en pesos. Podés usar coma o punto para los centavos.', tone: 'default' };
  }

  const cents = tryParseCurrencyInputToCents(trimmed);

  if (cents == null) {
    return { text: 'Ingresá un monto válido en pesos. Ejemplo: 12500 o 12500,50.', tone: 'error' };
  }

  return { text: `Se guardará como ${formatCurrencyFromCents(cents)}.`, tone: 'default' };
}

function getPercentageHelper(value: string): { text: string; tone: 'default' | 'error' } {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { text: 'Ingresá el porcentaje en formato humano. Ejemplo: 10 o 12,5.', tone: 'default' };
  }

  const basisPoints = tryParsePercentageInputToBasisPoints(trimmed);

  if (basisPoints == null) {
    return { text: 'Ingresá un porcentaje válido. Podés usar hasta dos decimales.', tone: 'error' };
  }

  return { text: `Equivale a ${formatPercentageFromBasisPoints(basisPoints)}.`, tone: 'default' };
}

function getMoneyPreview(value: string): string {
  const cents = tryParseCurrencyInputToCents(value.trim());

  return cents == null ? 'Pendiente' : formatCurrencyFromCents(cents);
}

function getPercentagePreview(value: string): string {
  const basisPoints = tryParsePercentageInputToBasisPoints(value.trim());

  return basisPoints == null ? 'Pendiente' : formatPercentageFromBasisPoints(basisPoints);
}

function getLoadedValueLabel(source: 'current-product' | 'latest-intake'): string {
  return source === 'current-product' ? 'Precargado desde el producto actual.' : 'Precargado desde el ultimo ingreso.';
}

function joinProductParts(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter((part) => part.length > 0).join(' · ');
}

function getStockStatusTone(availableQuantity: number): 'success' | 'warning' {
  return availableQuantity > 0 ? 'success' : 'warning';
}

function getStockStatusLabel(availableQuantity: number): string {
  return availableQuantity > 0 ? 'Con stock' : 'Sin stock';
}

function renderCatalogCard(
  product: CatalogListItem,
  onOpen: (reusableProductId: number) => void,
  onOpenNewIntake: (product: CatalogProductReference) => void
): JSX.Element {
  return (
    <li className="list-row list-row--catalog" key={product.reusableProductId}>
      <div className="list-row__content">
        <div className="list-row__headline">
          <p className="list-row__title">
            {joinProductParts(product.name, product.variant ? formatVariantLabel(product.variant) : '')}
          </p>
          <Badge tone={product.isOutOfStock ? 'warning' : 'success'}>{product.isOutOfStock ? 'Sin stock' : 'Con stock'}</Badge>
        </div>
        <p className="list-row__text">
          {joinProductParts(formatCategoryLabel(product.category), formatMaterialLabel(product.material))}
        </p>
        <p className="list-row__text">
          Stock disponible: {product.availableQuantity}
          {product.currentCashPriceCents != null ? ` · Contado: ${formatCurrencyFromCents(product.currentCashPriceCents)}` : ''}
          {product.currentListPriceCents != null ? ` · Lista: ${formatCurrencyFromCents(product.currentListPriceCents)}` : ''}
        </p>
      </div>
      <div className="list-row__aside">
        <Button type="button" variant="secondary" onClick={() => onOpen(product.reusableProductId)}>
          Ver producto
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            void onOpenNewIntake({
              reusableProductId: product.reusableProductId,
              category: product.category,
              name: product.name,
              material: product.material,
              variant: product.variant
            })
          }
        >
          Registrar ingreso adicional
        </Button>
      </div>
    </li>
  );
}

function renderHubSummaryCard({
  label,
  count,
  actionLabel,
  onAction
}: {
  label: string;
  count: number;
  actionLabel: string;
  onAction?: () => void;
}): JSX.Element {
  return (
    <Surface className="catalog-home-summary-card" tone="soft">
      <p className="catalog-home-summary-card__label">{label}</p>
      <p className="catalog-home-summary-card__value">{count}</p>
      {onAction ? (
        <Button type="button" variant="primary" className="catalog-home-summary-card__action" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Surface>
  );
}

function renderProductFields(
  state: CatalogStockState,
  actions: ReturnType<typeof createCatalogStockActions>
): JSX.Element {
  const isJewelry = state.newProduct.category === 'jewelry';
  const isClothing = state.newProduct.category === 'clothing';

  return (
    <Surface className="catalog-stock-step">
      <div className="catalog-stock-step__header">
        <Badge tone="info">1</Badge>
        <div>
          <h3 className="surface__title">Datos del producto</h3>
          <p className="surface__description">Completá la identidad principal y dejá los detalles complementarios para el final.</p>
        </div>
      </div>
      <div className="spaced">
        <div className="catalog-stock-subsection">
          <p className="catalog-stock-subsection__title">Estructural</p>
          <div className="grid-2">
            <Field label="Categoría">
              <select className="select" value={state.newProduct.category} onChange={(event) => actions.updateNewProduct('category', event.target.value)}>
                {REUSABLE_PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre">
              <input className="input" value={state.newProduct.name} onChange={(event) => actions.updateNewProduct('name', event.target.value)} />
            </Field>
            {isJewelry ? (
              <>
                <Field label="Material de la joya">
                  <select
                    className="select"
                    value={state.newProduct.jewelryMaterialOption}
                    onChange={(event) => actions.updateJewelryMaterialOption(event.target.value as 'silver' | 'gold' | 'other' | '')}
                  >
                    <option value="">Elegí una opción</option>
                    <option value="silver">Plata</option>
                    <option value="gold">Oro</option>
                    <option value="other">Otro</option>
                  </select>
                </Field>
                {state.newProduct.jewelryMaterialOption === 'other' ? (
                  <Field label="Especificá el material">
                    <input className="input" value={state.newProduct.material} onChange={(event) => actions.updateNewProduct('material', event.target.value)} />
                  </Field>
                ) : null}
              </>
            ) : (
              <Field label="Material" helper={isClothing ? 'Opcional en ropa.' : undefined}>
                <input className="input" value={state.newProduct.material} onChange={(event) => actions.updateNewProduct('material', event.target.value)} />
              </Field>
            )}
          </div>
        </div>
        <div className="catalog-stock-subsection catalog-stock-subsection--complementary">
          <p className="catalog-stock-subsection__title">Complementario</p>
          <div className="grid-2">
            <Field label="Variante opcional" helper="Ej: medida, talle o color.">
              <input className="input" value={state.newProduct.variant} onChange={(event) => actions.updateNewProduct('variant', event.target.value)} />
            </Field>
            <Field label="Descripción opcional" helper="Referencia breve para el catálogo.">
              <input className="input" value={state.newProduct.description} onChange={(event) => actions.updateNewProduct('description', event.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function renderIntakeForm(state: CatalogStockState, actions: ReturnType<typeof createCatalogStockActions>): JSX.Element {
  const activeCategory = getActiveCategory(state);
  const pricingPreview = getPricingPreview(state);
  const submitReadiness = getSubmitReadiness(state);
   const submitLabel = state.view === 'new-product' ? 'Crear producto y registrar ingreso' : 'Registrar ingreso adicional';
  const isNewIntake = state.view === 'new-intake';
  const moneySupplierHelper = getMoneyHelper(state.intakeForm.supplierUnitCostCents);
  const moneyCashHelper = getMoneyHelper(state.intakeForm.cashPriceCents);
  const moneyListHelper = getMoneyHelper(state.intakeForm.listPriceCents);
  const percentageHelper = getPercentageHelper(state.intakeForm.profitPercentageBasisPoints);
  const cashAutofilled =
    state.intakeForm.cashPriceCents.trim().length > 0 &&
    state.intakeForm.cashPriceCents === state.intakeAutomation.lastSuggestedCashPriceCents &&
    !state.intakeAutomation.cashPriceEditedManually;
  const profitAutofilled =
    state.intakeForm.profitPercentageBasisPoints.trim().length > 0 &&
    state.intakeForm.profitPercentageBasisPoints === state.intakeAutomation.lastSuggestedProfitPercentageBasisPoints &&
    !state.intakeAutomation.profitPercentageEditedManually;
  const showEarlyDuplicatePrompt =
    state.view === 'new-product' &&
    state.earlyDuplicateCheck.status === 'ready' &&
    state.earlyDuplicateCheck.matches.length > 0 &&
    state.earlyDuplicateCheck.dismissedQuery !== state.earlyDuplicateCheck.query;
  const cancelLabel = state.view === 'new-product' ? 'Cancelar y volver al catálogo' : state.detailProduct ? 'Cancelar y volver al producto' : 'Cancelar y volver al catálogo';
  const supplierPrefillLabel = isNewIntake && state.detailProduct?.recentIntakes[0] ? getLoadedValueLabel('latest-intake') : null;
  const cashPrefillLabel =
    isNewIntake && state.intakeForm.cashPriceCents.trim().length > 0
      ? getLoadedValueLabel(state.detailProduct?.currentCashPriceCents != null ? 'current-product' : 'latest-intake')
      : null;
  const listPrefillLabel =
    isNewIntake && state.intakeForm.listPriceCents.trim().length > 0
      ? getLoadedValueLabel(state.detailProduct?.currentListPriceCents != null ? 'current-product' : 'latest-intake')
      : null;
  const profitPrefillLabel =
    isNewIntake && state.intakeForm.profitPercentageBasisPoints.trim().length > 0
      ? getLoadedValueLabel(state.detailProduct?.currentProfitPercentageBasisPoints != null ? 'current-product' : 'latest-intake')
      : null;

  return (
    <div className="spaced">
      {showEarlyDuplicatePrompt ? (
        <Banner tone="warning" title="Ya existe un producto muy parecido" message="Podés ir directo a registrar un nuevo ingreso en ese producto o seguir con esta alta si realmente corresponde crear otro.">
          <ul className="list">
            {state.earlyDuplicateCheck.matches.map((match) => (
              <li key={match.reusableProductId} className="list-row">
                <div className="list-row__content">
                  <p className="list-row__title">
                    {joinProductParts(match.name, formatMaterialLabel(match.material), match.variant ? formatVariantLabel(match.variant) : '')}
                  </p>
                  <p className="list-row__text">{match.availableQuantity} disponibles</p>
                </div>
                <div className="list-row__aside">
                  <Button type="button" variant="secondary" onClick={() => void actions.openDuplicateMatch(match.reusableProductId)}>
                    Ir al producto
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="actions">
            <Button type="button" variant="ghost" onClick={() => actions.dismissEarlyDuplicateCheck()}>
              Seguir creando igual
            </Button>
          </div>
        </Banner>
      ) : null}

      <Surface className="catalog-stock-step">
        <div className="catalog-stock-step__header">
          <Badge tone="info">2</Badge>
          <div>
            <h3 className="surface__title">{isNewIntake ? 'Ingreso adicional' : 'Primer ingreso'}</h3>
            <p className="surface__description">
              {isNewIntake
                ? 'Ingresá la cantidad y actualizá los valores de este movimiento. La cantidad se suma al stock actual.'
                : 'Definí el stock inicial y los valores del ingreso.'}
            </p>
          </div>
        </div>
        <div className="spaced">
          <Surface tone="info" className="catalog-stock-quantity-card">
            <div className="catalog-stock-quantity-card__header">
              <h4 className="surface__title">Cantidad</h4>
              <Badge tone="info">Clave para stock</Badge>
            </div>
            <p className="surface__description">
              {isNewIntake
                ? state.detailProduct
                  ? `Se suma al stock actual (${state.detailProduct.availableQuantity} disponible${state.detailProduct.availableQuantity === 1 ? '' : 's'}).`
                  : 'Se suma al stock actual del producto.'
                : 'Se usa como stock disponible inicial.'}
            </p>
            <div style={{ marginTop: 12 }}>
              <Field
                label={isNewIntake ? 'Cantidad que se agrega' : 'Cantidad ingresada'}
                helper={isNewIntake ? 'Tiene que ser un entero mayor a 0. Esta cantidad se agrega al stock actual.' : 'Tiene que ser un entero mayor a 0.'}
                className="catalog-stock-quantity-field"
              >
                <input
                  className="input catalog-stock-quantity-input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={state.intakeForm.enteredQuantity}
                  onChange={(event) => actions.updateIntakeField('enteredQuantity', event.target.value)}
                  placeholder="Ej: 12"
                />
              </Field>
            </div>
          </Surface>

          <div className="grid-2">
            <Field
              label="Costo unitario del proveedor"
              helper={`${supplierPrefillLabel ? `${supplierPrefillLabel} ` : ''}${moneySupplierHelper.text}`}
              helperTone={moneySupplierHelper.tone}
            >
              <input
                className={supplierPrefillLabel ? 'input input--suggested' : 'input'}
                inputMode="decimal"
                value={state.intakeForm.supplierUnitCostCents}
                onChange={(event) => actions.updateIntakeField('supplierUnitCostCents', event.target.value)}
                placeholder="Ej: 12500 o 12500,50"
              />
            </Field>
            <Field
              label="Porcentaje de ganancia"
              helper={
                !isNewIntake && activeCategory === 'jewelry' && state.newProduct.jewelryMaterialOption
                  ? `${profitAutofilled ? 'Sugerido automaticamente. ' : ''}${
                       state.newProduct.jewelryMaterialOption === 'gold' ? 'Referencia actual: 3%. ' : 'Referencia actual: 10%. '
                    }${percentageHelper.text}`
                  : `${profitPrefillLabel ? `${profitPrefillLabel} ` : ''}${percentageHelper.text}`
              }
              helperTone={percentageHelper.tone}
            >
              <input
                className={profitAutofilled || profitPrefillLabel ? 'input input--suggested' : 'input'}
                inputMode="decimal"
                value={state.intakeForm.profitPercentageBasisPoints}
                onChange={(event) => actions.updateIntakeField('profitPercentageBasisPoints', event.target.value)}
                placeholder="Ej: 10 o 12,5"
              />
            </Field>
            <Field
              label="Precio de contado"
              helper={`${cashAutofilled ? 'Autocompletado desde costo. ' : ''}${cashPrefillLabel ? `${cashPrefillLabel} ` : ''}${moneyCashHelper.text}`}
              helperTone={moneyCashHelper.tone}
            >
              <input
                className={cashAutofilled || cashPrefillLabel ? 'input input--suggested' : 'input'}
                inputMode="decimal"
                value={state.intakeForm.cashPriceCents}
                onChange={(event) => actions.updateIntakeField('cashPriceCents', event.target.value)}
                placeholder="Ej: 15000"
              />
            </Field>
            <Field
              label="Precio de lista"
              helper={`${listPrefillLabel ? `${listPrefillLabel} ` : ''}${moneyListHelper.text}`}
              helperTone={moneyListHelper.tone}
            >
              <input
                className={listPrefillLabel ? 'input input--suggested' : 'input'}
                inputMode="decimal"
                value={state.intakeForm.listPriceCents}
                onChange={(event) => actions.updateIntakeField('listPriceCents', event.target.value)}
                placeholder="Ej: 18000"
              />
            </Field>
            <Field label="Fecha de ingreso" helper="Fecha real del ingreso.">
              <input
                className="input"
                type="date"
                value={state.intakeForm.intakeDate}
                onChange={(event) => actions.updateIntakeField('intakeDate', event.target.value)}
              />
            </Field>
            <Field label="Notas opcionales" helper="Solo si necesitás contexto interno.">
              <textarea
                className="textarea"
                rows={4}
                value={state.intakeForm.notes}
                onChange={(event) => actions.updateIntakeField('notes', event.target.value)}
                placeholder="Agregá observaciones internas sobre este ingreso, si hace falta."
              />
            </Field>
          </div>
        </div>
      </Surface>

      <Surface className="catalog-stock-step catalog-stock-review">
        <div className="catalog-stock-step__header">
          <Badge tone="info">3</Badge>
          <div>
            <h3 className="surface__title">Revisar y guardar</h3>
            <p className="surface__description">
              {isNewIntake
                ? 'Confirmá el producto, la cantidad que se suma al stock y los valores antes de guardar.'
                : 'Confirmá el producto, el stock inicial y los valores antes de guardar.'}
            </p>
          </div>
        </div>
        <div className="catalog-stock-review__grid">
          <div>
            <p className="catalog-stock-review__label">Producto</p>
            <p className="catalog-stock-review__value">
              {state.view === 'new-intake'
                ? joinProductParts(state.intakeProduct?.name, state.intakeProduct?.variant ? formatVariantLabel(state.intakeProduct.variant) : '') || 'Producto seleccionado'
                : joinProductParts(state.newProduct.name || 'Producto nuevo', state.newProduct.variant ? formatVariantLabel(state.newProduct.variant) : '')}
            </p>
            <p className="catalog-stock-review__meta">
              {state.view === 'new-intake'
                ? joinProductParts(
                    state.intakeProduct ? formatCategoryLabel(state.intakeProduct.category) : '',
                    state.intakeProduct ? formatMaterialLabel(state.intakeProduct.material) : ''
                  )
                : joinProductParts(formatCategoryLabel(state.newProduct.category), formatMaterialLabel(state.newProduct.material))}
            </p>
          </div>
          <div>
            <p className="catalog-stock-review__label">{isNewIntake ? 'Ingreso adicional' : 'Primer ingreso'}</p>
            <p className="catalog-stock-review__value">{state.intakeForm.enteredQuantity.trim() || '-'} unidades</p>
            <p className="catalog-stock-review__meta">
              {isNewIntake && state.detailProduct
                ? `Se suma a ${state.detailProduct.availableQuantity} disponible${state.detailProduct.availableQuantity === 1 ? '' : 's'} · Fecha: ${state.intakeForm.intakeDate || '-'}`
                : `Fecha: ${state.intakeForm.intakeDate || '-'}`}
            </p>
          </div>
        </div>
        <dl className="data-list catalog-stock-review__list">
          <dt>Costo proveedor</dt>
          <dd>{getMoneyPreview(state.intakeForm.supplierUnitCostCents)}</dd>
          <dt>Precio contado</dt>
          <dd>{getMoneyPreview(state.intakeForm.cashPriceCents)}</dd>
          <dt>Precio lista</dt>
          <dd>{getMoneyPreview(state.intakeForm.listPriceCents)}</dd>
          <dt>Ganancia</dt>
          <dd>{getPercentagePreview(state.intakeForm.profitPercentageBasisPoints)}</dd>
          {pricingPreview ? (
            <>
              <dt>Ganancia estimada contado</dt>
              <dd>{formatCurrencyFromCents(pricingPreview.cashExpectedProfitCents)}</dd>
              <dt>Ganancia estimada lista</dt>
              <dd>{formatCurrencyFromCents(pricingPreview.listExpectedProfitCents)}</dd>
            </>
          ) : null}
        </dl>

        {state.submitMessage ? (
          <Banner tone={state.submitStatus === 'error' ? 'error' : 'success'} message={state.submitMessage} role="status" />
        ) : null}

        <div className="actions">
          <Button type="button" variant={submitReadiness.canSubmit ? 'success' : 'secondary'} onClick={() => void actions.submit()} disabled={!submitReadiness.canSubmit}>
            {state.submitStatus === 'saving' ? 'Guardando…' : submitLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => (state.view === 'new-product' ? actions.goToHub() : state.detailProduct ? void actions.openProductDetail(state.detailProduct.reusableProductId) : actions.goToHub())}
          >
            {cancelLabel}
          </Button>
        </div>
        {submitReadiness.reason ? <p className="muted" style={{ marginBottom: 0 }}>{submitReadiness.reason}</p> : null}
      </Surface>

      {state.duplicateWarning ? (
        <Banner tone="warning" title="Puede que estés por crear un duplicado" message="Ya existe al menos un producto muy parecido en el catálogo. Revisalo antes de seguir.">
          <ul className="list">
            {state.duplicateWarning.matches.map((match) => (
              <li key={match.reusableProductId} className="list-row">
                <div className="list-row__content">
                  <p className="list-row__title">
                    {joinProductParts(
                      match.name,
                      formatMaterialLabel(match.material),
                      match.variant ? formatVariantLabel(match.variant) : ''
                    )}
                  </p>
                  <p className="list-row__text">{match.availableQuantity} disponibles</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="actions">
            <Button type="button" variant="primary" onClick={() => void actions.confirmDuplicateWarning()}>
              Crear igual y guardar ingreso
            </Button>
            <Button type="button" variant="secondary" onClick={() => actions.cancelDuplicateWarning()}>
              Volver a revisar
            </Button>
          </div>
        </Banner>
      ) : null}
    </div>
  );
}

export function CatalogStockPanel({ bridge, initialState, onBack, onOpenSales, onOpenConsignments }: CatalogStockPanelProps): JSX.Element {
  const [state, setState] = useState<CatalogStockState>(() => initialState ?? createInitialCatalogStockState());
  const actions = useMemo(
    () =>
      createCatalogStockActions({
        bridge,
        getState: () => state,
        setState
      }),
    [bridge, state]
  );

  useEffect(() => {
    if (state.view !== 'hub') {
      return;
    }

    void actions.loadCatalogHub();
  }, [state.view, state.hubSearchQuery, state.categoryFilter]);

  useEffect(() => {
    if (state.view !== 'hub') {
      return;
    }

    void actions.loadHubSummary();
  }, [state.view]);

  useEffect(() => {
    if (!hasUnsavedChanges(state)) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state]);

  useEffect(() => {
    if (state.view !== 'new-product') {
      return;
    }

    const query = buildEarlyDuplicateQuery(state);
    if (query.length < 3) {
      return;
    }

    void actions.loadEarlyDuplicateMatches();
  }, [state.view, state.newProduct.category, state.newProduct.name, state.newProduct.material, state.newProduct.variant, state.newProduct.jewelryMaterialOption]);

  const totalPages = Math.max(1, Math.ceil(state.catalogProducts.length / HUB_PAGE_SIZE));
  const currentPage = Math.min(state.hubPage, totalPages);
  const pageStart = (currentPage - 1) * HUB_PAGE_SIZE;
  const visibleProducts = state.catalogProducts.slice(pageStart, pageStart + HUB_PAGE_SIZE);
  const outOfStockCount = state.catalogProducts.filter((product) => product.isOutOfStock).length;

  return (
    <section className="page-stack">
      {state.view === 'hub' ? (
        <>
          <PageHeader
            title="Catálogo y stock"
            description="Consultá el catálogo activo, revisá el stock y seguí ventas o liquidaciones pendientes desde el inicio."
            actions={
              <Button type="button" variant="primary" onClick={() => actions.openNewProduct()}>
                Agregar producto
              </Button>
            }
          />

          <div className="grid-2">
            {renderHubSummaryCard({
              label: 'Pendientes de venta',
              count: state.pendingSalesCount,
              actionLabel: 'Ver ventas',
              onAction: onOpenSales
            })}
            {renderHubSummaryCard({
              label: 'Pendientes de liquidación',
              count: state.pendingSettlementCount,
              actionLabel: 'Ver liquidaciones',
              onAction: onOpenConsignments
            })}
          </div>

          {state.hubSummaryError ? <Banner tone="info" message={state.hubSummaryError} /> : null}

          <Surface tone="muted" className="catalog-home-tools">
            <div className="catalog-home-tools__header">
              <p className="catalog-home-tools__title">Herramientas</p>
              <p className="catalog-home-tools__description">Buscá y filtrá antes de recorrer la lista.</p>
            </div>
            <div className="grid-2">
              <Field label="Buscar en el catálogo">
                <input
                  className="input"
                  value={state.hubSearchQuery}
                  onChange={(event) => actions.setHubSearchQuery(event.target.value)}
                  placeholder="Buscá por nombre, categoría, material o variante"
                />
              </Field>
              <div className="field">
                <span className="field__label">Categoría</span>
                <div className="actions">
                  {[
                    ['all', 'Todas'],
                    ['jewelry', 'Joyas'],
                    ['mate', 'Mates'],
                    ['clothing', 'Ropa']
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={state.categoryFilter === value ? 'ghost' : 'secondary'}
                      className={state.categoryFilter === value ? 'catalog-home-filter-button' : undefined}
                      onClick={() => actions.setCategoryFilter(value as CatalogStockState['categoryFilter'])}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Surface>

          {state.hubError ? <Banner tone="error" message={state.hubError} /> : null}
          {state.hubStatus === 'loading' ? <Banner tone="info" message="Cargando catálogo…" /> : null}
          {state.hubStatus === 'ready' && outOfStockCount > 0 ? (
            <Surface tone="soft" className="catalog-home-alert">
              <p className="catalog-home-alert__text">
                Hay {outOfStockCount === 1 ? '1 producto sin stock' : `${outOfStockCount} productos sin stock`} en esta vista.
              </p>
            </Surface>
          ) : null}

          <Surface>
            {state.catalogProducts.length > 0 ? (
              <div className="spaced">
                <div className="catalog-home-list-header">
                  <div>
                    <h3 className="surface__title">Productos</h3>
                    <p className="surface__description">
                      Mostrando {visibleProducts.length} de {state.catalogProducts.length} productos.
                    </p>
                  </div>
                  <p className="catalog-home-list-header__page">Página {currentPage} de {totalPages}</p>
                </div>
                <ul className="list">
                  {visibleProducts.map((product) =>
                    renderCatalogCard(
                      product,
                      (id) => void actions.openProductDetail(id),
                      (reference) => void actions.openNewIntake(reference)
                    )
                  )}
                </ul>
                {totalPages > 1 ? (
                  <div className="catalog-home-pagination">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => actions.setHubPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <p className="catalog-home-pagination__status">Página {currentPage} de {totalPages}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => actions.setHubPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No hay productos para mostrar."
                description="Cuando registres el primer producto, va a aparecer acá junto con su stock."
              />
            )}
          </Surface>
        </>
      ) : null}

      {state.view === 'detail' ? (
        <>
          <PageHeader
            title={state.detailProduct?.name ?? 'Detalle del producto'}
            description={state.detailProduct ? 'Estado actual del producto y ultimos movimientos de stock.' : 'Consultá el detalle del producto y sus ingresos recientes.'}
            actions={
              state.detailProduct ? (
                <div className="catalog-product-detail-header-actions">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      actions.openNewIntake({
                        reusableProductId: state.detailProduct!.reusableProductId,
                        category: state.detailProduct!.category,
                        name: state.detailProduct!.name,
                        material: state.detailProduct!.material,
                        variant: state.detailProduct!.variant
                      })
                    }
                  >
                    Registrar ingreso adicional
                  </Button>
                  <div className="catalog-product-detail-header-actions__secondary">
                    <Button type="button" variant="secondary" onClick={() => actions.goToHub()}>
                      Volver al catálogo
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => actions.openEditProduct()}>
                      Editar producto
                    </Button>
                    <Button type="button" variant="ghost" className="catalog-product-detail-delete" onClick={() => void actions.deleteProduct()}>
                      Eliminar producto
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="secondary" onClick={() => actions.goToHub()}>
                  Volver al catálogo
                </Button>
              )
            }
          >
            {state.detailProduct ? (
              <div className="catalog-product-detail-subtitle" aria-label="Producto: categoria, material y variante">
                <Badge tone="neutral">{formatCategoryLabel(state.detailProduct.category)}</Badge>
                <Badge tone="neutral">{formatMaterialLabel(state.detailProduct.material)}</Badge>
                {state.detailProduct.variant ? <Badge tone="neutral">{formatVariantLabel(state.detailProduct.variant)}</Badge> : null}
              </div>
            ) : null}
            {state.detailProduct?.description ? <p className="subtle">{state.detailProduct.description}</p> : null}
          </PageHeader>

          {state.detailStatus === 'loading' ? <Banner tone="info" message="Cargando producto…" /> : null}
          {state.detailError ? <Banner tone="error" message={state.detailError} /> : null}

          {state.detailProduct ? (
            <>
              {state.submitMessage ? <Banner tone="success" message={state.submitMessage} role="status" /> : null}

              <Surface className="catalog-product-detail-state">
                <div className="catalog-product-detail-section-header">
                  <div>
                    <h3 className="surface__title">Estado actual</h3>
                    <p className="surface__description">Lo mas importante para operar hoy: stock primero, despues precios y margen.</p>
                  </div>
                </div>
                <div className="catalog-product-detail-state__grid">
                  <div className="catalog-product-detail-stock-card">
                    <p className="catalog-product-detail-stock-card__label">Stock disponible</p>
                    <p className="catalog-product-detail-stock-card__value">{state.detailProduct.availableQuantity}</p>
                    <div className="catalog-product-detail-stock-card__meta">
                      <Badge tone={getStockStatusTone(state.detailProduct.availableQuantity)}>{getStockStatusLabel(state.detailProduct.availableQuantity)}</Badge>
                      <span>{state.detailProduct.availableQuantity === 1 ? '1 unidad lista para vender' : `${state.detailProduct.availableQuantity} unidades listas para vender`}</span>
                    </div>
                  </div>
                  <dl className="data-list catalog-product-detail-state__list">
                    <dt>Precio contado</dt>
                    <dd>{state.detailProduct.currentCashPriceCents != null ? formatCurrencyFromCents(state.detailProduct.currentCashPriceCents) : 'Sin datos'}</dd>
                    <dt>Precio de lista</dt>
                    <dd>{state.detailProduct.currentListPriceCents != null ? formatCurrencyFromCents(state.detailProduct.currentListPriceCents) : 'Sin datos'}</dd>
                    <dt>Margen</dt>
                    <dd>
                      {state.detailProduct.currentProfitPercentageBasisPoints != null
                        ? formatPercentageFromBasisPoints(state.detailProduct.currentProfitPercentageBasisPoints)
                        : 'Sin datos'}
                    </dd>
                    {renderGainSummaryEntries(
                      renderCatalogGainEntries({
                        cashGainCents: state.detailProduct.currentCashExpectedProfitCents,
                        listGainCents: state.detailProduct.currentListExpectedProfitCents,
                        personalizationGainCents: state.detailProduct.currentPersonalizationExpectedProfitCents,
                        cashTotalGainCents: state.detailProduct.currentCashTotalExpectedProfitCents,
                        listTotalGainCents: state.detailProduct.currentListTotalExpectedProfitCents
                      })
                    )}
                  </dl>
                </div>
              </Surface>

              <Surface className="catalog-product-detail-history">
                <div className="catalog-product-detail-section-header">
                  <div>
                    <h3 className="surface__title">Ingresos recientes</h3>
                    <p className="surface__description">Ultimos movimientos registrados para entender rapido como fue cambiando el stock y los valores.</p>
                  </div>
                  <p className="catalog-product-detail-history__hint">Mostramos hasta 5 ingresos recientes.</p>
                </div>
                {state.detailProduct.recentIntakes.length > 0 ? (
                  <ul className="list">
                    {state.detailProduct.recentIntakes.map((intake) => {
                      const gainEntries = renderCatalogGainEntries({
                        cashGainCents: intake.cashExpectedProfitCents,
                        listGainCents: intake.listExpectedProfitCents,
                        personalizationGainCents: intake.personalizationExpectedProfitCents,
                        cashTotalGainCents: intake.cashTotalExpectedProfitCents,
                        listTotalGainCents: intake.listTotalExpectedProfitCents
                      });

                      return (
                        <li className="list-row catalog-product-detail-intake-row" key={intake.stockIntakeId}>
                          <div className="list-row__content">
                            <div className="list-row__headline">
                              <p className="list-row__title">{formatDateLabel(intake.intakeDate)}</p>
                              <Badge tone="info">Ingreso de {intake.enteredQuantity}</Badge>
                            </div>
                            <p className="list-row__text">Stock despues de este ingreso: {intake.availableQuantity}</p>
                            <p className="list-row__text">
                              Costo proveedor: {formatCurrencyFromCents(intake.supplierUnitCostCents)} · Contado: {formatCurrencyFromCents(intake.cashPriceCents)} · Lista:{' '}
                              {formatCurrencyFromCents(intake.listPriceCents)}
                            </p>
                            {gainEntries.length > 0 ? <p className="list-row__text">{renderGainText(gainEntries)}</p> : null}
                            {intake.notes ? <p className="subtle">{intake.notes}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState title="Sin ingresos registrados" description="Este producto todavía no tiene ingresos registrados." />
                )}
              </Surface>
            </>
          ) : null}
        </>
      ) : null}

      {state.view === 'new-product' ? (
        <>
          <PageHeader
            title="Agregar producto"
            description="Creá el producto y registrá su primer ingreso en este mismo paso."
            actions={
              <Button type="button" variant="secondary" onClick={() => actions.goToHub()}>
                Volver al catálogo
              </Button>
            }
          />

          <Surface tone="muted" className="catalog-stock-steps-overview">
            <div className="catalog-stock-steps-overview__item catalog-stock-steps-overview__item--active">
              <span className="catalog-stock-steps-overview__index">1</span>
              <div>
                <p className="catalog-stock-steps-overview__title">Datos del producto</p>
                <p className="catalog-stock-steps-overview__text">Base del catálogo</p>
              </div>
            </div>
            <div className="catalog-stock-steps-overview__item catalog-stock-steps-overview__item--active">
              <span className="catalog-stock-steps-overview__index">2</span>
              <div>
                <p className="catalog-stock-steps-overview__title">Primer ingreso</p>
                <p className="catalog-stock-steps-overview__text">Stock y precios iniciales</p>
              </div>
            </div>
            <div className="catalog-stock-steps-overview__item catalog-stock-steps-overview__item--active">
              <span className="catalog-stock-steps-overview__index">3</span>
              <div>
                <p className="catalog-stock-steps-overview__title">Revisar y guardar</p>
                <p className="catalog-stock-steps-overview__text">Chequeo final antes de confirmar</p>
              </div>
            </div>
          </Surface>

          {renderProductFields(state, actions)}

          {renderIntakeForm(state, actions)}
        </>
      ) : null}

      {state.view === 'edit-product' ? (
        <>
          <PageHeader
            title="Editar producto"
            description="Modificá solo los datos reutilizables del catálogo. Los movimientos históricos no cambian."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  state.detailProduct ? void actions.openProductDetail(state.detailProduct.reusableProductId) : actions.goToHub()
                }
              >
                {state.detailProduct ? 'Volver al producto' : 'Volver al catálogo'}
              </Button>
            }
          />

          {renderProductFields(state, actions)}

          {state.submitMessage ? (
            <Banner tone={state.submitStatus === 'error' ? 'error' : 'success'} message={state.submitMessage} role="status" />
          ) : null}

          <div className="actions">
            <Button type="button" variant="success" onClick={() => void actions.saveProductChanges()}>
              {state.submitStatus === 'saving' ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variant="danger" onClick={() => void actions.deleteProduct()}>
              Eliminar producto
            </Button>
          </div>
        </>
      ) : null}

      {state.view === 'new-intake' ? (
        <>
          <PageHeader
            title="Registrar ingreso adicional"
            description="Sumá stock a un producto existente y ajustá los valores de este ingreso si hace falta."
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  state.detailProduct ? void actions.openProductDetail(state.detailProduct.reusableProductId) : actions.goToHub()
                }
              >
                {state.detailProduct ? 'Volver al producto' : 'Volver al catálogo'}
              </Button>
            }
          />

          {state.intakeProduct ? (
            <Surface tone="info">
              <h3 className="surface__title">Producto seleccionado</h3>
              <p className="surface__description">
                <strong>{joinProductParts(state.intakeProduct.name, state.intakeProduct.variant ? formatVariantLabel(state.intakeProduct.variant) : '')}</strong>
              </p>
              <p className="subtle">
                {joinProductParts(formatCategoryLabel(state.intakeProduct.category), formatMaterialLabel(state.intakeProduct.material))}
              </p>
              {state.detailProduct ? <p className="catalog-stock-selected-product-meta">Stock actual: {state.detailProduct.availableQuantity}</p> : null}
            </Surface>
          ) : null}

          {state.detailStatus === 'loading' ? <Banner tone="info" message="Cargando valores actuales del producto…" /> : null}
          {state.detailError ? <Banner tone="warning" message={state.detailError} /> : null}

          {renderIntakeForm(state, actions)}
        </>
      ) : null}
    </section>
  );
}
