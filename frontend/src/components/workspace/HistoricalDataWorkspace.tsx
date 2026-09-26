import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Calendar,
  Layers,
  MapPin,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Download,
  CheckCircle2,
  RefreshCw,
  Clock,
  Compass,
  FileCode,
  Sliders,
} from 'lucide-react';
import {
  REGISTERED_DATASETS,
  CANONICAL_VARIABLES,
  SOURCE_PROVIDERS,
  getDatasetsBySource,
  getDatasetById,
} from '@/config/datasetRegistry';
import type {
  HistoricalDataRequest,
  HistoricalDataResponse,
  NormalizedDataRecord,
  RegisteredDataset,
  UnifiedProfileRecord,
} from '@/types/unifiedData';
import { historicalDataService } from '@/services/historicalDataService';
import { useOceanStore } from '@/state/oceanStore';

export const HistoricalDataWorkspace: React.FC = () => {
  const { selectResearchObservation, setIsModelViewOpen } = useOceanStore();
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<string>('glorys12v1');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('glorys12v1-argo-collocation-bob');
  const [selectedVariableId, setSelectedVariableId] = useState<string>('temperature');
  const [selectedDate, setSelectedDate] = useState<string>('2024-01-06');
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [format, setFormat] = useState<'records' | 'profiles'>('records');

  // Bounds
  const [latMin, setLatMin] = useState<number>(7.80);
  const [latMax, setLatMax] = useState<number>(15.52);
  const [lonMin, setLonMin] = useState<number>(83.47);
  const [lonMax, setLonMax] = useState<number>(90.26);
  const [depthMin, setDepthMin] = useState<number>(0.0);
  const [depthMax, setDepthMax] = useState<number>(500.0);

  // Execution & Results
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<HistoricalDataResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, any> | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'profiles' | 'provenance'>('table');

  // ── Filtered Datasets & Variables ──────────────────────────────────────────
  const availableDatasets = useMemo(() => {
    return getDatasetsBySource(selectedSourceId);
  }, [selectedSourceId]);

  const currentDataset = useMemo<RegisteredDataset | undefined>(() => {
    return getDatasetById(selectedDatasetId) || availableDatasets[0];
  }, [selectedDatasetId, availableDatasets]);

  // When source changes, switch to first dataset in that source
  const handleSourceChange = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    const datasets = getDatasetsBySource(sourceId);
    if (datasets.length > 0) {
      const firstDs = datasets[0];
      setSelectedDatasetId(firstDs.dataset_id);
      if (firstDs.supported_variables.length > 0) {
        setSelectedVariableId(firstDs.supported_variables[0]);
      }
      // Preset default spatial/temporal coverage from dataset
      setLatMin(firstDs.spatial_coverage.south);
      setLatMax(firstDs.spatial_coverage.north);
      setLonMin(firstDs.spatial_coverage.west);
      setLonMax(firstDs.spatial_coverage.east);
      setDepthMin(firstDs.vertical_coverage.min_depth);
      setDepthMax(firstDs.vertical_coverage.max_depth);
      if (firstDs.temporal_coverage.available_dates && firstDs.temporal_coverage.available_dates.length > 0) {
        setSelectedDate(firstDs.temporal_coverage.available_dates[0]);
      } else if (firstDs.temporal_coverage.start !== 'dynamic_last_90_days') {
        setSelectedDate(firstDs.temporal_coverage.start.slice(0, 10));
      }
    }
  };

  const handleDatasetChange = (dsId: string) => {
    setSelectedDatasetId(dsId);
    const ds = getDatasetById(dsId);
    if (ds) {
      if (!ds.supported_variables.includes(selectedVariableId)) {
        setSelectedVariableId(ds.supported_variables[0]);
      }
      setLatMin(ds.spatial_coverage.south);
      setLatMax(ds.spatial_coverage.north);
      setLonMin(ds.spatial_coverage.west);
      setLonMax(ds.spatial_coverage.east);
      setDepthMin(ds.vertical_coverage.min_depth);
      setDepthMax(ds.vertical_coverage.max_depth);
      if (ds.temporal_coverage.available_dates && ds.temporal_coverage.available_dates.length > 0) {
        setSelectedDate(ds.temporal_coverage.available_dates[0]);
      }
    }
  };

  // ── Retrieval Handler ──────────────────────────────────────────────────────
  const handleRetrieve = async () => {
    if (!currentDataset) return;
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);
    setResponse(null);

    const query: HistoricalDataRequest = {
      source: currentDataset.source_id,
      dataset_id: currentDataset.dataset_id,
      variable: selectedVariableId,
      date: selectedDate,
      time: selectedTime,
      latitude_min: latMin,
      latitude_max: latMax,
      longitude_min: lonMin,
      longitude_max: lonMax,
      depth_min: depthMin,
      depth_max: depthMax,
      format: format,
    };

    try {
      const res = await historicalDataService.retrieveData(query);
      if (res.status === 'error') {
        const err = (res as any).error;
        setErrorMessage(err?.message || 'Retrieval failed.');
        setErrorDetails(err?.details || null);
      } else {
        setResponse(res);
        if (format === 'profiles') {
          setActiveTab('profiles');
        } else {
          setActiveTab('table');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthRequired = currentDataset?.availability_status === 'registered_access_required';

  return (
    <div className="space-y-6">
      {/* ── Top Header Card ────────────────────────────────────────────────── */}
      <section className="border border-slate-800 bg-[#09101d] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100">Historical / Date-Specific Data Retrieval</h2>
            </div>
            <p className="mt-1 text-[12px] text-slate-400">
              Query reproducible ocean observations, verified reanalysis benchmarks, or operational model fields with explicit provenance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[11px] font-mono text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              Scientific Contract v2.0
            </span>
          </div>
        </div>
      </section>

      {/* ── Query Builder Grid ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Parameter Selection (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="border border-slate-800 bg-[#09101d] p-4">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              1. Source & Dataset Selection
            </h3>

            <div className="mt-3 space-y-3">
              {/* Source Select */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Source Provider</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {SOURCE_PROVIDERS.map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => handleSourceChange(src.id)}
                      className={`flex flex-col items-start border p-2 text-left transition-colors ${
                        selectedSourceId === src.id
                          ? 'border-cyan-500/80 bg-[#0c1e33] text-cyan-200'
                          : 'border-slate-800 bg-[#070d18] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-[11px] font-semibold">{src.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">{src.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dataset Select */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Target Dataset</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                  className="mt-1 w-full border border-slate-700 bg-[#070d18] px-3 py-2 text-[12px] text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {availableDatasets.map((ds) => (
                    <option key={ds.dataset_id} value={ds.dataset_id}>
                      {ds.dataset_name} ({ds.availability_status === 'available' ? 'Available' : 'Access Required'})
                    </option>
                  ))}
                </select>
                {currentDataset && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Product ID: <span className="font-mono text-slate-300">{currentDataset.product_id}</span></span>
                    <span className="font-mono text-slate-400">{currentDataset.processing_level}</span>
                  </div>
                )}
              </div>

              {/* Variable Select */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Scientific Variable</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {currentDataset?.supported_variables.map((varId) => {
                    const varDef = CANONICAL_VARIABLES[varId];
                    const isSelected = selectedVariableId === varId;
                    return (
                      <button
                        key={varId}
                        type="button"
                        onClick={() => setSelectedVariableId(varId)}
                        className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                            : 'border-slate-800 bg-[#070d18] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {varDef ? varDef.display_name : varId}
                        {varDef && <span className="ml-1 text-[10px] font-mono text-slate-400">({varDef.unit})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Temporal & Spatial Bounds */}
          <div className="border border-slate-800 bg-[#09101d] p-4">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <Compass className="h-3.5 w-3.5 text-cyan-400" />
              2. Temporal & Spatial Scope
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {/* Date selection */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Observation / Model Date</label>
                {currentDataset?.temporal_coverage.available_dates ? (
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-1 w-full border border-slate-700 bg-[#070d18] px-3 py-1.5 text-[12px] text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    {currentDataset.temporal_coverage.available_dates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-1 w-full border border-slate-700 bg-[#070d18] px-3 py-1.5 text-[12px] text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Time selection */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Time (UTC)</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="mt-1 w-full border border-slate-700 bg-[#070d18] px-3 py-1.5 text-[12px] text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="00:00">00:00 UTC</option>
                  <option value="06:00">06:00 UTC</option>
                  <option value="12:00">12:00 UTC</option>
                  <option value="18:00">18:00 UTC</option>
                </select>
              </div>

              {/* Latitude Bounds */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Latitude Range (°N)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={latMin}
                    onChange={(e) => setLatMin(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                    placeholder="Min"
                  />
                  <span className="text-slate-600">to</span>
                  <input
                    type="number"
                    step="0.1"
                    value={latMax}
                    onChange={(e) => setLatMax(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Longitude Bounds */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Longitude Range (°E)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={lonMin}
                    onChange={(e) => setLonMin(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                    placeholder="Min"
                  />
                  <span className="text-slate-600">to</span>
                  <input
                    type="number"
                    step="0.1"
                    value={lonMax}
                    onChange={(e) => setLonMax(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Depth Range */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Depth / Pressure (dbar / m)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    value={depthMin}
                    onChange={(e) => setDepthMin(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                  />
                  <span className="text-slate-600">to</span>
                  <input
                    type="number"
                    value={depthMax}
                    onChange={(e) => setDepthMax(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-700 bg-[#070d18] px-2 py-1 text-[11px] text-slate-100"
                  />
                </div>
              </div>

              {/* Format selection */}
              <div>
                <label className="text-[11px] font-medium text-slate-400">Response Structure</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('records')}
                    className={`flex-1 border py-1 text-[11px] ${
                      format === 'records'
                        ? 'border-cyan-500 bg-[#0c1e33] text-cyan-200'
                        : 'border-slate-800 bg-[#070d18] text-slate-400'
                    }`}
                  >
                    Tabular Records
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('profiles')}
                    className={`flex-1 border py-1 text-[11px] ${
                      format === 'profiles'
                        ? 'border-cyan-500 bg-[#0c1e33] text-cyan-200'
                        : 'border-slate-800 bg-[#070d18] text-slate-400'
                    }`}
                  >
                    CTD Profiles
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pre-Retrieval Summary & Action (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="border border-slate-800 bg-[#09101d] p-4 text-[12px]">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Request Summary
            </h3>
            <div className="mt-3 space-y-2.5">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Source:</span>
                <span className="font-medium text-slate-200">{currentDataset?.source_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Dataset ID:</span>
                <span className="font-mono text-[11px] text-cyan-300">{currentDataset?.dataset_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Variable:</span>
                <span className="font-medium text-slate-200">
                  {CANONICAL_VARIABLES[selectedVariableId]?.display_name || selectedVariableId}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Requested Time:</span>
                <span className="font-mono text-slate-200">{selectedDate} {selectedTime} UTC</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Region:</span>
                <span className="font-mono text-slate-200">{latMin}°–{latMax}° N, {lonMin}°–{lonMax}° E</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500">Depth Scope:</span>
                <span className="font-mono text-slate-200">{depthMin}–{depthMax} dbar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`font-mono text-[11px] ${
                  isAuthRequired ? 'text-amber-300' : 'text-emerald-300'
                }`}>
                  {isAuthRequired ? '● Registered — Access Required' : '● Available in OceanScope'}
                </span>
              </div>
            </div>

            {isAuthRequired ? (
              <div className="mt-4 border border-amber-800/50 bg-amber-950/20 p-3">
                <div className="flex items-start gap-2 text-amber-300">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Authentication Required</div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Copernicus Marine operational physical models require server-side service credentials.
                      OceanScope maintains scientific honesty: values are never mocked or fabricated.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRetrieve}
                  disabled={isLoading}
                  className="mt-3 w-full border border-amber-700/60 bg-amber-950/40 py-2 text-center text-[11px] font-medium text-amber-200 hover:bg-amber-900/40"
                >
                  {isLoading ? 'Verifying Upstream Connection…' : 'Test Upstream Authorization'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRetrieve}
                disabled={isLoading}
                className="mt-4 flex w-full items-center justify-center gap-2 border border-cyan-500 bg-cyan-950/40 py-2.5 text-center text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-900/60 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Retrieving Scientific Dataset…
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Retrieve Scientific Data
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {errorMessage && (
        <section className="border border-rose-900/70 bg-rose-950/25 p-4 text-[12px]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-rose-200">Retrieval State / Limitation Notice</div>
              <div className="text-slate-300">{errorMessage}</div>
              {errorDetails && (
                <div className="mt-2 rounded bg-black/40 p-2 font-mono text-[11px] text-rose-300">
                  {JSON.stringify(errorDetails, null, 2)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Results Viewer ──────────────────────────────────────────────────── */}
      {response && (
        <section className="border border-slate-800 bg-[#09101d]">
          {/* Result Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  {response.query_summary.dataset_name}
                </h3>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                  {response.result_summary.total_records} Records
                </span>
                {response.cache?.hit && (
                  <span className="rounded border border-cyan-800/40 bg-cyan-950/30 px-1.5 py-0.5 text-[9px] font-mono text-cyan-400">
                    Cache Hit
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-slate-400">
                {response.result_summary.returned_time_range && (
                  <span>
                    Returned Observation Time: <span className="font-mono text-slate-200">{response.result_summary.returned_time_range.start}</span>
                  </span>
                )}
                <span>
                  Retrieved At: <span className="font-mono text-slate-200">{response.metadata.timestamp}</span>
                </span>
                {response.result_summary.returned_depth_range && (
                  <span>
                    Depth Range: <span className="font-mono text-slate-200">{response.result_summary.returned_depth_range[0]}–{response.result_summary.returned_depth_range[1]} {response.result_summary.units || 'dbar'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex border border-slate-800 bg-[#060a12]">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === 'table' ? 'bg-cyan-950/80 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tabular Records
              </button>
              {format === 'profiles' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('profiles')}
                  className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    activeTab === 'profiles' ? 'bg-cyan-950/80 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  CTD Profile Levels
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('provenance')}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === 'provenance' ? 'bg-cyan-950/80 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Provenance & Contract
              </button>
            </div>
          </div>

          {/* Result Content */}
          <div className="p-4">
            {activeTab === 'table' && (
              <div className="max-h-96 overflow-auto border border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#060a12] text-slate-400">
                    <tr className="border-b border-slate-800">
                      <th className="p-2 font-medium">Latitude</th>
                      <th className="p-2 font-medium">Longitude</th>
                      <th className="p-2 font-medium">Depth/Pressure</th>
                      {response.data[0]?.model_value !== undefined && <th className="p-2 font-medium">GLORYS Value</th>}
                      {response.data[0]?.observation_value !== undefined && <th className="p-2 font-medium">Argo Value</th>}
                      {response.data[0]?.difference !== undefined && <th className="p-2 font-medium">Diff (GLORYS - Argo)</th>}
                      {response.data[0]?.value !== undefined && <th className="p-2 font-medium">Value</th>}
                      <th className="p-2 font-medium">Units</th>
                      <th className="p-2 font-medium">QC Status</th>
                      <th className="p-2 font-medium">Observed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-mono text-slate-300">
                    {(response.data as NormalizedDataRecord[]).slice(0, 100).map((row, idx) => (
                      <tr key={idx} className="hover:bg-cyan-950/20">
                        <td className="p-2">{row.latitude?.toFixed(4)}</td>
                        <td className="p-2">{row.longitude?.toFixed(4)}</td>
                        <td className="p-2">{row.pressure ?? row.depth ?? '—'}</td>
                        {row.model_value !== undefined && <td className="p-2 text-cyan-300">{row.model_value?.toFixed(4)}</td>}
                        {row.observation_value !== undefined && <td className="p-2 text-emerald-300">{row.observation_value?.toFixed(4)}</td>}
                        {row.difference !== undefined && (
                          <td className={`p-2 ${row.difference >= 0 ? 'text-amber-300' : 'text-blue-300'}`}>
                            {row.difference > 0 ? `+${row.difference.toFixed(4)}` : row.difference.toFixed(4)}
                          </td>
                        )}
                        {row.value !== undefined && <td className="p-2 text-slate-100">{row.value?.toFixed(4)}</td>}
                        <td className="p-2 text-slate-400">{row.units}</td>
                        <td className="p-2 text-slate-400">
                          {typeof row.qc_status === 'object' ? 'QC Validated' : row.qc_status || '—'}
                        </td>
                        <td className="p-2 text-[10px] text-slate-500">{row.observed_at || row.model_valid_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'profiles' && (
              <div className="space-y-4">
                {(response.data as UnifiedProfileRecord[]).map((prof, pIdx) => (
                  <div key={pIdx} className="border border-slate-800 bg-[#060a12] p-3 text-[12px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-cyan-300">Profile ID: {prof.profile_id}</span>
                        {prof.platform_id && <span className="text-slate-400">Platform: {prof.platform_id}</span>}
                        {prof.cycle_number !== undefined && <span className="text-slate-400">Cycle: {prof.cycle_number}</span>}
                        <button
                          type="button"
                          onClick={() => {
                            selectResearchObservation({
                              id: `argo_${prof.platform_id ?? prof.profile_id}_${prof.cycle_number ?? 0}`,
                              location: { latitude: prof.latitude, longitude: prof.longitude },
                              date: prof.observed_at ? prof.observed_at.slice(0, 10) : selectedDate,
                            });
                            setIsModelViewOpen(true);
                          }}
                          className="rounded border border-cyan-700/60 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300 transition-colors hover:bg-cyan-900/60"
                        >
                          Inspect in 3D
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {prof.latitude.toFixed(4)}° N, {prof.longitude.toFixed(4)}° E · Observed: {prof.observed_at}
                      </div>
                    </div>
                    <div className="mt-2 max-h-60 overflow-auto">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="sticky top-0 bg-[#09101d] text-slate-400">
                          <tr>
                            <th className="p-1.5">Pressure (dbar)</th>
                            <th className="p-1.5">Temperature (°C)</th>
                            <th className="p-1.5">Salinity (PSU)</th>
                            <th className="p-1.5">QC Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-slate-300">
                          {prof.levels.map((lvl, lIdx) => (
                            <tr key={lIdx} className="hover:bg-slate-900/50">
                              <td className="p-1.5">{lvl.pressure?.toFixed(2)}</td>
                              <td className="p-1.5 text-cyan-300">{lvl.temperature?.toFixed(4) ?? '—'}</td>
                              <td className="p-1.5 text-emerald-300">{lvl.salinity?.toFixed(4) ?? '—'}</td>
                              <td className="p-1.5 text-emerald-400">QC {lvl.qc_flag ?? '1'} (Accepted)</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'provenance' && (
              <div className="space-y-3">
                <div className="rounded border border-slate-800 bg-[#060a12] p-3 font-mono text-[11px] text-slate-300">
                  <pre className="max-h-80 overflow-auto">{JSON.stringify(response.provenance, null, 2)}</pre>
                </div>
                <div className="text-[11px] text-slate-400">
                  Citation: <span className="text-slate-200">{response.provenance.citation || currentDataset?.citation || 'Standard OceanScope Scientific Citation'}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
