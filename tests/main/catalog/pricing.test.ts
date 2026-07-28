import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERSONALIZATION_BASIS_POINTS,
  calculateExpectedProfitCents,
  calculatePricingSummary,
  calculateSuggestedPriceCents,
  isPersonalizationAllowed
} from '../../../src/shared/catalog/pricing';

describe('catalog pricing helpers', () => {
  it('calculates expected profit and suggested price from basis points', () => {
    expect(calculateExpectedProfitCents(100_000, 1_000)).toBe(10_000);
    expect(calculateSuggestedPriceCents(100_000, 1_000)).toBe(110_000);
  });

  it('defaults personalization profit to five percent and keeps it separate', () => {
    expect(
      calculatePricingSummary({
        cashPriceCents: 110_000,
        listPriceCents: 120_000,
        profitPercentageBasisPoints: 1_000,
        personalizationAmountCents: 5_000
      })
    ).toEqual({
      cashExpectedProfitCents: 11_000,
      listExpectedProfitCents: 12_000,
      personalizationPercentageBasisPoints: DEFAULT_PERSONALIZATION_BASIS_POINTS,
      personalizationExpectedProfitCents: 250,
      cashTotalExpectedProfitCents: 11_250,
      listTotalExpectedProfitCents: 12_250
    });
  });

  it('only allows personalization for jewelry and mate products', () => {
    expect(isPersonalizationAllowed('jewelry')).toBe(true);
    expect(isPersonalizationAllowed('mate')).toBe(true);
    expect(isPersonalizationAllowed('clothing')).toBe(false);
  });
});
