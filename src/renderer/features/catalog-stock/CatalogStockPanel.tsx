import React, { useEffect, useMemo, useState } from 'react';
import type { AppBridge } from '../../../shared/contracts/app';
import { REUSABLE_PRODUCT_CATEGORIES, type CatalogListItem } from '../../../shared/contracts/catalog';
import { Badge, Banner, Button, EmptyState, Field, PageHeader, Surface } from '../../ui';
import {
  createCatalogStockActions,
  createInitialCatalogStockState,
  formatCategoryLabel,
  formatCurrencyFromCents,
  formatMaterialLabel,
  formatPercentageFromBasisPoints,
  formatVariantLabel,
  getActiveCategory,
  getPricingPreview,
  getSubmitReadiness,
  hasUnsavedChanges,
  tryParseCurrencyInputToCents,
  tryParsePercentageInputToBasisPoints,
  type CatalogStockState
} from './model';

interface CatalogStockPanelProps {
  bridge: AppBridge;
  initialState?: CatalogStockState;
  onBack?: () => void;
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

function joinProductParts(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter((part) => part.length > 0).join(' · ');
}

function renderCatalogCard(product: CatalogListItem, onOpen: (reusableProductId: number) => void): JSX.Element {
  return (
    <li className="list-row" key={product.reusableProductId}>
      <div className="list-row__content">
        <p className="list-row__title">
          {joinProductParts(product.name, product.variant ? formatVariantLabel(product.variant) : '')}
        </p>
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
        <Badge tone={product.isOutOfStock ? 'warning' : 'success'}>{product.isOutOfStock ? 'Sin stock' : 'Con stock'}</Badge>
        <Button type="button" variant="primary" onClick={() => onOpen(product.reusableProductId)}>
          Ver producto
        </Button>
      </div>
    </li>
  );
}

function renderProductFields(
  state: CatalogStockState,
  actions: ReturnType<typeof createCatalogStockActions>
): JSX.Element {
  const isJewelry = state.newProduct.category === 'jewelry';
  const isClothing = state.newProduct.category === 'clothing';

  return (
    <Surface>
      <h3 className="surface__title">Datos del producto</h3>
      <div className="spaced">
        <Field label="Categoría">
          <select className="select" value={state.newProduct.category} onChange={(event) => actions.updateNewProduct('category', event.target.value)}>
            {REUSABLE_PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatCategoryLabel(category)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid-2">
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
            <Field label="Material" helper={isClothing ? 'En ropa es opcional.' : undefined}>
              <input className="input" value={state.newProduct.material} onChange={(event) => actions.updateNewProduct('material', event.target.value)} />
            </Field>
          )}
          <Field label="Variante">
            <input className="input" value={state.newProduct.variant} onChange={(event) => actions.updateNewProduct('variant', event.target.value)} />
          </Field>
          <Field label="Descripción">
            <input className="input" value={state.newProduct.description} onChange={(event) => actions.updateNewProduct('description', event.target.value)} />
          </Field>
        </div>
      </div>
    </Surface>
  );
}

function renderIntakeForm(state: CatalogStockState, actions: ReturnType<typeof createCatalogStockActions>): JSX.Element {
  const activeCategory = getActiveCategory(state);
  const pricingPreview = getPricingPreview(state);
  const submitReadiness = getSubmitReadiness(state);
  const submitLabel = state.view === 'new-product' ? 'Crear producto y registrar ingreso' : 'Registrar ingreso';

  return (
    <div className="spaced">
      <Surface>
        <h3 className="surface__title">Datos del ingreso</h3>
        <div className="spaced">
          <Surface tone="soft">
            <h4 className="surface__title">Cantidad</h4>
            <p className="surface__description">La cantidad disponible inicial será igual a la cantidad ingresada.</p>
            <div style={{ marginTop: 12 }}>
              <Field
                label="Cantidad ingresada"
                helper="Este ingreso quedará con esa misma cantidad disponible al guardarse."
              >
                <input
                  className="input"
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
              helper={getMoneyHelper(state.intakeForm.supplierUnitCostCents).text}
              helperTone={getMoneyHelper(state.intakeForm.supplierUnitCostCents).tone}
            >
              <input
                className="input"
                inputMode="decimal"
                value={state.intakeForm.supplierUnitCostCents}
                onChange={(event) => actions.updateIntakeField('supplierUnitCostCents', event.target.value)}
                placeholder="Ej: 12500 o 12500,50"
              />
            </Field>
            <Field
              label="Porcentaje de ganancia"
              helper={
                state.view !== 'new-intake' && activeCategory === 'jewelry' && state.newProduct.jewelryMaterialOption
                  ? `Sugerencia actual: ${
                      state.newProduct.jewelryMaterialOption === 'gold' ? '3%' : '10%'
                    }. Podés cambiarla si hace falta. ${getPercentageHelper(state.intakeForm.profitPercentageBasisPoints).text}`
                  : getPercentageHelper(state.intakeForm.profitPercentageBasisPoints).text
              }
              helperTone={getPercentageHelper(state.intakeForm.profitPercentageBasisPoints).tone}
            >
              <input
                className="input"
                inputMode="decimal"
                value={state.intakeForm.profitPercentageBasisPoints}
                onChange={(event) => actions.updateIntakeField('profitPercentageBasisPoints', event.target.value)}
                placeholder="Ej: 10 o 12,5"
              />
            </Field>
            <Field
              label="Precio de contado"
              helper={`Se completa con el costo del proveedor al empezar, pero podés editarlo. ${getMoneyHelper(state.intakeForm.cashPriceCents).text}`}
              helperTone={getMoneyHelper(state.intakeForm.cashPriceCents).tone}
            >
              <input
                className="input"
                inputMode="decimal"
                value={state.intakeForm.cashPriceCents}
                onChange={(event) => actions.updateIntakeField('cashPriceCents', event.target.value)}
                placeholder="Ej: 15000"
              />
            </Field>
            <Field
              label="Precio de lista"
              helper={getMoneyHelper(state.intakeForm.listPriceCents).text}
              helperTone={getMoneyHelper(state.intakeForm.listPriceCents).tone}
            >
              <input
                className="input"
                inputMode="decimal"
                value={state.intakeForm.listPriceCents}
                onChange={(event) => actions.updateIntakeField('listPriceCents', event.target.value)}
                placeholder="Ej: 18000"
              />
            </Field>
            <Field label="Fecha de ingreso" helper="Elegí la fecha en que ingresó este stock.">
              <input
                className="input"
                type="date"
                value={state.intakeForm.intakeDate}
                onChange={(event) => actions.updateIntakeField('intakeDate', event.target.value)}
              />
            </Field>
            <Field label="Notas" helper="Este campo es opcional.">
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

      {pricingPreview ? (
        <Surface>
          <h3 className="surface__title">Resumen esperado</h3>
          <dl className="data-list">
            <dt>Ganancia</dt>
            <dd>{formatCurrencyFromCents(pricingPreview.expectedProfitCents)}</dd>
            <dt>Ganancia total</dt>
            <dd>{formatCurrencyFromCents(pricingPreview.totalExpectedProfitCents)}</dd>
          </dl>
        </Surface>
      ) : null}

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

      {state.submitMessage ? (
        <Banner tone={state.submitStatus === 'error' ? 'error' : 'success'} message={state.submitMessage} role="status" />
      ) : null}

      <div>
        <Button type="button" variant={submitReadiness.canSubmit ? 'success' : 'secondary'} onClick={() => void actions.submit()} disabled={!submitReadiness.canSubmit}>
          {state.submitStatus === 'saving' ? 'Guardando…' : submitLabel}
        </Button>
        {submitReadiness.reason ? <p className="muted" style={{ marginBottom: 0 }}>{submitReadiness.reason}</p> : null}
      </div>
    </div>
  );
}

export function CatalogStockPanel({ bridge, initialState, onBack }: CatalogStockPanelProps): JSX.Element {
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

  return (
    <section className="page-stack">
      {state.view === 'hub' ? (
        <>
          <PageHeader
            title="Catálogo y stock"
            description="Buscá, filtrá y consultá productos del catálogo."
            actions={
              <>
                <Button type="button" variant="primary" onClick={() => actions.openNewProduct()}>
                  Agregar producto
                </Button>
                <Button type="button" variant="secondary" onClick={() => onBack?.()}>
                  Volver
                </Button>
              </>
            }
          />

          <Surface>
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
                      variant={state.categoryFilter === value ? 'primary' : 'secondary'}
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

          <Surface>
            {state.catalogProducts.length > 0 ? (
              <ul className="list">{state.catalogProducts.map((product) => renderCatalogCard(product, (id) => void actions.openProductDetail(id)))}</ul>
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
            description={
              state.detailProduct
                ? joinProductParts(
                    formatCategoryLabel(state.detailProduct.category),
                    formatMaterialLabel(state.detailProduct.material),
                    state.detailProduct.variant ? formatVariantLabel(state.detailProduct.variant) : ''
                  )
                : 'Consultá el detalle del producto y sus ingresos recientes.'
            }
            actions={
              <>
                <Button type="button" variant="secondary" onClick={() => actions.goToHub()}>
                  Volver al catálogo
                </Button>
                {state.detailProduct ? (
                  <Button type="button" variant="secondary" onClick={() => actions.openEditProduct()}>
                    Editar producto
                  </Button>
                ) : null}
                {state.detailProduct ? (
                  <Button type="button" variant="danger" onClick={() => void actions.deleteProduct()}>
                    Eliminar producto
                  </Button>
                ) : null}
                {state.detailProduct ? (
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
                    Registrar nuevo ingreso
                  </Button>
                ) : null}
              </>
            }
          >
            {state.detailProduct?.description ? <p className="subtle">{state.detailProduct.description}</p> : null}
          </PageHeader>

          {state.detailStatus === 'loading' ? <Banner tone="info" message="Cargando producto…" /> : null}
          {state.detailError ? <Banner tone="error" message={state.detailError} /> : null}

          {state.detailProduct ? (
            <>
              {state.submitMessage ? <Banner tone="success" message={state.submitMessage} role="status" /> : null}

              <Surface>
                <h3 className="surface__title">Resumen del producto</h3>
                <dl className="data-list">
                  <dt>Stock disponible</dt>
                  <dd>{state.detailProduct.availableQuantity}</dd>
                  <dt>Precio de contado actual</dt>
                  <dd>{state.detailProduct.currentCashPriceCents != null ? formatCurrencyFromCents(state.detailProduct.currentCashPriceCents) : 'Sin datos'}</dd>
                  <dt>Precio de lista actual</dt>
                  <dd>{state.detailProduct.currentListPriceCents != null ? formatCurrencyFromCents(state.detailProduct.currentListPriceCents) : 'Sin datos'}</dd>
                  <dt>Porcentaje de ganancia actual</dt>
                  <dd>
                    {state.detailProduct.currentProfitPercentageBasisPoints != null
                      ? formatPercentageFromBasisPoints(state.detailProduct.currentProfitPercentageBasisPoints)
                      : 'Sin datos'}
                  </dd>
                  <dt>Ganancia</dt>
                  <dd>{state.detailProduct.currentExpectedProfitCents != null ? formatCurrencyFromCents(state.detailProduct.currentExpectedProfitCents) : 'Sin datos'}</dd>
                  {state.detailProduct.currentPersonalizationExpectedProfitCents != null ? (
                    <>
                      <dt>Ganancia por personalización</dt>
                      <dd>{formatCurrencyFromCents(state.detailProduct.currentPersonalizationExpectedProfitCents)}</dd>
                    </>
                  ) : null}
                  <dt>Ganancia total</dt>
                  <dd>{state.detailProduct.currentTotalExpectedProfitCents != null ? formatCurrencyFromCents(state.detailProduct.currentTotalExpectedProfitCents) : 'Sin datos'}</dd>
                </dl>
              </Surface>

              <Surface>
                <h3 className="surface__title">Ingresos recientes</h3>
                {state.detailProduct.recentIntakes.length > 0 ? (
                  <ul className="list">
                    {state.detailProduct.recentIntakes.map((intake) => (
                      <li className="list-row" key={intake.stockIntakeId}>
                        <div className="list-row__content">
                          <p className="list-row__title">{intake.intakeDate}</p>
                          <p className="list-row__text">Ingresaron {intake.enteredQuantity} · Disponibles ahora: {intake.availableQuantity}</p>
                          <p className="list-row__text">
                            Costo: {formatCurrencyFromCents(intake.supplierUnitCostCents)} · Contado: {formatCurrencyFromCents(intake.cashPriceCents)} · Lista:{' '}
                            {formatCurrencyFromCents(intake.listPriceCents)}
                          </p>
                          <p className="list-row__text">
                            Ganancia: {formatCurrencyFromCents(intake.expectedProfitCents)} · Ganancia total: {formatCurrencyFromCents(intake.totalExpectedProfitCents)}
                          </p>
                          {intake.notes ? <p className="subtle">{intake.notes}</p> : null}
                        </div>
                      </li>
                    ))}
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
            description="Creá el producto y registrá su primer ingreso en una pantalla separada."
            actions={
              <Button type="button" variant="secondary" onClick={() => actions.goToHub()}>
                Volver al catálogo
              </Button>
            }
          />

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
            title="Registrar nuevo ingreso"
            description="Este ingreso ya se abre con el producto seleccionado."
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
            </Surface>
          ) : null}

          {renderIntakeForm(state, actions)}
        </>
      ) : null}
    </section>
  );
}
