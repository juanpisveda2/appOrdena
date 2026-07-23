import { describe, expect, it } from 'vitest';
import {
  normalizeReusableProductIdentity,
  normalizeSearchText,
  tokenizeSearchQuery
} from '../../../src/main/catalog/normalize';

describe('catalog normalization', () => {
  it('normalizes accents, spacing, and punctuation for matching', () => {
    expect(normalizeSearchText('  Árós---de   Pláta  ')).toBe('aros de plata');
    expect(tokenizeSearchQuery('aros plata')).toEqual(['aros', 'plata']);
  });

  it('adds spacing-insensitive aliases for search text', () => {
    const normalized = normalizeReusableProductIdentity({
      category: 'jewelry',
      name: 'Aros de plata',
      material: 'Plata',
      variant: '18 mm'
    });

    expect(normalized.searchTextNormalized).toContain('aros de plata');
    expect(normalized.searchTextNormalized).toContain('arosdeplata');
    expect(normalized.searchTextNormalized).toContain('18 mm');
    expect(normalized.searchTextNormalized).toContain('18mm');
  });

  it('builds stable duplicate keys from identifying fields', () => {
    expect(
      normalizeReusableProductIdentity({
        category: 'jewelry',
        name: 'Aros de plata',
        material: 'Plata',
        variant: '  18 mm '
      })
    ).toEqual({
      normalizedCategory: 'jewelry',
      normalizedName: 'aros de plata',
      normalizedMaterial: 'plata',
      normalizedVariant: '18 mm',
      searchTextNormalized: 'jewelry aros de plata plata 18 mm arosdeplata 18mm',
      duplicateKey: 'jewelry|arosdeplata|plata|18mm'
    });
  });
});
