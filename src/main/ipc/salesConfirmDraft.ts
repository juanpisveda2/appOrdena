import { SALES_CONFIRM_DRAFT_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { confirmSaleDraftRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { confirmSaleDraft } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesConfirmDraftChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof confirmSaleDraftRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_CONFIRM_DRAFT_CHANNEL,
    requestSchema: confirmSaleDraftRequestSchema,
    handle: (payload) => confirmSaleDraft(database, payload)
  };
}
