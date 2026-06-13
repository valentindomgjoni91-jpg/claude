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
  return (
    <div className={cn('bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-[52px] z-20', className)}>
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-gray-900 text-base truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
