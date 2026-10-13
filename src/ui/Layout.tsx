import { NavLink, Outlet } from 'react-router-dom';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ToastHost } from '@/ui/components/ToastHost';
import { useSession } from '@/ui/session/session-store';
import { cn } from '@/ui/lib/cn';

const NAV = [
  { to: '/', label: 'Caixa', end: true },
  { to: '/produtos', label: 'Produtos' },
  { to: '/estoque', label: 'Estoque' },
  { to: '/caixa', label: 'Sessão' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/configuracoes', label: 'Config' },
];

export function Layout() {
  const { currentUser, settings, cashSession } = useSession();

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex items-center justify-between bg-brand-800 px-4 py-2 text-white">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold">{settings?.storeName ?? 'PDV Mercadinho'}</span>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-white/20' : 'hover:bg-white/10',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <StatusBadge />
          <span className={cn('rounded-full px-2 py-0.5', cashSession ? 'bg-green-600' : 'bg-slate-600')}>
            {cashSession ? 'Caixa aberto' : 'Caixa fechado'}
          </span>
          <span className="opacity-80">{currentUser?.name}</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}
