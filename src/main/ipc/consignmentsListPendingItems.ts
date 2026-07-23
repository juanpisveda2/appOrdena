import { CONSIGNMENTS_PENDING_LIST_CHANNEL } from '../../shared/contracts/app';
import type { PendingConsignmentItem } from '../../shared/contracts/consignments';
import { listPendingConsignmentItemsRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import { listPendingConsignmentItems } from '../services/consignments/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createConsignmentsListPendingItemsChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof listPendingConsignmentItemsRequestSchema, PendingConsignmentItem[]> {
  return {
    channel: CONSIGNMENTS_PENDING_LIST_CHANNEL,
    requestSchema: listPendingConsignmentItemsRequestSchema,
    handle: (payload) => listPendingConsignmentItems(database, payload)
  };
}
