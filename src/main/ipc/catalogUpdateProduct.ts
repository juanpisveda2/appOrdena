import { CATALOG_UPDATE_PRODUCT_CHANNEL } from '../../shared/contracts/app';
import type { UpdateReusableProductResult } from '../../shared/contracts/catalog';
import { updateReusableProductRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { updateReusableProductRecord } from '../catalog/repository';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createCatalogUpdateProductChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof updateReusableProductRequestSchema, UpdateReusableProductResult> {
  return {
    channel: CATALOG_UPDATE_PRODUCT_CHANNEL,
    requestSchema: updateReusableProductRequestSchema,
    handle: ({ reusableProductId, product }) => updateReusableProductRecord(database, reusableProductId, product)
  };
}
