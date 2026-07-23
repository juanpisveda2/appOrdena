import type {
  CatalogListRequest,
  CatalogListResult,
  CatalogProductDetail,
  CatalogProductDetailRequest,
  CatalogSearchRequest,
  CatalogSearchResult,
  DeleteReusableProductRequest,
  DeleteReusableProductResult,
  SaveStockIntakeRequest,
  SaveStockIntakeResult,
  UpdateReusableProductRequest,
  UpdateReusableProductResult
} from './catalog';
import type {
  ConfirmConsignmentBatchRequest,
  ConfirmConsignmentBatchResult,
  ConsignmentBatchDetail,
  ExportConsignmentBatchExcelRequest,
  ExportConsignmentBatchExcelResult,
  ConsignmentBatchHistoryListItem,
  GetConsignmentBatchDetailRequest,
  ListConsignmentBatchHistoryRequest,
  ListPendingConsignmentItemsRequest,
  PendingConsignmentItem
} from './consignments';
import type {
  AssignSaleCustomerForPaymentRecoveryRequest,
  CancelSalePaymentRequest,
  CancelSaleRequest,
  ConfirmSaleDraftRequest,
  GetSaleDetailRequest,
  ListSalesHistoryRequest,
  RegisterSalePaymentRequest,
  SaleSnapshot,
  SalesHistoryListItem
} from './sales';

export const APP_HEALTH_CHANNEL = 'app:health';
export const CATALOG_LIST_CHANNEL = 'catalog:list';
export const CATALOG_PRODUCT_DETAIL_CHANNEL = 'catalog:product-detail';
export const CATALOG_SEARCH_CHANNEL = 'catalog:search';
export const CATALOG_UPDATE_PRODUCT_CHANNEL = 'catalog:update-product';
export const CATALOG_DELETE_PRODUCT_CHANNEL = 'catalog:delete-product';
export const STOCK_SAVE_INTAKE_CHANNEL = 'stock:save-intake';
export const SALES_HISTORY_LIST_CHANNEL = 'sales:list-history';
export const SALES_DETAIL_CHANNEL = 'sales:get-detail';
export const SALES_CONFIRM_DRAFT_CHANNEL = 'sales:confirm-draft';
export const SALES_REGISTER_PAYMENT_CHANNEL = 'sales:register-payment';
export const SALES_CANCEL_PAYMENT_CHANNEL = 'sales:cancel-payment';
export const SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL = 'sales:assign-customer-for-payment-recovery';
export const SALES_CANCEL_CHANNEL = 'sales:cancel';
export const CONSIGNMENTS_PENDING_LIST_CHANNEL = 'consignments:list-pending';
export const CONSIGNMENTS_CONFIRM_BATCH_CHANNEL = 'consignments:confirm-batch';
export const CONSIGNMENTS_HISTORY_LIST_CHANNEL = 'consignments:list-history';
export const CONSIGNMENTS_DETAIL_CHANNEL = 'consignments:get-detail';
export const CONSIGNMENTS_EXPORT_EXCEL_CHANNEL = 'consignments:export-excel';

export interface AppHealthRequest {
  ping: 'foundation';
}

export interface AppHealthResponse {
  ok: true;
  appVersion: string;
  runtime: 'desktop-foundation';
  dbReady: boolean;
  schemaVersion: number;
}

export interface CatalogBridge {
  list(request?: CatalogListRequest): Promise<CatalogListResult>;
  getProductDetail(request: CatalogProductDetailRequest): Promise<CatalogProductDetail>;
  search(request: CatalogSearchRequest): Promise<CatalogSearchResult[]>;
  updateProduct(request: UpdateReusableProductRequest): Promise<UpdateReusableProductResult>;
  deleteProduct(request: DeleteReusableProductRequest): Promise<DeleteReusableProductResult>;
}

export interface StockBridge {
  saveIntake(request: SaveStockIntakeRequest): Promise<SaveStockIntakeResult>;
}

export interface SalesBridge {
  listHistory(request?: ListSalesHistoryRequest): Promise<SalesHistoryListItem[]>;
  getById(request: GetSaleDetailRequest): Promise<SaleSnapshot>;
  confirmDraft(request: ConfirmSaleDraftRequest): Promise<SaleSnapshot>;
  registerPayment(request: RegisterSalePaymentRequest): Promise<SaleSnapshot>;
  cancelPayment(request: CancelSalePaymentRequest): Promise<SaleSnapshot>;
  assignCustomerForPaymentRecovery(request: AssignSaleCustomerForPaymentRecoveryRequest): Promise<SaleSnapshot>;
  cancelSale(request: CancelSaleRequest): Promise<SaleSnapshot>;
}

export interface ConsignmentsBridge {
  listPendingItems(request?: ListPendingConsignmentItemsRequest): Promise<PendingConsignmentItem[]>;
  confirmBatch(request: ConfirmConsignmentBatchRequest): Promise<ConfirmConsignmentBatchResult>;
  listBatchHistory(request?: ListConsignmentBatchHistoryRequest): Promise<ConsignmentBatchHistoryListItem[]>;
  getBatchDetail(request: GetConsignmentBatchDetailRequest): Promise<ConsignmentBatchDetail>;
  exportBatchExcel(request: ExportConsignmentBatchExcelRequest): Promise<ExportConsignmentBatchExcelResult>;
}

export interface AppBridge {
  health(): Promise<AppHealthResponse>;
  catalog: CatalogBridge;
  stock: StockBridge;
  sales: SalesBridge;
  consignments: ConsignmentsBridge;
}

export const APP_HEALTH_REQUEST: AppHealthRequest = {
  ping: 'foundation'
};
