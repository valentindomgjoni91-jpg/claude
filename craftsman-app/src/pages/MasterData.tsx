import { useState } from 'react';
import { Users, Truck, Package, Building2, Plus, Check, X } from 'lucide-react';
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
import { UNITS } from '../utils';
import type { EmployeeRole } from '../types';

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
      </div>
    </div>
  );
}

function CompanyTab() {
  const company = useCompany();
  const [form, setForm] = useState({
    name: '', street: '', city: '', zip: '', phone: '',
    email: '', website: '', vatNumber: '', footerText: '',
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
    });
    setLoaded(true);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

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
  const [form, setForm] = useState({ firstName: '', lastName: '', role: 'worker' as EmployeeRole, hourlyRate: '65' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveEmployee({ ...form, hourlyRate: Number(form.hourlyRate), active: true });
    setAdding(false);
    setForm({ firstName: '', lastName: '', role: 'worker', hourlyRate: '65' });
  };

  return (
    <div className="space-y-3 mt-2">
      {employees?.map(emp => (
        <div key={emp.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</div>
            <div className="text-xs text-gray-500">{ROLE_OPTIONS.find(r => r.value === emp.role)?.label} · CHF {emp.hourlyRate}/h</div>
          </div>
          <button
            onClick={() => updateEmployee(emp.id, { active: !emp.active })}
            className={`text-xs px-2 py-1 rounded-full ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {emp.active ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
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
  const [form, setForm] = useState({ name: '', type: '', licensePlate: '', hourlyRate: '80' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveMachine({ ...form, hourlyRate: Number(form.hourlyRate), active: true });
    setAdding(false);
    setForm({ name: '', type: '', licensePlate: '', hourlyRate: '80' });
  };

  return (
    <div className="space-y-3 mt-2">
      {machines?.map(m => (
        <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-gray-900">{m.name}</div>
            <div className="text-xs text-gray-500">{m.type}{m.licensePlate ? ` · ${m.licensePlate}` : ''} · CHF {m.hourlyRate}/h</div>
          </div>
          <button
            onClick={() => updateMachine(m.id, { active: !m.active })}
            className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {m.active ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
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
  const [form, setForm] = useState({ name: '', unit: 'm³', unitPrice: '0', category: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = async () => {
    await saveMaterial({ ...form, unitPrice: Number(form.unitPrice), active: true });
    setAdding(false);
    setForm({ name: '', unit: 'm³', unitPrice: '0', category: '' });
  };

  return (
    <div className="space-y-3 mt-2">
      {materials?.map(m => (
        <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-gray-900">{m.name}</div>
            <div className="text-xs text-gray-500">{m.unit} · CHF {m.unitPrice}{m.category ? ` · ${m.category}` : ''}</div>
          </div>
          <button
            onClick={() => updateMaterial(m.id, { active: !m.active })}
            className={`text-xs px-2 py-1 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {m.active ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
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
