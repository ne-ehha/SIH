/**
 * INTEG1 Integration Layer — Provider Registry
 *
 * Central place to manage which data provider is active.
 * Switch from mock to real API by calling setProvider('api') once the backend is ready.
 *
 * Usage:
 *   import { getProvider } from '@/integration';
 *   const provider = getProvider();
 *   const result = await provider.fetchComparison(request);
 */

import type { OceanDataProvider } from './provider';
import { MockOceanDataProvider } from './providers/MockOceanDataProvider';
import { ApiOceanDataProvider } from './providers/ApiOceanDataProvider';

// ── Provider instances (singletons) ─────────────────────────────────────────

const providers: Record<string, OceanDataProvider> = {
  mock: new MockOceanDataProvider(),
  api: new ApiOceanDataProvider(),
};

// ── Active provider ─────────────────────────────────────────────────────────

// Auto-select the API provider when VITE_API_BASE_URL is configured.
// Fall back to mock if no backend URL is set.
const hasApiUrl = !!(import.meta.env.VITE_API_BASE_URL);
let activeProviderKey: string = hasApiUrl ? 'api' : 'mock';

/**
 * Get the currently active data provider.
 * Components and hooks call this to fetch data.
 */
export function getProvider(): OceanDataProvider {
  return providers[activeProviderKey];
}

/**
 * Switch the active provider.
 * Call setProvider('api') when the real backend is ready.
 *
 * @param key - 'mock' | 'api' (or any key registered via registerProvider)
 */
export function setProvider(key: string): void {
  if (!providers[key]) {
    throw new Error(
      `Provider "${key}" not registered. Available: ${Object.keys(providers).join(', ')}`
    );
  }
  activeProviderKey = key;
}

/**
 * Get the key of the currently active provider.
 */
export function getActiveProviderKey(): string {
  return activeProviderKey;
}

/**
 * Register a new provider at runtime.
 * Useful if Ayan's API provider is loaded lazily.
 *
 * @param key - identifier for the provider
 * @param provider - provider instance
 */
export function registerProvider(key: string, provider: OceanDataProvider): void {
  providers[key] = provider;
}

/**
 * Get list of all registered provider keys.
 */
export function getRegisteredProviders(): string[] {
  return Object.keys(providers);
}
