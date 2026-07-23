export const SALE_PRICE_TYPES = ['cash', 'list'] as const;
export const SALE_STATUSES = ['pending_payment', 'partial_payment', 'paid', 'cancelled'] as const;
export const SALE_CONSIGNMENT_STATUSES = ['pending_settlement', 'settled'] as const;
export const PAYMENT_METHODS = ['cash', 'bank_transfer'] as const;

export type SalePriceType = (typeof SALE_PRICE_TYPES)[number];
export type SaleStatus = (typeof SALE_STATUSES)[number];
export type SaleConsignmentStatus = (typeof SALE_CONSIGNMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface SaleCustomerInput {
  customerId?: number;
  name?: string;
  phoneText?: string;
  note?: string | null;
}

export interface ConfirmSaleDraftItemInput {
  reusableProductId: number;
  quantity: number;
  priceType: SalePriceType;
  personalizationAmountCents?: number | null;
  personalizationPercentageBasisPoints?: number | null;
}

export interface SalePaymentInput {
  amountCents: number;
  paymentMethod?: PaymentMethod | null;
  note?: string | null;
}

export interface ConfirmSaleDraftRequest {
  customer?: SaleCustomerInput | null;
  draftItems: ConfirmSaleDraftItemInput[];
  initialPayment?: SalePaymentInput | null;
  saleDate?: string;
}

export interface ListSalesHistoryRequest {
  query?: string;
  limit?: number;
}

export interface GetSaleDetailRequest {
  saleId: number;
}

export interface RegisterSalePaymentRequest extends SalePaymentInput {
  saleId: number;
  paymentDate?: string;
}

export interface CancelSalePaymentRequest {
  saleId: number;
  paymentId: number;
  reason: string;
  cancelledAt?: string;
}

export interface AssignSaleCustomerForPaymentRecoveryRequest {
  saleId: number;
  name: string;
  phoneText: string;
}

export interface CancelSaleRequest {
  saleId: number;
  reason: string;
  cancelledAt?: string;
}

export interface SaleCustomerSummary {
  customerId: number | null;
  name: string | null;
  phoneText: string | null;
  note: string | null;
}

export interface SaleItemAllocationSnapshot {
  allocationId: number;
  stockIntakeId: number;
  consumedQuantity: number;
  allocationOrder: number;
  historicalSupplierUnitCostCents: number;
  historicalProfitPercentageBasisPoints: number;
  historicalCashPriceCents: number;
  historicalListPriceCents: number;
  historicalPersonalizationAmountCents: number | null;
  historicalPersonalizationPercentageBasisPoints: number | null;
  historicalPersonalizationExpectedProfitCents: number | null;
}

export interface SaleItemSnapshot {
  saleItemId: number;
  reusableProductId: number;
  productCategory: string;
  productName: string;
  productMaterial: string;
  productVariant: string;
  quantity: number;
  priceType: SalePriceType;
  unitPriceCents: number;
  unitBasePriceCents?: number;
  unitPersonalizationAmountCents?: number | null;
  personalizationPercentageBasisPoints?: number | null;
  lineSubtotalCents: number;
  lineBaseSubtotalCents?: number;
  linePersonalizationSubtotalCents?: number;
  productGainCents?: number;
  personalizationGainCents?: number;
  totalGainCents?: number;
  consignmentStatus: SaleConsignmentStatus;
  allocations: SaleItemAllocationSnapshot[];
}

export interface SalePaymentSnapshot {
  paymentId: number;
  paymentDate: string;
  amountCents: number;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  isActive: boolean;
}

export interface SalesHistoryListItem {
  saleId: number;
  saleNumber: number;
  saleDate: string;
  status: SaleStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  customerName: string | null;
  customerPhoneText: string | null;
  totalProfitCents: number;
}

export interface SaleSnapshot {
  saleId: number;
  saleNumber: number;
  saleDate: string;
  status: SaleStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  cancellationReason: string | null;
  customer: SaleCustomerSummary;
  items: SaleItemSnapshot[];
  payments: SalePaymentSnapshot[];
  totalProductGainCents?: number;
  totalPersonalizationGainCents?: number;
  totalProfitCents: number;
  canRegisterPayment: boolean;
  canCancelSale: boolean;
}
