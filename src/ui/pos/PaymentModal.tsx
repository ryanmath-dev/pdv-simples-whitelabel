import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { formatBRL, parseBRLToCents, type Cents } from '@/domain/money';
import { computePaymentBalance, type PaymentMethod } from '@/domain/sale';
import type { DraftPayment } from '@/application/use-cases/finalize-sale';
import { cn } from '@/ui/lib/cn';

const METHODS: { method: PaymentMethod; label: string; key: string }[] = [
  { method: 'CASH', label: 'Dinheiro', key: '1' },
  { method: 'PIX', label: 'PIX', key: '2' },
  { method: 'DEBIT', label: 'Débito', key: '3' },
  { method: 'CREDIT', label: 'Crédito', key: '4' },
];

const QUICK_BILLS: Cents[] = [200, 500, 1000, 2000, 5000, 10000, 20000];

export interface PaymentModalProps {
  open: boolean;
  totalCents: Cents;
  onCancel: () => void;
  onConfirm: (payments: DraftPayment[], changeCents: Cents) => void;
}

export function PaymentModal({ open, totalCents, onCancel, onConfirm }: PaymentModalProps) {
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amountInput, setAmountInput] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  const balance = useMemo(
    () =>
      computePaymentBalance(
        totalCents,
        payments.map((p) => ({
          method: p.method,
          amountCents: p.amountCents,
          receivedCents: p.receivedCents ?? null,
        })),
      ),
    [totalCents, payments],
  );

  // Reset ao abrir.
  useEffect(() => {
    if (open) {
      setPayments([]);
      setMethod('CASH');
      setAmountInput('');
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [open]);

  const remaining = balance.remainingCents;
  const settledNow = remaining === 0 && payments.length > 0;

  // F10 confirma quando a venda está quitada.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        if (settledNow) onConfirm(payments, balance.changeCents);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, settledNow, payments, balance.changeCents, onConfirm]);

  function addPayment(explicitAmount?: Cents, received?: Cents) {
    const amount = explicitAmount ?? parseBRLToCents(amountInput) ?? remaining;
    if (amount <= 0) return;
    const capped = method === 'CASH' ? amount : Math.min(amount, remaining);
    const draft: DraftPayment = {
      method,
      amountCents: method === 'CASH' ? Math.min(capped, remaining) : capped,
      receivedCents: method === 'CASH' ? (received ?? capped) : null,
    };
    setPayments((prev) => [...prev, draft]);
    setAmountInput('');
    amountRef.current?.focus();
  }

  function quickCash(bill: Cents) {
    // Paga o restante em dinheiro, registrando o valor recebido (troco).
    setPayments((prev) => [
      ...prev,
      { method: 'CASH', amountCents: remaining, receivedCents: bill },
    ]);
  }

  function exactCash() {
    setPayments((prev) => [
      ...prev,
      { method: 'CASH', amountCents: remaining, receivedCents: remaining },
    ]);
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  const settled = remaining === 0 && payments.length > 0;

  function handleConfirm() {
    if (!settled) return;
    onConfirm(payments, balance.changeCents);
  }

  function onAmountKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (parseBRLToCents(amountInput) || remaining > 0) addPayment();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Pagamento"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar (Esc)
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!settled}>
            Confirmar (F10)
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-3 rounded-lg bg-slate-100 p-3">
            <div className="flex justify-between text-slate-600">
              <span>Total</span>
              <span className="font-semibold">{formatBRL(totalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pago</span>
              <span>{formatBRL(balance.paidCents)}</span>
            </div>
            <div
              className={cn(
                'mt-1 flex justify-between text-lg font-bold',
                remaining > 0 ? 'text-red-600' : 'text-green-700',
              )}
            >
              <span>{remaining > 0 ? 'Falta' : 'Troco'}</span>
              <span>{formatBRL(remaining > 0 ? remaining : balance.changeCents)}</span>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.method}
                onClick={() => setMethod(m.method)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium',
                  method === m.method
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              ref={amountRef}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={onAmountKeyDown}
              placeholder={`Valor (${formatBRL(remaining)})`}
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <Button variant="secondary" onClick={() => addPayment()}>
              Adicionar
            </Button>
          </div>

          {method === 'CASH' && (
            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-500">Cédulas rápidas (dinheiro)</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={exactCash}>
                  Valor exato
                </Button>
                {QUICK_BILLS.filter((b) => b >= remaining).slice(0, 5).map((bill) => (
                  <Button
                    key={bill}
                    size="sm"
                    variant="secondary"
                    onClick={() => quickCash(bill)}
                  >
                    {formatBRL(bill)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Pagamentos</div>
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-400">
              Nenhum pagamento adicionado
            </div>
          ) : (
            <ul className="space-y-2">
              {payments.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="text-slate-700">
                    {METHODS.find((m) => m.method === p.method)?.label ?? p.method}
                    {p.method === 'CASH' && p.receivedCents != null && (
                      <span className="text-slate-400"> (recebido {formatBRL(p.receivedCents)})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{formatBRL(p.amountCents)}</span>
                    <button
                      onClick={() => removePayment(i)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Remover pagamento"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
