import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageCheck } from 'lucide-react'
import { Modal } from './Modal'
import { ErrorBanner, Field } from './ui'
import { setStockQuantity } from '@/services/products'
import { errorMessage, newId } from '@/lib/supabase'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Product } from '@/types'

export function StockAdjustmentModal({ products, initialProduct, onClose }: {
  products: Product[]; initialProduct?: Product; onClose: () => void
}) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const opId = useRef(newId())
  const [productId, setProductId] = useState(initialProduct?.id ?? products[0]?.id ?? '')
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId])
  const [quantity, setQuantity] = useState(String(initialProduct?.quantity ?? products[0]?.quantity ?? 0))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const next = Number(quantity)
  const valid = quantity.trim() !== '' && Number.isInteger(next) && next >= 0
  const delta = product ? next - product.quantity : 0

  const mutation = useMutation({
    mutationFn: () => setStockQuantity(companyId, opId.current, product!.id, next, reason.trim() || 'Ajuste manual de estoque'),
    onSuccess: (r) => {
      toast('ok', `Estoque ajustado para ${r.quantity} unidades.`)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['home'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Modal title="Ajuste de estoque" onClose={mutation.isPending ? () => {} : onClose}
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={!valid || !product || mutation.isPending} onClick={() => { setError(null); mutation.mutate() }}>
          <PackageCheck size={18} />{mutation.isPending ? 'Salvando…' : 'Confirmar ajuste'}
        </button>
      </>}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {products.length > 1 && <Field label="Produto, tamanho e cor">
          <select className="input" value={productId} onChange={(e) => {
            const p = products.find((item) => item.id === e.target.value)
            setProductId(e.target.value)
            setQuantity(String(p?.quantity ?? 0))
          }}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.size} · {p.color || 'Sem cor'}</option>)}
          </select>
        </Field>}
        {product && <div className="rounded-xl border border-tinta/10 bg-white/60 p-4">
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm text-tinta/70">{product.brand} · Tamanho {product.size} · {product.color || 'Cor não informada'}</p>
          <p className="mt-2 text-sm">Estoque atual: <strong>{product.quantity} unidades</strong></p>
        </div>}
        <Field label="Nova quantidade em estoque" error={quantity !== '' && !valid ? 'Informe um número inteiro igual ou maior que zero.' : undefined}
          hint={valid && product ? delta === 0 ? 'A quantidade permanecerá igual.' : `${delta > 0 ? 'Aumento' : 'Redução'} de ${Math.abs(delta)} unidade(s). Novo total: ${next}.` : 'Informe a quantidade total que deverá ficar no estoque.'}>
          <input className="input" type="number" inputMode="numeric" min={0} step={1} autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Motivo do ajuste (opcional)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: conferência física do estoque" />
        </Field>
        <p className="text-xs text-tinta/60">O ajuste registra a diferença no histórico de movimentações. Apenas administradores podem confirmar alterações.</p>
      </div>
    </Modal>
  )
}
