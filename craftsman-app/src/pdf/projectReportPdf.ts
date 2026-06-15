import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatHours, formatCurrency } from '../utils';
import type { Project, DailyReport, RegiReport, Company } from '../types';

export interface ProjectReportStats {
  totalHours: number;
  totalMaterialCost: number;
  totalMachineCost: number;
  totalSubCost: number;
  regiTotal: number;
}

export interface ProjectReportPdfData {
  project: Project;
  dailyReports: DailyReport[];
  regiReports: RegiReport[];
  stats: ProjectReportStats;
  company: Company | null;
  employeeName?: string;
}

export function generateProjectReportPdf(data: ProjectReportPdfData): jsPDF {
  const { project, dailyReports, regiReports, stats, company } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y: number;

  // ── Header ────────────────────────────────────────────────────────────────
  const headerH = 32;
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);

  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(company.logoUrl, fmt, margin, 5, 26, 20);
    } catch { /* skip */ }
  }

  const titleX = company?.logoUrl ? margin + 29 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(company?.name || 'Handwerker Rapport', titleX, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Projektbericht', titleX, 18);
  doc.text(formatDate(new Date()), pageWidth - margin, 12, { align: 'right' });

  y = headerH + 8;
  doc.setTextColor(0, 0, 0);

  // ── Project header ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(29, 78, 216);
  doc.text(project.title, margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Kunde: ${project.clientName}`, margin, y); y += 4.5;
  doc.text(`Baustelle: ${project.siteAddress}`, margin, y); y += 4.5;
  if (project.startDate) {
    const dateStr = project.endDate
      ? `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`
      : `Start: ${formatDate(project.startDate)}`;
    doc.text(dateStr, margin, y); y += 4.5;
  }
  if (project.description) {
    doc.text(project.description, margin, y, { maxWidth: pageWidth - margin * 2 }); y += 6;
  }
  y += 4;

  // ── Summary stats ─────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const col = (pageWidth - margin * 2) / 3;
  const statItems = [
    { label: 'Arbeitsstunden', value: formatHours(stats.totalHours) },
    { label: 'Materialkosten', value: formatCurrency(stats.totalMaterialCost) },
    { label: 'Maschinenkosten', value: formatCurrency(stats.totalMachineCost) },
  ];
  if (stats.totalSubCost > 0) statItems.push({ label: 'Fremdleistungen', value: formatCurrency(stats.totalSubCost) });
  if (stats.regiTotal > 0) statItems.push({ label: 'Regie Total', value: formatCurrency(stats.regiTotal) });

  const gesamtIst = stats.totalMaterialCost + stats.totalMachineCost + stats.totalSubCost;

  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 20, 'F');
  for (let i = 0; i < Math.min(3, statItems.length); i++) {
    const x = margin + 6 + i * col;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(29, 78, 216);
    doc.text(statItems[i].value, x, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(statItems[i].label, x, y + 16);
  }
  y += 24;

  if (project.budget && project.budget > 0) {
    const pct = Math.min(100, Math.round((gesamtIst / project.budget) * 100));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Budget: ${formatCurrency(project.budget)} · Ist: ${formatCurrency(gesamtIst)} (${pct}%)`, margin, y);
    y += 8;
  }

  // ── Daily reports table ───────────────────────────────────────────────────
  if (dailyReports.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text(`Tagesrapporte (${dailyReports.length})`, margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Datum', 'Titel', 'Status']],
      body: dailyReports.map(r => [
        formatDate(r.date),
        r.title,
        r.status === 'completed' ? 'Abgeschlossen' : 'Entwurf',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 2: { cellWidth: 28 } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Regi reports table ────────────────────────────────────────────────────
  if (regiReports.length > 0) {
    if (y > 230) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text(`Regierapporte (${regiReports.length})`, margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Datum', 'Titel', 'Status']],
      body: regiReports.map(r => [
        formatDate(r.date),
        r.title,
        r.status === 'invoiced' ? 'Verrechnet' : r.status === 'signed' ? 'Signiert' : 'Entwurf',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 2: { cellWidth: 28 } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Gesamtkosten ──────────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = margin; }
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Gesamtkosten Ist (ohne Regie)', pageWidth - margin - 80, y);
  doc.text(formatCurrency(gesamtIst), pageWidth - margin, y, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(company?.footerText || '', margin, footerY, { maxWidth: 80 });
    doc.text(`Seite ${i} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  return doc;
}
