import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Bordered surface section with an optional header row and action area. */
export function SectionCard({ title, children, action, className = '' }: SectionCardProps) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-header flex items-center justify-between gap-3">
          <span>{title}</span>
          {action}
        </div>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}