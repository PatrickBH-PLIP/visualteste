import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { CATEGORY_LIST } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { listProducts } from '@/services/products'
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
  const [qty, setQty] = useState('1')

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

  const sizes = useMemo(
    () => (groups.find(([k]) => k === group)?.[1] ?? []).slice().sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size)),
    [groups, group])
  const product = sizes.find((p) => p.id === productId)
  const n = Number(qty)
  const validQty = Number.isInteger(n) && n > 0
  const overStock = !!product && validQty && n > product.quantity

  const add = () => {
    if (!product || !validQty) return
    onAdd({ product_id: product.id, category: product.category, name: product.name, brand: product.brand, size: product.size,
      quantity: n, unit_price_cents: product.price_cents, available: product.quantity })
    setProductId(''); setQty('1')
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-lg">Adicionar produto</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">1. Categoria</span>
          <select className="input" value={category} onChange={(e) => { setCategory(e.target.value as Category); setGroup(''); setProductId('') }}>
            <option value="">Selecione</option>{CATEGORY_LIST.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select></label>
        <label><span className="label">2. Produto</span>
          <select className="input" value={group} disabled={!category || q.isLoading} onChange={(e) => { setGroup(e.target.value); setProductId('') }}>
            <option value="">{q.isLoading ? 'Carregando…' : 'Selecione'}</option>
            {groups.map(([k, list]) => <option key={k} value={k}>{list[0].name} — {list[0].brand}</option>)}
          </select></label>
        <label><span className="label">3. Tamanho</span>
          <select className="input" value={productId} disabled={!group} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Selecione</option>
            {sizes.map((p) => <option key={p.id} value={p.id} disabled={p.quantity === 0}>{p.size} ({p.quantity} em estoque)</option>)}
          </select></label>
        <label><span className="label">4. Quantidade</span>
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
