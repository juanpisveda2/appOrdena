export const REUSABLE_PRODUCT_CATEGORIES = ['jewelry', 'mate', 'clothing'] as const;

export type ReusableProductCategory = (typeof REUSABLE_PRODUCT_CATEGORIES)[number];

export const CATALOG_CATEGORY_FILTERS = ['all', ...REUSABLE_PRODUCT_CATEGORIES] as const;

export type CatalogCategoryFilter = (typeof CATALOG_CATEGORY_FILTERS)[number];

export interface CatalogSearchRequest {
  query: string;
  limit?: number;
}

export interface CatalogListRequest {
  query?: string;
  category?: CatalogCategoryFilter;
  limit?: number;
  recentLimit?: number;
}

export interface CatalogSearchResult {
  reusableProductId: number;
  category: ReusableProductCategory;
  name: string;
  material: string;
  variant: string;
  availableQuantity: number;
  isOutOfStock: boolean;
}

export interface CatalogListItem extends CatalogSearchResult {
  currentCashPriceCents: number | null;
  currentListPriceCents: number | null;
}

export interface CatalogListResult {
  recentProducts: CatalogListItem[];
  products: CatalogListItem[];
}

export interface CatalogProductDetailRequest {
  reusableProductId: number;
  recentIntakesLimit?: number;
}

export interface CatalogProductRecentIntake {
  stockIntakeId: number;
  enteredQuantity: number;
  availableQuantity: number;
  supplierUnitCostCents: number;
  cashPriceCents: number;
  listPriceCents: number;
  profitPercentageBasisPoints: number;
  expectedProfitCents: number;
  personalizationAmountCents: number | null;
  personalizationPercentageBasisPoints: number | null;
  personalizationExpectedProfitCents: number | null;
  totalExpectedProfitCents: number;
  intakeDate: string;
  notes: string | null;
}

export interface CatalogProductDetail {
  reusableProductId: number;
  category: ReusableProductCategory;
  name: string;
  description: string | null;
  material: string;
  variant: string;
  availableQuantity: number;
  currentCashPriceCents: number | null;
  currentListPriceCents: number | null;
  currentProfitPercentageBasisPoints: number | null;
  currentExpectedProfitCents: number | null;
  currentPersonalizationExpectedProfitCents: number | null;
  currentTotalExpectedProfitCents: number | null;
  recentIntakes: CatalogProductRecentIntake[];
}

export interface UpdateReusableProductRequest {
  reusableProductId: number;
  product: NewReusableProductInput;
}

export interface UpdateReusableProductResult {
  reusableProductId: number;
}

export interface DeleteReusableProductRequest {
  reusableProductId: number;
}

export interface DeleteReusableProductResult {
  reusableProductId: number;
}

export interface DuplicateCandidate {
  reusableProductId: number;
  category: ReusableProductCategory;
  name: string;
  material: string;
  variant: string;
  availableQuantity: number;
}

export interface NewReusableProductInput {
  category: ReusableProductCategory;
  name: string;
  description?: string | null;
  material: string;
  variant?: string;
}

export interface SaveStockIntakeRequest {
  reusableProductId?: number;
  newReusableProduct?: NewReusableProductInput;
  enteredQuantity: number;
  availableQuantity: number;
  supplierUnitCostCents: number;
  cashPriceCents: number;
  listPriceCents: number;
  profitPercentageBasisPoints: number;
  intakeDate: string;
  notes?: string | null;
  allowDuplicate?: boolean;
}

export interface SavedStockIntakeResult {
  kind: 'saved';
  stockIntakeId: number;
  reusableProductId: number;
}

export interface DuplicateWarningResult {
  kind: 'duplicate-warning';
  matches: DuplicateCandidate[];
}

export type SaveStockIntakeResult = SavedStockIntakeResult | DuplicateWarningResult;
