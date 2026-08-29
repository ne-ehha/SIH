import type { ApiResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      return {
        status: 'error',
        error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}: ${response.statusText}` },
      };
    }
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unable to connect to server.',
      },
    };
  }
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return {
        status: 'error',
        error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}: ${response.statusText}` },
      };
    }
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unable to connect to server.',
      },
    };
  }
}
