// @vitest-environment jsdom

import React from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBridge } from '../../src/shared/contracts/app';
import { App } from '../../src/renderer/App';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true
});

vi.mock('../../src/renderer/features/catalog-stock/CatalogStockPanel', () => ({
  CatalogStockPanel: ({ onOpenSales }: { onOpenSales?: () => void }) => (
    <div>
      <p>Catalog stock panel</p>
      <button type="button" onClick={onOpenSales}>
        Ver ventas
      </button>
    </div>
  )
}));

vi.mock('../../src/renderer/features/sales/SalesPanel', () => ({
  SalesPanel: ({ onBack, entryPoint }: { onBack: () => void; entryPoint?: 'draft' | 'history' }) => (
    <div>
      <p>Sales panel</p>
      <p>Sales entry point: {entryPoint ?? 'draft'}</p>
      <button type="button" onClick={onBack}>
        Back to catalog
      </button>
    </div>
  )
}));

vi.mock('../../src/renderer/features/consignments/ConsignmentsPanel', () => ({
  ConsignmentsPanel: ({ onBack }: { onBack: () => void }) => (
    <div>
      <p>Consignments panel</p>
      <button type="button" onClick={onBack}>
        Back to catalog
      </button>
    </div>
  )
}));

function createBridge(): AppBridge {
  return {
    health: vi.fn().mockResolvedValue(undefined),
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    Reflect.deleteProperty(window as typeof window & { app?: AppBridge }, 'app');
    Reflect.deleteProperty(window as typeof window & { matchMedia?: unknown }, 'matchMedia');
  });

  it('shows the startup splash once, then reveals the catalog screen without replaying on navigation', async () => {
    const bridge = createBridge();
    Object.defineProperty(window, 'app', {
      configurable: true,
      value: bridge
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn()
      }))
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('.startup-splash')).not.toBeNull();
    expect(container.textContent).toContain('Catálogo y stock');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('Catálogo y stock');
    expect(container.querySelector('.page-stack__section[aria-label="Catálogo y stock"]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(4600);
    });

    expect(container.querySelector('.startup-splash')).toBeNull();

    const salesButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ventas');
    expect(salesButton).toBeDefined();

    await act(async () => {
      salesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('.startup-splash')).toBeNull();
    expect(container.textContent).toContain('Ventas');
    expect(container.textContent).toContain('Sales entry point: draft');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('Ventas');
    expect(container.querySelector('.page-stack__section[aria-label="Ventas"]')).not.toBeNull();

    await act(async () => {
      const backButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Back to catalog');
      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      const historyButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ver ventas');
      historyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Sales entry point: history');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('Ventas');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the reduced-motion splash variant when the system setting prefers less motion', () => {
    Object.defineProperty(window, 'app', {
      configurable: true,
      value: createBridge()
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn()
      }))
    });

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('startup-splash--reduced-motion');
    expect(markup).toContain('startup-splash__image');
    expect(markup).not.toContain('app-brand__image');
  });

  it('keeps the reduced-motion splash visible for a longer time before hiding', async () => {
    const bridge = createBridge();
    Object.defineProperty(window, 'app', {
      configurable: true,
      value: bridge
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn()
      }))
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('.startup-splash')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1999);
    });

    expect(container.querySelector('.startup-splash')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(container.querySelector('.startup-splash')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
