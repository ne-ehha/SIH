import { useOceanStore } from '@/state/oceanStore';
import type { ViewMode } from '@/types/ocean';

const navItems: { label: string; view: ViewMode }[] = [
  { label: 'Explore', view: 'explore' },
  { label: 'Compare', view: 'compare' },
  { label: 'Discrepancies', view: 'discrepancies' },
  { label: 'Diagnostics', view: 'diagnostics' },
  { label: 'Solutions', view: 'solutions' },
  { label: 'Reports', view: 'reports' },
];

export function Header() {
  const { selectedNav, setSelectedNav, setActiveView } = useOceanStore();

  const handleNavClick = (label: string, view: ViewMode) => {
    setSelectedNav(label);
    setActiveView(view);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-[#0d1224]/90 px-6 backdrop-blur-md">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12C2 12 5 6 12 6C19 6 22 12 22 12" />
            <path d="M2 12C2 12 5 18 12 18C19 18 22 12 22 12" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">OceanVerif</h1>
          <p className="text-[10px] tracking-widest text-cyan-400/80">Understand. Compare. Improve.</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1">
        {navItems.map(({ label, view }) => (
          <button
            key={label}
            onClick={() => handleNavClick(label, view)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              selectedNav === label
                ? 'bg-cyan-600/20 text-cyan-400 shadow-sm shadow-cyan-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Theme indicator */}
        <button className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" title="Dark mode active">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        {/* Notifications */}
        <button className="relative rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" title="Notifications">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-400" />
        </button>

        {/* User */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white" title="User profile">
          OV
        </div>
      </div>
    </header>
  );
}
