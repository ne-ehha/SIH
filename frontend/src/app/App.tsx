import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { WorkspaceTransitionProvider } from '@/components/layout/WorkspaceTransition';
import { Ocean3DView } from '@/components/visualization/Ocean3DView';
import { Research3DView } from '@/components/visualization/Research3DView';
import { useOceanStore, registerNavigator } from '@/state/oceanStore';
import { getSession, validateSession } from '@/state/session';

// Workstation Screen Workspaces
import { LoginScreen } from '@/screens/LoginScreen';
import { LaunchpadScreen } from '@/screens/LaunchpadScreen';
import { SpatialTemporalWorkspace } from '@/screens/SpatialTemporalWorkspace';
import { ResearchWorkstation } from '@/screens/ResearchWorkstation';
import { ProfileLab } from '@/screens/ProfileLab';
import { AnalysisWorkspace } from '@/screens/AnalysisWorkspace';
import { DiagnosticsWorkspace } from '@/screens/DiagnosticsWorkspace';
import { InvestigationWorkspace } from '@/screens/InvestigationWorkspace';
import { ReportsWorkspace } from '@/screens/ReportsWorkspace';
import { DataServicesWorkspace } from '@/screens/DataServicesWorkspace';
import { ApiDocsWorkspace } from '@/screens/ApiDocsWorkspace';

const HYCOM_DATE_START = '2026-08-26';
const HYCOM_DATE_END = '2026-09-01';

function App() {
  return (
    <WorkspaceTransitionProvider>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginScreen /></GuestOnly>} />
        <Route element={<RequireAuth><PlatformLayout /></RequireAuth>}>
          <Route path="/" element={<LaunchpadScreen />} />
          <Route path="/explore" element={<SpatialTemporalWorkspace />} />
          <Route path="/research" element={<ResearchWorkstation />} />
          <Route path="/profile-lab" element={<ProfileLab />} />
          <Route path="/analysis" element={<AnalysisWorkspace />} />
          <Route path="/diagnostics" element={<DiagnosticsWorkspace />} />
          <Route path="/solutions" element={<InvestigationWorkspace />} />
          <Route path="/reports" element={<ReportsWorkspace />} />
          <Route path="/data-services" element={<DataServicesWorkspace />} />
          <Route path="/api-docs" element={<ApiDocsWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceTransitionProvider>
  );
}

/**
 * Application shell shared by the Launchpad and each workspace.
 */
function PlatformLayout() {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#070c14] text-slate-200 overflow-hidden select-none font-sans">
      <Header />
      <main className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col">
        <Outlet />
      </main>
      <ModelViews />
    </div>
  );
}

/** Keeps URL navigation and the Zustand workspaceMode in sync (both directions). */
function RouterSync() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const syncWorkspaceModeFromPath = useOceanStore((s) => s.syncWorkspaceModeFromPath);

  useEffect(() => {
    registerNavigator((to) => navigate(to));
  }, [navigate]);

  useEffect(() => {
    syncWorkspaceModeFromPath(pathname);
  }, [pathname, syncWorkspaceModeFromPath]);

  return null;
}

/** Demo session guard — redirects to /login when no local session exists. */
function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSessionStatus();
  if (status === 'checking') return <SessionCheck />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return (
    <>
      <RouterSync />
      {children}
    </>
  );
}

/** Guest-only wrapper for /login — redirects to / when a session exists. */
function GuestOnly({ children }: { children: ReactNode }) {
  const status = useSessionStatus();
  if (status === 'checking') return <SessionCheck />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function useSessionStatus(): 'checking' | 'authenticated' | 'unauthenticated' {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(() =>
    getSession() ? 'checking' : 'unauthenticated',
  );

  useEffect(() => {
    const session = getSession();
    if (!session) {
      return;
    }
    let active = true;
    validateSession(session).then((isValid) => {
      if (active) setStatus(isValid ? 'authenticated' : 'unauthenticated');
    });
    return () => { active = false; };
  }, []);

  return status;
}

function SessionCheck() {
  return <div className="min-h-screen bg-[#050b16]" aria-label="Checking session" />;
}

// ── 3D model overlays (HYCOM operational stays separate from Research Mode) ──

function ModelViews() {
  const isModelViewOpen = useOceanStore((s) => s.isModelViewOpen);
  const selectedDate = useOceanStore((s) => s.selectedDate);
  if (!isModelViewOpen) return null;
  const isHycom = selectedDate >= HYCOM_DATE_START && selectedDate <= HYCOM_DATE_END;
  return isHycom ? <Ocean3DView /> : <Research3DView />;
}

export default App;
