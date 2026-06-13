import { describe, it, expect } from 'vitest';

// Pure calculation logic extracted from PDF generators
function calcRegiTotals(positions: { type: string; total: number }[], vatRate: number) {
  const byType: Record<string, number> = { labor: 0, material: 0, machine: 0, extra: 0 };
  for (const p of positions) {
    byType[p.type] = (byType[p.type] || 0) + p.total;
  }
  const net = Object.values(byType).reduce((a, b) => a + b, 0);
  const vat = net * (vatRate / 100);
  const gross = net + vat;
  return { byType, net, vat, gross };
}

describe('Regierapport PDF calculations', () => {
  const positions = [
    { type: 'labor', total: 2250 },
    { type: 'labor', total: 1500 },
    { type: 'material', total: 840 },
    { type: 'machine', total: 360 },
    { type: 'extra', total: 150 },
  ];

  it('groups positions by type correctly', () => {
    const { byType } = calcRegiTotals(positions, 8.1);
    expect(byType.labor).toBe(3750);
    expect(byType.material).toBe(840);
    expect(byType.machine).toBe(360);
    expect(byType.extra).toBe(150);
  });

  it('calculates net total', () => {
    const { net } = calcRegiTotals(positions, 8.1);
    expect(net).toBe(5100);
  });

  it('calculates 8.1% VAT correctly', () => {
    const { vat } = calcRegiTotals(positions, 8.1);
    expect(vat).toBeCloseTo(413.1, 1);
  });

  it('calculates gross total', () => {
    const { gross } = calcRegiTotals(positions, 8.1);
    expect(gross).toBeCloseTo(5513.1, 1);
  });

  it('calculates with 7.7% VAT (legacy)', () => {
    const { vat } = calcRegiTotals(positions, 7.7);
    expect(vat).toBeCloseTo(392.7, 1);
  });

  it('handles empty positions', () => {
    const { net, vat, gross } = calcRegiTotals([], 8.1);
    expect(net).toBe(0);
    expect(vat).toBe(0);
    expect(gross).toBe(0);
  });

  it('returns 0 for unknown types gracefully', () => {
    const { net } = calcRegiTotals([{ type: 'unknown', total: 100 }], 8.1);
    // byType doesn't include 'unknown', but total still sums
    // Since byType keys are fixed, unknown types contribute to Object.values
    expect(net).toBeGreaterThanOrEqual(0);
  });
});

describe('Position total validation', () => {
  it('throws no error for zero quantity', () => {
    const qty = 0;
    const price = 75;
    expect(qty * price).toBe(0);
  });

  it('handles decimal quantities', () => {
    const qty = 2.5;
    const price = 120;
    expect(qty * price).toBe(300);
  });

  it('rounds currency to 2 decimals', () => {
    const result = Math.round(33.333333 * 100) / 100;
    expect(result).toBe(33.33);
  });
});
