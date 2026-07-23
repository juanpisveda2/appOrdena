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
            <Button type="button" variant={view === 'pending' ? 'primary' : 'secondary'} onClick={() => setView('pending')}>
              Pendientes
            </Button>
            <Button type="button" variant={view === 'history' ? 'primary' : 'secondary'} onClick={() => void openHistory()}>
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

      {statusMessage ? <Banner tone={statusKind === 'error' ? 'error' : statusKind === 'info' ? 'info' : 'success'} role="status" message={statusMessage} /> : null}

      {successBatch ? (
        <Surface tone="soft" aria-label="resultado-liquidacion">
          <h3 className="surface__title">Liquidación confirmada</h3>
          <dl className="data-list">
            <dt>Número de liquidación</dt>
            <dd>{successBatch.batchNumber}</dd>
            <dt>Cantidad de artículos</dt>
            <dd>{successBatch.itemCount}</dd>
            <dt>Total al proveedor</dt>
            <dd>{formatCurrencyFromCents(successBatch.totalCents)}</dd>
            <dt>Ganancia total</dt>
            <dd>{formatCurrencyFromCents(successBatch.totalGainCents)}</dd>
          </dl>
          <div className="actions" style={{ marginTop: 16 }}>
            <Button
              type="button"
              variant="success"
              onClick={() => void exportBatchExcel(successBatch.batchId)}
              disabled={exportingBatchId === successBatch.batchId}
            >
              {exportingBatchId === successBatch.batchId ? 'Generando…' : 'Exportar comprobante Excel'}
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
                <p className="surface__description">
                  Seleccionados: <strong>{selectedSummary.count}</strong> · Total al proveedor:{' '}
                  <strong>{formatCurrencyFromCents(selectedSummary.totalCents)}</strong> · Ganancia:{' '}
                  <strong>{formatCurrencyFromCents(selectedSummary.totalGainCents)}</strong>
                </p>
              </div>
              <div className="actions">
                <Button type="button" variant="secondary" onClick={() => void loadPending()}>
                  Actualizar
                </Button>
                <Button type="button" variant={selectedSummary.count === 0 ? 'secondary' : 'success'} disabled={selectedSummary.count === 0} onClick={() => setShowConfirmBlock(true)}>
                  Confirmar liquidación
                </Button>
              </div>
            </div>

            {loadingPending ? <Banner tone="info" message="Cargando pendientes…" /> : null}
            {!loadingPending && pendingItems.length === 0 ? (
              <EmptyState title="No hay artículos pendientes para liquidar." description="Cuando se registren artículos para liquidación, se van a listar acá." />
            ) : null}

            {pendingItems.length > 0 ? (
              <ul className="list" style={{ marginTop: 16 }}>
                {pendingItems.map((item) => {
                  const checked = selectedIds.includes(item.saleItemId);

                  return (
                    <li className={`list-row ${checked ? 'list-row--selected' : ''}`} key={item.saleItemId}>
                      <label className="cluster" style={{ alignItems: 'flex-start', cursor: 'pointer', width: '100%' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(item.saleItemId)} aria-label={`Seleccionar ${item.productName}`} />
                        <div className="list-row__content">
                          <div className="cluster">
                            <p className="list-row__title">{item.productName}</p>
                            <Badge tone={checked ? 'info' : 'neutral'}>{checked ? 'Seleccionado' : 'Pendiente'}</Badge>
                          </div>
                          <p className="list-row__text">Venta #{item.saleNumber} · Fecha: {formatDate(item.saleDate)}</p>
                          <p className="list-row__text">
                            Comprador: {item.buyerName?.trim() ? item.buyerName : 'Venta de mostrador'} · A pagar al proveedor: {formatCurrencyFromCents(item.amountCents)} · Ganancia: {formatCurrencyFromCents(item.gainCents)}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Surface>

          {showConfirmBlock ? (
            <Surface aria-label="confirmar-liquidacion">
              <h3 className="surface__title">Confirmar liquidación</h3>
              <p className="surface__description">
                Artículos seleccionados: {selectedSummary.count} · Total al proveedor: {formatCurrencyFromCents(selectedSummary.totalCents)} · Ganancia: {formatCurrencyFromCents(selectedSummary.totalGainCents)}
              </p>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <Field label="Fecha de liquidación">
                  <input className="input" type="date" value={liquidationDate} onChange={(event) => setLiquidationDate(event.target.value)} />
                </Field>
                <Field label="Nota opcional">
                  <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej: Primera quincena" />
                </Field>
              </div>
              <div className="actions" style={{ marginTop: 16 }}>
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
          <h3 className="surface__title">Historial de liquidaciones</h3>
          {loadingHistory ? <Banner tone="info" message="Cargando historial…" /> : null}
          {!loadingHistory && historyItems.length === 0 ? (
            <EmptyState title="Todavía no hay liquidaciones confirmadas." description="La primera liquidación va a quedar disponible en este historial." />
          ) : null}

          {historyItems.length > 0 ? (
            <ul className="list" style={{ marginTop: 16 }}>
              {historyItems.map((item) => (
                <li className="list-row" key={item.batchId}>
                  <div className="list-row__content">
                    <div className="cluster">
                      <p className="list-row__title">Liquidación #{item.batchNumber}</p>
                      <Badge tone="info">Confirmada</Badge>
                    </div>
                    <p className="list-row__text">
                      Fecha: {formatDate(item.liquidationDate)} · Artículos: {item.itemCount} · Total al proveedor: {formatCurrencyFromCents(item.totalCents)} · Ganancia: {formatCurrencyFromCents(item.totalGainCents)}
                    </p>
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
                      {exportingBatchId === item.batchId ? 'Generando…' : 'Exportar Excel'}
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
            description={`Fecha: ${formatDate(detail.liquidationDate)} · Artículos: ${detail.itemCount} · Total al proveedor: ${formatCurrencyFromCents(detail.totalCents)} · Ganancia: ${formatCurrencyFromCents(detail.totalGainCents)}`}
            actions={
              <>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => void exportBatchExcel(detail.batchId)}
                  disabled={exportingBatchId === detail.batchId}
                >
                  {exportingBatchId === detail.batchId ? 'Generando…' : 'Exportar Excel'}
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

          <ul className="list">
            {detail.items.map((item, index) => (
              <li className="list-row" key={`${detail.batchNumber}-${item.saleNumber}-${index}`}>
                <div className="list-row__content">
                  <p className="list-row__title">{item.productName}</p>
                  <p className="list-row__text">Venta #{item.saleNumber} · Fecha de venta: {formatDate(item.saleDate)}</p>
                  <p className="list-row__text">
                    Comprador: {item.buyerName?.trim() ? item.buyerName : 'Venta de mostrador'} · Importe liquidado: {formatCurrencyFromCents(item.amountCents)} · Total vendido: {formatCurrencyFromCents(item.saleTotalCents)} · Ganancia: {formatCurrencyFromCents(item.gainCents)}
                  </p>
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
