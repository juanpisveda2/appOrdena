import { dialog } from 'electron';
import { CONSIGNMENTS_EXPORT_EXCEL_CHANNEL } from '../../shared/contracts/app';
import type { ExportConsignmentBatchExcelResult } from '../../shared/contracts/consignments';
import { exportConsignmentBatchExcelRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import {
  exportConsignmentBatchExcel,
  type ConsignmentExcelShellAdapters
} from '../reporting/exportConsignmentBatchExcel';
import type { ValidatedIpcChannel } from './registerValidatedIpc';
import { mapConsignmentError } from './consignmentsShared';

export function createConsignmentsExportBatchExcelChannel({
  database,
  showSaveDialog = (options) => dialog.showSaveDialog(options),
  writeFile
}: {
  database: SqliteDatabaseLike;
  showSaveDialog?: ConsignmentExcelShellAdapters['showSaveDialog'];
  writeFile?: ConsignmentExcelShellAdapters['writeFile'];
}): ValidatedIpcChannel<typeof exportConsignmentBatchExcelRequestSchema, ExportConsignmentBatchExcelResult> {
  return {
    channel: CONSIGNMENTS_EXPORT_EXCEL_CHANNEL,
    requestSchema: exportConsignmentBatchExcelRequestSchema,
    handle: async (payload) => {
      try {
        return await exportConsignmentBatchExcel(database, {
          showSaveDialog,
          writeFile
        }, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
