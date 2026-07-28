import React, { useEffect, useMemo, useState } from 'react';
import type { AppBridge } from '../../../shared/contracts/app';
import type {
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ConsignmentBatchHistoryListItem,
  PendingConsignmentItem
} from '../../../shared/contracts/consignments';
import { Badge, Banner, Button, EmptyState, Field, PageHeader, Surface } from '../../ui';
import { formatCurrencyFromCents } from '../sales/model';
import { getCurrentBusinessDate, summarizeSelection, togglePendingSelection } from './model';

interface ConsignmentsPanelProps {
  bridge: AppBridge;
  onBack?: () => void;
  initialState?: Partial<{
    view: View;
    pendingItems: PendingConsignmentItem[];
    historyItems: ConsignmentBatchHistoryListItem[];
    detail: ConsignmentBatchDetail | null;
    selectedIds: number[];
    showConfirmBlock: boolean;
    liquidationDate: string;
    notes: string;
    statusMessage: string | null;
    statusKind: 'success' | 'error' | 'info' | null;
    successBatch: ConfirmConsignmentBatchResult | null;
    exportingBatchId: number | null;
  }>;
}

type View = 'pending' | 'history' | 'detail';

type StageTone = 'current' | 'complete' | 'idle';

export function ConsignmentsPanel({ bridge, onBack, initialState }: ConsignmentsPanelProps): JSX.Element {
  const [view, setView] = useState<View>(initialState?.view ?? 'pending');
  const [pendingItems, setPendingItems] = useState<PendingConsignmentItem[]>(initialState?.pendingItems ?? []);
  const [historyItems, setHistoryItems] = useState<ConsignmentBatchHistoryListItem[]>(initialState?.historyItems ?? []);
  const [detail, setDetail] = useState<ConsignmentBatchDetail | null>(initialState?.detail ?? null);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialState?.selectedIds ?? []);
  const [showConfirmBlock, setShowConfirmBlock] = useState(initialState?.showConfirmBlock ?? false);
  const [liquidationDate, setLiquidationDate] = useState(() => initialState?.liquidationDate ?? getCurrentBusinessDate());
  const [notes, setNotes] = useState(initialState?.notes ?? '');
  const [statusMessage, setStatusMessage] = useState<string | null>(initialState?.statusMessage ?? null);
  const [statusKind, setStatusKind] = useState<'success' | 'error' | 'info' | null>(initialState?.statusKind ?? null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successBatch, setSuccessBatch] = useState<ConfirmConsignmentBatchResult | null>(initialState?.successBatch ?? null);
  const [exportingBatchId, setExportingBatchId] = useState<number | null>(initialState?.exportingBatchId ?? null);

  const selectedSummary = useMemo(
    () => summarizeSelection({ pendingItems, historyItems, detail, selectedIds, liquidationDate, notes, successBatch, statusMessage }),
    [pendingItems, historyItems, detail, selectedIds, liquidationDate, notes, successBatch, statusMessage]
  );
  const warningItems = selectedSummary.partialItems;
  const stages = buildStages({ view, showConfirmBlock, successBatch });

  useEffect(() => {
    void loadPending();
  }, []);

  async function loadPending(): Promise<void> {
    setLoadingPending(true);

    try {
      const items = await bridge.consignments.listPendingItems();
      setPendingItems(items);
      setSelectedIds((current) => current.filter((saleItemId) => items.some((item) => item.saleItemId === saleItemId)));
    } catch (error) {
      setStatusKind('error');
      setStatusMessage(getErrorMessage(error, 'No pudimos cargar las liquidaciones pendientes.'));
    } finally {
      setLoadingPending(false);
    }
  }

  async function loadHistory(): Promise<void> {
    setLoadingHistory(true);

    try {
      const items = await bridge.consignments.listBatchHistory();
      setHistoryItems(items);
    } catch (error) {
      setStatusKind('error');
      setStatusMessage(getErrorMessage(error, 'No pudimos cargar el historial de liquidaciones.'));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function openHistory(): Promise<void> {
    setView('history');
    setDetail(null);
    await loadHistory();
  }

  async function openDetail(batchId: number): Promise<void> {
    setLoadingDetail(true);

    try {
      const nextDetail = await bridge.consignments.getBatchDetail({ batchId });
      setDetail(nextDetail);
      setView('detail');
    } catch (error) {
      setStatusKind('error');
      setStatusMessage(getErrorMessage(error, 'No pudimos abrir el detalle de la liquidación.'));
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggleSelection(saleItemId: number): void {
    setSelectedIds((current) => togglePendingSelection(current, saleItemId));
  }

  async function confirmBatch(): Promise<void> {
    setSubmitting(true);

    try {
      const result = await bridge.consignments.confirmBatch({
        saleItemIds: selectedIds,
        liquidationDate,
        notes: notes.trim() ? notes.trim() : null
      });

      setSuccessBatch(result);
      setStatusKind('success');
      setStatusMessage(`Liquidación ${result.batchNumber} confirmada correctamente.`);
      setSelectedIds([]);
      setShowConfirmBlock(false);
      setNotes('');
      await Promise.all([loadPending(), loadHistory()]);
      setView('pending');
    } catch (error) {
      setStatusKind('error');
      setStatusMessage(getErrorMessage(error, 'No pudimos confirmar la liquidación.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function exportBatchExcel(batchId: number): Promise<void> {
    setExportingBatchId(batchId);

    try {
      const result = await bridge.consignments.exportBatchExcel({ batchId });

      setStatusKind(result.status === 'saved' ? 'success' : 'info');
      setStatusMessage(
        result.status === 'saved'
          ? `Comprobante Excel de la liquidación ${result.batchNumber} exportado correctamente.`
          : 'No exportamos el archivo porque cancelaste la ubicación de guardado.'
      );
    } catch (error) {
      setStatusKind('error');
      setStatusMessage(getErrorMessage(error, 'No pudimos generar el archivo Excel de la liquidación.'));
    } finally {
      setExportingBatchId(null);
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        title="Liquidaciones"
        description="Liquidá artículos pendientes y consultá el historial sin perder la trazabilidad."
        actions={
          <>
            <Button type="button" variant="nav" active={view === 'pending'} onClick={() => setView('pending')}>
              Pendientes
            </Button>
            <Button type="button" variant="nav" active={view === 'history'} onClick={() => void openHistory()}>
              Historial
            </Button>
            {onBack ? (
              <Button type="button" variant="secondary" onClick={() => onBack()}>
                Volver
              </Button>
            ) : null}
          </>
        }
      />

      <Surface className="consignments-stages" aria-label="etapas-liquidaciones">
        {stages.map((stage, index) => (
          <div className={`consignments-stage consignments-stage--${stage.tone}`} key={stage.label}>
            <span className="consignments-stage__index">{index + 1}</span>
            <div>
              <p className="consignments-stage__label">{stage.label}</p>
              <p className="consignments-stage__hint">{stage.hint}</p>
            </div>
          </div>
        ))}
      </Surface>

      {statusMessage ? <Banner tone={statusKind === 'error' ? 'error' : statusKind === 'info' ? 'info' : 'success'} role="status" message={statusMessage} /> : null}

      {successBatch ? (
        <Surface tone="soft" aria-label="resultado-liquidacion" className="consignments-result">
          <div className="consignments-result__header">
            <div>
              <h3 className="surface__title">Resultado de la liquidación</h3>
              <p className="surface__description">La liquidación #{successBatch.batchNumber} ya quedó registrada y lista para exportar.</p>
            </div>
            <Badge tone="success">Confirmada</Badge>
          </div>
          <div className="consignments-summary-grid">
            <SummaryCard label="Liquidación" value={`#${successBatch.batchNumber}`} />
            <SummaryCard label="Artículos" value={String(successBatch.itemCount)} />
            <SummaryCard label="Importe a pagar ahora" value={formatCurrencyFromCents(successBatch.totalCents)} />
            <SummaryCard label="Saldo proveedor después de liquidar" value={formatCurrencyFromCents(successBatch.remainingCents)} />
            <SummaryCard label="Ganancia" value={formatCurrencyFromCents(successBatch.totalGainCents)} />
          </div>
          <div className="actions consignments-result__actions">
            <Button
              type="button"
              variant="success"
              onClick={() => void exportBatchExcel(successBatch.batchId)}
              disabled={exportingBatchId === successBatch.batchId}
            >
              {exportingBatchId === successBatch.batchId ? 'Generando…' : 'Exportar liquidación'}
            </Button>
          </div>
        </Surface>
      ) : null}

      {view === 'pending' ? (
        <>
          <Surface>
            <div className="page-header">
              <div>
                <h3 className="surface__title">Pendientes de liquidación</h3>
                <p className="surface__description">Seleccioná artículos para pasar a revisión antes de confirmar la liquidación.</p>
              </div>
              <div className="actions">
                <Button type="button" variant="secondary" onClick={() => void loadPending()}>
                  Actualizar
                </Button>
                <Button type="button" variant={selectedSummary.count === 0 ? 'secondary' : 'success'} disabled={selectedSummary.count === 0} onClick={() => setShowConfirmBlock(true)}>
                  Revisar liquidación
                </Button>
              </div>
            </div>

            <div className="consignments-summary-grid">
              <SummaryCard label="Seleccionados" value={String(selectedSummary.count)} />
              <SummaryCard label="Importe a pagar ahora" value={formatCurrencyFromCents(selectedSummary.totalCents)} />
              <SummaryCard label="Saldo pendiente con el proveedor" value={formatCurrencyFromCents(selectedSummary.remainingCents)} />
              <SummaryCard label="Ganancia" value={formatCurrencyFromCents(selectedSummary.totalGainCents)} />
            </div>

            {loadingPending ? <Banner tone="info" message="Cargando pendientes…" /> : null}
            {!loadingPending && pendingItems.length === 0 ? (
              <EmptyState title="No hay artículos pendientes para liquidar." description="Cuando se registren artículos para liquidación, se van a listar acá." />
            ) : null}

            {pendingItems.length > 0 ? (
              <ul className="list consignments-list-spaced">
                {pendingItems.map((item) => {
                  const checked = selectedIds.includes(item.saleItemId);

                  return (
                    <li className={`list-row consignments-pending-row ${checked ? 'list-row--selected' : ''}`} key={item.saleItemId}>
                      <label className="consignments-pending-row__label" style={{ cursor: 'pointer', width: '100%' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(item.saleItemId)} aria-label={`Seleccionar ${item.productName}`} />
                        <div className="list-row__content">
                          <div className="list-row__headline consignments-pending-row__headline">
                            <div>
                              <p className="list-row__title">{item.productName}</p>
                              <p className="consignments-inline-meta">Venta #{item.saleNumber} · {formatDate(item.saleDate)}</p>
                            </div>
                            <Badge tone={getSaleStatusBadgeTone(item.saleStatus)}>
                              {formatSaleStatusLabel(item.saleStatus)}
                            </Badge>
                          </div>
                          <div className="consignments-kv-grid">
                            <MetricLine label="Comprador" value={item.buyerName?.trim() ? item.buyerName : 'Venta de mostrador'} />
                            <MetricLine label="Saldo pendiente con el proveedor" value={formatCurrencyFromCents(item.amountCents)} />
                            <MetricLine label="Liquidado antes" value={formatCurrencyFromCents(item.liquidatedPreviouslyCents ?? 0)} />
                            <MetricLine label="Ganancia" value={formatCurrencyFromCents(item.gainCents)} />
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Surface>

          {showConfirmBlock ? (
            <Surface aria-label="confirmar-liquidacion" className="consignments-review-block">
              <div className="consignments-review-block__header">
                <div>
                  <h3 className="surface__title">Revisar liquidación</h3>
                  <p className="surface__description">Chequeá importes y advertencias antes de confirmar el lote.</p>
                </div>
                <Badge tone="info">Paso previo</Badge>
              </div>
              <div className="consignments-summary-grid">
                <SummaryCard label="Artículos" value={String(selectedSummary.count)} />
                <SummaryCard label="Importe a pagar ahora" value={formatCurrencyFromCents(selectedSummary.totalCents)} />
                <SummaryCard label="Saldo pendiente con el proveedor" value={formatCurrencyFromCents(selectedSummary.remainingCents)} />
                <SummaryCard label="Ganancia" value={formatCurrencyFromCents(selectedSummary.totalGainCents)} />
              </div>
              {warningItems.length > 0 ? (
                <Banner
                  tone="warning"
                  title="Hay ventas con pago parcial"
                  message="Podés seguir, pero conviene revisar cuánto se cobró al cliente y cuánto queda pendiente antes de cerrar esta liquidación."
                >
                  <ul className="list consignments-warning-list">
                    {warningItems.map((item) => (
                      <li className="list-row consignments-warning-row" key={item.saleItemId}>
                        <div className="list-row__content">
                          <p className="list-row__title">
                            Venta #{item.saleNumber} · {item.productName}
                          </p>
                          <div className="consignments-kv-grid">
                            <MetricLine label="Cobrado al cliente" value={formatCurrencyFromCents(item.salePaidCents)} />
                            <MetricLine label="Saldo del cliente" value={formatCurrencyFromCents(item.saleBalanceCents)} />
                            <MetricLine label="Importe a pagar ahora" value={formatCurrencyFromCents(item.amountDueNowCents)} />
                            <MetricLine label="Saldo pendiente con el proveedor" value={formatCurrencyFromCents(item.remainingBalanceCents)} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Banner>
              ) : null}
              <div className="grid-2">
                <Field label="Fecha de liquidación">
                  <input className="input" type="date" value={liquidationDate} onChange={(event) => setLiquidationDate(event.target.value)} />
                </Field>
                <Field label="Nota opcional">
                  <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej: Primera quincena" />
                </Field>
              </div>
              <div className="actions">
                <Button type="button" variant="success" onClick={() => void confirmBatch()} disabled={submitting}>
                  {submitting ? 'Confirmando…' : 'Confirmar liquidación'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowConfirmBlock(false)}>
                  Cancelar
                </Button>
              </div>
            </Surface>
          ) : null}
        </>
      ) : null}

      {view === 'history' ? (
        <Surface>
          <div className="page-header">
            <div>
              <h3 className="surface__title">Historial de liquidaciones</h3>
              <p className="surface__description">Consultá lotes confirmados y abrí el detalle cuando necesites trazabilidad.</p>
            </div>
          </div>
          {loadingHistory ? <Banner tone="info" message="Cargando historial…" /> : null}
          {!loadingHistory && historyItems.length === 0 ? (
            <EmptyState title="Todavía no hay liquidaciones confirmadas." description="La primera liquidación va a quedar disponible en este historial." />
          ) : null}

          {historyItems.length > 0 ? (
            <ul className="list consignments-list-spaced">
              {historyItems.map((item) => (
                <li className="list-row consignments-history-row" key={item.batchId}>
                  <div className="list-row__content">
                    <div className="list-row__headline consignments-history-row__headline">
                      <div>
                        <p className="list-row__title">Liquidación #{item.batchNumber}</p>
                        <p className="consignments-inline-meta">Confirmada el {formatDate(item.liquidationDate)}</p>
                      </div>
                      <Badge tone="info">Lote confirmado</Badge>
                    </div>
                    <div className="consignments-kv-grid">
                      <MetricLine label="Artículos" value={String(item.itemCount)} />
                      <MetricLine label="Liquidado" value={formatCurrencyFromCents(item.totalCents)} />
                      <MetricLine label="Saldo proveedor después de liquidar" value={formatCurrencyFromCents(item.remainingCents)} />
                      <MetricLine label="Ganancia" value={formatCurrencyFromCents(item.totalGainCents)} />
                    </div>
                    <p className="list-row__text">Nota: {item.notes?.trim() ? item.notes : 'Sin nota'}</p>
                  </div>
                  <div className="list-row__aside">
                    <Button type="button" variant="primary" onClick={() => void openDetail(item.batchId)}>
                      Ver detalle
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void exportBatchExcel(item.batchId)}
                      disabled={exportingBatchId === item.batchId}
                    >
                      {exportingBatchId === item.batchId ? 'Generando…' : 'Exportar liquidación'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Surface>
      ) : null}

      {view === 'detail' && detail ? (
        <Surface>
          <PageHeader
            title={`Detalle de la liquidación #${detail.batchNumber}`}
            description="Detalle completo del lote confirmado, con importes congelados y contexto de cobro."
            actions={
              <>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => void exportBatchExcel(detail.batchId)}
                  disabled={exportingBatchId === detail.batchId}
                >
                  {exportingBatchId === detail.batchId ? 'Generando…' : 'Exportar liquidación'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setView('history')}>
                  Volver al historial
                </Button>
              </>
            }
          >
            <p className="subtle">Nota: {detail.notes?.trim() ? detail.notes : 'Sin nota'}</p>
          </PageHeader>

          {loadingDetail ? <Banner tone="info" message="Cargando detalle…" /> : null}

          <div className="consignments-summary-grid">
            <SummaryCard label="Fecha" value={formatDate(detail.liquidationDate)} />
            <SummaryCard label="Artículos" value={String(detail.itemCount)} />
            <SummaryCard label="Liquidado" value={formatCurrencyFromCents(detail.totalCents)} />
            <SummaryCard label="Saldo proveedor después de liquidar" value={formatCurrencyFromCents(detail.remainingCents)} />
            <SummaryCard label="Ganancia" value={formatCurrencyFromCents(detail.totalGainCents)} />
          </div>

          <ul className="list consignments-list-spaced">
            {detail.items.map((item, index) => (
              <li className="list-row consignments-detail-row" key={`${detail.batchNumber}-${item.saleNumber}-${index}`}>
                <div className="list-row__content">
                  <div className="list-row__headline consignments-history-row__headline">
                    <div>
                      <p className="list-row__title">{item.productName}</p>
                      <p className="consignments-inline-meta">Venta #{item.saleNumber} · {formatDate(item.saleDate)}</p>
                    </div>
                    <Badge tone={getSaleStatusBadgeTone(item.saleStatus)}>{formatSaleStatusLabel(item.saleStatus)}</Badge>
                  </div>
                  <div className="consignments-kv-grid consignments-kv-grid--detail">
                    <MetricLine label="Comprador" value={item.buyerName?.trim() ? item.buyerName : 'Venta de mostrador'} />
                    <MetricLine label="Cobrado al cliente" value={formatCurrencyFromCents(item.salePaidCents ?? 0)} />
                    <MetricLine label="Saldo del cliente" value={formatCurrencyFromCents(item.saleBalanceCents ?? 0)} />
                    <MetricLine label="Importe a pagar ahora" value={formatCurrencyFromCents(item.amountCents)} />
                    <MetricLine label="Liquidado antes" value={formatCurrencyFromCents(item.liquidatedPreviouslyCents ?? 0)} />
                    <MetricLine label="Acumulado" value={formatCurrencyFromCents(item.totalAccumulatedCents ?? item.amountCents)} />
                    <MetricLine label="Saldo proveedor después de liquidar" value={formatCurrencyFromCents(item.remainingBalanceCents ?? 0)} />
                    <MetricLine label="Ganancia del lote" value={formatCurrencyFromCents(item.gainCents)} />
                  </div>
                  <p className="list-row__text">Método de pago: {item.paymentMethodSummary ?? 'Sin pagos registrados'}</p>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="consignments-summary-card">
      <p className="consignments-summary-card__label">{label}</p>
      <p className="consignments-summary-card__value">{value}</p>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <p className="consignments-metric-line">
      <span className="consignments-metric-line__label">{label}</span>
      <span className="consignments-metric-line__value">{value}</span>
    </p>
  );
}

function buildStages({
  view,
  showConfirmBlock,
  successBatch
}: {
  view: View;
  showConfirmBlock: boolean;
  successBatch: ConfirmConsignmentBatchResult | null;
}): Array<{ label: string; hint: string; tone: StageTone }> {
  return [
    {
      label: 'Pendientes',
      hint: 'Seleccionar artículos',
      tone: view === 'pending' && !showConfirmBlock ? 'current' : showConfirmBlock || Boolean(successBatch) ? 'complete' : 'idle'
    },
    {
      label: 'Revisar liquidación',
      hint: 'Chequeo previo',
      tone: showConfirmBlock ? 'current' : successBatch ? 'complete' : 'idle'
    },
    {
      label: 'Confirmar liquidación',
      hint: 'Registrar el lote',
      tone: successBatch ? 'complete' : 'idle'
    },
    {
      label: 'Resultado',
      hint: 'Resumen y exportación',
      tone: successBatch ? 'current' : 'idle'
    },
    {
      label: 'Historial',
      hint: 'Lotes confirmados',
      tone: view === 'history' ? 'current' : 'idle'
    },
    {
      label: 'Detalle',
      hint: 'Trazabilidad por artículo',
      tone: view === 'detail' ? 'current' : 'idle'
    }
  ];
}

function formatSaleStatusLabel(status?: PendingConsignmentItem['saleStatus']): string {
  switch (status) {
    case 'pending_payment':
      return 'Pago pendiente';
    case 'partial_payment':
      return 'Pago parcial';
    case 'paid':
      return 'Pagado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Sin estado';
  }
}

function getSaleStatusBadgeTone(status?: PendingConsignmentItem['saleStatus']): React.ComponentProps<typeof Badge>['tone'] {
  switch (status) {
    case 'partial_payment':
      return 'warning';
    case 'paid':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'pending_payment':
    default:
      return 'neutral';
  }
}
