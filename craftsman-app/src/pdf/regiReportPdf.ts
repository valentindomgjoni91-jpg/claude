import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatCurrency } from '../utils';
import { generateQrDataUrl } from '../utils/qrCode';
import type { RegiReport, RegiPosition, Project, Company, Photo } from '../types';

interface RegiReportPdfData {
  report: RegiReport;
  project: Project;
  positions: RegiPosition[];
  company: Company | null;
  photos?: Photo[];
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

export async function generateRegiReportPdf(data: RegiReportPdfData): Promise<jsPDF> {
  const { report, project, positions, company, photos = [] } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  const headerH = 32;
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);

  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { w, h } = await fitImageSize(company.logoUrl, 60, 28);
      doc.addImage(company.logoUrl, fmt, margin, (headerH - h) / 2, w, h);
    } catch { /* skip invalid logo */ }
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REGIERAPPORT', pageWidth / 2, headerH / 2 + 3, { align: 'center' });

  // Company info — left-aligned block, right side of header
  if (company) {
    const infoX = pageWidth - margin - 58;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(company.name, infoX, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    if (company.street) doc.text(company.street, infoX, 14);
    if (company.zip || company.city) doc.text(`${company.zip || ''} ${company.city || ''}`.trim(), infoX, 18.5);
    if (company.phone) doc.text(`Tel.: ${company.phone}`, infoX, 23);
  }
  y = headerH + 8;

  // QR Code — below header in white area
  const qrText = `Regierapport/${data.report.id}`;
  const qrDataUrl = await generateQrDataUrl(qrText, 80);
  if (qrDataUrl) {
    try { doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 18, headerH + 3, 18, 18); } catch { /* skip */ }
  }

  // Report info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, margin, y);
  y += 7;

  doc.setFontSize(9);
  const col1 = [
    ['Projekt:', project.title],
    ['Kunde:', project.clientName],
    ['Baustelle:', project.siteAddress],
  ];
  const col2 = [
    ['Datum:', formatDate(report.date)],
    ['Status:', report.status === 'signed' ? 'Unterzeichnet' : report.status === 'invoiced' ? 'Verrechnet' : 'Entwurf'],
    ['Rapport-Nr.:', report.id.slice(0, 8).toUpperCase()],
  ];
  col1.forEach(([l, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(l, margin, y);
    doc.setFont('helvetica', 'normal'); doc.text(v, margin + 28, y); y += 5;
  });
  y -= 15;
  col2.forEach(([l, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(l, 110, y);
    doc.setFont('helvetica', 'normal'); doc.text(v, 135, y); y += 5;
  });

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Positions by type
  const typeLabels: Record<string, string> = {
    labor: 'Arbeit',
    material: 'Material',
    machine: 'Maschinen & Fahrzeuge',
    extra: 'Zusatzkosten',
  };

  const typeOrder = ['labor', 'material', 'machine', 'extra'] as const;
  const totals: Record<string, number> = { labor: 0, material: 0, machine: 0, extra: 0 };

  typeOrder.forEach((type) => {
    const group = positions.filter(p => p.type === type);
    if (group.length === 0) return;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text(typeLabels[type], margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Pos.', 'Beschreibung', 'Menge', 'Einheit', 'EP (CHF)', 'Total (CHF)']],
      body: group.map((p, i) => [
        (i + 1).toString(),
        p.description,
        (p.quantity ?? 0).toString(),
        p.unit ?? '–',
        formatCurrency(p.unitPrice ?? 0),
        formatCurrency(p.total ?? 0),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 12 },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    const groupTotal = group.reduce((s, p) => s + (p.total ?? 0), 0);
    totals[type] = groupTotal;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`Zwischentotal ${typeLabels[type]}: ${formatCurrency(groupTotal)}`, pageWidth - margin, y, { align: 'right' });
    y += 7;
  });

  // Summary
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const netTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const vatRate = report.vatRate ?? 8.1;
  const vatAmount = netTotal * (vatRate / 100);
  const grossTotal = netTotal + vatAmount;

  const summaryRows: [string, string][] = [
    ['Subtotal Arbeit', formatCurrency(totals.labor)],
    ['Subtotal Material', formatCurrency(totals.material)],
    ['Subtotal Maschinen', formatCurrency(totals.machine)],
    ['Subtotal Zusatzkosten', formatCurrency(totals.extra)],
    ['Nettototal', formatCurrency(netTotal)],
    ...(vatRate > 0 ? [[`MWST ${vatRate}%`, formatCurrency(vatAmount)] as [string, string]] : []),
    ['GESAMTTOTAL', formatCurrency(grossTotal)],
  ];

  summaryRows.forEach(([label, value], i) => {
    const isTotal = i === summaryRows.length - 1;
    if (isTotal) {
      doc.setFillColor(29, 78, 216);
      doc.rect(110, y - 4, pageWidth - margin - 110, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      doc.setTextColor(i === summaryRows.length - 3 ? 0 : 100, 100, i === summaryRows.length - 3 ? 0 : 100);
      doc.setFont('helvetica', i >= summaryRows.length - 3 ? 'bold' : 'normal');
      doc.setFontSize(9);
    }
    doc.text(label, 115, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += isTotal ? 8 : 6;
  });

  doc.setTextColor(0, 0, 0);
  y += 5;

  // Labor conditions
  if (report.laborConditions) {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Regiekonditionen:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(report.laborConditions, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 6;
  }

  // Signature
  if (y > 230) { doc.addPage(); y = margin; }
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

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
      } catch { /* skip invalid */ }
    });
    y += imgHeight + 8;
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kundenbestätigung', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Hiermit bestätige ich die korrekte Ausführung der oben aufgeführten Arbeiten und Leistungen.', margin, y);
  y += 10;

  if (report.customerSignature?.trim()) {
    try {
      const sigWidth = 70;
      const sigHeight = 25;
      const sigFmt = report.customerSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(report.customerSignature, sigFmt, margin, y, sigWidth, sigHeight);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + sigHeight + 1, margin + sigWidth, y + sigHeight + 1);
      doc.setFontSize(7.5);
      doc.text(`${report.customerName || 'Kunde'}, ${report.signedAt ? formatDate(report.signedAt) : ''}`, margin, y + sigHeight + 6);
    } catch {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + 20, margin + 70, y + 20);
      doc.setFontSize(7.5);
      doc.text('Unterschrift Kunde / Datum', margin, y + 25);
    }
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y + 20, margin + 70, y + 20);
    doc.setFontSize(7.5);
    doc.text('Unterschrift Kunde / Datum', margin, y + 25);
  }

  // Company signature area
  const companyLabel = `${company?.name || 'Unternehmen'}, ${formatDate(new Date())}`;
  if (company?.companySignature) {
    try {
      const sigFmt = company.companySignature.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { w: sw, h: sh } = await fitImageSize(company.companySignature, 70, 20);
      doc.addImage(company.companySignature, sigFmt, 110, y, sw, sh);
      doc.setDrawColor(180, 180, 180);
      doc.line(110, y + sh + 1, 110 + 70, y + sh + 1);
      doc.setFontSize(7.5);
      doc.text(companyLabel, 110, y + sh + 6);
    } catch {
      doc.line(110, y + 20, 110 + 70, y + 20);
      doc.setFontSize(7.5);
      doc.text(companyLabel, 110, y + 25);
    }
  } else {
    doc.line(110, y + 20, 110 + 70, y + 20);
    doc.setFontSize(7.5);
    doc.text(companyLabel, 110, y + 25);
  }
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
