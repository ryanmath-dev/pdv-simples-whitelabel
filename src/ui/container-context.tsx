/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { AppContainer } from '@/composition-root';

const ContainerContext = createContext<AppContainer | null>(null);

export function ContainerProvider({
  container,
  children,
}: {
  container: AppContainer;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): AppContainer {
  const ctx = useContext(ContainerContext);
  if (!ctx) throw new Error('useContainer deve ser usado dentro de ContainerProvider');
  return ctx;
}

export function useRepos() {
  return useContainer().repos;
}

export function useDb() {
  return useContainer().db;
}

export function useEvents() {
  return useContainer().events;
}
