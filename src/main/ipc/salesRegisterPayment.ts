import { SALES_REGISTER_PAYMENT_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { registerSalePaymentRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { registerSalePayment } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesRegisterPaymentChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof registerSalePaymentRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_REGISTER_PAYMENT_CHANNEL,
    requestSchema: registerSalePaymentRequestSchema,
    handle: (payload) => registerSalePayment(database, payload)
  };
}
