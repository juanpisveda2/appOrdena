import { z } from 'zod';

export const appHealthRequestSchema = z
  .object({
    ping: z.literal('foundation')
  })
  .strict();

export const appHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    appVersion: z.string().min(1),
    runtime: z.literal('desktop-foundation'),
    dbReady: z.boolean(),
    schemaVersion: z.number().int().nonnegative()
  })
  .strict();
