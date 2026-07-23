import { eq } from 'drizzle-orm';
import type {
  CatalogCategoryFilter,
  CatalogListItem,
  CatalogListResult,
  CatalogProductDetail,
  CatalogProductRecentIntake,
  CatalogSearchResult,
  DeleteReusableProductResult,
  DuplicateCandidate,
  NewReusableProductInput,
  ReusableProductCategory,
  UpdateReusableProductResult
} from '../../shared/contracts/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { reusableProductsTable } from '../db/schema';
import { normalizeReusableProductIdentity, tokenizeSearchQuery } from './normalize';

interface SearchRow {
  reusableProductId: number;
  category: ReusableProductCategory;
  name: string;
  material: string;
  variant: string;
  availableQuantity: number;
}

interface CatalogListRow extends SearchRow {
  currentCashPriceCents: number | null;
  currentListPriceCents: number | null;
}

interface ProductDetailRow {
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
}

interface ProductRecentIntakeRow {
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
  intakeDate: string;
  notes: string | null;
}

interface DuplicateRow extends SearchRow {}

function mapCatalogListRow(row: CatalogListRow): CatalogListItem {
  return {
    ...row,
    isOutOfStock: row.availableQuantity === 0
  };
}

function trimMaterial(material: string): string {
  return material.trim();
}

function buildCategoryClause(category: CatalogCategoryFilter): {
  clause: string;
  parameters: Array<string | number>;
} {
  if (category === 'all') {
    return {
      clause: '',
      parameters: []
    };
  }

  return {
    clause: 'rp.category = ?',
    parameters: [category]
  };
}

function buildSearchClause(query: string): {
  clause: string;
  parameters: Array<string | number>;
} {
  const tokens = tokenizeSearchQuery(query);

  if (tokens.length === 0) {
    return {
      clause: '',
      parameters: []
    };
  }

  return {
    clause: tokens.map(() => 'rp.search_text_normalized LIKE ?').join(' AND '),
    parameters: tokens.map((token) => `%${token}%`)
  };
}

function combineWhereClauses(...clauses: string[]): string {
  const activeClauses = clauses.filter((clause) => clause.length > 0);

  return activeClauses.length > 0 ? `WHERE ${activeClauses.join(' AND ')}` : '';
}

const ACTIVE_PRODUCT_CLAUSE = 'rp.deleted_at IS NULL';

export interface CreateReusableProductRecordInput extends NewReusableProductInput {
  now?: string;
}

export function createReusableProductRecord(
  database: SqliteDatabaseLike,
  product: CreateReusableProductRecordInput
): number {
  const normalized = normalizeReusableProductIdentity(product);
  const now = product.now ?? new Date().toISOString();
  const variant = product.variant ?? '';
  const description = product.description?.trim() || null;
  const statement = database.client.prepare(
    `
      INSERT INTO reusable_products (
        category,
        name,
        description,
        material,
        variant,
        search_text_normalized,
        duplicate_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const result = statement.run(
    product.category,
    product.name.trim(),
    description,
    trimMaterial(product.material),
    variant.trim(),
    normalized.searchTextNormalized,
    normalized.duplicateKey,
    now,
    now
  );

  return Number(result.lastInsertRowid);
}

export function updateReusableProductRecord(
  database: SqliteDatabaseLike,
  reusableProductId: number,
  product: NewReusableProductInput
): UpdateReusableProductResult {
  const normalized = normalizeReusableProductIdentity(product);
  const now = new Date().toISOString();
  const result = database.client
    .prepare(
      `
        UPDATE reusable_products
        SET category = ?,
            name = ?,
            description = ?,
            material = ?,
            variant = ?,
            search_text_normalized = ?,
            duplicate_key = ?,
            updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .run(
      product.category,
      product.name.trim(),
      product.description?.trim() || null,
      trimMaterial(product.material),
      product.variant?.trim() ?? '',
      normalized.searchTextNormalized,
      normalized.duplicateKey,
      now,
      reusableProductId
    );

  if (result.changes === 0) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }

  return { reusableProductId };
}

export function findDuplicateReusableProducts(
  database: SqliteDatabaseLike,
  product: NewReusableProductInput
): DuplicateCandidate[] {
  const normalized = normalizeReusableProductIdentity(product);
  const statement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
      WHERE rp.duplicate_key = ? AND rp.deleted_at IS NULL
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC
    `
  );

  return statement.all(normalized.duplicateKey) as DuplicateRow[];
}

export function searchReusableProducts(
  database: SqliteDatabaseLike,
  query: string,
  limit = 20
): CatalogSearchResult[] {
  const tokens = tokenizeSearchQuery(query);

  if (tokens.length === 0) {
    return [];
  }

  const whereClauses = [ACTIVE_PRODUCT_CLAUSE, ...tokens.map(() => 'rp.search_text_normalized LIKE ?')].join(' AND ');
  const parameters = tokens.map((token) => `%${token}%`);
  const statement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
      WHERE ${whereClauses}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC
      LIMIT ?
    `
  );
  const rows = statement.all(...parameters, limit) as SearchRow[];

  return rows.map((row) => ({
    ...row,
    isOutOfStock: row.availableQuantity === 0
  }));
}

export function listCatalogProducts(
  database: SqliteDatabaseLike,
  {
    query = '',
    category = 'all',
    limit = 200,
    recentLimit = 6
  }: {
    query?: string;
    category?: CatalogCategoryFilter;
    limit?: number;
    recentLimit?: number;
  } = {}
): CatalogListResult {
  const searchFilter = buildSearchClause(query);
  const categoryFilter = buildCategoryClause(category);
  const catalogWhere = combineWhereClauses(ACTIVE_PRODUCT_CLAUSE, searchFilter.clause, categoryFilter.clause);
  const recentWhere = combineWhereClauses(ACTIVE_PRODUCT_CLAUSE, categoryFilter.clause);
  const sharedSelect = `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity,
        (
          SELECT si_latest.cash_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentCashPriceCents,
        (
          SELECT si_latest.list_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentListPriceCents
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
    `;

  const productsStatement = database.client.prepare(
    `
      ${sharedSelect}
      ${catalogWhere}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC, rp.id ASC
      LIMIT ?
    `
  );
  const recentProductsStatement = database.client.prepare(
    `
      ${sharedSelect}
      ${recentWhere}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.created_at DESC, rp.id DESC
      LIMIT ?
    `
  );
  const products = productsStatement.all(
    ...searchFilter.parameters,
    ...categoryFilter.parameters,
    limit
  ) as CatalogListRow[];
  const recentProducts = recentProductsStatement.all(
    ...categoryFilter.parameters,
    recentLimit
  ) as CatalogListRow[];

  return {
    recentProducts: recentProducts.map(mapCatalogListRow),
    products: products.map(mapCatalogListRow)
  };
}

export function getCatalogProductDetail(
  database: SqliteDatabaseLike,
  reusableProductId: number,
  recentIntakesLimit = 5
): CatalogProductDetail {
  const detailStatement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.description AS description,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity,
        (
          SELECT si_latest.cash_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentCashPriceCents,
        (
          SELECT si_latest.list_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentListPriceCents,
        (
          SELECT si_latest.profit_percentage_basis_points
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentProfitPercentageBasisPoints,
        (
          SELECT si_latest.expected_profit_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentExpectedProfitCents,
        (
          SELECT si_latest.personalization_expected_profit_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentPersonalizationExpectedProfitCents
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
       WHERE rp.id = ? AND rp.deleted_at IS NULL
      GROUP BY rp.id, rp.category, rp.name, rp.description, rp.material, rp.variant
      LIMIT 1
    `
  );
  const detailRow = detailStatement.get(reusableProductId) as ProductDetailRow | undefined;

  if (!detailRow) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }

  const recentIntakesStatement = database.client.prepare(
    `
      SELECT
        si.id AS stockIntakeId,
        si.entered_quantity AS enteredQuantity,
        si.available_quantity AS availableQuantity,
        si.supplier_unit_cost_cents AS supplierUnitCostCents,
        si.cash_price_cents AS cashPriceCents,
        si.list_price_cents AS listPriceCents,
        si.profit_percentage_basis_points AS profitPercentageBasisPoints,
        si.expected_profit_cents AS expectedProfitCents,
        si.personalization_amount_cents AS personalizationAmountCents,
        si.personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
        si.personalization_expected_profit_cents AS personalizationExpectedProfitCents,
        si.intake_date AS intakeDate,
        si.notes AS notes
      FROM stock_intakes si
      WHERE si.reusable_product_id = ?
      ORDER BY si.intake_date DESC, si.id DESC
      LIMIT ?
    `
  );
  const recentIntakeRows = recentIntakesStatement.all(
    reusableProductId,
    recentIntakesLimit
  ) as ProductRecentIntakeRow[];
  const recentIntakes: CatalogProductRecentIntake[] = recentIntakeRows.map((row) => ({
    ...row,
    totalExpectedProfitCents:
      row.expectedProfitCents + (row.personalizationExpectedProfitCents ?? 0)
  }));

  return {
    ...detailRow,
    currentTotalExpectedProfitCents:
      detailRow.currentExpectedProfitCents == null
        ? null
        : detailRow.currentExpectedProfitCents + (detailRow.currentPersonalizationExpectedProfitCents ?? 0),
    recentIntakes
  };
}

export function assertReusableProductExists(
  database: SqliteDatabaseLike,
  reusableProductId: number
): { id: number; category: ReusableProductCategory } {
  const reusableProduct = database.orm
    .select({
      id: reusableProductsTable.id,
      category: reusableProductsTable.category,
      deletedAt: reusableProductsTable.deletedAt
    })
    .from(reusableProductsTable)
    .where(eq(reusableProductsTable.id, reusableProductId))
    .get();

  if (!reusableProduct || reusableProduct.deletedAt != null) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }

  return {
    id: reusableProduct.id,
    category: reusableProduct.category as ReusableProductCategory
  };
}

export function deleteReusableProductRecord(
  database: SqliteDatabaseLike,
  reusableProductId: number
): DeleteReusableProductResult {
  const deletedAt = new Date().toISOString();
  const result = database.client
    .prepare(
      `
        UPDATE reusable_products
        SET deleted_at = ?,
            updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .run(deletedAt, deletedAt, reusableProductId);

  if (result.changes === 0) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }

  return { reusableProductId };
}
