"use strict";
const electron = require("electron");
const APP_HEALTH_CHANNEL = "app:health";
const CATALOG_LIST_CHANNEL = "catalog:list";
const CATALOG_PRODUCT_DETAIL_CHANNEL = "catalog:product-detail";
const CATALOG_SEARCH_CHANNEL = "catalog:search";
const CATALOG_UPDATE_PRODUCT_CHANNEL = "catalog:update-product";
const CATALOG_DELETE_PRODUCT_CHANNEL = "catalog:delete-product";
const STOCK_SAVE_INTAKE_CHANNEL = "stock:save-intake";
const SALES_HISTORY_LIST_CHANNEL = "sales:list-history";
const SALES_DETAIL_CHANNEL = "sales:get-detail";
const SALES_CONFIRM_DRAFT_CHANNEL = "sales:confirm-draft";
const SALES_REGISTER_PAYMENT_CHANNEL = "sales:register-payment";
const SALES_CANCEL_PAYMENT_CHANNEL = "sales:cancel-payment";
const SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL = "sales:assign-customer-for-payment-recovery";
const SALES_CANCEL_CHANNEL = "sales:cancel";
const CONSIGNMENTS_PENDING_LIST_CHANNEL = "consignments:list-pending";
const CONSIGNMENTS_CONFIRM_BATCH_CHANNEL = "consignments:confirm-batch";
const CONSIGNMENTS_HISTORY_LIST_CHANNEL = "consignments:list-history";
const CONSIGNMENTS_DETAIL_CHANNEL = "consignments:get-detail";
const CONSIGNMENTS_EXPORT_EXCEL_CHANNEL = "consignments:export-excel";
const APP_HEALTH_REQUEST = {
  ping: "foundation"
};
const appBridge = {
  health: () => electron.ipcRenderer.invoke(APP_HEALTH_CHANNEL, APP_HEALTH_REQUEST),
  catalog: {
    list: (request) => electron.ipcRenderer.invoke(CATALOG_LIST_CHANNEL, request ?? {}),
    getProductDetail: (request) => electron.ipcRenderer.invoke(CATALOG_PRODUCT_DETAIL_CHANNEL, request),
    search: (request) => electron.ipcRenderer.invoke(CATALOG_SEARCH_CHANNEL, request),
    updateProduct: (request) => electron.ipcRenderer.invoke(CATALOG_UPDATE_PRODUCT_CHANNEL, request),
    deleteProduct: (request) => electron.ipcRenderer.invoke(CATALOG_DELETE_PRODUCT_CHANNEL, request)
  },
  stock: {
    saveIntake: (request) => electron.ipcRenderer.invoke(STOCK_SAVE_INTAKE_CHANNEL, request)
  },
  sales: {
    listHistory: (request) => electron.ipcRenderer.invoke(SALES_HISTORY_LIST_CHANNEL, request ?? {}),
    getById: (request) => electron.ipcRenderer.invoke(SALES_DETAIL_CHANNEL, request),
    confirmDraft: (request) => electron.ipcRenderer.invoke(SALES_CONFIRM_DRAFT_CHANNEL, request),
    registerPayment: (request) => electron.ipcRenderer.invoke(SALES_REGISTER_PAYMENT_CHANNEL, request),
    cancelPayment: (request) => electron.ipcRenderer.invoke(SALES_CANCEL_PAYMENT_CHANNEL, request),
    assignCustomerForPaymentRecovery: (request) => electron.ipcRenderer.invoke(SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL, request),
    cancelSale: (request) => electron.ipcRenderer.invoke(SALES_CANCEL_CHANNEL, request)
  },
  consignments: {
    listPendingItems: (request) => electron.ipcRenderer.invoke(CONSIGNMENTS_PENDING_LIST_CHANNEL, request ?? {}),
    confirmBatch: (request) => electron.ipcRenderer.invoke(CONSIGNMENTS_CONFIRM_BATCH_CHANNEL, request),
    listBatchHistory: (request) => electron.ipcRenderer.invoke(CONSIGNMENTS_HISTORY_LIST_CHANNEL, request ?? {}),
    getBatchDetail: (request) => electron.ipcRenderer.invoke(CONSIGNMENTS_DETAIL_CHANNEL, request),
    exportBatchExcel: (request) => electron.ipcRenderer.invoke(CONSIGNMENTS_EXPORT_EXCEL_CHANNEL, request)
  }
};
electron.contextBridge.exposeInMainWorld("app", appBridge);
//# sourceMappingURL=preload.js.map
