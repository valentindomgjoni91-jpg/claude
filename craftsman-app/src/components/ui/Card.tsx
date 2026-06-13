import { type HTMLAttributes } from 'react';
import { cn } from '../../utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md';
}

export function Card({ className, padding = 'md', children, ...props }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-4' };
  return (
    <div
      className={cn('bg-white rounded-2xl shadow-sm border border-gray-100', paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-semibold text-gray-900 text-base', className)} {...props}>
      {children}
    </h3>
  );
}
