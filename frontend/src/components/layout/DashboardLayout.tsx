import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

interface DashboardLayoutProps {
  children: ReactNode;
  /** Show the context control rail (variable/time/depth/color/layers). */
  contextRail?: boolean;
}

export function DashboardLayout({ children, contextRail = false }: DashboardLayoutProps) {
  return (
    <div className="workstation-shell">
      <div className="workstation-header">
        <Header />
      </div>
      {contextRail && (
        <div className="workstation-sidebar sidebar-rail">
          <Sidebar />
        </div>
      )}
      <div className={`workstation-main ${contextRail ? '' : 'workstation-main-full'}`}>
        {children}
      </div>
      <div className="workstation-status">
        <StatusBar />
      </div>
    </div>
  );
}