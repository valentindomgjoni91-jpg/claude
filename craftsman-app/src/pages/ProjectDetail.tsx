import { useNavigate, useParams } from 'react-router-dom';
import { Edit2, Plus, Calendar, FileText, ChevronRight, MapPin, User, Phone, Clock, TrendingUp, Download, ArrowLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useProject } from '../hooks/useProjects';
import { useCompany } from '../hooks/useMasterData';
import { db } from '../db';
import { formatDate, formatHours, formatCurrency } from '../utils';
import { generateProjectReportPdf } from '../pdf/projectReportPdf';
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

  const projectStats = useLiveQuery(async () => {
    if (!id) return null;
    const reports = await db.dailyReports.where('projectId').equals(id).toArray();
    const reportIds = reports.map(r => r.id);

    const regiReportsList = await db.regiReports.where('projectId').equals(id).toArray();
    const regiReportIds = regiReportsList.map(r => r.id);

    const [timeEntries, materialEntries, machineEntries, subEntries, regiPositions] = await Promise.all([
      reportIds.length > 0
        ? db.timeEntries.where('reportId').anyOf(reportIds).toArray()
        : Promise.resolve([]),
      reportIds.length > 0
        ? db.materialEntries.where('reportId').anyOf(reportIds).filter(e => e.reportType === 'daily').toArray()
        : Promise.resolve([]),
      reportIds.length > 0
        ? db.machineEntries.where('reportId').anyOf(reportIds).filter(e => e.reportType === 'daily').toArray()
        : Promise.resolve([]),
      reportIds.length > 0
        ? db.subcontractorEntries.where('reportId').anyOf(reportIds).toArray()
        : Promise.resolve([]),
      regiReportIds.length > 0
        ? db.regiPositions.where('regiReportId').anyOf(regiReportIds).toArray()
        : Promise.resolve([]),
    ]);

    const totalHours = timeEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const totalMaterialCost = materialEntries.reduce((sum, e) => sum + e.total, 0);
    const totalMachineCost = machineEntries.reduce((sum, e) => sum + e.total, 0);
    const totalSubCost = subEntries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const regiTotal = regiPositions.reduce((sum, p) => sum + (p.total ?? 0), 0);

    return { totalHours, totalMaterialCost, totalMachineCost, totalSubCost, regiTotal };
  }, [id]);

  const company = useCompany();

  const progressPercent = (() => {
    if (!project?.startDate || !project?.endDate) return null;
    const start = new Date(project.startDate).getTime();
    const end = new Date(project.endDate).getTime();
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (end <= start) return null;
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  })();

  const handleProjectReportPdf = async () => {
    if (!project || !id) return;
    const [allDailyReports, allRegiReports] = await Promise.all([
      db.dailyReports.where('projectId').equals(id).reverse().sortBy('date'),
      db.regiReports.where('projectId').equals(id).reverse().sortBy('date'),
    ]);
    const pdf = generateProjectReportPdf({
      project,
      dailyReports: allDailyReports,
      regiReports: allRegiReports,
      stats: {
        totalHours: projectStats?.totalHours ?? 0,
        totalMaterialCost: projectStats?.totalMaterialCost ?? 0,
        totalMachineCost: projectStats?.totalMachineCost ?? 0,
        totalSubCost: projectStats?.totalSubCost ?? 0,
        regiTotal: projectStats?.regiTotal ?? 0,
      },
      company: company ?? null,
    });
    pdf.save(`Projektbericht_${project.title.replace(/\s+/g, '_')}.pdf`);
  };

  if (project === undefined) return <div className="p-4 text-gray-400 dark:text-gray-500">Laden…</div>;
  if (project === null) return <div className="p-4 text-gray-500 dark:text-gray-400">Projekt nicht gefunden.</div>;

  return (
    <div>
      <div className="sticky top-[52px] z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => navigate('/projects')}
          className="p-1.5 -ml-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{project.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.clientName}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}/edit`)}>
          <Edit2 size={16} />
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Project Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.title}</h3>
            <ProjectBadge status={project.status} />
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <span>{project.siteAddress}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <User size={14} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <span>{project.clientName}</span>
            </div>
            {project.clientContact && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Phone size={14} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
                <span>{project.clientContact}</span>
              </div>
            )}
            {project.startDate && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Calendar size={14} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
                <span>Start: {formatDate(project.startDate)}</span>
              </div>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-xl p-3">{project.description}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
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
          <Button
            variant="outline"
            onClick={handleProjectReportPdf}
            className="h-14 flex-col gap-1"
          >
            <Download size={18} />
            <span className="text-xs">Bericht PDF</span>
          </Button>
        </div>

        {/* Project Statistics */}
        {projectStats && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary-500" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Projektstatistik</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-primary-600">
                  <Clock size={12} />
                  <span className="text-lg font-bold">{formatHours(projectStats.totalHours)}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Stunden</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">
                  {formatCurrency(projectStats.totalMaterialCost)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Material</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {formatCurrency(projectStats.totalMachineCost)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Maschinen</div>
              </div>
            </div>
            {project.budget && project.budget > 0 && projectStats && (() => {
              const gesamtIst = (projectStats.totalMaterialCost ?? 0) + (projectStats.totalMachineCost ?? 0) + (projectStats.totalSubCost ?? 0);
              const pct = Math.min(100, Math.round((gesamtIst / project.budget!) * 100));
              const over = gesamtIst > project.budget!;
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Budget: {formatCurrency(project.budget!)}</span>
                    <span className={over ? 'text-red-500 font-semibold' : ''}>{pct}% genutzt</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    Ist: {formatCurrency(gesamtIst)}
                  </div>
                </div>
              );
            })()}
            {progressPercent !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Fortschritt</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {project.endDate && (
                  <div className="text-xs text-gray-400 text-right">
                    Ende: {formatDate(project.endDate)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Daily Reports */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
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
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <Calendar size={16} className="text-primary-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.date)}</div>
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
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
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <FileText size={16} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.date)}</div>
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
