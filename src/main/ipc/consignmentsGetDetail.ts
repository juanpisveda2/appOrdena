import { CONSIGNMENTS_DETAIL_CHANNEL } from '../../shared/contracts/app';
import type { ConsignmentBatchDetail } from '../../shared/contracts/consignments';
import { getConsignmentBatchDetailRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import { getConsignmentBatchDetail } from '../services/consignments/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';
import { mapConsignmentError } from './consignmentsShared';

export function createConsignmentsGetDetailChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof getConsignmentBatchDetailRequestSchema, ConsignmentBatchDetail> {
  return {
    channel: CONSIGNMENTS_DETAIL_CHANNEL,
    requestSchema: getConsignmentBatchDetailRequestSchema,
    handle: (payload) => {
      try {
        return getConsignmentBatchDetail(database, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
