import { useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { getPendingCount, clearSynced } from './syncQueue';
import { loadConfig, syncNow } from './supabaseSync';
import { getSupabaseClient } from './supabaseClient';
import { showNotification } from '../utils/notifications';

const QUEUE_INTERVAL_MS = 30_000;
const SUPABASE_INTERVAL_MS = 5 * 60_000; // 5 min

export function useSyncStatus() {
  const { isOnline, setSyncPending } = useAppStore();
  const queueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingCount = useLiveQuery(
    () => db.syncQueue.filter(item => !item.synced).count(),
    []
  );

  useEffect(() => {
    setSyncPending(pendingCount ?? 0);
  }, [pendingCount, setSyncPending]);

  const attemptQueueSync = useCallback(async () => {
    if (!isOnline) return;
    const count = await getPendingCount();
    if (count === 0) await clearSynced();
  }, [isOnline]);

  const attemptSupabaseSync = useCallback(async () => {
    if (!isOnline) return;
    const cfg = loadConfig();
    if (!cfg) return;
    try {
      const result = await syncNow(cfg, undefined, getSupabaseClient() ?? undefined);
      if (result.pulled > 0) {
        showNotification('Sync', `${result.pulled} neue Einträge synchronisiert`);
      }
    } catch {
      // Silent background failure — errors surface on manual sync
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      attemptQueueSync();
      queueIntervalRef.current = setInterval(attemptQueueSync, QUEUE_INTERVAL_MS);

      // Kick off first Supabase sync shortly after coming online, then repeat
      const firstSyncTimer = setTimeout(attemptSupabaseSync, 3000);
      supabaseIntervalRef.current = setInterval(attemptSupabaseSync, SUPABASE_INTERVAL_MS);

      return () => {
        clearTimeout(firstSyncTimer);
        if (queueIntervalRef.current) clearInterval(queueIntervalRef.current);
        if (supabaseIntervalRef.current) clearInterval(supabaseIntervalRef.current);
      };
    } else {
      if (queueIntervalRef.current) clearInterval(queueIntervalRef.current);
      if (supabaseIntervalRef.current) clearInterval(supabaseIntervalRef.current);
    }
  }, [isOnline, attemptQueueSync, attemptSupabaseSync]);

  return { pendingCount: pendingCount ?? 0 };
}
