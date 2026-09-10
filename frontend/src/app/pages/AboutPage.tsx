import { Link } from 'react-router-dom';
import { OBSERVATION_DATES } from '@/config/observationDates';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';

/**
 * About — platform overview.
 *
 * Every statement here is grounded in the actual repository configuration and
 * backend contracts. Capabilities are never exaggerated and unavailable data is
 * described as unavailable.
 */
export function AboutPage() {
  return (
    <PageContainer>
      <PageHeader
        title="About OceanScope"
        purpose="Platform"
        description="OceanScope is a marine model-verification research platform for comparing ocean-model output against real observations — purpose-built for scientific investigation, not generic dashboards."
        breadcrumb={<Link to="/" className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>← Workspace Home</Link>}
      />

      <SectionCard title="Purpose" className="mb-5">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          OceanScope lets researchers collocate an ocean reanalysis with in-situ float
          observations, inspect individual profiles, quantify model–observation differences,
          and carry out evidence-based diagnostics — with every scientific value traceable to
          a real API response. The platform is an SIH research/demo prototype for ocean-model
          verification; it is not an AI assistant and does not generate scientific conclusions
          on its own.
        </p>
      </SectionCard>

      <SectionCard title="Scientific workflow" className="mb-5">
        <div className="space-y-2">
          <WorkflowStep n="1" title="Explore" text="Locate real Argo float profiles on the globe. Arbitrary clicks are navigation only and never become observations." />
          <WorkflowStep n="2" title="Inspect" text="Select a profile and open the Research 3D water-column view at its real collocated position." />
          <WorkflowStep n="3" title="Compare" text="Quantify GLORYS − Argo differences across depth bands and profiles with verified statistics." />
          <WorkflowStep n="4" title="Investigate" text="Separate observed facts from hypotheses; candidate causes are investigation pathways, not proven physics." />
          <WorkflowStep n="5" title="Report" text="Generate a formal report with provenance, methods, findings, limitations, and recommended investigations." />
        </div>
      </SectionCard>

      <SectionCard title="Research scope" className="mb-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          <FactCell label="Model" value="GLORYS12V1" />
          <FactCell label="Observations" value="Argo Delayed Mode" />
          <FactCell label="Region" value="Bay of Bengal" />
          <FactCell label="Research window" value="01–15 Jan 2024" />
          <FactCell label="Collocation" value="0.25° spatial · daily nearest-neighbour temporal" />
          <FactCell label="Records" value="1,220 collocated" />
          <FactCell label="Profiles" value="25 unique platform+cycle" />
          <FactCell label="Pressure range" value="0.50–445.06 dbar" />
        </div>
        <div className="mt-2.5 border-t border-[var(--os-border)] pt-2">
          <div className="text-[10px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
            The validated comparison window is 0–500 m. The difference convention is GLORYS − Argo:
            a positive difference means the model is higher than the observation. Observation dates
            with real records: <span className="mono">{OBSERVATION_DATES.join(' · ')}</span> — dates
            without observations are never shown as available.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Provenance philosophy" className="mb-5">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          Scientific values displayed in the interface come from real API responses serving the
          collocation dataset. Nothing is fabricated, interpolated for effect, or invented merely
          to populate a view. Data sources are registered in a canonical registry with declared
          status; a source is displayed as connected only when a real dataset exists. When a
          capability requires a dataset that is not connected, the platform states that the source
          is unavailable rather than simulating it.
        </p>
      </SectionCard>

      <SectionCard title="Observation–model comparison and diagnostics" className="mb-5">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          Comparison endpoints return the collocated Argo observation, the GLORYS12V1 model value,
          and their difference at real positions and depths. Diagnostics analyse nearby
          collocations and return a fingerprint, numerical evidence, and candidate explanations.
          These candidates are explicitly labelled as hypotheses: the collocated sample
          establishes the discrepancy but does not by itself establish physical causation, so
          recommended investigations are pathways — not automatic scientific conclusions.
        </p>
      </SectionCard>

      <SectionCard title="Limitations">
        <ul className="space-y-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          <li className="flex gap-2"><Bullet />Single region (Bay of Bengal) and a short temporal window (January 2024).</li>
          <li className="flex gap-2"><Bullet />Observations exist only on the sampled collocation dates; coverage is not continuous.</li>
          <li className="flex gap-2"><Bullet />Collocated observations are limited to the profiles and depth records in the processed dataset.</li>
          <li className="flex gap-2"><Bullet />HYCOM operational exploration is a separate model-only pipeline (2026 window) and never substitutes for the GLORYS × Argo research mode.</li>
          <li className="flex gap-2"><Bullet />Login is a local demo session gate, not institutional authentication.</li>
          <li className="flex gap-2"><Bullet />Diagnostic causes remain hypotheses until validated against independent observations.</li>
        </ul>
      </SectionCard>
    </PageContainer>
  );
}

function WorkflowStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mono shrink-0 pt-0.5 text-[10px]" style={{ color: 'var(--os-accent)' }}>{n}</span>
      <div>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--os-text)' }}>{title}</span>
        <span className="text-[12px]" style={{ color: 'var(--os-text-3)' }}> — {text}</span>
      </div>
    </div>
  );
}

function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--os-text-muted)' }}>{label}</div>
      <div className="mt-0.5 text-[12px] font-medium" style={{ color: 'var(--os-text)' }}>{value}</div>
    </div>
  );
}

function Bullet() {
  return <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>;
}