import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Clock, FileText, Settings, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../utils';
import { useAppStore } from '../../stores/useAppStore';
import { useEffect } from 'react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projekte', icon: FolderKanban },
  { to: '/timetracking', label: 'Zeiten', icon: Clock },
  { to: '/archive', label: 'Archiv', icon: FileText },
  { to: '/masterdata', label: 'Stammdaten', icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const { isOnline, syncPending, setOnline } = useAppStore();

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setOnline]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-2xl mx-auto">
      {/* Top Header */}
      <header className="bg-primary-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold">HR</span>
          </div>
          <span className="font-semibold text-sm">Handwerker Rapport</span>
        </div>
        <div className="flex items-center gap-2">
          {syncPending > 0 && (
            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
              {syncPending} pend.
            </span>
          )}
          {isOnline ? (
            <Wifi size={16} className="text-green-300" />
          ) : (
            <WifiOff size={16} className="text-red-300" />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-gray-200 flex safe-area-bottom z-30">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 gap-0.5 min-h-[56px] transition-colors',
                isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
