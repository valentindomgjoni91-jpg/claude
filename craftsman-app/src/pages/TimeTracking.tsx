import { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Trash2, Clock, BarChart2, ChevronLeft, ChevronRight, Briefcase, Download, FileText } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { useEmployees, useCompany } from '../hooks/useMasterData';
import { useProjects } from '../hooks/useProjects';
import { db } from '../db';
import { todayISO, formatHours, calcTotalHours, currentTime, formatDate, cn } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { generateTimesheetPdf } from '../pdf/timesheetPdf';
import type { TimesheetEntry } from '../pdf/timesheetPdf';
import { useLanguage } from '../i18n';

const DAILY_TARGET_HOURS = 8.5;

export default function TimeTracking() {
  const [activeTab, setActiveTab] = useState('timer');
  const { t } = useLanguage();
  const tabs = [
    { id: 'timer', label: 'Stoppuhr', icon: <Clock size={14} /> },
    { id: 'week', label: 'Woche', icon: <BarChart2 size={14} /> },
    { id: 'projects', label: 'Projekte', icon: <Briefcase size={14} /> },
    { id: 'timesheet', label: 'Stundenzettel', icon: <FileText size={14} /> },
  ];

  return (
    <div>
      <PageHeader title={t('page.time_tracking')} />
      <div className="px-4 py-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>
      <div className="px-4 pb-8">
        {activeTab === 'timer' && <TimerTab />}
        {activeTab === 'week' && <WeekTab />}
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'timesheet' && <TimesheetTab />}
      </div>
    </div>
  );
}

// ---- Timer Tab ----

function TimerTab() {
  const employees = useEmployees();
  const projects = useProjects();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startEpochRef = useRef<number>(0);

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '', date: todayISO(),
    startTime: '07:00', endTime: '17:00', breakMinutes: '30', activity: '',
  });

  const todayEntries = useLiveQuery(
    () => db.timeEntries.where('date').equals(todayISO()).toArray(),
    []
  );

  const startTimer = () => {
    if (!selectedEmployee) return;
    const now = currentTime();
    setStartTime(now);
    startEpochRef.current = Date.now();
    setRunning(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startEpochRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    const endT = currentTime();
    const totalHours = calcTotalHours(startTime, endT, 0);
    if (totalHours > 0 && selectedEmployee) {
      const projectTitle = projects?.find(p => p.id === selectedProject)?.title;
      await db.timeEntries.add({
        id: uuidv4(),
        reportId: `timer-${Date.now()}`,
        reportType: 'daily',
        employeeId: selectedEmployee,
        date: todayISO(),
        startTime,
        endTime: endT,
        breakMinutes: 0,
        totalHours,
        activity: projectTitle ? `Projekt: ${projectTitle}` : undefined,
      });
    }
    setElapsed(0);
    setStartTime('');
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleManualAdd = async () => {
    if (!manualForm.employeeId) return;
    const totalHours = calcTotalHours(manualForm.startTime, manualForm.endTime, Number(manualForm.breakMinutes));
    await db.timeEntries.add({
      id: uuidv4(),
      reportId: `manual-${Date.now()}`,
      reportType: 'daily',
      employeeId: manualForm.employeeId,
      date: manualForm.date,
      startTime: manualForm.startTime,
      endTime: manualForm.endTime,
      breakMinutes: Number(manualForm.breakMinutes),
      totalHours,
      activity: manualForm.activity || undefined,
    });
    setShowManual(false);
    setManualForm({ employeeId: '', date: todayISO(), startTime: '07:00', endTime: '17:00', breakMinutes: '30', activity: '' });
  };

  const employeeOptions = employees?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) || [];
  const projectOptions = projects?.map(p => ({ value: p.id, label: p.title })) || [];
  const todayTotal = todayEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
  const employeeMap = Object.fromEntries(employees?.map(e => [e.id, `${e.firstName} ${e.lastName}`]) || []);

  return (
    <div className="space-y-4">
      {/* Timer */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Stoppuhr</h3>
        <div className="space-y-3">
          <Select
            label="Mitarbeiter"
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            options={employeeOptions}
            placeholder="Mitarbeiter wählen"
          />
          <Select
            label="Projekt (optional)"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            options={projectOptions}
            placeholder="Projekt wählen"
          />

          <div className="text-center py-4">
            <div className={cn(
              'text-5xl font-mono font-bold tabular-nums transition-colors',
              running ? 'text-primary-600' : 'text-gray-300'
            )}>
              {formatElapsed(elapsed)}
            </div>
            {running && (
              <div className="text-sm text-gray-500 mt-1">Gestartet: {startTime}</div>
            )}
          </div>

          {!running ? (
            <Button className="w-full h-14" onClick={startTimer} disabled={!selectedEmployee}>
              <Play size={20} /> Start
            </Button>
          ) : (
            <Button variant="danger" className="w-full h-14" onClick={stopTimer}>
              <Square size={20} /> Stop & Speichern
            </Button>
          )}
        </div>
      </Card>

      {/* Today's summary */}
      {todayTotal > 0 && (
        <div className="bg-primary-50 rounded-2xl px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-primary-700">
              <Clock size={16} />
              <span className="text-sm font-medium">Total heute</span>
            </div>
            <span className="font-bold text-primary-900">{formatHours(todayTotal)}</span>
          </div>
          <div className="w-full bg-primary-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (todayTotal / DAILY_TARGET_HOURS) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-primary-600 mt-1">
            Soll: {formatHours(DAILY_TARGET_HOURS)} · {todayTotal >= DAILY_TARGET_HOURS ? '✓ Erreicht' : `Noch ${formatHours(Math.max(0, DAILY_TARGET_HOURS - todayTotal))}`}
          </div>
        </div>
      )}

      {/* Today's entries */}
      {(todayEntries?.length ?? 0) > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">Heutige Einträge</h3>
          </div>
          {todayEntries?.map(entry => (
            <div key={entry.id} className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{employeeMap[entry.employeeId] || entry.employeeId}</div>
                <div className="text-xs text-gray-500">{entry.startTime} – {entry.endTime} · Pause: {entry.breakMinutes} min</div>
                {entry.activity && <div className="text-xs text-gray-400">{entry.activity}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-primary-700">{formatHours(entry.totalHours)}</span>
                <button onClick={() => db.timeEntries.delete(entry.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Manual entry */}
      {showManual ? (
        <Card>
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Manuelle Erfassung</h3>
          <div className="space-y-3">
            <Select label="Mitarbeiter" value={manualForm.employeeId} onChange={e => setManualForm(f => ({ ...f, employeeId: e.target.value }))} options={employeeOptions} placeholder="Wählen…" />
            <Input label="Datum" type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Von" type="time" value={manualForm.startTime} onChange={e => setManualForm(f => ({ ...f, startTime: e.target.value }))} />
              <Input label="Bis" type="time" value={manualForm.endTime} onChange={e => setManualForm(f => ({ ...f, endTime: e.target.value }))} />
              <Input label="Pause" type="number" value={manualForm.breakMinutes} onChange={e => setManualForm(f => ({ ...f, breakMinutes: e.target.value }))} />
            </div>
            <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
              Total: <strong>{formatHours(calcTotalHours(manualForm.startTime, manualForm.endTime, Number(manualForm.breakMinutes)))}</strong>
            </div>
            <Input label="Tätigkeit" value={manualForm.activity} onChange={e => setManualForm(f => ({ ...f, activity: e.target.value }))} placeholder="z.B. Mauerwerk" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleManualAdd} className="flex-1">Speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowManual(false)}>Abbrechen</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setShowManual(true)}>
          <Plus size={16} /> Manuell erfassen
        </Button>
      )}
    </div>
  );
}

// ---- Week Tab ----

function WeekTab() {
  const employees = useEmployees();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const refDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekEntries = useLiveQuery(async () => {
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    return db.timeEntries
      .where('date').between(from, to, true, true)
      .toArray();
  }, [weekOffset]);

  const employeeOptions = employees?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) || [];
  const employeeMap = Object.fromEntries(employees?.map(e => [e.id, `${e.firstName} ${e.lastName}`]) || []);

  const filteredEntries = weekEntries?.filter(e =>
    !selectedEmployee || e.employeeId === selectedEmployee
  ) || [];

  const weekTotal = filteredEntries.reduce((s, e) => s + e.totalHours, 0);
  const weekTarget = 5 * DAILY_TARGET_HOURS;
  const weekDiff = weekTotal - weekTarget;

  const entriesByDay = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayEntries = filteredEntries.filter(e => e.date === dayStr);
    const dayTotal = dayEntries.reduce((s, e) => s + e.totalHours, 0);
    return { day, dayStr, dayEntries, dayTotal };
  });

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-2 rounded-xl hover:bg-gray-100"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold text-gray-900 text-sm">
            {isCurrentWeek ? 'Diese Woche' : format(weekStart, "'KW' w", { locale: de })}
          </div>
          <div className="text-xs text-gray-500">
            {format(weekStart, 'dd.MM', { locale: de })} – {format(weekEnd, 'dd.MM.yyyy', { locale: de })}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
          disabled={weekOffset === 0}
          className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Employee filter */}
      <Select
        label="Mitarbeiter"
        value={selectedEmployee}
        onChange={e => setSelectedEmployee(e.target.value)}
        options={employeeOptions}
        placeholder="Alle Mitarbeiter"
      />

      {/* Wochentotal + Soll/Ist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-sm text-gray-500">Ist / Soll</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatHours(weekTotal)}
              <span className="text-sm text-gray-400 font-normal"> / {formatHours(weekTarget)}</span>
            </div>
          </div>
          <div className={cn(
            'text-sm font-bold px-3 py-1 rounded-full',
            weekDiff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {weekDiff >= 0 ? '+' : ''}{formatHours(Math.abs(weekDiff))}
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', weekTotal >= weekTarget ? 'bg-green-500' : 'bg-primary-500')}
            style={{ width: `${Math.min(100, (weekTotal / weekTarget) * 100)}%` }}
          />
        </div>
      </div>

      {/* Daily bars */}
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Tagesübersicht</h3>
        <div className="space-y-2">
          {entriesByDay.map(({ day, dayStr, dayTotal }) => {
            const isToday = dayStr === todayISO();
            const pct = Math.min(100, (dayTotal / DAILY_TARGET_HOURS) * 100);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={dayStr} className={cn('flex items-center gap-3', isWeekend && 'opacity-50')}>
                <div className={cn('w-8 text-right text-xs font-medium flex-shrink-0', isToday ? 'text-primary-600' : 'text-gray-500')}>
                  {format(day, 'EE', { locale: de })}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-5 relative overflow-hidden">
                    <div
                      className={cn(
                        'h-5 rounded-full transition-all flex items-center justify-end pr-2',
                        dayTotal >= DAILY_TARGET_HOURS ? 'bg-green-400' : dayTotal > 0 ? 'bg-primary-400' : 'bg-transparent'
                      )}
                      style={{ width: `${pct}%`, minWidth: dayTotal > 0 ? '2rem' : '0' }}
                    />
                    {isToday && (
                      <div className="absolute inset-0 border-2 border-primary-400 rounded-full pointer-events-none" />
                    )}
                  </div>
                </div>
                <div className={cn('w-12 text-right text-xs font-bold flex-shrink-0', dayTotal > 0 ? 'text-gray-900' : 'text-gray-300')}>
                  {dayTotal > 0 ? formatHours(dayTotal) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Entry list */}
      {filteredEntries.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">Alle Einträge</h3>
          </div>
          {entriesByDay.map(({ dayStr, dayEntries, dayTotal }) => {
            if (dayEntries.length === 0) return null;
            return (
              <div key={dayStr}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between">
                  <span className="text-xs font-semibold text-gray-600">{formatDate(dayStr)}</span>
                  <span className="text-xs font-bold text-gray-700">{formatHours(dayTotal)}</span>
                </div>
                {dayEntries.map(entry => (
                  <div key={entry.id} className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{employeeMap[entry.employeeId] || '—'}</div>
                      <div className="text-xs text-gray-500">{entry.startTime} – {entry.endTime}</div>
                      {entry.activity && <div className="text-xs text-gray-400">{entry.activity}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-primary-700">{formatHours(entry.totalHours)}</span>
                      <button onClick={() => db.timeEntries.delete(entry.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      )}

      {filteredEntries.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Keine Zeiteinträge für diese Woche.
        </div>
      )}
    </div>
  );
}

// ---- Projects Tab ----

function ProjectsTab() {
  const projects = useProjects();

  const data = useLiveQuery(async () => {
    const [allEntries, dailyReports, regiReports] = await Promise.all([
      db.timeEntries.toArray(),
      db.dailyReports.toArray(),
      db.regiReports.toArray(),
    ]);

    const reportProjectMap: Record<string, string> = {};
    for (const r of dailyReports) reportProjectMap[r.id] = r.projectId;
    for (const r of regiReports) reportProjectMap[r.id] = r.projectId;

    const grouped: Record<string, number> = {};
    let unlinked = 0;

    for (const entry of allEntries) {
      const projectId = reportProjectMap[entry.reportId];
      if (projectId) {
        grouped[projectId] = (grouped[projectId] || 0) + entry.totalHours;
      } else {
        unlinked += entry.totalHours;
      }
    }

    return { grouped, unlinked };
  }, []);

  const projectMap = Object.fromEntries(projects?.map(p => [p.id, p]) || []);

  const rows = Object.entries(data?.grouped || {})
    .map(([projectId, hours]) => ({ project: projectMap[projectId], hours }))
    .filter(r => !!r.project)
    .sort((a, b) => b.hours - a.hours);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0) + (data?.unlinked ?? 0);

  return (
    <div className="space-y-3">
      <div className="bg-primary-50 rounded-2xl px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-primary-700">Total erfasst</span>
        <span className="text-xl font-bold text-primary-900">{formatHours(totalHours)}</span>
      </div>

      {rows.map(({ project, hours }) => (
        <div key={project.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-medium text-sm text-gray-900">{project.title}</div>
              <div className="text-xs text-gray-500">{project.clientName}</div>
            </div>
            <span className="font-bold text-primary-700">{formatHours(hours)}</span>
          </div>
          {totalHours > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(hours / totalHours) * 100}%` }}
              />
            </div>
          )}
        </div>
      ))}

      {(data?.unlinked ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 opacity-60">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">Ohne Projekt (Stoppuhr / manuell)</div>
            <span className="font-bold text-gray-500">{formatHours(data!.unlinked)}</span>
          </div>
        </div>
      )}

      {rows.length === 0 && totalHours === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Noch keine Zeiteinträge in Rapporte erfasst.
        </div>
      )}
    </div>
  );
}

// ---- Stundenzettel Tab ----

function TimesheetTab() {
  const employees = useEmployees();
  const company = useCompany();
  const [selectedEmp, setSelectedEmp] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const employeeOptions = (employees || []).map(e => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  const preview = useLiveQuery(async () => {
    if (!selectedEmp || !month) return null;
    const monthStart = startOfMonth(new Date(`${month}-01`)).toISOString().split('T')[0];
    const monthEnd = endOfMonth(new Date(`${month}-01`)).toISOString().split('T')[0];

    const allReports = await db.dailyReports.where('date').between(monthStart, monthEnd, true, true).toArray();
    const reportIds = allReports.map(r => r.id);
    if (reportIds.length === 0) return { entries: [], totalHours: 0 };

    const timeEntries = await db.timeEntries
      .where('reportId').anyOf(reportIds)
      .filter(e => e.employeeId === selectedEmp)
      .toArray();

    const projects = await db.projects.toArray();
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const reportMap = Object.fromEntries(allReports.map(r => [r.id, r]));

    const entries: TimesheetEntry[] = timeEntries
      .sort((a, b) => (reportMap[a.reportId]?.date ?? '').localeCompare(reportMap[b.reportId]?.date ?? ''))
      .map(e => {
        const report = reportMap[e.reportId];
        const project = report ? projMap[report.projectId] : undefined;
        return {
          date: report?.date ?? e.date,
          reportTitle: report?.title ?? '–',
          projectTitle: project?.title ?? 'Ohne Projekt',
          startTime: e.startTime,
          endTime: e.endTime,
          breakMinutes: e.breakMinutes,
          totalHours: e.totalHours,
          activity: e.activity,
        };
      });

    return { entries, totalHours: entries.reduce((s, e) => s + e.totalHours, 0) };
  }, [selectedEmp, month]);

  const handleGenerate = async () => {
    if (!selectedEmp || !month) return;
    const employee = employees?.find(e => e.id === selectedEmp);
    if (!employee || !preview) return;
    setGenerating(true);
    try {
      const pdf = generateTimesheetPdf({
        employee,
        month,
        entries: preview.entries,
        company: company || null,
      });
      const [year, m] = month.split('-');
      pdf.save(`Stundenzettel_${employee.lastName}_${year}-${m}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Stundenzettel erstellen</h3>
        <Select
          label="Mitarbeiter"
          options={employeeOptions}
          value={selectedEmp}
          onChange={e => setSelectedEmp(e.target.value)}
          placeholder="Mitarbeiter wählen…"
        />
        <Input
          label="Monat"
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      {preview && selectedEmp && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {preview.entries.length} Einträge
              </div>
              <div className="text-xs text-gray-500">
                Total: {formatHours(preview.totalHours)}
              </div>
            </div>
            <Button onClick={handleGenerate} loading={generating} disabled={preview.entries.length === 0}>
              <Download size={16} /> PDF erstellen
            </Button>
          </div>

          {preview.entries.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {preview.entries.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900">{formatDate(e.date)}</div>
                    <div className="text-xs text-gray-400 truncate">{e.projectTitle}</div>
                  </div>
                  <div className="text-xs font-semibold text-gray-700 ml-2">{formatHours(e.totalHours)}</div>
                </div>
              ))}
            </div>
          )}

          {preview.entries.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              Keine Einträge für diesen Monat und Mitarbeiter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
