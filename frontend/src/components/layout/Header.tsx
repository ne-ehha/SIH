import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  Clock,
  Code2,
  Compass,
  Database,
  FileText,
  Home,
  Layers,
  LogOut,
  Radio,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { endSession, getSession } from '@/state/session';
import type { ScreenType } from '@/types/stitch';
import { OceanScopeLogo } from '@/components/common/OceanScopeBrand';
import { useWorkspaceTransition } from './WorkspaceTransition';

const PATHWAYS = [
  { id: 'spatial' as ScreenType, path: '/explore', label: 'Spatial & Temporal Exploration', icon: Compass },
  { id: 'workstation' as ScreenType, path: '/research', label: 'Research Workstation', icon: Layers },
  { id: 'profile-lab' as ScreenType, path: '/profile-lab', label: 'Profile Lab', icon: Terminal },
  { id: 'analysis' as ScreenType, path: '/analysis', label: 'Analysis', icon: Activity },
  { id: 'diagnostics' as ScreenType, path: '/diagnostics', label: 'Diagnostics', icon: Radio },
  { id: 'investigation' as ScreenType, path: '/solutions', label: 'Solutions & Investigation', icon: ShieldAlert },
  { id: 'reports' as ScreenType, path: '/reports', label: 'Research Reports', icon: FileText },
  { id: 'data-services' as ScreenType, path: '/data-services', label: 'Data Services', icon: Database },
  { id: 'api-docs' as ScreenType, path: '/api-docs', label: 'API Documentation', icon: Code2 },
];

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [utcTime, setUtcTime] = useState('');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const { openWorkspace } = useWorkspaceTransition();

  useEffect(() => {
    const updateTime = () => setUtcTime(new Date().toUTCString().replace('GMT', 'UTC'));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentPathway = PATHWAYS.find((pathway) => pathway.path === location.pathname);
  const isLaunchpad = location.pathname === '/';
  const session = getSession();

  const handleLogout = () => {
    endSession();
    navigate('/login', { replace: true });
  };

  return (
    <header className="relative z-50 flex h-14 items-center justify-between border-b border-slate-800 bg-[#08111f] px-4 text-slate-200">
      <div className="flex min-w-0 items-center gap-3">
        <button
          id="btn-nav-home-logo"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-left focus:outline-none"
          title="Return to Home"
        >
          <OceanScopeLogo variant="full" className="h-9 w-auto" />
        </button>

        <div className="h-5 w-px bg-slate-700" />

        <button
          id="btn-nav-launchpad"
          onClick={() => navigate('/')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            isLaunchpad ? 'bg-slate-800 text-cyan-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </button>

        {!isLaunchpad && (
          <div className="relative min-w-0">
            <button
              id="btn-workspace-dropdown"
              onClick={() => setIsWorkspaceMenuOpen((isOpen) => !isOpen)}
              className="flex max-w-[13rem] items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-800"
              aria-expanded={isWorkspaceMenuOpen}
            >
              {currentPathway && React.createElement(currentPathway.icon, { className: 'h-3.5 w-3.5 shrink-0 text-cyan-300' })}
              <span className="truncate">{currentPathway?.label || 'Workspace'}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isWorkspaceMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWorkspaceMenuOpen && (
              <div className="absolute left-0 mt-1 w-64 overflow-hidden rounded-md border border-slate-700 bg-[#0b1626] py-1 shadow-lg">
                <div className="px-3 py-2 text-[11px] font-medium text-slate-400">Switch workspace</div>
                {PATHWAYS.map((pathway) => {
                  const Icon = pathway.icon;
                  const isActive = pathway.path === location.pathname;
                  return (
                    <button
                      key={pathway.id}
                      id={`btn-switch-${pathway.id}`}
                      onClick={() => {
                        openWorkspace(pathway.path, pathway.label);
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                        isActive ? 'bg-cyan-950/50 text-cyan-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span>{pathway.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {session && (
          <div className="hidden text-right sm:block">
            <div className="text-[11px] font-medium text-slate-200">{session.displayName}</div>
            <div className="text-[10px] text-slate-500">{session.role}</div>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300">
          <Clock className="h-3.5 w-3.5 text-cyan-300" />
          <span>{utcTime || 'UTC 00:00:00'}</span>
        </div>
        <button
          id="btn-logout-action"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
};
