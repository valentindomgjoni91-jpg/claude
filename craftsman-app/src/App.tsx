import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import DailyReportForm from './pages/DailyReportForm';
import RegiReportForm from './pages/RegiReportForm';
import TimeTracking from './pages/TimeTracking';
import Archive from './pages/Archive';
import MasterData from './pages/MasterData';
import { seedDefaultData } from './db';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './hooks/useTheme';

export default function App() {
  useEffect(() => {
    seedDefaultData().catch(console.error);
  }, []);

  return (
    <ThemeProvider>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<ProjectForm />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/edit" element={<ProjectForm />} />
            <Route path="tagesrapport/new" element={<DailyReportForm />} />
            <Route path="tagesrapport/:id" element={<DailyReportForm />} />
            <Route path="regierapport/new" element={<RegiReportForm />} />
            <Route path="regierapport/:id" element={<RegiReportForm />} />
            <Route path="timetracking" element={<TimeTracking />} />
            <Route path="archive" element={<Archive />} />
            <Route path="masterdata" element={<MasterData />} />
            <Route path="*" element={<div className="p-8 text-center text-gray-500 dark:text-gray-400">Seite nicht gefunden.</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
    </ThemeProvider>
  );
}
