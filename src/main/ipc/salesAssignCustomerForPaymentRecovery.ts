import { SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL } from '../../shared/contracts/app';
import type { SaleSnapshot } from '../../shared/contracts/sales';
import { assignSaleCustomerForPaymentRecoveryRequestSchema } from '../../shared/validation/sales';
import type { SqliteDatabaseLike } from '../db/connection';
import { assignSaleCustomerForPaymentRecovery } from '../services/sales/service';
import type { ValidatedIpcChannel } from './registerValidatedIpc';

export function createSalesAssignCustomerForPaymentRecoveryChannel({
  database
}: {
  database: SqliteDatabaseLike;
}): ValidatedIpcChannel<typeof assignSaleCustomerForPaymentRecoveryRequestSchema, SaleSnapshot> {
  return {
    channel: SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL,
    requestSchema: assignSaleCustomerForPaymentRecoveryRequestSchema,
    handle: (payload) => assignSaleCustomerForPaymentRecovery(database, payload)
  };
}
