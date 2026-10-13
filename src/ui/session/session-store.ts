import { create } from 'zustand';
import type { AppContainer } from '@/composition-root';
import type { User } from '@/domain/user';
import { hashPin } from '@/domain/user';
import { makeBase } from '@/domain/types';
import type { CashSession } from '@/domain/cash-register';
import type { StoreSettings } from '@/domain/settings';
import { defaultSettings } from '@/domain/settings';

interface SessionState {
  currentUser: User | null;
  cashSession: CashSession | null;
  settings: StoreSettings | null;
  ready: boolean;
  /** Garante settings/usuário padrão e carrega sessão de caixa aberta. */
  bootstrap: (container: AppContainer) => Promise<void>;
  setUser: (user: User | null) => void;
  refreshSettings: (container: AppContainer) => Promise<void>;
  refreshCashSession: (container: AppContainer) => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  currentUser: null,
  cashSession: null,
  settings: null,
  ready: false,

  async bootstrap(container) {
    const { repos } = container;

    // Garante settings.
    let settings = await repos.settings.get();
    if (!settings) {
      settings = defaultSettings();
      await repos.settings.put(settings);
    }

    // Garante ao menos um usuário admin (fallback quando não há seed).
    const users = await repos.users.getAll();
    if (users.length === 0) {
      const admin: User = {
        ...makeBase(),
        name: 'Administrador',
        role: 'ADMIN',
        pinHash: await hashPin('1234'),
      };
      await repos.users.put(admin);
    }

    const current = get().currentUser ?? (await repos.users.getAll())[0] ?? null;
    const session = await repos.cashSessions.getOpenSession(settings.terminalId);

    set({ settings, currentUser: current, cashSession: session ?? null, ready: true });
  },

  setUser(user) {
    set({ currentUser: user });
  },

  async refreshSettings(container) {
    const settings = await container.repos.settings.get();
    set({ settings: settings ?? null });
  },

  async refreshCashSession(container) {
    const { settings } = get();
    const terminalId = settings?.terminalId ?? 'TERM-01';
    const session = await container.repos.cashSessions.getOpenSession(terminalId);
    set({ cashSession: session ?? null });
  },

  logout() {
    set({ currentUser: null });
  },
}));
