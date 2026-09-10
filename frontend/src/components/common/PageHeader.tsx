import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  purpose?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}

/**
 * Page-level header: title + optional purpose tag, description,
 * action area, and breadcrumb/back navigation.
 */
export function PageHeader({ title, purpose, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--os-border)' }}>
      {breadcrumb && <div className="mb-1.5">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: 'var(--os-text)' }}>
              {title}
            </h1>
            {purpose && (
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--os-accent)' }}
              >
                {purpose}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}