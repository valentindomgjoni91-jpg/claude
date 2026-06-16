import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { nowISO } from '../utils';
import type { Project, ProjectStatus } from '../types';

export function useProjects(status?: ProjectStatus) {
  return useLiveQuery(
    () => status
      ? db.projects.where('status').equals(status).sortBy('createdAt').then(arr => arr.reverse())
      : db.projects.orderBy('createdAt').reverse().toArray(),
    [status]
  );
}

export function useProject(id: string | undefined) {
  return useLiveQuery<Project | null>(
    async () => id ? (await db.projects.get(id)) ?? null : null,
    [id]
  );
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = uuidv4();
  await db.projects.add({ ...data, id, createdAt: nowISO(), updatedAt: nowISO() });
  return id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...data, updatedAt: nowISO() });
}

export async function archiveProject(id: string): Promise<void> {
  await db.projects.update(id, { status: 'archived', updatedAt: nowISO() });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [
    db.projects, db.dailyReports, db.regiReports, db.timeEntries,
    db.materialEntries, db.machineEntries, db.subcontractorEntries,
    db.regiPositions, db.photos,
  ], async () => {
    const dailyIds = (await db.dailyReports.where('projectId').equals(id).primaryKeys()) as string[];
    const regiIds = (await db.regiReports.where('projectId').equals(id).primaryKeys()) as string[];

    if (dailyIds.length > 0) {
      await Promise.all([
        db.timeEntries.where('reportId').anyOf(dailyIds).delete(),
        db.materialEntries.where('reportId').anyOf(dailyIds).delete(),
        db.machineEntries.where('reportId').anyOf(dailyIds).delete(),
        db.subcontractorEntries.where('reportId').anyOf(dailyIds).delete(),
        db.photos.where('reportId').anyOf(dailyIds).delete(),
      ]);
    }
    if (regiIds.length > 0) {
      await Promise.all([
        db.regiPositions.where('regiReportId').anyOf(regiIds).delete(),
        db.photos.where('reportId').anyOf(regiIds).delete(),
      ]);
    }

    await db.dailyReports.where('projectId').equals(id).delete();
    await db.regiReports.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}
