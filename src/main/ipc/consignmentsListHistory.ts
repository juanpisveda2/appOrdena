import { CONSIGNMENTS_HISTORY_LIST_CHANNEL } from '../../shared/contracts/app';
import type { ConsignmentBatchHistoryListItem } from '../../shared/contracts/consignments';
import { listConsignmentBatchHistoryRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import { listConsignmentBatchHistory } from '../services/consignments/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createConsignmentsListHistoryChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<
  typeof listConsignmentBatchHistoryRequestSchema,
  ConsignmentBatchHistoryListItem[]
> {
  return {
    channel: CONSIGNMENTS_HISTORY_LIST_CHANNEL,
    requestSchema: listConsignmentBatchHistoryRequestSchema,
    handle: (payload) => listConsignmentBatchHistory(database, payload)
  };
}
