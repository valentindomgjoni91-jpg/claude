import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import {
  Check, Clock, Package, Truck, FileText, Image, Users,
  Plus, Trash2, Camera, Download, ChevronDown, ChevronUp,
  Share2, Copy, MoreVertical, PenTool, X, Briefcase, ArrowLeft,
} from 'lucide-react';
import { useLeistungEntries, addLeistungEntry, deleteLeistungEntry } from '../hooks/useLeistungEntries';
import type { LeistungEntry } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import { Tabs } from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import ActionSheet from '../components/ui/ActionSheet';
import { sharePdf, sendByEmail, buildDailyReportEmailBody } from '../utils/share';
import { duplicateDailyReport } from '../hooks/useDuplicate';
import {
  useDailyReport, useTimeEntries, useMaterialEntries, useMachineEntries,
  useSubcontractorEntries, usePhotos,
  createDailyReport, updateDailyReport,
  addTimeEntry, updateTimeEntry, deleteTimeEntry,
  addMaterialEntry, deleteMaterialEntry,
  addMachineEntry, deleteMachineEntry,
  addSubcontractorEntry, deleteSubcontractorEntry,
  addPhoto, deletePhoto, signDailyReport,
} from '../hooks/useDailyReports';
import { useProjects } from '../hooks/useProjects';
import { useEmployees, useMachines, useMaterials, useCompany } from '../hooks/useMasterData';
import { todayISO, nowISO, calcTotalHours, formatHours, formatCurrency, UNITS } from '../utils';
import { generateDailyReportPdf } from '../pdf/dailyReportPdf';
import { db } from '../db';
import type { Weather, TimeEntry, MaterialEntry, MachineEntry, SubcontractorEntry, Photo, Material, Machine } from '../types';


export default function DailyReportForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const report = useDailyReport(id);
  const timeEntries = useTimeEntries(id);
  const materialEntries = useMaterialEntries(id);
  const machineEntries = useMachineEntries(id);
  const subcontractorEntries = useSubcontractorEntries(id);
  const photos = usePhotos(id);

  const projects = useProjects();
  const employees = useEmployees();
  const machines = useMachines();
  const materials = useMaterials();
  useCompany();

  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);
  const [reportId, setReportId] = useState(id);
  const leistungEntries = useLeistungEntries(reportId);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const sigRef = useRef<SignatureCanvas>(null);

  const [form, setForm] = useState({
    projectId: searchParams.get('projectId') || '',
    date: todayISO(),
    title: `Tagesrapport ${todayISO()}`,
    weather: '' as Weather | '',
    temperature: '',
    notes: '',
    status: 'draft' as 'draft' | 'completed',
  });

  useEffect(() => {
    if (report) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        projectId: report.projectId,
        date: report.date,
        title: report.title,
        weather: report.weather || '',
        temperature: report.temperature?.toString() || '',
        notes: report.notes || '',
        status: report.status,
      });
      setCustomerName(report.customerName || '');
    }
  }, [report]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const reportIdRef = useRef<string | undefined>(id);
  const creatingReportRef = useRef<Promise<string> | null>(null);

  const ensureReport = (): Promise<string> => {
    if (reportIdRef.current) return Promise.resolve(reportIdRef.current);
    if (creatingReportRef.current) return creatingReportRef.current;
    const data = {
      projectId: form.projectId,
      date: form.date,
      title: form.title,
      weather: (form.weather || undefined) as Weather | undefined,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      notes: form.notes || undefined,
      status: form.status,
    };
    creatingReportRef.current = createDailyReport(data).then(newId => {
      reportIdRef.current = newId;
      setReportId(newId);
      navigate(`/tagesrapport/${newId}`, { replace: true });
      creatingReportRef.current = null;
      return newId;
    });
    return creatingReportRef.current;
  };

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const rId = await ensureReport();
    const dataUrl = sigRef.current.getCanvas().toDataURL('image/png');
    await signDailyReport(rId, customerName, dataUrl);
    setSigModalOpen(false);
  };

  const handleSave = async (complete = false) => {
    setSaving(true);
    try {
      const data = {
        projectId: form.projectId,
        date: form.date,
        title: form.title,
        weather: (form.weather || undefined) as Weather | undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        notes: form.notes || undefined,
        status: complete ? 'completed' as const : (form.status as 'draft' | 'completed'),
      };
      if (reportId) {
        await updateDailyReport(reportId, data);
        if (complete) setForm(f => ({ ...f, status: 'completed' }));
      } else {
        const newId = await createDailyReport(data);
        reportIdRef.current = newId;
        setReportId(newId);
        navigate(`/tagesrapport/${newId}`, { replace: true });
      }
    } catch (e) {
      alert(`Fehler beim Speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  const buildPdf = async () => {
    if (!reportId || !report) return null;
    const [proj, employees_, machines_, company_] = await Promise.all([
      db.projects.get(form.projectId),
      db.employees.toArray(),
      db.machines.toArray(),
      db.company.toCollection().first(),
    ]);
    if (!proj) return null;
    return {
      pdf: await generateDailyReportPdf({
        report,
        project: proj,
        timeEntries: timeEntries || [],
        materialEntries: materialEntries || [],
        machineEntries: machineEntries || [],
        subcontractorEntries: subcontractorEntries || [],
        photos: photos || [],
        employees: employees_,
        machines: machines_,
        company: company_ || null,
      }),
      proj,
      company: company_ || null,
    };
  };

  const handleDownload = async () => {
    const result = await buildPdf();
    if (!result) return;
    result.pdf.save(`Tagesrapport_${form.date}.pdf`);
  };

  const handleShare = async () => {
    const result = await buildPdf();
    if (!result) return;
    const totalHours_ = timeEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
    const totalMat_ = materialEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
    await sharePdf(result.pdf, {
      filename: `Tagesrapport_${form.date}.pdf`,
      title: form.title,
      subject: `Tagesrapport ${form.date} – ${result.proj.title}`,
      body: buildDailyReportEmailBody({
        projectTitle: result.proj.title,
        date: form.date,
        companyName: result.company?.name || '',
        totalHours: totalHours_,
        totalMaterialCost: totalMat_,
      }),
    });
  };

  const handleEmail = async () => {
    const result = await buildPdf();
    if (!result) return;
    const totalHours_ = timeEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
    const totalMat_ = materialEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
    await sendByEmail(result.pdf, {
      filename: `Tagesrapport_${form.date}.pdf`,
      title: form.title,
      subject: `Tagesrapport ${form.date} – ${result.proj.title}`,
      body: buildDailyReportEmailBody({
        projectTitle: result.proj.title,
        date: form.date,
        companyName: result.company?.name || '',
        totalHours: totalHours_,
        totalMaterialCost: totalMat_,
      }),
      recipientEmail: result.proj.clientContact?.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0],
    });
  };

  const handleDuplicate = async () => {
    if (!reportId) return;
    const newId = await duplicateDailyReport(reportId);
    navigate(`/tagesrapport/${newId}`);
  };

  const projectOptions = projects?.map(p => ({ value: p.id, label: p.title })) || [];
  const employeeOptions = employees?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) || [];
  const machineOptions = machines?.map(m => ({ value: m.id, label: m.name })) || [];
  const materialOptions = materials?.map(m => ({ value: m.id, label: m.name })) || [];

  const subCount = subcontractorEntries?.length ?? 0;

  const tabs = [
    { id: 'info', label: 'Info', icon: <FileText size={14} /> },
    { id: 'time', label: `Zeiten (${timeEntries?.length ?? 0})`, icon: <Clock size={14} /> },
    { id: 'material', label: `Material (${materialEntries?.length ?? 0})`, icon: <Package size={14} /> },
    { id: 'machine', label: `Maschinen (${machineEntries?.length ?? 0})`, icon: <Truck size={14} /> },
    { id: 'subcontractor', label: `Fremd${subCount > 0 ? ` (${subCount})` : ''}`, icon: <Users size={14} /> },
    { id: 'leistungen', label: `Leistungen (${leistungEntries?.length ?? 0})`, icon: <Briefcase size={14} /> },
    { id: 'photos', label: `Fotos (${photos?.length ?? 0})`, icon: <Image size={14} /> },
    { id: 'signature', label: report?.customerSignature ? 'Unterschrift ✓' : 'Unterschrift', icon: <PenTool size={14} /> },
  ];

  const totalHours = timeEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
  const totalMaterialCost = materialEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
  const totalMachineCost = machineEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
  const totalSubCost = subcontractorEntries?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="flex flex-col">
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
            <Button size="sm" loading={saving} onClick={() => handleSave()}>
              <Check size={16} /> Speichern
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="px-4 pb-4">
        {activeTab === 'info' && (
          <InfoTab form={form} set={set} projectOptions={projectOptions} />
        )}
        {activeTab === 'time' && (
          <TimeTab
            entries={timeEntries || []}
            employeeOptions={employeeOptions}
            onEnsureReport={ensureReport}
            totalHours={totalHours}
            reportDate={form.date}
          />
        )}
        {activeTab === 'material' && (
          <MaterialTab
            entries={materialEntries || []}
            materialOptions={materialOptions}
            materials={materials || []}
            onEnsureReport={ensureReport}
            totalCost={totalMaterialCost}
          />
        )}
        {activeTab === 'machine' && (
          <MachineTab
            entries={machineEntries || []}
            machineOptions={machineOptions}
            employeeOptions={employeeOptions}
            machines={machines || []}
            onEnsureReport={ensureReport}
            totalCost={totalMachineCost}
          />
        )}
        {activeTab === 'subcontractor' && (
          <SubcontractorTab
            entries={subcontractorEntries || []}
            onEnsureReport={ensureReport}
            totalCost={totalSubCost}
          />
        )}
        {activeTab === 'leistungen' && (
          <LeistungTab
            reportId={reportId}
            entries={leistungEntries || []}
            onEnsureReport={ensureReport}
          />
        )}
        {activeTab === 'photos' && (
          <PhotosTab
            photos={photos || []}
            onEnsureReport={ensureReport}
          />
        )}
        {activeTab === 'signature' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Kundenbestätigung</h3>
              {report?.customerSignature ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <img src={report.customerSignature} alt="Unterschrift" className="max-h-24 w-auto" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Unterzeichnet von <strong>{report.customerName}</strong>
                  </p>
                  <Badge variant="success">Unterschrift vorhanden</Badge>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Kunde bestätigt die ausgeführten Arbeiten mit Unterschrift.
                  </p>
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
                    <PenTool size={16} /> Unterschrift einholen
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pb-2">
        {(form.status as string) === 'draft' && reportId && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => handleSave(true)}
            loading={saving}
          >
            <Check size={18} /> Rapport abschliessen
          </Button>
        )}
        {(form.status as string) === 'completed' && (
          <div className="flex justify-center">
            <Badge variant="success" className="text-sm py-2 px-4">✓ Rapport abgeschlossen</Badge>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Modal open={sigModalOpen} onClose={() => setSigModalOpen(false)} title="Kundenunterschrift" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ich bestätige die korrekte Ausführung der aufgeführten Arbeiten.
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
            <Button variant="ghost" size="sm" onClick={() => sigRef.current?.clear()}>
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
            description: 'Rapport als PDF-Datei speichern',
            onClick: handleDownload,
          },
          {
            icon: <Share2 size={18} />,
            label: 'Teilen',
            description: 'PDF via App teilen (iOS/Android)',
            onClick: handleShare,
          },
          {
            icon: <FileText size={18} />,
            label: 'Per E-Mail senden',
            description: 'PDF herunterladen + E-Mail-App öffnen',
            onClick: handleEmail,
          },
          {
            icon: <Copy size={18} />,
            label: 'Rapport duplizieren',
            description: 'Kopie mit heutigem Datum erstellen',
            onClick: handleDuplicate,
          },
        ]}
      />
    </div>
  );
}

// ---- InfoTab ----

interface InfoTabProps {
  form: { projectId: string; date: string; title: string; weather: string; temperature: string; notes: string };
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  projectOptions: { value: string; label: string }[];
}

function InfoTab({ form, set, projectOptions }: InfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
        <Select label="Projekt *" value={form.projectId} onChange={set('projectId')} options={projectOptions} placeholder="Projekt wählen…" />
        <Input label="Datum" type="date" value={form.date} onChange={set('date')} />
        <Input label="Titel" value={form.title} onChange={set('title')} />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <Textarea label="Notizen / Bemerkungen" value={form.notes} onChange={set('notes')} rows={4} />
      </div>
    </div>
  );
}

// ---- TimeTab ----

interface TimeTabProps {
  entries: TimeEntry[];
  employeeOptions: { value: string; label: string }[];
  onEnsureReport: () => Promise<string>;
  totalHours: number;
  reportDate: string;
}

type TimeSlot = { start: string; end: string };

function parseSlotsFromEntry(entry: TimeEntry): TimeSlot[] {
  if (entry.timeSlots) {
    try { return JSON.parse(entry.timeSlots); } catch { /* fällt auf Standard zurück */ }
  }
  if (entry.startTime && entry.endTime) return [{ start: entry.startTime, end: entry.endTime }];
  return [{ start: '07:00', end: '17:00' }];
}

function calcSlotsHours(slots: TimeSlot[]): number {
  return slots.reduce((sum, s) => sum + calcTotalHours(s.start, s.end, 0), 0);
}

function slotsLabel(slots: TimeSlot[]): string {
  return slots.map(s => `${s.start}–${s.end}`).join(' / ');
}

function SlotsInput({ slots, onChange }: { slots: TimeSlot[]; onChange: (slots: TimeSlot[]) => void }) {
  const update = (i: number, key: 'start' | 'end', val: string) =>
    onChange(slots.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const addSlot = () => onChange([...slots, { start: slots[slots.length - 1].end, end: slots[slots.length - 1].end }]);
  const removeSlot = (i: number) => onChange(slots.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label={i === 0 ? 'Von' : ''} type="time" value={slot.start} onChange={e => update(i, 'start', e.target.value)} />
          </div>
          <div className="flex-1">
            <Input label={i === 0 ? 'Bis' : ''} type="time" value={slot.end} onChange={e => update(i, 'end', e.target.value)} />
          </div>
          {slots.length > 1 && (
            <button onClick={() => removeSlot(i)} className="p-2 mb-[1px] rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button onClick={addSlot} className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 font-medium">
        <Plus size={13} /> Zeitraum hinzufügen
      </button>
    </div>
  );
}

function TimeTab({ entries, employeeOptions, onEnsureReport, totalHours, reportDate }: TimeTabProps) {
  const [adding, setAdding] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([{ start: '07:00', end: '17:00' }]);
  const [form, setForm] = useState({ employeeId: '', activity: '', note: '' });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    if (!form.employeeId) return;
    const rId = await onEnsureReport();
    const totalHrs = calcSlotsHours(slots);
    await addTimeEntry({
      reportId: rId,
      reportType: 'daily',
      employeeId: form.employeeId,
      date: reportDate,
      startTime: slots[0].start,
      endTime: slots[slots.length - 1].end,
      breakMinutes: 0,
      totalHours: totalHrs,
      timeSlots: JSON.stringify(slots),
      activity: form.activity || undefined,
      note: form.note || undefined,
    });
    setAdding(false);
    setSlots([{ start: '07:00', end: '17:00' }]);
    setForm({ employeeId: '', activity: '', note: '' });
  };

  return (
    <div className="space-y-3">
      {totalHours > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">Total Arbeitsstunden</span>
          <span className="font-bold text-primary-800 dark:text-primary-200">{formatHours(totalHours)}</span>
        </div>
      )}

      {entries.map((entry) => (
        <TimeEntryCard key={entry.id} entry={entry} employeeOptions={employeeOptions} />
      ))}

      {adding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Neuer Zeiteintrag</h4>
          <Select label="Mitarbeiter" value={form.employeeId} onChange={set('employeeId')} options={employeeOptions} placeholder="Mitarbeiter wählen" />
          <SlotsInput slots={slots} onChange={setSlots} />
          <div className="text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 flex justify-between">
            <span>Total Stunden</span>
            <strong>{formatHours(calcSlotsHours(slots))}</strong>
          </div>
          <Input label="Tätigkeit" value={form.activity} onChange={set('activity')} placeholder="z.B. Mauerwerk, Schalung…" />
          <Input label="Notiz" value={form.note} onChange={set('note')} placeholder="Interne Bemerkung" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setSlots([{ start: '07:00', end: '17:00' }]); }}>Abbrechen</Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Zeiteintrag hinzufügen
        </Button>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-center text-sm text-gray-400 py-4">Noch keine Zeiteinträge</p>
      )}
    </div>
  );
}

function TimeEntryCard({ entry, employeeOptions }: { entry: TimeEntry; employeeOptions: { value: string; label: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>(() => parseSlotsFromEntry(entry));
  const [activity, setActivity] = useState(entry.activity || '');
  const [note, setNote] = useState(entry.note || '');

  const employeeName = employeeOptions.find(e => e.value === entry.employeeId)?.label || entry.employeeId;
  const displaySlots = parseSlotsFromEntry(entry);

  const handleSave = async () => {
    const totalHours = calcSlotsHours(slots);
    await updateTimeEntry(entry.id, {
      startTime: slots[0].start,
      endTime: slots[slots.length - 1].end,
      breakMinutes: 0,
      totalHours,
      timeSlots: JSON.stringify(slots),
      activity: activity || undefined,
      note: note || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{employeeName}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{slotsLabel(displaySlots)}</div>
          {entry.activity && <div className="text-xs text-gray-400 dark:text-gray-500">{entry.activity}</div>}
          {entry.note && <div className="text-xs text-gray-400 dark:text-gray-500 italic">{entry.note}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-primary-700 dark:text-primary-400">{formatHours(entry.totalHours)}</span>
          <button onClick={() => setEditing(!editing)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            {editing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => deleteTimeEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {editing && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-3 bg-gray-50 dark:bg-gray-700">
          <SlotsInput slots={slots} onChange={setSlots} />
          <div className="text-sm bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600 flex justify-between">
            <span>Total Stunden</span>
            <strong>{formatHours(calcSlotsHours(slots))}</strong>
          </div>
          <Input label="Tätigkeit" value={activity} onChange={e => setActivity(e.target.value)} />
          <Input label="Notiz" value={note} onChange={e => setNote(e.target.value)} />
          <Button size="sm" onClick={handleSave}><Check size={14} /> Speichern</Button>
        </div>
      )}
    </div>
  );
}

// ---- MaterialTab ----

function MaterialTab({ entries, materialOptions, materials, onEnsureReport, totalCost }: {
  entries: MaterialEntry[];
  materialOptions: { value: string; label: string }[];
  materials: Material[];
  onEnsureReport: () => Promise<string>;
  totalCost: number;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ materialId: '', description: '', quantity: '1', unit: 'Stk', unitPrice: '0', note: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMaterialSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mat = materials.find(m => m.id === e.target.value);
    if (mat) {
      setForm(f => ({ ...f, materialId: e.target.value, description: mat.name, unit: mat.unit, unitPrice: mat.unitPrice.toString() }));
    }
  };

  const handleAdd = async () => {
    if (!form.description) return;
    const rId = await onEnsureReport();
    const qty = Number(form.quantity);
    const price = Number(form.unitPrice);
    await addMaterialEntry({
      reportId: rId,
      reportType: 'daily',
      materialId: form.materialId || undefined,
      description: form.description,
      quantity: qty,
      unit: form.unit,
      unitPrice: price,
      total: qty * price,
      note: form.note || undefined,
    });
    setAdding(false);
    setForm({ materialId: '', description: '', quantity: '1', unit: 'Stk', unitPrice: '0', note: '' });
  };

  return (
    <div className="space-y-3">
      {totalCost > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">Total Material</span>
          <span className="font-bold text-green-800 dark:text-green-200">{formatCurrency(totalCost)}</span>
        </div>
      )}
      {entries.map((entry) => (
        <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-3">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{entry.description}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{entry.quantity} {entry.unit} × {formatCurrency(entry.unitPrice)}</div>
            {entry.note && <div className="text-xs text-gray-400 dark:text-gray-500 italic">{entry.note}</div>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm whitespace-nowrap">{formatCurrency(entry.total)}</span>
            <button onClick={() => deleteMaterialEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      {adding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Material hinzufügen</h4>
          {materialOptions.length > 0 && (
            <Select label="Aus Stammdaten" options={materialOptions} placeholder="Wählen oder manuell eingeben…" onChange={handleMaterialSelect} value={form.materialId} />
          )}
          <Input label="Bezeichnung *" value={form.description} onChange={set('description')} placeholder="z.B. Kies 0-32" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Menge" type="number" value={form.quantity} onChange={set('quantity')} />
            <Select label="Einheit" options={UNITS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={set('unit')} />
            <Input label="EP (CHF)" type="number" value={form.unitPrice} onChange={set('unitPrice')} />
          </div>
          <div className="text-sm bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
            Total: <strong>{formatCurrency(Number(form.quantity) * Number(form.unitPrice))}</strong>
          </div>
          <Input label="Notiz" value={form.note} onChange={set('note')} placeholder="Optional" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
      {!adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Material hinzufügen
        </Button>
      )}
      {entries.length === 0 && !adding && (
        <p className="text-center text-sm text-gray-400 py-4">Kein Materialverbrauch erfasst</p>
      )}
    </div>
  );
}

// ---- MachineTab ----

function MachineTab({ entries, machineOptions, employeeOptions, machines, onEnsureReport, totalCost }: {
  entries: MachineEntry[];
  machineOptions: { value: string; label: string }[];
  employeeOptions: { value: string; label: string }[];
  machines: Machine[];
  onEnsureReport: () => Promise<string>;
  totalCost: number;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ machineId: '', description: '', hours: '1', operatorId: '', hourlyRate: '0', note: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMachineSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const machine = machines.find(m => m.id === e.target.value);
    if (machine) {
      setForm(f => ({ ...f, machineId: e.target.value, description: machine.name, hourlyRate: machine.hourlyRate.toString() }));
    }
  };

  const handleAdd = async () => {
    if (!form.description) return;
    const rId = await onEnsureReport();
    const hrs = Number(form.hours);
    const rate = Number(form.hourlyRate);
    await addMachineEntry({
      reportId: rId,
      reportType: 'daily',
      machineId: form.machineId || undefined,
      description: form.description,
      hours: hrs,
      operatorId: form.operatorId || undefined,
      hourlyRate: rate,
      total: hrs * rate,
      note: form.note || undefined,
    });
    setAdding(false);
    setForm({ machineId: '', description: '', hours: '1', operatorId: '', hourlyRate: '0', note: '' });
  };

  return (
    <div className="space-y-3">
      {totalCost > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Total Maschinen</span>
          <span className="font-bold text-yellow-800 dark:text-yellow-200">{formatCurrency(totalCost)}</span>
        </div>
      )}
      {entries.map((entry) => {
        const opName = employeeOptions.find(e => e.value === entry.operatorId)?.label;
        return (
          <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-3">
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{entry.description}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{entry.hours}h × {formatCurrency(entry.hourlyRate)}/h</div>
              {opName && <div className="text-xs text-gray-400 dark:text-gray-500">Fahrer: {opName}</div>}
              {entry.note && <div className="text-xs text-gray-400 dark:text-gray-500 italic">{entry.note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm whitespace-nowrap">{formatCurrency(entry.total)}</span>
              <button onClick={() => deleteMachineEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
      {adding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Maschine / Fahrzeug hinzufügen</h4>
          {machineOptions.length > 0 && (
            <Select label="Aus Stammdaten" options={machineOptions} placeholder="Wählen oder manuell eingeben…" onChange={handleMachineSelect} value={form.machineId} />
          )}
          <Input label="Bezeichnung *" value={form.description} onChange={set('description')} placeholder="z.B. Bagger CAT 320" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Stunden" type="number" value={form.hours} onChange={set('hours')} />
            <Input label="Satz (CHF/h)" type="number" value={form.hourlyRate} onChange={set('hourlyRate')} />
          </div>
          <Select label="Fahrer (optional)" options={employeeOptions} placeholder="Wählen…" value={form.operatorId} onChange={set('operatorId')} />
          <Input label="Notiz" value={form.note} onChange={set('note')} placeholder="Optional" />
          <div className="text-sm bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
            Total: <strong>{formatCurrency(Number(form.hours) * Number(form.hourlyRate))}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
      {!adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Maschine hinzufügen
        </Button>
      )}
      {entries.length === 0 && !adding && (
        <p className="text-center text-sm text-gray-400 py-4">Keine Maschinen erfasst</p>
      )}
    </div>
  );
}

// ---- SubcontractorTab ----

function SubcontractorTab({ entries, onEnsureReport, totalCost }: {
  entries: SubcontractorEntry[];
  onEnsureReport: () => Promise<string>;
  totalCost: number;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ company: '', description: '', amount: '', note: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    if (!form.company || !form.amount) return;
    const rId = await onEnsureReport();
    await addSubcontractorEntry({
      reportId: rId,
      company: form.company,
      description: form.description,
      amount: Number(form.amount),
      note: form.note || undefined,
    });
    setAdding(false);
    setForm({ company: '', description: '', amount: '', note: '' });
  };

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl px-4 py-2.5 text-xs text-primary-700 dark:text-primary-300">
        Fremdleistungen sind Leistungen, die durch Drittfirmen erbracht wurden (Subunternehmer, Spezialisten, Transporte).
      </div>

      {totalCost > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">Total Fremdleistungen</span>
          <span className="font-bold text-purple-800 dark:text-purple-200">{formatCurrency(totalCost)}</span>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-3">
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{entry.company}</div>
              <div className="text-sm text-gray-600 mt-0.5">{entry.description}</div>
              {entry.note && <div className="text-xs text-gray-400 italic mt-0.5">{entry.note}</div>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-sm">{formatCurrency(entry.amount)}</span>
              <button
                onClick={() => deleteSubcontractorEntry(entry.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Fremdleistung erfassen</h4>
          <Input
            label="Firma / Subunternehmer *"
            value={form.company}
            onChange={set('company')}
            placeholder="z.B. Elektriker Muster AG"
          />
          <Input
            label="Leistungsbeschreibung"
            value={form.description}
            onChange={set('description')}
            placeholder="z.B. Elektroinstallation EG"
          />
          <Input
            label="Betrag (CHF) *"
            type="number"
            value={form.amount}
            onChange={set('amount')}
            placeholder="0.00"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notiz</label>
            <textarea
              value={form.note}
              onChange={set('note')}
              rows={2}
              placeholder="Rechnungsnummer, Bemerkungen…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1">
              <Check size={14} /> Speichern
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Fremdleistung hinzufügen
        </Button>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-center text-sm text-gray-400 py-4">Keine Fremdleistungen erfasst</p>
      )}
    </div>
  );
}

// ---- PhotosTab ----

function PhotosTab({ photos, onEnsureReport }: { photos: Photo[]; onEnsureReport: () => Promise<string> }) {
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
        reportType: 'daily',
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
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera size={16} /> Foto aufnehmen / hochladen
      </Button>

      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
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

function PhotoCard({ photo }: { photo: Photo }) {
  const [note, setNote] = useState(photo.note || '');

  const handleNoteBlur = async () => {
    const { db: database } = await import('../db');
    await database.photos.update(photo.id, { note });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
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
            className="absolute bottom-2 left-2 bg-primary-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
          >
            GPS
          </a>
        )}
      </div>
      <input
        type="text"
        placeholder="Notiz hinzufügen…"
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={handleNoteBlur}
        className="w-full px-3 py-2 text-xs border-0 border-t border-gray-100 dark:border-gray-700 focus:outline-none text-gray-600 dark:text-gray-300 bg-transparent"
      />
    </div>
  );
}

// ---- LeistungTab ----

const LEISTUNG_TYPES_LIST = [
  'Regiearbeit', 'Wandbeläge', 'Bodenbeläge', 'Fugenarbeiten',
  'Isolationsarbeiten', 'Verputzarbeiten', 'Malerarbeiten', 'Abbrucharbeiten', 'Sonstiges',
];

function LeistungTab({ reportId, entries, onEnsureReport }: {
  reportId?: string;
  entries: LeistungEntry[];
  onEnsureReport: () => Promise<string>;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ leistungsart: LEISTUNG_TYPES_LIST[0], stunden: '1', kommentar: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await onEnsureReport();
    await addLeistungEntry({
      reportId: reportId!,
      leistungsart: form.leistungsart,
      stunden: Number(form.stunden),
      kommentar: form.kommentar || undefined,
    });
    setAdding(false);
    setForm({ leistungsart: LEISTUNG_TYPES_LIST[0], stunden: '1', kommentar: '' });
  };

  const totalHours = entries.reduce((s, e) => s + e.stunden, 0);

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Leistungen</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalHours}h total</span>
          </div>
          {entries.map(entry => (
            <div key={entry.id} className="px-4 py-3 flex justify-between items-start border-b border-gray-50 dark:border-gray-700 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.leistungsart}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{entry.stunden}h{entry.kommentar ? ` – ${entry.kommentar}` : ''}</div>
              </div>
              <button onClick={() => deleteLeistungEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="font-semibold text-sm">Leistung erfassen</h4>
          <Select
            label="Leistungsart *"
            options={LEISTUNG_TYPES_LIST.map(t => ({ value: t, label: t }))}
            value={form.leistungsart}
            onChange={set('leistungsart')}
          />
          <Input label="Stunden" type="number" value={form.stunden} onChange={set('stunden')} min="0.5" step="0.5" />
          <Textarea label="Kommentar" value={form.kommentar} onChange={set('kommentar')} rows={2} placeholder="Optionale Beschreibung…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Hinzufügen</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Leistung hinzufügen
        </Button>
      )}

      {entries.length === 0 && !adding && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          Noch keine Leistungen erfasst.
        </div>
      )}
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
