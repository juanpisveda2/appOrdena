import type { AppBridge } from '../../../shared/contracts/app';
import type {
  ConfirmConsignmentBatchRequest,
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ConsignmentBatchHistoryListItem,
  PendingConsignmentItem
} from '../../../shared/contracts/consignments';

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

export function summarizeSelection(state: ConsignmentsState): {
  count: number;
  totalCents: number;
  totalGainCents: number;
} {
  const selectedItems = state.pendingItems.filter((item) => state.selectedIds.includes(item.saleItemId));

  return {
    count: selectedItems.length,
    totalCents: selectedItems.reduce((sum, item) => sum + item.amountCents, 0),
    totalGainCents: selectedItems.reduce((sum, item) => sum + item.gainCents, 0)
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
