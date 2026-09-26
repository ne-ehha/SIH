import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OceanScopeLogo, OceanTideDots } from '@/components/common/OceanScopeBrand';
import { useOceanStore } from '@/state/oceanStore';

interface WorkspaceTransitionRequest {
  to: string;
  title: string;
  origin: string;
}

interface WorkspaceTransitionContextValue {
  openWorkspace: (to: string, title: string) => void;
  isTransitioning: boolean;
}

const WorkspaceTransitionContext = createContext<WorkspaceTransitionContextValue | null>(null);
const TRANSITION_DURATION_MS = 850;

export function WorkspaceTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [transitionTitle, setTransitionTitle] = useState<string | null>(null);

  const openWorkspace = useCallback((to: string, title: string) => {
    if (to === location.pathname) return;
    // 1. Immediately close any global 3D modal/overlay
    useOceanStore.getState().setIsModelViewOpen(false);

    // 2. Set transition indicator
    setTransitionTitle(title);

    // 3. Immediately navigate to destination route so the previous route component tree
    // (including any 3D Canvas, WebGL contexts, OrbitControls, and DOM overlays) unmounts NOW.
    navigate(to);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!transitionTitle) return;

    const timeout = window.setTimeout(() => {
      setTransitionTitle(null);
    }, TRANSITION_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [transitionTitle]);

  return (
    <WorkspaceTransitionContext.Provider value={{ openWorkspace, isTransitioning: !!transitionTitle }}>
      {children}
      {transitionTitle && <WorkspaceTransitionScreen title={transitionTitle} />}
    </WorkspaceTransitionContext.Provider>
  );
}

export function useWorkspaceTransition() {
  const context = use(WorkspaceTransitionContext);
  if (!context) throw new Error('useWorkspaceTransition must be used within WorkspaceTransitionProvider.');
  return context;
}

function WorkspaceTransitionScreen({ title }: { title: string }) {
  return (
    <div
      className="ocean-transition fixed inset-0 z-[99999] flex items-center justify-center px-6 text-slate-100 bg-[#050b16] select-none pointer-events-auto"
      style={{ isolation: 'isolate', opacity: 1 }}
      role="status"
      aria-live="polite"
    >
      <div className="ocean-transition-wave ocean-transition-wave-one" aria-hidden="true" />
      <div className="ocean-transition-wave ocean-transition-wave-two" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm text-center">
        <OceanScopeLogo variant="full" className="mx-auto h-12 w-auto" />
        <p className="mt-7 text-base font-medium text-slate-200">Preparing {title}</p>
        <p className="mt-1 text-sm text-slate-400">Preparing your workspace</p>
        <OceanTideDots label={`Preparing ${title}`} />
      </div>
    </div>
  );
}
