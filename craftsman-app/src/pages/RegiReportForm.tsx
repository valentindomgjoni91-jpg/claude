import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Plus, Trash2, Download, PenTool, X, Share2, Copy, MoreVertical, Receipt, Camera, Image, FileText, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { Tabs } from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ActionSheet from '../components/ui/ActionSheet';
import { useAdmin } from '../context/AdminContext';
import {
  useRegiReport, useRegiPositions,
  createRegiReport, updateRegiReport, signRegiReport,
  addRegiPosition, deleteRegiPosition,
} from '../hooks/useRegiReports';
import { useProjects } from '../hooks/useProjects';
import { useCompany, useMaterials, useMachines } from '../hooks/useMasterData';
import { useDailyReports } from '../hooks/useDailyReports';
import { useLeistungEntries } from '../hooks/useLeistungEntries';
import { todayISO, nowISO, formatCurrency, UNITS, calcTotalHours, formatHours } from '../utils';
import { usePhotos, addPhoto, deletePhoto } from '../hooks/useDailyReports';
import { generateRegiReportPdf } from '../pdf/regiReportPdf';
import { generateInvoicePdf } from '../pdf/invoicePdf';
import { db } from '../db';
import { sharePdf, sendByEmail, buildRegiReportEmailBody } from '../utils/share';
import { duplicateRegiReport } from '../hooks/useDuplicate';
import type { RegiPosition, Material, Machine } from '../types';


const DEFAULT_CONDITIONS = `Arbeitsstunden: CHF 75.00/h
Material: gemäss Aufwand + 15% Aufschlag
Maschinen: gemäss effektivem Einsatz
Minimum: 1 Stunde`;

export default function RegiReportForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const report = useRegiReport(id);
  const positions = useRegiPositions(id);
  const projects = useProjects();
  useCompany(); // loaded for PDF generation
  const materials = useMaterials();
  const machines = useMachines();

  const { isAdmin } = useAdmin();
  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);
  const [reportId, setReportId] = useState(id);

  const photos = usePhotos(reportId);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const sigRef = useRef<SignatureCanvas>(null);

  const [form, setForm] = useState({
    projectId: searchParams.get('projectId') || '',
    date: todayISO(),
    title: `Regierapport ${todayISO()}`,
    laborConditions: DEFAULT_CONDITIONS,
    vatRate: '8.1',
  });

  useEffect(() => {
    if (report) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        projectId: report.projectId,
        date: report.date,
        title: report.title,
        laborConditions: report.laborConditions || DEFAULT_CONDITIONS,
        vatRate: report.vatRate?.toString() || '8.1',
      });
      setCustomerName(report.customerName || '');
    }
  }, [report]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const reportIdRef = useRef<string | undefined>(id);
  const creatingReportRef = useRef<Promise<string> | null>(null);

  const ensureReport = (): Promise<string> => {
    if (reportIdRef.current) return Promise.resolve(reportIdRef.current);
    if (creatingReportRef.current) return creatingReportRef.current;
    creatingReportRef.current = createRegiReport({
      projectId: form.projectId,
      date: form.date,
      title: form.title,
      laborConditions: form.laborConditions,
      vatRate: Number(form.vatRate),
      status: 'draft',
    }).then(newId => {
      reportIdRef.current = newId;
      setReportId(newId);
      navigate(`/regierapport/${newId}`, { replace: true });
      creatingReportRef.current = null;
      return newId;
    });
    return creatingReportRef.current;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        projectId: form.projectId,
        date: form.date,
        title: form.title,
        laborConditions: form.laborConditions,
        vatRate: Number(form.vatRate),
      };
      if (reportId) {
        await updateRegiReport(reportId, data);
      } else {
        const newId = await createRegiReport({ ...data, status: 'draft' });
        reportIdRef.current = newId;
        setReportId(newId);
        navigate(`/regierapport/${newId}`, { replace: true });
      }
    } catch (e) {
      alert(`Fehler beim Speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!reportId || !sigRef.current) return;
    if (sigRef.current.isEmpty()) {
      alert('Bitte unterschreiben Sie zuerst.');
      return;
    }
    const sigDataUrl = sigRef.current.getCanvas().toDataURL('image/png');
    await signRegiReport(reportId, customerName, sigDataUrl);
    setSigModalOpen(false);
  };

  const buildPdf = async () => {
    if (!reportId || !report) return null;
    const [proj, company_] = await Promise.all([
      db.projects.get(form.projectId),
      db.company.toCollection().first(),
    ]);
    if (!proj) return null;
    return {
      pdf: await generateRegiReportPdf({
        report,
        project: proj,
        positions: positions || [],
        company: company_ || null,
        photos: photos || [],
      }),
      proj,
      company: company_ || null,
    };
  };

  const handleDownload = async () => {
    const result = await buildPdf();
    if (!result) return;
    result.pdf.save(`Regierapport_${form.date}.pdf`);
  };

  const handleShare = async () => {
    const result = await buildPdf();
    if (!result) return;
    await sharePdf(result.pdf, {
      filename: `Regierapport_${form.date}.pdf`,
      title: form.title,
      subject: `Regierapport ${form.date} – ${result.proj.title}`,
      body: buildRegiReportEmailBody({
        projectTitle: result.proj.title,
        date: form.date,
        companyName: result.company?.name || '',
        grossTotal,
        customerName: report?.customerName,
      }),
    });
  };

  const handleEmail = async () => {
    const result = await buildPdf();
    if (!result) return;
    await sendByEmail(result.pdf, {
      filename: `Regierapport_${form.date}.pdf`,
      title: form.title,
      subject: `Regierapport ${form.date} – ${result.proj.title}`,
      body: buildRegiReportEmailBody({
        projectTitle: result.proj.title,
        date: form.date,
        companyName: result.company?.name || '',
        grossTotal,
        customerName: report?.customerName,
      }),
    });
  };

  const handleMarkInvoiced = async () => {
    if (!reportId) return;
    await updateRegiReport(reportId, { status: 'invoiced' });
  };

  const handleDuplicate = async () => {
    if (!reportId) return;
    const newId = await duplicateRegiReport(reportId);
    navigate(`/regierapport/${newId}`);
  };

  const handleInvoicePdf = async () => {
    if (!reportId || !report) return;
    const [proj, company_] = await Promise.all([
      db.projects.get(form.projectId),
      db.company.toCollection().first(),
    ]);
    if (!proj) return;
    const { pdf, invoiceNumber } = await generateInvoicePdf({
      report,
      positions: positions || [],
      project: proj,
      company: company_ || null,
    });
    pdf.save(`Rechnung_${invoiceNumber}_${form.date}.pdf`);
  };

  const projectOptions = projects?.map(p => ({ value: p.id, label: p.title })) || [];

  // Totals
  const positionsByType: Record<string, typeof positions> = {
    labor: positions?.filter(p => p.type === 'labor') || [],
    material: positions?.filter(p => p.type === 'material') || [],
    machine: positions?.filter(p => p.type === 'machine') || [],
    extra: positions?.filter(p => p.type === 'extra') || [],
  };
  const netTotal = positions?.reduce((s, p) => s + p.total, 0) ?? 0;
  const vatAmount = netTotal * (Number(form.vatRate) / 100);
  const grossTotal = netTotal + vatAmount;

  const tabs = isAdmin
    ? [
        { id: 'info', label: 'Info' },
        { id: 'positions', label: `Positionen (${positions?.length ?? 0})` },
        { id: 'photos', label: `Fotos (${photos?.length ?? 0})`, icon: <Image size={14} /> },
        { id: 'summary', label: 'Abschluss' },
      ]
    : [
        { id: 'info', label: 'Info' },
        { id: 'positions', label: `Positionen (${positions?.length ?? 0})` },
        { id: 'photos', label: `Fotos (${photos?.length ?? 0})`, icon: <Image size={14} /> },
        { id: 'summary', label: report?.customerSignature ? 'Unterschrift ✓' : 'Unterschrift' },
      ];

  return (
    <div>
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
        <div className="px-4 py-2 flex items-center gap-2">
          <button
            onClick={() => navigate(form.projectId ? `/projects/${form.projectId}` : '/')}
            className="p-1.5 -ml-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{form.title}</span>
          <div className="flex items-center gap-2">
            {reportId && (
              <Button variant="ghost" size="sm" onClick={() => setActionSheetOpen(true)}>
                <MoreVertical size={16} />
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={handleSave}>
              <Check size={16} /> Speichern
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="px-4 pb-24 space-y-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <Select label="Projekt *" value={form.projectId} onChange={set('projectId')} options={projectOptions} placeholder="Projekt wählen…" />
              <Input label="Datum" type="date" value={form.date} onChange={set('date')} />
              <Input label="Titel" value={form.title} onChange={set('title')} />
              <Input label="MWST %" type="number" value={form.vatRate} onChange={set('vatRate')} />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Regiekonditionen</h3>
              <Textarea
                value={form.laborConditions}
                onChange={set('laborConditions')}
                rows={6}
                placeholder="Stundensätze, Materialaufschlag, Bedingungen…"
              />
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <PositionsTab
            reportId={reportId}
            positions={positions || []}
            onEnsureReport={ensureReport}
            materials={materials || []}
            machines={machines || []}
            projectId={form.projectId}
          />
        )}

        {activeTab === 'photos' && (
          <RegiPhotosTab
            photos={photos || []}
            onEnsureReport={ensureReport}
          />
        )}

        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Totals summary — admin only */}
            {isAdmin && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Zusammenfassung</h3>
                </div>
                {Object.entries(positionsByType).map(([type, pos]) => {
                  const typeLabels: Record<string, string> = { labor: 'Arbeit', material: 'Material', machine: 'Maschinen', extra: 'Zusatz' };
                  const subtotal = pos?.reduce((s, p) => s + p.total, 0) ?? 0;
                  if (!pos || pos.length === 0) return null;
                  return (
                    <div key={type} className="px-4 py-2.5 flex justify-between border-b border-gray-50 dark:border-gray-700">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{typeLabels[type]}</span>
                      <span className="text-sm font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                  );
                })}
                <div className="px-4 py-2.5 flex justify-between border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Nettototal</span>
                  <span className="text-sm font-semibold">{formatCurrency(netTotal)}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-300">MWST {form.vatRate}%</span>
                  <span className="text-sm">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between bg-primary-50 dark:bg-primary-900/30">
                  <span className="font-bold text-primary-900">Gesamttotal</span>
                  <span className="font-bold text-xl text-primary-900">{formatCurrency(grossTotal)}</span>
                </div>
              </div>
            )}

            {/* Signature — always visible */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Kundenbestätigung</h3>
              {report?.customerSignature ? (
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <img
                      src={report.customerSignature}
                      alt="Unterschrift"
                      className="max-h-20 w-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Unterzeichnet von <strong>{report.customerName}</strong>
                  </p>
                  <Badge variant="success">Signiert</Badge>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Name Kunde"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Vor- und Nachname"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => { await ensureReport(); setSigModalOpen(true); }}
                  >
                    <PenTool size={16} /> Kundenunterschrift einholen
                  </Button>
                </div>
              )}
            </div>

            {/* Status-Flow + PDF — admin only */}
            {isAdmin && (
              <>
                {report?.status === 'signed' && (
                  <Button variant="secondary" className="w-full" onClick={handleMarkInvoiced}>
                    <Receipt size={16} /> Als verrechnet markieren
                  </Button>
                )}
                {(report?.status === 'signed' || report?.status === 'invoiced') && (
                  <Button variant="outline" className="w-full" onClick={handleInvoicePdf}>
                    <FileText size={16} /> Rechnung erstellen (PDF)
                  </Button>
                )}
                {report?.status === 'invoiced' && (
                  <div className="flex justify-center">
                    <Badge variant="info" className="text-sm py-2 px-4">✓ Verrechnet</Badge>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={handleDownload}>
                  <Download size={16} /> PDF erstellen & speichern
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Modal open={sigModalOpen} onClose={() => setSigModalOpen(false)} title="Kundenunterschrift" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ich bestätige die korrekte Ausführung der aufgeführten Arbeiten und Leistungen.
          </p>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                width: 500,
                height: 200,
                className: 'w-full touch-none',
                style: { touchAction: 'none' },
              }}
              backgroundColor="transparent"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sigRef.current?.clear()}
            >
              <X size={14} /> Löschen
            </Button>
            <Button className="flex-1" onClick={handleSign}>
              <Check size={16} /> Bestätigen & speichern
            </Button>
          </div>
        </div>
      </Modal>

      {/* Export / Actions Bottom Sheet */}
      <ActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        title="Aktionen"
        items={[
          {
            icon: <Download size={18} />,
            label: 'PDF herunterladen',
            description: 'Regierapport als PDF-Datei speichern',
            onClick: handleDownload,
          },
          {
            icon: <Share2 size={18} />,
            label: 'Teilen',
            description: 'PDF via App teilen (iOS/Android)',
            onClick: handleShare,
          },
          {
            icon: <PenTool size={18} />,
            label: 'Per E-Mail senden',
            description: 'PDF herunterladen + E-Mail-App öffnen',
            onClick: handleEmail,
          },
          {
            icon: <Copy size={18} />,
            label: 'Rapport duplizieren',
            description: 'Kopie als neuen Entwurf erstellen',
            onClick: handleDuplicate,
          },
          ...(report?.status === 'signed' ? [{
            icon: <Receipt size={18} />,
            label: 'Als verrechnet markieren',
            description: 'Status auf "Verrechnet" setzen',
            onClick: handleMarkInvoiced,
          }] : []),
          ...((report?.status === 'signed' || report?.status === 'invoiced') ? [{
            icon: <FileText size={18} />,
            label: 'Rechnung erstellen',
            description: 'Rechnungs-PDF generieren und speichern',
            onClick: handleInvoicePdf,
          }] : []),
        ]}
      />
    </div>
  );
}

function PositionsTab({ positions, onEnsureReport, materials, machines, projectId }: {
  reportId?: string;
  positions: RegiPosition[];
  onEnsureReport: () => Promise<string>;
  materials: Material[];
  machines: Machine[];
  projectId: string;
}) {
  const { isAdmin } = useAdmin();
  const [addingType, setAddingType] = useState<'labor' | 'material' | 'machine' | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const dailyReports = useDailyReports(projectId || undefined);

  type TimeSlot = { start: string; end: string };
  const calcSlotsHours = (s: TimeSlot[]) => s.reduce((sum, sl) => sum + calcTotalHours(sl.start, sl.end, 0), 0);
  const slotsLabel = (s: TimeSlot[]) => s.map(sl => `${sl.start}–${sl.end}`).join(' / ');

  const [laborSlots, setLaborSlots] = useState<TimeSlot[]>([{ start: '07:00', end: '17:00' }]);
  const [laborForm, setLaborForm] = useState({ description: '', unitPrice: '75' });
  const [matForm, setMatForm] = useState({ materialId: '', description: '', quantity: '1', unit: 'Stk', unitPrice: '0' });
  const [machForm, setMachForm] = useState({ machineId: '', description: '', hours: '1', unitPrice: '0' });

  const laborItems = positions.filter(p => p.type === 'labor');
  const matItems = positions.filter(p => p.type === 'material');
  const machItems = positions.filter(p => p.type === 'machine');
  const extraItems = positions.filter(p => p.type === 'extra');

  const addPosition = async (
    type: RegiPosition['type'],
    description: string,
    quantity: number,
    unit: string,
    unitPrice: number,
    extra?: { startTime?: string; endTime?: string; breakMinutes?: number; timeSlots?: string },
  ) => {
    if (!description) return;
    const rId = await onEnsureReport();
    await addRegiPosition({
      regiReportId: rId,
      type,
      description,
      quantity,
      unit,
      unitPrice,
      total: quantity * unitPrice,
      sortOrder: positions.length,
      ...extra,
    });
    setAddingType(null);
  };

  const renderPositionRow = (pos: RegiPosition, i: number) => {
    const isLabor = pos.type === 'labor';
    let timeLine: string | null = null;
    if (isLabor) {
      if (pos.timeSlots) {
        try {
          const parsed: TimeSlot[] = JSON.parse(pos.timeSlots);
          timeLine = slotsLabel(parsed);
        } catch {}
      } else if (pos.startTime && pos.endTime) {
        timeLine = `${pos.startTime}–${pos.endTime}`;
      }
    }
    return (
      <div key={pos.id} className="px-4 py-3 flex justify-between items-center border-b border-gray-50 dark:border-gray-700 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono w-4">{i + 1}.</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">{pos.description}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-6">
            {timeLine
              ? <>{timeLine} · <strong>{formatHours(pos.quantity)}</strong>{isAdmin ? ` × ${formatCurrency(pos.unitPrice)}/h` : ''}</>
              : <>{pos.quantity} {pos.unit}{isAdmin ? ` × ${formatCurrency(pos.unitPrice)}` : ''}</>
            }
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{formatCurrency(pos.total)}</span>}
          <button onClick={() => deleteRegiPosition(pos.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const sectionHeader = (label: string, total: number) => (
    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 flex justify-between items-center">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      {isAdmin && total > 0 && <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>}
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Arbeit ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {sectionHeader('Arbeit', laborItems.reduce((s, p) => s + p.total, 0))}
        {laborItems.map((pos, i) => renderPositionRow(pos, i))}

        {addingType === 'labor' ? (
          <div className="p-4 space-y-3 border-t border-gray-100 dark:border-gray-700">
            <Input
              label="Beschreibung *"
              value={laborForm.description}
              onChange={e => setLaborForm(f => ({ ...f, description: e.target.value }))}
              placeholder="z.B. Bodenbeläge verlegen"
            />
            <div className="space-y-2">
              {laborSlots.map((slot, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input label={i === 0 ? 'Von' : ''} type="time" value={slot.start} onChange={e => setLaborSlots(s => s.map((sl, idx) => idx === i ? { ...sl, start: e.target.value } : sl))} />
                  </div>
                  <div className="flex-1">
                    <Input label={i === 0 ? 'Bis' : ''} type="time" value={slot.end} onChange={e => setLaborSlots(s => s.map((sl, idx) => idx === i ? { ...sl, end: e.target.value } : sl))} />
                  </div>
                  {laborSlots.length > 1 && (
                    <button onClick={() => setLaborSlots(s => s.filter((_, idx) => idx !== i))} className="p-2 mb-[1px] rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setLaborSlots(s => [...s, { start: s[s.length - 1].end, end: s[s.length - 1].end }])}
                className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 font-medium"
              >
                <Plus size={13} /> Zeitraum hinzufügen
              </button>
            </div>
            <div className="text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 flex justify-between">
              <span>Total Stunden</span>
              <strong>{formatHours(calcSlotsHours(laborSlots))}</strong>
            </div>
            {isAdmin && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label="Satz (CHF/h)" type="number" value={laborForm.unitPrice} onChange={e => setLaborForm(f => ({ ...f, unitPrice: e.target.value }))} />
                </div>
                <div className="text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 mb-[1px] whitespace-nowrap">
                  = <strong>{formatCurrency(calcSlotsHours(laborSlots) * Number(laborForm.unitPrice))}</strong>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => {
                const hrs = calcSlotsHours(laborSlots);
                addPosition('labor', laborForm.description, hrs, 'h', Number(laborForm.unitPrice), {
                  startTime: laborSlots[0].start,
                  endTime: laborSlots[laborSlots.length - 1].end,
                  timeSlots: JSON.stringify(laborSlots),
                });
                setLaborForm({ description: '', unitPrice: '75' });
                setLaborSlots([{ start: '07:00', end: '17:00' }]);
              }}>
                <Check size={14} /> Hinzufügen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingType(null); setLaborForm({ description: '', unitPrice: '75' }); setLaborSlots([{ start: '07:00', end: '17:00' }]); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingType('labor')}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 font-medium border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> Arbeit hinzufügen
          </button>
        )}
      </div>

      {/* ── Material ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {sectionHeader('Material', matItems.reduce((s, p) => s + p.total, 0))}
        {matItems.map((pos, i) => renderPositionRow(pos, i))}

        {addingType === 'material' ? (
          <div className="p-4 space-y-3 border-t border-gray-100 dark:border-gray-700">
            {materials.length > 0 && (
              <Select
                label="Aus Stammdaten"
                options={materials.map(m => ({ value: m.id, label: m.name }))}
                placeholder="Wählen oder manuell…"
                value={matForm.materialId}
                onChange={e => {
                  const mat = materials.find(m => m.id === e.target.value);
                  if (mat) setMatForm(f => ({ ...f, materialId: e.target.value, description: mat.name, unit: mat.unit, unitPrice: mat.unitPrice.toString() }));
                }}
              />
            )}
            <Input
              label="Bezeichnung *"
              value={matForm.description}
              onChange={e => setMatForm(f => ({ ...f, description: e.target.value }))}
              placeholder="z.B. Kies 0-32"
            />
            <div className={`grid gap-2 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Input label="Menge" type="number" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))} />
              <Select label="Einheit" options={UNITS.map(u => ({ value: u, label: u }))} value={matForm.unit} onChange={e => setMatForm(f => ({ ...f, unit: e.target.value }))} />
              {isAdmin && <Input label="EP (CHF)" type="number" value={matForm.unitPrice} onChange={e => setMatForm(f => ({ ...f, unitPrice: e.target.value }))} />}
            </div>
            {isAdmin && (
              <div className="text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2">
                Total: <strong>{formatCurrency(Number(matForm.quantity) * Number(matForm.unitPrice))}</strong>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => addPosition('material', matForm.description, Number(matForm.quantity), matForm.unit, Number(matForm.unitPrice))}>
                <Check size={14} /> Hinzufügen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingType(null); setMatForm({ materialId: '', description: '', quantity: '1', unit: 'Stk', unitPrice: '0' }); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingType('material')}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 font-medium border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> Material hinzufügen
          </button>
        )}
      </div>

      {/* ── Maschinen (nur wenn Einträge vorhanden oder gerade hinzufügen) ── */}
      {(machItems.length > 0 || addingType === 'machine') && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {sectionHeader('Maschinen', machItems.reduce((s, p) => s + p.total, 0))}
          {machItems.map((pos, i) => renderPositionRow(pos, i))}
          {addingType === 'machine' ? (
            <div className="p-4 space-y-3 border-t border-gray-100 dark:border-gray-700">
              {machines.length > 0 && (
                <Select
                  label="Aus Stammdaten"
                  options={machines.map(m => ({ value: m.id, label: m.name }))}
                  placeholder="Wählen oder manuell…"
                  value={machForm.machineId}
                  onChange={e => {
                    const machine = machines.find(m => m.id === e.target.value);
                    if (machine) setMachForm(f => ({ ...f, machineId: e.target.value, description: machine.name, unitPrice: machine.hourlyRate.toString() }));
                  }}
                />
              )}
              <Input label="Bezeichnung *" value={machForm.description} onChange={e => setMachForm(f => ({ ...f, description: e.target.value }))} placeholder="z.B. Bagger CAT 320" />
              <div className={`grid gap-2 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Input label="Stunden" type="number" value={machForm.hours} onChange={e => setMachForm(f => ({ ...f, hours: e.target.value }))} min="0.5" step="0.5" />
                {isAdmin && <Input label="Satz (CHF/h)" type="number" value={machForm.unitPrice} onChange={e => setMachForm(f => ({ ...f, unitPrice: e.target.value }))} />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => addPosition('machine', machForm.description, Number(machForm.hours), 'h', Number(machForm.unitPrice))}>
                  <Check size={14} /> Hinzufügen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingType(null); setMachForm({ machineId: '', description: '', hours: '1', unitPrice: '0' }); }}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingType('machine')}
              className="w-full px-4 py-3 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 font-medium border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} /> Maschine hinzufügen
            </button>
          )}
        </div>
      )}

      {/* ── Maschinen hinzufügen (wenn noch keine Einträge) ── */}
      {machItems.length === 0 && addingType !== 'machine' && (
        <button
          onClick={() => setAddingType('machine')}
          className="w-full px-4 py-3 flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-600 rounded-2xl hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
        >
          <Plus size={16} /> Maschine hinzufügen
        </button>
      )}

      {/* ── Zusatzpositionen (extra) ── */}
      {extraItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {sectionHeader('Zusatzkosten', extraItems.reduce((s, p) => s + p.total, 0))}
          {extraItems.map((pos, i) => renderPositionRow(pos, i))}
        </div>
      )}

      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} title="Tagesrapport übernehmen">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(!dailyReports || dailyReports.length === 0) ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Keine Tagesrapporte für dieses Projekt vorhanden.</p>
          ) : (
            dailyReports.map(dr => (
              <DailyReportImportButton
                key={dr.id}
                dr={dr}
                positions={positions}
                onEnsureReport={onEnsureReport}
                onClose={() => setImportModalOpen(false)}
              />
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

function DailyReportImportButton({ dr, positions, onEnsureReport, onClose }: {
  dr: { id: string; title: string; date: string };
  positions: RegiPosition[];
  onEnsureReport: () => Promise<string>;
  onClose: () => void;
}) {
  const leistungEntries = useLeistungEntries(dr.id);

  return (
    <button
      onClick={async () => {
        const rId = await onEnsureReport();
        const [timeEntries, materialEntries, machineEntries, employees] = await Promise.all([
          db.timeEntries.where('reportId').equals(dr.id).toArray(),
          db.materialEntries.where('reportId').equals(dr.id).filter(e => e.reportType === 'daily').toArray(),
          db.machineEntries.where('reportId').equals(dr.id).filter(e => e.reportType === 'daily').toArray(),
          db.employees.toArray(),
        ]);
        const entries = leistungEntries || [];
        const nextOrder = positions.length;
        let i = 0;
        for (const te of timeEntries) {
          const emp = employees.find(e => e.id === te.employeeId);
          const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Mitarbeiter';
          await addRegiPosition({
            regiReportId: rId,
            type: 'labor',
            description: `${name} – Arbeit`,
            quantity: te.totalHours,
            unit: 'h',
            unitPrice: emp?.hourlyRate ?? 75,
            total: te.totalHours * (emp?.hourlyRate ?? 75),
            sortOrder: nextOrder + i++,
          });
        }
        for (const le of entries) {
          await addRegiPosition({
            regiReportId: rId,
            type: 'labor',
            description: le.leistungsart + (le.kommentar ? ` – ${le.kommentar}` : ''),
            quantity: le.stunden,
            unit: 'h',
            unitPrice: 75,
            total: le.stunden * 75,
            sortOrder: nextOrder + i++,
          });
        }
        for (const me of materialEntries) {
          await addRegiPosition({
            regiReportId: rId,
            type: 'material',
            description: me.description,
            quantity: me.quantity,
            unit: me.unit,
            unitPrice: me.unitPrice,
            total: me.total,
            sortOrder: nextOrder + i++,
          });
        }
        for (const mach of machineEntries) {
          await addRegiPosition({
            regiReportId: rId,
            type: 'machine',
            description: mach.description,
            quantity: mach.hours,
            unit: 'h',
            unitPrice: mach.hourlyRate,
            total: mach.total,
            sortOrder: nextOrder + i++,
          });
        }
        onClose();
      }}
      className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
    >
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{dr.title}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{dr.date}</div>
    </button>
  );
}

// ── RegiPhotosTab ─────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function RegiPhotosTab({ photos, onEnsureReport }: {
  photos: { id: string; dataUrl: string; note?: string; latitude?: number; longitude?: number }[];
  onEnsureReport: () => Promise<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getGPS = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 30000 }
      );
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const rId = await onEnsureReport();
    const coords = await getGPS();
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      await addPhoto({
        reportId: rId,
        reportType: 'regi',
        timestamp: nowISO(),
        dataUrl,
        note: '',
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
        <Camera size={16} /> Foto aufnehmen / hochladen
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {photos.map(photo => (
          <div key={photo.id} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="relative">
              <img src={photo.dataUrl} alt="Foto" className="w-full aspect-video object-cover" />
              <button
                onClick={() => deletePhoto(photo.id)}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
              >
                <Trash2 size={12} />
              </button>
              {photo.latitude && (
                <a
                  href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                >
                  GPS
                </a>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{photo.note || 'Kein Kommentar'}</p>
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Noch keine Fotos vorhanden.<br />Kamera-Button verwenden.
        </div>
      )}
    </div>
  );
}
