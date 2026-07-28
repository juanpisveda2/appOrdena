import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppBridge } from '../../../shared/contracts/app';
import type { SaleSnapshot } from '../../../shared/contracts/sales';
import { Badge, Banner, Button, EmptyState, Field, PageHeader, Surface } from '../../ui';
import { buildGainDisplayEntries } from '../gainPresentation';
import {
  SALES_HISTORY_PAGE_SIZE,
  canAssignCustomerForPaymentRecovery,
  createInitialSalesState,
  createSalesActions,
  formatCurrencyFromCents,
  formatVariantLabel,
  getDraftItemBaseUnitPrice,
  getCustomerRuleFeedback,
  getDraftGainTotals,
  getDraftItemGainPreview,
  getDraftItemPersonalizationUnitPrice,
  getDraftItemUnitPrice,
    getDraftTotals,
    getAvailableSalesSearchResults,
    getSalesHistoryPage,
  getSalesHistoryPageCount,
  getSaleCustomerLabel,
  shouldShowPendingBalance,
  type SalesState
} from './model';

interface SalesPanelProps {
  bridge: AppBridge;
  entryPoint?: 'draft' | 'history';
  initialState?: SalesState;
  onBack?: () => void;
}

function renderHistoryStatus(status: SaleSnapshot['status'] | string): string {
  if (status === 'paid') return 'Pagada';
  if (status === 'partial_payment') return 'Pago parcial';
  if (status === 'pending_payment') return 'Pendiente';
  return 'Cancelada';
}

function renderStatusTone(status: SaleSnapshot['status'] | string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'partial_payment') return 'warning';
  if (status === 'pending_payment') return 'info';
  return 'danger';
}

function formatSaleDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(parsed);
}

function renderSaleSummary(sale: SaleSnapshot): JSX.Element {
  const showBalance = shouldShowPendingBalance(sale.balanceCents);
  const gainEntries = buildGainDisplayEntries({
    baseGainCents: sale.totalProductGainCents ?? sale.totalProfitCents,
    personalizationGainCents: sale.totalPersonalizationGainCents ?? null,
    totalGainCents: sale.totalProfitCents
  });

  return (
    <Surface>
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h3 className="surface__title">Resumen confirmado</h3>
        <Badge tone={renderStatusTone(sale.status)}>{renderHistoryStatus(sale.status)}</Badge>
      </div>
      <dl className="data-list">
        <dt>Venta</dt>
        <dd>#{sale.saleNumber}</dd>
        <dt>Cliente</dt>
        <dd>{getSaleCustomerLabel(sale)}</dd>
        <dt>Total</dt>
        <dd>{formatCurrencyFromCents(sale.totalCents)}</dd>
        <dt>Pagado</dt>
        <dd>{formatCurrencyFromCents(sale.paidCents)}</dd>
        {showBalance ? (
          <>
            <dt>Saldo</dt>
            <dd>{formatCurrencyFromCents(sale.balanceCents)}</dd>
          </>
        ) : null}
        {gainEntries.map((entry) => (
          <React.Fragment key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{formatCurrencyFromCents(entry.amountCents)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Surface>
  );
}

function renderGainPreviewText(
  productGainCents: number | null,
  personalizationGainCents: number | null,
  totalExpectedProfitCents: number | null,
  priceType?: 'cash' | 'list'
): string | null {
  const entries = buildGainDisplayEntries({
    baseGainCents: productGainCents,
    personalizationGainCents,
    totalGainCents: totalExpectedProfitCents,
    priceType
  });

  if (entries.length === 0) {
    return null;
  }

  return entries.map((entry) => `${entry.label}: ${formatCurrencyFromCents(entry.amountCents)}`).join(' · ');
}

export function SalesPanel({ bridge, entryPoint = 'draft', initialState, onBack }: SalesPanelProps): JSX.Element {
  const [state, setState] = useState<SalesState>(() => initialState ?? createInitialSalesState());
  const historyEntryAppliedRef = useRef(false);
  const actions = useMemo(
    () =>
      createSalesActions({
        bridge,
        getState: () => state,
        setState
      }),
    [bridge, state]
  );

  const feedback = state.view !== 'detail'
    ? (() => {
        try {
          return getCustomerRuleFeedback(state);
        } catch (error) {
          return error instanceof Error ? error.message : 'Revisá la venta antes de continuar.';
        }
      })()
    : null;

  const totals = state.view !== 'detail'
    ? (() => {
        try {
          return getDraftTotals(state);
        } catch {
          return { totalCents: 0, initialPaymentCents: 0, balanceCents: 0 };
        }
      })()
    : { totalCents: 0, initialPaymentCents: 0, balanceCents: 0 };

  const draftGainTotals = state.view !== 'detail' ? getDraftGainTotals(state) : null;
  const showDraftBalance = shouldShowPendingBalance(totals.balanceCents);
  const currentStep = state.view === 'review' ? 4 : 3;
  const draftGainEntries = draftGainTotals
    ? buildGainDisplayEntries({
        baseGainCents: draftGainTotals.productGainCents,
        personalizationGainCents: draftGainTotals.personalizationGainCents,
        totalGainCents: draftGainTotals.totalExpectedProfitCents
      })
    : [];
  const historyPageCount = getSalesHistoryPageCount(state.historyResults, SALES_HISTORY_PAGE_SIZE);
  const currentHistoryPage = Math.min(Math.max(state.historyPage, 1), historyPageCount);
  const visibleHistoryResults = getSalesHistoryPage(state.historyResults, currentHistoryPage, SALES_HISTORY_PAGE_SIZE);
  const visibleSearchResults = getAvailableSalesSearchResults(state.searchResults);
  const activePayments = state.currentSale?.payments.filter((payment) => payment.isActive) ?? [];

  useEffect(() => {
    if (entryPoint !== 'history' || historyEntryAppliedRef.current) {
      return;
    }

    historyEntryAppliedRef.current = true;
    void actions.openHistory();
  }, [actions, entryPoint]);

  useEffect(() => {
    if (state.view !== 'draft') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void actions.searchProducts();
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.searchQuery, state.view]);

  return (
    <section className="page-stack sales-panel">
      <PageHeader
        title="Ventas"
        description={
          state.view === 'history'
            ? 'Consultá ventas anteriores con su contexto y abrí el detalle sin mezclarlo con una venta nueva.'
            : 'Seguí un recorrido corto para buscar productos, armar la venta, cargar cliente o pago inicial y confirmar.'
        }
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void actions.openHistory()}>
              Ver historial
            </Button>
            <Button type="button" variant="primary" onClick={() => actions.startNewSale()}>
              Empezar venta
            </Button>
            {onBack ? (
              <Button type="button" variant="secondary" onClick={() => onBack()}>
                Volver
              </Button>
            ) : null}
          </>
        }
      />

      {state.submitMessage ? (
        <Banner tone={state.submitStatus === 'error' ? 'error' : 'success'} role="status" message={state.submitMessage} />
      ) : null}

      {state.view === 'draft' ? (
        <>
          <Surface className="sales-section sales-steps-surface" tone="muted">
            <div className="catalog-stock-steps-overview">
              {[
                ['1', 'Buscar y agregar productos', 'Elegí qué va a entrar en la venta.'],
                ['2', 'Armar venta', 'Ajustá cantidad, precio usado y personalización si aplica.'],
                ['3', 'Cliente y pago inicial', 'Definí si queda como mostrador o con saldo pendiente.'],
                ['4', 'Revisar y confirmar', 'Chequeá el cierre y guardá la venta.']
              ].map(([index, title, text], stepIndex) => (
                <article
                  key={index}
                  className={stepIndex + 1 <= currentStep ? 'catalog-stock-steps-overview__item catalog-stock-steps-overview__item--active' : 'catalog-stock-steps-overview__item'}
                >
                  <span className="catalog-stock-steps-overview__index">{index}</span>
                  <div>
                    <p className="catalog-stock-steps-overview__title">{title}</p>
                    <p className="catalog-stock-steps-overview__text">{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </Surface>

          <Surface className="sales-section">
            <h3 className="surface__title">1. Buscar y agregar productos</h3>
            <p className="surface__description">Escribí nombre, categoría, material o variante para sumar productos al armado.</p>
            <div className="cluster sales-search-toolbar" style={{ alignItems: 'end' }}>
              <div className="sales-search-field">
                <input
                  aria-label="Buscar productos"
                  className="input"
                  value={state.searchQuery}
                  onChange={(event) => actions.setSearchQuery(event.target.value)}
                  placeholder="Ej: aro plata"
                />
              </div>
              <Button type="button" variant="primary" onClick={() => void actions.searchProducts()}>
                Buscar
              </Button>
            </div>
            {state.searchError ? <p className="field__helper field__helper--error">{state.searchError}</p> : null}
            {state.searchStatus === 'loading' ? <p className="field__helper">Buscando productos…</p> : null}
            {visibleSearchResults.length > 0 ? (
              <ul className="list sales-search-results">
                {visibleSearchResults.map((product) => (
                  <li className="list-row list-row--catalog" key={product.reusableProductId}>
                    <div className="list-row__content">
                      <p className="list-row__title">
                        {product.name} · {formatVariantLabel(product.variant)}
                      </p>
                      <p className="list-row__text">Stock disponible: {product.availableQuantity}</p>
                    </div>
                    <div className="list-row__aside">
                      <Button type="button" variant="success" onClick={() => void actions.addProduct(product.reusableProductId)}>
                        Sumar a la venta
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Surface>

          <Surface className="sales-section">
            <h3 className="surface__title">2. Armar venta</h3>
            {state.draftItems.length === 0 ? (
              <EmptyState title="Todavía no agregaste productos al borrador." description="Buscá un producto y sumalo a la venta para continuar." />
            ) : (
              <ul className="list">
                {state.draftItems.map((item) => {
                  const gainPreview = getDraftItemGainPreview(item);
                  const gainPreviewText = renderGainPreviewText(
                    gainPreview.productGainCents,
                    gainPreview.personalizationGainCents,
                    gainPreview.totalExpectedProfitCents,
                    item.priceType
                  );
                  const personalizationAllowed = item.category === 'jewelry' || item.category === 'mate';
                  const baseSubtotalCents = getDraftItemBaseUnitPrice(item) * item.quantity;
                  const personalizationSubtotalCents = getDraftItemPersonalizationUnitPrice(item) * item.quantity;

                  return (
                    <li className="list-row" key={item.reusableProductId}>
                      <div className="list-row__content">
                        <p className="list-row__title">
                          {item.name} · {formatVariantLabel(item.variant)}
                        </p>
                        <p className="list-row__text">Stock disponible: {item.availableQuantity}</p>
                        <div className="grid-auto sales-draft-item-grid">
                          <Field label="Cantidad">
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={Math.max(item.availableQuantity, 1)}
                              value={String(item.quantity)}
                              onChange={(event) => actions.updateDraftItemQuantity(item.reusableProductId, event.target.value)}
                            />
                          </Field>
                          <Field label="Precio">
                            <select
                              className="select"
                              value={item.priceType}
                              onChange={(event) => actions.updateDraftItemPriceType(item.reusableProductId, event.target.value as 'cash' | 'list')}
                            >
                              <option value="cash">Contado</option>
                              <option value="list">Lista</option>
                            </select>
                          </Field>
                          <div className="field sales-draft-item-subtotal">
                            <span className="field__label">Subtotal</span>
                            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
                              {formatCurrencyFromCents(getDraftItemUnitPrice(item) * item.quantity)}
                            </div>
                          </div>
                        </div>
                        {personalizationAllowed ? (
                          <div className="sales-personalization-block">
                            <div className="cluster" style={{ justifyContent: 'space-between' }}>
                              <p className="list-row__text">
                                {item.hasPersonalization ? 'Personalización aplicada en este producto.' : 'Sin personalización en este producto.'}
                              </p>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => actions.updateDraftItemPersonalizationToggle(item.reusableProductId, !item.hasPersonalization)}
                              >
                                {item.hasPersonalization ? 'Quitar personalización' : 'Agregar personalización'}
                              </Button>
                            </div>
                            {item.hasPersonalization ? (
                              <div className="grid-2 sales-personalization-fields">
                                <Field label="Importe personalización">
                                  <input
                                    className="input"
                                    value={item.personalizationAmount}
                                    onChange={(event) =>
                                      actions.updateDraftItemPersonalizationField(
                                        item.reusableProductId,
                                        'personalizationAmount',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Ej: 2500"
                                  />
                                </Field>
                                <Field label="% ganancia personalización">
                                  <input
                                    className="input"
                                    value={item.personalizationPercentage}
                                    onChange={(event) =>
                                      actions.updateDraftItemPersonalizationField(
                                        item.reusableProductId,
                                        'personalizationPercentage',
                                        event.target.value
                                      )
                                    }
                                    placeholder="5"
                                  />
                                </Field>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <p className="list-row__text sales-inline-summary">
                          Base: {formatCurrencyFromCents(baseSubtotalCents)}
                          {personalizationSubtotalCents > 0
                            ? ` · Personalización: ${formatCurrencyFromCents(personalizationSubtotalCents)}`
                            : ''}
                          {` · Total: ${formatCurrencyFromCents(getDraftItemUnitPrice(item) * item.quantity)}`}
                        </p>
                        {gainPreviewText ? (
                          <p className="list-row__text">
                            {gainPreviewText}
                          </p>
                        ) : null}
                      </div>
                      <div className="list-row__aside">
                        <Button type="button" variant="danger" onClick={() => actions.removeDraftItem(item.reusableProductId)}>
                          Sacar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>

          <Surface className="sales-section">
            <h3 className="surface__title">3. Cliente y pago inicial</h3>
            <p className="surface__description">Si la venta queda saldada, podés guardarla sin cliente. Si queda saldo, cargá nombre y teléfono.</p>
            <div className="grid-2">
              <Field label="Nombre del cliente">
                <input className="input" value={state.customer.name} onChange={(event) => actions.updateCustomerField('name', event.target.value)} />
              </Field>
              <Field label="Teléfono">
                <input className="input" value={state.customer.phoneText} onChange={(event) => actions.updateCustomerField('phoneText', event.target.value)} />
              </Field>
              <Field label="Pago inicial">
                <input className="input" value={state.initialPayment.amount} onChange={(event) => actions.updateInitialPaymentField('amount', event.target.value)} placeholder="Ej: 15000" />
              </Field>
              <Field label="Medio de pago inicial">
                <select
                  className="select"
                  value={state.initialPayment.paymentMethod ?? 'cash'}
                  onChange={(event) => actions.updateInitialPaymentField('paymentMethod', event.target.value as 'cash' | 'bank_transfer')}
                >
                  <option value="cash">Efectivo</option>
                  <option value="bank_transfer">Transferencia</option>
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Nota del cliente">
                <textarea className="textarea" rows={3} value={state.customer.note} onChange={(event) => actions.updateCustomerField('note', event.target.value)} />
              </Field>
            </div>
            {feedback ? (
              <Banner tone="warning" message={feedback} />
            ) : (
              <p className="field__helper">Si no cargás cliente y no queda saldo, la venta se guarda como venta de mostrador.</p>
            )}
          </Surface>

          <Surface className="sales-section" tone="soft">
            <h3 className="surface__title">Cierre rápido antes de revisar</h3>
            <p className="surface__description">Este resumen debería cerrar la venta antes de pasar a la revisión final.</p>
            <div className="sales-summary-grid">
              <article className="sales-summary-card">
                <p className="sales-summary-card__label">Total</p>
                <p className="sales-summary-card__value">{formatCurrencyFromCents(totals.totalCents)}</p>
              </article>
              <article className="sales-summary-card">
                <p className="sales-summary-card__label">Pago inicial</p>
                <p className="sales-summary-card__value">{formatCurrencyFromCents(totals.initialPaymentCents)}</p>
              </article>
              <article className="sales-summary-card">
                <p className="sales-summary-card__label">Saldo</p>
                <p className="sales-summary-card__value">{showDraftBalance ? formatCurrencyFromCents(totals.balanceCents) : 'Sin saldo pendiente'}</p>
              </article>
            </div>
            {draftGainEntries.length > 0 ? (
              <dl className="data-list sales-summary-data-list">
                {draftGainEntries.map((entry) => (
                  <React.Fragment key={entry.label}>
                    <dt>{entry.label}</dt>
                    <dd>{formatCurrencyFromCents(entry.amountCents)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <Button type="button" variant="success" onClick={() => actions.goToReview()}>
                Seguir a revisión
              </Button>
            </div>
          </Surface>
        </>
      ) : null}

      {state.view === 'history' ? (
        <Surface className="sales-section">
          <h3 className="surface__title">Historial de ventas</h3>
          <p className="surface__description">El filtro se aplica primero y después se pagina en bloques de {SALES_HISTORY_PAGE_SIZE} ventas.</p>
          <div className="cluster sales-search-toolbar" style={{ alignItems: 'end' }}>
            <Field label="Buscar por número, cliente o teléfono">
              <input className="input" value={state.historyQuery} onChange={(event) => actions.setHistoryQuery(event.target.value)} placeholder="Ej: 125, Ana o 351" />
            </Field>
            <Button type="button" variant="primary" onClick={() => void actions.loadSalesHistory()}>
              Buscar
            </Button>
            {actions.hasOngoingDraft() ? (
              <Button type="button" variant="secondary" onClick={() => actions.returnFromHistory()}>
                Volver a la venta en curso
              </Button>
            ) : null}
          </div>

          {state.historyError ? <p className="field__helper field__helper--error">{state.historyError}</p> : null}
          {state.historyStatus === 'loading' ? <p className="field__helper">Cargando ventas…</p> : null}
          {state.historyStatus === 'ready' && state.historyResults.length === 0 ? (
            <EmptyState title="No encontramos ventas con ese criterio." description="Probá con el número, el nombre del cliente o parte del teléfono." />
          ) : null}

          {state.historyResults.length > 0 ? (
            <ul className="list sales-search-results">
              {visibleHistoryResults.map((sale) => (
                <li className="list-row" key={sale.saleId}>
                  <div className="list-row__content">
                    <div className="cluster">
                      <p className="list-row__title">Venta #{sale.saleNumber}</p>
                      <Badge tone={renderStatusTone(sale.status)}>{renderHistoryStatus(sale.status)}</Badge>
                    </div>
                    <p className="list-row__text">Fecha: {formatSaleDate(sale.saleDate)}</p>
                    <p className="list-row__text">
                      {sale.customerName?.trim() ? sale.customerName : 'Venta de mostrador'}
                      {sale.customerPhoneText ? ` · ${sale.customerPhoneText}` : ''}
                    </p>
                    <p className="list-row__text">
                      Total: {formatCurrencyFromCents(sale.totalCents)}
                      {` · Cobrado: ${formatCurrencyFromCents(sale.paidCents)}`}
                      {shouldShowPendingBalance(sale.balanceCents)
                        ? ` · Saldo: ${formatCurrencyFromCents(sale.balanceCents)}`
                        : ''}
                    </p>
                    <p className="list-row__text">Ganancia: {formatCurrencyFromCents(sale.totalProfitCents)}</p>
                  </div>
                  <div className="list-row__aside">
                    <Button type="button" variant="success" onClick={() => void actions.openSaleDetail(sale.saleId)}>
                      Ver detalle
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {state.historyResults.length > SALES_HISTORY_PAGE_SIZE ? (
            <div className="catalog-home-pagination sales-history-pagination">
              <p className="catalog-home-pagination__status">
                Página {currentHistoryPage} de {historyPageCount}
              </p>
              <div className="actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => actions.setHistoryPage(currentHistoryPage - 1)}
                  disabled={currentHistoryPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => actions.setHistoryPage(currentHistoryPage + 1)}
                  disabled={currentHistoryPage === historyPageCount}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </Surface>
      ) : null}

      {state.view === 'review' ? (
        <>
          <Surface tone="muted">
            <h3 className="surface__title">4. Revisar y confirmar</h3>
            <p className="surface__description">Acá hacés el chequeo final. Si algo no cierra, volvés y lo ajustás antes de guardar.</p>
          </Surface>

          <Surface>
            <h3 className="surface__title">Lo que se va a guardar</h3>
            <ul className="list">
              {state.draftItems.map((item) => {
                const gainPreview = getDraftItemGainPreview(item);
                const gainPreviewText = renderGainPreviewText(
                  gainPreview.productGainCents,
                  gainPreview.personalizationGainCents,
                  gainPreview.totalExpectedProfitCents,
                  item.priceType
                );
                const baseSubtotalCents = getDraftItemBaseUnitPrice(item) * item.quantity;
                const personalizationSubtotalCents = getDraftItemPersonalizationUnitPrice(item) * item.quantity;

                return (
                  <li className="list-row" key={item.reusableProductId}>
                    <div className="list-row__content">
                      <p className="list-row__title">
                        {item.name} · {formatVariantLabel(item.variant)}
                      </p>
                      <p className="list-row__text">
                        Base: {formatCurrencyFromCents(baseSubtotalCents)}
                        {personalizationSubtotalCents > 0
                          ? ` · Personalización: ${formatCurrencyFromCents(personalizationSubtotalCents)}`
                          : ''}
                        {` · Total: ${formatCurrencyFromCents(getDraftItemUnitPrice(item) * item.quantity)}`}
                      </p>
                      {gainPreviewText ? (
                        <p className="list-row__text">
                          {gainPreviewText}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Surface>

          <Surface>
            <h3 className="surface__title">Cierre final</h3>
            <dl className="data-list">
              <dt>Cliente</dt>
              <dd>{state.customer.name.trim() ? `${state.customer.name} · ${state.customer.phoneText}` : 'Venta de mostrador'}</dd>
              <dt>Total</dt>
              <dd>{formatCurrencyFromCents(totals.totalCents)}</dd>
              <dt>Pago inicial</dt>
              <dd>{formatCurrencyFromCents(totals.initialPaymentCents)}</dd>
              {showDraftBalance ? (
                <>
                  <dt>Saldo</dt>
                  <dd>{formatCurrencyFromCents(totals.balanceCents)}</dd>
                </>
              ) : null}
              {draftGainEntries.map((entry) => (
                <React.Fragment key={entry.label}>
                  <dt>{entry.label}</dt>
                  <dd>{formatCurrencyFromCents(entry.amountCents)}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p className="field__helper" style={{ marginTop: 12 }}>
              Cuando confirmes, la venta queda guardada y pasa a su detalle para seguir cobrando o revisar movimientos.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Button type="button" variant="secondary" onClick={() => actions.backToDraft()}>
                Volver y ajustar
              </Button>
              <Button type="button" variant="success" onClick={() => void actions.confirmSale()}>
                Confirmar y guardar venta
              </Button>
            </div>
          </Surface>
        </>
      ) : null}

      {state.view === 'detail' && state.currentSale ? (
        <>
          {state.detailOrigin === 'history' ? (
            <div>
              <Button type="button" variant="secondary" onClick={() => actions.backFromDetail()}>
                Volver al historial
              </Button>
            </div>
          ) : null}

          {renderSaleSummary(state.currentSale)}

          {canAssignCustomerForPaymentRecovery(state.currentSale) ? (
            <Surface tone="info">
              <h3 className="surface__title">Acción especial para corregir pagos</h3>
              <p className="surface__description">
                Esta excepción controlada solo se usa cuando una venta de mostrador ya pagada necesita cancelar un pago y volver a tener saldo.
              </p>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <Field label="Nombre del cliente">
                  <input className="input" value={state.recoveryCustomer.name} onChange={(event) => actions.updateRecoveryCustomerField('name', event.target.value)} />
                </Field>
                <Field label="Teléfono">
                  <input className="input" value={state.recoveryCustomer.phoneText} onChange={(event) => actions.updateRecoveryCustomerField('phoneText', event.target.value)} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button type="button" variant="primary" onClick={() => void actions.assignCustomerForPaymentRecovery()}>
                  Guardar cliente para esta corrección
                </Button>
              </div>
            </Surface>
          ) : null}

          <Surface>
            <h3 className="surface__title">Ítems de la venta</h3>
            <ul className="list">
              {state.currentSale.items.map((item) => (
                <li className="list-row" key={item.saleItemId}>
                  <div className="list-row__content">
                    <p className="list-row__title">{[item.productName, item.productMaterial, item.productVariant].filter((value) => value.trim().length > 0).join(' · ')}</p>
                    <p className="list-row__text">
                      Base: {formatCurrencyFromCents(item.lineBaseSubtotalCents ?? item.lineSubtotalCents)}
                      {(item.linePersonalizationSubtotalCents ?? 0) > 0
                        ? ` · Personalización: ${formatCurrencyFromCents(item.linePersonalizationSubtotalCents ?? 0)}`
                        : ''}
                      {` · Total: ${formatCurrencyFromCents(item.lineSubtotalCents)}`}
                    </p>
                    <p className="list-row__text">
                      {buildGainDisplayEntries({
                        baseGainCents: item.productGainCents ?? item.totalGainCents ?? 0,
                        personalizationGainCents: item.personalizationGainCents ?? null,
                        totalGainCents: item.totalGainCents ?? item.productGainCents ?? 0,
                        priceType: item.priceType
                      })
                        .map((entry) => `${entry.label}: ${formatCurrencyFromCents(entry.amountCents)}`)
                        .join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface>
            <h3 className="surface__title">Pagos</h3>
            {state.currentSale.payments.length > 0 ? (
              <ul className="list">
                {state.currentSale.payments.map((payment) => (
                  <li className="list-row" key={payment.paymentId}>
                    <div className="list-row__content">
                      <div className="cluster">
                        <p className="list-row__title">{formatCurrencyFromCents(payment.amountCents)}</p>
                        <Badge tone={payment.isActive ? 'success' : 'danger'}>{payment.isActive ? 'Activo' : 'Cancelado'}</Badge>
                      </div>
                      <p className="list-row__text">{payment.paymentMethod === 'bank_transfer' ? 'Transferencia' : 'Efectivo'}</p>
                      {payment.note ? <p className="list-row__text">Nota: {payment.note}</p> : null}
                      {payment.isActive ? <p className="field__helper">Si necesitás anularlo, usá la sección de acciones delicadas.</p> : null}
                      {!payment.isActive && payment.cancellationReason ? (
                        <p className="field__helper field__helper--error">Motivo de cancelación: {payment.cancellationReason}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Todavía no hay pagos registrados." description="Cuando la venta reciba pagos, se van a listar acá." />
            )}

            {state.currentSale.canRegisterPayment ? (
              <div className="spaced divider-top">
                <h4 className="surface__title">Cargar pago</h4>
                <div className="grid-2">
                  <Field label="Monto">
                    <input className="input" value={state.detailPayment.amount} onChange={(event) => actions.updateDetailPaymentField('amount', event.target.value)} placeholder="Ej: 25000" />
                  </Field>
                  <Field label="Medio de pago">
                    <select
                      className="select"
                      value={state.detailPayment.paymentMethod ?? 'cash'}
                      onChange={(event) => actions.updateDetailPaymentField('paymentMethod', event.target.value as 'cash' | 'bank_transfer')}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="bank_transfer">Transferencia</option>
                    </select>
                  </Field>
                </div>
                <div>
                  <Button type="button" variant="primary" onClick={() => void actions.registerPayment()}>
                    Guardar pago
                  </Button>
                </div>
              </div>
            ) : null}
          </Surface>

          {activePayments.length > 0 ? (
            <Surface tone="danger">
              <h3 className="surface__title">Acciones delicadas sobre pagos</h3>
              <p className="surface__description">Usá estas acciones solo si necesitás deshacer un cobro ya registrado.</p>
              <ul className="list" style={{ marginTop: 16 }}>
                {activePayments.map((payment) => (
                  <li className="list-row" key={payment.paymentId}>
                    <div className="list-row__content">
                      <p className="list-row__title">Pago activo de {formatCurrencyFromCents(payment.amountCents)}</p>
                      <p className="list-row__text">{payment.paymentMethod === 'bank_transfer' ? 'Transferencia' : 'Efectivo'}</p>
                      <Field label="Motivo para anular este pago">
                        <textarea
                          className="textarea"
                          rows={3}
                          value={state.paymentCancellationReasons[payment.paymentId] ?? ''}
                          onChange={(event) => actions.updatePaymentCancellationReason(payment.paymentId, event.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="list-row__aside">
                      <Button type="button" variant="danger" onClick={() => void actions.cancelPayment(payment.paymentId)}>
                        Anular pago
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}

          {state.currentSale.canCancelSale ? (
            <Surface tone="danger">
              <h3 className="surface__title">Cancelar esta venta</h3>
              <Field label="Motivo">
                <textarea className="textarea" rows={3} value={state.cancellationReason} onChange={(event) => actions.setCancellationReason(event.target.value)} />
              </Field>
              <div style={{ marginTop: 12 }}>
                <Button type="button" variant="danger" onClick={() => void actions.cancelSale()}>
                  Confirmar cancelación
                </Button>
              </div>
            </Surface>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
