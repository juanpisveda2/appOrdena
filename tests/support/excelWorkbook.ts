import { Workbook, type CellValue } from 'exceljs';

export async function loadWorkbook(buffer: Buffer | null): Promise<Workbook> {
  if (!buffer) {
    throw new Error('Workbook buffer was not captured.');
  }

  const workbook = new Workbook();
  const workbookBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  await workbook.xlsx.load(workbookBuffer);

  return workbook;
}

export function readSheetRows(workbook: Workbook, sheetName: string): Array<Array<string | number>> {
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    throw new Error(`Worksheet ${sheetName} was not found.`);
  }

  const columnCount = worksheet.columnCount;
  const rows: Array<Array<string | number>> = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Array<string | number> = [];

    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      values.push(normalizeCellValue(row.getCell(columnNumber).value));
    }

    rows.push(values);
  }

  return rows;
}

function normalizeCellValue(value: CellValue): string | number {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return '';
}
