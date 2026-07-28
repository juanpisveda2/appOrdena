import { ZodError } from 'zod';
import { ConsignmentServiceError } from '../services/consignments/service';

export function mapConsignmentError(error: unknown): Error {
  if (error instanceof ZodError) {
    const issue = error.issues[0];

    if (issue?.path[0] === 'saleItemIds') {
      return new Error('Seleccioná al menos un artículo para liquidar.');
    }

    if (issue?.path[0] === 'liquidationDate') {
      return new Error('Ingresá una fecha válida para la liquidación.');
    }

    if (issue?.path[0] === 'notes') {
      return new Error('La nota de la liquidación no es válida.');
    }

    if (issue?.path[0] === 'batchId') {
      return new Error('No pudimos abrir ese lote de liquidación.');
    }
  }

  if (error instanceof ConsignmentServiceError) {
    switch (error.code) {
      case 'EMPTY_SELECTION':
        return new Error('Seleccioná al menos un artículo para liquidar.');
      case 'DUPLICATE_ITEM_IDS':
        return new Error('La selección tiene artículos repetidos. Volvé a intentarlo.');
      case 'SALE_ITEMS_NOT_FOUND':
        return new Error('Uno o más artículos ya no existen o cambiaron antes de confirmar.');
      case 'CANCELLED_SALE_ITEM':
        return new Error('No podés liquidar artículos de una venta cancelada.');
      case 'SALE_ITEM_NOT_PENDING_SETTLEMENT':
        return new Error('La selección incluye artículos que ya no están pendientes de liquidación.');
      case 'SALE_ITEM_WITHOUT_HISTORICAL_COST':
        return new Error('No pudimos calcular el importe histórico de uno de los artículos seleccionados.');
      case 'NO_LIQUIDATION_DUE':
        return new Error('La selección no tiene importe para liquidar ahora.');
      case 'BATCH_NOT_FOUND':
        return new Error('No encontramos la liquidación solicitada.');
      default:
        return new Error('No pudimos completar la operación de consignaciones.');
    }
  }

  return error instanceof Error ? error : new Error('No pudimos completar la operación de consignaciones.');
}
