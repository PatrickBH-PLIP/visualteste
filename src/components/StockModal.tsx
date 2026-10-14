import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { ErrorBanner, Field } from './ui'
import { addStock } from '@/services/products'
import { errorMessage, newId } from '@/lib/supabase'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Product } from '@/types'

export function StockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { companyId, role } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const opId = useRef(newId())
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'entrada_manual' | 'devolucao' | 'ajuste'>('entrada_manual')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const n = Number(qty)
  const valid = Number.isInteger(n) && n > 0

  const m = useMutation({
    mutationFn: () => {
      const label = type === 'entrada_manual' ? 'Compra' : type === 'devolucao' ? 'Devolução' : 'Ajuste autorizado'
      return addStock(companyId, opId.current, product.id, n, type, note ? `${label}: ${note}` : label)
    },
    onSuccess: (r) => {
      toast('ok', `Estoque atualizado: ${r.quantity} unidades.`)
      qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['home'] }); qc.invalidateQueries({ queryKey: ['movements'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Modal title="Adicionar ao estoque" onClose={m.isPending ? () => {} : onClose}
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose} disabled={m.isPending}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={!valid || m.isPending} onClick={() => { setError(null); m.mutate() }}>
          {m.isPending ? 'Confirmando…' : 'Confirmar entrada'}
        </button>
      </>}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="rounded-lg bg-white/60 p-3 text-sm">
          <p className="font-semibold">{product.name}</p>
          <p>Tamanho {product.size} · {product.brand}</p>
          <p className="mt-1">Quantidade atual: <strong>{product.quantity}</strong></p>
        </div>
        <Field label="Quantidade a adicionar" error={qty && !valid ? 'Informe um número inteiro maior que zero' : undefined}
          hint={valid ? `Ficará com ${product.quantity + n} unidades.` : undefined}>
          <input className="input" type="number" inputMode="numeric" min={1} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Motivo da entrada">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="entrada_manual">Compra</option>
            <option value="devolucao">Devolução</option>
            {role === 'admin' && <option value="ajuste">Ajuste autorizado</option>}
          </select>
        </Field>
        <Field label="Observação (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
