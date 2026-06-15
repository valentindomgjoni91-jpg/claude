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

  const employeeIds = [uuidv4(), uuidv4(), uuidv4()];
  await db.employees.bulkAdd([
    { id: employeeIds[0], firstName: 'Hans', lastName: 'Müller', role: 'foreman', hourlyRate: 75, active: true },
    { id: employeeIds[1], firstName: 'Peter', lastName: 'Schmid', role: 'worker', hourlyRate: 65, active: true },
    { id: employeeIds[2], firstName: 'Anna', lastName: 'Keller', role: 'office', hourlyRate: 70, active: true },
  ]);

  await db.machines.bulkAdd([
    { id: uuidv4(), name: 'Bagger CAT 320', type: 'Bagger', licensePlate: 'ZH 123 456', hourlyRate: 120, active: true },
    { id: uuidv4(), name: 'Mercedes Sprinter', type: 'Fahrzeug', licensePlate: 'ZH 654 321', hourlyRate: 45, active: true },
    { id: uuidv4(), name: 'Rüttelplatte Wacker', type: 'Maschine', hourlyRate: 25, active: true },
  ]);

  await db.materials.bulkAdd([
    { id: uuidv4(), name: 'Beton C25/30', unit: 'm³', unitPrice: 180, category: 'Beton', active: true },
    { id: uuidv4(), name: 'Kies 0-32', unit: 'to', unitPrice: 45, category: 'Schüttgut', active: true },
    { id: uuidv4(), name: 'Armierungsstahl', unit: 'kg', unitPrice: 2.5, category: 'Stahl', active: true },
    { id: uuidv4(), name: 'Schalung', unit: 'm²', unitPrice: 35, category: 'Holz', active: true },
  ]);

  const projectId = uuidv4();
  await db.projects.add({
    id: projectId,
    title: 'Neubau Einfamilienhaus Muster',
    clientName: 'Familie Muster',
    clientContact: 'Max Muster, +41 79 123 45 67',
    siteAddress: 'Baustrasse 10, 8002 Zürich',
    description: 'Neubau EFH mit Garage und Gartenanlage',
    status: 'active',
    responsibleId: employeeIds[0],
    startDate: '2026-03-01',
    createdAt: now,
    updatedAt: now,
  });
}

export async function cleanupDemoData(): Promise<void> {
  try {
    const demoNames = [
      { firstName: 'Hans', lastName: 'Müller' },
      { firstName: 'Peter', lastName: 'Schmid' },
      { firstName: 'Anna', lastName: 'Keller' },
    ];
    for (const { firstName, lastName } of demoNames) {
      const employees = await db.employees
        .where('lastName').equals(lastName)
        .filter(e => e.firstName === firstName)
        .toArray();
      for (const emp of employees) {
        await db.employees.delete(emp.id);
      }
    }
    const demoProjects = await db.projects
      .filter(p => p.title === 'Neubau Einfamilienhaus Muster')
      .toArray();
    for (const proj of demoProjects) {
      await db.projects.delete(proj.id);
    }
  } catch {
    // silently ignore errors
  }
}
