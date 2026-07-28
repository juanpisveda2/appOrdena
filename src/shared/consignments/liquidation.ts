import type { SaleStatus } from '../contracts/sales';

export interface ConsignmentLiquidationSourceItem {
  saleItemId: number;
  saleId: number;
  saleStatus?: SaleStatus;
  salePaidCents?: number;
  supplierTotalToLiquidateCents: number;
  liquidatedPreviouslyCents: number;
}

export interface ConsignmentLiquidationAllocationItem extends ConsignmentLiquidationSourceItem {
  remainingBalanceCents: number;
  amountDueNowCents: number;
}

export interface ConsignmentLiquidationSummary {
  count: number;
  totalDueNowCents: number;
  totalRemainingBalanceCents: number;
  totalSupplierAmountCents: number;
  items: ConsignmentLiquidationAllocationItem[];
}

export interface ConsignmentBatchGainInput {
  supplierTotalToLiquidateCents: number;
  liquidatedPreviouslyCents: number;
  amountToLiquidateCents: number;
  productHistoricalGainCents: number;
  personalizationHistoricalGainCents: number;
}

export interface ConsignmentBatchGainAllocation {
  productGainCents: number;
  personalizationGainCents: number;
  gainCents: number;
}

export function summarizeConsignmentLiquidationSelection(
  sourceItems: ConsignmentLiquidationSourceItem[],
  selectedSaleItemIds: number[]
): ConsignmentLiquidationSummary {
  const selectedIds = new Set(selectedSaleItemIds);
  const groupedBySaleId = new Map<number, ConsignmentLiquidationSourceItem[]>();

  sourceItems.forEach((item) => {
    const current = groupedBySaleId.get(item.saleId) ?? [];
    current.push(item);
    groupedBySaleId.set(item.saleId, current);
  });

  const selectedItems: ConsignmentLiquidationAllocationItem[] = [];

  groupedBySaleId.forEach((saleItems) => {
    const allocationPlan = allocateSaleLiquidationAmounts(saleItems);

    allocationPlan.forEach((item) => {
      if (selectedIds.has(item.saleItemId)) {
        selectedItems.push(item);
      }
    });
  });

  return {
    count: selectedItems.length,
    totalDueNowCents: selectedItems.reduce((sum, item) => sum + item.amountDueNowCents, 0),
    totalRemainingBalanceCents: selectedItems.reduce((sum, item) => sum + item.remainingBalanceCents, 0),
    totalSupplierAmountCents: selectedItems.reduce((sum, item) => sum + item.supplierTotalToLiquidateCents, 0),
    items: selectedItems
  };
}

export function allocateSaleLiquidationAmounts(
  saleItems: ConsignmentLiquidationSourceItem[]
): ConsignmentLiquidationAllocationItem[] {
  if (saleItems.length === 0) {
    return [];
  }

  const saleStatus = saleItems[0]?.saleStatus;
  const salePaidCents = saleItems[0]?.salePaidCents ?? 0;
  const totalSupplierAmountCents = saleItems.reduce(
    (sum, item) => sum + item.supplierTotalToLiquidateCents,
    0
  );
  const totalPreviouslyLiquidatedCents = saleItems.reduce((sum, item) => sum + item.liquidatedPreviouslyCents, 0);
  const totalRemainingBalanceCents = saleItems.reduce(
    (sum, item) => sum + Math.max(item.supplierTotalToLiquidateCents - item.liquidatedPreviouslyCents, 0),
    0
  );

  let availableBudgetCents = totalRemainingBalanceCents;

  if (saleStatus === 'partial_payment') {
    availableBudgetCents = Math.max(0, salePaidCents - totalPreviouslyLiquidatedCents);
    availableBudgetCents = Math.min(availableBudgetCents, totalRemainingBalanceCents);
  }

  if (availableBudgetCents >= totalRemainingBalanceCents || totalSupplierAmountCents <= 0) {
    return saleItems.map((item) => ({
      ...item,
      remainingBalanceCents: Math.max(item.supplierTotalToLiquidateCents - item.liquidatedPreviouslyCents, 0),
      amountDueNowCents: Math.max(item.supplierTotalToLiquidateCents - item.liquidatedPreviouslyCents, 0)
    }));
  }

  const allocations = saleItems.map((item) => ({
    ...item,
    remainingBalanceCents: Math.max(item.supplierTotalToLiquidateCents - item.liquidatedPreviouslyCents, 0),
    amountDueNowCents: 0
  }));
  let remainingBudget = availableBudgetCents;
  const totalRemaining = allocations.reduce((sum, item) => sum + item.remainingBalanceCents, 0);

  allocations.forEach((item) => {
    if (remainingBudget <= 0 || totalRemaining <= 0) {
      return;
    }

    const tentative = Math.floor((item.remainingBalanceCents * availableBudgetCents) / totalRemaining);
    const amount = Math.min(tentative, item.remainingBalanceCents, remainingBudget);

    item.amountDueNowCents = amount;
    remainingBudget -= amount;
  });

  if (remainingBudget > 0) {
    for (const item of allocations) {
      if (remainingBudget <= 0) {
        break;
      }

      const cap = item.remainingBalanceCents - item.amountDueNowCents;
      if (cap <= 0) {
        continue;
      }

      const extra = Math.min(cap, remainingBudget);
      item.amountDueNowCents += extra;
      remainingBudget -= extra;
    }
  }

  return allocations;
}

export function allocateConsignmentBatchGain(
  input: ConsignmentBatchGainInput
): ConsignmentBatchGainAllocation {
  const productGainCents = allocateCumulativeSlice(
    input.productHistoricalGainCents,
    input.supplierTotalToLiquidateCents,
    input.liquidatedPreviouslyCents,
    input.amountToLiquidateCents
  );
  const personalizationGainCents = allocateCumulativeSlice(
    input.personalizationHistoricalGainCents,
    input.supplierTotalToLiquidateCents,
    input.liquidatedPreviouslyCents,
    input.amountToLiquidateCents
  );

  return {
    productGainCents,
    personalizationGainCents,
    gainCents: productGainCents + personalizationGainCents
  };
}

function allocateCumulativeSlice(
  totalGainCents: number,
  supplierTotalToLiquidateCents: number,
  liquidatedPreviouslyCents: number,
  amountToLiquidateCents: number
): number {
  if (totalGainCents <= 0 || supplierTotalToLiquidateCents <= 0 || amountToLiquidateCents <= 0) {
    return 0;
  }

  const previousAllocatedGain = Math.trunc(
    (totalGainCents * Math.min(liquidatedPreviouslyCents, supplierTotalToLiquidateCents)) / supplierTotalToLiquidateCents
  );
  const nextLiquidatedTotalCents = Math.min(
    liquidatedPreviouslyCents + amountToLiquidateCents,
    supplierTotalToLiquidateCents
  );
  const nextAllocatedGain = Math.trunc(
    (totalGainCents * nextLiquidatedTotalCents) / supplierTotalToLiquidateCents
  );

  return Math.max(nextAllocatedGain - previousAllocatedGain, 0);
}

export function calculateSupplierLiquidationTotalCents(
  soldAmountCents: number,
  productHistoricalGainCents: number,
  totalHistoricalGainCents: number
): number {
  const applicableGainCents = Math.max(totalHistoricalGainCents, productHistoricalGainCents, 0);

  return Math.max(soldAmountCents - applicableGainCents, 0);
}
