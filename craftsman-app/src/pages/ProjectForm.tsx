import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Archive } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { useProject, createProject, updateProject, archiveProject } from '../hooks/useProjects';
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
    status: 'active' as const,
    responsibleId: '',
    startDate: todayISO(),
    endDate: '',
  });

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title,
        clientName: project.clientName,
        clientContact: project.clientContact || '',
        siteAddress: project.siteAddress,
        description: project.description || '',
        status: project.status as 'active',
        responsibleId: project.responsibleId || '',
        startDate: project.startDate || todayISO(),
        endDate: project.endDate || '',
      });
    }
  }, [project]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title || !form.clientName || !form.siteAddress) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateProject(id, form);
        navigate(`/projects/${id}`);
      } else {
        const newId = await createProject({ ...form, status: 'active' });
        navigate(`/projects/${newId}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    await archiveProject(id);
    navigate('/projects');
  };

  const employeeOptions = employees?.map(e => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  })) || [];

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Projekt bearbeiten' : 'Projekt anlegen'}
        backTo={isEdit && id ? `/projects/${id}` : '/projects'}
        action={
          <Button onClick={handleSubmit} loading={saving} size="sm">
            <Check size={16} />
            Speichern
          </Button>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Projektangaben</h3>
          <Input label="Projektbezeichnung *" value={form.title} onChange={set('title')} placeholder="z.B. Neubau EFH Muster" />
          <Input label="Startdatum" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input label="Enddatum (geplant)" type="date" value={form.endDate} onChange={set('endDate')} />
          <Select
            label="Verantwortlicher"
            value={form.responsibleId}
            onChange={set('responsibleId')}
            options={employeeOptions}
            placeholder="Mitarbeiter wählen"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Kunde</h3>
          <Input label="Kunde *" value={form.clientName} onChange={set('clientName')} placeholder="z.B. Familie Müller" />
          <Input label="Kontakt / Telefon" value={form.clientContact} onChange={set('clientContact')} placeholder="z.B. +41 79 123 45 67" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Baustelle</h3>
          <Input label="Baustellenadresse *" value={form.siteAddress} onChange={set('siteAddress')} placeholder="z.B. Musterstrasse 1, 8001 Zürich" />
          <Textarea label="Beschreibung / Bemerkungen" value={form.description} onChange={set('description')} placeholder="Kurzbeschreibung des Projekts…" />
        </div>

        {isEdit && (
          <Button variant="danger" className="w-full" onClick={handleArchive}>
            <Archive size={16} /> Projekt archivieren
          </Button>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
