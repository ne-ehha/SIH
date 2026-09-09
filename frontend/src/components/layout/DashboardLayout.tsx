import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="workstation-shell">
      <div className="workstation-header">
        <Header />
      </div>
      <div className="workstation-sidebar sidebar-rail">
        <Sidebar />
      </div>
      <div className="workstation-main">
        {children}
      </div>
      <div className="workstation-status">
        <StatusBar />
      </div>
    </div>
  );
}
