import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import type {
  ExportConsignmentBatchExcelRequest,
  ExportConsignmentBatchExcelResult
} from '../../shared/contracts/consignments';
import { exportConsignmentBatchExcelRequestSchema } from '../../shared/validation/consignments';
import type { SqliteDatabaseLike } from '../db/connection';
import { getConsignmentBatchDetail } from '../services/consignments/service';
import { buildConsignmentBatchExcelWorkbook, serializeWorkbook } from './consignmentBatchExcelWorkbook';

export interface ConsignmentExcelSaveDialogOptions {
  title: string;
  defaultPath: string;
  filters: Array<{
    name: string;
    extensions: string[];
  }>;
}

export interface ConsignmentExcelSaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface ConsignmentExcelShellAdapters {
  showSaveDialog(options: ConsignmentExcelSaveDialogOptions): Promise<ConsignmentExcelSaveDialogResult>;
  writeFile?: (filePath: string, contents: Buffer) => Promise<void> | void;
}

export async function exportConsignmentBatchExcel(
  database: SqliteDatabaseLike,
  shellAdapters: ConsignmentExcelShellAdapters,
  request: ExportConsignmentBatchExcelRequest
): Promise<ExportConsignmentBatchExcelResult> {
  const payload = exportConsignmentBatchExcelRequestSchema.parse(request);
  const detail = getConsignmentBatchDetail(database, payload);
  const generatedAt = new Date().toISOString();
  const dialogResult = await shellAdapters.showSaveDialog({
    title: 'Guardar comprobante Excel de liquidación',
    defaultPath: buildConsignmentBatchFileName(detail.batchNumber, detail.liquidationDate),
    filters: [
      {
        name: 'Libro de Excel',
        extensions: ['xlsx']
      }
    ]
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return {
      status: 'cancelled',
      batchId: detail.batchId,
      batchNumber: detail.batchNumber,
      generatedAt
    };
  }

  const workbook = buildConsignmentBatchExcelWorkbook(detail, generatedAt);
  const contents = await serializeWorkbook(workbook);

  await (shellAdapters.writeFile ?? writeWorkbookFile)(dialogResult.filePath, contents);
  insertAuditLog(database, {
    occurredAt: generatedAt,
    operationType: 'consignment_batch_excel_exported',
    entityType: 'consignment_batch',
    entityId: String(detail.batchId),
    summary: `Generamos el comprobante Excel de liquidación ${basename(dialogResult.filePath)} para el lote #${detail.batchNumber}.`,
    detailJson: JSON.stringify({
      batchId: detail.batchId,
      batchNumber: detail.batchNumber,
      liquidationDate: detail.liquidationDate,
      filePath: dialogResult.filePath,
      generatedAt,
      workbookSheetNames: workbook.worksheets.map((worksheet) => worksheet.name)
    })
  });

  return {
    status: 'saved',
    batchId: detail.batchId,
    batchNumber: detail.batchNumber,
    generatedAt,
    filePath: dialogResult.filePath
  };
}

export function buildConsignmentBatchFileName(batchNumber: number, liquidationDate: string): string {
  return `liquidacion-${batchNumber}-${liquidationDate}.xlsx`;
}

function writeWorkbookFile(filePath: string, contents: Buffer): void {
  writeFileSync(filePath, contents);
}

function insertAuditLog(
  database: SqliteDatabaseLike,
  input: {
    occurredAt: string;
    operationType: string;
    entityType: string;
    entityId: string;
    summary: string;
    detailJson: string | null;
  }
): void {
  database.client
    .prepare(
      `
        INSERT INTO audit_logs (
          occurred_at,
          operation_type,
          entity_type,
          entity_id,
          summary,
          detail_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.occurredAt,
      input.operationType,
      input.entityType,
      input.entityId,
      input.summary,
      input.detailJson
    );
}
