import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { todayISO, nowISO } from '../utils';

/**
 * Duplicates a daily report with all its entries (time, material, machine, subcontractor).
 * Photos are NOT copied (they're large and site-specific).
 * Returns the new report ID.
 */
export async function duplicateDailyReport(sourceId: string): Promise<string> {
  const [source, timeEntries, materialEntries, machineEntries, subEntries] = await Promise.all([
    db.dailyReports.get(sourceId),
    db.timeEntries.where('reportId').equals(sourceId).toArray(),
    db.materialEntries.where('reportId').equals(sourceId).filter(e => e.reportType === 'daily').toArray(),
    db.machineEntries.where('reportId').equals(sourceId).filter(e => e.reportType === 'daily').toArray(),
    db.subcontractorEntries.where('reportId').equals(sourceId).toArray(),
  ]);

  if (!source) throw new Error(`Daily report ${sourceId} not found`);

  const newId = uuidv4();
  const now = nowISO();
  const today = todayISO();

  // Copy report header with new date and draft status; clear signature
  await db.dailyReports.add({
    ...source,
    id: newId,
    date: today,
    title: `Kopie – ${source.title}`,
    status: 'draft',
    customerSignature: undefined,
    customerName: undefined,
    signedAt: undefined,
    createdAt: now,
    updatedAt: now,
  });

  // Copy all entries with new reportId
  const newTimeEntries = timeEntries.map(e => ({ ...e, id: uuidv4(), reportId: newId, date: today }));
  const newMaterialEntries = materialEntries.map(e => ({ ...e, id: uuidv4(), reportId: newId }));
  const newMachineEntries = machineEntries.map(e => ({ ...e, id: uuidv4(), reportId: newId }));
  const newSubEntries = subEntries.map(e => ({ ...e, id: uuidv4(), reportId: newId }));

  await Promise.all([
    newTimeEntries.length > 0 ? db.timeEntries.bulkAdd(newTimeEntries) : Promise.resolve(),
    newMaterialEntries.length > 0 ? db.materialEntries.bulkAdd(newMaterialEntries) : Promise.resolve(),
    newMachineEntries.length > 0 ? db.machineEntries.bulkAdd(newMachineEntries) : Promise.resolve(),
    newSubEntries.length > 0 ? db.subcontractorEntries.bulkAdd(newSubEntries) : Promise.resolve(),
  ]);

  return newId;
}

/**
 * Duplicates a regi report with all its positions.
 * Clears signature and resets to draft.
 * Returns the new report ID.
 */
export async function duplicateRegiReport(sourceId: string): Promise<string> {
  const [source, positions] = await Promise.all([
    db.regiReports.get(sourceId),
    db.regiPositions.where('regiReportId').equals(sourceId).toArray(),
  ]);

  if (!source) throw new Error(`Regi report ${sourceId} not found`);

  const newId = uuidv4();
  const now = nowISO();

  await db.regiReports.add({
    ...source,
    id: newId,
    date: todayISO(),
    title: `Kopie – ${source.title}`,
    status: 'draft',
    customerSignature: undefined,
    customerName: undefined,
    signedAt: undefined,
    createdAt: now,
    updatedAt: now,
  });

  const newPositions = positions.map(p => ({ ...p, id: uuidv4(), regiReportId: newId }));
  if (newPositions.length > 0) {
    await db.regiPositions.bulkAdd(newPositions);
  }

  return newId;
}
