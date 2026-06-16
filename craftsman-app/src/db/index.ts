import Dexie, { type Table } from 'dexie';
import type {
  Project, DailyReport, TimeEntry, MaterialEntry, MachineEntry,
  SubcontractorEntry, Photo, RegiReport, RegiPosition,
  Employee, Machine, Material, Company, SyncQueueItem, LeistungEntry,
} from '../types';

export class CraftsmanDB extends Dexie {
  projects!: Table<Project>;
  dailyReports!: Table<DailyReport>;
  timeEntries!: Table<TimeEntry>;
  materialEntries!: Table<MaterialEntry>;
  machineEntries!: Table<MachineEntry>;
  subcontractorEntries!: Table<SubcontractorEntry>;
  photos!: Table<Photo>;
  regiReports!: Table<RegiReport>;
  regiPositions!: Table<RegiPosition>;
  employees!: Table<Employee>;
  machines!: Table<Machine>;
  materials!: Table<Material>;
  company!: Table<Company>;
  syncQueue!: Table<SyncQueueItem>;
  leistungEntries!: Table<LeistungEntry>;

  constructor() {
    super('CraftsmanDB');
    this.version(1).stores({
      projects: 'id, status, clientName, createdAt, updatedAt',
      dailyReports: 'id, projectId, date, status, createdAt',
      timeEntries: 'id, reportId, reportType, employeeId, date',
      materialEntries: 'id, reportId, reportType',
      machineEntries: 'id, reportId, reportType',
      subcontractorEntries: 'id, reportId',
      photos: 'id, reportId, reportType, timestamp',
      regiReports: 'id, projectId, date, status, createdAt',
      regiPositions: 'id, regiReportId, type, sortOrder',
      employees: 'id, active, lastName',
      machines: 'id, active, name',
      materials: 'id, active, name, category',
      company: 'id',
      syncQueue: 'id, tableName, synced, createdAt',
    });
    this.version(2).stores({
      leistungEntries: 'id, reportId, createdAt',
    });
  }
}

export const db = new CraftsmanDB();

export async function seedDefaultData(): Promise<void> {
  const companyCount = await db.company.count();
  if (companyCount > 0) return;

  const { v4: uuidv4 } = await import('uuid');
  const now = new Date().toISOString();

  await db.company.add({
    id: uuidv4(),
    name: 'Muster Handwerk GmbH',
    street: 'Musterstrasse 1',
    city: 'Zürich',
    zip: '8001',
    phone: '+41 44 123 45 67',
    email: 'info@musterhandwerk.ch',
    vatNumber: 'CHE-123.456.789',
    footerText: 'Zahlbar innert 30 Tagen. Vielen Dank für Ihr Vertrauen.',
  });

  const projectId = uuidv4();
  await db.projects.add({
    id: projectId,
    title: 'Neubau Einfamilienhaus Muster',
    clientName: 'Familie Muster',
    clientContact: 'Max Muster, +41 79 123 45 67',
    siteAddress: 'Baustrasse 10, 8002 Zürich',
    description: 'Neubau EFH mit Garage und Gartenanlage',
    status: 'active',
    startDate: '2026-03-01',
    createdAt: now,
    updatedAt: now,
  });
}

export async function cleanupDemoData(): Promise<void> {
  try {
    const demoEmployees = [
      { firstName: 'Hans', lastName: 'Müller' },
      { firstName: 'Peter', lastName: 'Schmid' },
      { firstName: 'Anna', lastName: 'Keller' },
    ];
    for (const { firstName, lastName } of demoEmployees) {
      const found = await db.employees
        .where('lastName').equals(lastName)
        .filter(e => e.firstName === firstName)
        .toArray();
      for (const emp of found) await db.employees.delete(emp.id);
    }

    const demoMachineNames = ['Bagger CAT 320', 'Mercedes Sprinter', 'Rüttelplatte Wacker'];
    for (const name of demoMachineNames) {
      const found = await db.machines.where('name').equals(name).toArray();
      for (const m of found) await db.machines.delete(m.id);
    }

    const demoMaterialNames = ['Beton C25/30', 'Kies 0-32', 'Armierungsstahl', 'Schalung'];
    for (const name of demoMaterialNames) {
      const found = await db.materials.where('name').equals(name).toArray();
      for (const m of found) await db.materials.delete(m.id);
    }

    const demoProjects = await db.projects
      .filter(p => p.title === 'Neubau Einfamilienhaus Muster')
      .toArray();
    for (const proj of demoProjects) await db.projects.delete(proj.id);
  } catch {
    // silently ignore errors
  }
}
