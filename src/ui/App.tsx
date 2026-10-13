import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { Layout } from '@/ui/Layout';
import { PosPage } from '@/ui/pos/PosPage';
import { ProductsPage } from '@/ui/products/ProductsPage';
import { StockPage } from '@/ui/stock/StockPage';
import { CashSessionPage } from '@/ui/cash/CashSessionPage';
import { LoginPage } from '@/ui/session/LoginPage';
import { Placeholder } from '@/ui/components/Placeholder';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <PosPage /> },
      { path: 'produtos', element: <ProductsPage /> },
      { path: 'estoque', element: <StockPage /> },
      { path: 'caixa', element: <CashSessionPage /> },
      { path: 'relatorios', element: <Placeholder title="Relatórios" phase="Fase 7" /> },
      { path: 'configuracoes', element: <Placeholder title="Configurações" phase="Fase 7" /> },
    ],
  },
]);

export function App() {
  const container = useContainer();
  const bootstrap = useSession((s) => s.bootstrap);
  const ready = useSession((s) => s.ready);
  const currentUser = useSession((s) => s.currentUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap(container).catch((e) =>
      setError(e instanceof Error ? e.message : 'Falha ao inicializar o banco.'),
    );
  }, [bootstrap, container]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Carregando…</div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return <RouterProvider router={router} />;
}
