/**
 * Scientific Historical & Date-Specific Ocean Data Service
 *
 * Provides typed methods to retrieve normalized dataset records,
 * query the authoritative dataset registry, and discover source adapter capabilities.
 */

import type {
  CanonicalVariable,
  HistoricalDataRequest,
  HistoricalDataResponse,
  RegisteredDataset,
} from '../types/unifiedData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface AdapterStatus {
  source_id: string;
  source_name: string;
  adapter_class: string;
  credentials_configured?: boolean;
  toolbox_installed?: boolean;
  status: string;
}

export class HistoricalDataService {
  /**
   * Fetch historical / date-specific ocean data via POST payload.
   */
  async retrieveData(request: HistoricalDataRequest): Promise<HistoricalDataResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/research/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const json = await response.json();
    if (!response.ok && json.status === 'error') {
      return json as HistoricalDataResponse;
    }
    return json as HistoricalDataResponse;
  }

  /**
   * Query the backend dataset registry.
   */
  async getRegisteredDatasets(source?: string, variable?: string): Promise<RegisteredDataset[]> {
    const params = new URLSearchParams();
    if (source) params.append('source', source);
    if (variable) params.append('variable', variable);

    const url = `${API_BASE_URL}/api/v1/research/registry${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load dataset registry: HTTP ${response.status}`);
    }
    const json = await response.json();
    return json.datasets || [];
  }

  /**
   * Query the canonical variable registry.
   */
  async getCanonicalVariables(): Promise<CanonicalVariable[]> {
    const url = `${API_BASE_URL}/api/v1/research/variables`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load canonical variables: HTTP ${response.status}`);
    }
    const json = await response.json();
    return json.variables || [];
  }

  /**
   * Query source adapter operational and authentication statuses.
   */
  async getAdapterStatuses(): Promise<AdapterStatus[]> {
    const url = `${API_BASE_URL}/api/v1/research/adapters/status`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load adapter statuses: HTTP ${response.status}`);
    }
    const json = await response.json();
    return json.adapters || [];
  }
}

export const historicalDataService = new HistoricalDataService();
