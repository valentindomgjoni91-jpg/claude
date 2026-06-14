import { db } from '../db';

const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<void> {
  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    projects: await db.projects.toArray(),
    dailyReports: await db.dailyReports.toArray(),
    timeEntries: await db.timeEntries.toArray(),
    materialEntries: await db.materialEntries.toArray(),
    machineEntries: await db.machineEntries.toArray(),
    subcontractorEntries: await db.subcontractorEntries.toArray(),
    regiReports: await db.regiReports.toArray(),
    regiPositions: await db.regiPositions.toArray(),
    employees: await db.employees.toArray(),
    machines: await db.machines.toArray(),
    materials: await db.materials.toArray(),
    photos: await db.photos.toArray(),
    company: await db.company.toArray(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `craftsman-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  try {
    const text = await file.text();
    const data = JSON.parse(text) as Record<string, unknown>;

    if (typeof data.version !== 'number' || !data.exportedAt) {
      return { imported: 0, errors: ['Ungültiges Backup-Format'] };
    }

    const entries: { key: string; rows: unknown[] }[] = [
      { key: 'projects', rows: data.projects as unknown[] ?? [] },
      { key: 'dailyReports', rows: data.dailyReports as unknown[] ?? [] },
      { key: 'timeEntries', rows: data.timeEntries as unknown[] ?? [] },
      { key: 'materialEntries', rows: data.materialEntries as unknown[] ?? [] },
      { key: 'machineEntries', rows: data.machineEntries as unknown[] ?? [] },
      { key: 'subcontractorEntries', rows: data.subcontractorEntries as unknown[] ?? [] },
      { key: 'regiReports', rows: data.regiReports as unknown[] ?? [] },
      { key: 'regiPositions', rows: data.regiPositions as unknown[] ?? [] },
      { key: 'employees', rows: data.employees as unknown[] ?? [] },
      { key: 'machines', rows: data.machines as unknown[] ?? [] },
      { key: 'materials', rows: data.materials as unknown[] ?? [] },
      { key: 'photos', rows: data.photos as unknown[] ?? [] },
      { key: 'company', rows: data.company as unknown[] ?? [] },
    ];

    for (const { key, rows } of entries) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)[key].bulkPut(rows);
        imported += rows.length;
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : 'Fehler'}`);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'JSON-Parsing-Fehler');
  }

  return { imported, errors };
}
