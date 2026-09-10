import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';

interface PlaceholderPageProps {
  title: string;
  purpose: string;
  description: string;
}

/**
 * Route-level placeholder for platform modules that are still in preparation.
 * It clearly marks the module as not yet implemented and never invents
 * functionality or scientific data.
 */
export function PlaceholderPage({ title, purpose, description }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <PageHeader title={title} purpose={purpose} actions={<StatusBadge label="In preparation" tone="warn" />} />
      <SectionCard title="Module status">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          {description}
        </p>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
          This module is being prepared and is not yet available. No scientific functionality is
          simulated here.
        </p>
        <div className="mt-4">
          <Link to="/" className="text-[11px] font-medium" style={{ color: 'var(--os-accent)' }}>
            ← Back to Workspace Home
          </Link>
        </div>
      </SectionCard>
    </PageContainer>
  );
}