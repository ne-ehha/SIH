import { useState, useCallback } from 'react';
import type { ApiState } from '@/types/api';

export function useApiState<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<ApiState>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setState(result ? 'success' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setState('error');
    }
  }, [fetcher]);

  const retry = useCallback(() => {
    execute();
  }, [execute]);

  const reset = useCallback(() => {
    setState('idle');
    setData(null);
    setError(null);
  }, []);

  return { state, data, error, execute, retry, reset };
}
