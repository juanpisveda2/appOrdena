import { STOCK_SAVE_INTAKE_CHANNEL } from '../../shared/contracts/app';
import type { SaveStockIntakeResult } from '../../shared/contracts/catalog';
import { saveStockIntakeRequestSchema } from '../../shared/validation/catalog';
import type { SqliteDatabaseLike } from '../db/connection';
import { saveStockIntake } from '../catalog/saveStockIntake';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSaveStockIntakeChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof saveStockIntakeRequestSchema, SaveStockIntakeResult> {
  return {
    channel: STOCK_SAVE_INTAKE_CHANNEL,
    requestSchema: saveStockIntakeRequestSchema,
    handle: (payload) => saveStockIntake(database, payload)
  };
}
