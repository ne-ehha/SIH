import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DATA_SOURCES, VARIABLE_REGISTRY, type OceanDataSource, type DataSourceStatus } from '@/config/dataSources';
import { apiGet } from '@/services/apiClient';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge, type StatusTone } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';

const STATUS_META: Record<DataSourceStatus, { label: string; tone: StatusTone; description: string }> = {
  available: {
    label: 'Available',
    tone: 'available',
    description: 'Actively loaded and functional — a real dataset is connected.',
  },
  architectural: {
    label: 'Architecture ready',
    tone: 'warn',
    description: 'Adapter exists, but no real dataset is connected yet.',
  },
  unavailable: {
    label: 'Not connected',
    tone: 'neutral',
    description: 'No adapter or dataset connected — shown as unavailable, never as live.',
  },
};

// ── Live API health shape (subset of GET /api/v1/health) ─────────────────────

interface HealthDataset {
  available: boolean;
  type?: string;
  source?: string;
  temporalCoverage?: { start: string; end: string };
  totalProfiles?: number;
  totalObservations?: number;
  totalMatches?: number;
  validObservations?: number;
  variables?: string[];
  pipeline?: string;
}

interface HealthData {
  api?: string;
  datasets?: Record<string, HealthDataset>;
  pipelines?: Record<string, { name?: string; model?: string; observation?: string | null; variables?: string[] }>;
}

/**
 * Data Services — data-source registry.
 *
 * Renders the canonical DATA_SOURCES / VARIABLE_REGISTRY configuration and
 * overlays the live backend health endpoint so registry status and actual
 * runtime availability stay distinct. Unavailable sources are never shown as
 * connected.
 */
export function DataServicesPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<HealthData>('/api/v1/health').then((response) => {
      if (cancelled) return;
      if (response.status === 'success' && response.data) {
        setHealth(response.data);
        setHealthError(null);
      } else if (response.status === 'error') {
        setHealth(null);
        setHealthError(response.error.message);
      } else {
        setHealth(null);
        setHealthError('Health endpoint unavailable.');
      }
      setHealthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups: DataSourceStatus[] = ['available', 'architectural', 'unavailable'];
  const availableCount = DATA_SOURCES.filter((s) => s.status === 'available').length;

  return (
    <PageContainer>
      <PageHeader
        title="Data Services"
        purpose="Data"
        description="Registered data sources, coverage, quality control, capabilities, and service status. A source is shown as connected only when a real dataset exists."
        breadcrumb={<Link to="/" className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>← Workspace Home</Link>}
        actions={<StatusBadge label={`${availableCount} available`} tone="available" />}
      />

      {/* ── Registered sources, grouped by status ── */}
      <SectionCard title="Registered data sources" className="mb-5">
        <div className="space-y-5">
          {groups.map((status) => {
            const sources = DATA_SOURCES.filter((s) => s.status === status);
            const meta = STATUS_META[status];
            return (
              <div key={status}>
                <div className="mb-1.5 flex items-center gap-2">
                  <StatusBadge label={meta.label} tone={meta.tone} />
                  <span className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>{meta.description}</span>
                </div>
                {sources.length === 0 ? (
                  <p className="mb-2 text-[11px]" style={{ color: 'var(--os-text-muted)' }}>
                    No sources registered in this state.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                    {sources.map((source) => (
                      <SourceCard key={source.id} source={source} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Live API status (real runtime availability) ── */}
      <SectionCard title="Live API status">
        {healthLoading && <EmptyState message="Querying GET /api/v1/health…" />}
        {!healthLoading && healthError && (
          <div className="py-4">
            <p className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>
              The backend health endpoint could not be reached in this session
              (<span className="mono">GET /api/v1/health</span>). The registry above is the
              canonical source configuration; runtime availability is reported here when the
              backend is running.
            </p>
            <p className="mono mt-1 text-[11px]" style={{ color: 'var(--os-diff-pos)' }}>{healthError}</p>
          </div>
        )}
        {!healthLoading && !healthError && health && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge label={health.api === 'healthy' ? 'API healthy' : 'API check'} tone={health.api === 'healthy' ? 'available' : 'warn'} />
              <span className="mono text-[10px]" style={{ color: 'var(--os-text-3)' }}>GET /api/v1/health</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
              {Object.entries(health.datasets ?? {}).map(([key, ds]) => (
                <div key={key} className="border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[12px] font-semibold" style={{ color: 'var(--os-text)' }}>{key}</span>
                    <StatusBadge label={ds.available ? 'Connected' : 'Unavailable'} tone={ds.available ? 'available' : 'neutral'} />
                  </div>
                  {ds.source && <div className="mt-0.5 text-[11px]" style={{ color: 'var(--os-text-2)' }}>{ds.source}</div>}
                  <div className="mt-1.5 space-y-0.5 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                    {ds.temporalCoverage?.start && ds.temporalCoverage?.end && (
                      <div>
                        <span className="mono">{ds.temporalCoverage.start} → {ds.temporalCoverage.end}</span>
                      </div>
                    )}
                    {typeof ds.totalMatches === 'number' && <div><span className="mono">{ds.totalMatches}</span> collocated records</div>}
                    {typeof ds.totalProfiles === 'number' && <div><span className="mono">{ds.totalProfiles}</span> profiles</div>}
                    {typeof ds.validObservations === 'number' && <div><span className="mono">{ds.validObservations}</span> valid observations</div>}
                    {ds.variables && ds.variables.length > 0 && (
                      <div className="mono">{ds.variables.join(', ')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {health.pipelines && (
              <div className="mt-3 border-t border-[var(--os-border)] pt-2">
                {Object.entries(health.pipelines).map(([key, p]) => (
                  <div key={key} className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                    Pipeline <span className="mono">{key}</span> — {p.name}: {p.model}
                    {p.observation ? ` × ${p.observation}` : ' (model-only)'} · {p.variables?.join(', ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: OceanDataSource }) {
  const meta = STATUS_META[source.status];
  const variables = source.variables
    .map((id) => {
      const v = VARIABLE_REGISTRY.find((entry) => entry.id === id);
      return v ? `${v.displayName} (${v.unit})` : id;
    })
    .join(', ');

  const region = source.spatialCoverage.region
    ? source.spatialCoverage.region
    : `${source.spatialCoverage.south}–${source.spatialCoverage.north}°N · ${source.spatialCoverage.west}–${source.spatialCoverage.east}°E`;

  return (
    <div className="os-selectable border border-[var(--os-border)] bg-[var(--os-surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--os-text)' }}>{source.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
            <span className="mono">{source.id}</span>
            {source.institution && <span>· {source.institution}</span>}
            <span>· Pipeline {source.pipeline}</span>
          </div>
        </div>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </div>

      <div className="mt-2.5 space-y-1.5 text-[11px]">
        <InfoRow label="Type" value={`${source.classification} · ${source.adapterType}`} />
        <InfoRow label="Variables" value={variables || '—'} />
        <InfoRow label="Temporal" value={coverageLabel(source)} />
        <InfoRow label="Spatial" value={region} />
        <InfoRow label="Vertical" value={`${source.verticalCoverage.minPressure}–${source.verticalCoverage.maxPressure} dbar`} />
        <InfoRow label="Quality control" value={source.qualityControl ? `Available${source.qcFields ? ` (${source.qcFields.join(', ')})` : ''}` : 'Not available'} />
        {source.productId && <InfoRow label="Product ID" value={source.productId} mono />}
        {source.citation && <InfoRow label="Reference" value={source.citation} />}
        <InfoRow label="Operations" value={source.supportedOperations.join(', ') || '—'} />
      </div>
    </div>
  );
}

function coverageLabel(source: OceanDataSource): string {
  const tc = source.temporalCoverage;
  if (!tc.start || !tc.end) return 'Not configured';
  let label = `${tc.start} → ${tc.end}`;
  if (tc.resolution) label += ` · ${tc.resolution}`;
  if (tc.availableSteps && tc.availableSteps.length > 0) {
    label += ` · ${tc.availableSteps.length} actual steps`;
  }
  return label;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--os-text-muted)' }}>{label}</span>
      <span className={`min-w-0 text-right ${mono ? 'mono' : ''}`} style={{ color: 'var(--os-text-2)' }}>{value}</span>
    </div>
  );
}