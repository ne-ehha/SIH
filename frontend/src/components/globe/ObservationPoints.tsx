import { useOceanStore } from '@/state/oceanStore';
import { mockObservations } from '@/mocks/observations';

export function ObservationPoints() {
  const { selectedObservationId } = useOceanStore();

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10">
      <div className="rounded-lg border border-slate-700/50 bg-[#0d1224]/80 px-3 py-2 backdrop-blur-md">
        <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Observations
        </h4>
        <div className="space-y-1">
          {mockObservations.filter(o => o.status === 'active').slice(0, 5).map((obs) => (
            <div
              key={obs.id}
              className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[10px] ${
                selectedObservationId === obs.id
                  ? 'bg-cyan-900/30 text-cyan-300'
                  : 'text-slate-500'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                obs.status === 'active' ? 'bg-cyan-400' :
                obs.status === 'pending' ? 'bg-yellow-400' : 'bg-slate-500'
              }`} />
              {obs.id}
              <span className="text-slate-600">({obs.type})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
