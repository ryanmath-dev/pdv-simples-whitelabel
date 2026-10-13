import { useEffect, useRef, useState } from 'react';
import { useContainer } from '@/ui/container-context';
import { useSession } from '@/ui/session/session-store';
import { useToasts } from '@/ui/components/toast-store';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { now } from '@/domain/types';
import type { StoreSettings } from '@/domain/settings';
import { exportDatabase, importDatabase, type BackupFile } from '@/infrastructure/db/backup';
import { downloadText } from '@/ui/lib/csv';

export function SettingsPage() {
  const container = useContainer();
  const { settings, refreshSettings } = useSession();
  const show = useToasts((s) => s.show);
  const [form, setForm] = useState<StoreSettings | null>(settings);
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setForm(settings), [settings]);

  useEffect(() => {
    (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      const est = (await navigator.storage?.estimate?.()) ?? {};
      setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })();
  }, []);

  if (!form) return <div className="p-8 text-slate-400">Carregando…</div>;

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    await container.repos.settings.put({ ...form, updatedAt: now(), version: form.version + 1 });
    await refreshSettings(container);
    show('Configurações salvas.', 'success');
  }

  async function doExport() {
    const backup = await exportDatabase(container.db);
    downloadText(`backup-pdv-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup), 'application/json');
    show('Backup exportado.', 'success');
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text()) as BackupFile;
      await importDatabase(container.db, json);
      show('Backup restaurado. Recarregando…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Falha ao restaurar.', 'error');
    }
  }

  const usagePct = storage && storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      <Section title="Dados da loja (aparecem no cupom)">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome da loja" value={form.storeName} onChange={(e) => set('storeName', e.target.value)} />
          <Input label="CNPJ" value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} />
          <Input label="Endereço" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          <Input label="Telefone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Terminal" value={form.terminalId} onChange={(e) => set('terminalId', e.target.value)} />
          <Select label="Largura do cupom" value={form.receiptWidth} onChange={(e) => set('receiptWidth', e.target.value as StoreSettings['receiptWidth'])}>
            <option value="58mm">58 mm</option>
            <option value="80mm">80 mm</option>
          </Select>
        </div>
      </Section>

      <Section title="Regras operacionais">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.allowNegativeStock} onChange={(e) => set('allowNegativeStock', e.target.checked)} />
            Permitir venda com estoque negativo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.requireManagerPinForCancel} onChange={(e) => set('requireManagerPinForCancel', e.target.checked)} />
            Exigir PIN de gerente para cancelar item
          </label>
          <Input
            label="Limite de desconto do operador (%)"
            type="number"
            value={String(form.operatorDiscountLimitPercent)}
            onChange={(e) => set('operatorDiscountLimitPercent', Number(e.target.value))}
          />
        </div>
      </Section>

      <Section title="Balança (etiquetas prefixo 2)">
        <div className="grid grid-cols-3 gap-3">
          <Select label="Valor embutido" value={form.scaleEmbeddedType} onChange={(e) => set('scaleEmbeddedType', e.target.value as StoreSettings['scaleEmbeddedType'])}>
            <option value="WEIGHT">Peso (kg)</option>
            <option value="PRICE">Preço (R$)</option>
          </Select>
          <Input label="Dígitos do PLU" type="number" value={String(form.scalePluDigits)} onChange={(e) => set('scalePluDigits', Number(e.target.value))} />
          <Input label="Dígitos do valor" type="number" value={String(form.scaleValueDigits)} onChange={(e) => set('scaleValueDigits', Number(e.target.value))} />
        </div>
      </Section>

      <div>
        <Button onClick={save}>Salvar configurações</Button>
      </div>

      <Section title="Backup e restauração">
        <p className="mb-3 text-sm text-slate-500">
          Exporte todo o banco (produtos, vendas, estoque, caixa) como JSON. Essencial enquanto não há backend.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={doExport}>
            Exportar backup (JSON)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Restaurar backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" />
        </div>
      </Section>

      <Section title="Armazenamento e provedores">
        {storage && (
          <div className="mb-3 text-sm text-slate-600">
            <div className="mb-1 flex justify-between">
              <span>Uso do armazenamento</span>
              <span>
                {(storage.usage / 1048576).toFixed(1)} MB de {(storage.quota / 1048576).toFixed(0)} MB
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, usagePct)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Persistência: {storage.persisted ? 'ativada' : 'não garantida'}
            </p>
          </div>
        )}
        <ul className="text-sm text-slate-600">
          <li>Provedor fiscal: <b>{container.fiscal.name}</b></li>
          <li>Pagamento: <b>{container.payment.name}</b></li>
          <li>Sincronização: <b>{container.sync.name}</b></li>
          <li>Impressora: <b>{container.printer.name}</b></li>
        </ul>
      </Section>

      <div id="settings-reset-slot" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}
