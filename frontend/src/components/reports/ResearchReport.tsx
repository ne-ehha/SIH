/**
 * ResearchReport — Dynamic report derived from actual Research data.
 *
 * Fetches comparison data from the backend and displays a summary
 * that updates when the user changes date/variable/location.
 */

import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getProvider } from '@/integration';
import { useResearchVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

interface ReportData {
  comparison: {
    modelValue: number;
    observationValue: number;
    difference: number;
    unit: string;
    sourceModel: string;
    sourceObservation: string;
    observationLatitude?: number;
    observationLongitude?: number;
    nearestDistance?: number;
  } | null;
  profilePointCount: number;
  maxDepth: number;
}

export function ResearchReport() {
  const { selectedLocation, selectedVariable, selectedDate, selectedTime, selectedDepth } = useOceanStore();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Also fetch research 3D stats for the report
  const { stats: vizStats } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
  });

  useEffect(() => {
    if (!selectedLocation) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = getProvider();

        // Fetch comparison
        const compResponse = await provider.fetchComparison({
          location: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            depth: selectedDepth,
          },
          variable: selectedVariable,
          depth: selectedDepth,
          date: selectedDate,
          time: selectedTime,
        });

        // Fetch profile
        const profResponse = await provider.fetchVerticalProfile({
          location: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          },
          variable: selectedVariable,
          date: selectedDate,
          time: selectedTime,
        });

        let comparison = null;
        if (compResponse.status === 'success' && compResponse.data) {
          const d = compResponse.data;
          comparison = {
            modelValue: d.point.modelValue,
            observationValue: d.point.observationValue,
            difference: d.point.difference,
            unit: d.point.unit,
            sourceModel: d.sourceModel,
            sourceObservation: d.sourceObservation,
            observationLatitude: d.observationLatitude,
            observationLongitude: d.observationLongitude,
            nearestDistance: d.nearestDistance,
          };
        }

        let profilePointCount = 0;
        let maxDepth = 0;
        if (profResponse.status === 'success' && profResponse.data) {
          profilePointCount = profResponse.data.points.length;
          maxDepth = profResponse.data.maxDepth;
        }

        setReport({ comparison, profilePointCount, maxDepth });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedLocation, selectedVariable, selectedDate, selectedTime, selectedDepth]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location to view Research report" icon="📋" />;
  }

  if (loading) return <LoadingState message="Generating Research report..." />;
  if (error) return <ErrorState message={error} />;
  if (!report) return <EmptyState message="No report data available" />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
        <h3 className="text-sm font-semibold text-white">Research Report — GLORYS12V1 x Argo</h3>
        <p className="mt-1 text-[10px] text-slate-500">
          Date: {selectedDate} | Variable: {selectedVariable} | Depth: {selectedDepth}m
        </p>
      </div>

      {/* Comparison Summary */}
      {report.comparison ? (
        <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
          <h4 className="text-xs font-semibold text-white mb-3">Point Comparison</h4>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Model ({report.comparison.sourceModel})</p>
              <p className="text-cyan-300 text-lg font-medium">{report.comparison.modelValue.toFixed(4)} {report.comparison.unit}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Observation ({report.comparison.sourceObservation})</p>
              <p className="text-purple-300 text-lg font-medium">{report.comparison.observationValue.toFixed(4)} {report.comparison.unit}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Difference (GLORYS - Argo)</p>
              <p className={`text-lg font-medium ${report.comparison.difference >= 0 ? 'text-amber-300' : 'text-blue-300'}`}>
                {report.comparison.difference > 0 ? '+' : ''}{report.comparison.difference.toFixed(4)} {report.comparison.unit}
              </p>
            </div>
          </div>
          {report.comparison.observationLatitude && report.comparison.nearestDistance !== undefined && (
            <p className="mt-3 text-[10px] text-slate-500">
              Matched observation: {report.comparison.observationLatitude.toFixed(4)}N, {report.comparison.observationLongitude?.toFixed(4)}E ({report.comparison.nearestDistance.toFixed(1)} km from requested location)
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
          <p className="text-xs text-slate-500">No comparison data available for this selection.</p>
        </div>
      )}

      {/* Profile Summary */}
      <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
        <h4 className="text-xs font-semibold text-white mb-2">Vertical Profile</h4>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-lg bg-slate-900/50 p-3">
            <p className="text-slate-500">Profile depth levels</p>
            <p className="text-white text-lg font-medium">{report.profilePointCount}</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 p-3">
            <p className="text-slate-500">Max depth</p>
            <p className="text-white text-lg font-medium">{report.maxDepth.toFixed(1)} dbar</p>
          </div>
        </div>
      </div>

      {/* Dataset Statistics (from Research 3D) */}
      {vizStats && (
        <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4">
          <h4 className="text-xs font-semibold text-white mb-3">Dataset Statistics for {selectedDate}</h4>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Total collocated points</p>
              <p className="text-white text-lg font-medium">{vizStats.totalPoints}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Mean difference (GLORYS - Argo)</p>
              <p className={`text-lg font-medium ${vizStats.meanDifference >= 0 ? 'text-amber-300' : 'text-blue-300'}`}>
                {vizStats.meanDifference > 0 ? '+' : ''}{vizStats.meanDifference.toFixed(4)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">RMS difference</p>
              <p className="text-white text-lg font-medium">{vizStats.rmsDifference.toFixed(4)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Argo mean</p>
              <p className="text-purple-300">{vizStats.argoMean.toFixed(4)}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">GLORYS mean</p>
              <p className="text-cyan-300">{vizStats.glorysMean.toFixed(4)}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-3">
              <p className="text-slate-500">Max |difference|</p>
              <p className="text-white">{vizStats.maxDifference.toFixed(4)}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            Source: GLORYS12V1 x Argo Delayed Mode collocation | Depth range: {vizStats.depthRange[0]}-{vizStats.depthRange[1]} dbar
          </p>
        </div>
      )}

      {/* Scientific integrity note */}
      <div className="rounded-xl border border-slate-800/50 bg-[#0d1224]/90 p-3">
        <p className="text-[10px] text-slate-500 italic">
          This report is generated from real GLORYS12V1 x Argo Delayed Mode collocated observations.
          Differences represent GLORYS model output minus Argo observation values.
          Scientific conclusions should be validated against additional independent data sources.
        </p>
      </div>
    </div>
  );
}
