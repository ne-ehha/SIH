import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/** Scrollable page wrapper with a consistent max-width content column. */
export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`h-full min-h-0 overflow-y-auto ${className}`}>
      <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
    </div>
  );
}