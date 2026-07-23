import { SALES_CANCEL_PAYMENT_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { cancelSalePaymentRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { cancelSalePayment } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesCancelPaymentChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof cancelSalePaymentRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_CANCEL_PAYMENT_CHANNEL,
    requestSchema: cancelSalePaymentRequestSchema,
    handle: (payload) => cancelSalePayment(database, payload)
  };
}
