import { useToasts } from './toast-store';
import { cn } from '@/ui/lib/cn';

/** Renderiza os toasts globais no canto inferior direito. */
export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto cursor-pointer rounded-lg px-4 py-2 text-sm font-medium shadow-lg',
            t.tone === 'error' && 'bg-red-600 text-white',
            t.tone === 'success' && 'bg-green-600 text-white',
            t.tone === 'info' && 'bg-slate-800 text-white',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
