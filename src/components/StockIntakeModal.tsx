import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ImageOff, Plus, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { ErrorBanner } from './ui'
import { CATEGORY_LIST } from '@/lib/categories'
import { listProducts, addStock, signedUrls, newOpId } from '@/services/products'
import { errorMessage } from '@/lib/supabase'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { SIZES, type Product } from '@/types'

type Entry = { product: Product; quantity: number }
type ProductGroup = { key: string; product: Product; variants: Product[] }

function colorHex(value: string | null) {
  const key = (value ?? '').trim().toLocaleLowerCase('pt-BR')
  const colors: Record<string, string> = {
    preto: '#171717', branco: '#ffffff', cinza: '#888888', vermelho: '#e53935',
    rosa: '#f48fb1', terracota: '#c46d50', bege: '#d8c3a5', amarelo: '#fdd835',
    azul: '#1976d2', verde: '#2e7d32', roxo: '#7e57c2', marrom: '#795548',
    vinho: '#722f37', nude: '#d8b49c', lilás: '#b39ddb', laranja: '#ef6c00',
  }
  return colors[key] ?? '#d7c8bb'
}

function productKey(p: Product) {
  return [p.category, p.name.trim().toLocaleLowerCase('pt-BR')].join('|')
}

export function StockIntakeModal({ onClose }: { onClose: () => void }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const [selectedCategory, setSelectedCategory] = useState<Product['category'] | ''>('')
  const [selectedKey, setSelectedKey] = useState('')
  const [size, setSize] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<Entry[]>([])
  const [review, setReview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const operationIds = useRef(new Map<string, string>())

  const q = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => listProducts(companyId),
  })
  const imageUrls = useQuery({
    queryKey: ['stock-intake-images', companyId, q.data?.map(p => p.image_path).filter(Boolean).join('|')],
    queryFn: () => signedUrls(Array.from(new Set((q.data ?? []).map(p => p.image_path).filter((p): p is string => !!p)))),
    enabled: !!q.data?.length,
  })

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>()
    for (const p of q.data ?? []) {
      const key = productKey(p)
      const group = map.get(key)
      if (group) group.variants.push(p)
      else map.set(key, { key, product: p, variants: [p] })
    }
    return Array.from(map.values()).sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'))
  }, [q.data])
  const categoryGroups = groups.filter(g => g.product.category === selectedCategory)
  const selectedGroup = categoryGroups.find(g => g.key === selectedKey)
  const sizes = useMemo(() => {
    if (!selectedGroup) return []
    return Array.from(new Set(selectedGroup.variants.map(p => p.size))).sort((a, b) => SIZES.indexOf(a as typeof SIZES[number]) - SIZES.indexOf(b as typeof SIZES[number]))
  }, [selectedGroup])
  const sizeVariants = selectedGroup?.variants.filter(p => p.size === size) ?? []

  const addEntry = () => {
    const chosen = sizeVariants.flatMap(product => {
      const raw = quantities[product.id] ?? ''
      const qty = Number(raw)
      return Number.isInteger(qty) && qty > 0 ? [{ product, quantity: qty }] : []
    })
    if (!chosen.length) {
      setError('Informe uma quantidade maior que zero para pelo menos uma cor.')
      return
    }
    setEntries(current => {
      const next = [...current]
      for (const item of chosen) {
        const existing = next.find(e => e.product.id === item.product.id)
        if (existing) existing.quantity += item.quantity
        else next.push(item)
      }
      return next
    })
    setQuantities({})
    setError(null)
  }

  const confirm = async () => {
    setBusy(true); setError(null)
    try {
      for (const entry of entries) {
        let op = operationIds.current.get(entry.product.id)
        if (!op) { op = newOpId(); operationIds.current.set(entry.product.id, op) }
        await addStock(companyId, op, entry.product.id, entry.quantity, 'entrada_manual', 'Entrada de estoque em lote')
      }
      toast('ok', `Entrada registrada: ${entries.reduce((n, e) => n + e.quantity, 0)} unidade(s).`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['home'] }),
        qc.invalidateQueries({ queryKey: ['movements'] }),
      ])
      onClose()
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }

  const photo = (product: Product, className: string) => {
    const url = product.image_path ? imageUrls.data?.[product.image_path] : null
    return url
      ? <img src={url} alt={product.name} className={className} />
      : <div className={`${className} flex items-center justify-center bg-white/60 text-tinta/35`}><ImageOff size={24} /></div>
  }

  return <Modal title="Adicionar estoque" onClose={busy ? () => {} : onClose} wide footer={<>
    <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
    {!review
      ? <button type="button" className="btn-primary" disabled={!entries.length} onClick={() => setReview(true)}>Revisar entrada ({entries.length})</button>
      : <><button type="button" className="btn-outline" onClick={() => setReview(false)} disabled={busy}><ArrowLeft size={16}/> Voltar</button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Registrando…' : 'Confirmar entrada no estoque'}</button></>}
  </>}>
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!review ? <>
        <section className="space-y-3">
          <div><h3 className="font-semibold">1. Selecione a categoria</h3><p className="text-sm text-tinta/60">Escolha uma categoria para visualizar os produtos.</p></div>
          {q.isLoading ? <p className="text-sm text-tinta/60">Carregando produtos…</p>
            : !groups.length ? <p className="text-sm text-tinta/60">Nenhum produto cadastrado.</p>
            : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORY_LIST.filter(category => groups.some(group => group.product.category === category.key)).map(category => {
                const active = selectedCategory === category.key
                const total = groups.filter(group => group.product.category === category.key).length
                return <button type="button" key={category.key} onClick={() => { setSelectedCategory(category.key); setSelectedKey(''); setSize(''); setQuantities({}); setError(null) }}
                  className={`rounded-2xl border p-4 text-left transition ${active ? 'border-chilli bg-chilli/10 ring-2 ring-chilli/25' : 'border-tinta/15 bg-white/55 hover:border-tinta/35'}`}>
                  <p className="font-semibold">{category.label}</p><p className="mt-1 text-xs text-tinta/60">{total} produto(s)</p>
                </button>
              })}
            </div>}
        </section>

        {selectedCategory && <section className="space-y-3">
          <div><h3 className="font-semibold">2. Escolha o produto</h3><p className="text-sm text-tinta/60">Produtos com o mesmo nome aparecem agrupados.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryGroups.map(group => {
              const active = selectedKey === group.key
              return <button type="button" key={group.key} onClick={() => { setSelectedKey(group.key); setSize(''); setQuantities({}); setError(null) }}
                className={`relative overflow-hidden rounded-2xl border bg-white/55 text-left shadow-sm transition ${active ? 'border-chilli ring-2 ring-chilli/30 shadow-md' : 'border-tinta/15 hover:border-tinta/35'}`}>
                {photo(group.product, 'aspect-[4/3] w-full object-cover')}
                {active && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-chilli text-white shadow"><Check size={16}/></span>}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{group.product.name}</p>
                  <p className="truncate text-xs text-tinta/65">Marca: {group.product.brand || '—'}</p>
                  <p className="text-xs text-tinta/60">{group.variants.length} variação(ões)</p>
                </div>
              </button>
            })}
          </div>
        </section>}

        {selectedGroup && <section className="space-y-3 rounded-xl border border-tinta/10 p-3">
          <div><h3 className="font-semibold">3. Escolha o tamanho</h3><p className="text-xs text-tinta/60">Toque no tamanho que deseja repor.</p></div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {sizes.map(s => {
              const count = selectedGroup?.variants.filter(p => p.size === s).reduce((n, p) => n + p.quantity, 0) ?? 0
              return <button type="button" key={s} onClick={() => { setSize(s); setQuantities({}); setError(null) }}
                className={`rounded-xl border px-3 py-3 text-center transition ${size === s ? 'border-chilli bg-chilli/10 text-chilli ring-2 ring-chilli/20' : 'border-tinta/15 bg-white/50 hover:border-tinta/35'}`}>
                <span className="block text-base font-bold">{s}</span><span className="mt-0.5 block text-[11px] opacity-65">{count} em estoque</span>
              </button>
            })}
          </div>
        </section>}

        {!!size && <section className="space-y-3 rounded-xl border border-tinta/10 p-3">
          <div><h3 className="font-semibold">4. Escolha as cores e quantidades</h3><p className="text-xs text-tinta/60">Cada cor possui sua própria quantidade.</p></div>
          <p className="text-sm text-tinta/60">Informe quantas unidades existem de cada cor para o tamanho {size}. Deixe em branco as cores que não deseja adicionar.</p>
          {sizeVariants.map(variant => {
            const chosen = Number(quantities[variant.id] ?? 0) > 0
            return <div key={variant.id} className={`flex items-center gap-3 rounded-xl border p-3 transition ${chosen ? 'border-chilli/50 bg-chilli/5' : 'border-tinta/10 bg-white/55'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ring-1 ring-tinta/15" style={{ backgroundColor: variant.color_hex || colorHex(variant.color) }} aria-label={`Amostra da cor ${variant.color || 'sem cor'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{variant.color || 'Sem cor cadastrada'}</p>
                <p className="text-xs text-tinta/60">Estoque atual: {variant.quantity}</p>
              </div>
              <label className="w-[5.5rem] shrink-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-tinta/55">Adicionar</span>
                <input className="input !px-2 text-center" type="number" min={0} step={1} inputMode="numeric" placeholder="0"
                  aria-label={`Quantidade da cor ${variant.color || 'sem cor'}`} value={quantities[variant.id] ?? ''}
                  onChange={e => setQuantities(current => ({ ...current, [variant.id]: e.target.value }))} />
              </label>
              {chosen && <Check size={17} className="shrink-0 text-chilli"/>}
            </div>
          })}
          <button type="button" className="btn-primary w-full justify-center" onClick={addEntry}><Plus size={17}/> Adicionar cores deste tamanho</button>
        </section>}

        {entries.length > 0 && <section className="space-y-2">
          <h3 className="font-semibold">Itens que serão adicionados</h3>
          {entries.map(entry => <div key={entry.product.id} className="flex items-center gap-3 rounded-lg border border-tinta/10 p-2">
            {photo(entry.product, 'h-12 w-12 shrink-0 rounded object-cover')}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.product.name}</p>
              <p className="text-xs text-tinta/65">{entry.product.size} · {entry.product.color || 'Sem cor'} · +{entry.quantity} unidade(s)</p></div>
            <button type="button" className="btn-ghost !px-2 !text-chilli" aria-label="Remover item" onClick={() => setEntries(current => current.filter(x => x.product.id !== entry.product.id))}><Trash2 size={17}/></button>
          </div>)}
        </section>}
      </> : <div className="space-y-3">
        <div className="rounded-xl bg-white/60 p-3"><h3 className="font-semibold">Confira a entrada antes de confirmar</h3><p className="text-sm text-tinta/65">O estoque só será alterado depois da confirmação.</p></div>
        {entries.map(entry => <div key={entry.product.id} className="flex items-center gap-3 rounded-lg border border-tinta/10 p-3">
          {photo(entry.product, 'h-14 w-14 shrink-0 rounded object-cover')}
          <div className="min-w-0 flex-1"><p className="font-semibold">{entry.product.name}</p>
            <p className="text-sm text-tinta/65">{entry.product.brand} · {entry.product.size} · {entry.product.color || 'Sem cor'}</p>
            <p className="text-sm">Atual: {entry.product.quantity} → após entrada: <strong>{entry.product.quantity + entry.quantity}</strong></p></div>
          <span className="font-bold">+{entry.quantity}</span>
        </div>)}
        <p className="text-right font-bold">Total de unidades: {entries.reduce((n, e) => n + e.quantity, 0)}</p>
      </div>}
    </div>
  </Modal>
}
