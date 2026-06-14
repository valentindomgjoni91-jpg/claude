import { useState, useEffect } from 'react';
import { Users, Truck, Package, Building2, Plus, Check, X, Upload, Cloud, Copy, RefreshCw, Pencil, Download, FolderOpen, Bell, BellOff, LogIn, LogOut } from 'lucide-react';
import { useLanguage, LANGUAGE_NAMES, type Lang } from '../i18n';
import { exportProjectsCSV, exportRegiReportsCSV, exportTimeEntriesCSV } from '../utils/csvExport';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Tabs } from '../components/ui/Tabs';
import {
  useEmployees, useMachines, useMaterials, useCompany,
  saveEmployee, updateEmployee, deleteEmployee,
  saveMachine, updateMachine, deleteMachine,
  saveMaterial, updateMaterial, deleteMaterial, saveCompany,
} from '../hooks/useMasterData';
import { SwipeToDelete } from '../components/ui/SwipeToDelete';
import { UNITS, formatDate } from '../utils';
import type { EmployeeRole } from '../types';
import { loadConfig, saveConfig, clearConfig, getLastPull, syncNow, testConnection, SUPABASE_SQL } from '../sync/supabaseSync';
import { getSupabaseClient } from '../sync/supabaseClient';
import { exportBackup, importBackup } from '../utils/backup';
import { requestNotificationPermission, disableNotifications, getNotificationsEnabled } from '../utils/notifications';
import { useAuth } from '../hooks/useAuth';

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'office', label: 'Büro' },
  { value: 'foreman', label: 'Polier' },
  { value: 'worker', label: 'Mitarbeiter' },
];

export default function MasterData() {
  const [activeTab, setActiveTab] = useState('company');
  const { t } = useLanguage();

  const tabs = [
    { id: 'company', label: t('tab.company'), icon: <Building2 size={14} /> },
    { id: 'employees', label: t('tab.employees'), icon: <Users size={14} /> },
    { id: 'machines', label: t('tab.machines'), icon: <Truck size={14} /> },
    { id: 'materials', label: t('tab.materials'), icon: <Package size={14} /> },
    { id: 'sync', label: t('tab.sync'), icon: <Cloud size={14} /> },
  ];

  return (
    <div>
      <div className="px-4 pt-3">
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
  const { lang, setLang } = useLanguage();
  const [form, setForm] = useState({
    name: '', street: '', city: '', zip: '', phone: '',
    email: '', website: '', vatNumber: '', footerText: '',
    logoUrl: '', bankAccount: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    }
  }, [company]);

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
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Firmendaten</h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Firmenlogo (PDF)</h3>
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
          <label className="flex items-center gap-2 cursor-pointer text-sm text-primary-600 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Upload size={16} />
            <span>Logo hochladen (PNG / JPG)</span>
            <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
          </label>
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Sprache / Langue / Lingua</h3>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(LANGUAGE_NAMES) as [Lang, string][]).map(([code, name]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`py-2 px-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                lang === code
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
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
          <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
          <SwipeToDelete key={emp.id} onDelete={() => deleteEmployee(emp.id)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{emp.firstName} {emp.lastName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{ROLE_OPTIONS.find(r => r.value === emp.role)?.label} · CHF {emp.hourlyRate}/h</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(emp)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => updateEmployee(emp.id, { active: !emp.active })}
                  className={`text-xs px-2 py-1 rounded-full ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >
                  {emp.active ? 'Aktiv' : 'Inaktiv'}
                </button>
              </div>
            </div>
          </SwipeToDelete>
        )
      ))}
      {adding ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
          <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
          <SwipeToDelete key={m.id} onDelete={() => deleteMachine(m.id)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{m.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{m.type}{m.licensePlate ? ` · ${m.licensePlate}` : ''} · CHF {m.hourlyRate}/h</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => updateMachine(m.id, { active: !m.active })}
                  className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >
                  {m.active ? 'Aktiv' : 'Inaktiv'}
                </button>
              </div>
            </div>
          </SwipeToDelete>
        )
      ))}
      {adding ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
          <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
          <SwipeToDelete key={m.id} onDelete={() => deleteMaterial(m.id)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{m.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{m.unit} · CHF {m.unitPrice}{m.category ? ` · ${m.category}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => updateMaterial(m.id, { active: !m.active })}
                  className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >
                  {m.active ? 'Aktiv' : 'Inaktiv'}
                </button>
              </div>
            </div>
          </SwipeToDelete>
        )
      ))}
      {adding ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200 dark:border-primary-700 p-4 space-y-3">
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
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const _initCfg = loadConfig();
  const [url, setUrl] = useState(_initCfg?.url ?? '');
  const [anonKey, setAnonKey] = useState(_initCfg?.anonKey ?? '');
  const [configured, setConfigured] = useState(!!_initCfg);
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<{ ok: boolean; migrated?: boolean; message?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastPull, setLastPull] = useState<string | null>(getLastPull());
  const [result, setResult] = useState<{ pushed: number; pulled: number; errors: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading2, setAuthLoading2] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(getNotificationsEnabled());
  const notifSupported = 'Notification' in window;


  const handleTest = async () => {
    if (!url.trim() || !anonKey.trim()) return;
    setTesting(true);
    setConnStatus(null);
    const res = await testConnection({ url: url.trim(), anonKey: anonKey.trim() });
    setConnStatus(res.ok ? { ok: true, migrated: res.migrated } : { ok: false, message: res.message });
    setTesting(false);
  };

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
    setConnStatus(null);
    setResult(null);
  };

  const handleSync = async () => {
    const cfg = loadConfig();
    if (!cfg) return;
    setSyncing(true);
    setResult(null);
    setProgress('');
    try {
      const res = await syncNow(cfg, setProgress, getSupabaseClient() ?? undefined);
      setResult(res);
      setLastPull(getLastPull());
    } catch (e) {
      setResult({ pushed: 0, pulled: 0, errors: [e instanceof Error ? e.message : 'Unbekannter Fehler'] });
    } finally {
      setSyncing(false);
      setProgress('');
    }
  };

  const handleCopySQL = async () => {
    await navigator.clipboard.writeText(SUPABASE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthSubmit = async () => {
    setAuthError(''); setAuthSuccess('');
    if (!authEmail || !authPassword) { setAuthError('E-Mail und Passwort eingeben'); return; }
    setAuthLoading2(true);
    try {
      if (authMode === 'login') {
        await signIn(authEmail, authPassword);
      } else {
        await signUp(authEmail, authPassword);
        setAuthSuccess('Registrierung erfolgreich – bitte E-Mail bestätigen.');
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setAuthLoading2(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportBackup(); } finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const res = await importBackup(file);
    setImportResult(res);
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleToggleNotif = async () => {
    if (notifEnabled) {
      disableNotifications();
      setNotifEnabled(false);
    } else {
      const granted = await requestNotificationPermission();
      setNotifEnabled(granted);
    }
  };

  const canSave = url.trim() && anonKey.trim();

  return (
    <div className="space-y-4 mt-2">

      {/* ── Auth ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Konto</h3>
        {authLoading ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Laden…</p>
        ) : user ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Angemeldet</div>
            </div>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut size={14} /> Abmelden
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mit einem Supabase-Konto anmelden für sicherere Synchronisierung.
            </p>
            <Input label="E-Mail" type="email" value={authEmail}
              onChange={e => setAuthEmail(e.target.value)} placeholder="name@firma.ch" />
            <Input label="Passwort" type="password" value={authPassword}
              onChange={e => setAuthPassword(e.target.value)} placeholder="Mindestens 6 Zeichen" />
            {authError && <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">{authError}</div>}
            {authSuccess && <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">{authSuccess}</div>}
            <div className="flex gap-2">
              <Button onClick={handleAuthSubmit} loading={authLoading2} className="flex-1">
                <LogIn size={14} /> {authMode === 'login' ? 'Anmelden' : 'Registrieren'}
              </Button>
            </div>
            <button
              onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthError(''); setAuthSuccess(''); }}
              className="w-full text-center text-xs text-primary-600 hover:text-primary-700"
            >
              {authMode === 'login' ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Anmelden'}
            </button>
          </div>
        )}
      </div>

      {/* ── Cloud-Sync ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Supabase Cloud-Sync</h3>
          {configured && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Verbunden
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Daten in der Cloud sichern und auf mehreren Geräten synchronisieren.
        </p>
        <Input
          label="Supabase URL"
          value={url}
          onChange={e => { setUrl(e.target.value); setConnStatus(null); }}
          placeholder="https://xxxx.supabase.co"
        />
        <Input
          label="Anon Key"
          value={anonKey}
          onChange={e => { setAnonKey(e.target.value); setConnStatus(null); }}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5…"
        />

        {connStatus && (
          <div className={`p-3 rounded-xl text-xs ${connStatus.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
            {connStatus.ok
              ? connStatus.migrated
                ? '✓ Verbindung erfolgreich – Tabelle vorhanden'
                : '✓ Verbindung erfolgreich – SQL Migration noch nicht ausgeführt (siehe unten)'
              : `✗ ${connStatus.message}`}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} loading={testing} disabled={!canSave} className="flex-1">
            Verbindung testen
          </Button>
          <Button onClick={handleSaveCfg} disabled={!canSave} className="flex-1">
            <Cloud size={16} /> {configured ? 'Aktualisieren' : 'Speichern'}
          </Button>
          {configured && (
            <Button variant="ghost" onClick={handleDisconnect} title="Verbindung trennen">
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* ── Sync controls ───────────────────────────────────────────────── */}
      {configured && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Synchronisierung</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sync läuft automatisch alle 5 Minuten wenn online.
          </p>
          <Button className="w-full" variant="outline" loading={syncing} onClick={handleSync}>
            <RefreshCw size={16} /> Jetzt synchronisieren
          </Button>
          {syncing && progress && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center animate-pulse">{progress}</p>
          )}
          {lastPull && !syncing && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Letzter Sync: {formatDate(new Date(lastPull))}
            </p>
          )}
          {result && !syncing && (
            <div className={`p-3 rounded-xl text-xs ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
              {result.errors.length > 0 ? (
                <div className="space-y-1">
                  <div className="font-medium">Fehler beim Sync:</div>
                  {result.errors.map((e, i) => <div key={i} className="font-mono">{e}</div>)}
                </div>
              ) : (
                <div>✓ Hochgeladen: {result.pushed} · Heruntergeladen: {result.pulled} neu</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Backup ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Lokales Backup</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Alle Daten als JSON exportieren oder ein früheres Backup importieren.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" loading={exporting} onClick={handleExport}>
            <Download size={16} /> Exportieren
          </Button>
          <label className="flex-1">
            <div className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
              <FolderOpen size={16} /> Importieren
            </div>
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
        {importResult && (
          <div className={`p-3 rounded-xl text-xs ${importResult.errors.length > 0 ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
            {importResult.errors.length > 0 ? (
              <div>
                <div className="font-medium">{importResult.imported} Einträge importiert, {importResult.errors.length} Fehler:</div>
                {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            ) : (
              <div>✓ {importResult.imported} Einträge erfolgreich importiert</div>
            )}
          </div>
        )}
      </div>

      {/* ── CSV Export ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Datenexport (CSV)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Daten als CSV-Datei für Excel / Buchhaltung exportieren.
        </p>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => exportProjectsCSV()}>
            <Download size={16} /> Projekte exportieren
          </Button>
          <Button variant="outline" className="w-full" onClick={() => exportRegiReportsCSV()}>
            <Download size={16} /> Regierapporte / Rechnungen
          </Button>
          <Button variant="outline" className="w-full" onClick={() => exportTimeEntriesCSV()}>
            <Download size={16} /> Alle Stunden exportieren
          </Button>
        </div>
      </div>

      {/* ── Benachrichtigungen ──────────────────────────────────────────── */}
      {notifSupported && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Benachrichtigungen</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Push-Benachrichtigung wenn neue Daten synchronisiert werden.
          </p>
          <Button
            variant={notifEnabled ? 'outline' : 'secondary'}
            className="w-full"
            onClick={handleToggleNotif}
          >
            {notifEnabled ? <><BellOff size={16} /> Deaktivieren</> : <><Bell size={16} /> Benachrichtigungen aktivieren</>}
          </Button>
          {Notification.permission === 'denied' && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Benachrichtigungen sind im Browser blockiert. Bitte in den Browsereinstellungen freigeben.
            </p>
          )}
        </div>
      )}

      {/* ── SQL migration ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Schritt 1 – SQL Migration</h3>
          <button
            onClick={handleCopySQL}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
          >
            <Copy size={13} />
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Diesen SQL-Code einmalig im Supabase SQL-Editor ausführen:<br />
          <span className="font-medium">Dashboard → SQL Editor → New Query → Einfügen → Run</span>
        </p>
        <pre className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
          {SUPABASE_SQL}
        </pre>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Schritt 2</span> – URL + Anon Key aus{' '}
          <span className="font-medium">Settings → API</span> kopieren und oben einfügen.
        </p>
      </div>
    </div>
  );
}
