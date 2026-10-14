import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { ErrorBanner, Field } from './ui'
import { PAYMENT_METHODS } from '@/lib/categories'
import { centsToInput, formatBRL, parseBRL } from '@/lib/money'
import { errorMessage, newId } from '@/lib/supabase'
import { registerPayment, registerRefund } from '@/services/sales'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { SaleSummary } from '@/types'

function nowLocalInput() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function PaymentModal({ sale, mode = 'payment', onClose }: { sale: SaleSummary; mode?: 'payment' | 'refund'; onClose: () => void }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const toast = useToast()
  const opId = useRef(newId())
  const refund = mode === 'refund'
  const limit = refund ? (sale.status === 'CANCELADA' ? sale.paid_cents : Math.max(-sale.balance_cents, 0)) : Math.max(sale.balance_cents, 0)

  const [amount, setAmount] = useState(centsToInput(limit))
  const [method, setMethod] = useState('pix')
  const [at, setAt] = useState(nowLocalInput())
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cents = parseBRL(amount)
  const invalid = !cents || cents <= 0 ? 'Informe um valor maior que zero' : cents > limit ? `O máximo permitido é ${formatBRL(limit)}` : null

  const m = useMutation({
    mutationFn: () => refund
      ? registerRefund(companyId, opId.current, { saleId: sale.id, amountCents: cents!, method, notes })
      : registerPayment(companyId, opId.current, { saleId: sale.id, amountCents: cents!, method, reference: ref, notes, receivedAt: new Date(at).toISOString() }),
    onSuccess: () => {
      toast('ok', refund ? 'Devolução registrada.' : cents === limit ? 'Pagamento registrado — venda quitada.' : 'Pagamento parcial registrado.')
      qc.invalidateQueries(); onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Modal title={refund ? 'Registrar devolução' : 'Registrar pagamento'} onClose={m.isPending ? () => {} : onClose}
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose} disabled={m.isPending}>Cancelar</button>
        <button type="button" className="btn-primary" disabled={!!invalid || m.isPending} onClick={() => { setError(null); m.mutate() }}>{m.isPending ? 'Registrando…' : 'Confirmar'}</button>
      </>}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="rounded-lg bg-white/60 p-3 text-sm">
          <p className="font-semibold">Venda nº {sale.sale_number} — {sale.customer_name}</p>
          <p>Total {formatBRL(sale.net_cents)} · Pago {formatBRL(sale.paid_cents)} · {refund ? `A devolver ${formatBRL(limit)}` : `Saldo ${formatBRL(limit)}`}</p>
        </div>
        <Field label="Valor (R$)" error={invalid ?? undefined}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Forma de pagamento"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
        {!refund && <Field label="Data e hora do recebimento"><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>}
        {!refund && <Field label="Referência / comprovante (opcional)"><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
        <Field label="Observações (opcional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
