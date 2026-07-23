import type { ReusableProductCategory } from '../contracts/catalog';

export const DEFAULT_PERSONALIZATION_BASIS_POINTS = 500;

export interface PricingSummaryInput {
  supplierUnitCostCents: number;
  profitPercentageBasisPoints: number;
  personalizationAmountCents?: number | null;
  personalizationPercentageBasisPoints?: number | null;
}

export interface PricingSummary {
  expectedProfitCents: number;
  suggestedPriceCents: number;
  personalizationPercentageBasisPoints: number | null;
  personalizationExpectedProfitCents: number | null;
  totalExpectedProfitCents: number;
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
  supplierUnitCostCents,
  profitPercentageBasisPoints,
  personalizationAmountCents,
  personalizationPercentageBasisPoints
}: PricingSummaryInput): PricingSummary {
  const expectedProfitCents = calculateExpectedProfitCents(
    supplierUnitCostCents,
    profitPercentageBasisPoints
  );
  const suggestedPriceCents = supplierUnitCostCents + expectedProfitCents;

  if (personalizationAmountCents == null) {
    return {
      expectedProfitCents,
      suggestedPriceCents,
      personalizationPercentageBasisPoints: null,
      personalizationExpectedProfitCents: null,
      totalExpectedProfitCents: expectedProfitCents
    };
  }

  const resolvedPersonalizationBasisPoints =
    personalizationPercentageBasisPoints ?? DEFAULT_PERSONALIZATION_BASIS_POINTS;
  const personalizationExpectedProfitCents = calculateExpectedProfitCents(
    personalizationAmountCents,
    resolvedPersonalizationBasisPoints
  );

  return {
    expectedProfitCents,
    suggestedPriceCents,
    personalizationPercentageBasisPoints: resolvedPersonalizationBasisPoints,
    personalizationExpectedProfitCents,
    totalExpectedProfitCents: expectedProfitCents + personalizationExpectedProfitCents
  };
}
