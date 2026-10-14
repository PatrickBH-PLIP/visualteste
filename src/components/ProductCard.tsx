import { ImageOff, Pencil, PackagePlus } from 'lucide-react'
import { formatBRL } from '@/lib/money'
import { CATEGORIES } from '@/lib/categories'
import { useProductImage } from '@/hooks/useProductImage'
import type { Product } from '@/types'

export function ProductImage({ path, alt, className = '' }: { path: string | null; alt: string; className?: string }) {
  const url = useProductImage(path)
  return url ? (
    <img src={url} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-tinta/5 text-tinta/40" aria-label="Sem foto">
      <ImageOff size={26} /><span className="text-xs">Sem foto</span>
    </div>
  )
}

export function stockLevel(p: Product): 'ok' | 'baixo' | 'zerado' {
  if (p.quantity === 0) return 'zerado'
  return p.quantity <= p.min_stock ? 'baixo' : 'ok'
}

export function ProductCard({ product: p, onEdit, onAddStock }: { product: Product; onEdit: () => void; onAddStock: () => void }) {
  const t = CATEGORIES[p.category]
  const level = stockLevel(p)
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/50">
        <ProductImage path={p.image_path} alt={p.name} />
        <button type="button" onClick={onEdit} aria-label={`Editar ${p.name}`}
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-bege/95 shadow-suave hover:bg-white" style={{ color: t.main }}>
          <Pencil size={18} />
        </button>
        <span className="absolute left-2 top-2 rounded-md px-3 py-1 font-serif text-xl font-bold text-white shadow-suave" style={{ background: t.main }}>{p.size}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-semibold leading-snug" style={{ color: t.main }}>{p.name}</h3>
        <p className="text-sm" style={{ color: t.accentText }}>{p.brand} · {p.material}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-sm" style={{ color: t.accentText }}>Em estoque</p>
            <p className="text-2xl font-bold" style={{ color: t.main }}>{p.quantity}</p>
          </div>
          <p className="text-lg font-semibold">{formatBRL(p.price_cents)}</p>
        </div>
        {level !== 'ok' && (
          <p className={`mt-1 inline-flex w-fit rounded px-2 py-0.5 text-xs font-bold ${level === 'zerado' ? 'bg-atrasado text-white' : 'bg-pendente text-tinta'}`}>
            {level === 'zerado' ? 'SEM ESTOQUE' : 'ESTOQUE BAIXO'}
          </p>
        )}
        <button type="button" onClick={onAddStock} className="btn-primary mt-3 w-full" style={{ background: t.main }}>
          <PackagePlus size={18} />Adicionar ao estoque
        </button>
      </div>
    </article>
  )
}
