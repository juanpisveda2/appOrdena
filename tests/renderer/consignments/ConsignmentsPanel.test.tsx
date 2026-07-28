// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../../src/shared/contracts/app';
import { ConsignmentsPanel } from '../../../src/renderer/features/consignments/ConsignmentsPanel';
import type { ConfirmConsignmentBatchResult, ConsignmentBatchDetail, ConsignmentBatchHistoryListItem, ExportConsignmentBatchExcelResult } from '../../../src/shared/contracts/consignments';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createBridge(): AppBridge {
  return {
    health: vi.fn(),
    catalog: {
      list: vi.fn(),
      search: vi.fn(),
      getProductDetail: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn()
    },
    stock: {
      saveIntake: vi.fn()
    },
    sales: {
      listHistory: vi.fn(),
      getById: vi.fn(),
      confirmDraft: vi.fn(),
      registerPayment: vi.fn(),
      cancelPayment: vi.fn(),
      assignCustomerForPaymentRecovery: vi.fn(),
      cancelSale: vi.fn()
    },
    consignments: {
      listPendingItems: vi.fn(),
      confirmBatch: vi.fn(),
      listBatchHistory: vi.fn(),
      getBatchDetail: vi.fn(),
      exportBatchExcel: vi.fn()
    }
  };
}

const successBatch: ConfirmConsignmentBatchResult = {
  batchId: 3,
  batchNumber: 18,
  liquidationDate: '2026-07-20',
  itemCount: 1,
  totalCents: 90000,
  totalGainCents: 30000,
  remainingCents: 0,
  notes: null,
  createdAt: '2026-07-20T10:00:00.000Z'
};

const detail: ConsignmentBatchDetail = {
  ...successBatch,
  batchId: 11,
  batchNumber: 22,
  items: [
    {
      productName: 'Aros de plata',
      category: 'jewelry',
      material: 'Plata',
      variant: '18 mm',
      saleNumber: 12,
      saleDate: '2026-07-16T10:00:00.000Z',
      buyerName: 'Ana',
      unitPriceCents: 120000,
      personalizationCents: null,
      saleTotalCents: 120000,
      amountCents: 90000,
      saleStatus: 'paid',
      salePaidCents: 120000,
      saleBalanceCents: 0,
      paymentMethodSummary: 'Efectivo: $ 1.200,00',
      liquidatedPreviouslyCents: 0,
      totalAccumulatedCents: 90000,
      remainingBalanceCents: 0,
      productGainCents: 30000,
      personalizationGainCents: 0,
      gainCents: 30000,
      liquidationDate: '2026-07-22'
    }
  ]
};

const historyItems: ConsignmentBatchHistoryListItem[] = [
  successBatch,
  {
    batchId: 7,
    batchNumber: 19,
    liquidationDate: '2026-07-21',
    itemCount: 2,
    totalCents: 150000,
    totalGainCents: 45000,
    remainingCents: 0,
    notes: 'Segunda tanda',
    createdAt: '2026-07-21T10:00:00.000Z'
  }
];

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await Promise.resolve();
}

async function renderPanel(
  props: React.ComponentProps<typeof ConsignmentsPanel>
): Promise<{
  container: HTMLDivElement;
  cleanup: () => Promise<void>;
  getButton: (label: string) => HTMLButtonElement;
  clickButton: (label: string) => Promise<void>;
  getStatus: () => string | null;
  getHistoryRowButton: (batchNumber: number, label: string) => HTMLButtonElement;
}> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ConsignmentsPanel {...props} />);
    await flush();
  });

  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
        await flush();
      });
    },
    getButton: (label: string) => {
      const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${label}`);
      }
      return button;
    },
    clickButton: async (label: string) => {
      await act(async () => {
        const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
        if (!(button instanceof HTMLButtonElement)) {
          throw new Error(`Button not found: ${label}`);
        }
        button.click();
        await flush();
      });
    },
    getStatus: () => container.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    getHistoryRowButton: (batchNumber: number, label: string) => {
      const row = Array.from(container.querySelectorAll('li')).find((candidate) =>
        candidate.textContent?.includes(`Liquidación #${batchNumber}`)
      );
      if (!(row instanceof HTMLLIElement)) {
        throw new Error(`History row not found for batch ${batchNumber}`);
      }
      const button = Array.from(row.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Button not found in history row ${batchNumber}: ${label}`);
      }
      return button;
    }
  };
}

describe('ConsignmentsPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('uses the Argentina business date as the default liquidation date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T02:30:00.000Z'));

    const markup = renderToStaticMarkup(
      <ConsignmentsPanel
        bridge={createBridge()}
        initialState={{
          pendingItems: [
            {
              saleItemId: 10,
              productName: 'Aros de plata',
              saleNumber: 12,
              saleDate: '2026-07-16T10:00:00.000Z',
              buyerName: 'Ana',
              amountCents: 90000,
              gainCents: 30000
            }
          ],
          selectedIds: [10],
          showConfirmBlock: true
        }}
      />
    );

    expect(markup).toContain('value="2026-07-17"');
  });

  it('shows sale-status badges and the pending/after supplier balance labels required by liquidation semantics', () => {
    const markup = renderToStaticMarkup(
      <ConsignmentsPanel
        bridge={createBridge()}
        initialState={{
          view: 'pending',
          pendingItems: [
            {
              saleItemId: 10,
              productName: 'Aros parciales',
              saleNumber: 12,
              saleDate: '2026-07-16T10:00:00.000Z',
              buyerName: 'Ana',
              saleStatus: 'partial_payment',
              salePaidCents: 20000,
              saleBalanceCents: 100000,
              amountCents: 90000,
              liquidatedPreviouslyCents: 0,
              gainCents: 2000
            }
          ],
          selectedIds: [10],
          showConfirmBlock: true,
          successBatch
        }}
      />
    );

    expect(markup).toContain('Saldo pendiente con el proveedor');
    expect(markup).toContain('Saldo proveedor después de liquidar');
    expect(markup).toContain('Pago parcial');
  });

  it('calls exportBatchExcel from the success-state export CTA with the success batch id', async () => {
    const bridge = createBridge();
    const exportBatchExcel = vi.fn<() => Promise<ExportConsignmentBatchExcelResult>>().mockResolvedValue({
      status: 'saved',
      batchId: successBatch.batchId,
      batchNumber: successBatch.batchNumber,
      generatedAt: '2026-07-20T10:05:00.000Z',
      filePath: 'C:/tmp/liquidacion-18.xlsx'
    });
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue([]);
    bridge.consignments.exportBatchExcel = exportBatchExcel as AppBridge['consignments']['exportBatchExcel'];

    const view = await renderPanel({
      bridge,
      initialState: {
        successBatch
      }
    });

    await view.clickButton('Exportar liquidación');

    expect(exportBatchExcel).toHaveBeenCalledWith({ batchId: 3 });
    expect(view.getStatus()).toContain('Comprobante Excel de la liquidación 18 exportado correctamente.');

    await view.cleanup();
  });

  it('calls exportBatchExcel from the history row CTA with the row batch id', async () => {
    const bridge = createBridge();
    const exportBatchExcel = vi.fn<() => Promise<ExportConsignmentBatchExcelResult>>().mockResolvedValue({
      status: 'saved',
      batchId: historyItems[1].batchId,
      batchNumber: historyItems[1].batchNumber,
      generatedAt: '2026-07-21T10:05:00.000Z',
      filePath: 'C:/tmp/liquidacion-19.xlsx'
    });
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue([]);
    bridge.consignments.exportBatchExcel = exportBatchExcel as AppBridge['consignments']['exportBatchExcel'];

    const view = await renderPanel({
      bridge,
      initialState: {
        view: 'history',
        historyItems
      }
    });

    const secondHistoryButton = view.getHistoryRowButton(historyItems[1].batchNumber, 'Exportar liquidación');

    await act(async () => {
      secondHistoryButton.click();
      await flush();
    });

    expect(exportBatchExcel).toHaveBeenCalledWith({ batchId: 7 });

    await view.cleanup();
  });

  it('does not expose any export CTA before confirmation outside history and detail views', async () => {
    const bridge = createBridge();
    const pendingItems = [
      {
        saleItemId: 10,
        productName: 'Aros de plata',
        saleNumber: 12,
        saleDate: '2026-07-16T10:00:00.000Z',
        buyerName: 'Ana',
        amountCents: 90000,
        gainCents: 30000
      }
    ];
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue(pendingItems);

    const defaultView = await renderPanel({
      bridge,
      initialState: {
        pendingItems
      }
    });

    expect(defaultView.container.textContent).not.toContain('Exportar liquidación');

    await act(async () => {
      const checkbox = defaultView.container.querySelector('input[aria-label="Seleccionar Aros de plata"]');
      if (!(checkbox instanceof HTMLInputElement)) {
        throw new Error('Pending item checkbox not found');
      }
      checkbox.click();
      await flush();
    });

    await defaultView.clickButton('Revisar liquidación');

    expect(defaultView.container.querySelector('[aria-label="confirmar-liquidacion"]')).not.toBeNull();
    expect(defaultView.container.textContent).toContain('Revisar liquidación');
    expect(defaultView.container.textContent).toContain('Confirmar liquidación');

    expect(defaultView.container.textContent).not.toContain('Exportar liquidación');

    await defaultView.cleanup();
  });

  it('calls exportBatchExcel from the detail CTA with the detail batch id', async () => {
    const bridge = createBridge();
    const exportBatchExcel = vi.fn<() => Promise<ExportConsignmentBatchExcelResult>>().mockResolvedValue({
      status: 'saved',
      batchId: detail.batchId,
      batchNumber: detail.batchNumber,
      generatedAt: '2026-07-20T10:05:00.000Z',
      filePath: 'C:/tmp/liquidacion-18.xlsx'
    });
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue([]);
    bridge.consignments.exportBatchExcel = exportBatchExcel as AppBridge['consignments']['exportBatchExcel'];

    const view = await renderPanel({
      bridge,
      initialState: {
        view: 'detail',
        detail
      }
    });

    await view.clickButton('Exportar liquidación');

    expect(exportBatchExcel).toHaveBeenCalledWith({ batchId: 11 });

    await view.cleanup();
  });

  it('surfaces saved, cancelled, and error export outcomes', async () => {
    const bridge = createBridge();
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue([]);
    const exportBatchExcel = vi
      .fn<() => Promise<ExportConsignmentBatchExcelResult>>()
      .mockResolvedValueOnce({
        status: 'saved',
        batchId: successBatch.batchId,
        batchNumber: successBatch.batchNumber,
        generatedAt: '2026-07-20T10:05:00.000Z',
        filePath: 'C:/tmp/liquidacion-18.xlsx'
      })
      .mockResolvedValueOnce({
        status: 'cancelled',
        batchId: successBatch.batchId,
        batchNumber: successBatch.batchNumber,
        generatedAt: '2026-07-20T10:06:00.000Z'
      })
      .mockRejectedValueOnce(new Error('Falló la exportación de Excel.'));
    bridge.consignments.exportBatchExcel = exportBatchExcel as AppBridge['consignments']['exportBatchExcel'];

    const view = await renderPanel({
      bridge,
      initialState: {
        successBatch
      }
    });

    await view.clickButton('Exportar liquidación');
    expect(view.getStatus()).toContain('Comprobante Excel de la liquidación 18 exportado correctamente.');

    await view.clickButton('Exportar liquidación');
    expect(view.getStatus()).toContain('No exportamos el archivo porque cancelaste la ubicación de guardado.');

    await view.clickButton('Exportar liquidación');
    expect(view.getStatus()).toContain('Falló la exportación de Excel.');

    await view.cleanup();
  });

  it('disables only the active export button while its export promise is pending', async () => {
    const bridge = createBridge();
    bridge.consignments.listPendingItems = vi.fn().mockResolvedValue([]);
    const pendingExport = deferred<ExportConsignmentBatchExcelResult>();
    const exportBatchExcel = vi.fn().mockImplementation(({ batchId }: { batchId: number }) => {
      if (batchId === historyItems[1].batchId) {
        return pendingExport.promise;
      }

      return Promise.resolve({
        status: 'saved',
        batchId,
        batchNumber: batchId === successBatch.batchId ? successBatch.batchNumber : historyItems[0].batchNumber,
        generatedAt: '2026-07-21T10:05:00.000Z',
        filePath: `C:/tmp/liquidacion-${batchId}.xlsx`
      });
    });
    bridge.consignments.exportBatchExcel = exportBatchExcel as AppBridge['consignments']['exportBatchExcel'];

    const view = await renderPanel({
      bridge,
      initialState: {
        view: 'history',
        successBatch,
        historyItems
      }
    });

    const firstHistoryButton = view.getHistoryRowButton(historyItems[0].batchNumber, 'Exportar liquidación');
    const secondHistoryButton = view.getHistoryRowButton(historyItems[1].batchNumber, 'Exportar liquidación');
    const successButton = view.getButton('Exportar liquidación');

    await act(async () => {
      secondHistoryButton.click();
      await flush();
    });

    expect(exportBatchExcel).toHaveBeenCalledWith({ batchId: 7 });
    expect(secondHistoryButton.disabled).toBe(true);
    expect(secondHistoryButton.textContent).toBe('Generando…');
    expect(firstHistoryButton.disabled).toBe(false);
    expect(successButton.disabled).toBe(false);

    await act(async () => {
      pendingExport.resolve({
        status: 'saved',
        batchId: 7,
        batchNumber: 19,
        generatedAt: '2026-07-21T10:06:00.000Z',
        filePath: 'C:/tmp/liquidacion-19.xlsx'
      });
      await pendingExport.promise;
      await flush();
    });

    expect(secondHistoryButton.disabled).toBe(false);
    expect(secondHistoryButton.textContent).toBe('Exportar liquidación');

    await view.cleanup();
  });

  it('renders the redesigned stage overview and visual summary cards in pending view', () => {
    const markup = renderToStaticMarkup(
      <ConsignmentsPanel
        bridge={createBridge()}
        initialState={{
          view: 'pending',
          pendingItems: [
            {
              saleItemId: 10,
              productName: 'Aros parciales',
              saleNumber: 12,
              saleDate: '2026-07-16T10:00:00.000Z',
              buyerName: 'Ana',
              saleStatus: 'partial_payment',
              salePaidCents: 20000,
              saleBalanceCents: 100000,
              amountCents: 90000,
              liquidatedPreviouslyCents: 0,
              gainCents: 2000
            }
          ],
          selectedIds: [10],
          showConfirmBlock: true
        }}
      />
    );

    expect(markup).toContain('etapas-liquidaciones');
    expect(markup).toContain('Revisar liquidación');
    expect(markup).toContain('Paso previo');
    expect(markup).toContain('Importe a pagar ahora');
    expect(markup).toContain('Saldo pendiente con el proveedor');
  });
});
