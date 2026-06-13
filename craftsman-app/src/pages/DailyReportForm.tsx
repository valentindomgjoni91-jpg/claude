import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check, Clock, Package, Truck, FileText, Image, Users,
  Plus, Trash2, Camera, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { Tabs } from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import {
  useDailyReport, useTimeEntries, useMaterialEntries, useMachineEntries,
  useSubcontractorEntries, usePhotos,
  createDailyReport, updateDailyReport,
  addTimeEntry, updateTimeEntry, deleteTimeEntry,
  addMaterialEntry, deleteMaterialEntry,
  addMachineEntry, deleteMachineEntry,
  addSubcontractorEntry, deleteSubcontractorEntry,
  addPhoto, deletePhoto,
} from '../hooks/useDailyReports';
import { useProjects } from '../hooks/useProjects';
import { useEmployees, useMachines, useMaterials, useCompany } from '../hooks/useMasterData';
import { todayISO, nowISO, calcTotalHours, formatHours, formatCurrency, WEATHER_LABELS, UNITS, cn } from '../utils';
import { generateDailyReportPdf } from '../pdf/dailyReportPdf';
import { db } from '../db';
import type { Weather } from '../types';

export default function DailyReportForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

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
      setForm({
        projectId: report.projectId,
        date: report.date,
        title: report.title,
        weather: report.weather || '',
        temperature: report.temperature?.toString() || '',
        notes: report.notes || '',
        status: report.status,
      });
    }
  }, [report]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const ensureReport = async (): Promise<string> => {
    if (reportId) return reportId;
    const data = {
      projectId: form.projectId,
      date: form.date,
      title: form.title,
      weather: (form.weather || undefined) as Weather | undefined,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      notes: form.notes || undefined,
      status: form.status,
    };
    const newId = await createDailyReport(data);
    setReportId(newId);
    navigate(`/tagesrapport/${newId}`, { replace: true });
    return newId;
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
        setReportId(newId);
        navigate(`/tagesrapport/${newId}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!reportId || !report) return;
    const [proj, employees_, machines_, company_] = await Promise.all([
      db.projects.get(form.projectId),
      db.employees.toArray(),
      db.machines.toArray(),
      db.company.toCollection().first(),
    ]);
    if (!proj) return;
    const pdf = generateDailyReportPdf({
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
    });
    pdf.save(`Tagesrapport_${form.date}.pdf`);
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
    { id: 'photos', label: `Fotos (${photos?.length ?? 0})`, icon: <Image size={14} /> },
  ];

  const totalHours = timeEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
  const totalMaterialCost = materialEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
  const totalMachineCost = machineEntries?.reduce((s, e) => s + e.total, 0) ?? 0;
  const totalSubCost = subcontractorEntries?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isEdit ? 'Tagesrapport' : 'Neuer Tagesrapport'}
        subtitle={form.title}
        backTo={form.projectId ? `/projects/${form.projectId}` : '/'}
        action={
          <div className="flex gap-2">
            {reportId && (
              <Button variant="ghost" size="sm" onClick={handlePdf}>
                <Download size={16} />
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={() => handleSave()}>
              <Check size={16} /> Speichern
            </Button>
          </div>
        }
      />

      <div className="px-4 py-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
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
        {activeTab === 'photos' && (
          <PhotosTab
            photos={photos || []}
            onEnsureReport={ensureReport}
          />
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
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <Select label="Projekt *" value={form.projectId} onChange={set('projectId')} options={projectOptions} placeholder="Projekt wählen…" />
        <Input label="Datum" type="date" value={form.date} onChange={set('date')} />
        <Input label="Titel" value={form.title} onChange={set('title')} />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Wetter</h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(WEATHER_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => set('weather')({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
              className={cn(
                'py-2 px-2 rounded-xl text-xs font-medium border-2 transition-colors text-center',
                form.weather === value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Input label="Temperatur (°C)" type="number" value={form.temperature} onChange={set('temperature')} placeholder="z.B. 18" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <Textarea label="Notizen / Bemerkungen" value={form.notes} onChange={set('notes')} rows={4} />
      </div>
    </div>
  );
}

// ---- TimeTab ----

interface TimeTabProps {
  entries: unknown[];
  employeeOptions: { value: string; label: string }[];
  onEnsureReport: () => Promise<string>;
  totalHours: number;
}

function TimeTab({ entries, employeeOptions, onEnsureReport, totalHours }: TimeTabProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    startTime: '07:00',
    endTime: '17:00',
    breakMinutes: '30',
    activity: '',
    note: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    if (!form.employeeId) return;
    const rId = await onEnsureReport();
    const totalHrs = calcTotalHours(form.startTime, form.endTime, Number(form.breakMinutes));
    await addTimeEntry({
      reportId: rId,
      reportType: 'daily',
      employeeId: form.employeeId,
      date: todayISO(),
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes),
      totalHours: totalHrs,
      activity: form.activity || undefined,
      note: form.note || undefined,
    });
    setAdding(false);
    setForm({ employeeId: '', startTime: '07:00', endTime: '17:00', breakMinutes: '30', activity: '', note: '' });
  };

  return (
    <div className="space-y-3">
      {totalHours > 0 && (
        <div className="bg-primary-50 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-primary-700 font-medium">Total Arbeitsstunden</span>
          <span className="font-bold text-primary-800">{formatHours(totalHours)}</span>
        </div>
      )}

      {(entries as any[]).map((entry: any) => (
        <TimeEntryCard key={entry.id} entry={entry} employeeOptions={employeeOptions} />
      ))}

      {adding && (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900">Neuer Zeiteintrag</h4>
          <Select label="Mitarbeiter" value={form.employeeId} onChange={set('employeeId')} options={employeeOptions} placeholder="Mitarbeiter wählen" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Von" type="time" value={form.startTime} onChange={set('startTime')} />
            <Input label="Bis" type="time" value={form.endTime} onChange={set('endTime')} />
            <Input label="Pause (min)" type="number" value={form.breakMinutes} onChange={set('breakMinutes')} />
          </div>
          {form.startTime && form.endTime && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              Total: <strong>{formatHours(calcTotalHours(form.startTime, form.endTime, Number(form.breakMinutes)))}</strong>
            </div>
          )}
          <Input label="Tätigkeit" value={form.activity} onChange={set('activity')} placeholder="z.B. Mauerwerk, Schalung…" />
          <Input label="Notiz" value={form.note} onChange={set('note')} placeholder="Interne Bemerkung" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button>
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

function TimeEntryCard({ entry, employeeOptions }: { entry: any; employeeOptions: { value: string; label: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    startTime: entry.startTime || '',
    endTime: entry.endTime || '',
    breakMinutes: entry.breakMinutes?.toString() || '0',
    activity: entry.activity || '',
    note: entry.note || '',
  });

  const employeeName = employeeOptions.find(e => e.value === entry.employeeId)?.label || entry.employeeId;

  const handleSave = async () => {
    const totalHours = calcTotalHours(form.startTime, form.endTime, Number(form.breakMinutes));
    await updateTimeEntry(entry.id, { ...form, breakMinutes: Number(form.breakMinutes), totalHours });
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-gray-900">{employeeName}</div>
          <div className="text-xs text-gray-500">
            {entry.startTime} – {entry.endTime} · Pause: {entry.breakMinutes} min
          </div>
          {entry.activity && <div className="text-xs text-gray-400">{entry.activity}</div>}
          {entry.note && <div className="text-xs text-gray-400 italic">{entry.note}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-primary-700">{formatHours(entry.totalHours)}</span>
          <button onClick={() => setEditing(!editing)} className="p-1.5 rounded-lg hover:bg-gray-100">
            {editing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => deleteTimeEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {editing && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
          <div className="grid grid-cols-3 gap-2">
            <Input label="Von" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            <Input label="Bis" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            <Input label="Pause (min)" type="number" value={form.breakMinutes} onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))} />
          </div>
          <div className="text-sm bg-white rounded-lg px-3 py-2 border border-gray-200">
            Total: <strong>{formatHours(calcTotalHours(form.startTime, form.endTime, Number(form.breakMinutes)))}</strong>
          </div>
          <Input label="Tätigkeit" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} />
          <Input label="Notiz" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <Button size="sm" onClick={handleSave}><Check size={14} /> Speichern</Button>
        </div>
      )}
    </div>
  );
}

// ---- MaterialTab ----

function MaterialTab({ entries, materialOptions, materials, onEnsureReport, totalCost }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ materialId: '', description: '', quantity: '1', unit: 'Stk', unitPrice: '0', note: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMaterialSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mat = materials.find((m: any) => m.id === e.target.value);
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
        <div className="bg-green-50 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-green-700 font-medium">Total Material</span>
          <span className="font-bold text-green-800">{formatCurrency(totalCost)}</span>
        </div>
      )}
      {entries.map((entry: any) => (
        <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-3">
            <div className="font-medium text-sm text-gray-900">{entry.description}</div>
            <div className="text-xs text-gray-500">{entry.quantity} {entry.unit} × {formatCurrency(entry.unitPrice)}</div>
            {entry.note && <div className="text-xs text-gray-400 italic">{entry.note}</div>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm whitespace-nowrap">{formatCurrency(entry.total)}</span>
            <button onClick={() => deleteMaterialEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      {adding && (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
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
          <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
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

function MachineTab({ entries, machineOptions, employeeOptions, machines, onEnsureReport, totalCost }: any) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ machineId: '', description: '', hours: '1', operatorId: '', hourlyRate: '0', note: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMachineSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const machine = machines.find((m: any) => m.id === e.target.value);
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
        <div className="bg-yellow-50 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-yellow-700 font-medium">Total Maschinen</span>
          <span className="font-bold text-yellow-800">{formatCurrency(totalCost)}</span>
        </div>
      )}
      {entries.map((entry: any) => {
        const opName = employeeOptions.find((e: any) => e.value === entry.operatorId)?.label;
        return (
          <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-3">
              <div className="font-medium text-sm text-gray-900">{entry.description}</div>
              <div className="text-xs text-gray-500">{entry.hours}h × {formatCurrency(entry.hourlyRate)}/h</div>
              {opName && <div className="text-xs text-gray-400">Fahrer: {opName}</div>}
              {entry.note && <div className="text-xs text-gray-400 italic">{entry.note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm whitespace-nowrap">{formatCurrency(entry.total)}</span>
              <button onClick={() => deleteMachineEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
      {adding && (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
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
          <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
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

function SubcontractorTab({ entries, onEnsureReport, totalCost }: any) {
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
      <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        Fremdleistungen sind Leistungen, die durch Drittfirmen erbracht wurden (Subunternehmer, Spezialisten, Transporte).
      </div>

      {totalCost > 0 && (
        <div className="bg-purple-50 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-purple-700 font-medium">Total Fremdleistungen</span>
          <span className="font-bold text-purple-800">{formatCurrency(totalCost)}</span>
        </div>
      )}

      {entries.map((entry: any) => (
        <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-3">
              <div className="font-semibold text-sm text-gray-900">{entry.company}</div>
              <div className="text-sm text-gray-600 mt-0.5">{entry.description}</div>
              {entry.note && <div className="text-xs text-gray-400 italic mt-0.5">{entry.note}</div>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-sm">{formatCurrency(entry.amount)}</span>
              <button
                onClick={() => deleteSubcontractorEntry(entry.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {adding && (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
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
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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

function PhotosTab({ photos, onEnsureReport }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const rId = await onEnsureReport();
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      await addPhoto({
        reportId: rId,
        reportType: 'daily',
        timestamp: nowISO(),
        dataUrl,
        note: '',
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
        {photos.map((photo: any) => (
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

function PhotoCard({ photo }: { photo: any }) {
  const [note, setNote] = useState(photo.note || '');

  const handleNoteBlur = async () => {
    const { db: database } = await import('../db');
    await database.photos.update(photo.id, { note });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="relative">
        <img src={photo.dataUrl} alt="Foto" className="w-full aspect-video object-cover" />
        <button
          onClick={() => deletePhoto(photo.id)}
          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Notiz hinzufügen…"
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={handleNoteBlur}
        className="w-full px-3 py-2 text-xs border-0 border-t border-gray-100 focus:outline-none text-gray-600"
      />
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
