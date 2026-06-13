import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';

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
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          {title && <h2 className="font-semibold text-gray-900">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-gray-400 hover:bg-gray-100"
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
                'hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed',
                item.variant === 'danger' ? 'text-red-600' : 'text-gray-900'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                item.variant === 'danger' ? 'bg-red-50' : 'bg-gray-100'
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
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
