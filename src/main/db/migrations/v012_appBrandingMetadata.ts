export const appBrandingMetadataMigration = {
  version: 12,
  name: 'v012_app_branding_metadata',
  sql: `
    PRAGMA application_id = 0x4F52444E;

    UPDATE app_metadata
    SET value = 'ordena'
    WHERE key = 'app_id';
  `
} as const;
