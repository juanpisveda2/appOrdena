import React, { useEffect, useState } from 'react';
import { CatalogStockPanel } from './features/catalog-stock/CatalogStockPanel';
import { ConsignmentsPanel } from './features/consignments/ConsignmentsPanel';
import { SalesPanel } from './features/sales/SalesPanel';
import { AppShell, Banner } from './ui';

export function App(): JSX.Element {
  const [healthError, setHealthError] = useState<string | null>(null);
  const [view, setView] = useState<'catalog' | 'sales' | 'consignments'>('catalog');

  useEffect(() => {
    document.title = 'Ordena';

    let active = true;

    void window.app
      .health()
      .then(() => undefined)
      .catch(() => {
        if (active) {
          setHealthError('No pudimos abrir la aplicación en este momento.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell view={view} onChangeView={setView}>
      {healthError ? <Banner tone="error" title="No pudimos abrir la aplicación" message={healthError} /> : null}

      {view === 'catalog' ? (
        <CatalogStockPanel bridge={window.app} />
      ) : view === 'sales' ? (
        <SalesPanel bridge={window.app} onBack={() => setView('catalog')} />
      ) : (
        <ConsignmentsPanel bridge={window.app} onBack={() => setView('catalog')} />
      )}
    </AppShell>
  );
}
