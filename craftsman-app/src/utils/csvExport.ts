import { db } from '../db';

function escapeCSV(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const headerLine = headers.map(escapeCSV).join(';');
  const dataLines = rows.map(row => row.map(escapeCSV).join(';'));
  return [headerLine, ...dataLines].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const bom = '﻿'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTimeEntriesCSV(month?: string) {
  const allReports = await db.dailyReports.toArray();
  const allProjects = await db.projects.toArray();
  const allEmployees = await db.employees.toArray();
  let entries = await db.timeEntries.where('reportType').equals('daily').toArray();

  if (month) {
    const reportIds = allReports.filter(r => r.date.startsWith(month)).map(r => r.id);
    entries = entries.filter(e => reportIds.includes(e.reportId));
  }

  const projectMap = Object.fromEntries(allProjects.map(p => [p.id, p.title]));
  const employeeMap = Object.fromEntries(allEmployees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
  const reportMap = Object.fromEntries(allReports.map(r => [r.id, r]));

  const headers = ['Datum', 'Projekt', 'Mitarbeiter', 'Von', 'Bis', 'Pause (Min)', 'Stunden', 'Tätigkeit', 'Notiz'];
  const rows = entries.map(e => {
    const report = reportMap[e.reportId];
    return [
      e.date,
      projectMap[report?.projectId] || '',
      employeeMap[e.employeeId] || e.employeeId,
      e.startTime || '',
      e.endTime || '',
      e.breakMinutes,
      e.totalHours,
      e.activity || '',
      e.note || '',
    ];
  });

  const filename = month ? `Stunden_${month}.csv` : `Stunden_Export.csv`;
  downloadCSV(toCSV(headers, rows), filename);
}

export async function exportProjectsCSV() {
  const projects = await db.projects.toArray();
  const allReports = await db.dailyReports.toArray();

  const headers = ['Titel', 'Kunde', 'Baustelle', 'Status', 'Startdatum', 'Enddatum', 'Budget', 'Anzahl Rapporte'];
  const rows = projects.map(p => {
    const reportCount = allReports.filter(r => r.projectId === p.id).length;
    return [
      p.title,
      p.clientName,
      p.siteAddress,
      p.status,
      p.startDate || '',
      p.endDate || '',
      p.budget || '',
      reportCount,
    ];
  });

  downloadCSV(toCSV(headers, rows), 'Projekte_Export.csv');
}

export async function exportRegiReportsCSV() {
  const regiReports = await db.regiReports.toArray();
  const projects = await db.projects.toArray();
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.title]));
  const allPositions = await db.regiPositions.toArray();

  const headers = ['Datum', 'Titel', 'Projekt', 'Status', 'Netto (CHF)', 'MWST %', 'MWST (CHF)', 'Brutto (CHF)', 'Kundenname'];
  const rows = regiReports.map(r => {
    const positions = allPositions.filter(p => p.regiReportId === r.id);
    const net = positions.reduce((s, p) => s + p.total, 0);
    const vatAmt = net * (r.vatRate / 100);
    return [
      r.date,
      r.title,
      projectMap[r.projectId] || '',
      r.status,
      net.toFixed(2),
      r.vatRate,
      vatAmt.toFixed(2),
      (net + vatAmt).toFixed(2),
      r.customerName || '',
    ];
  });

  downloadCSV(toCSV(headers, rows), 'Regierapporte_Export.csv');
}
