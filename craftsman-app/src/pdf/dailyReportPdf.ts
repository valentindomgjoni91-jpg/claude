import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatHours, formatCurrency, WEATHER_LABELS } from '../utils';
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

export function generateDailyReportPdf(data: DailyReportPdfData): jsPDF {
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
  doc.setTextColor(255, 255, 255);

  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(company.logoUrl, fmt, margin, 5, 30, 22);
    } catch { /* skip invalid logo */ }
  }

  const titleX = company?.logoUrl ? margin + 33 : margin;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGESRAPPORT', titleX, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (company) {
    doc.text(company.name, pageWidth - margin, 10, { align: 'right' });
    doc.text(`${company.street}, ${company.zip} ${company.city}`, pageWidth - margin, 16, { align: 'right' });
    if (company.phone) doc.text(company.phone, pageWidth - margin, 22, { align: 'right' });
  }
  y = headerH + 8;

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

    const totalHours = timeEntries.reduce((sum, e) => sum + e.totalHours, 0);
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
        e.quantity.toString(),
        e.unit,
        formatCurrency(e.unitPrice),
        formatCurrency(e.total),
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
        e.hours.toString(),
        e.operatorId ? (employeeMap[e.operatorId] || '-') : '-',
        formatCurrency(e.hourlyRate),
        formatCurrency(e.total),
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
    photosToShow.forEach((photo, i) => {
      if (i > 0 && i % 2 === 0) y += imgHeight + 5;
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
