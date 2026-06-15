import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Archive, ArrowLeft, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { useProject, createProject, updateProject, archiveProject, deleteProject } from '../hooks/useProjects';
import type { ProjectStatus } from '../types';
import { useEmployees } from '../hooks/useMasterData';
import { todayISO } from '../utils';

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const project = useProject(id);
  const employees = useEmployees();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientContact: '',
    siteAddress: '',
    description: '',
    status: 'active' as ProjectStatus,
    responsibleId: '',
    startDate: todayISO(),
    endDate: '',
    budget: '',
  });

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        title: project.title,
        clientName: project.clientName,
        clientContact: project.clientContact || '',
        siteAddress: project.siteAddress,
        description: project.description || '',
        status: project.status,
        responsibleId: project.responsibleId || '',
        startDate: project.startDate || todayISO(),
        endDate: project.endDate || '',
        budget: project.budget?.toString() || '',
      });
    }
  }, [project]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title || !form.clientName || !form.siteAddress) return;
    setSaving(true);
    try {
      const payload = { ...form, budget: form.budget ? Number(form.budget) : undefined };
      if (isEdit && id) {
        await updateProject(id, payload);
        navigate(`/projects/${id}`);
      } else {
        const newId = await createProject({ ...payload, status: 'active' });
        navigate(`/projects/${newId}`);
      }
    } catch (e) {
      alert(`Fehler beim Speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    await archiveProject(id);
    navigate('/projects');
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Projekt wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
    await deleteProject(id);
    navigate('/projects');
  };

  const employeeOptions = employees?.map(e => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  })) || [];

  return (
    <div>
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => navigate(isEdit && id ? `/projects/${id}` : '/projects')}
          className="p-1.5 -ml-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {isEdit ? 'Projekt bearbeiten' : 'Projekt anlegen'}
        </span>
        <Button onClick={handleSubmit} loading={saving} size="sm">
          <Check size={16} /> Speichern
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Projektangaben</h3>
          <Input label="Projektbezeichnung *" value={form.title} onChange={set('title')} placeholder="z.B. Neubau EFH Muster" />
          <Input label="Startdatum" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input label="Enddatum (geplant)" type="date" value={form.endDate} onChange={set('endDate')} />
          <Input label="Budget (CHF)" type="number" value={form.budget} onChange={set('budget')} placeholder="z.B. 50000" />
          <Select
            label="Verantwortlicher"
            value={form.responsibleId}
            onChange={set('responsibleId')}
            options={employeeOptions}
            placeholder="Mitarbeiter wählen"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Kunde</h3>
          <Input label="Kunde *" value={form.clientName} onChange={set('clientName')} placeholder="z.B. Familie Müller" />
          <Input label="Kontakt / Telefon" value={form.clientContact} onChange={set('clientContact')} placeholder="z.B. +41 79 123 45 67" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Baustelle</h3>
          <Input label="Baustellenadresse *" value={form.siteAddress} onChange={set('siteAddress')} placeholder="z.B. Musterstrasse 1, 8001 Zürich" />
          <Textarea label="Beschreibung / Bemerkungen" value={form.description} onChange={set('description')} placeholder="Kurzbeschreibung des Projekts…" />
        </div>

        {isEdit && (
          <Button variant="danger" className="w-full" onClick={handleArchive}>
            <Archive size={16} /> Projekt archivieren
          </Button>
        )}
        {isEdit && (
          <Button variant="danger" className="w-full" onClick={handleDelete}>
            <Trash2 size={16} /> Projekt löschen
          </Button>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
