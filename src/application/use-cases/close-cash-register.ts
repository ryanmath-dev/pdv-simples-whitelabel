import { makeBase, now } from '@/domain/types';
import type { Cents } from '@/domain/money';
import {
  cashDifference,
  computeCloseSummary,
  type CashCloseSummary,
  type CashSession,
} from '@/domain/cash-register';
import type { AuditLog } from '@/domain/audit';
import type { Repositories } from '@/application/ports/repositories';

export class CloseCashRegisterError extends Error {}

export interface CloseCashRegisterInput {
  sessionId: string;
  userId: string;
  /** Valor contado na gaveta (fechamento cego). */
  countedCents: Cents;
}

export interface CloseCashRegisterResult {
  session: CashSession;
  summary: CashCloseSummary;
}

/**
 * Fecha a sessão de caixa: calcula o esperado a partir das vendas e movimentos
 * de gaveta, compara com o contado e registra a diferença.
 */
export async function closeCashRegister(
  repos: Repositories,
  input: CloseCashRegisterInput,
): Promise<CloseCashRegisterResult> {
  return repos.transaction(async () => {
    const session = await repos.cashSessions.get(input.sessionId);
    if (!session) throw new CloseCashRegisterError('Sessão de caixa não encontrada.');
    if (session.closedAt) throw new CloseCashRegisterError('Caixa já está fechado.');

    const sales = await repos.sales.listBySession(session.id);
    const finalized = sales.filter((s) => s.status === 'FINALIZED');
    const payments = await repos.payments.listBySaleIds(finalized.map((s) => s.id));
    const movements = await repos.cashMovements.listBySession(session.id);

    const summary = computeCloseSummary({
      openingCents: session.openingCents,
      payments: payments.map((p) => ({ method: p.method, amountCents: p.amountCents })),
      movements: movements.map((m) => ({ type: m.type, amountCents: m.amountCents })),
    });

    const difference = cashDifference(input.countedCents, summary.expectedCents);

    const closed: CashSession = {
      ...session,
      closedAt: now(),
      countedCents: input.countedCents,
      expectedCents: summary.expectedCents,
      differenceCents: difference,
      updatedAt: now(),
      version: session.version + 1,
    };

    const audit: AuditLog = {
      ...makeBase(),
      action: 'CASH_CLOSE',
      userId: input.userId,
      detail: `Caixa fechado. Esperado ${summary.expectedCents}, contado ${input.countedCents}, diferença ${difference}`,
      refType: 'CASH_SESSION',
      refId: session.id,
    };

    await repos.cashSessions.put(closed);
    await repos.auditLogs.put(audit);
    return { session: closed, summary };
  });
}
