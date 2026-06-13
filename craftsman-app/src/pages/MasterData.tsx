import { useState, useEffect } from 'react';
import { Users, Truck, Package, Building2, Plus, Check, X, Upload, Cloud, Copy, RefreshCw, Pencil } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Tabs } from '../components/ui/Tabs';
import {
  useEmployees, useMachines, useMaterials, useCompany,
  saveEmployee, updateEmployee, saveMachine, updateMachine,
  saveMaterial, updateMaterial, saveCompany,
} from '../hooks/useMasterData';
import { UNITS, formatDate } from '../utils';
import type { EmployeeRole } from '../types';
import { loadConfig, saveConfig, clearConfig, getLastSync, syncNow, SUPABASE_SQL } from '../sync/supabaseSync';

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'office', label: 'Büro' },
  { value: 'foreman', label: 'Polier' },
  { value: 'worker', label: 'Mitarbeiter' },
];

export default function MasterData() {
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { id: 'company', label: 'Firma', icon: <Building2 size={14} /> },
    { id: 'employees', label: 'Mitarbeiter', icon: <Users size={14} /> },
    { id: 'machines', label: 'Maschinen', icon: <Truck size={14} /> },
    { id: 'materials', label: 'Material', icon: <Package size={14} /> },
    { id: 'sync', label: 'Sync', icon: <Cloud size={14} /> },
  ];

  return (
    <div>
      <PageHeader title="Stammdaten" />
      <div className="px-4 py-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>
      <div className="px-4 pb-8">
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'employees' && <EmployeesTab />}
        {activeTab === 'machines' && <MachinesTab />}
        {activeTab === 'materials' && <MaterialsTab />}
        {activeTab === 'sync' && <SyncTab />}
      </div>
    </div>
  );
}

function CompanyTab() {
  const company = useCompany();
  const [form, setForm] = useState({
    name: '', street: '', city: '', zip: '', phone: '',
    email: '', website: '', vatNumber: '', footerText: '',
    logoUrl: '', bankAccount: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  if (company && !loaded) {
    setForm({
      name: company.name || '',
      street: company.street || '',
      city: company.city || '',
      zip: company.zip || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      vatNumber: company.vatNumber || '',
      footerText: company.footerText || '',
      logoUrl: company.logoUrl || '',
      bankAccount: company.bankAccount || '',
    });
    setLoaded(true);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, logoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCompany(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Firmendaten</h3>
        <Input label="Firmenname" value={form.name} onChange={set('name')} />
        <Input label="Strasse" value={form.street} onChange={set('street')} />
        <div className="grid grid-cols-3 gap-2">
          <Input label="PLZ" value={form.zip} onChange={set('zip')} />
          <div className="col-span-2"><Input label="Ort" value={form.city} onChange={set('city')} /></div>
        </div>
        <Input label="Telefon" type="tel" value={form.phone} onChange={set('phone')} />
        <Input label="E-Mail" type="email" value={form.email} onChange={set('email')} />
        <Input label="Website" value={form.website} onChange={set('website')} />
        <Input label="MWST-Nummer" value={form.vatNumber} onChange={set('vatNumber')} placeholder="CHE-XXX.XXX.XXX" />
        <Input label="Fusszeilen-Text (PDF)" value={form.footerText} onChange={set('footerText')} />
        <Input label="IBAN / Bankverbindung" value={form.bankAccount} onChange={set('bankAccount')} placeholder="CH00 0000 0000 0000 0000 0" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Firmenlogo (PDF)</h3>
        {form.logoUrl ? (
          <div className="flex items-center gap-3">
            <img src={form.logoUrl} alt="Logo" className="h-14 object-contain border border-gray-200 rounded-lg p-1 bg-white" />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, logoUrl: '' }))}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Entfernen
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-600 border border-dashed border-gray-300 rounded-xl p-3 hover:bg-gray-50">
            <Upload size={16} />
            <span>Logo hochladen (PNG / JPG)</span>
            <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
          </label>
        )}
      </div>
      <Button className="w-full" loading={saving} onClick={handleSave}>
        <Check size={16} /> Firmendaten speichern
      </Button>
    </div>
  );
}

function EmployeesTab() {
  const employees = useEmployees(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', role: 'worker' as EmployeeRole, hourlyRate: '65' });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: 'worker' as EmployeeRole, hourlyRate: '65' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setEdit = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveEmployee({ ...form, hourlyRate: Number(form.hourlyRate), active: true });
    setAdding(false);
    setForm({ firstName: '', lastName: '', role: 'worker', hourlyRate: '65' });
  };

  const startEdit = (emp: NonNullable<ReturnType<typeof useEmployees>>[0]) => {
    setEditingId(emp.id);
    setEditForm({ firstName: emp.firstName, lastName: emp.lastName, role: emp.role, hourlyRate: String(emp.hourlyRate) });
  };

  const handleSaveEdit = async (id: string) => {
    await updateEmployee(id, { ...editForm, hourlyRate: Number(editForm.hourlyRate) });
    setEditingId(null);
  };

  return (
    <div className="space-y-3 mt-2">
      {employees?.map(emp => (
        editingId === emp.id ? (
          <div key={emp.id} className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input label="Vorname" value={editForm.firstName} onChange={setEdit('firstName')} />
              <Input label="Nachname" value={editForm.lastName} onChange={setEdit('lastName')} />
            </div>
            <Select label="Rolle" options={ROLE_OPTIONS} value={editForm.role} onChange={setEdit('role')} />
            <Input label="Stundensatz (CHF)" type="number" value={editForm.hourlyRate} onChange={setEdit('hourlyRate')} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(emp.id)} className="flex-1"><Check size={14} /> Speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X size={14} /></Button>
            </div>
          </div>
        ) : (
          <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</div>
              <div className="text-xs text-gray-500">{ROLE_OPTIONS.find(r => r.value === emp.role)?.label} · CHF {emp.hourlyRate}/h</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(emp)} className="p-1 text-gray-400 hover:text-gray-700">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => updateEmployee(emp.id, { active: !emp.active })}
                className={`text-xs px-2 py-1 rounded-full ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {emp.active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </div>
          </div>
        )
      ))}
      {adding ? (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Vorname" value={form.firstName} onChange={set('firstName')} />
            <Input label="Nachname" value={form.lastName} onChange={set('lastName')} />
          </div>
          <Select label="Rolle" options={ROLE_OPTIONS} value={form.role} onChange={set('role')} />
          <Input label="Stundensatz (CHF)" type="number" value={form.hourlyRate} onChange={set('hourlyRate')} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X size={14} /></Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Mitarbeiter hinzufügen
        </Button>
      )}
    </div>
  );
}

function MachinesTab() {
  const machines = useMachines(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: '', licensePlate: '', hourlyRate: '80' });
  const [editForm, setEditForm] = useState({ name: '', type: '', licensePlate: '', hourlyRate: '80' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setEdit = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveMachine({ ...form, hourlyRate: Number(form.hourlyRate), active: true });
    setAdding(false);
    setForm({ name: '', type: '', licensePlate: '', hourlyRate: '80' });
  };

  const startEdit = (m: NonNullable<ReturnType<typeof useMachines>>[0]) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, type: m.type || '', licensePlate: m.licensePlate || '', hourlyRate: String(m.hourlyRate) });
  };

  const handleSaveEdit = async (id: string) => {
    await updateMachine(id, { ...editForm, hourlyRate: Number(editForm.hourlyRate) });
    setEditingId(null);
  };

  return (
    <div className="space-y-3 mt-2">
      {machines?.map(m => (
        editingId === m.id ? (
          <div key={m.id} className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
            <Input label="Bezeichnung" value={editForm.name} onChange={setEdit('name')} />
            <Input label="Typ" value={editForm.type} onChange={setEdit('type')} placeholder="z.B. Bagger, Fahrzeug" />
            <Input label="Kennzeichen" value={editForm.licensePlate} onChange={setEdit('licensePlate')} />
            <Input label="Stundensatz (CHF)" type="number" value={editForm.hourlyRate} onChange={setEdit('hourlyRate')} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(m.id)} className="flex-1"><Check size={14} /> Speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X size={14} /></Button>
            </div>
          </div>
        ) : (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-gray-900">{m.name}</div>
              <div className="text-xs text-gray-500">{m.type}{m.licensePlate ? ` · ${m.licensePlate}` : ''} · CHF {m.hourlyRate}/h</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-gray-700">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => updateMachine(m.id, { active: !m.active })}
                className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {m.active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </div>
          </div>
        )
      ))}
      {adding ? (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
          <Input label="Bezeichnung" value={form.name} onChange={set('name')} placeholder="z.B. Bagger CAT 320" />
          <Input label="Typ" value={form.type} onChange={set('type')} placeholder="z.B. Bagger, Fahrzeug" />
          <Input label="Kennzeichen" value={form.licensePlate} onChange={set('licensePlate')} />
          <Input label="Stundensatz (CHF)" type="number" value={form.hourlyRate} onChange={set('hourlyRate')} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X size={14} /></Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Maschine / Fahrzeug hinzufügen
        </Button>
      )}
    </div>
  );
}

function MaterialsTab() {
  const materials = useMaterials(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'm³', unitPrice: '0', category: '' });
  const [editForm, setEditForm] = useState({ name: '', unit: 'm³', unitPrice: '0', category: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setEdit = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveMaterial({ ...form, unitPrice: Number(form.unitPrice), active: true });
    setAdding(false);
    setForm({ name: '', unit: 'm³', unitPrice: '0', category: '' });
  };

  const startEdit = (m: NonNullable<ReturnType<typeof useMaterials>>[0]) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, unit: m.unit, unitPrice: String(m.unitPrice), category: m.category || '' });
  };

  const handleSaveEdit = async (id: string) => {
    await updateMaterial(id, { ...editForm, unitPrice: Number(editForm.unitPrice) });
    setEditingId(null);
  };

  return (
    <div className="space-y-3 mt-2">
      {materials?.map(m => (
        editingId === m.id ? (
          <div key={m.id} className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
            <Input label="Bezeichnung" value={editForm.name} onChange={setEdit('name')} />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Einheit" options={UNITS.map(u => ({ value: u, label: u }))} value={editForm.unit} onChange={setEdit('unit')} />
              <Input label="Einheitspreis (CHF)" type="number" value={editForm.unitPrice} onChange={setEdit('unitPrice')} />
            </div>
            <Input label="Kategorie" value={editForm.category} onChange={setEdit('category')} placeholder="z.B. Beton, Stahl…" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(m.id)} className="flex-1"><Check size={14} /> Speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X size={14} /></Button>
            </div>
          </div>
        ) : (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-gray-900">{m.name}</div>
              <div className="text-xs text-gray-500">{m.unit} · CHF {m.unitPrice}{m.category ? ` · ${m.category}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-gray-700">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => updateMaterial(m.id, { active: !m.active })}
                className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {m.active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </div>
          </div>
        )
      ))}
      {adding ? (
        <div className="bg-white rounded-2xl border-2 border-primary-200 p-4 space-y-3">
          <Input label="Bezeichnung" value={form.name} onChange={set('name')} placeholder="z.B. Beton C25/30" />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Einheit" options={UNITS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={set('unit')} />
            <Input label="Einheitspreis (CHF)" type="number" value={form.unitPrice} onChange={set('unitPrice')} />
          </div>
          <Input label="Kategorie" value={form.category} onChange={set('category')} placeholder="z.B. Beton, Stahl…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1"><Check size={14} /> Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X size={14} /></Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={16} /> Material hinzufügen
        </Button>
      )}
    </div>
  );
}

function SyncTab() {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [result, setResult] = useState<{ pushed: number; pulled: number; errors: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cfg = loadConfig();
    if (cfg) {
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setConfigured(true);
    }
    setLastSync(getLastSync());
  }, []);

  const handleSaveCfg = () => {
    if (!url.trim() || !anonKey.trim()) return;
    saveConfig({ url: url.trim(), anonKey: anonKey.trim() });
    setConfigured(true);
  };

  const handleDisconnect = () => {
    clearConfig();
    setUrl('');
    setAnonKey('');
    setConfigured(false);
    setResult(null);
  };

  const handleSync = async () => {
    const cfg = loadConfig();
    if (!cfg) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncNow(cfg);
      setResult(res);
      setLastSync(getLastSync());
    } catch (e) {
      setResult({ pushed: 0, pulled: 0, errors: [e instanceof Error ? e.message : 'Unbekannter Fehler'] });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySQL = async () => {
    await navigator.clipboard.writeText(SUPABASE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Supabase Cloud-Sync</h3>
        <p className="text-xs text-gray-500">
          Daten automatisch in der Cloud sichern und auf mehreren Geräten synchronisieren.
        </p>
        <Input
          label="Supabase URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://xxxx.supabase.co"
        />
        <Input
          label="Anon Key"
          value={anonKey}
          onChange={e => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSaveCfg} disabled={!url.trim() || !anonKey.trim()}>
            <Cloud size={16} /> {configured ? 'Aktualisieren' : 'Verbinden'}
          </Button>
          {configured && (
            <Button variant="ghost" onClick={handleDisconnect}>
              <X size={16} />
            </Button>
          )}
        </div>
        {configured && (
          <div className="pt-1">
            <Button className="w-full" variant="outline" loading={syncing} onClick={handleSync}>
              <RefreshCw size={16} /> Sync starten
            </Button>
            {lastSync && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Letzter Sync: {formatDate(new Date(lastSync))}
              </p>
            )}
            {result && (
              <div className={`mt-2 p-3 rounded-xl text-xs ${result.errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {result.errors.length > 0 ? (
                  <div>
                    <div className="font-medium">Fehler beim Sync:</div>
                    {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                ) : (
                  <div>Hochgeladen: {result.pushed} · Heruntergeladen: {result.pulled}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-700">SQL Migration</h3>
          <button
            onClick={handleCopySQL}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
          >
            <Copy size={13} />
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Diesen SQL-Code einmalig im Supabase SQL-Editor ausführen (Dashboard → SQL Editor → New Query).
        </p>
        <pre className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap font-mono">
          {SUPABASE_SQL}
        </pre>
      </div>
    </div>
  );
}
