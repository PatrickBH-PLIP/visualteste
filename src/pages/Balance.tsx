import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { CategoryChart, DailyChart, StatusChart } from '@/components/Charts'
import { ErrorBanner, Spinner } from '@/components/ui'
import { CATEGORIES } from '@/lib/categories'
import { downloadBlob, toCsv } from '@/lib/csv'
import { formatDate, periodRange, todayLocal, type PeriodKey } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { balanceReport, statement } from '@/services/reports'
import { useCompany } from '@/hooks/useAuth'
import type { SaleStatus } from '@/types'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' }, { key: '7d', label: 'Últimos 7 dias' }, { key: '30d', label: 'Últimos 30 dias' },
  { key: 'mes', label: 'Mês atual' }, { key: 'mes_anterior', label: 'Mês anterior' }, { key: 'custom', label: 'Personalizado' },
]

export default function Balance() {
  const { companyId, timezone, companyName } = useCompany()
  const today = todayLocal(timezone)
  const [key, setKey] = useState<PeriodKey>('mes')
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + '01', to: today })
  const range = periodRange(key, today, custom)
  const valid = range.from <= range.to

  const rep = useQuery({ queryKey: ['balance', companyId, range.from, range.to], queryFn: () => balanceReport(companyId, range.from, range.to), enabled: valid })
  const st = useQuery({ queryKey: ['statement', companyId, range.from, range.to], queryFn: () => statement(companyId, range.from, range.to), enabled: valid })

  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState<SaleStatus | ''>('')
  const [sortBy, setSortBy] = useState<'date' | 'net' | 'balance'>('date')
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase()
    const out = (st.data ?? []).filter((s) => (!t || s.customer_name.toLowerCase().includes(t) || String(s.sale_number) === t) && (!statusF || s.status === statusF))
    if (sortBy === 'net') out.sort((a, b) => b.net_cents - a.net_cents)
    if (sortBy === 'balance') out.sort((a, b) => b.balance_cents - a.balance_cents)
    return out
  }, [st.data, search, statusF, sortBy])

  const exportCsv = () => downloadBlob(new Blob([toCsv([
    ['Data', 'Venda', 'Cliente', 'Bruto', 'Desconto', 'Líquido', 'Pago', 'Saldo', 'Status'],
    ...rows.map((s) => [formatDate(s.purchase_date), s.sale_number, s.customer_name, (s.gross_cents / 100).toFixed(2).replace('.', ','), (s.discount_cents / 100).toFixed(2).replace('.', ','),
      (s.net_cents / 100).toFixed(2).replace('.', ','), (s.paid_cents / 100).toFixed(2).replace('.', ','), (s.balance_cents / 100).toFixed(2).replace('.', ','), s.status]),
  ])], { type: 'text/csv;charset=utf-8' }), `extrato-${range.from}-a-${range.to}.csv`)

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14).text(`${companyName} — Extrato de vendas (${formatDate(range.from)} a ${formatDate(range.to)})`, 14, 14)
    autoTable(doc, { startY: 20, styles: { fontSize: 8.5 }, headStyles: { fillColor: [205, 28, 24] },
      head: [['Data', 'Venda', 'Cliente', 'Bruto', 'Desconto', 'Líquido', 'Pago', 'Saldo', 'Status']],
      body: rows.map((s) => [formatDate(s.purchase_date), `#${s.sale_number}`, s.customer_name, formatBRL(s.gross_cents), formatBRL(s.discount_cents), formatBRL(s.net_cents), formatBRL(s.paid_cents), formatBRL(s.balance_cents), s.status]) })
    downloadBlob(doc.output('blob'), `extrato-${range.from}-a-${range.to}.pdf`)
  }

  const r = rep.data
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-chilli">Balanço</h1>

      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={key === p.key} onClick={() => setKey(p.key)}
              className={`btn !min-h-[40px] ${key === p.key ? 'bg-chilli text-white' : 'border border-tinta/25'}`}>{p.label}</button>
          ))}
        </div>
        {key === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">De <input className="input !w-auto" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label className="flex items-center gap-2">Até <input className="input !w-auto" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
            {!valid && <span className="field-error">A data final deve ser igual ou posterior à inicial.</span>}
          </div>
        )}
        <p className="text-xs text-tinta/60">Período: {formatDate(range.from)} a {formatDate(range.to)} (datas locais da loja).</p>
      </div>

      {rep.isLoading && <Spinner />}
      {rep.isError && <ErrorBanner message="Não foi possível carregar o balanço." onRetry={() => rep.refetch()} />}

      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total bruto das vendas" value={formatBRL(r.gross_cents)} note="Vendas feitas no período (data da venda)" />
            <StatCard label="Descontos concedidos" value={formatBRL(r.discount_cents)} />
            <StatCard label="Total líquido vendido" value={formatBRL(r.net_cents)} tone="#cd1c18" note="Bruto − descontos, sem canceladas" />
            <StatCard label="Efetivamente recebido" value={formatBRL(r.received_cents)} tone="#008000" note="Pagamentos recebidos no período, mesmo de vendas antigas" />
            <StatCard label="Saldo pendente" value={formatBRL(r.pending_cents)} tone="#c27a00" note="Em aberto, hoje, nas vendas deste período" />
            <StatCard label="Ticket médio" value={formatBRL(r.avg_ticket_cents)} note="Líquido ÷ vendas válidas (sem canceladas)" />
            <StatCard label="Vendas realizadas" value={String(r.sales_count)} />
            <StatCard label="Pagas" value={String(r.paid_count)} tone="#008000" />
            <StatCard label="Pendentes / Atrasadas" value={`${r.pending_count} / ${r.late_count}`} tone="#c27a00" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4"><h2 className="mb-2 text-lg">Vendas por dia</h2><DailyChart data={r.daily} series={['sold']} /></section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Recebimentos por dia</h2><DailyChart data={r.daily} series={['received']} /></section>
            <section className="card p-4 lg:col-span-2"><h2 className="mb-2 text-lg">Vendido × recebido</h2><DailyChart data={r.daily} series={['sold', 'received']} /></section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Vendas por categoria (bruto)</h2><CategoryChart data={r.by_category} /></section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Pagas, pendentes e atrasadas</h2><StatusChart r={r} /></section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card p-4"><h2 className="mb-2 text-lg">Mais vendidos</h2>
              {r.top_products.length === 0 ? <p className="text-sm text-tinta/60">Sem vendas no período.</p> :
                <ol className="space-y-1.5 text-sm">{r.top_products.map((p) => <li key={p.name + p.size + p.brand} className="flex justify-between gap-2"><span>{p.name} <span className="text-tinta/60">({p.size})</span></span><strong>{p.units} un.</strong></li>)}</ol>}
              {r.by_category[0] && <p className="mt-3 border-t border-tinta/10 pt-2 text-sm">Maior faturamento: <strong>{CATEGORIES[r.by_category[0].category].label}</strong></p>}</section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Clientes com saldo pendente</h2>
              {r.debtors.length === 0 ? <p className="text-sm text-tinta/60">Nenhum saldo em aberto.</p> :
                <ul className="space-y-1.5 text-sm">{r.debtors.map((d) => <li key={d.customer_name + d.customer_phone} className="flex justify-between gap-2"><span>{d.customer_name}</span><strong>{formatBRL(d.balance_cents)}</strong></li>)}</ul>}
              <p className="mt-2 text-xs text-tinta/60">Todas as vendas em aberto, não só as do período.</p></section>
            <section className="card p-4"><h2 className="mb-2 text-lg">Estoque baixo</h2>
              {r.low_stock.length === 0 ? <p className="text-sm text-tinta/60">Nenhum produto abaixo do mínimo.</p> :
                <ul className="space-y-1.5 text-sm">{r.low_stock.map((p) => <li key={p.name + p.size + p.brand} className="flex justify-between gap-2"><span>{p.name} ({p.size})</span><strong>{p.quantity}</strong></li>)}</ul>}</section>
          </div>
        </>
      )}

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl">Extrato de vendas</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={exportCsv} disabled={!rows.length}><Download size={16} />CSV</button>
            <button type="button" className="btn-outline" onClick={exportPdf} disabled={!rows.length}><FileText size={16} />PDF</button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="input" placeholder="Cliente ou nº da venda" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Pesquisar no extrato" />
          <select className="input" value={statusF} onChange={(e) => setStatusF(e.target.value as SaleStatus | '')} aria-label="Status">
            <option value="">Todos os status</option><option value="PAGO">Pago</option><option value="PENDENTE">Pendente</option><option value="ATRASADO">Atrasado</option><option value="CREDITO">A devolver</option><option value="CANCELADA">Cancelada</option>
          </select>
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Ordenar">
            <option value="date">Mais recentes</option><option value="net">Maior valor líquido</option><option value="balance">Maior saldo pendente</option>
          </select>
        </div>
        {st.isLoading ? <Spinner /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-tinta/60">Nenhuma venda no período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-tinta/15 text-xs text-tinta/70"><tr>
                <th className="p-2">Data</th><th className="p-2">Venda</th><th className="p-2">Cliente</th><th className="p-2 text-right">Bruto</th><th className="p-2 text-right">Desc.</th>
                <th className="p-2 text-right">Líquido</th><th className="p-2 text-right">Pago</th><th className="p-2 text-right">Saldo</th><th className="p-2">Status</th></tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id} className="border-b border-tinta/10 last:border-0">
                  <td className="p-2">{formatDate(s.purchase_date)}</td><td className="p-2">#{s.sale_number}</td><td className="p-2">{s.customer_name}</td>
                  <td className="p-2 text-right">{formatBRL(s.gross_cents)}</td><td className="p-2 text-right">{formatBRL(s.discount_cents)}</td>
                  <td className="p-2 text-right font-semibold">{formatBRL(s.net_cents)}</td><td className="p-2 text-right">{formatBRL(s.paid_cents)}</td>
                  <td className="p-2 text-right">{formatBRL(s.balance_cents)}</td><td className="p-2"><StatusBadge status={s.status} /></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
