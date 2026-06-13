import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { nowISO } from '../utils';
import type { RegiReport, RegiPosition } from '../types';

export function useRegiReports(projectId?: string) {
  return useLiveQuery(
    () => projectId
      ? db.regiReports.where('projectId').equals(projectId).reverse().sortBy('date')
      : db.regiReports.orderBy('date').reverse().toArray(),
    [projectId]
  );
}

export function useRegiReport(id: string | undefined) {
  return useLiveQuery(() => id ? db.regiReports.get(id) : undefined, [id]);
}

export function useRegiPositions(regiReportId: string | undefined) {
  return useLiveQuery(
    () => regiReportId
      ? db.regiPositions.where('regiReportId').equals(regiReportId).sortBy('sortOrder')
      : [],
    [regiReportId]
  );
}

export async function createRegiReport(data: Omit<RegiReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = uuidv4();
  await db.regiReports.add({ ...data, id, createdAt: nowISO(), updatedAt: nowISO() });
  return id;
}

export async function updateRegiReport(id: string, data: Partial<RegiReport>): Promise<void> {
  await db.regiReports.update(id, { ...data, updatedAt: nowISO() });
}

export async function signRegiReport(id: string, customerName: string, signature: string): Promise<void> {
  await db.regiReports.update(id, {
    customerName,
    customerSignature: signature,
    signedAt: nowISO(),
    status: 'signed',
    updatedAt: nowISO(),
  });
}

export async function addRegiPosition(position: Omit<RegiPosition, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.regiPositions.add({ ...position, id });
  return id;
}

export async function updateRegiPosition(id: string, data: Partial<RegiPosition>): Promise<void> {
  await db.regiPositions.update(id, data);
}

export async function deleteRegiPosition(id: string): Promise<void> {
  await db.regiPositions.delete(id);
}
