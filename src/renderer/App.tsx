import React, { useEffect, useState } from 'react';
import { CatalogStockPanel } from './features/catalog-stock/CatalogStockPanel';
import { ConsignmentsPanel } from './features/consignments/ConsignmentsPanel';
import { SalesPanel } from './features/sales/SalesPanel';
import { AppShell, Banner, portadaSrc } from './ui';

const prefersReducedMotionQuery = '(prefers-reduced-motion: reduce)';
const splashDurationMs = 4600;
const reducedMotionSplashDurationMs = 2000;

function getPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(prefersReducedMotionQuery).matches
    : false;
}

function StartupSplash({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  return (
    <div className={reducedMotion ? 'startup-splash startup-splash--reduced-motion' : 'startup-splash'}>
      <img className="startup-splash__image" src={portadaSrc} alt="Portada de Ordena" />
    </div>
  );
}

export function App(): JSX.Element {
  const [healthError, setHealthError] = useState<string | null>(null);
  const [view, setView] = useState<'catalog' | 'sales' | 'consignments'>('catalog');
  const [salesEntryPoint, setSalesEntryPoint] = useState<'draft' | 'history'>('draft');
  const [reducedMotion, setReducedMotion] = useState(getPrefersReducedMotion);
  const [splashVisible, setSplashVisible] = useState(true);

  const openView = (nextView: 'catalog' | 'sales' | 'consignments'): void => {
    setSalesEntryPoint('draft');
    setView(nextView);
  };

  const openSalesHistory = (): void => {
    setSalesEntryPoint('history');
    setView('sales');
  };

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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    const handleChange = (): void => {
      setReducedMotion(mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSplashVisible(false);
    }, reducedMotion ? reducedMotionSplashDurationMs : splashDurationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [reducedMotion]);

  return (
    <>
      <AppShell view={view} onChangeView={openView}>
        {healthError ? <Banner tone="error" title="No pudimos abrir la aplicación" message={healthError} /> : null}

        {view === 'catalog' ? (
          <CatalogStockPanel
            bridge={window.app}
            onOpenSales={openSalesHistory}
            onOpenConsignments={() => openView('consignments')}
          />
        ) : view === 'sales' ? (
          <SalesPanel bridge={window.app} entryPoint={salesEntryPoint} onBack={() => openView('catalog')} />
        ) : (
          <ConsignmentsPanel bridge={window.app} onBack={() => openView('catalog')} />
        )}
      </AppShell>

      {splashVisible ? <StartupSplash reducedMotion={reducedMotion} /> : null}
    </>
  );
}
