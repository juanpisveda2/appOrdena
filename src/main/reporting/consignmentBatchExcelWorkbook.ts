import { Workbook, type Worksheet } from 'exceljs';
import type { ConsignmentBatchDetail, ConsignmentBatchDetailItem } from '../../shared/contracts/consignments';

const CURRENCY_FORMAT = '[$$-es-AR] #,##0.00';

export function buildConsignmentBatchExcelWorkbook(detail: ConsignmentBatchDetail, generatedAt: string): Workbook {
  const workbook = new Workbook();

  workbook.creator = 'Ordena';
  workbook.created = new Date(generatedAt);
  workbook.title = `Liquidación ${detail.batchNumber}`;
  workbook.subject = 'Comprobante Excel de liquidación';

  appendSummarySheet(workbook, detail);
  appendDetailSheet(workbook, detail);

  return workbook;
}

export async function serializeWorkbook(workbook: Workbook): Promise<Buffer> {
  const contents = await workbook.xlsx.writeBuffer();

  return Buffer.from(contents);
}

function appendSummarySheet(workbook: Workbook, detail: ConsignmentBatchDetail): void {
  const uniqueSales = getUniqueSales(detail.items);
  const totalSoldCents = uniqueSales.reduce((sum, item) => sum + item.saleTotalCents, 0);
  const totalChargedCents = uniqueSales.reduce((sum, item) => sum + (item.salePaidCents ?? 0), 0);
  const rows: Array<Array<string | number>> = [
    ['Número de liquidación', detail.batchNumber],
    ['Fecha de liquidación', formatDate(detail.liquidationDate)],
    ['Cantidad de artículos', detail.itemCount],
    ['Ventas incluidas', uniqueSales.length],
    ['Total vendido', totalSoldCents / 100],
    ['Total cobrado al cliente', totalChargedCents / 100],
    ['Total liquidado al proveedor', detail.totalCents / 100],
    ['Ganancia de la liquidación', detail.totalGainCents / 100],
    ['Saldo proveedor después de liquidar', detail.remainingCents / 100]
  ];
  const sheet = workbook.addWorksheet('Resumen', {
    views: [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  });

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  applyHeaderStyle(sheet, 1, 1);
  applyCurrencyFormat(sheet, [5, 6, 7, 8, 9], [2]);
  applyColumnWidths(sheet, rows);
}

function appendDetailSheet(workbook: Workbook, detail: ConsignmentBatchDetail): void {
  const headers = [
    'Fecha de venta',
    'Número de venta',
    'Producto',
    'Categoría',
    'Cliente',
    'Precio del producto',
    'Personalización',
    'Total de la venta',
    'Estado de la venta',
    'Método de pago',
    'A liquidar ahora',
    'Liquidado anteriormente',
    'Acumulado liquidado',
    'Saldo proveedor después de liquidar',
    'Ganancia del lote',
    'Fecha de liquidación'
  ];
  const body = detail.items.map((item) => [
    formatDate(item.saleDate),
    item.saleNumber,
    item.productName,
    formatCategory(item.category),
    item.buyerName?.trim() ? item.buyerName : 'Venta de mostrador',
    item.unitPriceCents / 100,
    item.personalizationCents == null ? '' : item.personalizationCents / 100,
    item.saleTotalCents / 100,
    formatSaleStatus(item.saleStatus),
    item.paymentMethodSummary ?? 'Sin pagos registrados',
    item.amountCents / 100,
    (item.liquidatedPreviouslyCents ?? 0) / 100,
    (item.totalAccumulatedCents ?? item.amountCents) / 100,
    (item.remainingBalanceCents ?? 0) / 100,
    item.gainCents / 100,
    formatDate(item.liquidationDate)
  ]);
  const totalsRow: Array<string | number> = [
    'Totales',
    '',
    '',
    '',
    '',
    '',
    '',
    getUniqueSales(detail.items).reduce((sum, item) => sum + item.saleTotalCents, 0) / 100,
    '',
    '',
    detail.totalCents / 100,
    detail.items.reduce((sum, item) => sum + (item.liquidatedPreviouslyCents ?? 0), 0) / 100,
    detail.items.reduce((sum, item) => sum + (item.totalAccumulatedCents ?? item.amountCents), 0) / 100,
    detail.remainingCents / 100,
    detail.totalGainCents / 100,
    ''
  ];
  const rows = [headers, ...(body.length > 0 ? body : [Array.from({ length: headers.length }, () => '')]), totalsRow];
  const sheet = workbook.addWorksheet('Detalle', {
    views: [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  });

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  applyHeaderStyle(sheet, 1, headers.length);
  applyHeaderStyle(sheet, rows.length, 1);
  applyCurrencyFormat(sheet, Array.from({ length: rows.length - 1 }, (_, index) => index + 2), [6, 7, 8, 11, 12, 13, 14, 15]);
  applyColumnWidths(sheet, rows);
}

function getUniqueSales(items: ConsignmentBatchDetailItem[]): ConsignmentBatchDetailItem[] {
  const bySaleNumber = new Map<number, ConsignmentBatchDetailItem>();

  items.forEach((item) => {
    if (!bySaleNumber.has(item.saleNumber)) {
      bySaleNumber.set(item.saleNumber, item);
    }
  });

  return Array.from(bySaleNumber.values());
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

function formatCategory(value: string): string {
  switch (value) {
    case 'jewelry':
      return 'Joyas';
    case 'mate':
      return 'Mates';
    case 'clothing':
      return 'Ropa';
    default:
      return value;
  }
}

function formatSaleStatus(value?: string): string {
  switch (value) {
    case 'pending_payment':
      return 'Pago pendiente';
    case 'partial_payment':
      return 'Pago parcial';
    case 'paid':
      return 'Pagado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Sin estado';
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

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
