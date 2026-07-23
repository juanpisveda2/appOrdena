import { contextBridge, ipcRenderer } from 'electron';
import {
  APP_HEALTH_CHANNEL,
  APP_HEALTH_REQUEST,
  CATALOG_DELETE_PRODUCT_CHANNEL,
  CATALOG_LIST_CHANNEL,
  CATALOG_PRODUCT_DETAIL_CHANNEL,
  CATALOG_SEARCH_CHANNEL,
  CATALOG_UPDATE_PRODUCT_CHANNEL,
  CONSIGNMENTS_CONFIRM_BATCH_CHANNEL,
  CONSIGNMENTS_DETAIL_CHANNEL,
  CONSIGNMENTS_EXPORT_EXCEL_CHANNEL,
  CONSIGNMENTS_HISTORY_LIST_CHANNEL,
  CONSIGNMENTS_PENDING_LIST_CHANNEL,
  SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL,
  SALES_CANCEL_CHANNEL,
  SALES_CANCEL_PAYMENT_CHANNEL,
  SALES_CONFIRM_DRAFT_CHANNEL,
  SALES_DETAIL_CHANNEL,
  SALES_HISTORY_LIST_CHANNEL,
  SALES_REGISTER_PAYMENT_CHANNEL,
  STOCK_SAVE_INTAKE_CHANNEL,
  type AppBridge
} from '../shared/contracts/app';

const appBridge: AppBridge = {
  health: () => ipcRenderer.invoke(APP_HEALTH_CHANNEL, APP_HEALTH_REQUEST),
  catalog: {
    list: (request) => ipcRenderer.invoke(CATALOG_LIST_CHANNEL, request ?? {}),
    getProductDetail: (request) => ipcRenderer.invoke(CATALOG_PRODUCT_DETAIL_CHANNEL, request),
    search: (request) => ipcRenderer.invoke(CATALOG_SEARCH_CHANNEL, request),
    updateProduct: (request) => ipcRenderer.invoke(CATALOG_UPDATE_PRODUCT_CHANNEL, request),
    deleteProduct: (request) => ipcRenderer.invoke(CATALOG_DELETE_PRODUCT_CHANNEL, request)
  },
  stock: {
    saveIntake: (request) => ipcRenderer.invoke(STOCK_SAVE_INTAKE_CHANNEL, request)
  },
  sales: {
    listHistory: (request) => ipcRenderer.invoke(SALES_HISTORY_LIST_CHANNEL, request ?? {}),
    getById: (request) => ipcRenderer.invoke(SALES_DETAIL_CHANNEL, request),
    confirmDraft: (request) => ipcRenderer.invoke(SALES_CONFIRM_DRAFT_CHANNEL, request),
    registerPayment: (request) => ipcRenderer.invoke(SALES_REGISTER_PAYMENT_CHANNEL, request),
    cancelPayment: (request) => ipcRenderer.invoke(SALES_CANCEL_PAYMENT_CHANNEL, request),
    assignCustomerForPaymentRecovery: (request) =>
      ipcRenderer.invoke(SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL, request),
    cancelSale: (request) => ipcRenderer.invoke(SALES_CANCEL_CHANNEL, request)
  },
  consignments: {
    listPendingItems: (request) => ipcRenderer.invoke(CONSIGNMENTS_PENDING_LIST_CHANNEL, request ?? {}),
    confirmBatch: (request) => ipcRenderer.invoke(CONSIGNMENTS_CONFIRM_BATCH_CHANNEL, request),
    listBatchHistory: (request) => ipcRenderer.invoke(CONSIGNMENTS_HISTORY_LIST_CHANNEL, request ?? {}),
    getBatchDetail: (request) => ipcRenderer.invoke(CONSIGNMENTS_DETAIL_CHANNEL, request),
    exportBatchExcel: (request) => ipcRenderer.invoke(CONSIGNMENTS_EXPORT_EXCEL_CHANNEL, request)
  }
};

contextBridge.exposeInMainWorld('app', appBridge);
