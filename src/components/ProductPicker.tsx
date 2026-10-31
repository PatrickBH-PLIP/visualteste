import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronDown } from 'lucide-react'
import { CATEGORY_LIST } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { listProducts, signedUrls } from '@/services/products'
import { useCompany } from '@/hooks/useAuth'
import { SIZES, type Category, type Product } from '@/types'

export interface CartItem {
  product_id: string
  category: Category
  name: string
  brand: string
  size: string
  quantity: number
  unit_price_cents: number
  /** estoque disponível visto na tela (só para aviso; o banco decide de verdade) */
  available?: number
}

/** Categoria → produto → tamanho → quantidade → adicionar. Preço vem do cadastro. */
export function ProductPicker({ onAdd }: { onAdd: (item: CartItem) => void }) {
  const { companyId } = useCompany()
  const [category, setCategory] = useState<Category | ''>('')
  const [group, setGroup] = useState('')
  const [productId, setProductId] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [qty, setQty] = useState('1')
  const [menuOpen, setMenuOpen] = useState(false)

  const q = useQuery({
    queryKey: ['products', companyId, category],
    queryFn: () => listProducts(companyId, category as Category),
    enabled: !!category,
  })

  const groups = useMemo(() => {
    const m = new Map<string, Product[]>()
    for (const p of q.data ?? []) {
      const k = `${p.name}||${p.brand}`
      m.set(k, [...(m.get(k) ?? []), p])
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [q.data])

  const imageUrls = useQuery({
    queryKey: ['product-picker-images', companyId, q.data?.map((p) => p.image_path).filter(Boolean).join('|')],
    queryFn: () => signedUrls(Array.from(new Set((q.data ?? []).map((p) => p.image_path).filter((p): p is string => !!p)))),
    enabled: !!q.data?.length,
  })
  const variants = useMemo(
    () => (groups.find(([k]) => k === group)?.[1] ?? []).slice().sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size) || (a.color ?? '').localeCompare(b.color ?? '', 'pt-BR')),
    [groups, group])
  const sizes = useMemo(() => Array.from(new Set(variants.map(p => p.size))), [variants])
  const colorVariants = variants.filter(p => p.size === selectedSize)
  const colors = Array.from(new Set(colorVariants.map(p => p.color ?? '')))
  const product = variants.find((p) => p.id === productId)
  const n = Number(qty)
  const validQty = Number.isInteger(n) && n > 0
  const overStock = !!product && validQty && n > product.quantity

  const add = () => {
    if (!product || !validQty) return
    onAdd({ product_id: product.id, category: product.category, name: product.name, brand: product.brand, size: product.size, color: product.color,
      quantity: n, unit_price_cents: product.price_cents, available: product.quantity })
    setProductId(''); setSelectedSize(''); setQty('1')
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-lg">Adicionar produto</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">1. Categoria</span>
          <select className="input" value={category} onChange={(e) => { setCategory(e.target.value as Category); setGroup(''); setProductId(''); setSelectedSize('') }}>
            <option value="">Selecione</option>{CATEGORY_LIST.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select></label>
        <label className="hidden md:block relative"><span className="label">2. Produto</span>
          <button type="button" className="input flex items-center justify-between gap-2 text-left" disabled={!category || q.isLoading}
            onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
            <span className="flex min-w-0 items-center gap-2">
              {group && groups.find(([k]) => k === group)?.[1][0].image_path ? <img className="h-10 w-10 rounded object-cover" src={imageUrls.data?.[groups.find(([k]) => k === group)![1][0].image_path!] ?? ''} alt="" /> : null}
              <span className="truncate">{group ? groups.find(([k]) => k === group)?.[1][0].name + ' — ' + groups.find(([k]) => k === group)?.[1][0].brand : q.isLoading ? 'Carregando…' : 'Selecione um produto'}</span>
            </span>
            <ChevronDown size={16} className="shrink-0" />
          </button>
          {menuOpen && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-tinta/15 bg-bege p-1 shadow-xl">
            {groups.map(([k, list]) => {
              const p = list[0]
              return <button key={k} type="button" onClick={() => { setGroup(k); setProductId(''); setSelectedSize(''); setMenuOpen(false) }}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-tinta/5 ${group === k ? 'bg-tinta/10' : ''}`}>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/50">
                  {p.image_path && imageUrls.data?.[p.image_path] ? <img src={imageUrls.data[p.image_path]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-tinta/50">Sem foto</div>}
                </div>
                <span className="min-w-0"><span className="block font-medium">{p.name}</span><span className="block text-xs text-tinta/60">{p.brand} · {list.map((x) => x.size).join(', ')}</span></span>
              </button>
            })}
            {!groups.length && <p className="p-3 text-sm text-tinta/60">Nenhum produto nesta categoria.</p>}
          </div>}
        </label>
        <label className="md:hidden"><span className="label">2. Produto</span>
          <select className="input" value={group} disabled={!category || q.isLoading} onChange={(e) => { setGroup(e.target.value); setProductId(''); setSelectedSize('') }}>
            <option value="">{q.isLoading ? 'Carregando…' : 'Selecione'}</option>
            {groups.map(([k, list]) => <option key={k} value={k}>{list[0].name} — {list[0].brand}</option>)}
          </select></label>
        <label><span className="label">3. Tamanho</span>
          <select className="input" value={selectedSize} disabled={!group} onChange={(e) => { setSelectedSize(e.target.value); setProductId('') }}>
            <option value="">Selecione</option>
            {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select></label>
        <label><span className="label">4. Cor</span>
          <select className="input" value={productId} disabled={!selectedSize} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Selecione</option>
            {colorVariants.map((p) => <option key={p.id} value={p.id} disabled={p.quantity === 0}>{p.color || 'Sem cor'} ({p.quantity} em estoque)</option>)}
          </select></label>
        <label><span className="label">5. Quantidade</span>
          <input className="input" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      </div>
      {product && (
        <p className="text-sm">Preço unitário: <strong>{formatBRL(product.price_cents)}</strong>
          {validQty && <> · Subtotal do item: <strong>{formatBRL(product.price_cents * n)}</strong></>}</p>
      )}
      {overStock && <p className="field-error" role="alert">Há apenas {product!.quantity} unidade(s) em estoque.</p>}
      <button type="button" className="btn-primary" disabled={!product || !validQty || overStock} onClick={add}>
        <Plus size={18} />Adicionar produto à compra
      </button>
    </div>
  )
}
