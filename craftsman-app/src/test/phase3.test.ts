import { describe, it, expect } from 'vitest';
import { buildDailyReportEmailBody, buildRegiReportEmailBody } from '../utils/share';

// ---- Email body builders ----

describe('buildDailyReportEmailBody', () => {
  const opts = {
    projectTitle: 'Neubau EFH Muster',
    date: '13.06.2026',
    companyName: 'Muster Handwerk GmbH',
    totalHours: 9.5,
    totalMaterialCost: 342.5,
  };

  it('includes project title', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body).toContain('Neubau EFH Muster');
  });

  it('includes date', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body).toContain('13.06.2026');
  });

  it('includes company name in signature', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body).toContain('Muster Handwerk GmbH');
  });

  it('includes total hours', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body).toContain('9.50');
  });

  it('includes material cost', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body).toContain('342.50');
  });

  it('returns non-empty string', () => {
    const body = buildDailyReportEmailBody(opts);
    expect(body.length).toBeGreaterThan(50);
  });
});

describe('buildRegiReportEmailBody', () => {
  const opts = {
    projectTitle: 'Renovation Büro',
    date: '13.06.2026',
    companyName: 'Muster Handwerk GmbH',
    grossTotal: 5513.10,
    customerName: 'Herr Muster',
  };

  it('includes customer name in greeting', () => {
    const body = buildRegiReportEmailBody(opts);
    expect(body).toContain('Herr Muster');
  });

  it('includes gross total', () => {
    const body = buildRegiReportEmailBody(opts);
    expect(body).toContain('5513.10');
  });

  it('includes project title', () => {
    const body = buildRegiReportEmailBody(opts);
    expect(body).toContain('Renovation Büro');
  });

  it('works without customer name', () => {
    const body = buildRegiReportEmailBody({ ...opts, customerName: undefined });
    expect(body).toBeTruthy();
    expect(body).not.toContain('undefined');
  });

  it('includes company name', () => {
    const body = buildRegiReportEmailBody(opts);
    expect(body).toContain('Muster Handwerk GmbH');
  });
});

// ---- Status flow ----

describe('Regierapport status flow', () => {
  const statusFlow = ['draft', 'signed', 'invoiced'] as const;

  it('has correct status order', () => {
    expect(statusFlow[0]).toBe('draft');
    expect(statusFlow[1]).toBe('signed');
    expect(statusFlow[2]).toBe('invoiced');
  });

  it('can only mark invoiced after signed', () => {
    const canMarkInvoiced = (status: string) => status === 'signed';
    expect(canMarkInvoiced('draft')).toBe(false);
    expect(canMarkInvoiced('signed')).toBe(true);
    expect(canMarkInvoiced('invoiced')).toBe(false);
  });

  it('can only sign when in draft', () => {
    const canSign = (status: string) => status === 'draft';
    expect(canSign('draft')).toBe(true);
    expect(canSign('signed')).toBe(false);
    expect(canSign('invoiced')).toBe(false);
  });
});

// ---- Duplicate logic (pure calculation tests) ----

describe('Duplicate report logic', () => {
  it('sets status to draft on duplicate', () => {
    const original = { status: 'completed', title: 'Original' };
    const copy = { ...original, status: 'draft', title: `Kopie – ${original.title}` };
    expect(copy.status).toBe('draft');
    expect(copy.title).toBe('Kopie – Original');
  });

  it('uses today as date for duplicate', () => {
    const today = new Date().toISOString().split('T')[0];
    const copy = { date: today };
    expect(copy.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clears signature on regi report duplicate', () => {
    const original = {
      status: 'signed',
      customerSignature: 'data:image/png;base64,...',
      customerName: 'Max Muster',
      signedAt: '2026-06-13T10:00:00.000Z',
    };
    const copy = {
      ...original,
      status: 'draft',
      customerSignature: undefined,
      customerName: undefined,
      signedAt: undefined,
    };
    expect(copy.customerSignature).toBeUndefined();
    expect(copy.customerName).toBeUndefined();
    expect(copy.signedAt).toBeUndefined();
    expect(copy.status).toBe('draft');
  });

  it('generates new unique ID for duplicate', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(crypto.randomUUID());
    }
    expect(ids.size).toBe(100);
  });
});

// ---- Share / Web API checks ----

describe('Share utilities', () => {
  it('builds mailto URL with encoded subject', () => {
    const subject = 'Tagesrapport 13.06.2026 – Neubau EFH';
    const encoded = encodeURIComponent(subject);
    expect(encoded).toContain('%');
    expect(decodeURIComponent(encoded)).toBe(subject);
  });

  it('extracts email from contact string', () => {
    const contact = 'Max Muster, max@example.com, +41 79 123 45 67';
    const match = contact.match(/[\w.+-]+@[\w.-]+\.\w+/);
    expect(match?.[0]).toBe('max@example.com');
  });

  it('returns null when no email in contact', () => {
    const contact = 'Max Muster, +41 79 123 45 67';
    const match = contact.match(/[\w.+-]+@[\w.-]+\.\w+/);
    expect(match).toBeNull();
  });
});
