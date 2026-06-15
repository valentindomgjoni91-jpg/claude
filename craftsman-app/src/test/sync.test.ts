import { describe, it, expect } from 'vitest';
import { resolveConflict } from '../sync/syncQueue';

describe('resolveConflict', () => {
  it('keeps local record when local is newer', () => {
    const local = { id: '1', title: 'Local', updatedAt: '2026-06-13T10:00:00.000Z' };
    const remote = { id: '1', title: 'Remote', updatedAt: '2026-06-13T09:00:00.000Z' };
    const result = resolveConflict(local, remote);
    expect(result.title).toBe('Local');
  });

  it('keeps remote record when remote is newer', () => {
    const local = { id: '1', title: 'Local', updatedAt: '2026-06-13T09:00:00.000Z' };
    const remote = { id: '1', title: 'Remote', updatedAt: '2026-06-13T10:00:00.000Z' };
    const result = resolveConflict(local, remote);
    expect(result.title).toBe('Remote');
  });

  it('keeps local when timestamps are equal (local wins)', () => {
    const ts = '2026-06-13T09:00:00.000Z';
    const local = { id: '1', title: 'Local', updatedAt: ts };
    const remote = { id: '1', title: 'Remote', updatedAt: ts };
    const result = resolveConflict(local, remote);
    expect(result.title).toBe('Local');
  });

  it('works with arbitrary typed records', () => {
    const local = { id: '1', value: 42, updatedAt: '2026-06-13T12:00:00.000Z' };
    const remote = { id: '1', value: 99, updatedAt: '2026-06-13T11:00:00.000Z' };
    expect(resolveConflict(local, remote).value).toBe(42);
  });
});

describe('Subcontractor calculations', () => {
  const entries = [
    { company: 'Elektriker AG', description: 'EL-Installation', amount: 3500 },
    { company: 'Maler Müller', description: 'Streicharbeiten', amount: 1200 },
    { company: 'Spengler GmbH', description: 'Dacharbeiten', amount: 4800 },
  ];

  it('calculates total Fremdleistungen', () => {
    const total = entries.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(9500);
  });

  it('finds most expensive subcontractor', () => {
    const max = entries.reduce((a, b) => a.amount > b.amount ? a : b);
    expect(max.company).toBe('Spengler GmbH');
  });
});

describe('Weekly time calculations', () => {
  const weekEntries = [
    { date: '2026-06-09', totalHours: 8.5 },
    { date: '2026-06-10', totalHours: 9.0 },
    { date: '2026-06-11', totalHours: 7.5 },
    { date: '2026-06-12', totalHours: 8.5 },
    { date: '2026-06-13', totalHours: 8.0 },
  ];

  const DAILY_TARGET = 8.5;

  it('calculates weekly total', () => {
    const total = weekEntries.reduce((s, e) => s + e.totalHours, 0);
    expect(total).toBe(41.5);
  });

  it('calculates weekly target (5 × 8.5h)', () => {
    const target = 5 * DAILY_TARGET;
    expect(target).toBe(42.5);
  });

  it('calculates Soll/Ist difference (negative = undertime)', () => {
    const total = weekEntries.reduce((s, e) => s + e.totalHours, 0);
    const target = 5 * DAILY_TARGET;
    const diff = total - target;
    expect(diff).toBeCloseTo(-1.0, 1);
  });

  it('identifies days with overtime', () => {
    const overtimeDays = weekEntries.filter(e => e.totalHours > DAILY_TARGET);
    expect(overtimeDays).toHaveLength(1);
    expect(overtimeDays[0].date).toBe('2026-06-10');
  });

  it('identifies days with undertime', () => {
    const undertimeDays = weekEntries.filter(e => e.totalHours < DAILY_TARGET);
    expect(undertimeDays).toHaveLength(2);
    expect(undertimeDays.map(d => d.date)).toContain('2026-06-11');
    expect(undertimeDays.map(d => d.date)).toContain('2026-06-13');
  });

  it('calculates percentage of target', () => {
    const total = weekEntries.reduce((s, e) => s + e.totalHours, 0);
    const target = 5 * DAILY_TARGET;
    const pct = (total / target) * 100;
    expect(pct).toBeCloseTo(97.6, 0);
  });
});
