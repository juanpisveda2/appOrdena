export const initialSchemaMigration = {
  version: 1,
  name: 'v001_initial_schema',
  sql: `
    PRAGMA application_id = 0x4F52444E;

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_metadata (key, value)
    VALUES ('app_id', 'ordena');
  `
} as const;
