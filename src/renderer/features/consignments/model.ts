import type { AppBridge } from '../../../shared/contracts/app';
import type {
  ConfirmConsignmentBatchRequest,
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ConsignmentBatchHistoryListItem,
  PendingConsignmentItem
} from '../../../shared/contracts/consignments';
import {
  summarizeConsignmentLiquidationSelection,
  type ConsignmentLiquidationSourceItem
} from '../../../shared/consignments/liquidation';

export interface ConsignmentsState {
  pendingItems: PendingConsignmentItem[];
  historyItems: ConsignmentBatchHistoryListItem[];
  detail: ConsignmentBatchDetail | null;
  selectedIds: number[];
  liquidationDate: string;
  notes: string;
  successBatch: ConfirmConsignmentBatchResult | null;
  statusMessage: string | null;
}

export interface ConsignmentSelectionItem {
  saleItemId: number;
  saleNumber: number;
  productName: string;
  buyerName: string | null;
  saleStatus: PendingConsignmentItem['saleStatus'];
  salePaidCents: number;
  saleBalanceCents: number;
  amountDueNowCents: number;
  remainingBalanceCents: number;
  liquidatedPreviouslyCents: number;
  gainCents: number;
}

export interface ConsignmentSelectionSummary {
  count: number;
  totalCents: number;
  remainingCents: number;
  totalGainCents: number;
  items: ConsignmentSelectionItem[];
  partialItems: ConsignmentSelectionItem[];
}

const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function getCurrentBusinessDate(now: Date = new Date()): string {
  const parts = businessDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not derive current business date parts.');
  }

  return `${year}-${month}-${day}`;
}

export function createInitialConsignmentsState(): ConsignmentsState {
  return {
    pendingItems: [],
    historyItems: [],
    detail: null,
    selectedIds: [],
    liquidationDate: getCurrentBusinessDate(),
    notes: '',
    successBatch: null,
    statusMessage: null
  };
}

export function togglePendingSelection(selectedIds: number[], saleItemId: number): number[] {
  return selectedIds.includes(saleItemId)
    ? selectedIds.filter((itemId) => itemId !== saleItemId)
    : [...selectedIds, saleItemId];
}

export function summarizeSelection(state: ConsignmentsState): ConsignmentSelectionSummary {
  const sourceItems: ConsignmentLiquidationSourceItem[] = state.pendingItems.map((item) => ({
    saleItemId: item.saleItemId,
    saleId: item.saleId ?? item.saleNumber,
    saleStatus: item.saleStatus,
    salePaidCents: item.salePaidCents,
    supplierTotalToLiquidateCents: (item.amountCents ?? 0) + (item.liquidatedPreviouslyCents ?? 0),
    liquidatedPreviouslyCents: item.liquidatedPreviouslyCents ?? 0
  }));
  const itemById = new Map(state.pendingItems.map((item) => [item.saleItemId, item]));
  const summary = summarizeConsignmentLiquidationSelection(sourceItems, state.selectedIds);

  return {
    count: summary.count,
    totalCents: summary.totalDueNowCents,
    remainingCents: summary.totalRemainingBalanceCents,
    totalGainCents: summary.items.reduce((sum, item) => sum + (itemById.get(item.saleItemId)?.gainCents ?? 0), 0),
    items: summary.items.map((item) => {
      const source = itemById.get(item.saleItemId);

      return {
        saleItemId: item.saleItemId,
        saleNumber: source?.saleNumber ?? 0,
        productName: source?.productName ?? '',
        buyerName: source?.buyerName ?? null,
        saleStatus: source?.saleStatus,
        salePaidCents: source?.salePaidCents ?? 0,
        saleBalanceCents: source?.saleBalanceCents ?? 0,
        amountDueNowCents: item.amountDueNowCents,
        remainingBalanceCents: item.remainingBalanceCents,
        liquidatedPreviouslyCents: source?.liquidatedPreviouslyCents ?? 0,
        gainCents: source?.gainCents ?? 0
      };
    }),
    partialItems: summary.items
      .map((item) => {
        const source = itemById.get(item.saleItemId);

        return {
          saleItemId: item.saleItemId,
          saleNumber: source?.saleNumber ?? 0,
          productName: source?.productName ?? '',
          buyerName: source?.buyerName ?? null,
          saleStatus: source?.saleStatus,
          salePaidCents: source?.salePaidCents ?? 0,
          saleBalanceCents: source?.saleBalanceCents ?? 0,
          amountDueNowCents: item.amountDueNowCents,
          remainingBalanceCents: item.remainingBalanceCents,
          liquidatedPreviouslyCents: source?.liquidatedPreviouslyCents ?? 0,
          gainCents: source?.gainCents ?? 0
        } satisfies ConsignmentSelectionItem;
      })
      .filter((item) => item.saleStatus === 'partial_payment')
  };
}

export function buildConfirmConsignmentBatchRequest(
  state: ConsignmentsState
): ConfirmConsignmentBatchRequest {
  if (state.selectedIds.length === 0) {
    throw new Error('Seleccioná al menos un artículo para liquidar.');
  }

  return {
    saleItemIds: [...state.selectedIds],
    liquidationDate: state.liquidationDate,
    notes: state.notes.trim() ? state.notes.trim() : null
  };
}

export function createConsignmentActions({
  bridge,
  getState,
  setState
}: {
  bridge: AppBridge;
  getState: () => ConsignmentsState;
  setState: (nextState: ConsignmentsState | ((current: ConsignmentsState) => ConsignmentsState)) => void;
}) {
  return {
    async loadPending() {
      const pendingItems = await bridge.consignments.listPendingItems();
      setState((current) => ({
        ...current,
        pendingItems,
        selectedIds: current.selectedIds.filter((saleItemId) => pendingItems.some((item) => item.saleItemId === saleItemId))
      }));
    },
    toggleSelection(saleItemId: number) {
      setState((current) => ({
        ...current,
        selectedIds: togglePendingSelection(current.selectedIds, saleItemId)
      }));
    },
    setNotes(notes: string) {
      setState((current) => ({ ...current, notes }));
    },
    async confirmBatch() {
      const request = buildConfirmConsignmentBatchRequest(getState());
      const successBatch = await bridge.consignments.confirmBatch(request);
      const pendingItems = await bridge.consignments.listPendingItems();
      const historyItems = await bridge.consignments.listBatchHistory();

      setState((current) => ({
        ...current,
        pendingItems,
        historyItems,
        selectedIds: [],
        notes: '',
        successBatch,
        statusMessage: `Liquidación ${successBatch.batchNumber} confirmada correctamente.`
      }));
    },
    async loadHistory() {
      const historyItems = await bridge.consignments.listBatchHistory();
      setState((current) => ({ ...current, historyItems }));
    },
    async openDetail(batchId: number) {
      const detail = await bridge.consignments.getBatchDetail({ batchId });
      setState((current) => ({ ...current, detail }));
    }
  };
}
