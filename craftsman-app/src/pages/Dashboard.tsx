import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { FileText, Clock, FolderKanban, ChevronRight, Calendar, TrendingUp, BarChart2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { db } from '../db';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { formatDate, formatHours, formatCurrency, todayISO } from '../utils';

function StatusBadge({ status }: { status: string }) {
  if (status === 'draft') return <Badge variant="warning">Entwurf</Badge>;
  if (status === 'completed') return <Badge variant="success">Abgeschlossen</Badge>;
  if (status === 'signed') return <Badge variant="success">Unterzeichnet</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const today = todayISO();

  const activeProjects = useLiveQuery(() =>
    db.projects.where('status').equals('active').count()
  );
  const todayReports = useLiveQuery(() =>
    db.dailyReports.where('date').equals(today).count()
  );
  const draftCount = useLiveQuery(() =>
    db.dailyReports.where('status').equals('draft').count()
  );

  const weekHours = useLiveQuery(async () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
    const reportIds = (
      await db.dailyReports.where('date').between(weekStart, weekEnd, true, true).toArray()
    ).map(r => r.id);
    if (reportIds.length === 0) return 0;
    const entries = await db.timeEntries.where('reportId').anyOf(reportIds).toArray();
    return entries.reduce((sum, e) => sum + e.totalHours, 0);
  });

  const projectMap = useLiveQuery(async () => {
    const projects = await db.projects.toArray();
    return Object.fromEntries(projects.map(p => [p.id, p.title]));
  });

  const monthlyStats = useLiveQuery(async () => {
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().split('T')[0];
    const monthEnd = endOfMonth(now).toISOString().split('T')[0];

    const reportIds = (
      await db.dailyReports.where('date').between(monthStart, monthEnd, true, true).toArray()
    ).map(r => r.id);

    if (reportIds.length === 0) return { totalHours: 0, employees: [] };

    const entries = await db.timeEntries.where('reportId').anyOf(reportIds).toArray();
    const allEmployees = await db.employees.toArray();
    const empMap = Object.fromEntries(allEmployees.map(e => [e.id, e]));

    const byEmployee = new Map<string, { name: string; hours: number; rate: number }>();
    for (const e of entries) {
      const emp = empMap[e.employeeId];
      if (!emp) continue;
      const key = e.employeeId;
      const existing = byEmployee.get(key) ?? { name: `${emp.firstName} ${emp.lastName}`, hours: 0, rate: emp.hourlyRate };
      byEmployee.set(key, { ...existing, hours: existing.hours + e.totalHours });
    }

    const employees = [...byEmployee.values()].sort((a, b) => b.hours - a.hours).slice(0, 5);
    const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
    const estimatedRevenue = employees.reduce((sum, e) => sum + e.hours * e.rate, 0);

    return { totalHours, employees, estimatedRevenue };
  });

  const activityFeed = useLiveQuery(async () => {
    const [daily, regi] = await Promise.all([
      db.dailyReports.orderBy('createdAt').reverse().limit(8).toArray(),
      db.regiReports.orderBy('createdAt').reverse().limit(8).toArray(),
    ]);
    type ActivityItem = {
      id: string; type: 'daily' | 'regi'; title: string;
      date: string; status: string; projectId: string; createdAt: string;
    };
    const combined: ActivityItem[] = [
      ...daily.map(r => ({ id: r.id, type: 'daily' as const, title: r.title, date: r.date, status: r.status, projectId: r.projectId, createdAt: r.createdAt })),
      ...regi.map(r => ({ id: r.id, type: 'regi' as const, title: r.title, date: r.date, status: r.status, projectId: r.projectId, createdAt: r.createdAt })),
    ];
    return combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  });

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Guten Tag 👷</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(today)}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-600">{activeProjects ?? '—'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Aktive Projekte</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {weekHours != null ? formatHours(weekHours) : '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Stunden diese Woche</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{todayReports ?? '—'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rapporte heute</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{draftCount ?? '—'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Entwürfe offen</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">Schnellstart</h3>
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
          {isAdmin && (
            <Button
              onClick={() => navigate('/projects/new')}
              variant="secondary"
              size="lg"
              className="flex-col gap-1 h-16"
            >
              <FolderKanban size={20} />
              <span className="text-xs">Projekt anlegen</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => navigate('/timetracking')}
              variant="secondary"
              size="lg"
              className="flex-col gap-1 h-16"
            >
              <Clock size={20} />
              <span className="text-xs">Zeiterfassung</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Monthly Stats */}
      {monthlyStats && (monthlyStats.totalHours > 0) && (
        <Card padding="none">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700">
            <BarChart2 size={14} className="text-primary-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Monatsauswertung</h3>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
              {new Date().toLocaleString('de-CH', { month: 'long' })}
            </span>
          </div>
          <div className="px-4 py-3 flex gap-4 border-b border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <div className="text-xl font-bold text-primary-600">{formatHours(monthlyStats.totalHours)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Stunden</div>
            </div>
            {(monthlyStats.estimatedRevenue ?? 0) > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">{formatCurrency(monthlyStats.estimatedRevenue ?? 0)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Geschätzter Umsatz</div>
              </div>
            )}
          </div>
          {monthlyStats.employees.map(emp => {
            const pct = monthlyStats.totalHours > 0
              ? Math.round((emp.hours / monthlyStats.totalHours) * 100)
              : 0;
            return (
              <div key={emp.name} className="px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-200">{emp.name}</span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{formatHours(emp.hours)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Activity Feed */}
      <Card padding="none">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-primary-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Letzte Aktivität</h3>
          </div>
          <button
            onClick={() => navigate('/archive')}
            className="text-xs text-primary-600 dark:text-primary-400 font-medium"
          >
            Alle anzeigen
          </button>
        </div>
        {(activityFeed?.length ?? 0) === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Noch keine Rapporte vorhanden
          </div>
        )}
        {activityFeed?.map((r) => (
          <button
            key={`${r.type}-${r.id}`}
            onClick={() => navigate(r.type === 'daily' ? `/tagesrapport/${r.id}` : `/regierapport/${r.id}`)}
            className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              r.type === 'daily' ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-orange-50 dark:bg-orange-900/30'
            }`}>
              {r.type === 'daily'
                ? <Calendar size={16} className="text-primary-600 dark:text-primary-400" />
                : <FileText size={16} className="text-orange-600 dark:text-orange-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{r.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span>{formatDate(r.date)}</span>
                {projectMap && projectMap[r.projectId] && (
                  <span className="truncate">· {projectMap[r.projectId]}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
            </div>
          </button>
        ))}
      </Card>

      <div className="h-4" />
    </div>
  );
}
