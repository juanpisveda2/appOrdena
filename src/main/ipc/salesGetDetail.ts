import { SALES_DETAIL_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { getSaleDetailRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { getSaleDetail } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesGetDetailChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof getSaleDetailRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_DETAIL_CHANNEL,
    requestSchema: getSaleDetailRequestSchema,
    handle: (payload) => getSaleDetail(database, payload)
  };
}
