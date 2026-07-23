import { describe, expect, it } from 'vitest';
import { exportConsignmentBatchExcelRequestSchema } from '../../../src/shared/validation/consignments';

describe('consignments validation', () => {
  it('requires a positive batch id for Excel export', () => {
    expect(() => exportConsignmentBatchExcelRequestSchema.parse({ batchId: 0 })).toThrow();
    expect(exportConsignmentBatchExcelRequestSchema.parse({ batchId: 3 })).toEqual({ batchId: 3 });
  });
});
