import { Workbook, type Worksheet } from 'exceljs';
import type { ConsignmentBatchDetail } from '../../shared/contracts/consignments';

const CURRENCY_FORMAT = '[$$-es-AR] #,##0.00';

export function buildConsignmentBatchExcelWorkbook(detail: ConsignmentBatchDetail, generatedAt: string): Workbook {
  const workbook = new Workbook();

  workbook.creator = 'project-mama';
  workbook.created = new Date(generatedAt);
  workbook.title = `Liquidation ${detail.batchNumber}`;
  workbook.subject = 'Liquidation Excel receipt';

  appendSummarySheet(workbook, detail);
  appendDetailSheet(workbook, detail);

  return workbook;
}

export async function serializeWorkbook(workbook: Workbook): Promise<Buffer> {
  const contents = await workbook.xlsx.writeBuffer();

  return Buffer.from(contents);
}

function appendSummarySheet(workbook: Workbook, detail: ConsignmentBatchDetail): void {
  const totalSoldCents = detail.items.reduce((sum, item) => sum + item.saleTotalCents, 0);
  const rows: Array<Array<string | number>> = [
    ['Liquidation number', detail.batchNumber],
    ['Liquidation date', formatDate(detail.liquidationDate)],
    ['Item count', detail.itemCount],
    ['Total sold', toCurrency(totalSoldCents)],
    ['Total paid to supplier', toCurrency(detail.totalCents)],
    ['Total profit', toCurrency(detail.totalGainCents)]
  ];
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  });

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  applyHeaderStyle(sheet, 1, 1);
  applyCurrencyFormat(sheet, [4, 5, 6], [2]);
  applyColumnWidths(sheet, rows);
}

function appendDetailSheet(workbook: Workbook, detail: ConsignmentBatchDetail): void {
  const headers = [
    'Sale date',
    'Sale number',
    'Product',
    'Category',
    'Material / variant',
    'Customer',
    'Product price',
    'Personalization',
    'Sale total',
    'Amount paid to supplier',
    'Product gain',
    'Personalization gain',
    'Total gain',
    'Liquidation date'
  ];
  const body = detail.items.map((item) => [
    formatDate(item.saleDate),
    item.saleNumber,
    item.productName,
    formatCategory(item.category),
    buildMaterialVariantLabel(item.material, item.variant),
    item.buyerName?.trim() ? item.buyerName : '',
    toCurrency(item.unitPriceCents),
    item.personalizationCents == null ? '' : toCurrency(item.personalizationCents),
    toCurrency(item.saleTotalCents),
    toCurrency(item.amountCents),
    toCurrency(item.productGainCents),
    item.personalizationGainCents === 0 ? '' : toCurrency(item.personalizationGainCents),
    toCurrency(item.gainCents),
    formatDate(item.liquidationDate)
  ]);
  const totalsRow: Array<string | number> = [
    'Totals',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    toCurrency(detail.items.reduce((sum, item) => sum + item.saleTotalCents, 0)),
    toCurrency(detail.totalCents),
    '',
    '',
    toCurrency(detail.totalGainCents),
    ''
  ];
  const rows = [headers, ...(body.length > 0 ? body : [Array.from({ length: headers.length }, () => '')]), totalsRow];
  const sheet = workbook.addWorksheet('Detail', {
    views: [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  });

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  applyHeaderStyle(sheet, 1, headers.length);
  applyHeaderStyle(sheet, rows.length, 1);
  applyCurrencyFormat(
    sheet,
    Array.from({ length: rows.length - 1 }, (_, index) => index + 2),
    [7, 8, 9, 10, 11, 12, 13]
  );
  applyColumnWidths(sheet, rows);
}

function autoFitColumns(rows: Array<Array<string | number>>): number[] {
  const widths: number[] = [];

  rows.forEach((row) => {
    row.forEach((value, index) => {
      const width = String(value ?? '').length + 2;
      widths[index] = Math.max(widths[index] ?? 10, Math.min(width, 40));
    });
  });

  return widths;
}

function applyCurrencyFormat(sheet: Worksheet, rows: number[], columns: number[]): void {
  rows.forEach((rowNumber) => {
    columns.forEach((columnNumber) => {
      const cell = sheet.getRow(rowNumber).getCell(columnNumber);

      if (typeof cell.value === 'number') {
        cell.numFmt = CURRENCY_FORMAT;
      }
    });
  });
}

function applyHeaderStyle(sheet: Worksheet, rowNumber: number, columnCount: number): void {
  Array.from({ length: columnCount }, (_, index) => index + 1).forEach((columnNumber) => {
    sheet.getRow(rowNumber).getCell(columnNumber).font = { bold: true };
  });
}

function applyColumnWidths(sheet: Worksheet, rows: Array<Array<string | number>>): void {
  autoFitColumns(rows).forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function buildMaterialVariantLabel(material: string, variant: string): string {
  return [material, variant].filter((value) => value.trim().length > 0).join(' · ');
}

function formatCategory(value: string): string {
  switch (value) {
    case 'jewelry':
      return 'Jewelry';
    case 'mate':
      return 'Mate products';
    case 'clothing':
      return 'Clothing';
    default:
      return value;
  }
}

function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function toCurrency(cents: number): number {
  return cents / 100;
}
