import React, { useState } from 'react';
import { CheckCircle2, MapPin, NotebookPen, Plus, Search } from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { SolutionsPanel } from '@/components/diagnostics/SolutionsPanel';

export const InvestigationWorkspace: React.FC = () => {
  const { selectedObservationId, selectedDepth, selectedDate } = useOceanStore();
  const [investigationNote, setInvestigationNote] = useState('');
  const [investigationRecords, setInvestigationRecords] = useState<string[]>([]);

  const handleAddNote = (event: React.FormEvent) => {
    event.preventDefault();
    const note = investigationNote.trim();
    if (!note) return;
    setInvestigationRecords([`[${new Date().toUTCString().slice(17, 25)} UTC] ${note}`, ...investigationRecords]);
    setInvestigationNote('');
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#09101c] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Search className="h-4 w-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Solutions &amp; Investigation</h1>
            <p className="text-[11px] text-slate-500">Review evidence, assess possible explanations, and document findings.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
          <span>{selectedObservationId ? selectedObservationId.replace('argo_', 'ARGO ').toUpperCase() : 'No profile selected'} · {selectedDate} · {selectedDepth} m</span>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-12">
        <div className="flex flex-col space-y-3 lg:col-span-8">
          <SolutionsPanel />
        </div>

        <aside className="border border-slate-800 bg-[#09101d] p-4 font-sans text-xs lg:col-span-4">
          <div>
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Researcher record</span>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-100">Investigation &amp; Findings</h2>
            </div>

            <div className="mt-3 space-y-3">
              <div className="space-y-1 border border-slate-800 bg-[#050912] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Evidence context</div>
                <div className="text-slate-200">Bay of Bengal · GLORYS12V1 × Argo Delayed Mode</div>
                <div className="font-mono text-[11px] text-slate-400">Selected depth: {selectedDepth} m · Date: {selectedDate}</div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"><NotebookPen className="h-3.5 w-3.5" /> Investigation notes</div>
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {investigationRecords.length === 0 ? (
                    <p className="border border-dashed border-slate-800 px-3 py-4 text-[11px] text-slate-500">No notes recorded. Add an evidence observation, finding, or research follow-up.</p>
                  ) : investigationRecords.map((record, index) => (
                    <div key={index} className="flex items-start space-x-2 border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{record}</span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddNote} className="flex gap-2 pt-2">
                <label htmlFor="investigation-note" className="sr-only">Investigation note</label>
                <input
                  id="investigation-note"
                  type="text"
                  value={investigationNote}
                  onChange={(event) => setInvestigationNote(event.target.value)}
                  placeholder="Record an evidence observation or finding…"
                  className="flex-1 border border-slate-700 bg-[#050912] px-3 py-1.5 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center space-x-1 bg-cyan-700 px-3 py-1.5 font-mono text-xs text-white transition-colors hover:bg-cyan-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add note</span>
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-slate-500">
            Notes are researcher-authored records for this session; OceanScope does not issue operational directives.
          </div>
        </aside>
      </main>
    </div>
  );
};
