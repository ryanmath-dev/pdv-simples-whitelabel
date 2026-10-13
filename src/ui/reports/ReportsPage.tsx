import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRepos } from '@/ui/container-context';
import { useToasts } from '@/ui/components/toast-store';
import { formatBRL, centsToReal } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import {
  abcCurve,
  paymentsByMethod,
  productSales,
  salesByDay,
  salesTotals,
} from '@/domain/reports';
import type { Sale, SaleItem, Payment, PaymentMethod } from '@/domain/sale';
import { Button } from '@/ui/components/Button';
import { toCsv, downloadText } from '@/ui/lib/csv';
import { cn } from '@/ui/lib/cn';

// Cores categóricas (ordem fixa) da paleta validada — identidade por forma.
const CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7'];
const BRAND_SERIES = '#2a78d6';
const GRID = '#e1e0d9';
const AXIS = '#898781';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  STORE_CREDIT: 'Crédito loja',
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function ReportsPage() {
  const repos = useRepos();
  const show = useToasts((s) => s.show);
  const [startIso, setStartIso] = useState(daysAgoIso(13));
  const [endIso, setEndIso] = useState(new Date().toISOString());
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [costByProduct, setCostByProduct] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    (async () => {
      const periodSales = (await repos.sales.listByPeriod(startIso, endIso)).filter(
        (s) => s.status === 'FINALIZED',
      );
      const saleIds = periodSales.map((s) => s.id);
      const [allItems, pays, products] = await Promise.all([
        Promise.all(saleIds.map((id) => repos.saleItems.listBySale(id))),
        repos.payments.listBySaleIds(saleIds),
        repos.products.getAll(),
      ]);
      setSales(periodSales);
      setItems(allItems.flat());
      setPayments(pays);
      setCostByProduct(new Map(products.map((p) => [p.id, p.costCents])));
    })();
  }, [repos, startIso, endIso]);

  const totals = useMemo(() => salesTotals(sales), [sales]);
  const byDay = useMemo(() => salesByDay(sales), [sales]);
  const byMethod = useMemo(() => paymentsByMethod(payments), [payments]);
  const prodSales = useMemo(() => productSales(items, costByProduct), [items, costByProduct]);
  const abc = useMemo(() => abcCurve(prodSales), [prodSales]);
  const totalMargin = useMemo(() => prodSales.reduce((s, p) => s + p.marginCents, 0), [prodSales]);

  const dayData = byDay.map((d) => ({
    date: d.date.slice(5),
    valor: centsToReal(d.totalCents),
    totalCents: d.totalCents,
    count: d.count,
  }));

  const pieData = (Object.keys(byMethod) as PaymentMethod[])
    .filter((m) => byMethod[m] > 0)
    .map((m) => ({ name: METHOD_LABELS[m], value: centsToReal(byMethod[m]), cents: byMethod[m] }));

  function setPreset(days: number) {
    setStartIso(daysAgoIso(days - 1));
    setEndIso(new Date().toISOString());
  }

  function exportDaily() {
    const rows: (string | number)[][] = [['data', 'total_reais', 'vendas']];
    byDay.forEach((d) => rows.push([d.date, centsToReal(d.totalCents).toFixed(2), d.count]));
    downloadText('vendas-por-dia.csv', toCsv(rows));
    show('CSV exportado.', 'success');
  }

  function exportProducts() {
    const rows: (string | number)[][] = [['produto', 'qtd', 'receita', 'custo', 'margem', 'abc']];
    abc.forEach((p) =>
      rows.push([
        p.description,
        (p.quantity / 1000).toFixed(3),
        centsToReal(p.revenueCents).toFixed(2),
        centsToReal(p.costCents).toFixed(2),
        centsToReal(p.marginCents).toFixed(2),
        p.abc,
      ]),
    );
    downloadText('produtos-vendidos.csv', toCsv(rows));
    show('CSV exportado.', 'success');
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">De</span>
          <input
            type="date"
            value={startIso.slice(0, 10)}
            onChange={(e) => setStartIso(new Date(e.target.value + 'T00:00:00').toISOString())}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Até</span>
          <input
            type="date"
            value={endIso.slice(0, 10)}
            onChange={(e) => setEndIso(new Date(e.target.value + 'T23:59:59').toISOString())}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setPreset(1)}>
            Hoje
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPreset(7)}>
            7 dias
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPreset(30)}>
            30 dias
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total vendido" value={formatBRL(totals.totalCents)} />
        <StatTile label="Vendas" value={String(totals.count)} />
        <StatTile label="Ticket médio" value={formatBRL(totals.avgTicketCents)} />
        <StatTile label="Margem estimada" value={formatBRL(totalMargin)} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-slate-700">Vendas por dia</h3>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={exportDaily}>
              Exportar CSV
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dayData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" stroke={AXIS} fontSize={12} tickLine={false} />
              <YAxis stroke={AXIS} fontSize={12} tickLine={false} width={48} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Total']}
                labelStyle={{ color: '#0b0b0b' }}
              />
              <Bar dataKey="valor" fill={BRAND_SERIES} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-slate-700">Por forma de pagamento</h3>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-slate-400">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e: { name?: string }) => e.name ?? ''}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} stroke="#fcfcfb" strokeWidth={2} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top produtos / ABC */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Produtos mais vendidos (curva ABC)</h3>
          <Button size="sm" variant="ghost" onClick={exportProducts}>
            Exportar CSV
          </Button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm [font-variant-numeric:tabular-nums]">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Produto</th>
                <th className="py-2 text-right">Qtd</th>
                <th className="py-2 text-right">Receita</th>
                <th className="py-2 text-right">Margem</th>
                <th className="py-2 text-center">ABC</th>
              </tr>
            </thead>
            <tbody>
              {abc.slice(0, 30).map((p) => (
                <tr key={p.productId} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{p.description}</td>
                  <td className="py-2 text-right">{formatQuantity(p.quantity, 'UN')}</td>
                  <td className="py-2 text-right">{formatBRL(p.revenueCents)}</td>
                  <td className="py-2 text-right">{formatBRL(p.marginCents)}</td>
                  <td className="py-2 text-center">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        p.abc === 'A' && 'bg-brand-100 text-brand-800',
                        p.abc === 'B' && 'bg-amber-100 text-amber-800',
                        p.abc === 'C' && 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {p.abc}
                    </span>
                  </td>
                </tr>
              ))}
              {abc.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Sem vendas no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
