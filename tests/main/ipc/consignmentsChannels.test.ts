import { describe, expect, it } from 'vitest';
import { saveStockIntake } from '../../../src/main/catalog/saveStockIntake';
import { createConsignmentsConfirmBatchChannel } from '../../../src/main/ipc/consignmentsConfirmBatch';
import { createConsignmentsGetDetailChannel } from '../../../src/main/ipc/consignmentsGetDetail';
import { createConsignmentsListHistoryChannel } from '../../../src/main/ipc/consignmentsListHistory';
import { createConsignmentsListPendingItemsChannel } from '../../../src/main/ipc/consignmentsListPendingItems';
import { registerValidatedIpc, type IpcMainLike, type ValidatedIpcChannel } from '../../../src/main/ipc/registerValidatedIpc';
import { confirmSaleDraft } from '../../../src/main/services/sales/service';
import { registerSqliteTestHarness } from '../../support/sqliteTestHarness';

const { createInitializedApp } = registerSqliteTestHarness();

function createInitializedAppForTest() {
  return createInitializedApp('project-mama-consignment-ipc-');
}

async function invokeValidated<TRequest, TResponse>(
  definition: ValidatedIpcChannel<any, TResponse>,
  payload: TRequest
): Promise<TResponse> {
  let listener: ((event: unknown, request: unknown) => unknown) | undefined;
  const ipcMainLike: IpcMainLike = {
    handle: (_channel, nextListener) => {
      listener = nextListener;
    }
  };

  registerValidatedIpc({ ipcMainLike, definition });

  return (await listener?.({}, payload)) as TResponse;
}

describe('consignment IPC channels', () => {
  it('accepts valid inputs, keeps notes optional, and exposes history/detail after confirmation', async () => {
    const initialized = createInitializedAppForTest();

    const intake = saveStockIntake(initialized.database, {
      newReusableProduct: {
        category: 'jewelry',
        name: 'Aros IPC',
        material: 'Plata',
        variant: '18 mm'
      },
      enteredQuantity: 1,
      availableQuantity: 1,
      supplierUnitCostCents: 90_000,
      cashPriceCents: 120_000,
      listPriceCents: 125_000,
      profitPercentageBasisPoints: 1_000,
      intakeDate: '2026-07-14'
    });

    if (intake.kind !== 'saved') {
      throw new Error('Expected intake seed to be saved.');
    }

    const sale = confirmSaleDraft(initialized.database, {
      draftItems: [{ reusableProductId: intake.reusableProductId, quantity: 1, priceType: 'cash' }],
      initialPayment: { amountCents: 120_000, paymentMethod: 'cash' },
      saleDate: '2026-07-16T10:00:00.000Z'
    });

    const pendingChannel = createConsignmentsListPendingItemsChannel({ database: initialized.database });
    const confirmChannel = createConsignmentsConfirmBatchChannel({ database: initialized.database });
    const historyChannel = createConsignmentsListHistoryChannel({ database: initialized.database });
    const detailChannel = createConsignmentsGetDetailChannel({ database: initialized.database });

    await expect(invokeValidated(pendingChannel, {})).resolves.toEqual([
      expect.objectContaining({ saleItemId: sale.items[0]?.saleItemId, productName: 'Aros IPC' })
    ]);

    const confirmed = await invokeValidated(confirmChannel, {
      saleItemIds: [sale.items[0]?.saleItemId ?? 0],
      liquidationDate: '2026-07-20',
      notes: null
    });

    expect(confirmed.batchNumber).toBe(1);
    expect(confirmed.notes).toBeNull();
    await expect(invokeValidated(historyChannel, {})).resolves.toEqual([
      expect.objectContaining({ batchId: confirmed.batchId, batchNumber: 1 })
    ]);
    await expect(invokeValidated(detailChannel, { batchId: confirmed.batchId })).resolves.toEqual(
      expect.objectContaining({ batchId: confirmed.batchId, batchNumber: 1 })
    );

    initialized.database.close();
  });

  it('rejects empty selection and invalid date with controlled messages', async () => {
    const initialized = createInitializedAppForTest();
    const confirmChannel = createConsignmentsConfirmBatchChannel({ database: initialized.database });

    await expect(
      invokeValidated(confirmChannel, {
        saleItemIds: [],
        liquidationDate: '2026-07-20',
        notes: null
      })
    ).rejects.toThrow('Seleccioná al menos un artículo para liquidar.');

    await expect(
      invokeValidated(confirmChannel, {
        saleItemIds: [1],
        liquidationDate: 'fecha-invalida',
        notes: null
      })
    ).rejects.toThrow('Ingresá una fecha válida para la liquidación.');

    initialized.database.close();
  });

  it('maps domain failures to controlled messages', async () => {
    const initialized = createInitializedAppForTest();
    const confirmChannel = createConsignmentsConfirmBatchChannel({ database: initialized.database });

    await expect(
      invokeValidated(confirmChannel, {
        saleItemIds: [9999],
        liquidationDate: '2026-07-20',
        notes: 'Test'
      })
    ).rejects.toThrow('Uno o más artículos ya no existen o cambiaron antes de confirmar.');

    await expect(
      invokeValidated(createConsignmentsGetDetailChannel({ database: initialized.database }), { batchId: 9999 })
    ).rejects.toThrow('No encontramos la liquidación solicitada.');

    initialized.database.close();
  });
});
