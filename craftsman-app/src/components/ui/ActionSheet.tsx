import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';
import { useScrollLock } from '../../hooks/useScrollLock';

export interface ActionSheetItem {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}

export default function ActionSheet({ open, onClose, title, items }: ActionSheetProps) {
  useScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          {title && <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="py-2 pb-safe">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); onClose(); }}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed',
                item.variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                item.variant === 'danger' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</div>
                )}
              </div>
            </button>
          ))}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
