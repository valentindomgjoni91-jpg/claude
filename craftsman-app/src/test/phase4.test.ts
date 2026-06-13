import { describe, it, expect } from 'vitest';
import { calcTotalHours } from '../utils';

// ---- Archive filter logic ----

type ReportType = 'all' | 'daily' | 'regi';
type SortOrder = 'newest' | 'oldest';
type StatusFilter = 'all' | 'draft' | 'completed' | 'signed' | 'invoiced';

interface UnifiedReport {
  id: string;
  type: 'daily' | 'regi';
  title: string;
  date: string;
  status: string;
  projectId: string;
}

function filterReports(
  reports: UnifiedReport[],
  opts: {
    search?: string;
    typeFilter?: ReportType;
    statusFilter?: StatusFilter;
    projectId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: SortOrder;
  }
): UnifiedReport[] {
  const { search = '', typeFilter = 'all', statusFilter = 'all', projectId = '', dateFrom = '', dateTo = '', sortOrder = 'newest' } = opts;
  let result = [...reports];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(r => r.title.toLowerCase().includes(q));
  }
  if (typeFilter !== 'all') result = result.filter(r => r.type === typeFilter);
  if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
  if (projectId) result = result.filter(r => r.projectId === projectId);
  if (dateFrom) result = result.filter(r => r.date >= dateFrom);
  if (dateTo) result = result.filter(r => r.date <= dateTo);
  result.sort((a, b) => sortOrder === 'newest'
    ? b.date.localeCompare(a.date)
    : a.date.localeCompare(b.date)
  );
  return result;
}

const SAMPLE_REPORTS: UnifiedReport[] = [
  { id: '1', type: 'daily', title: 'Tagesrapport Neubau', date: '2026-06-01', status: 'completed', projectId: 'p1' },
  { id: '2', type: 'daily', title: 'Tagesrapport Renovation', date: '2026-06-05', status: 'draft', projectId: 'p2' },
  { id: '3', type: 'regi', title: 'Regierapport Büro', date: '2026-06-10', status: 'signed', projectId: 'p1' },
  { id: '4', type: 'regi', title: 'Regierapport Garage', date: '2026-06-13', status: 'invoiced', projectId: 'p2' },
  { id: '5', type: 'daily', title: 'Abschlussrapport Neubau', date: '2026-05-28', status: 'completed', projectId: 'p1' },
];

describe('Archive filter logic', () => {
  it('returns all reports when no filters applied', () => {
    expect(filterReports(SAMPLE_REPORTS, {})).toHaveLength(5);
  });

  it('filters by search term (case-insensitive)', () => {
    const result = filterReports(SAMPLE_REPORTS, { search: 'neubau' });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.title.toLowerCase().includes('neubau'))).toBe(true);
  });

  it('filters by type daily', () => {
    const result = filterReports(SAMPLE_REPORTS, { typeFilter: 'daily' });
    expect(result).toHaveLength(3);
    expect(result.every(r => r.type === 'daily')).toBe(true);
  });

  it('filters by type regi', () => {
    const result = filterReports(SAMPLE_REPORTS, { typeFilter: 'regi' });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.type === 'regi')).toBe(true);
  });

  it('filters by status draft', () => {
    const result = filterReports(SAMPLE_REPORTS, { statusFilter: 'draft' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by status invoiced', () => {
    const result = filterReports(SAMPLE_REPORTS, { statusFilter: 'invoiced' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('invoiced');
  });

  it('filters by project', () => {
    const result = filterReports(SAMPLE_REPORTS, { projectId: 'p1' });
    expect(result).toHaveLength(3);
    expect(result.every(r => r.projectId === 'p1')).toBe(true);
  });

  it('filters by date range (from)', () => {
    const result = filterReports(SAMPLE_REPORTS, { dateFrom: '2026-06-05' });
    expect(result.every(r => r.date >= '2026-06-05')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('filters by date range (to)', () => {
    const result = filterReports(SAMPLE_REPORTS, { dateTo: '2026-06-05' });
    expect(result.every(r => r.date <= '2026-06-05')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('filters by date range (both)', () => {
    const result = filterReports(SAMPLE_REPORTS, { dateFrom: '2026-06-01', dateTo: '2026-06-10' });
    expect(result).toHaveLength(3);
  });

  it('combines type and status filter', () => {
    const result = filterReports(SAMPLE_REPORTS, { typeFilter: 'daily', statusFilter: 'completed' });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.type === 'daily' && r.status === 'completed')).toBe(true);
  });
});

describe('Archive sort order', () => {
  it('sorts newest first by default', () => {
    const result = filterReports(SAMPLE_REPORTS, { sortOrder: 'newest' });
    expect(result[0].date >= result[1].date).toBe(true);
    expect(result[result.length - 1].date).toBe('2026-05-28');
  });

  it('sorts oldest first', () => {
    const result = filterReports(SAMPLE_REPORTS, { sortOrder: 'oldest' });
    expect(result[0].date).toBe('2026-05-28');
    expect(result[result.length - 1].date).toBe('2026-06-13');
  });
});

describe('Active filter count', () => {
  function countActiveFilters(opts: {
    search?: string;
    typeFilter?: ReportType;
    statusFilter?: StatusFilter;
    projectId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): number {
    return [
      (opts.search ?? '') !== '',
      (opts.typeFilter ?? 'all') !== 'all',
      (opts.statusFilter ?? 'all') !== 'all',
      (opts.projectId ?? '') !== '',
      (opts.dateFrom ?? '') !== '',
      (opts.dateTo ?? '') !== '',
    ].filter(Boolean).length;
  }

  it('returns 0 when no filters active', () => {
    expect(countActiveFilters({})).toBe(0);
  });

  it('counts search as 1 filter', () => {
    expect(countActiveFilters({ search: 'Neubau' })).toBe(1);
  });

  it('counts multiple active filters', () => {
    expect(countActiveFilters({ typeFilter: 'daily', statusFilter: 'draft', dateFrom: '2026-06-01' })).toBe(3);
  });

  it('does not count default values', () => {
    expect(countActiveFilters({ typeFilter: 'all', statusFilter: 'all', search: '' })).toBe(0);
  });
});

// ---- Project statistics aggregation ----

describe('Project statistics', () => {
  const timeEntries = [
    { startTime: '07:00', endTime: '12:00', breakMinutes: 30 },
    { startTime: '12:30', endTime: '17:00', breakMinutes: 0 },
    { startTime: '08:00', endTime: '16:30', breakMinutes: 45 },
  ];

  it('aggregates total hours correctly', () => {
    const total = timeEntries.reduce(
      (sum, e) => sum + calcTotalHours(e.startTime, e.endTime, e.breakMinutes), 0
    );
    // 4.5h + 4.5h + 7.75h = 16.75h
    expect(total).toBeCloseTo(16.75, 1);
  });

  it('aggregates material costs', () => {
    const entries = [
      { quantity: 10, unitPrice: 15.5 },
      { quantity: 5, unitPrice: 100 },
      { quantity: 0.5, unitPrice: 200 },
    ];
    const total = entries.reduce((sum, e) => sum + e.quantity * e.unitPrice, 0);
    expect(total).toBeCloseTo(755, 1);
  });

  it('aggregates machine costs', () => {
    const entries = [
      { hours: 4, hourlyRate: 85 },
      { hours: 2.5, hourlyRate: 120 },
    ];
    const total = entries.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0);
    expect(total).toBeCloseTo(640, 1);
  });

  it('returns 0 for projects with no entries', () => {
    const entries: Array<{ quantity: number; unitPrice: number }> = [];
    const total = entries.reduce((sum, e) => sum + e.quantity * e.unitPrice, 0);
    expect(total).toBe(0);
  });
});

// ---- Progress bar calculation ----

describe('Project progress bar', () => {
  function calcProgress(startDate: string, endDate: string, nowDate: string): number | null {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = new Date(nowDate).getTime();
    if (end <= start) return null;
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  }

  it('returns null when no end date', () => {
    // simulated by passing same date
    expect(calcProgress('2026-06-01', '2026-06-01', '2026-06-10')).toBeNull();
  });

  it('returns 0% at project start', () => {
    expect(calcProgress('2026-06-01', '2026-12-31', '2026-06-01')).toBe(0);
  });

  it('returns 100% when past end date', () => {
    expect(calcProgress('2026-01-01', '2026-06-01', '2026-07-01')).toBe(100);
  });

  it('returns approximately 50% at midpoint', () => {
    const result = calcProgress('2026-06-01', '2026-06-11', '2026-06-06');
    expect(result).toBeGreaterThanOrEqual(48);
    expect(result).toBeLessThanOrEqual(52);
  });
});

// ---- Dashboard week hours ----

describe('Dashboard week hours calculation', () => {
  it('sums hours from multiple time entries', () => {
    const entries = [
      { startTime: '07:00', endTime: '15:30', breakMinutes: 30 },
      { startTime: '08:00', endTime: '16:00', breakMinutes: 30 },
    ];
    const total = entries.reduce(
      (sum, e) => sum + calcTotalHours(e.startTime, e.endTime, e.breakMinutes), 0
    );
    expect(total).toBeCloseTo(15.5, 1);
  });

  it('returns 0 when no entries', () => {
    const entries: Array<{ startTime: string; endTime: string; breakMinutes: number }> = [];
    const total = entries.reduce(
      (sum, e) => sum + calcTotalHours(e.startTime, e.endTime, e.breakMinutes), 0
    );
    expect(total).toBe(0);
  });
});
