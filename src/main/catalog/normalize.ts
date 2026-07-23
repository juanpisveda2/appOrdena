import type { NewReusableProductInput } from '../../shared/contracts/catalog';

export interface NormalizedReusableProductIdentity {
  normalizedCategory: string;
  normalizedName: string;
  normalizedMaterial: string;
  normalizedVariant: string;
  searchTextNormalized: string;
  duplicateKey: string;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(' ')
    .filter((token) => token.length > 0);
}

function collapseSpacing(value: string): string {
  return value.replace(/\s+/g, '');
}

export function normalizeReusableProductIdentity(
  product: Pick<NewReusableProductInput, 'category' | 'name' | 'material' | 'variant'>
): NormalizedReusableProductIdentity {
  const normalizedCategory = normalizeSearchText(product.category);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedMaterial = normalizeSearchText(product.material);
  const normalizedVariant = normalizeSearchText(product.variant ?? '');
  const searchAliases = Array.from(
    new Set([
      normalizedCategory,
      normalizedName,
      normalizedMaterial,
      normalizedVariant,
      collapseSpacing(normalizedCategory),
      collapseSpacing(normalizedName),
      collapseSpacing(normalizedMaterial),
      collapseSpacing(normalizedVariant)
    ].filter((value) => value.length > 0))
  );

  return {
    normalizedCategory,
    normalizedName,
    normalizedMaterial,
    normalizedVariant,
    searchTextNormalized: searchAliases.join(' '),
    duplicateKey: [normalizedCategory, normalizedName, normalizedMaterial, normalizedVariant]
      .map(collapseSpacing)
      .join('|')
  };
}
