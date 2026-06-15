import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { nowISO } from '../utils';
import type { LeistungEntry } from '../types';

export function useLeistungEntries(reportId: string | undefined) {
  return useLiveQuery<LeistungEntry[]>(
    () => reportId ? db.leistungEntries.where('reportId').equals(reportId).sortBy('createdAt') : Promise.resolve([]),
    [reportId]
  );
}

export async function addLeistungEntry(data: Omit<LeistungEntry, 'id' | 'createdAt'>): Promise<string> {
  const id = uuidv4();
  await db.leistungEntries.add({ ...data, id, createdAt: nowISO() });
  return id;
}

export async function deleteLeistungEntry(id: string): Promise<void> {
  await db.leistungEntries.delete(id);
}
