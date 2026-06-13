import { useNavigate } from 'react-router-dom';
import { FileText, Clock, FolderKanban, ChevronRight, Calendar } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { formatDate, todayISO } from '../utils';

function StatusBadge({ status }: { status: string }) {
  if (status === 'draft') return <Badge variant="warning">Entwurf</Badge>;
  if (status === 'completed') return <Badge variant="success">Abgeschlossen</Badge>;
  if (status === 'signed') return <Badge variant="success">Unterzeichnet</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const today = todayISO();

  const recentDailyReports = useLiveQuery(() =>
    db.dailyReports.orderBy('createdAt').reverse().limit(5).toArray()
  );
  const recentRegiReports = useLiveQuery(() =>
    db.regiReports.orderBy('createdAt').reverse().limit(3).toArray()
  );
  const activeProjects = useLiveQuery(() =>
    db.projects.where('status').equals('active').count()
  );
  const todayReports = useLiveQuery(() =>
    db.dailyReports.where('date').equals(today).count()
  );
  const draftCount = useLiveQuery(() =>
    db.dailyReports.where('status').equals('draft').count()
  );

  const projectMap = useLiveQuery(async () => {
    const projects = await db.projects.toArray();
    return Object.fromEntries(projects.map(p => [p.id, p.title]));
  });

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Guten Tag 👷</h2>
        <p className="text-sm text-gray-500">{formatDate(today)}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-600">{activeProjects ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Projekte</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">{todayReports ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Heute</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{draftCount ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Offen</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Schnellstart</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => navigate('/tagesrapport/new')}
            size="lg"
            className="flex-col gap-1 h-16"
          >
            <Calendar size={20} />
            <span className="text-xs">Tagesrapport</span>
          </Button>
          <Button
            onClick={() => navigate('/regierapport/new')}
            variant="outline"
            size="lg"
            className="flex-col gap-1 h-16"
          >
            <FileText size={20} />
            <span className="text-xs">Regierapport</span>
          </Button>
          <Button
            onClick={() => navigate('/projects/new')}
            variant="secondary"
            size="lg"
            className="flex-col gap-1 h-16"
          >
            <FolderKanban size={20} />
            <span className="text-xs">Projekt anlegen</span>
          </Button>
          <Button
            onClick={() => navigate('/timetracking')}
            variant="secondary"
            size="lg"
            className="flex-col gap-1 h-16"
          >
            <Clock size={20} />
            <span className="text-xs">Zeiterfassung</span>
          </Button>
        </div>
      </Card>

      {/* Recent Daily Reports */}
      <Card padding="none">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Letzte Tagesrapporte</h3>
          <button
            onClick={() => navigate('/archive')}
            className="text-xs text-primary-600 font-medium"
          >
            Alle anzeigen
          </button>
        </div>
        {recentDailyReports?.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Noch keine Rapporte vorhanden
          </div>
        )}
        {recentDailyReports?.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/tagesrapport/${r.id}`)}
            className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
          >
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={16} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">{r.title}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{formatDate(r.date)}</span>
                {projectMap && projectMap[r.projectId] && (
                  <span className="truncate">· {projectMap[r.projectId]}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </button>
        ))}
      </Card>

      {/* Recent Regi Reports */}
      {(recentRegiReports?.length ?? 0) > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Letzte Regierapporte</h3>
          </div>
          {recentRegiReports?.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/regierapport/${r.id}`)}
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-500">{formatDate(r.date)}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>
          ))}
        </Card>
      )}

      <div className="h-4" />
    </div>
  );
}
