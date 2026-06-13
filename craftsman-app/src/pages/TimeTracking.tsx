import { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Trash2, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useEmployees } from '../hooks/useMasterData';
import { useProjects } from '../hooks/useProjects';
import { db } from '../db';
import { todayISO, formatHours, calcTotalHours, currentTime, cn } from '../utils';
import { v4 as uuidv4 } from 'uuid';

export default function TimeTracking() {
  const employees = useEmployees();
  const projects = useProjects();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startEpochRef = useRef<number>(0);

  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '', projectId: '', date: todayISO(),
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
        activity: selectedProject ? `Projekt: ${projects?.find(p => p.id === selectedProject)?.title || ''}` : undefined,
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
    setManualForm({ employeeId: '', projectId: '', date: todayISO(), startTime: '07:00', endTime: '17:00', breakMinutes: '30', activity: '' });
  };

  const employeeOptions = employees?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) || [];
  const projectOptions = projects?.map(p => ({ value: p.id, label: p.title })) || [];

  const todayTotal = todayEntries?.reduce((s, e) => s + e.totalHours, 0) ?? 0;
  const employeeMap = Object.fromEntries(employees?.map(e => [e.id, `${e.firstName} ${e.lastName}`]) || []);

  return (
    <div>
      <PageHeader title="Zeiterfassung" />

      <div className="px-4 py-4 space-y-4">
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

            <div className="flex gap-3">
              {!running ? (
                <Button className="flex-1 h-14" onClick={startTimer} disabled={!selectedEmployee}>
                  <Play size={20} /> Start
                </Button>
              ) : (
                <Button variant="danger" className="flex-1 h-14" onClick={stopTimer}>
                  <Square size={20} /> Stop & Speichern
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Today's total */}
        {todayTotal > 0 && (
          <div className="bg-primary-50 rounded-2xl px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2 text-primary-700">
              <Clock size={16} />
              <span className="text-sm font-medium">Total heute</span>
            </div>
            <span className="font-bold text-primary-900">{formatHours(todayTotal)}</span>
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

        <div className="h-4" />
      </div>
    </div>
  );
}
