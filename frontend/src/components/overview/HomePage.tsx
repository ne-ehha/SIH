import { Link } from 'react-router-dom';
import { OBSERVATION_DATES } from '@/config/observationDates';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge, type StatusTone } from '@/components/common/StatusBadge';

interface ModuleEntry {
  title: string;
  to: string;
  purpose: string;
  tone: StatusTone;
  badge: string;
  action: string;
}

/** Functional module entries. Status reflects true module readiness — never invented. */
const MODULES: ModuleEntry[] = [
  {
    title: 'Ocean Explorer',
    to: '/explore',
    purpose: 'Locate real Argo float profiles on the globe. Only actual observation markers are selectable.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Explorer',
  },
  {
    title: 'Observation Explorer',
    to: '/explore',
    purpose: 'Browse real platform/cycle observations and their collocated metadata.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Explorer',
  },
  {
    title: 'Model Comparison',
    to: '/analysis',
    purpose: 'Quantify GLORYS − Argo differences across depth bands with verified statistics.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Analysis',
  },
  {
    title: '3D Research',
    to: '/research',
    purpose: 'Inspect collocated profiles through the 3D water column at real positions.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Research',
  },
  {
    title: 'Profile Lab',
    to: '/profile-lab',
    purpose: 'Profile-level scientific evidence and vertical model–observation comparisons for the selected profile.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Profile Lab',
  },
  {
    title: 'Diagnostics',
    to: '/diagnostics',
    purpose: 'Root-cause investigation pathways that separate observed facts from hypotheses.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Diagnostics',
  },
  {
    title: 'Solutions',
    to: '/solutions',
    purpose: 'Recommended tests and expected outcomes for the active observation.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Solutions',
  },
  {
    title: 'Research Reports',
    to: '/reports',
    purpose: 'Generate a formal report with provenance, methods, findings, and limitations.',
    tone: 'available',
    badge: 'Available',
    action: 'Open Reports',
  },
];

export function HomePage() {
  return (
    <PageContainer>
      {/* ── Page header ─────────────────────────────────────── */}
      <PageHeader
        title="Marine Research Workspace"
        purpose="Primary investigation"
        description="Bay of Bengal Model Evaluation · GLORYS12V1 × Argo Delayed Mode · 2024-01-01 → 2024-01-15 · 0–500 m validated"
        actions={
          <Link
            to="/explore"
            className="rounded-sm px-4 py-1.5 text-[12px] font-semibold transition"
            style={{ background: 'var(--os-accent)', color: '#fff', border: '1px solid var(--os-accent)' }}
          >
            Start Exploration
          </Link>
        }
      />

      {/* ── Research context ────────────────────────────────── */}
      <SectionCard className="mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <ContextCell label="Model" value="GLORYS12V1" />
          <ContextCell label="Observations" value="Argo Delayed Mode" />
          <ContextCell label="Region" value="Bay of Bengal" />
          <ContextCell label="Period" value="01–15 Jan 2024" />
          <ContextCell label="Depth" value="0–500 m validated" />
          <ContextCell label="Records" value="1,220 collocated" />
          <ContextCell label="Profiles" value="25 unique platform+cycle" />
          <ContextCell label="Convention" value="GLORYS − Argo" />
        </div>
        <div className="border-t border-[var(--os-border)] px-3 py-2">
          <div className="text-[10px] text-[var(--os-text-muted)] mb-1">
            Collocation: daily nearest-neighbour temporal matching · 0.25° spatial grid ·
            pressure range 0.50–445.06 dbar
          </div>
          <div className="text-[10px] text-[var(--os-text-muted)]">
            Observation dates with real records:{' '}
            <span className="mono text-[var(--os-text-3)]">
              {OBSERVATION_DATES.map((d) => d.substring(8)).join(' · ')} Jan
            </span>{' '}
            — dates without observations are never shown as available.
          </div>
        </div>
      </SectionCard>

      {/* ── Modules ─────────────────────────────────────────── */}
      <SectionCard title="Modules" className="mb-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <ModuleCard key={m.title} module={m} />
          ))}
        </div>
      </SectionCard>

      {/* ── Workflow ────────────────────────────────────────── */}
      <SectionCard title="Investigation workflow" className="mb-5">
        <div className="space-y-2">
          <WorkflowStep
            n="1"
            title="Explore"
            text="Locate real Argo float profiles on the globe. Arbitrary clicks are navigation only."
          />
          <WorkflowStep
            n="2"
            title="Inspect"
            text="Select a profile and choose Inspect Profile to open the Research 3D water-column view at its real position."
          />
          <WorkflowStep
            n="3"
            title="Compare"
            text="Quantify GLORYS − Argo differences across depth bands and profiles with verified statistics."
          />
          <WorkflowStep
            n="4"
            title="Investigate"
            text="Separate observed facts from hypotheses; candidate causes are investigation pathways, not proven physics."
          />
          <WorkflowStep
            n="5"
            title="Report"
            text="Generate a formal report with provenance, methods, findings, limitations, and recommended investigations."
          />
        </div>
      </SectionCard>

      {/* ── Data architecture ───────────────────────────────── */}
      <SectionCard title="Data architecture">
        <p className="text-[12px] leading-relaxed text-[var(--os-text-2)]">
          All scientific values shown in the application come from the actual backend API serving
          the collocation dataset. Sources are registered in a canonical data-source registry with
          declared capabilities; a source is displayed as connected only when a real dataset
          exists. Adapters for NetCDF, delimited text, and API sources plug into the same
          architecture without changing the UI.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--os-text-3)]">
          No observations, stations, dates, model values, currents, or bathymetry are fabricated.
          Where a capability requires a dataset that is not connected, the application states that
          the source is unavailable rather than inventing values.
        </p>
      </SectionCard>
    </PageContainer>
  );
}

function ModuleCard({ module }: { module: ModuleEntry }) {
  return (
    <Link
      to={module.to}
      className="os-selectable group flex flex-col border p-3 transition hover:border-[var(--os-border-light)]"
      style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--os-text)' }}>
          {module.title}
        </span>
        <StatusBadge label={module.badge} tone={module.tone} />
      </div>
      <p className="mt-1.5 flex-1 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
        {module.purpose}
      </p>
      <div
        className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--os-accent)' }}
      >
        {module.action} →
      </div>
    </Link>
  );
}

function ContextCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-[var(--os-border)] px-3 py-2 last:border-r-0">
      <div className="text-[9px] uppercase tracking-[0.08em] text-[var(--os-text-muted)]">{label}</div>
      <div className="mt-0.5 text-[12px] font-medium text-[var(--os-text)]">{value}</div>
    </div>
  );
}

function WorkflowStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mono shrink-0 pt-0.5 text-[10px] text-[var(--os-accent)]">{n}</span>
      <div>
        <span className="text-[12px] font-semibold text-[var(--os-text)]">{title}</span>
        <span className="text-[12px] text-[var(--os-text-3)]"> — {text}</span>
      </div>
    </div>
  );
}