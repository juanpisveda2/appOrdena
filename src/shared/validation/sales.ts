import { z } from 'zod';
import {
  PAYMENT_METHODS,
  SALE_CONSIGNMENT_STATUSES,
  SALE_PRICE_TYPES,
  SALE_STATUSES
} from '../contracts/sales';

const trimmedString = z.string().trim();
const persistedIsoDateTimeString = z.string().trim().min(1).transform((value, context) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected a valid date/time string.'
    });

    return z.NEVER;
  }

  return date.toISOString();
});

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const salePriceTypeSchema = z.enum(SALE_PRICE_TYPES);
export const saleStatusSchema = z.enum(SALE_STATUSES);
export const saleConsignmentStatusSchema = z.enum(SALE_CONSIGNMENT_STATUSES);

export const saleCustomerInputSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    name: trimmedString.optional(),
    phoneText: trimmedString.optional(),
    note: trimmedString.nullable().optional()
  })
  .strict();

export const confirmSaleDraftItemInputSchema = z
  .object({
    reusableProductId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    priceType: salePriceTypeSchema,
    personalizationAmountCents: z.number().int().positive().nullable().optional(),
    personalizationPercentageBasisPoints: z.number().int().nonnegative().nullable().optional()
  })
  .strict()
  .superRefine((value, context) => {
    const hasAmount = value.personalizationAmountCents != null;
    const hasPercentage = value.personalizationPercentageBasisPoints != null;

    if (!hasAmount && hasPercentage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Personalization percentage requires a personalization amount.',
        path: ['personalizationPercentageBasisPoints']
      });
    }
  });

export const salePaymentInputSchema = z
  .object({
    amountCents: z.number().int().positive(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    note: trimmedString.nullable().optional()
  })
  .strict();

export const confirmSaleDraftRequestSchema = z
  .object({
    customer: saleCustomerInputSchema.nullable().optional(),
    draftItems: z.array(confirmSaleDraftItemInputSchema).min(1),
    initialPayment: salePaymentInputSchema.nullable().optional(),
    saleDate: persistedIsoDateTimeString.optional()
  })
  .strict();

export const listSalesHistoryRequestSchema = z
  .object({
    query: trimmedString.optional(),
    limit: z.number().int().positive().max(100).optional()
  })
  .strict();

export const getSaleDetailRequestSchema = z
  .object({
    saleId: z.number().int().positive()
  })
  .strict();

export const registerSalePaymentRequestSchema = salePaymentInputSchema
  .extend({
    saleId: z.number().int().positive(),
    paymentDate: persistedIsoDateTimeString.optional()
  })
  .strict();

export const cancelSalePaymentRequestSchema = z
  .object({
    saleId: z.number().int().positive(),
    paymentId: z.number().int().positive(),
    reason: trimmedString.min(1),
    cancelledAt: persistedIsoDateTimeString.optional()
  })
  .strict();

export const assignSaleCustomerForPaymentRecoveryRequestSchema = z
  .object({
    saleId: z.number().int().positive(),
    name: trimmedString.min(1),
    phoneText: trimmedString.min(1)
  })
  .strict();

export const cancelSaleRequestSchema = z
  .object({
    saleId: z.number().int().positive(),
    reason: trimmedString.min(1),
    cancelledAt: persistedIsoDateTimeString.optional()
  })
  .strict();
