import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatHours, formatCurrency, WEATHER_LABELS } from '../utils';
import { generateQrDataUrl } from '../utils/qrCode';
import type {
  DailyReport, Project, TimeEntry, MaterialEntry, MachineEntry,
  SubcontractorEntry, Photo, Employee, Machine, Company,
} from '../types';

interface DailyReportPdfData {
  report: DailyReport;
  project: Project;
  timeEntries: TimeEntry[];
  materialEntries: MaterialEntry[];
  machineEntries: MachineEntry[];
  subcontractorEntries: SubcontractorEntry[];
  photos: Photo[];
  employees: Employee[];
  machines: Machine[];
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

export async function generateDailyReportPdf(data: DailyReportPdfData): Promise<jsPDF> {
  const { report, project, timeEntries, materialEntries, machineEntries, subcontractorEntries, photos, employees, machines, company } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const employeeMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
  const machineMap = Object.fromEntries(machines.map(m => [m.id, m.name]));

  // Header
  const headerH = 32;
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(0, 0, 0);

  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { w, h } = await fitImageSize(company.logoUrl, 60, 28);
      doc.addImage(company.logoUrl, fmt, margin, (headerH - h) / 2, w, h);
    } catch { /* skip invalid logo */ }
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGESRAPPORT', pageWidth / 2, headerH / 2 + 3, { align: 'center' });

  // Company info — right side, pushed to outer right edge
  if (company) {
    const infoX = pageWidth - margin - 45;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(company.name, infoX, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    if (company.street) doc.text(company.street, infoX, 12.5);
    if (company.zip || company.city) doc.text(`${company.zip || ''} ${company.city || ''}`.trim(), infoX, 16);
    if (company.phone) doc.text(`Tel.: ${company.phone}`, infoX, 19.5);
  }
  y = headerH + 8;

  // QR Code — below header in white area
  const qrText = `Tagesrapport/${data.report.id}`;
  const qrDataUrl = await generateQrDataUrl(qrText, 80);
  if (qrDataUrl) {
    try { doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 18, headerH + 3, 18, 18); } catch { /* skip */ }
  }

  // Report Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title || `Tagesrapport ${formatDate(report.date)}`, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const infoLeft = [
    ['Projekt:', project.title],
    ['Kunde:', project.clientName],
    ['Baustelle:', project.siteAddress],
  ];
  const infoRight = [
    ['Datum:', formatDate(report.date)],
    ['Wetter:', report.weather ? WEATHER_LABELS[report.weather] || report.weather : '-'],
    ['Temperatur:', report.temperature != null ? `${report.temperature}°C` : '-'],
  ];

  infoLeft.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, margin + 28, y);
    y += 5;
  });

  y -= 15;
  infoRight.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 135, y);
    y += 5;
  });

  y += 5;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Time Entries
  if (timeEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Arbeitszeiten', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Mitarbeiter', 'Von', 'Bis', 'Pause', 'Total', 'Tätigkeit']],
      body: timeEntries.map(e => [
        employeeMap[e.employeeId] || e.employeeId,
        e.startTime || '-',
        e.endTime || '-',
        e.breakMinutes ? `${e.breakMinutes} min` : '-',
        formatHours(e.totalHours),
        e.activity || '',
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 45 }, 4: { halign: 'right' } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    const totalHours = timeEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Arbeitsstunden: ${formatHours(totalHours)}`, pageWidth - margin, y, { align: 'right' });
    y += 7;
  }

  // Materials
  if (materialEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Materialverbrauch', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Beschreibung', 'Menge', 'Einheit', 'Einheitspreis', 'Total']],
      body: materialEntries.map(e => [
        e.description,
        (e.quantity ?? 0).toString(),
        e.unit ?? '–',
        formatCurrency(e.unitPrice ?? 0),
        formatCurrency(e.total ?? 0),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Machines
  if (machineEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Maschinen & Fahrzeuge', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Maschine / Fahrzeug', 'Stunden', 'Fahrer', 'Stundensatz', 'Total']],
      body: machineEntries.map(e => [
        machineMap[e.machineId || ''] || e.description,
        (e.hours ?? 0).toString(),
        e.operatorId ? (employeeMap[e.operatorId] || '-') : '-',
        formatCurrency(e.hourlyRate ?? 0),
        formatCurrency(e.total ?? 0),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Subcontractors
  if (subcontractorEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Fremdleistungen', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Firma', 'Beschreibung', 'Betrag']],
      body: subcontractorEntries.map(e => [e.company, e.description, formatCurrency(e.amount)]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Notes
  if (report.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Notizen', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(report.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 5;
  }

  // Photos (up to 6)
  const photosToShow = photos.slice(0, 6);
  if (photosToShow.length > 0) {
    if (y > 200) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text('Fotos', margin, y);
    y += 5;

    const imgWidth = (pageWidth - margin * 2 - 5) / 2;
    const imgHeight = imgWidth * 0.6;
    const pageHeight = doc.internal.pageSize.getHeight();
    photosToShow.forEach((photo, i) => {
      if (i > 0 && i % 2 === 0) {
        y += imgHeight + 5;
        if (y + imgHeight > pageHeight - margin) { doc.addPage(); y = margin; }
      }
      const x = i % 2 === 0 ? margin : margin + imgWidth + 5;
      try {
        doc.addImage(photo.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
        if (photo.note) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(photo.note, x, y + imgHeight + 3, { maxWidth: imgWidth });
        }
      } catch {
        // Skip invalid images
      }
    });
    y += imgHeight + 8;
  }

  // Customer signature
  if (y > 220) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216);
  doc.text('Bestätigung', margin, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  if (report.customerSignature?.trim()) {
    try {
      const sigWidth = 70;
      const sigHeight = 25;
      const sigFmt = report.customerSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(report.customerSignature, sigFmt, margin, y, sigWidth, sigHeight);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + sigHeight + 1, margin + sigWidth, y + sigHeight + 1);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${report.customerName || 'Kunde'}, ${report.signedAt ? formatDate(report.signedAt) : ''}`, margin, y + sigHeight + 6);
    } catch {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + 20, margin + 70, y + 20);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Unterschrift Kunde / Datum', margin, y + 25);
    }
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y + 20, margin + 70, y + 20);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Unterschrift Kunde / Datum', margin, y + 25);
  }

  // Company signature area
  doc.line(110, y + 20, 110 + 70, y + 20);
  doc.text(`${company?.name || 'Unternehmen'} / Datum`, 110, y + 25);
  y += 35;

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(company?.footerText || '', margin, footerY, { maxWidth: 80 });
    if (company?.bankAccount) {
      doc.text(`IBAN: ${company.bankAccount}`, pageWidth / 2, footerY, { align: 'center' });
    }
    doc.text(`Seite ${i} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  return doc;
}
