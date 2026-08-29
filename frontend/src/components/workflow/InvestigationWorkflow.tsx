import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getWorkflowSteps, getRecommendations } from '@/services/diagnosticsService';
import type { WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

export function InvestigationWorkflow() {
  const { selectedLocation } = useOceanStore();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [solution, setSolution] = useState<SolutionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      const [workflowSteps, sol] = await Promise.all([
        getWorkflowSteps('diag-001'),
        getRecommendations('diag-001'),
      ]);
      setSteps(workflowSteps);
      setSolution(sol);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    }
  }, [selectedLocation]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location to view investigation workflow" icon="🔬" />;
  }

  if (loading) return <LoadingState message="Loading workflow..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const statusStyles = {
    inactive: 'border-slate-700 bg-slate-900/30 text-slate-500',
    active: 'border-cyan-700 bg-cyan-900/30 text-cyan-300 ring-1 ring-cyan-700/40',
    complete: 'border-green-700 bg-green-900/20 text-green-400',
    loading: 'border-amber-700 bg-amber-900/20 text-amber-400',
  };

  const statusIcons: Record<string, string> = {
    inactive: '○',
    active: '◉',
    complete: '✓',
    loading: '⟳',
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-white">Investigation Workflow</h3>

      {/* Step cards */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`min-w-[140px] rounded-lg border p-3 ${statusStyles[step.status]}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{statusIcons[step.status]}</span>
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              <p className="mt-1 text-[10px] opacity-70">{step.description}</p>
            </div>
            {i < steps.length - 1 && (
              <span className="text-slate-600">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Solution card */}
      {solution && (
        <div className="rounded-lg border border-purple-800/50 bg-purple-900/20 p-4">
          <h4 className="text-sm font-medium text-purple-300">Recommended Investigation</h4>
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Recommended Test</p>
              <p className="text-xs text-slate-300">{solution.recommendedTest}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Expected Outcome</p>
              <p className="text-xs text-slate-300">{solution.expectedOutcome}</p>
            </div>
            <div className="rounded border border-amber-800/50 bg-amber-900/20 p-2">
              <p className="text-[10px] uppercase tracking-wider text-amber-500">Caution</p>
              <p className="text-[11px] text-amber-300/80 italic">{solution.caution}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
