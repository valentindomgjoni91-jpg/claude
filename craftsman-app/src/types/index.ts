export type ProjectStatus = 'active' | 'completed' | 'archived';
export type ReportStatus = 'draft' | 'completed';
export type RegiStatus = 'draft' | 'signed' | 'invoiced';
export type EmployeeRole = 'admin' | 'office' | 'foreman' | 'worker';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'snowy';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface Project {
  id: string;
  title: string;
  clientName: string;
  clientContact?: string;
  siteAddress: string;
  description?: string;
  status: ProjectStatus;
  responsibleId?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  projectId: string;
  date: string;
  title: string;
  weather?: Weather;
  temperature?: number;
  notes?: string;
  status: ReportStatus;
  customerName?: string;
  customerSignature?: string;
  signedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  reportId: string;
  reportType: 'daily' | 'regi';
  employeeId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  breakMinutes: number;
  totalHours: number;
  activity?: string;
  note?: string;
}

export interface MaterialEntry {
  id: string;
  reportId: string;
  reportType: 'daily' | 'regi';
  materialId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface MachineEntry {
  id: string;
  reportId: string;
  reportType: 'daily' | 'regi';
  machineId?: string;
  description: string;
  hours: number;
  operatorId?: string;
  hourlyRate: number;
  total: number;
  note?: string;
}

export interface SubcontractorEntry {
  id: string;
  reportId: string;
  company: string;
  description: string;
  amount: number;
  note?: string;
}

export interface Photo {
  id: string;
  reportId: string;
  reportType: 'daily' | 'regi';
  timestamp: string;
  dataUrl: string;
  note?: string;
  latitude?: number;
  longitude?: number;
}

export interface RegiReport {
  id: string;
  projectId: string;
  date: string;
  title: string;
  laborConditions?: string;
  vatRate: number;
  customerName?: string;
  customerSignature?: string;
  signedAt?: string;
  status: RegiStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegiPosition {
  id: string;
  regiReportId: string;
  type: 'labor' | 'material' | 'machine' | 'extra';
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  hourlyRate: number;
  email?: string;
  phone?: string;
  active: boolean;
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  licensePlate?: string;
  hourlyRate: number;
  active: boolean;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  category?: string;
  active: boolean;
}

export interface Company {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  logoUrl?: string;
  bankAccount?: string;
  footerText?: string;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  operation: SyncOperation;
  recordId: string;
  data: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
  attempts: number;
}

export interface LeistungEntry {
  id: string;
  reportId: string;
  leistungsart: string;
  stunden: number;
  kommentar?: string;
  createdAt: string;
}
