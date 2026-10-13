import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/ui/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, ...props },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2',
          error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-brand-400',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
});
