export interface ListPendingConsignmentItemsRequest {
  limit?: number;
}

export interface PendingConsignmentItem {
  saleItemId: number;
  productName: string;
  saleNumber: number;
  saleDate: string;
  buyerName: string | null;
  amountCents: number;
  gainCents: number;
}

export interface ConfirmConsignmentBatchRequest {
  saleItemIds: number[];
  liquidationDate: string;
  notes?: string | null;
}

export interface ConfirmConsignmentBatchResult {
  batchId: number;
  batchNumber: number;
  liquidationDate: string;
  itemCount: number;
  totalCents: number;
  totalGainCents: number;
  notes: string | null;
  createdAt: string;
}

export const CONSIGNMENT_BATCH_EXPORT_STATUSES = ['saved', 'cancelled'] as const;

export type ConsignmentBatchExportStatus = (typeof CONSIGNMENT_BATCH_EXPORT_STATUSES)[number];

export interface ListConsignmentBatchHistoryRequest {
  limit?: number;
}

export interface ConsignmentBatchHistoryListItem {
  batchId: number;
  batchNumber: number;
  liquidationDate: string;
  itemCount: number;
  totalCents: number;
  totalGainCents: number;
  notes: string | null;
  createdAt: string;
}

export interface GetConsignmentBatchDetailRequest {
  batchId: number;
}

export interface ExportConsignmentBatchExcelRequest {
  batchId: number;
}

export interface ExportConsignmentBatchExcelResult {
  status: ConsignmentBatchExportStatus;
  batchId: number;
  batchNumber: number;
  generatedAt: string;
  filePath?: string;
}

export interface ConsignmentBatchDetailItem {
  productName: string;
  category: string;
  material: string;
  variant: string;
  saleNumber: number;
  saleDate: string;
  buyerName: string | null;
  unitPriceCents: number;
  personalizationCents: number | null;
  saleTotalCents: number;
  amountCents: number;
  productGainCents: number;
  personalizationGainCents: number;
  gainCents: number;
  liquidationDate: string;
}

export interface ConsignmentBatchDetail {
  batchId: number;
  batchNumber: number;
  liquidationDate: string;
  itemCount: number;
  totalCents: number;
  totalGainCents: number;
  notes: string | null;
  createdAt: string;
  items: ConsignmentBatchDetailItem[];
}
