import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export default function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-slide-up">
      <RefreshCw size={18} className="shrink-0 text-primary-400" />
      <span className="flex-1 text-sm">Neue Version verfügbar</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors"
      >
        Aktualisieren
      </button>
    </div>
  );
}
