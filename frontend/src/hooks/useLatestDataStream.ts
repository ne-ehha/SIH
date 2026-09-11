import { useEffect, useSyncExternalStore } from 'react';
import {
  getLatestDataStreamState, refreshLatestDataStream, startLatestDataStream,
  stopLatestDataStream, subscribeLatestDataStream,
} from '@/services/latestDataStream';

/** Shared subscription: no screen owns a second Argo fetch loop. */
export function useLatestDataStream() {
  const stream = useSyncExternalStore(subscribeLatestDataStream, getLatestDataStreamState, getLatestDataStreamState);
  useEffect(() => { startLatestDataStream(); return stopLatestDataStream; }, []);
  return { ...stream, refreshNow: () => refreshLatestDataStream(true) };
}
