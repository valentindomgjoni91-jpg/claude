import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, FileText, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/ui/Badge';
import { db } from '../db';
import { formatDate, cn } from '../utils';

type ReportType = 'all' | 'daily' | 'regi';

export default function Archive() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ReportType>('all');

  const dailyReports = useLiveQuery(() =>
    db.dailyReports.orderBy('date').reverse().toArray()
  );
  const regiReports = useLiveQuery(() =>
    db.regiReports.orderBy('date').reverse().toArray()
  );
  const projectMap = useLiveQuery(async () => {
    const projects = await db.projects.toArray();
    return Object.fromEntries(projects.map(p => [p.id, p.title]));
  });

  const filteredDaily = dailyReports?.filter(r =>
    (type === 'all' || type === 'daily') &&
    (!search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      formatDate(r.date).includes(search) ||
      (projectMap?.[r.projectId] || '').toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const filteredRegi = regiReports?.filter(r =>
    (type === 'all' || type === 'regi') &&
    (!search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      formatDate(r.date).includes(search) ||
      (projectMap?.[r.projectId] || '').toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const total = filteredDaily.length + filteredRegi.length;

  return (
    <div>
      <PageHeader title="Archiv" subtitle={`${total} Rapporte`} />

      <div className="px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Titel, Datum oder Projekt suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {(['all', 'daily', 'regi'] as ReportType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {t === 'all' ? 'Alle' : t === 'daily' ? 'Tagesrapporte' : 'Regierapporte'}
            </button>
          ))}
        </div>

        {/* Combined list, sorted by date */}
        <div className="space-y-2 pb-4">
          {filteredDaily.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/tagesrapport/${r.id}`)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left flex items-start gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">{r.title}</span>
                  <Badge variant={r.status === 'completed' ? 'success' : 'warning'} className="flex-shrink-0">
                    {r.status === 'completed' ? 'Fertig' : 'Entwurf'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{formatDate(r.date)}</div>
                {projectMap?.[r.projectId] && (
                  <div className="text-xs text-gray-400 truncate">{projectMap[r.projectId]}</div>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            </button>
          ))}
          {filteredRegi.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/regierapport/${r.id}`)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left flex items-start gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">{r.title}</span>
                  <Badge
                    variant={r.status === 'signed' ? 'success' : r.status === 'invoiced' ? 'info' : 'warning'}
                    className="flex-shrink-0"
                  >
                    {r.status === 'signed' ? 'Signiert' : r.status === 'invoiced' ? 'Verrechnet' : 'Entwurf'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{formatDate(r.date)}</div>
                {projectMap?.[r.projectId] && (
                  <div className="text-xs text-gray-400 truncate">{projectMap[r.projectId]}</div>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            </button>
          ))}
          {total === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              Keine Rapporte gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
