const { existsSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { dirname, join, resolve } = require('node:path');

const DATABASE_FILE_NAME = 'ordena.sqlite';
const CURRENT_SCHEMA_VERSION = 12;
const ROOT = resolve(__dirname, '..');
const migrationFiles = [
  'src/main/db/migrations/v001_initialSchema.ts',
  'src/main/db/migrations/v002_catalogStock.ts',
  'src/main/db/migrations/v003_salesCore.ts',
  'src/main/db/migrations/v004_consignmentsCore.ts',
  'src/main/db/migrations/v005_catalogSoftDelete.ts',
  'src/main/db/migrations/v006_consignmentBatchGain.ts',
  'src/main/db/migrations/v007_historicalSnapshotsReset.ts',
  'src/main/db/migrations/v008_saleItemPersonalizationSnapshots.ts',
  'src/main/db/migrations/v009_partialConsignmentLiquidations.ts',
  'src/main/db/migrations/v010_profitRuleByPriceBase.ts',
  'src/main/db/migrations/v011_consignmentLiquidationSnapshots.ts',
  'src/main/db/migrations/v012_appBrandingMetadata.ts'
].map((file) => join(ROOT, file));

const databaseFilePath = resolve(
  process.argv[2] ||
    process.env.ORDENA_DB_PATH ||
    process.env.PROJECT_MAMA_DB_PATH ||
    join(process.env.APPDATA || process.cwd(), 'Ordena Dev', DATABASE_FILE_NAME)
);

prepareNativeModuleForNode();

const BetterSqlite3 = require('better-sqlite3');

mkdirSync(dirname(databaseFilePath), { recursive: true });

if (existsSync(databaseFilePath)) {
  rmSync(databaseFilePath, { force: true });
}

const database = new BetterSqlite3(databaseFilePath);

try {
  database.exec('BEGIN IMMEDIATE');

  for (const filePath of migrationFiles) {
    database.exec(extractSql(filePath));
  }

  database.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  database.exec('COMMIT');

  process.stdout.write(`Reset database and applied schema v${CURRENT_SCHEMA_VERSION}: ${databaseFilePath}\n`);
} catch (error) {
  try {
    database.exec('ROLLBACK');
  } catch {}

  throw error;
} finally {
  database.close();
}

function extractSql(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const match = source.match(/sql:\s*`([\s\S]*?)`\s*}/);

  if (!match) {
    throw new Error(`Could not extract SQL from ${filePath}`);
  }

  return match[1];
}

function prepareNativeModuleForNode() {
  const result = spawnSync(process.execPath, [join(__dirname, 'prepare-native-module.cjs'), 'node'], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
