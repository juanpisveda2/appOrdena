import React from 'react';

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'nav';

export function Button({
  variant = 'secondary',
  active = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; active?: boolean }): JSX.Element {
  return <button className={cx('button', `button--${variant}`, active && variant === 'nav' && 'button--nav-active', className)} {...props} />;
}

export function Surface({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: 'muted' | 'soft' | 'danger' | 'info' }): JSX.Element {
  return <section className={cx('surface', tone && `surface--${tone}`, className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  children
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <header className="page-header">
      <div>
        <h2 className="page-header__title">{title}</h2>
        {description ? <p className="page-header__description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}

export function Field({
  label,
  helper,
  helperTone = 'default',
  className,
  children
}: {
  label: string;
  helper?: string;
  helperTone?: 'default' | 'error';
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className={cx('field', className)}>
      <span className="field__label">{label}</span>
      {children}
      {helper ? <p className={cx('field__helper', helperTone === 'error' && 'field__helper--error')}>{helper}</p> : null}
    </label>
  );
}

export function Banner({
  tone,
  title,
  message,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone: 'error' | 'success' | 'warning' | 'info'; title?: string; message?: string }): JSX.Element {
  return (
    <Surface className={cx('banner', `banner--${tone}`)} {...props}>
      {title ? <p className="banner__title">{title}</p> : null}
      {message ? <p className="banner__message">{message}</p> : null}
      {children}
    </Surface>
  );
}

export function Badge({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}): JSX.Element {
  return <span className={cx('badge', `badge--${tone}`)}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
    </div>
  );
}

export function AppShell({
  view,
  onChangeView,
  children
}: {
  view: 'catalog' | 'sales' | 'consignments';
  onChangeView: (view: 'catalog' | 'sales' | 'consignments') => void;
  children: React.ReactNode;
}): JSX.Element {
  const items = [
    ['catalog', 'Catálogo y stock'],
    ['sales', 'Ventas'],
    ['consignments', 'Liquidaciones']
  ] as const;

  return (
    <main className="app-shell">
      <div className="app-shell__inner">
        <header className="app-topbar">
          <div className="app-brand">
            <h1 className="app-brand__name">Ordena</h1>
            <p className="app-brand__description">Gestión de stock y ventas</p>
          </div>
          <nav className="top-nav" aria-label="Navegación principal">
            {items.map(([itemView, label]) => (
              <Button key={itemView} type="button" variant="nav" active={view === itemView} onClick={() => onChangeView(itemView)}>
                {label}
              </Button>
            ))}
          </nav>
        </header>
        <div className="page-stack">{children}</div>
      </div>
    </main>
  );
}
