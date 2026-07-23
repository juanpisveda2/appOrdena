import { SALES_CANCEL_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { cancelSaleRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { cancelSale } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesCancelChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof cancelSaleRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_CANCEL_CHANNEL,
    requestSchema: cancelSaleRequestSchema,
    handle: (payload) => cancelSale(database, payload)
  };
}
