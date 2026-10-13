import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { formatBRL, parseBRLToCents } from '@/domain/money';
import { closeCashRegister } from '@/application/use-cases/close-cash-register';
import { renderCloseReport } from './close-report';
import { printHtml } from '@/ui/lib/print';
import type { CashCloseSummary, CashSession } from '@/domain/cash-register';

export function CloseCashModal({
  open,
  session,
  onClose,
}: {
  open: boolean;
  session: CashSession;
  onClose: () => void;
}) {
  const container = useContainer();
  const { currentUser, settings, refreshCashSession } = useSession();
  const show = useToasts((s) => s.show);
  const [counted, setCounted] = useState('');
  const [result, setResult] = useState<{ summary: CashCloseSummary; countedCents: number } | null>(
    null,
  );

  async function confirm() {
    const cents = parseBRLToCents(counted);
    if (cents == null || cents < 0) {
      show('Valor contado inválido.', 'error');
      return;
    }
    if (!currentUser) return;
    const res = await closeCashRegister(container.repos, {
      sessionId: session.id,
      userId: currentUser.id,
      countedCents: cents,
    });
    setResult({ summary: res.summary, countedCents: cents });
    await refreshCashSession(container);
  }

  async function printReport() {
    if (!result || !settings || !currentUser) return;
    await printHtml(
      renderCloseReport({
        storeName: settings.storeName,
        terminalId: settings.terminalId,
        operatorName: currentUser.name,
        session,
        summary: result.summary,
        countedCents: result.countedCents,
        width: settings.receiptWidth,
      }),
    );
  }

  function finish() {
    setResult(null);
    setCounted('');
    onClose();
  }

  const diff = result ? result.countedCents - result.summary.expectedCents : 0;

  return (
    <Modal
      open={open}
      onClose={result ? finish : onClose}
      title="Fechamento de caixa (cego)"
      size="md"
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={printReport}>
              Imprimir relatório
            </Button>
            <Button onClick={finish}>Concluir</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={confirm}>Fechar caixa</Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Informe o valor contado na gaveta. O sistema mostra a diferença após o fechamento.
          </p>
          <Input label="Valor contado (R$)" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Esperado em caixa</span>
            <span className="font-medium">{formatBRL(result.summary.expectedCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Contado</span>
            <span className="font-medium">{formatBRL(result.countedCents)}</span>
          </div>
          <div
            className={`flex justify-between text-lg font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-green-700'}`}
          >
            <span>Diferença</span>
            <span>
              {diff < 0 ? '-' : ''}
              {formatBRL(Math.abs(diff))}
            </span>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-2 text-slate-600">
            Total vendido: <b>{formatBRL(result.summary.totalSalesCents)}</b>
          </div>
        </div>
      )}
    </Modal>
  );
}
