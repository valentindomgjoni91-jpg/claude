import { useNavigate, useParams } from 'react-router-dom';
import { Edit2, Plus, Calendar, FileText, ChevronRight, MapPin, User, Phone } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useProject } from '../hooks/useProjects';
import { db } from '../db';
import { formatDate } from '../utils';
import type { ProjectStatus } from '../types';

function ProjectBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { variant: 'success' | 'info' | 'gray'; label: string }> = {
    active: { variant: 'success', label: 'Aktiv' },
    completed: { variant: 'info', label: 'Abgeschlossen' },
    archived: { variant: 'gray', label: 'Archiviert' },
  };
  return <Badge variant={map[status].variant}>{map[status].label}</Badge>;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProject(id);

  const dailyReports = useLiveQuery(
    () => id ? db.dailyReports.where('projectId').equals(id).reverse().sortBy('date') : [],
    [id]
  );
  const regiReports = useLiveQuery(
    () => id ? db.regiReports.where('projectId').equals(id).reverse().sortBy('date') : [],
    [id]
  );

  if (!project) return <div className="p-4 text-gray-500">Projekt nicht gefunden.</div>;

  return (
    <div>
      <PageHeader
        title={project.title}
        subtitle={project.clientName}
        backTo="/projects"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}/edit`)}>
            <Edit2 size={16} />
          </Button>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Project Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{project.title}</h3>
            <ProjectBadge status={project.status} />
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <span>{project.siteAddress}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={14} className="flex-shrink-0 text-gray-400" />
              <span>{project.clientName}</span>
            </div>
            {project.clientContact && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="flex-shrink-0 text-gray-400" />
                <span>{project.clientContact}</span>
              </div>
            )}
            {project.startDate && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} className="flex-shrink-0 text-gray-400" />
                <span>Start: {formatDate(project.startDate)}</span>
              </div>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{project.description}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate(`/tagesrapport/new?projectId=${id}`)}
            className="h-14 flex-col gap-1"
          >
            <Calendar size={18} />
            <span className="text-xs">Tagesrapport</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/regierapport/new?projectId=${id}`)}
            className="h-14 flex-col gap-1"
          >
            <FileText size={18} />
            <span className="text-xs">Regierapport</span>
          </Button>
        </div>

        {/* Daily Reports */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">
              Tagesrapporte ({dailyReports?.length ?? 0})
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/tagesrapport/new?projectId=${id}`)}
            >
              <Plus size={14} /> Neu
            </Button>
          </div>
          {dailyReports?.length === 0 && (
            <EmptyState title="Keine Tagesrapporte" description="Noch keine Tagesrapporte für dieses Projekt." />
          )}
          {dailyReports?.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/tagesrapport/${r.id}`)}
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 text-left"
            >
              <Calendar size={16} className="text-primary-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-500">{formatDate(r.date)}</div>
              </div>
              <div className="flex items-center gap-1">
                {r.status === 'completed'
                  ? <Badge variant="success">Fertig</Badge>
                  : <Badge variant="warning">Entwurf</Badge>
                }
                <ChevronRight size={14} className="text-gray-400" />
              </div>
            </button>
          ))}
        </div>

        {/* Regi Reports */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">
              Regierapporte ({regiReports?.length ?? 0})
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/regierapport/new?projectId=${id}`)}
            >
              <Plus size={14} /> Neu
            </Button>
          </div>
          {regiReports?.length === 0 && (
            <EmptyState title="Keine Regierapporte" />
          )}
          {regiReports?.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/regierapport/${r.id}`)}
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 text-left"
            >
              <FileText size={16} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-500">{formatDate(r.date)}</div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={r.status === 'signed' ? 'success' : r.status === 'invoiced' ? 'info' : 'warning'}>
                  {r.status === 'signed' ? 'Signiert' : r.status === 'invoiced' ? 'Verrechnet' : 'Entwurf'}
                </Badge>
                <ChevronRight size={14} className="text-gray-400" />
              </div>
            </button>
          ))}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
