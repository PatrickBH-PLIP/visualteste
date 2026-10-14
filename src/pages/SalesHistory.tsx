import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Eye, Plus, Search } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { SaleDetailModal } from '@/components/SaleDetailModal'
import { EmptyState, ErrorBanner, Spinner } from '@/components/ui'
import { formatBRL } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { listSaleItems, listSales, type SaleFilters } from '@/services/sales'
import { useCompany } from '@/hooks/useAuth'
import type { SaleStatus } from '@/types'

const PAGE = 20

export default function SalesHistory() {
  const { companyId } = useCompany()
  const [f, setF] = useState<SaleFilters>({ search: '', status: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<{ id: string; pay?: boolean } | null>(null)
  const set = (patch: Partial<SaleFilters>) => { setF((x) => ({ ...x, ...patch })); setPage(0) }

  const q = useQuery({ queryKey: ['sales', companyId, f, page], queryFn: () => listSales(companyId, f, page, PAGE), placeholderData: (p) => p })
  const ids = q.data?.rows.map((r) => r.id) ?? []
  const items = useQuery({ queryKey: ['sales', 'items-bulk', ids.join(',')], queryFn: () => listSaleItems(ids), enabled: ids.length > 0 })
  const byId = new Map<string, string[]>()
  items.data?.forEach((i) => byId.set(i.sale_id, [...(byId.get(i.sale_id) ?? []), `${i.quantity}× ${i.product_name} (${i.size})`]))
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-chilli">Histórico de vendas</h1>
        <Link to="/vendas/nova" className="btn-primary"><Plus size={18} />Nova venda</Link>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/45" />
          <input className="input !pl-10" placeholder="Nome do cliente" value={f.search} onChange={(e) => set({ search: e.target.value })} aria-label="Pesquisar por cliente" />
        </div>
        <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value as SaleStatus | '' })} aria-label="Filtrar por status">
          <option value="">Todos os status</option><option value="PENDENTE">Pendente</option><option value="ATRASADO">Atrasado</option>
          <option value="PAGO">Pago</option><option value="CREDITO">A devolver</option><option value="CANCELADA">Cancelada</option>
        </select>
        <label className="flex items-center gap-2 text-sm">De <input className="input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm">Até <input className="input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBanner message="Não foi possível carregar as vendas." onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <EmptyState title="Nenhuma venda encontrada" hint="Registre uma venda ou ajuste os filtros." action={<Link to="/vendas/nova" className="btn-primary mt-2"><Plus size={18} />Nova venda</Link>} />}

      <ul className="space-y-3">
        {q.data?.rows.map((s) => (
          <li key={s.id} className={`card grid gap-3 p-4 md:grid-cols-[auto_1.4fr_1.6fr_1fr_auto] md:items-center ${s.status === 'CANCELADA' ? 'opacity-70' : ''}`}>
            <input type="checkbox" className="h-6 w-6 accent-[#008000]" checked={s.status === 'PAGO'} disabled={s.status === 'PAGO' || s.status === 'CANCELADA' || s.balance_cents <= 0}
              aria-label={s.status === 'PAGO' ? 'Pagamento confirmado' : 'Registrar pagamento desta venda'} title={s.status === 'PAGO' ? 'Pago' : 'Marcar como pago: abre o registro de recebimento'}
              onChange={() => setOpen({ id: s.id, pay: true })} />
            <div>
              <p className="font-semibold">#{s.sale_number} · {s.customer_name}</p>
              <p className="text-sm text-tinta/70">{s.customer_phone}</p>
              <p className="text-xs text-tinta/60">Compra {formatDate(s.purchase_date)} · Pagar até {formatDate(s.due_date)}</p>
            </div>
            <p className="text-sm text-tinta/80">{byId.get(s.id)?.join(', ') ?? '…'}</p>
            <div className="text-sm">
              <p>Líquido <strong>{formatBRL(s.net_cents)}</strong>{s.discount_cents > 0 && <span className="text-tinta/60"> (desc. {formatBRL(s.discount_cents)})</span>}</p>
              <p>Pago {formatBRL(s.paid_cents)} · {s.balance_cents < 0 ? 'Devolver' : 'Saldo'} <strong>{formatBRL(Math.abs(s.balance_cents))}</strong></p>
            </div>
            <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
              <StatusBadge status={s.status} />
              <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setOpen({ id: s.id })}><Eye size={16} />Detalhes</button>
            </div>
          </li>
        ))}
      </ul>

      {q.data && pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" className="btn-outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
          <span className="text-sm">Página {page + 1} de {pages}</span>
          <button type="button" className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página"><ChevronRight size={18} /></button>
        </div>
      )}

      {open && <SaleDetailModal saleId={open.id} startWith={open.pay ? 'payment' : undefined} onClose={() => setOpen(null)} />}
    </div>
  )
}
