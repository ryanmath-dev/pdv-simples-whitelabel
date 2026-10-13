import { useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { useRepos } from '@/ui/container-context';
import { parseProductsCsv, csvTemplate, type ParseResult } from './product-csv';
import { downloadText } from '@/ui/lib/csv';
import { importProducts } from '@/application/use-cases/import-products';

export function ProductCsvModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (msg: string) => void;
}) {
  const repos = useRepos();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  function analyze(content: string) {
    setText(content);
    setPreview(parseProductsCsv(content));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    analyze(await file.text());
  }

  async function doImport() {
    if (!preview || preview.rows.length === 0) return;
    setBusy(true);
    try {
      const res = await importProducts(repos, preview.rows);
      onImported(
        `Importação: ${res.created} criados, ${res.updated} atualizados, ${res.categoriesCreated} categorias novas.`,
      );
      setText('');
      setPreview(null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar produtos (CSV)"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => downloadText('modelo-produtos.csv', csvTemplate())}>
            Baixar modelo
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={doImport}
            disabled={busy || !preview || preview.rows.length === 0}
          >
            Importar {preview ? `(${preview.rows.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <textarea
          value={text}
          onChange={(e) => analyze(e.target.value)}
          placeholder="…ou cole o conteúdo CSV aqui"
          rows={6}
          className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        {preview && (
          <div className="text-sm">
            <p className="text-green-700">{preview.rows.length} linha(s) válida(s).</p>
            {preview.errors.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="font-medium text-red-700">{preview.errors.length} erro(s):</p>
                <ul className="list-inside list-disc text-red-600">
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      Linha {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
