import type jsPDF from 'jspdf';

export interface ShareOptions {
  filename: string;
  title: string;
  subject: string;
  body: string;
  recipientEmail?: string;
}

/** Convert jsPDF document to a File object for Web Share API */
function pdfToFile(doc: jsPDF, filename: string): File {
  const blob = doc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}

/** Check if Web Share API supports file sharing */
function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    'canShare' in navigator
  );
}

/** Share PDF via native OS share sheet (mobile) */
async function shareNative(doc: jsPDF, opts: ShareOptions): Promise<boolean> {
  if (!canShareFiles()) return false;
  const file = pdfToFile(doc, opts.filename);
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({
      title: opts.title,
      text: opts.body,
      files: [file],
    });
    return true;
  } catch (err) {
    // AbortError = user cancelled, that's OK
    if ((err as Error).name !== 'AbortError') console.warn('Share error:', err);
    return false;
  }
}

/** Trigger PDF download in browser */
function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

/** Open mailto link with pre-filled subject + body (no attachment – browser limitation) */
function openMailto(opts: ShareOptions): void {
  const to = opts.recipientEmail || '';
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(opts.body);
  const url = `mailto:${to}?subject=${subject}&body=${body}`;
  window.location.href = url;
}

/**
 * Primary share action:
 * 1. Try Web Share API (native, with PDF file) – works on Android/iOS
 * 2. Download PDF + open mailto as fallback
 */
export async function sharePdf(doc: jsPDF, opts: ShareOptions): Promise<'shared' | 'downloaded' | 'mailto'> {
  const shared = await shareNative(doc, opts);
  if (shared) return 'shared';
  downloadPdf(doc, opts.filename);
  return 'downloaded';
}

/** Only open mailto (user chose "Per E-Mail senden" explicitly) */
export async function sendByEmail(doc: jsPDF, opts: ShareOptions): Promise<void> {
  downloadPdf(doc, opts.filename);
  // Small delay so download starts before mailto changes location
  setTimeout(() => openMailto(opts), 300);
}

/** Build standard email body for daily report */
export function buildDailyReportEmailBody(opts: {
  projectTitle: string;
  date: string;
  companyName: string;
  totalHours: number;
  totalMaterialCost: number;
}): string {
  return `Guten Tag,

anbei erhalten Sie den Tagesrapport vom ${opts.date} für das Projekt "${opts.projectTitle}".

Zusammenfassung:
• Arbeitsstunden: ${opts.totalHours.toFixed(2)}h
• Materialkosten: CHF ${opts.totalMaterialCost.toFixed(2)}

Bei Fragen stehen wir gerne zur Verfügung.

Freundliche Grüsse
${opts.companyName}`;
}

/** Build standard email body for regi report */
export function buildRegiReportEmailBody(opts: {
  projectTitle: string;
  date: string;
  companyName: string;
  grossTotal: number;
  customerName?: string;
}): string {
  return `Guten Tag${opts.customerName ? ` ${opts.customerName}` : ''},

anbei erhalten Sie den Regierapport vom ${opts.date} für das Projekt "${opts.projectTitle}".

Gesamtbetrag inkl. MWST: CHF ${opts.grossTotal.toFixed(2)}

Bitte bestätigen Sie den Rapport per Unterschrift oder kontaktieren Sie uns bei Unklarheiten.

Freundliche Grüsse
${opts.companyName}`;
}
