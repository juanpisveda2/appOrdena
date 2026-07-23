import { SALES_HISTORY_LIST_CHANNEL } from '../../shared/contracts/app';
import type { SalesHistoryListItem } from '../../shared/contracts/sales';
import { listSalesHistoryRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { listSalesHistory } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesListHistoryChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof listSalesHistoryRequestSchema, SalesHistoryListItem[]> {
  return {
    channel: SALES_HISTORY_LIST_CHANNEL,
    requestSchema: listSalesHistoryRequestSchema,
    handle: (payload) => listSalesHistory(database, payload)
  };
}
