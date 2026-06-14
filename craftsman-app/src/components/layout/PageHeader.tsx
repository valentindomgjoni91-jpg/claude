import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, backTo, action, className }: PageHeaderProps) {
  const navigate = useNavigate();
  const hasBack = !!backTo;
  const hasSubtitle = !!subtitle;

  // If no back button and no subtitle: compact action-only bar (title hidden)
  if (!hasBack && !hasSubtitle && action) {
    return (
      <div className={cn('bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center justify-end sticky top-[52px] z-20', className)}>
        <div className="flex items-center gap-2">{action}</div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center gap-2 sticky top-[52px] z-20', className)}>
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="p-1.5 -ml-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
