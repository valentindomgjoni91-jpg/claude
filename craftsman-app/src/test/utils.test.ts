import { describe, it, expect } from 'vitest';
import {
  calcTotalHours,
  formatHours,
  formatCurrency,
  formatDate,
  todayISO,
} from '../utils';

describe('calcTotalHours', () => {
  it('calculates hours without break', () => {
    expect(calcTotalHours('07:00', '17:00', 0)).toBe(10);
  });

  it('calculates hours with 30 minute break', () => {
    expect(calcTotalHours('07:00', '17:00', 30)).toBe(9.5);
  });

  it('calculates hours with 60 minute break', () => {
    expect(calcTotalHours('08:00', '16:00', 60)).toBe(7);
  });

  it('returns 0 for invalid range (end before start)', () => {
    expect(calcTotalHours('17:00', '07:00', 0)).toBe(0);
  });

  it('calculates half-day correctly', () => {
    expect(calcTotalHours('08:00', '12:00', 0)).toBe(4);
  });

  it('handles 45-minute break', () => {
    expect(calcTotalHours('07:00', '17:00', 45)).toBeCloseTo(9.25, 2);
  });

  it('calculates fractional hours correctly', () => {
    expect(calcTotalHours('08:00', '08:30', 0)).toBe(0.5);
  });
});

describe('formatHours', () => {
  it('formats whole hours', () => {
    expect(formatHours(8)).toBe('8h');
  });

  it('formats hours with minutes', () => {
    expect(formatHours(8.5)).toBe('8h 30m');
  });

  it('formats only minutes', () => {
    expect(formatHours(0.5)).toBe('0h 30m');
  });

  it('formats zero', () => {
    expect(formatHours(0)).toBe('0h');
  });

  it('formats 9.25 hours', () => {
    expect(formatHours(9.25)).toBe('9h 15m');
  });
});

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('CHF');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats large amounts', () => {
    const result = formatCurrency(99999.99);
    expect(result).toContain('CHF');
  });
});

describe('formatDate', () => {
  it('formats ISO date string to German format', () => {
    expect(formatDate('2026-06-13')).toBe('13.06.2026');
  });

  it('formats date object', () => {
    const d = new Date(2026, 5, 1); // June 1, 2026
    expect(formatDate(d)).toBe('01.06.2026');
  });
});

describe('todayISO', () => {
  it('returns a valid ISO date string', () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns current date', () => {
    const today = todayISO();
    const now = new Date();
    expect(today).toBe(now.toISOString().split('T')[0]);
  });
});

describe('Material total calculation', () => {
  it('calculates total from quantity and unitPrice', () => {
    const quantity = 5;
    const unitPrice = 45;
    expect(quantity * unitPrice).toBe(225);
  });

  it('calculates VAT amount', () => {
    const netTotal = 1000;
    const vatRate = 8.1;
    const vatAmount = netTotal * (vatRate / 100);
    expect(vatAmount).toBeCloseTo(81, 1);
  });

  it('calculates gross total', () => {
    const netTotal = 1000;
    const vatRate = 8.1;
    const grossTotal = netTotal * (1 + vatRate / 100);
    expect(grossTotal).toBeCloseTo(1081, 0);
  });
});

describe('Regi report totals', () => {
  const positions = [
    { type: 'labor', total: 750 },
    { type: 'material', total: 320 },
    { type: 'machine', total: 240 },
    { type: 'extra', total: 50 },
  ];

  it('calculates net total correctly', () => {
    const netTotal = positions.reduce((s, p) => s + p.total, 0);
    expect(netTotal).toBe(1360);
  });

  it('calculates vat amount at 8.1%', () => {
    const netTotal = 1360;
    expect(Math.round(netTotal * 0.081 * 100) / 100).toBe(110.16);
  });

  it('calculates group totals', () => {
    const laborTotal = positions.filter(p => p.type === 'labor').reduce((s, p) => s + p.total, 0);
    const materialTotal = positions.filter(p => p.type === 'material').reduce((s, p) => s + p.total, 0);
    expect(laborTotal).toBe(750);
    expect(materialTotal).toBe(320);
  });
});
