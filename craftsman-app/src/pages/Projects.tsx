import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, FolderKanban, Search } from 'lucide-react';

import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useProjects } from '../hooks/useProjects';
import type { ProjectStatus } from '../types';
import { cn } from '../utils';

const STATUS_TABS: { id: ProjectStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'active', label: 'Aktiv' },
  { id: 'completed', label: 'Abgeschlossen' },
  { id: 'archived', label: 'Archiviert' },
];

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { variant: 'success' | 'info' | 'gray'; label: string }> = {
    active: { variant: 'success', label: 'Aktiv' },
    completed: { variant: 'info', label: 'Abgeschlossen' },
    archived: { variant: 'gray', label: 'Archiviert' },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export default function Projects() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('active');
  const [search, setSearch] = useState('');

  const allProjects = useProjects();

  const projects = allProjects?.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.siteAddress.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-3 space-y-3">
        {/* Search + Neu */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={() => navigate('/projects/new')} size="sm">
            <Plus size={16} /> Neu
          </Button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Project list */}
        {projects?.length === 0 && (
          <EmptyState
            icon={<FolderKanban size={48} />}
            title="Keine Projekte gefunden"
            description="Legen Sie ein neues Projekt an."
            action={
              <Button onClick={() => navigate('/projects/new')}>
                <Plus size={16} /> Projekt anlegen
              </Button>
            }
          />
        )}

        <div className="space-y-2 pb-4">
          {projects?.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-left shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-start gap-3"
            >
              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <FolderKanban size={18} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">{project.title}</span>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{project.clientName}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{project.siteAddress}</div>
              </div>
              <ChevronRight size={18} className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
