import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { runDiagnostics, getWorkflowSteps, getRecommendations } from '@/services/diagnosticsService';
import type { WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';

export function InvestigationWorkflow() {
  const { selectedLocation, selectedVariable, selectedDepth } = useOceanStore();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [solution, setSolution] = useState<SolutionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      // First: run diagnostics to ensure we have a diagnostic ID
      await runDiagnostics(selectedLocation, selectedVariable, selectedDepth);
      // Then: fetch workflow steps and recommendations using the cached ID
      const [workflowSteps, sol] = await Promise.all([
        getWorkflowSteps(),
        getRecommendations(),
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
  }, [selectedLocation, selectedVariable, selectedDepth]);

  if (!selectedLocation) {
    return (
      <div className="panel">
        <div className="panel-header">Investigation Workflow</div>
        <div className="p-3 text-center text-[10px] py-6" style={{ color: 'var(--os-text-3)' }}>Select a location to view workflow</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">Investigation Workflow</div>
        <div className="flex items-center justify-center py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--os-argo)', borderTopColor: 'transparent' }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Loading workflow...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">Investigation Workflow</div>
        <div className="p-3 text-center">
          <p className="text-[10px]" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={loadData} className="mt-2 text-[10px]" style={{ color: 'var(--os-accent)' }}>Retry</button>
        </div>
      </div>
    );
  }

  const statusStyles: Record<string, { borderColor: string; color: string }> = {
    inactive: { borderColor: 'var(--os-border)', color: 'var(--os-text-3)' },
    active: { borderColor: 'var(--os-accent)', color: 'var(--os-accent)' },
    complete: { borderColor: 'var(--os-success)', color: 'var(--os-success)' },
    loading: { borderColor: 'var(--os-diff-pos)', color: 'var(--os-diff-pos)' },
  };

  const statusIcons: Record<string, string> = {
    inactive: '○',
    active: '◉',
    complete: '✓',
    loading: '⟳',
  };

  return (
    <div className="panel">
      <div className="panel-header">Investigation Workflow</div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5">
              <div className="min-w-[120px] border px-2.5 py-2" style={statusStyles[step.status]}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]">{statusIcons[step.status]}</span>
                  <span className="text-[11px] font-medium">{step.title}</span>
                </div>
                <p className="mt-0.5 text-[9px] opacity-70">{step.description}</p>
              </div>
              {i < steps.length - 1 && (
                <span className="text-[10px]" style={{ color: 'var(--os-border-light)' }}>→</span>
              )}
            </div>
          ))}
        </div>

        {solution && (
          <div className="border p-3 space-y-2" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--os-accent)' }}>Recommended Investigation</p>
            <p className="text-[11px]" style={{ color: 'var(--os-text)' }}>{solution.recommendedTest}</p>
            <div className="border-t pt-2" style={{ borderColor: 'var(--os-border)' }}>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--os-text-muted)' }}>Expected Outcome</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--os-text-2)' }}>{solution.expectedOutcome}</p>
            </div>
            <div className="border p-2" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--os-diff-pos)' }}>Caution</p>
              <p className="text-[10px] italic mt-0.5" style={{ color: 'var(--os-text-2)' }}>{solution.caution}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
