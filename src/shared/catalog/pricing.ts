import type { ReusableProductCategory } from '../contracts/catalog';

export const DEFAULT_PERSONALIZATION_BASIS_POINTS = 500;

export interface PricingSummaryInput {
  cashPriceCents: number;
  listPriceCents: number;
  profitPercentageBasisPoints: number;
  personalizationAmountCents?: number | null;
  personalizationPercentageBasisPoints?: number | null;
}

export interface PricingSummary {
  cashExpectedProfitCents: number;
  listExpectedProfitCents: number;
  personalizationPercentageBasisPoints: number | null;
  personalizationExpectedProfitCents: number | null;
  cashTotalExpectedProfitCents: number;
  listTotalExpectedProfitCents: number;
}

export function calculateExpectedProfitCents(amountCents: number, basisPoints: number): number {
  return Math.round((amountCents * basisPoints) / 10_000);
}

export function calculateSuggestedPriceCents(
  supplierUnitCostCents: number,
  profitPercentageBasisPoints: number
): number {
  return supplierUnitCostCents + calculateExpectedProfitCents(supplierUnitCostCents, profitPercentageBasisPoints);
}

export function isPersonalizationAllowed(category: ReusableProductCategory): boolean {
  return category === 'jewelry' || category === 'mate';
}

export function calculatePricingSummary({
  cashPriceCents,
  listPriceCents,
  profitPercentageBasisPoints,
  personalizationAmountCents,
  personalizationPercentageBasisPoints
}: PricingSummaryInput): PricingSummary {
  const cashExpectedProfitCents = calculateExpectedProfitCents(cashPriceCents, profitPercentageBasisPoints);
  const listExpectedProfitCents = calculateExpectedProfitCents(listPriceCents, profitPercentageBasisPoints);

  if (personalizationAmountCents == null) {
    return {
      cashExpectedProfitCents,
      listExpectedProfitCents,
      personalizationPercentageBasisPoints: null,
      personalizationExpectedProfitCents: null,
      cashTotalExpectedProfitCents: cashExpectedProfitCents,
      listTotalExpectedProfitCents: listExpectedProfitCents
    };
  }

  const resolvedPersonalizationBasisPoints =
    personalizationPercentageBasisPoints ?? DEFAULT_PERSONALIZATION_BASIS_POINTS;
  const personalizationExpectedProfitCents = calculateExpectedProfitCents(
    personalizationAmountCents,
    resolvedPersonalizationBasisPoints
  );

  return {
    cashExpectedProfitCents,
    listExpectedProfitCents,
    personalizationPercentageBasisPoints: resolvedPersonalizationBasisPoints,
    personalizationExpectedProfitCents,
    cashTotalExpectedProfitCents: cashExpectedProfitCents + personalizationExpectedProfitCents,
    listTotalExpectedProfitCents: listExpectedProfitCents + personalizationExpectedProfitCents
  };
}
