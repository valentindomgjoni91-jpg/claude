import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { nowISO } from '../utils';
import type { DailyReport, TimeEntry, MaterialEntry, MachineEntry, SubcontractorEntry, Photo } from '../types';

export function useDailyReports(projectId?: string) {
  return useLiveQuery(
    () => projectId
      ? db.dailyReports.where('projectId').equals(projectId).reverse().sortBy('date')
      : db.dailyReports.orderBy('date').reverse().toArray(),
    [projectId]
  );
}

export function useDailyReport(id: string | undefined) {
  return useLiveQuery(() => id ? db.dailyReports.get(id) : undefined, [id]);
}

export function useTimeEntries(reportId: string | undefined) {
  return useLiveQuery(
    () => reportId ? db.timeEntries.where('reportId').equals(reportId).toArray() : [],
    [reportId]
  );
}

export function useMaterialEntries(reportId: string | undefined, reportType: 'daily' | 'regi' = 'daily') {
  return useLiveQuery(
    () => reportId
      ? db.materialEntries.where('reportId').equals(reportId).filter(e => e.reportType === reportType).toArray()
      : [],
    [reportId, reportType]
  );
}

export function useMachineEntries(reportId: string | undefined, reportType: 'daily' | 'regi' = 'daily') {
  return useLiveQuery(
    () => reportId
      ? db.machineEntries.where('reportId').equals(reportId).filter(e => e.reportType === reportType).toArray()
      : [],
    [reportId, reportType]
  );
}

export function useSubcontractorEntries(reportId: string | undefined) {
  return useLiveQuery(
    () => reportId ? db.subcontractorEntries.where('reportId').equals(reportId).toArray() : [],
    [reportId]
  );
}

export function usePhotos(reportId: string | undefined) {
  return useLiveQuery(
    () => reportId ? db.photos.where('reportId').equals(reportId).sortBy('timestamp') : [],
    [reportId]
  );
}

export async function createDailyReport(data: Omit<DailyReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = uuidv4();
  await db.dailyReports.add({ ...data, id, createdAt: nowISO(), updatedAt: nowISO() });
  return id;
}

export async function updateDailyReport(id: string, data: Partial<DailyReport>): Promise<void> {
  await db.dailyReports.update(id, { ...data, updatedAt: nowISO() });
}

export async function signDailyReport(id: string, customerName: string, signature: string): Promise<void> {
  await db.dailyReports.update(id, {
    customerName,
    customerSignature: signature,
    signedAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function addTimeEntry(entry: Omit<TimeEntry, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.timeEntries.add({ ...entry, id });
  return id;
}

export async function updateTimeEntry(id: string, data: Partial<TimeEntry>): Promise<void> {
  await db.timeEntries.update(id, data);
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await db.timeEntries.delete(id);
}

export async function addMaterialEntry(entry: Omit<MaterialEntry, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.materialEntries.add({ ...entry, id });
  return id;
}

export async function updateMaterialEntry(id: string, data: Partial<MaterialEntry>): Promise<void> {
  await db.materialEntries.update(id, data);
}

export async function deleteMaterialEntry(id: string): Promise<void> {
  await db.materialEntries.delete(id);
}

export async function addMachineEntry(entry: Omit<MachineEntry, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.machineEntries.add({ ...entry, id });
  return id;
}

export async function updateMachineEntry(id: string, data: Partial<MachineEntry>): Promise<void> {
  await db.machineEntries.update(id, data);
}

export async function deleteMachineEntry(id: string): Promise<void> {
  await db.machineEntries.delete(id);
}

export async function addSubcontractorEntry(entry: Omit<SubcontractorEntry, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.subcontractorEntries.add({ ...entry, id });
  return id;
}

export async function deleteSubcontractorEntry(id: string): Promise<void> {
  await db.subcontractorEntries.delete(id);
}

export async function addPhoto(photo: Omit<Photo, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.photos.add({ ...photo, id });
  return id;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}
