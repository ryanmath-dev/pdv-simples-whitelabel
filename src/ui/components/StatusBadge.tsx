import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/ui/lib/cn';
import { useDb } from '@/ui/container-context';

/** Indicador de conexão + pendências de sincronização no cabeçalho. */
export function StatusBadge() {
  const db = useDb();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const pending = useLiveQuery(() => db.outbox.count(), [db], 0) ?? 0;

  const label = !online ? 'Offline' : pending > 0 ? `${pending} pendentes` : 'Online';
  const tone = !online ? 'bg-slate-500' : pending > 0 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
      <span className={cn('h-2.5 w-2.5 rounded-full', tone)} />
      {label}
    </span>
  );
}
