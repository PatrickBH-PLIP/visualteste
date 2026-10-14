import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { categoryFromSlug } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { listProducts } from '@/services/products'
import { useCompany } from '@/hooks/useAuth'
import { ProductCard, ProductImage, stockLevel } from '@/components/ProductCard'
import { ProductForm } from '@/components/ProductForm'
import { StockModal } from '@/components/StockModal'
import { EmptyState, ErrorBanner, Spinner } from '@/components/ui'
import { SIZES, type Product } from '@/types'

type Availability = '' | 'disponivel' | 'baixo' | 'zerado'

export default function Stock() {
  const { slug } = useParams()
  const theme = categoryFromSlug(slug)
  const { companyId } = useCompany()

  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [avail, setAvail] = useState<Availability>('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [form, setForm] = useState<{ product?: Product } | null>(null)
  const [stock, setStock] = useState<Product | null>(null)

  const q = useQuery({
    queryKey: ['products', companyId, theme?.key],
    queryFn: () => listProducts(companyId, theme!.key),
    enabled: !!theme,
  })

  const brands = useMemo(() => Array.from(new Set((q.data ?? []).map((p) => p.brand))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [q.data])

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const out = (q.data ?? []).filter((p) =>
      (!term || p.name.toLocaleLowerCase('pt-BR').includes(term)) &&
      (!brand || p.brand === brand) && (!size || p.size === size) &&
      (!avail || (avail === 'disponivel' ? p.quantity > 0 : avail === 'baixo' ? stockLevel(p) === 'baixo' : p.quantity === 0)))
    out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') * (order === 'asc' ? 1 : -1) || SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
    return out
  }, [q.data, search, brand, size, avail, order])

  if (!theme) return <Navigate to="/" replace />

  return (
    <div className="space-y-5" style={{ ['--c-main' as string]: theme.main }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold" style={{ color: theme.main }}>Estoque {theme.label.toLowerCase()}</h1>
        <button type="button" className="btn-primary" onClick={() => setForm({})}><Plus size={18} />Cadastrar novo produto</button>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/45" />
          <input className="input !pl-10" placeholder="Pesquisar por nome do produto" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Pesquisar por nome" />
        </div>
        <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filtrar por marca">
          <option value="">Todas as marcas</option>{brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="input" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Filtrar por tamanho">
          <option value="">Todos os tamanhos</option>{SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input" value={avail} onChange={(e) => setAvail(e.target.value as Availability)} aria-label="Filtrar por disponibilidade">
          <option value="">Qualquer disponibilidade</option><option value="disponivel">Disponível</option>
          <option value="baixo">Estoque baixo</option><option value="zerado">Sem estoque</option>
        </select>
        <div className="flex gap-2">
          <select className="input" value={order} onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')} aria-label="Ordenação">
            <option value="asc">A → Z</option><option value="desc">Z → A</option>
          </select>
          <div className="flex overflow-hidden rounded-md border border-tinta/25" role="group" aria-label="Modo de visualização">
            {([['cards', LayoutGrid, 'Cards'], ['table', List, 'Tabela']] as const).map(([k, Icon, l]) => (
              <button key={k} type="button" aria-pressed={view === k} aria-label={l} onClick={() => setView(k)}
                className={`flex w-11 items-center justify-center ${view === k ? 'text-white' : 'text-tinta/70'}`} style={view === k ? { background: theme.main } : undefined}>
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBanner message="Não foi possível carregar o estoque." onRetry={() => q.refetch()} />}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState title={q.data.length === 0 ? 'Nenhum produto cadastrado nesta categoria' : 'Nenhum produto encontrado'}
          hint={q.data.length === 0 ? 'Cadastre o primeiro produto para começar a controlar o estoque.' : 'Ajuste a pesquisa ou os filtros.'}
          action={q.data.length === 0 ? <button type="button" className="btn-primary mt-2" onClick={() => setForm({})}><Plus size={18} />Cadastrar novo produto</button> : undefined} />
      )}

      {rows.length > 0 && view === 'cards' && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => <ProductCard key={p.id} product={p} onEdit={() => setForm({ product: p })} onAddStock={() => setStock(p)} />)}
        </div>
      )}

      {rows.length > 0 && view === 'table' && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-tinta/15 text-xs text-tinta/70">
              <tr><th className="p-3">Produto</th><th className="p-3">Tam.</th><th className="p-3">Marca</th><th className="p-3 text-right">Estoque</th><th className="p-3 text-right">Preço</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-tinta/10 last:border-0">
                  <td className="p-3"><div className="flex items-center gap-3"><div className="h-11 w-11 shrink-0 overflow-hidden rounded"><ProductImage path={p.image_path} alt="" /></div><span className="font-medium" style={{ color: theme.main }}>{p.name}</span></div></td>
                  <td className="p-3 font-bold" style={{ color: theme.main }}>{p.size}</td>
                  <td className="p-3">{p.brand}</td>
                  <td className="p-3 text-right font-semibold">{p.quantity}{stockLevel(p) !== 'ok' && <span className="ml-2 rounded bg-pendente px-1.5 py-0.5 text-[10px] font-bold">{stockLevel(p) === 'zerado' ? 'SEM' : 'BAIXO'}</span>}</td>
                  <td className="p-3 text-right">{formatBRL(p.price_cents)}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button type="button" className="btn-ghost !min-h-[36px]" onClick={() => setForm({ product: p })}>Editar</button>
                    <button type="button" className="btn-primary !min-h-[36px]" onClick={() => setStock(p)}>Adicionar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <ProductForm product={form.product} defaultCategory={theme.key} onClose={() => setForm(null)} />}
      {stock && <StockModal product={stock} onClose={() => setStock(null)} />}
    </div>
  )
}
