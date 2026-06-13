import { useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { getPendingCount, clearSynced } from './syncQueue';

const SYNC_INTERVAL_MS = 30_000;

export function useSyncStatus() {
  const { isOnline, setSyncPending } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingCount = useLiveQuery(
    () => db.syncQueue.where('synced').equals(0).count(),
    []
  );

  useEffect(() => {
    setSyncPending(pendingCount ?? 0);
  }, [pendingCount, setSyncPending]);

  const attemptSync = useCallback(async () => {
    if (!isOnline) return;
    const count = await getPendingCount();
    if (count === 0) {
      await clearSynced();
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      attemptSync();
      intervalRef.current = setInterval(attemptSync, SYNC_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, attemptSync]);

  return { pendingCount: pendingCount ?? 0 };
}
