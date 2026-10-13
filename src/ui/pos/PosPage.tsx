import { useCallback, useEffect, useRef, useState } from 'react';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { usePos, cartItemTotal, type CartItem } from './pos-store';
import { resolveScan } from './resolve-scan';
import { buildReceiptData } from './build-receipt';
import { finalizeSale, type DraftPayment } from '@/application/use-cases/finalize-sale';
import { formatBRL, parseBRLToCents, type Cents } from '@/domain/money';
import { formatQuantity, parseQuantity } from '@/domain/quantity';
import type { Product } from '@/domain/product';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Modal';
import { PinPrompt } from '@/ui/components/PinPrompt';
import { PaymentModal } from './PaymentModal';
import { ProductSearchModal } from './ProductSearchModal';
import { OpenCashModal } from './OpenCashModal';
import { cn } from '@/ui/lib/cn';

type ModalKind =
  | 'none'
  | 'search'
  | 'payment'
  | 'quantity'
  | 'discount'
  | 'help'
  | 'held'
  | 'pinCancel'
  | 'pinDiscount'
  | 'openCash';

interface Toast {
  text: string;
  tone: 'info' | 'error' | 'success';
}

export function PosPage() {
  const container = useContainer();
  const { repos, printer, fiscal } = container;
  const { currentUser, settings, cashSession } = useSession();
  const pos = usePos();

  const [code, setCode] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>('none');
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingKg, setPendingKg] = useState<{ product: Product } | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [discInput, setDiscInput] = useState('');
  const [discTarget, setDiscTarget] = useState<'item' | 'sale'>('sale');
  const codeRef = useRef<HTMLInputElement>(null);

  const totals = pos.totals();
  const focusCode = useCallback(() => setTimeout(() => codeRef.current?.focus(), 30), []);

  const showToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Verifica estoque e adiciona o produto ao carrinho.
  const addResolved = useCallback(
    async (product: Product, quantityMilli: number, priceOverride?: Cents) => {
      if (!settings) return;
      const balance = await repos.stockBalances.get(product.id);
      const current = balance?.quantity ?? 0;
      if (current - quantityMilli < 0) {
        if (!settings.allowNegativeStock) {
          showToast(`Estoque insuficiente de ${product.name}.`, 'error');
          return;
        }
        showToast(`Atenção: estoque de ${product.name} ficará negativo.`, 'info');
      }
      pos.addProduct(product, quantityMilli, priceOverride);
    },
    [repos, settings, pos, showToast],
  );

  const handleCodeEnter = useCallback(async () => {
    if (!settings) return;
    const raw = code;
    setCode('');
    const res = await resolveScan(repos.products, settings, raw);
    if ('kind' in res) {
      if (res.kind === 'NOT_FOUND') showToast(`Produto não encontrado: ${res.code}`, 'error');
      else if (res.kind === 'INVALID') showToast('Entrada inválida.', 'error');
      return;
    }
    // Produto por peso sem peso embutido: pedir quantidade.
    if (res.product.unit === 'KG' && res.priceOverrideCents == null && res.quantityMilli === 1000) {
      setPendingKg({ product: res.product });
      setQtyInput('');
      setModal('quantity');
      return;
    }
    await addResolved(res.product, res.quantityMilli, res.priceOverrideCents);
  }, [code, repos, settings, addResolved, showToast]);

  const pickFromSearch = useCallback(
    async (product: Product) => {
      setModal('none');
      if (product.unit === 'KG') {
        setPendingKg({ product });
        setQtyInput('');
        setModal('quantity');
      } else {
        await addResolved(product, 1000);
        focusCode();
      }
    },
    [addResolved, focusCode],
  );

  // ---- Finalização ----
  const doFinalize = useCallback(
    async (payments: DraftPayment[]) => {
      if (!currentUser || !settings || !cashSession) return;
      try {
        const result = await finalizeSale(
          { repos, events: container.events },
          {
            terminalId: settings.terminalId,
            cashSessionId: cashSession.id,
            userId: currentUser.id,
            items: pos.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              unit: i.unit,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              discountCents: i.discountCents,
            })),
            saleDiscountCents: pos.saleDiscountCents,
            payments,
          },
        );

        const [items, pays, extras] = await Promise.all([
          repos.saleItems.listBySale(result.sale.id),
          repos.payments.listBySale(result.sale.id),
          fiscal.receiptExtras(result.sale.id),
        ]);
        // Recarrega a venda (status fiscal pode ter mudado pelo handler).
        const finalSale = (await repos.sales.get(result.sale.id)) ?? result.sale;

        await printer.print(
          buildReceiptData({
            sale: finalSale,
            items,
            payments: pays,
            settings,
            operatorName: currentUser.name,
            fiscal: extras,
          }),
        );

        pos.clear();
        setModal('none');
        showToast(
          result.sale.changeCents > 0
            ? `Venda finalizada. Troco: ${formatBRL(result.sale.changeCents)}`
            : 'Venda finalizada.',
          'success',
        );
        focusCode();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Falha ao finalizar.', 'error');
      }
    },
    [currentUser, settings, cashSession, repos, container.events, pos, printer, fiscal, showToast, focusCode],
  );

  const openPayment = useCallback(() => {
    if (pos.items.length === 0) {
      showToast('Adicione itens antes de finalizar.', 'error');
      return;
    }
    setModal('payment');
  }, [pos.items.length, showToast]);

  // ---- Cancelar item (F4) ----
  const requestCancelItem = useCallback(() => {
    if (!selectedLine) {
      showToast('Selecione um item para cancelar.', 'info');
      return;
    }
    if (settings?.requireManagerPinForCancel) {
      setModal('pinCancel');
    } else {
      pos.removeItem(selectedLine);
      setSelectedLine(null);
    }
  }, [selectedLine, settings, pos, showToast]);

  // ---- Atalhos de teclado ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc fecha modais; se nenhum, foca o campo de código.
      if (e.key === 'Escape') {
        if (modal !== 'none') return; // modais tratam o próprio Esc
        setCode('');
        focusCode();
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setModal((m) => (m === 'help' ? 'none' : 'help'));
      } else if (e.key === 'F2') {
        e.preventDefault();
        setModal('search');
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (selectedLine) {
          setQtyInput('');
          setModal('quantity');
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        requestCancelItem();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setDiscTarget(selectedLine ? 'item' : 'sale');
        setDiscInput('');
        setModal('discount');
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (pos.items.length > 0) {
          pos.holdCurrent();
          showToast('Venda suspensa.', 'info');
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (modal === 'none') openPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, selectedLine, pos, requestCancelItem, openPayment, showToast, focusCode]);

  // ---- Aplicar quantidade (F3 ou KG pendente) ----
  function applyQuantity() {
    const unit = pendingKg ? 'KG' : selectedLine
      ? pos.items.find((i) => i.lineId === selectedLine)?.unit ?? 'UN'
      : 'UN';
    const milli = parseQuantity(qtyInput, unit);
    if (milli == null) {
      showToast('Quantidade inválida.', 'error');
      return;
    }
    if (pendingKg) {
      void addResolved(pendingKg.product, milli);
      setPendingKg(null);
    } else if (selectedLine) {
      pos.updateQuantity(selectedLine, milli);
    }
    setModal('none');
    focusCode();
  }

  // ---- Aplicar desconto (F6) ----
  function applyDiscount(authorized = false) {
    const cents = parseBRLToCents(discInput);
    if (cents == null || cents < 0) {
      showToast('Desconto inválido.', 'error');
      return;
    }
    const limit = settings?.operatorDiscountLimitPercent ?? 100;

    if (discTarget === 'item' && selectedLine) {
      const item = pos.items.find((i) => i.lineId === selectedLine);
      if (!item) return;
      const gross = item.unitPriceCents * (item.quantity / 1000);
      const pct = gross > 0 ? (cents / gross) * 100 : 0;
      if (pct > limit && !authorized) {
        setModal('pinDiscount');
        return;
      }
      pos.setItemDiscount(selectedLine, cents);
    } else {
      const pct = totals.subtotalCents > 0 ? (cents / totals.subtotalCents) * 100 : 0;
      if (pct > limit && !authorized) {
        setModal('pinDiscount');
        return;
      }
      pos.setSaleDiscount(cents);
    }
    setModal('none');
    focusCode();
  }

  useEffect(() => {
    focusCode();
  }, [focusCode]);

  // ---- Guarda: sem caixa aberto ----
  if (!cashSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-2xl font-semibold text-slate-700">Caixa fechado</h2>
        <p className="text-slate-500">Abra o caixa com o fundo de troco para iniciar as vendas.</p>
        <Button size="lg" onClick={() => setModal('openCash')}>
          Abrir caixa
        </Button>
        <OpenCashModal open={modal === 'openCash'} onClose={() => setModal('none')} />
      </div>
    );
  }

  const selectedItem = pos.items.find((i) => i.lineId === selectedLine) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      {toast && (
        <div
          className={cn(
            'mx-4 mt-2 rounded-lg px-4 py-2 text-sm font-medium',
            toast.tone === 'error' && 'bg-red-100 text-red-800',
            toast.tone === 'success' && 'bg-green-100 text-green-800',
            toast.tone === 'info' && 'bg-amber-100 text-amber-800',
          )}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-1 gap-4 p-4">
        {/* Coluna itens */}
        <div className="flex flex-1 flex-col">
          <div className="mb-3 flex gap-2">
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCodeEnter();
                }
              }}
              placeholder="Código de barras ou qtd*código (Enter)"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <Button variant="secondary" onClick={() => setModal('search')}>
              Buscar (F2)
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {pos.items.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                Nenhum item. Passe um produto para começar.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-100 text-sm text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Preço</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.items.map((item: CartItem) => (
                    <tr
                      key={item.lineId}
                      onClick={() => setSelectedLine(item.lineId)}
                      className={cn(
                        'cursor-pointer border-t border-slate-100 text-lg',
                        selectedLine === item.lineId ? 'bg-brand-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <td className="px-3 py-2">
                        {item.description}
                        {item.discountCents > 0 && (
                          <span className="ml-2 text-sm text-green-600">
                            (-{formatBRL(item.discountCents)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatQuantity(item.quantity, item.unit)} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right">{formatBRL(item.unitPriceCents)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatBRL(cartItemTotal(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Coluna total/ações */}
        <div className="flex w-80 flex-col gap-3">
          <div className="rounded-xl bg-slate-900 p-5 text-white">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal</span>
              <span>{formatBRL(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Descontos</span>
              <span>-{formatBRL(totals.discountCents)}</span>
            </div>
            <div className="mt-2 border-t border-slate-700 pt-2">
              <div className="text-sm text-slate-400">TOTAL</div>
              <div className="text-4xl font-bold">{formatBRL(totals.totalCents)}</div>
            </div>
          </div>

          <Button size="lg" onClick={openPayment} disabled={pos.items.length === 0}>
            Finalizar (F10)
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={requestCancelItem}>
              Cancelar item (F4)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDiscTarget(selectedLine ? 'item' : 'sale');
                setDiscInput('');
                setModal('discount');
              }}
            >
              Desconto (F6)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (pos.items.length > 0) {
                  pos.holdCurrent();
                  showToast('Venda suspensa.', 'info');
                }
              }}
            >
              Suspender (F8)
            </Button>
            <Button variant="secondary" onClick={() => setModal('held')}>
              Em espera ({pos.held.length})
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setModal('help')}>
            Ajuda (F1)
          </Button>
        </div>
      </div>

      {/* Barra de atalhos */}
      <div className="border-t border-slate-200 bg-white px-4 py-1 text-xs text-slate-500">
        F1 Ajuda · F2 Busca · F3 Quantidade · F4 Cancelar item · F6 Desconto · F8 Suspender · F10
        Finalizar · Esc Cancelar ação
      </div>

      {/* Modais */}
      <ProductSearchModal
        open={modal === 'search'}
        onClose={() => {
          setModal('none');
          focusCode();
        }}
        onPick={pickFromSearch}
      />

      <PaymentModal
        open={modal === 'payment'}
        totalCents={totals.totalCents}
        onCancel={() => {
          setModal('none');
          focusCode();
        }}
        onConfirm={(payments) => void doFinalize(payments)}
      />

      <Modal
        open={modal === 'quantity'}
        onClose={() => {
          setModal('none');
          setPendingKg(null);
          focusCode();
        }}
        title={pendingKg ? `Quantidade — ${pendingKg.product.name}` : 'Alterar quantidade'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setModal('none');
                setPendingKg(null);
                focusCode();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={applyQuantity}>Aplicar</Button>
          </>
        }
      >
        <input
          autoFocus
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyQuantity()}
          placeholder={pendingKg?.product.unit === 'KG' || selectedItem?.unit === 'KG' ? 'Ex.: 1,5 (kg)' : 'Ex.: 3'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </Modal>

      <Modal
        open={modal === 'discount'}
        onClose={() => {
          setModal('none');
          focusCode();
        }}
        title={discTarget === 'item' ? 'Desconto no item' : 'Desconto na venda'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setModal('none');
                focusCode();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={() => applyDiscount(false)}>Aplicar</Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-slate-500">
          Limite do operador: {settings?.operatorDiscountLimitPercent ?? 0}% (acima exige PIN de
          gerente).
        </p>
        <input
          autoFocus
          value={discInput}
          onChange={(e) => setDiscInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyDiscount(false)}
          placeholder="Valor do desconto (R$)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </Modal>

      <PinPrompt
        open={modal === 'pinCancel'}
        title="Autorizar cancelamento de item"
        onCancel={() => {
          setModal('none');
          focusCode();
        }}
        onSuccess={() => {
          if (selectedLine) pos.removeItem(selectedLine);
          setSelectedLine(null);
          setModal('none');
          focusCode();
        }}
      />

      <PinPrompt
        open={modal === 'pinDiscount'}
        title="Autorizar desconto acima do limite"
        onCancel={() => {
          setModal('none');
          focusCode();
        }}
        onSuccess={() => applyDiscount(true)}
      />

      <Modal
        open={modal === 'held'}
        onClose={() => {
          setModal('none');
          focusCode();
        }}
        title="Vendas em espera"
        size="md"
      >
        {pos.held.length === 0 ? (
          <div className="text-center text-slate-400">Nenhuma venda em espera.</div>
        ) : (
          <ul className="space-y-2">
            {pos.held.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="text-slate-700">
                  {h.items.length} itens · {new Date(h.heldAt).toLocaleTimeString('pt-BR')}
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      pos.resume(h.id);
                      setModal('none');
                      focusCode();
                    }}
                  >
                    Retomar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => pos.discardHeld(h.id)}>
                    Descartar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={modal === 'help'}
        onClose={() => {
          setModal('none');
          focusCode();
        }}
        title="Atalhos de teclado"
        size="md"
      >
        <ul className="grid grid-cols-2 gap-2 text-slate-700">
          <li><b>F1</b> — Ajuda</li>
          <li><b>F2</b> — Buscar produto</li>
          <li><b>F3</b> — Alterar quantidade do item</li>
          <li><b>F4</b> — Cancelar item selecionado</li>
          <li><b>F6</b> — Desconto (item/venda)</li>
          <li><b>F8</b> — Suspender venda</li>
          <li><b>F10</b> — Finalizar / pagar</li>
          <li><b>Esc</b> — Cancelar ação</li>
          <li className="col-span-2 mt-2 text-sm text-slate-500">
            Dica: digite <code>3*</code> antes do código para multiplicar a quantidade. Produtos
            por kg pedem o peso.
          </li>
        </ul>
      </Modal>
    </div>
  );
}
