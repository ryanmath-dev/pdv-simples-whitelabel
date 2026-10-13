import { makeBase } from '@/domain/types';
import type { Cents } from '@/domain/money';
import type { CashMovement, CashMovementType } from '@/domain/cash-register';
import type { AuditLog } from '@/domain/audit';
import type { Repositories } from '@/application/ports/repositories';

export class CashMovementError extends Error {}

export interface CashMovementInput {
  cashSessionId: string;
  userId: string;
  type: CashMovementType; // SUPPLY (suprimento) | WITHDRAWAL (sangria)
  amountCents: Cents;
  reason: string;
}

/** Registra um suprimento ou sangria na sessão de caixa aberta. */
export async function registerCashMovement(
  repos: Repositories,
  input: CashMovementInput,
): Promise<CashMovement> {
  if (input.amountCents <= 0) throw new CashMovementError('Valor deve ser positivo.');
  if (!input.reason.trim()) throw new CashMovementError('Motivo é obrigatório.');

  return repos.transaction(async () => {
    const session = await repos.cashSessions.get(input.cashSessionId);
    if (!session) throw new CashMovementError('Sessão de caixa não encontrada.');
    if (session.closedAt) throw new CashMovementError('Caixa está fechado.');

    const movement: CashMovement = {
      ...makeBase(),
      cashSessionId: input.cashSessionId,
      type: input.type,
      amountCents: input.amountCents,
      reason: input.reason,
      userId: input.userId,
    };

    const audit: AuditLog = {
      ...makeBase(),
      action: input.type === 'SUPPLY' ? 'CASH_SUPPLY' : 'CASH_WITHDRAWAL',
      userId: input.userId,
      detail: `${input.type === 'SUPPLY' ? 'Suprimento' : 'Sangria'} de ${input.amountCents} centavos: ${input.reason}`,
      refType: 'CASH_MOVEMENT',
      refId: movement.id,
    };

    await repos.cashMovements.put(movement);
    await repos.auditLogs.put(audit);
    return movement;
  });
}
