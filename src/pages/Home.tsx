import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ImageOff } from 'lucide-react'
import { useState } from 'react'
import { CATEGORY_LIST } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { homeSummary, listProducts, salesCostSummary } from '@/services/products'
import { ProductImage } from '@/components/ProductCard'
import { Modal } from '@/components/Modal'
import { SIZES, type Product } from '@/types'
import { useCompany } from '@/hooks/useAuth'
import { ErrorBanner } from '@/components/ui'

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
  const products = useQuery({ queryKey: ['products', companyId, 'all-home'], queryFn: async () => {
    const categories = ['feminino', 'masculino', 'lingerie', 'sex_shop'] as const
    const lists = await Promise.all(categories.map((category) => listProducts(companyId, category)))
    return lists.flat()
  } })
  const finances = useQuery({ queryKey: ['sales-cost-summary', companyId], queryFn: () => salesCostSummary(companyId) })
  const [selected, setSelected] = useState<Product[] | null>(null)

  const groupedProducts = (products.data ?? []).reduce((groups, product) => {
    const key = `${product.category}||${product.name.trim().toLocaleLowerCase('pt-BR')}||${product.brand.trim().toLocaleLowerCase('pt-BR')}`
    const existing = groups.get(key) ?? []
    groups.set(key, [...existing, product])
    return groups
  }, new Map<string, Product[]>())
  const productGroups = Array.from(groupedProducts.values()).sort((a, b) => a[0].name.localeCompare(b[0].name, 'pt-BR'))

  const stats = s.data && [
    { label: 'Produtos cadastrados', value: String(s.data.products) },
    { label: 'Unidades em estoque', value: String(s.data.units) },
    { label: 'Estoque baixo', value: String(s.data.low_stock) },
    { label: 'Vendas pendentes', value: String(s.data.pending_sales) },
    { label: 'Recebido no mês', value: formatBRL(s.data.received_month) },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Estoque</h1>
        <p className="text-tinta/70">Escolha uma categoria para consultar e atualizar o estoque.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-tinta/70">Lucro líquido estimado</p>
          <p className="mt-1 text-2xl font-bold text-pago">{finances.isLoading ? 'Calculando…' : formatBRL(finances.data?.profit_cents ?? 0)}</p>
          <p className="mt-1 text-xs text-tinta/60">Vendas válidas − custo das peças vendidas</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-tinta/70">Custo das peças vendidas</p>
          <p className="mt-1 text-2xl font-bold">{finances.isLoading ? 'Calculando…' : formatBRL(finances.data?.cost_cents ?? 0)}</p>
          <p className="mt-1 text-xs text-tinta/60">Custo cadastrado × unidades vendidas</p>
        </div>
      </div>
      {finances.data?.units_without_cost ? <p className="text-sm text-pendente">Atenção: {finances.data.units_without_cost} unidade(s) vendida(s) estão sem custo cadastrado e não entram no cálculo de custo/lucro.</p> : null}
      {finances.isError && <ErrorBanner message="Não foi possível calcular lucro e custo das vendas." onRetry={() => finances.refetch()} />}

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold text-chilli">Produtos cadastrados</h2>
          <p className="text-sm text-tinta/70">Produtos com o mesmo nome e marca aparecem juntos, separados por tamanho.</p>
        </div>
        {products.isLoading && <p className="text-sm text-tinta/60">Carregando produtos…</p>}
        {products.isError && <ErrorBanner message="Não foi possível carregar os produtos." onRetry={() => products.refetch()} />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productGroups.map((group) => {
            const sorted = group.slice().sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
            const first = sorted[0]
            const labels = sorted.map((p) => p.size)
            const range = labels.length === 1 ? labels[0] : `${labels[0]} - ${labels[labels.length - 1]}`
            const quantity = sorted.reduce((sum, p) => sum + p.quantity, 0)
            return (
              <button key={first.id} type="button" onClick={() => setSelected(sorted)}
                className="card group overflow-hidden text-left transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-chilli">
                <div className="relative aspect-[4/3] overflow-hidden bg-white/50">
                  <ProductImage path={first.image_path} alt={first.name} />
                  <span className="absolute left-2 top-2 rounded-md bg-chilli px-3 py-1 font-serif text-lg font-bold text-white shadow">{range}</span>
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="font-bold text-chilli">{first.name}</h3>
                  <p className="text-sm text-tinta/70">{first.brand}</p>
                  <p className="text-sm">Tamanhos: {labels.join(', ')}</p>
                  <p className="text-sm">Quantidade total: <strong>{quantity}</strong></p>
                  <p className="text-xs text-tinta/60">Clique para ver custos, preços e estoque por tamanho</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

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

      {selected && <Modal title={selected[0].name} onClose={() => setSelected(null)} wide>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="max-h-[360px] overflow-hidden rounded-lg bg-white/50">
            <ProductImage path={selected[0].image_path} alt={selected[0].name} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-chilli">{selected[0].name}</h3>
            <p className="text-sm text-tinta/70">{selected[0].brand}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead className="border-b border-tinta/15 text-xs text-tinta/70">
                  <tr><th className="p-2">Tamanho</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Custo</th><th className="p-2 text-right">Valor de venda</th></tr>
                </thead>
                <tbody>{selected.map((p) => <tr key={p.id} className="border-b border-tinta/10 last:border-0">
                  <td className="p-2 font-semibold">{p.size}</td><td className="p-2 text-right">{p.quantity}</td>
                  <td className="p-2 text-right">{p.cost_cents == null ? 'Não informado' : formatBRL(p.cost_cents)}</td>
                  <td className="p-2 text-right">{formatBRL(p.price_cents)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>}
      {s.isError && <ErrorBanner message="Não foi possível carregar o resumo." onRetry={() => s.refetch()} />}
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
