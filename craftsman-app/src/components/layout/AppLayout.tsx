import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Clock, FileText, Settings, Wifi, WifiOff, Sun, Moon, Lock, LockOpen, X } from 'lucide-react';
import { cn } from '../../utils';
import { useAppStore } from '../../stores/useAppStore';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { useLanguage } from '../../i18n';
import { useTheme } from '../../hooks/useTheme';
import { useAdmin } from '../../context/AdminContext';

export default function AppLayout() {
  const { isOnline, syncPending, setOnline } = useAppStore();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, unlock, lock } = useAdmin();
  useSyncStatus();

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const allNavItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, adminOnly: false },
    { to: '/projects', label: t('nav.projects'), icon: FolderKanban, adminOnly: false },
    { to: '/timetracking', label: t('nav.time'), icon: Clock, adminOnly: true },
    { to: '/archive', label: t('nav.archive'), icon: FileText, adminOnly: false },
    { to: '/masterdata', label: t('nav.masterdata'), icon: Settings, adminOnly: true },
  ];

  const navItems = allNavItems.filter(item => isAdmin || !item.adminOnly);

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

  const handleUnlock = async () => {
    const ok = await unlock(pin);
    if (ok) {
      setPinOpen(false);
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleLockClick = () => {
    if (isAdmin) {
      lock();
    } else {
      setPinOpen(true);
      setPin('');
      setPinError(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 max-w-2xl mx-auto">
      {/* Top Header */}
      <header className="bg-primary-700 dark:bg-primary-900 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
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
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Dark mode umschalten"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleLockClick}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isAdmin ? 'bg-green-500/30 hover:bg-green-500/50' : 'bg-white/10 hover:bg-white/20'
            )}
            aria-label={isAdmin ? 'Admin-Modus beenden' : 'Admin-Modus entsperren'}
            title={isAdmin ? 'Admin aktiv – tippen zum Sperren' : 'Mitarbeiter-Modus – tippen zum Entsperren'}
          >
            {isAdmin ? <LockOpen size={16} /> : <Lock size={16} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex safe-area-bottom z-30">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center flex-1 py-2 gap-0.5 min-h-[56px] transition-colors',
              isActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* PIN Modal */}
      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Admin-Zugang</h2>
              <button
                onClick={() => setPinOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              PIN eingeben um Admin-Modus zu aktivieren
            </p>
            <input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              autoFocus
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500',
                pinError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              )}
            />
            {pinError && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">Falscher PIN</p>
            )}
            <button
              onClick={handleUnlock}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Entsperren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
