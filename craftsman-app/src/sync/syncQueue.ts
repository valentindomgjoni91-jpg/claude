import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { nowISO } from '../utils';
import type { SyncOperation } from '../types';

export async function queueOperation(
  tableName: string,
  operation: SyncOperation,
  recordId: string,
  data: Record<string, unknown>
): Promise<void> {
  await db.syncQueue.add({
    id: uuidv4(),
    tableName,
    operation,
    recordId,
    data,
    createdAt: nowISO(),
    synced: false,
    attempts: 0,
  });
}

export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('synced').equals(0).count();
}

export async function getPendingItems() {
  return db.syncQueue
    .where('synced').equals(0)
    .and(item => item.attempts < 5)
    .sortBy('createdAt');
}

export async function markSynced(id: string): Promise<void> {
  await db.syncQueue.update(id, { synced: true });
}

export async function incrementAttempts(id: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, { attempts: item.attempts + 1 });
  }
}

export async function clearSynced(): Promise<void> {
  await db.syncQueue.where('synced').equals(1).delete();
}

/**
 * Simulates pushing pending changes to a remote API.
 * In a real implementation, replace the fetch call with your actual API endpoint.
 */
export async function pushToServer(apiBaseUrl: string): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingItems();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const response = await fetch(`${apiBaseUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: item.tableName,
          operation: item.operation,
          recordId: item.recordId,
          data: item.data,
          clientTimestamp: item.createdAt,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        await markSynced(item.id);
        synced++;
      } else {
        await incrementAttempts(item.id);
        failed++;
      }
    } catch {
      await incrementAttempts(item.id);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Conflict resolution: last-write-wins by updatedAt timestamp.
 * Returns the record to keep.
 */
export function resolveConflict<T extends { updatedAt: string }>(
  local: T,
  remote: T
): T {
  return new Date(local.updatedAt) >= new Date(remote.updatedAt) ? local : remote;
}
