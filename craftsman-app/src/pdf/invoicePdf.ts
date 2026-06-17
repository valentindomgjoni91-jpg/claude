import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatCurrency } from '../utils';
import type { RegiReport, RegiPosition, Project, Company } from '../types';

const INVOICE_CTR_KEY = 'craftsman_invoice_counter';

function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const key = `${INVOICE_CTR_KEY}_${year}`;
  const current = parseInt(localStorage.getItem(key) || '0', 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return `RE-${year}-${String(next).padStart(4, '0')}`;
}

export interface InvoicePdfData {
  report: RegiReport;
  positions: RegiPosition[];
  project: Project;
  company: Company | null;
  invoiceNumber?: string;
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

export async function generateInvoicePdf(data: InvoicePdfData): Promise<{ pdf: jsPDF; invoiceNumber: string }> {
  const { report, positions, project, company } = data;
  const invoiceNumber = data.invoiceNumber ?? nextInvoiceNumber();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // ── Logo / company address (top left) ──────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  if (company?.logoUrl) {
    try {
      const fmt = company.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { w, h } = await fitImageSize(company.logoUrl, 60, 30);
      doc.addImage(company.logoUrl, fmt, margin, y, w, h);
      y += h + 4;
    } catch { y += 4; }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(company?.name || 'Unternehmen', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (company?.street) { doc.text(company.street, margin, y); y += 4.5; }
  if (company?.zip || company?.city) {
    doc.text(`${company.zip || ''} ${company.city || ''}`.trim(), margin, y); y += 4.5;
  }
  if (company?.phone) { doc.text(`Tel.: ${company.phone}`, margin, y); y += 4.5; }
  if (company?.email) { doc.text(company.email, margin, y); y += 4.5; }
  if (company?.vatNumber) { doc.text(`MwSt: ${company.vatNumber}`, margin, y); }

  // ── Invoice details (top right) ─────────────────────────────────────────
  const rightX = pageWidth - margin;
  let ry = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('RECHNUNG', pageWidth / 2, ry, { align: 'center' });
  ry += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  const details = [
    ['Rechnungsnummer', invoiceNumber],
    ['Datum', formatDate(invoiceDate)],
    ['Fällig bis', formatDate(dueDate)],
  ];
  for (const [label, value] of details) {
    doc.setFont('helvetica', 'normal');
    doc.text(label, rightX - 60, ry);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX, ry, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    ry += 5.5;
  }

  y = Math.max(y + 12, ry + 6);

  // ── Separator ────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Billing address ──────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Rechnungsempfänger', margin, y);
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(project.clientName, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (project.clientContact) { doc.text(project.clientContact, margin, y); y += 4.5; }
  y += 6;

  // ── Subject ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Betreff: ${report.title}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Projekt: ${project.title} · Baustelle: ${project.siteAddress}`, margin, y);
  y += 10;

  // ── Position table ────────────────────────────────────────────────────────
  const vatRate = report.vatRate ?? 8.1;
  const netTotal = positions.reduce((s, p) => s + (p.total ?? 0), 0);
  const vatAmount = netTotal * (vatRate / 100);
  const grossTotal = netTotal + vatAmount;

  const tableBody = positions.map(p => [
    p.description,
    p.quantity != null ? p.quantity.toString() : '–',
    p.unit ?? '–',
    p.unitPrice != null ? formatCurrency(p.unitPrice) : '–',
    formatCurrency(p.total ?? 0),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Betrag']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalsX = pageWidth - margin - 80;
  const valueX = pageWidth - margin;

  const drawRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(bold ? 0 : 80, bold ? 0 : 80, bold ? 0 : 80);
    doc.text(label, totalsX, y);
    doc.text(value, valueX, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  };

  doc.setDrawColor(220, 220, 220);
  doc.line(totalsX, y - 2, pageWidth - margin, y - 2);
  drawRow('Nettobetrag', formatCurrency(netTotal));
  drawRow(`MwSt ${vatRate}%`, formatCurrency(vatAmount));
  doc.line(totalsX, y - 1, pageWidth - margin, y - 1);
  y += 2;
  drawRow('Gesamtbetrag CHF', formatCurrency(grossTotal), true);
  y += 6;

  // ── Payment info ──────────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = margin; }
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, pageWidth - margin * 2, company?.bankAccount ? 22 : 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text('Zahlungsinformationen', margin + 5, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  if (company?.bankAccount) {
    doc.text(`IBAN: ${company.bankAccount}`, margin + 5, y + 12);
    doc.text(`Zahlbar innert 30 Tagen`, margin + 5, y + 18);
  } else {
    doc.text('Zahlbar innert 30 Tagen', margin + 5, y + 11);
  }
  y += (company?.bankAccount ? 22 : 14) + 8;

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(company?.footerText || '', margin, footerY, { maxWidth: 100 });
    doc.text(`${i} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  return { pdf: doc, invoiceNumber };
}
