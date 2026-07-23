export const catalogSoftDeleteMigration = {
  version: 5,
  name: 'v005_catalog_soft_delete',
  sql: `
    ALTER TABLE reusable_products ADD COLUMN deleted_at TEXT;
  `
} as const;
