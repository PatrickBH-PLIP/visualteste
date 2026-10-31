import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Box, Check, ImageOff, Plus, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { ErrorBanner } from './ui'
import { CATEGORY_LIST } from '@/lib/categories'
import { listProducts, addStock, signedUrls, newOpId } from '@/services/products'
import { errorMessage } from '@/lib/supabase'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { SIZES, type Category, type Product } from '@/types'

type Entry = { product: Product; quantity: number }
export function StockIntakeModal({ onClose }: { onClose: () => void }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const [category, setCategory] = useState<Category | ''>('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [entries, setEntries] = useState<Entry[]>([])
  const [review, setReview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const operationIds = useRef(new Map<string, string>())

  const q = useQuery({ queryKey: ['products', companyId, category], queryFn: () => listProducts(companyId, category as Category), enabled: !!category })
  const imageUrls = useQuery({
    queryKey: ['stock-intake-images', companyId, q.data?.map(p => p.image_path).filter(Boolean).join('|')],
    queryFn: () => signedUrls(Array.from(new Set((q.data ?? []).map(p => p.image_path).filter((p): p is string => !!p)))),
    enabled: !!q.data?.length,
  })
  const variants = useMemo(() => (q.data ?? []).slice().sort((a,b) => a.name.localeCompare(b.name,'pt-BR') || SIZES.indexOf(a.size) - SIZES.indexOf(b.size) || (a.color ?? '').localeCompare(b.color ?? '', 'pt-BR')), [q.data])
  const selected = variants.find(p => p.id === variantId)
  const addEntry = () => {
    if (!selected || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return
    setEntries(cur => {
      const existing = cur.find(e => e.product.id === selected.id)
      return existing ? cur.map(e => e.product.id === selected.id ? { ...e, quantity: e.quantity + Number(quantity) } : e) : [...cur, { product: selected, quantity: Number(quantity) }]
    })
    setVariantId(''); setQuantity('1')
  }
  const confirm = async () => {
    setBusy(true); setError(null)
    try {
      for (const entry of entries) {
        let op = operationIds.current.get(entry.product.id)
        if (!op) { op = newOpId(); operationIds.current.set(entry.product.id, op) }
        await addStock(companyId, op, entry.product.id, entry.quantity, 'entrada_manual', 'Entrada de estoque em lote')
      }
      toast('ok', `Entrada registrada: ${entries.reduce((n,e)=>n+e.quantity,0)} unidade(s).`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }), qc.invalidateQueries({ queryKey: ['home'] }),
        qc.invalidateQueries({ queryKey: ['movements'] }),
      ])
      onClose()
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }

  return <Modal title="Adicionar estoque" onClose={busy ? () => {} : onClose} wide footer={<>
    <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
    {!review ? <button type="button" className="btn-primary" disabled={!entries.length} onClick={() => setReview(true)}>Confirmar lista ({entries.length})</button> :
      <><button type="button" className="btn-outline" onClick={() => setReview(false)} disabled={busy}><ArrowLeft size={16}/> Voltar</button>
      <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Registrando…' : 'Confirmar entrada no estoque'}</button></>}
  </>}>
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!review ? <>
        <div>
          <h3 className="mb-2 font-semibold">1. Escolha uma categoria</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORY_LIST.map(c => <button type="button" key={c.key} onClick={() => { setCategory(c.key); setVariantId('') }}
              className={`overflow-hidden rounded-xl border text-left transition ${category === c.key ? 'border-chilli ring-2 ring-chilli/20' : 'border-tinta/15'}`}>
              <div className="aspect-[4/3] bg-white/50"><img src={`/assets/categories/${c.slug}.jpg`} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display='none'; e.currentTarget.parentElement?.classList.add('flex','items-center','justify-center') }} /><ImageOff className="hidden" size={24}/></div>
              <p className="p-2 text-sm font-semibold" style={{color:c.main}}>{c.label}</p>
            </button>)}
          </div>
        </div>
        {category && <div className="space-y-3 rounded-xl border border-tinta/10 p-3">
          <h3 className="font-semibold">2. Escolha o produto, tamanho e cor</h3>
          {q.isLoading ? <p className="text-sm text-tinta/60">Carregando produtos…</p> : !variants.length ? <p className="text-sm text-tinta/60">Nenhum produto cadastrado nesta categoria.</p> :
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_100px_auto]">
            <select className="input min-w-0" value={variantId} onChange={e=>setVariantId(e.target.value)}>
              <option value="">Selecione um produto</option>
              {variants.map(p=><option key={p.id} value={p.id}>{p.name} — {p.brand} · {p.size}{p.color ? ` · ${p.color}` : ''} ({p.quantity} atual)</option>)}
            </select>
            <input className="input" type="number" min={1} inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value)} aria-label="Quantidade a adicionar"/>
            <button type="button" className="btn-primary" onClick={addEntry} disabled={!selected || !Number.isInteger(Number(quantity)) || Number(quantity)<=0}><Plus size={17}/> Adicionar</button>
          </div>}
          {selected && <div className="flex items-center gap-3 rounded-lg bg-white/50 p-2">
            <div className="h-16 w-16 overflow-hidden rounded bg-white">{selected.image_path && imageUrls.data?.[selected.image_path] ? <img src={imageUrls.data[selected.image_path]} alt="" className="h-full w-full object-cover"/> : <Box className="m-5 text-tinta/40" size={24}/>}</div>
            <div className="text-sm"><p className="font-semibold">{selected.name}</p><p className="text-tinta/65">{selected.brand} · Tamanho {selected.size}{selected.color ? ` · ${selected.color}` : ''}</p><p>Estoque atual: {selected.quantity}</p></div>
          </div>}
        </div>}
        {entries.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Itens que serão adicionados</h3>{entries.map(e=><div key={e.product.id} className="flex items-center gap-3 rounded-lg border border-tinta/10 p-2">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/50">{e.product.image_path && imageUrls.data?.[e.product.image_path] ? <img src={imageUrls.data[e.product.image_path]} alt="" className="h-full w-full object-cover"/> : null}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{e.product.name}</p><p className="text-xs text-tinta/65">{e.product.size}{e.product.color ? ` · ${e.product.color}` : ''} · +{e.quantity} unidade(s)</p></div>
          <button type="button" className="btn-ghost !px-2 !text-chilli" aria-label="Remover item" onClick={()=>setEntries(cur=>cur.filter(x=>x.product.id!==e.product.id))}><Trash2 size={17}/></button>
        </div>)}</div>}
      </> : <div className="space-y-3">
        <div className="rounded-xl bg-white/60 p-3"><h3 className="font-semibold">Confira a entrada antes de confirmar</h3><p className="text-sm text-tinta/65">O estoque só será alterado depois do segundo botão de confirmação.</p></div>
        {entries.map(e=><div key={e.product.id} className="flex items-center gap-3 rounded-lg border border-tinta/10 p-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-white/50">{e.product.image_path && imageUrls.data?.[e.product.image_path] ? <img src={imageUrls.data[e.product.image_path]} alt="" className="h-full w-full object-cover"/> : null}</div>
          <div className="min-w-0 flex-1"><p className="font-semibold">{e.product.name}</p><p className="text-sm text-tinta/65">{e.product.brand} · {e.product.size}{e.product.color ? ` · ${e.product.color}` : ''}</p><p className="text-sm">Atual: {e.product.quantity} → após entrada: <strong>{e.product.quantity + e.quantity}</strong></p></div><span className="font-bold">+{e.quantity}</span>
        </div>)}
        <p className="text-right font-bold">Total de unidades: {entries.reduce((n,e)=>n+e.quantity,0)}</p>
      </div>}
    </div>
  </Modal>
}
