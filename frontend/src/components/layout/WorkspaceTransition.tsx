import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OceanScopeLogo, OceanTideDots } from '@/components/common/OceanScopeBrand';

interface WorkspaceTransitionRequest {
  to: string;
  title: string;
  origin: string;
}

interface WorkspaceTransitionContextValue {
  openWorkspace: (to: string, title: string) => void;
}

const WorkspaceTransitionContext = createContext<WorkspaceTransitionContextValue | null>(null);
const TRANSITION_DURATION_MS = 3000;

export function WorkspaceTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [request, setRequest] = useState<WorkspaceTransitionRequest | null>(null);

  const openWorkspace = useCallback((to: string, title: string) => {
    if (to === pathname) return;
    // The first click owns the transition. Subsequent rapid clicks cannot
    // replace its destination or stack a second route timer.
    setRequest((current) => current ?? { to, title, origin: pathname });
  }, [pathname]);

  useEffect(() => {
    if (!request) return;

    const timeout = window.setTimeout(() => {
      setRequest(null);
      navigate(request.to);
    }, TRANSITION_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [navigate, request]);

  useEffect(() => {
    if (!request || pathname === request.origin) return;
    const cancelTimeout = window.setTimeout(() => setRequest(null), 0);
    return () => window.clearTimeout(cancelTimeout);
  }, [pathname, request]);

  return (
    <WorkspaceTransitionContext value={{ openWorkspace }}>
      {children}
      {request && <WorkspaceTransitionScreen title={request.title} />}
    </WorkspaceTransitionContext>
  );
}

export function useWorkspaceTransition() {
  const context = use(WorkspaceTransitionContext);
  if (!context) throw new Error('useWorkspaceTransition must be used within WorkspaceTransitionProvider.');
  return context;
}

function WorkspaceTransitionScreen({ title }: { title: string }) {
  return (
    <div className="ocean-transition fixed inset-0 z-[100] flex items-center justify-center px-6 text-slate-100" role="status" aria-live="polite">
      <div className="ocean-transition-wave ocean-transition-wave-one" aria-hidden="true" />
      <div className="ocean-transition-wave ocean-transition-wave-two" aria-hidden="true" />
      <div className="relative w-full max-w-sm text-center">
        <OceanScopeLogo variant="full" className="mx-auto h-12 w-auto" />
        <p className="mt-7 text-base font-medium text-slate-200">Preparing {title}</p>
        <p className="mt-1 text-sm text-slate-400">Preparing your workspace</p>
        <OceanTideDots label={`Preparing ${title}`} />
      </div>
    </div>
  );
}
