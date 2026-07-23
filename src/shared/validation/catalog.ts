import { z } from 'zod';
import { CATALOG_CATEGORY_FILTERS, REUSABLE_PRODUCT_CATEGORIES } from '../contracts/catalog';

const trimmedString = z.string().trim();

export const reusableProductCategorySchema = z.enum(REUSABLE_PRODUCT_CATEGORIES);

export const newReusableProductSchema = z
  .object({
    category: reusableProductCategorySchema,
    name: trimmedString.min(1),
    description: trimmedString.min(1).nullable().optional(),
    material: trimmedString,
    variant: trimmedString.optional().default('')
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category !== 'clothing' && value.material.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Completá el material del producto.',
        path: ['material']
      });
    }
  });

export const catalogSearchRequestSchema = z
  .object({
    query: trimmedString.min(1),
    limit: z.number().int().positive().max(50).optional()
  })
  .strict();

export const catalogListRequestSchema = z
  .object({
    query: trimmedString.optional().default(''),
    category: z.enum(CATALOG_CATEGORY_FILTERS).optional().default('all'),
    limit: z.number().int().positive().max(200).optional(),
    recentLimit: z.number().int().positive().max(20).optional()
  })
  .strict();

export const catalogProductDetailRequestSchema = z
  .object({
    reusableProductId: z.number().int().positive(),
    recentIntakesLimit: z.number().int().positive().max(20).optional()
  })
  .strict();

export const updateReusableProductRequestSchema = z
  .object({
    reusableProductId: z.number().int().positive(),
    product: newReusableProductSchema
  })
  .strict();

export const deleteReusableProductRequestSchema = z
  .object({
    reusableProductId: z.number().int().positive()
  })
  .strict();

const stockIntakeBaseSchema = z
  .object({
    enteredQuantity: z.number().int().positive(),
    availableQuantity: z.number().int().nonnegative(),
    supplierUnitCostCents: z.number().int().nonnegative(),
    cashPriceCents: z.number().int().nonnegative(),
    listPriceCents: z.number().int().nonnegative(),
    profitPercentageBasisPoints: z.number().int().nonnegative(),
    intakeDate: trimmedString.min(1),
    notes: trimmedString.nullable().optional(),
    allowDuplicate: z.boolean().optional().default(false)
  })
  .strict();

function validateStockIntakeBase(
  value: z.infer<typeof stockIntakeBaseSchema>,
  context: z.RefinementCtx
): void {
  if (value.availableQuantity > value.enteredQuantity) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La cantidad disponible no puede ser mayor que la cantidad ingresada.',
      path: ['availableQuantity']
    });
  }
}

export const saveStockIntakeRequestSchema = z.union([
  stockIntakeBaseSchema.extend({
    reusableProductId: z.number().int().positive(),
    newReusableProduct: z.undefined().optional()
  }),
  stockIntakeBaseSchema.extend({
    reusableProductId: z.undefined().optional(),
    newReusableProduct: newReusableProductSchema
  })
]).superRefine(validateStockIntakeBase);

export type SaveStockIntakeRequestInput = z.infer<typeof saveStockIntakeRequestSchema>;
