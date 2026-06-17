import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatHours, formatCurrency } from '../utils';
import type { Employee, Company } from '../types';

export interface TimesheetEntry {
  date: string;
  reportTitle: string;
  projectTitle: string;
  startTime?: string;
  endTime?: string;
  breakMinutes: number;
  totalHours: number;
  activity?: string;
}

export interface TimesheetPdfData {
  employee: Employee;
  month: string; // 'YYYY-MM'
  entries: TimesheetEntry[];
  company: Company | null;
}

async function fitImageSize(dataUrl: string, maxW: number, maxH: number): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      let w = maxW, h = maxW / ratio;
      if (h > maxH) { h = maxH; w = maxH * ratio; }
      resolve({ w, h });
    };
    img.onerror = () => resolve({ w: maxW, h: maxH });
    img.src = dataUrl;
  });
}

export async function generateTimesheetPdf(data: TimesheetPdfData): Promise<jsPDF> {
  const { employee, month, entries, company } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y: number;

  // ── Header — clean white document style ─────────────────────────────────
  doc.setTextColor(0, 0, 0);
  let headerBottom = margin;

  // Logo top-left
  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { w, h } = await fitImageSize(company.logoUrl, 50, 22);
      doc.addImage(company.logoUrl, fmt, margin, margin, w, h);
      headerBottom = Math.max(headerBottom, margin + h);
    } catch { /* skip */ }
  }

  // Company info — left, below logo
  if (company) {
    let cy = company.logoUrl ? margin + 26 : margin + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(company.name, margin, cy);
    cy += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    if (company.street) { doc.text(company.street, margin, cy); cy += 4; }
    if (company.zip || company.city) { doc.text(`${company.zip || ''} ${company.city || ''}`.trim(), margin, cy); cy += 4; }
    headerBottom = Math.max(headerBottom, cy);
  }

  // Title — centered at top
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('STUNDENZETTEL', pageWidth / 2, margin + 6, { align: 'center' });

  // Separator under header
  y = headerBottom + 6;
  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;
  doc.setTextColor(0, 0, 0);

  // Employee + month
  const monthName = new Date(`${month}-01`).toLocaleString('de-CH', { month: 'long', year: 'numeric' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text(`${employee.firstName} ${employee.lastName}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(monthName, margin, y);
  y += 8;

  doc.setTextColor(0, 0, 0);

  // Stats summary
  const totalHours = entries.reduce((s, e) => s + (e.totalHours ?? 0), 0);
  const estimatedPay = totalHours * (employee.hourlyRate ?? 0);
  const workDays = new Set(entries.map(e => e.date)).size;

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);

  const col = (pageWidth - margin * 2) / 3;
  doc.text('Total Stunden', margin + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(formatHours(totalHours), margin + 6, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Arbeitstage', margin + col + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${workDays} Tage`, margin + col + 6, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Lohnbetrag', margin + col * 2 + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(estimatedPay), margin + col * 2 + 6, y + 13);
  y += 24;

  // Time entries table
  if (entries.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Datum', 'Projekt / Rapport', 'Tätigkeit', 'Von', 'Bis', 'Pause', 'Stunden']],
      body: entries.map(e => [
        formatDate(e.date),
        `${e.projectTitle}\n${e.reportTitle}`,
        e.activity || '–',
        e.startTime ? e.startTime.slice(0, 5) : '–',
        e.endTime ? e.endTime.slice(0, 5) : '–',
        e.breakMinutes > 0 ? `${e.breakMinutes} min` : '–',
        formatHours(e.totalHours),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 50 },
        2: { cellWidth: 40 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Keine Einträge für diesen Monat.', margin, y + 6);
    y += 14;
  }

  // Signature area
  if (y > 240) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(`Stundensatz: CHF ${(employee.hourlyRate ?? 0).toFixed(2)}/h`, margin, y);
  y += 14;

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, margin + 70, y);
  doc.line(110, y, 110 + 70, y);
  doc.setFontSize(7.5);
  doc.text('Unterschrift Mitarbeiter / Datum', margin, y + 5);
  doc.text(`${company?.name || 'Arbeitgeber'} / Datum`, 110, y + 5);

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(company?.footerText || '', margin, footerY, { maxWidth: 80 });
    doc.text(`Seite ${i} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
    doc.text(`Erstellt: ${formatDate(new Date())}`, pageWidth / 2, footerY, { align: 'center' });
  }

  return doc;
}
