import { makeBase, now } from '@/domain/types';
import type { Cents } from '@/domain/money';
import type { CashSession } from '@/domain/cash-register';
import type { AuditLog } from '@/domain/audit';
import type { Repositories } from '@/application/ports/repositories';

export class OpenCashRegisterError extends Error {}

export interface OpenCashRegisterInput {
  terminalId: string;
  userId: string;
  openingCents: Cents;
}

/** Abre uma sessão de caixa com fundo de troco. Falha se já houver uma aberta. */
export async function openCashRegister(
  repos: Repositories,
  input: OpenCashRegisterInput,
): Promise<CashSession> {
  return repos.transaction(async () => {
    const open = await repos.cashSessions.getOpenSession(input.terminalId);
    if (open) throw new OpenCashRegisterError('Já existe um caixa aberto neste terminal.');

    const session: CashSession = {
      ...makeBase(),
      terminalId: input.terminalId,
      userId: input.userId,
      openedAt: now(),
      openingCents: input.openingCents,
      closedAt: null,
      countedCents: null,
      expectedCents: null,
      differenceCents: null,
    };

    const audit: AuditLog = {
      ...makeBase(),
      action: 'CASH_OPEN',
      userId: input.userId,
      detail: `Caixa aberto com fundo de ${input.openingCents} centavos`,
      refType: 'CASH_SESSION',
      refId: session.id,
    };

    await repos.cashSessions.put(session);
    await repos.auditLogs.put(audit);
    return session;
  });
}
