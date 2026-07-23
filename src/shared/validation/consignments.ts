import { z } from 'zod';

const trimmedString = z.string().trim();

const isoDateStringSchema = trimmedString.refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Ingresá una fecha válida para la liquidación.'
});

export const listPendingConsignmentItemsRequestSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional()
  })
  .strict();

export const confirmConsignmentBatchRequestSchema = z
  .object({
    saleItemIds: z
      .array(z.number().int().positive())
      .min(1, 'Seleccioná al menos un artículo para liquidar.'),
    liquidationDate: isoDateStringSchema,
    notes: trimmedString.nullable().optional()
  })
  .strict();

export const listConsignmentBatchHistoryRequestSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional()
  })
  .strict();

export const getConsignmentBatchDetailRequestSchema = z
  .object({
    batchId: z.number().int().positive()
  })
  .strict();

export const exportConsignmentBatchExcelRequestSchema = z
  .object({
    batchId: z.number().int().positive()
  })
  .strict();
