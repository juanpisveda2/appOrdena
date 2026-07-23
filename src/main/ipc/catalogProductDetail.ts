import { CATALOG_PRODUCT_DETAIL_CHANNEL } from '../../shared/contracts/app';
import type { CatalogProductDetail } from '../../shared/contracts/catalog';
import { catalogProductDetailRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { getCatalogProductDetail } from '../catalog/repository';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createCatalogProductDetailChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof catalogProductDetailRequestSchema, CatalogProductDetail> {
  return {
    channel: CATALOG_PRODUCT_DETAIL_CHANNEL,
    requestSchema: catalogProductDetailRequestSchema,
    handle: ({ reusableProductId, recentIntakesLimit }) =>
      getCatalogProductDetail(database, reusableProductId, recentIntakesLimit)
  };
}
