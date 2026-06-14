import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Plus, Trash2, Download, PenTool, X, Share2, Copy, MoreVertical, Receipt, Camera, Image, FileText } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { Tabs } from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ActionSheet from '../components/ui/ActionSheet';
import {
  useRegiReport, useRegiPositions,
  createRegiReport, updateRegiReport, signRegiReport,
  addRegiPosition, deleteRegiPosition,
} from '../hooks/useRegiReports';
import { useProjects } from '../hooks/useProjects';
import { useCompany, useMaterials, useMachines } from '../hooks/useMasterData';
import { todayISO, nowISO, formatCurrency, UNITS } from '../utils';
import { usePhotos, addPhoto, deletePhoto } from '../hooks/useDailyReports';
import { generateRegiReportPdf } from '../pdf/regiReportPdf';
import { generateInvoicePdf } from '../pdf/invoicePdf';
import { db } from '../db';
import { sharePdf, sendByEmail, buildRegiReportEmailBody } from '../utils/share';
import { duplicateRegiReport } from '../hooks/useDuplicate';

const POSITION_TYPES = [
  { value: 'labor', label: 'Arbeit' },
  { value: 'material', label: 'Material' },
  { value: 'machine', label: 'Maschinen' },
  { value: 'extra', label: 'Zusatzkosten' },
];

const DEFAULT_CONDITIONS = `Arbeitsstunden: CHF 75.00/h
Material: gemäss Aufwand + 15% Aufschlag
Maschinen: gemäss effektivem Einsatz
Minimum: 1 Stunde`;

export default function RegiReportForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const report = useRegiReport(id);
  const positions = useRegiPositions(id);
  const projects = useProjects();
  useCompany(); // loaded for PDF generation
  const materials = useMaterials();
  const machines = useMachines();

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

  const ensureReport = async (): Promise<string> => {
    if (reportId) return reportId;
    const newId = await createRegiReport({
      projectId: form.projectId,
      date: form.date,
      title: form.title,
      laborConditions: form.laborConditions,
      vatRate: Number(form.vatRate),
      status: 'draft',
    });
    setReportId(newId);
    navigate(`/regierapport/${newId}`, { replace: true });
    return newId;
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
        setReportId(newId);
        navigate(`/regierapport/${newId}`, { replace: true });
      }
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
    const sigDataUrl = sigRef.current.toDataURL('image/png');
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
    const { pdf, invoiceNumber } = generateInvoicePdf({
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

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'positions', label: `Positionen (${positions?.length ?? 0})` },
    { id: 'photos', label: `Fotos (${photos?.length ?? 0})`, icon: <Image size={14} /> },
    { id: 'summary', label: 'Abschluss' },
  ];

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Regierapport' : 'Neuer Regierapport'}
        subtitle={form.title}
        backTo={form.projectId ? `/projects/${form.projectId}` : '/'}
        action={
          <div className="flex gap-2">
            {reportId && (
              <Button variant="ghost" size="sm" onClick={() => setActionSheetOpen(true)}>
                <MoreVertical size={16} />
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={handleSave}>
              <Check size={16} /> Speichern
            </Button>
          </div>
        }
      />

      <div className="px-4 py-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="px-4 pb-24 space-y-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <Select label="Projekt *" value={form.projectId} onChange={set('projectId')} options={projectOptions} placeholder="Projekt wählen…" />
              <Input label="Datum" type="date" value={form.date} onChange={set('date')} />
              <Input label="Titel" value={form.title} onChange={set('title')} />
              <Input label="MWST %" type="number" value={form.vatRate} onChange={set('vatRate')} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Regiekonditionen</h3>
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
            {/* Totals summary */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-sm text-gray-700">Zusammenfassung</h3>
              </div>
              {Object.entries(positionsByType).map(([type, pos]) => {
                const typeLabels: Record<string, string> = { labor: 'Arbeit', material: 'Material', machine: 'Maschinen', extra: 'Zusatz' };
                const subtotal = (pos as any[])?.reduce((s: number, p: any) => s + p.total, 0) ?? 0;
                if (!pos || (pos as any[]).length === 0) return null;
                return (
                  <div key={type} className="px-4 py-2.5 flex justify-between border-b border-gray-50">
                    <span className="text-sm text-gray-600">{typeLabels[type]}</span>
                    <span className="text-sm font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                );
              })}
              <div className="px-4 py-2.5 flex justify-between border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Nettototal</span>
                <span className="text-sm font-semibold">{formatCurrency(netTotal)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between border-b border-gray-100">
                <span className="text-sm text-gray-600">MWST {form.vatRate}%</span>
                <span className="text-sm">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-primary-50">
                <span className="font-bold text-primary-900">Gesamttotal</span>
                <span className="font-bold text-xl text-primary-900">{formatCurrency(grossTotal)}</span>
              </div>
            </div>

            {/* Signature */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Kundenbestätigung</h3>
              {report?.customerSignature ? (
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <img
                      src={report.customerSignature}
                      alt="Unterschrift"
                      className="max-h-20 w-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
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
                    onClick={() => { ensureReport(); setSigModalOpen(true); }}
                  >
                    <PenTool size={16} /> Kundenunterschrift einholen
                  </Button>
                </div>
              )}
            </div>

            {/* Status-Flow */}
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
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Modal open={sigModalOpen} onClose={() => setSigModalOpen(false)} title="Kundenunterschrift" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Ich bestätige die korrekte Ausführung der aufgeführten Arbeiten und Leistungen.
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
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

function PositionsTab({ positions, onEnsureReport, materials, machines }: {
  reportId?: string;
  positions: any[];
  onEnsureReport: () => Promise<string>;
  materials: any[];
  machines: any[];
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    type: 'labor',
    description: '',
    quantity: '1',
    unit: 'h',
    unitPrice: '75',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMaterialSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mat = materials.find((m: any) => m.id === e.target.value);
    if (mat) {
      setForm(f => ({ ...f, description: mat.name, unit: mat.unit, unitPrice: mat.unitPrice.toString() }));
    }
  };

  const handleMachineSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const machine = machines.find((m: any) => m.id === e.target.value);
    if (machine) {
      setForm(f => ({ ...f, description: machine.name, unitPrice: machine.hourlyRate.toString(), unit: 'h' }));
    }
  };

  const handleAdd = async () => {
    if (!form.description) return;
    const rId = await onEnsureReport();
    const qty = Number(form.quantity);
    const price = Number(form.unitPrice);
    await addRegiPosition({
      regiReportId: rId,
      type: form.type as any,
      description: form.description,
      quantity: qty,
      unit: form.unit,
      unitPrice: price,
      total: qty * price,
      sortOrder: positions.length,
    });
    setAdding(false);
    setForm({ type: 'labor', description: '', quantity: '1', unit: 'h', unitPrice: '75' });
  };

  const typeGroups = POSITION_TYPES.map(t => ({
    ...t,
    items: positions.filter(p => p.type === t.value),
  }));

  return (
    <div className="space-y-3">
      {typeGroups.map(group => {
        if (group.items.length === 0) return null;
        const subtotal = group.items.reduce((s: number, p: any) => s + p.total, 0);
        return (
          <div key={group.value} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">{group.label}</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            {group.items.map((pos: any, i: number) => (
              <div key={pos.id} className="px-4 py-3 flex justify-between items-start border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">{i + 1}.</span>
                    <span className="text-sm text-gray-900">{pos.description}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-5">{pos.quantity} {pos.unit} × {formatCurrency(pos.unitPrice)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-sm">{formatCurrency(pos.total)}</span>
                  <button onClick={() => deleteRegiPosition(pos.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {adding && (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Position hinzufügen</h4>
          <Select label="Typ" options={POSITION_TYPES} value={form.type} onChange={set('type')} />
          {form.type === 'material' && materials.length > 0 && (
            <Select
              label="Aus Stammdaten"
              options={materials.map((m: any) => ({ value: m.id, label: m.name }))}
              placeholder="Wählen oder manuell..."
              onChange={handleMaterialSelect}
              value=""
            />
          )}
          {form.type === 'machine' && machines.length > 0 && (
            <Select
              label="Aus Stammdaten"
              options={machines.map((m: any) => ({ value: m.id, label: m.name }))}
              placeholder="Wählen oder manuell..."
              onChange={handleMachineSelect}
              value=""
            />
          )}
          <Input label="Beschreibung *" value={form.description} onChange={set('description')} placeholder="z.B. Mauerwerk erstellen" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Menge" type="number" value={form.quantity} onChange={set('quantity')} />
            <Select label="Einheit" options={UNITS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={set('unit')} />
            <Input label="EP (CHF)" type="number" value={form.unitPrice} onChange={set('unitPrice')} />
          </div>
          <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
            Total: <strong>{formatCurrency(Number(form.quantity) * Number(form.unitPrice))}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Hinzufügen</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
        <Plus size={16} /> Position hinzufügen
      </Button>
    </div>
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
          <div key={photo.id} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
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
              <p className="text-xs text-gray-500 truncate">{photo.note || 'Kein Kommentar'}</p>
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
