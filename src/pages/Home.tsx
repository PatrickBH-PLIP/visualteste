import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ImageOff, Box } from 'lucide-react'
import { useState } from 'react'
import { CATEGORY_LIST } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { homeSummary } from '@/services/products'
import { useCompany } from '@/hooks/useAuth'
import { ErrorBanner } from '@/components/ui'
import { StockIntakeModal } from '@/components/StockIntakeModal'

/** Fotos das categorias: coloque seus próprios arquivos em public/assets/categories/<slug>.jpg */
function CategoryPhoto({ slug, color }: { slug: string; color: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: `${color}22` }}>
        <ImageOff size={30} style={{ color }} className="opacity-60" aria-label="Foto da categoria não adicionada" />
      </div>
    )
  }
  return <img src={`/assets/categories/${slug}.jpg`} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
}

export default function Home() {
  const { companyId } = useCompany()
  const s = useQuery({ queryKey: ['home', companyId], queryFn: () => homeSummary(companyId) })
  const [stockIntakeOpen, setStockIntakeOpen] = useState(false)
  const stats = s.data && [
    { label: 'Produtos cadastrados', value: String(s.data.products) },
    { label: 'Unidades em estoque', value: String(s.data.units) },
    { label: 'Estoque baixo', value: String(s.data.low_stock) },
    { label: 'Vendas pendentes', value: String(s.data.pending_sales) },
    { label: 'Recebido no mês', value: formatBRL(s.data.received_month) },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Estoque</h1>
          <p className="text-tinta/70">Escolha uma categoria para consultar e atualizar o estoque.</p>
        </div>
        <button type="button" className="btn-primary hidden shrink-0 sm:inline-flex" onClick={() => setStockIntakeOpen(true)}><Box size={19} />Adicionar estoque</button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {CATEGORY_LIST.map((c) => (
          <Link key={c.key} to={`/estoque/${c.slug}`}
            className="card group flex min-h-[170px] overflow-hidden transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: c.main }}>
            <div className="w-2/5 shrink-0 overflow-hidden"><CategoryPhoto slug={c.slug} color={c.main} /></div>
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: c.main }}>{c.label.toUpperCase()}</h2>
                <p className="mt-1 text-sm text-tinta/75">{c.description}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 group-hover:underline" style={{ color: c.main }}>
                Consultar estoque <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {s.isError && <ErrorBanner message="Não foi possível carregar o resumo." onRetry={() => s.refetch()} />}
      <button type="button" aria-label="Adicionar estoque" title="Adicionar estoque" onClick={() => setStockIntakeOpen(true)}
        className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 sm:hidden"
        style={{ background: '#fa300f', boxShadow: '0 8px 24px #0003' }}><Box size={25} /></button>
      {stockIntakeOpen && <StockIntakeModal onClose={() => setStockIntakeOpen(false)} />}
      {stats && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((x) => (
            <div key={x.label} className="rounded-lg border border-tinta/10 px-3 py-3">
              <dt className="text-xs text-tinta/65">{x.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold">{x.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
