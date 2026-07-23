import { CATALOG_SEARCH_CHANNEL } from '../../shared/contracts/app';
import type { CatalogSearchResult } from '../../shared/contracts/catalog';
import { catalogSearchRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { searchReusableProducts } from '../catalog/repository';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createCatalogSearchChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof catalogSearchRequestSchema, CatalogSearchResult[]> {
  return {
    channel: CATALOG_SEARCH_CHANNEL,
    requestSchema: catalogSearchRequestSchema,
    handle: ({ query, limit }) => searchReusableProducts(database, query, limit)
  };
}
