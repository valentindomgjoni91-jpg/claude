import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, FileText, ChevronRight, Filter,
  X, ArrowUpDown, Download, Copy,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import { db } from '../db';
import { formatDate, formatHours, formatCurrency, cn } from '../utils';
import { generateDailyReportPdf } from '../pdf/dailyReportPdf';
import { generateRegiReportPdf } from '../pdf/regiReportPdf';
import { duplicateDailyReport, duplicateRegiReport } from '../hooks/useDuplicate';
import { useLanguage } from '../i18n';

type ReportType = 'all' | 'daily' | 'regi';
type SortOrder = 'newest' | 'oldest';
type StatusFilter = 'all' | 'draft' | 'completed' | 'signed' | 'invoiced';

interface UnifiedReport {
  id: string;
  type: 'daily' | 'regi';
  title: string;
  date: string;
  status: string;
  projectId: string;
}

interface PreviewData {
  report: UnifiedReport;
  totalHours?: number;
  totalCost?: number;
  photoCount?: number;
  positionCount?: number;
}

export default function Archive() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ReportType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Preview sheet
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Data
  const dailyReports = useLiveQuery(() => db.dailyReports.orderBy('date').toArray());
  const regiReports = useLiveQuery(() => db.regiReports.orderBy('date').toArray());
  const projects = useLiveQuery(() => db.projects.toArray());

  const projectMap = useMemo(
    () => Object.fromEntries(projects?.map(p => [p.id, p]) ?? []),
    [projects]
  );
  const projectOptions = useMemo(
    () => projects?.map(p => ({ value: p.id, label: p.title })) ?? [],
    [projects]
  );

  // Unify + filter + sort
  const unified: UnifiedReport[] = useMemo(() => {
    const daily: UnifiedReport[] = (dailyReports ?? []).map(r => ({
      id: r.id, type: 'daily' as const, title: r.title, date: r.date,
      status: r.status, projectId: r.projectId,
    }));
    const regi: UnifiedReport[] = (regiReports ?? []).map(r => ({
      id: r.id, type: 'regi' as const, title: r.title, date: r.date,
      status: r.status, projectId: r.projectId,
    }));

    let combined = [...(type === 'regi' ? [] : daily), ...(type === 'daily' ? [] : regi)];

    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(r =>
        r.title.toLowerCase().includes(q) ||
        formatDate(r.date).includes(q) ||
        (projectMap[r.projectId]?.title ?? '').toLowerCase().includes(q) ||
        (projectMap[r.projectId]?.clientName ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      combined = combined.filter(r => r.status === statusFilter);
    }
    if (projectFilter) {
      combined = combined.filter(r => r.projectId === projectFilter);
    }
    if (dateFrom) {
      combined = combined.filter(r => r.date >= dateFrom);
    }
    if (dateTo) {
      combined = combined.filter(r => r.date <= dateTo);
    }

    combined.sort((a, b) =>
      sortOrder === 'newest'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    );

    return combined;
  }, [dailyReports, regiReports, type, search, statusFilter, projectFilter, dateFrom, dateTo, sortOrder, projectMap]);

  const activeFilterCount = [
    statusFilter !== 'all', projectFilter, dateFrom, dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter('all');
    setProjectFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Load preview data
  const openPreview = async (r: UnifiedReport) => {
    let totalHours: number | undefined;
    let totalCost: number | undefined;
    let photoCount: number | undefined;
    let positionCount: number | undefined;

    if (r.type === 'daily') {
      const [times, mats, machs, subs, photos] = await Promise.all([
        db.timeEntries.where('reportId').equals(r.id).toArray(),
        db.materialEntries.where('reportId').equals(r.id).toArray(),
        db.machineEntries.where('reportId').equals(r.id).toArray(),
        db.subcontractorEntries.where('reportId').equals(r.id).toArray(),
        db.photos.where('reportId').equals(r.id).count(),
      ]);
      totalHours = times.reduce((s, e) => s + e.totalHours, 0);
      totalCost = [...mats, ...machs].reduce((s, e) => s + e.total, 0)
        + subs.reduce((s, e) => s + e.amount, 0);
      photoCount = photos;
    } else {
      const positions = await db.regiPositions.where('regiReportId').equals(r.id).toArray();
      positionCount = positions.length;
      const net = positions.reduce((s, p) => s + p.total, 0);
      const rpt = await db.regiReports.get(r.id);
      totalCost = net * (1 + (rpt?.vatRate ?? 8.1) / 100);
    }

    setPreview({ report: r, totalHours, totalCost, photoCount, positionCount });
  };

  // PDF actions from preview
  const handlePreviewPdf = async () => {
    if (!preview) return;
    setLoadingPdf(true);
    try {
      if (preview.report.type === 'daily') {
        const [rpt, proj, emps, machs, co] = await Promise.all([
          db.dailyReports.get(preview.report.id),
          db.projects.get(preview.report.projectId),
          db.employees.toArray(),
          db.machines.toArray(),
          db.company.toCollection().first(),
        ]);
        if (!rpt || !proj) return;
        const [times, mats, machEntries, subs, photos] = await Promise.all([
          db.timeEntries.where('reportId').equals(rpt.id).toArray(),
          db.materialEntries.where('reportId').equals(rpt.id).toArray(),
          db.machineEntries.where('reportId').equals(rpt.id).toArray(),
          db.subcontractorEntries.where('reportId').equals(rpt.id).toArray(),
          db.photos.where('reportId').equals(rpt.id).toArray(),
        ]);
        const pdf = generateDailyReportPdf({ report: rpt, project: proj, timeEntries: times, materialEntries: mats, machineEntries: machEntries, subcontractorEntries: subs, photos, employees: emps, machines: machs, company: co ?? null });
        pdf.save(`Tagesrapport_${rpt.date}.pdf`);
      } else {
        const [rpt, proj, positions, co] = await Promise.all([
          db.regiReports.get(preview.report.id),
          db.projects.get(preview.report.projectId),
          db.regiPositions.where('regiReportId').equals(preview.report.id).toArray(),
          db.company.toCollection().first(),
        ]);
        if (!rpt || !proj) return;
        const pdf = generateRegiReportPdf({ report: rpt, project: proj, positions, company: co ?? null });
        pdf.save(`Regierapport_${rpt.date}.pdf`);
      }
    } finally {
      setLoadingPdf(false);
      setPreview(null);
    }
  };

  const handlePreviewDuplicate = async () => {
    if (!preview) return;
    setPreview(null);
    if (preview.report.type === 'daily') {
      const newId = await duplicateDailyReport(preview.report.id);
      navigate(`/tagesrapport/${newId}`);
    } else {
      const newId = await duplicateRegiReport(preview.report.id);
      navigate(`/regierapport/${newId}`);
    }
  };

  return (
    <div>
      <PageHeader title={t('page.archive')} subtitle={`${unified.length} Rapport${unified.length !== 1 ? 'e' : ''}`} />

      <div className="px-4 py-3 space-y-3">
        {/* Search + Filter Toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Titel, Datum, Projekt oder Kunde…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
          <button
            aria-label="Filter"
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors relative',
              showFilters || activeFilterCount > 0
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white border-gray-200 text-gray-600'
            )}
          >
            <Filter size={15} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            aria-label="Sortierung"
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600"
          >
            <ArrowUpDown size={15} />
          </button>
        </div>

        {/* Type Filter Pills */}
        <div className="flex gap-2">
          {(['all', 'daily', 'regi'] as ReportType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-1',
                type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {t === 'all' ? 'Alle' : t === 'daily' ? 'Tagesrapporte' : 'Regierapporte'}
            </button>
          ))}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Filter</span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 flex items-center gap-1">
                  <X size={12} /> Zurücksetzen
                </button>
              )}
            </div>
            <Select
              label="Status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: 'all', label: 'Alle Status' },
                { value: 'draft', label: 'Entwurf' },
                { value: 'completed', label: 'Abgeschlossen' },
                { value: 'signed', label: 'Unterzeichnet' },
                { value: 'invoiced', label: 'Verrechnet' },
              ]}
            />
            <Select
              label="Projekt"
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              options={projectOptions}
              placeholder="Alle Projekte"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Datum von" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <Input label="Datum bis" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Sort indicator */}
        {(unified.length > 0 || search) && (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{unified.length} Treffer</span>
            <span>{sortOrder === 'newest' ? '↓ Neueste zuerst' : '↑ Älteste zuerst'}</span>
          </div>
        )}

        {/* Report List */}
        <div className="space-y-2 pb-4">
          {unified.map(r => (
            <ReportCard
              key={`${r.type}-${r.id}`}
              report={r}
              projectName={projectMap[r.projectId]?.title}
              onPreview={() => openPreview(r)}
            />
          ))}
          {unified.length === 0 && (
            <div className="text-center py-14 text-gray-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Keine Rapporte gefunden</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-2 text-xs text-primary-600">
                  Filter zurücksetzen
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Bottom Sheet */}
      {preview && (
        <ReportPreviewSheet
          data={preview}
          projectName={projectMap[preview.report.projectId]?.title}
          onClose={() => setPreview(null)}
          onOpen={() => {
            const r = preview.report;
            setPreview(null);
            navigate(r.type === 'daily' ? `/tagesrapport/${r.id}` : `/regierapport/${r.id}`);
          }}
          onPdf={handlePreviewPdf}
          onDuplicate={handlePreviewDuplicate}
          loadingPdf={loadingPdf}
        />
      )}
    </div>
  );
}

// ---- Report Card ----

function ReportCard({ report, projectName, onPreview }: {
  report: UnifiedReport;
  projectName?: string;
  onPreview: () => void;
}) {
  const isDaily = report.type === 'daily';
  const statusMap: Record<string, { variant: 'success' | 'warning' | 'info' | 'gray'; label: string }> = {
    draft: { variant: 'warning', label: 'Entwurf' },
    completed: { variant: 'success', label: 'Fertig' },
    signed: { variant: 'success', label: 'Signiert' },
    invoiced: { variant: 'info', label: 'Verrechnet' },
  };
  const { variant, label } = statusMap[report.status] ?? { variant: 'gray', label: report.status };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform">
      <button
        onClick={onPreview}
        className="w-full px-4 py-3.5 flex items-start gap-3 text-left"
      >
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
          isDaily ? 'bg-primary-50' : 'bg-orange-50'
        )}>
          {isDaily
            ? <Calendar size={16} className="text-primary-600" />
            : <FileText size={16} className="text-orange-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm text-gray-900 leading-tight truncate">{report.title}</span>
            <Badge variant={variant} className="flex-shrink-0 text-[11px]">{label}</Badge>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{formatDate(report.date)}</div>
          {projectName && <div className="text-xs text-gray-400 truncate">{projectName}</div>}
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
      </button>
    </div>
  );
}

// ---- Report Preview Sheet ----

function ReportPreviewSheet({ data, projectName, onClose, onOpen, onPdf, onDuplicate, loadingPdf }: {
  data: PreviewData;
  projectName?: string;
  onClose: () => void;
  onOpen: () => void;
  onPdf: () => void;
  onDuplicate: () => void;
  loadingPdf: boolean;
}) {
  const { report, totalHours, totalCost, photoCount, positionCount } = data;
  const isDaily = report.type === 'daily';

  const statusMap: Record<string, { variant: 'success' | 'warning' | 'info' | 'gray'; label: string }> = {
    draft: { variant: 'warning', label: 'Entwurf' },
    completed: { variant: 'success', label: 'Abgeschlossen' },
    signed: { variant: 'success', label: 'Unterzeichnet' },
    invoiced: { variant: 'info', label: 'Verrechnet' },
  };
  const { variant, label } = statusMap[report.status] ?? { variant: 'gray', label: report.status };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-0.5">
                {isDaily ? 'Tagesrapport' : 'Regierapport'} · {formatDate(report.date)}
              </p>
              <h2 className="font-bold text-gray-900 text-base leading-tight">{report.title}</h2>
              {projectName && <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>}
            </div>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          {totalHours !== undefined && totalHours > 0 && (
            <div className="bg-primary-50 rounded-xl p-3">
              <div className="text-xs text-primary-600 font-medium mb-0.5">Arbeitsstunden</div>
              <div className="font-bold text-primary-900">{formatHours(totalHours)}</div>
            </div>
          )}
          {totalCost !== undefined && totalCost > 0 && (
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-xs text-green-600 font-medium mb-0.5">
                {isDaily ? 'Material + Maschinen' : 'Gesamtbetrag'}
              </div>
              <div className="font-bold text-green-900">{formatCurrency(totalCost)}</div>
            </div>
          )}
          {photoCount !== undefined && photoCount > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 font-medium mb-0.5">Fotos</div>
              <div className="font-bold text-gray-700">{photoCount}</div>
            </div>
          )}
          {positionCount !== undefined && (
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="text-xs text-orange-600 font-medium mb-0.5">Positionen</div>
              <div className="font-bold text-orange-900">{positionCount}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-6 grid grid-cols-3 gap-2">
          <Button size="lg" onClick={onOpen} className="flex-col gap-1 h-16 text-xs">
            <FileText size={18} />
            Öffnen
          </Button>
          <Button variant="outline" size="lg" onClick={onPdf} loading={loadingPdf} className="flex-col gap-1 h-16 text-xs">
            <Download size={18} />
            PDF
          </Button>
          <Button variant="secondary" size="lg" onClick={onDuplicate} className="flex-col gap-1 h-16 text-xs">
            <Copy size={18} />
            Kopieren
          </Button>
        </div>
      </div>
    </div>
  );
}
