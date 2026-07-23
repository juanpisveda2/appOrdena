import { CONSIGNMENTS_CONFIRM_BATCH_CHANNEL } from '../../shared/contracts/app';
import type { ConfirmConsignmentBatchResult } from '../../shared/contracts/consignments';
import { confirmConsignmentBatchRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import { confirmConsignmentBatch } from '../services/consignments/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';
import { mapConsignmentError } from './consignmentsShared';

export function createConsignmentsConfirmBatchChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof confirmConsignmentBatchRequestSchema, ConfirmConsignmentBatchResult> {
  return {
    channel: CONSIGNMENTS_CONFIRM_BATCH_CHANNEL,
    requestSchema: confirmConsignmentBatchRequestSchema,
    handle: (payload) => {
      try {
        return confirmConsignmentBatch(database, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
