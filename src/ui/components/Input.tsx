import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/ui/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2',
          error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-brand-400',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
});
