import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Box, ImageOff, Plus, Trash2 } from 'lucide-react'
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

function productKey(p: Product) {
  return [p.category, p.name.trim().toLocaleLowerCase('pt-BR'), p.brand.trim().toLocaleLowerCase('pt-BR'), p.image_path ?? ''].join('|')
}

export function StockIntakeModal({ onClose }: { onClose: () => void }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
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
  const selectedGroup = groups.find(g => g.key === selectedKey)
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
          <div><h3 className="font-semibold">1. Selecione o produto pela foto</h3><p className="text-sm text-tinta/60">O nome, a categoria e a marca aparecem abaixo de cada imagem.</p></div>
          {q.isLoading ? <p className="text-sm text-tinta/60">Carregando produtos…</p>
            : !groups.length ? <p className="text-sm text-tinta/60">Nenhum produto cadastrado.</p>
            : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {groups.map(group => {
                const active = selectedKey === group.key
                const categoryLabel = CATEGORY_LIST.find(c => c.key === group.product.category)?.label ?? group.product.category
                return <button type="button" key={group.key} onClick={() => { setSelectedKey(group.key); setSize(''); setQuantities({}); setError(null) }}
                  className={`overflow-hidden rounded-xl border text-left transition ${active ? 'border-chilli ring-2 ring-chilli/25' : 'border-tinta/15 hover:border-tinta/35'}`}>
                  {photo(group.product, 'aspect-square w-full object-cover')}
                  <div className="space-y-0.5 p-2.5">
                    <p className="line-clamp-2 text-sm font-semibold">{group.product.name}</p>
                    <p className="text-xs text-tinta/65">{categoryLabel}</p>
                    <p className="text-xs text-tinta/65">Marca: {group.product.brand || '—'}</p>
                  </div>
                </button>
              })}
            </div>}
        </section>

        {selectedGroup && <section className="space-y-3 rounded-xl border border-tinta/10 p-3">
          <h3 className="font-semibold">2. Escolha o tamanho</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map(s => <button type="button" key={s} onClick={() => { setSize(s); setQuantities({}); setError(null) }}
              className={`min-w-12 rounded-lg border px-4 py-2 text-sm font-semibold ${size === s ? 'border-chilli bg-chilli/10 text-chilli' : 'border-tinta/15'}`}>{s}</button>)}
          </div>
        </section>}

        {!!size && <section className="space-y-3 rounded-xl border border-tinta/10 p-3">
          <h3 className="font-semibold">3. Cores e 4. Quantidades</h3>
          <p className="text-sm text-tinta/60">Informe quantas unidades existem de cada cor para o tamanho {size}. Deixe em branco as cores que não deseja adicionar.</p>
          {sizeVariants.map(variant => <div key={variant.id} className="flex items-center gap-3 rounded-lg bg-white/50 p-2">
            {photo(variant, 'h-12 w-12 shrink-0 rounded-md object-cover')}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{variant.color || 'Sem cor cadastrada'}</p>
              <p className="text-xs text-tinta/60">Estoque atual: {variant.quantity}</p>
            </div>
            <input className="input !w-24" type="number" min={0} step={1} inputMode="numeric" placeholder="Qtd."
              aria-label={`Quantidade da cor ${variant.color || 'sem cor'}`} value={quantities[variant.id] ?? ''}
              onChange={e => setQuantities(current => ({ ...current, [variant.id]: e.target.value }))} />
          </div>)}
          <button type="button" className="btn-primary" onClick={addEntry}><Plus size={17}/> Adicionar cores deste tamanho</button>
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
