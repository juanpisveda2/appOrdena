import type { SalePriceType } from '../../shared/contracts/sales';

export interface GainDisplayEntry {
  label: string;
  amountCents: number;
}

interface GainDisplayInput {
  baseGainCents: number | null;
  personalizationGainCents: number | null;
  totalGainCents: number | null;
  priceType?: SalePriceType;
  baseLabel?: string;
}

export function getPriceTypeGainLabel(priceType: SalePriceType): string {
  return priceType === 'cash' ? 'Ganancia por contado' : 'Ganancia por lista';
}

export function hasPersonalizationGain(personalizationGainCents: number | null | undefined): boolean {
  return (personalizationGainCents ?? 0) > 0;
}

export function buildGainDisplayEntries({
  baseGainCents,
  personalizationGainCents,
  totalGainCents,
  priceType,
  baseLabel
}: GainDisplayInput): GainDisplayEntry[] {
  const resolvedBaseLabel = priceType ? getPriceTypeGainLabel(priceType) : (baseLabel ?? 'Ganancia producto');
  const showTotal = hasPersonalizationGain(personalizationGainCents);
  const primaryAmountCents = showTotal ? baseGainCents : (totalGainCents ?? baseGainCents);

  if (primaryAmountCents == null) {
    return [];
  }

  const entries: GainDisplayEntry[] = [{ label: resolvedBaseLabel, amountCents: primaryAmountCents }];

  if (!showTotal) {
    return entries;
  }

  entries.push({ label: 'Ganancia personalización', amountCents: personalizationGainCents ?? 0 });
  entries.push({
    label: 'Ganancia total',
    amountCents: totalGainCents ?? primaryAmountCents + (personalizationGainCents ?? 0)
  });

  return entries;
}
