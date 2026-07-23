import { CATALOG_LIST_CHANNEL } from '../../shared/contracts/app';
import type { CatalogListResult } from '../../shared/contracts/catalog';
import { catalogListRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { listCatalogProducts } from '../catalog/repository';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createCatalogListChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof catalogListRequestSchema, CatalogListResult> {
  return {
    channel: CATALOG_LIST_CHANNEL,
    requestSchema: catalogListRequestSchema,
    handle: ({ query, category, limit, recentLimit }) =>
      listCatalogProducts(database, { query, category, limit, recentLimit })
  };
}
