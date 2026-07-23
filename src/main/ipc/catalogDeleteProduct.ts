import { CATALOG_DELETE_PRODUCT_CHANNEL } from '../../shared/contracts/app';
import type { DeleteReusableProductResult } from '../../shared/contracts/catalog';
import { deleteReusableProductRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { deleteReusableProductRecord } from '../catalog/repository';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createCatalogDeleteProductChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof deleteReusableProductRequestSchema, DeleteReusableProductResult> {
  return {
    channel: CATALOG_DELETE_PRODUCT_CHANNEL,
    requestSchema: deleteReusableProductRequestSchema,
    handle: ({ reusableProductId }) => deleteReusableProductRecord(database, reusableProductId)
  };
}
