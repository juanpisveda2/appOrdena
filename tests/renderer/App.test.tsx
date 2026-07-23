import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../src/shared/contracts/app';
import { App } from '../../src/renderer/App';

function createBridge(): AppBridge {
  return {
    health: vi.fn(),
    catalog: {
      list: vi.fn(),
      getProductDetail: vi.fn(),
      search: vi.fn(),
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

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens directly into the operational catalog screen without the bootstrap shell copy', () => {
    vi.stubGlobal('window', {
      app: createBridge(),
      history: {
        back: vi.fn()
      }
    });

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Catálogo y stock');
    expect(markup).toContain('Ventas');
    expect(markup).toContain('Liquidaciones');
    expect(markup).not.toContain('Exportación y respaldo');
    expect(markup).toContain('Buscá, filtrá y consultá productos del catálogo.');
    expect(markup).not.toContain('Project Mamá');
    expect(markup).not.toContain('Abriendo la aplicación…');
  });
});
