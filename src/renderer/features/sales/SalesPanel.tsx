import React, { useEffect, useMemo, useState } from 'react';
import type { AppBridge } from '../../../shared/contracts/app';
import type { SaleSnapshot } from '../../../shared/contracts/sales';
import { Badge, Banner, Button, EmptyState, Field, PageHeader, Surface } from '../../ui';
import {
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
  getSaleCustomerLabel,
  shouldShowExpectedProfit,
  shouldShowPendingBalance,
  type SalesState
} from './model';

interface SalesPanelProps {
  bridge: AppBridge;
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

function renderSaleSummary(sale: SaleSnapshot): JSX.Element {
  const showBalance = shouldShowPendingBalance(sale.balanceCents);

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
        <dt>Ganancia producto</dt>
        <dd>{formatCurrencyFromCents(sale.totalProductGainCents ?? sale.totalProfitCents)}</dd>
        {(sale.totalPersonalizationGainCents ?? 0) > 0 ? (
          <>
            <dt>Ganancia personalización</dt>
            <dd>{formatCurrencyFromCents(sale.totalPersonalizationGainCents ?? 0)}</dd>
          </>
        ) : null}
        <dt>Ganancia total</dt>
        <dd>{formatCurrencyFromCents(sale.totalProfitCents)}</dd>
      </dl>
    </Surface>
  );
}

function renderGainPreviewText(
  productGainCents: number | null,
  personalizationGainCents: number | null,
  totalExpectedProfitCents: number | null
): string | null {
  if (totalExpectedProfitCents == null) {
    return null;
  }

  const parts: string[] = [];

  if (shouldShowExpectedProfit(productGainCents, totalExpectedProfitCents)) {
    parts.push(`Ganancia producto: ${formatCurrencyFromCents(productGainCents ?? 0)}`);
  }

  if (personalizationGainCents != null) {
    parts.push(`Ganancia personalización: ${formatCurrencyFromCents(personalizationGainCents)}`);
  }

  parts.push(`Ganancia total: ${formatCurrencyFromCents(totalExpectedProfitCents)}`);

  return parts.join(' · ');
}

export function SalesPanel({ bridge, initialState, onBack }: SalesPanelProps): JSX.Element {
  const [state, setState] = useState<SalesState>(() => initialState ?? createInitialSalesState());
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
  const showDraftExpectedProfit = shouldShowExpectedProfit(
    draftGainTotals?.productGainCents ?? null,
    draftGainTotals?.totalExpectedProfitCents ?? null
  );

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
    <section className="page-stack">
      <PageHeader
        title="Ventas"
        description={
          state.view === 'history'
            ? 'Consultá ventas existentes y abrí su detalle sin mezclarlo con la carga de una venta nueva.'
            : 'Armá el borrador, revisá el resumen y confirmá la venta sin salir del flujo.'
        }
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void actions.openHistory()}>
              Historial
            </Button>
            <Button type="button" variant="primary" onClick={() => actions.startNewSale()}>
              Nueva venta
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
          <Surface>
            <h3 className="surface__title">Buscar producto</h3>
            <div className="cluster" style={{ alignItems: 'end' }}>
              <Field label="Nombre, categoría, material o variante" className="" >
                <input className="input" value={state.searchQuery} onChange={(event) => actions.setSearchQuery(event.target.value)} placeholder="Ej: aro plata" />
              </Field>
              <Button type="button" variant="primary" onClick={() => void actions.searchProducts()}>
                Buscar
              </Button>
            </div>
            {state.searchError ? <p className="field__helper field__helper--error">{state.searchError}</p> : null}
            {state.searchStatus === 'loading' ? <p className="field__helper">Buscando productos…</p> : null}
            {state.searchResults.length > 0 ? (
              <ul className="list" style={{ marginTop: 16 }}>
                {state.searchResults.map((product) => (
                  <li className="list-row" key={product.reusableProductId}>
                    <div className="list-row__content">
                      <p className="list-row__title">
                        {product.name} · {formatVariantLabel(product.variant)}
                      </p>
                      <p className="list-row__text">Stock disponible: {product.availableQuantity}</p>
                    </div>
                    <div className="list-row__aside">
                      <Button type="button" variant="success" onClick={() => void actions.addProduct(product.reusableProductId)}>
                        Agregar a la venta
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Surface>

          <Surface>
            <h3 className="surface__title">Borrador de venta</h3>
            {state.draftItems.length === 0 ? (
              <EmptyState title="Todavía no agregaste productos al borrador." description="Buscá un producto y sumalo a la venta para continuar." />
            ) : (
              <ul className="list">
                {state.draftItems.map((item) => {
                  const gainPreview = getDraftItemGainPreview(item);
                  const gainPreviewText = renderGainPreviewText(
                    gainPreview.productGainCents,
                    gainPreview.personalizationGainCents,
                    gainPreview.totalExpectedProfitCents
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
                        <div className="grid-3">
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
                          <div className="field">
                            <span className="field__label">Subtotal</span>
                            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
                              {formatCurrencyFromCents(getDraftItemUnitPrice(item) * item.quantity)}
                            </div>
                          </div>
                        </div>
                        {personalizationAllowed ? (
                          <div className="grid-3">
                            <Field label="¿Tiene personalización?">
                              <select
                                className="select"
                                value={item.hasPersonalization ? 'yes' : 'no'}
                                onChange={(event) => actions.updateDraftItemPersonalizationToggle(item.reusableProductId, event.target.value === 'yes')}
                              >
                                <option value="no">No</option>
                                <option value="yes">Sí</option>
                              </select>
                            </Field>
                            {item.hasPersonalization ? (
                              <>
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
                              </>
                            ) : null}
                          </div>
                        ) : null}
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
                      <div className="list-row__aside">
                        <Button type="button" variant="danger" onClick={() => actions.removeDraftItem(item.reusableProductId)}>
                          Quitar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>

          <Surface>
            <h3 className="surface__title">Cliente y pago inicial</h3>
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
              <p className="field__helper">Si la venta queda saldada, podés confirmarla sin cliente y se guarda como venta de mostrador.</p>
            )}
          </Surface>

          <Surface tone="soft">
            <h3 className="surface__title">Resumen rápido</h3>
            <dl className="data-list">
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
               {showDraftExpectedProfit ? (
                <>
                    <dt>Ganancia producto</dt>
                     <dd>{formatCurrencyFromCents(draftGainTotals?.productGainCents ?? 0)}</dd>
                 </>
               ) : null}
               {draftGainTotals?.personalizationGainCents != null ? (
                 <>
                   <dt>Ganancia personalización</dt>
                   <dd>{formatCurrencyFromCents(draftGainTotals.personalizationGainCents)}</dd>
                 </>
               ) : null}
              {draftGainTotals?.totalExpectedProfitCents != null ? (
                <>
                  <dt>Ganancia total</dt>
                  <dd>{formatCurrencyFromCents(draftGainTotals.totalExpectedProfitCents)}</dd>
                </>
              ) : null}
            </dl>
            <div style={{ marginTop: 12 }}>
              <Button type="button" variant="success" onClick={() => actions.goToReview()}>
                Revisar venta
              </Button>
            </div>
          </Surface>
        </>
      ) : null}

      {state.view === 'history' ? (
        <Surface>
          <h3 className="surface__title">Historial de ventas</h3>
          <div className="cluster" style={{ alignItems: 'end' }}>
            <Field label="Buscar por número, cliente o teléfono">
              <input className="input" value={state.historyQuery} onChange={(event) => actions.setHistoryQuery(event.target.value)} placeholder="Ej: 125, Ana o 351" />
            </Field>
            <Button type="button" variant="primary" onClick={() => void actions.loadSalesHistory()}>
              Buscar venta
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
            <ul className="list" style={{ marginTop: 16 }}>
              {state.historyResults.map((sale) => (
                <li className="list-row" key={sale.saleId}>
                  <div className="list-row__content">
                    <div className="cluster">
                      <p className="list-row__title">Venta #{sale.saleNumber}</p>
                      <Badge tone={renderStatusTone(sale.status)}>{renderHistoryStatus(sale.status)}</Badge>
                    </div>
                    <p className="list-row__text">
                      {sale.customerName?.trim() ? sale.customerName : 'Venta de mostrador'}
                      {sale.customerPhoneText ? ` · ${sale.customerPhoneText}` : ''}
                    </p>
                    <p className="list-row__text">
                      Total: {formatCurrencyFromCents(sale.totalCents)}
                      {shouldShowPendingBalance(sale.balanceCents)
                        ? ` · Saldo: ${formatCurrencyFromCents(sale.balanceCents)}`
                        : ''}
                    </p>
                    <p className="list-row__text">Ganancia total: {formatCurrencyFromCents(sale.totalProfitCents)}</p>
                  </div>
                  <div className="list-row__aside">
                    <Button type="button" variant="success" onClick={() => void actions.openSaleDetail(sale.saleId)}>
                      Abrir detalle
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Surface>
      ) : null}

      {state.view === 'review' ? (
        <>
          <Surface>
            <h3 className="surface__title">Resumen antes de confirmar</h3>
            <ul className="list">
              {state.draftItems.map((item) => {
                const gainPreview = getDraftItemGainPreview(item);
                const gainPreviewText = renderGainPreviewText(
                  gainPreview.productGainCents,
                  gainPreview.personalizationGainCents,
                  gainPreview.totalExpectedProfitCents
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
            <h3 className="surface__title">Datos de confirmación</h3>
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
              {showDraftExpectedProfit ? (
                <>
                  <dt>Ganancia producto</dt>
                  <dd>{formatCurrencyFromCents(draftGainTotals?.productGainCents ?? 0)}</dd>
                </>
              ) : null}
              {draftGainTotals?.personalizationGainCents != null ? (
                <>
                  <dt>Ganancia personalización</dt>
                  <dd>{formatCurrencyFromCents(draftGainTotals.personalizationGainCents)}</dd>
                </>
              ) : null}
              {draftGainTotals?.totalExpectedProfitCents != null ? (
                <>
                  <dt>Ganancia total</dt>
                  <dd>{formatCurrencyFromCents(draftGainTotals.totalExpectedProfitCents)}</dd>
                </>
              ) : null}
            </dl>
            <div className="actions" style={{ marginTop: 16 }}>
              <Button type="button" variant="secondary" onClick={() => actions.backToDraft()}>
                Volver a editar
              </Button>
              <Button type="button" variant="success" onClick={() => void actions.confirmSale()}>
                Confirmar venta
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
            <Surface>
              <h3 className="surface__title">Asignar cliente para corregir pagos</h3>
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
                  Guardar cliente para recuperación
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
                      Ganancia producto: {formatCurrencyFromCents(item.productGainCents ?? item.totalGainCents ?? 0)}
                      {(item.personalizationGainCents ?? 0) > 0
                        ? ` · Ganancia personalización: ${formatCurrencyFromCents(item.personalizationGainCents ?? 0)}`
                        : ''}
                      {` · Ganancia total: ${formatCurrencyFromCents(item.totalGainCents ?? item.productGainCents ?? 0)}`}
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
                      {payment.isActive ? (
                        <div className="spaced divider-top">
                          <Field label="Motivo de cancelación del pago">
                            <textarea
                              className="textarea"
                              rows={3}
                              value={state.paymentCancellationReasons[payment.paymentId] ?? ''}
                              onChange={(event) => actions.updatePaymentCancellationReason(payment.paymentId, event.target.value)}
                            />
                          </Field>
                          <div>
                            <Button type="button" variant="danger" onClick={() => void actions.cancelPayment(payment.paymentId)}>
                              Cancelar pago
                            </Button>
                          </div>
                        </div>
                      ) : payment.cancellationReason ? (
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
                <h4 className="surface__title">Registrar pago</h4>
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

          {state.currentSale.canCancelSale ? (
            <Surface tone="danger">
              <h3 className="surface__title">Cancelar venta</h3>
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
