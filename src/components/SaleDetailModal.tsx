import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Pencil, Send, Undo2, XCircle } from 'lucide-react'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { PaymentModal } from './PaymentModal'
import { ShareModal } from './ShareModal'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorBanner, Spinner } from './ui'
import { methodLabel } from '@/lib/categories'
import { formatBRL } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { errorMessage, newId } from '@/lib/supabase'
import { cancelSale, getSale, listPayments, listSaleItems, reversePayment } from '@/services/sales'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Payment } from '@/types'

export function SaleDetailModal({ saleId, onClose, startWith }: { saleId: string; onClose: () => void; startWith?: 'payment' }) {
  const { companyId, role } = useCompany()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [sub, setSub] = useState<'payment' | 'refund' | 'share' | 'cancel' | { reverse: Payment } | null>(startWith ?? null)
  const [error, setError] = useState<string | null>(null)
  const opId = useRef(newId())

  const sale = useQuery({ queryKey: ['sale', saleId], queryFn: () => getSale(saleId) })
  const items = useQuery({ queryKey: ['sales', 'items', saleId], queryFn: () => listSaleItems([saleId]) })
  const pays = useQuery({ queryKey: ['payments', saleId], queryFn: () => listPayments(saleId) })

  const cancel = useMutation({
    mutationFn: (reason: string) => cancelSale(companyId, opId.current, saleId, reason),
    onSuccess: (r) => {
      qc.invalidateQueries(); setSub(null)
      toast('ok', r.refund_due_cents > 0 ? `Venda cancelada. Há ${formatBRL(r.refund_due_cents)} já recebidos: registre a devolução ou crédito ao cliente.` : 'Venda cancelada e estoque devolvido.')
    },
    onError: (e) => { setSub(null); setError(errorMessage(e)); opId.current = newId() },
  })
  const reverse = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reversePayment(companyId, opId.current, id, reason),
    onSuccess: () => { qc.invalidateQueries(); setSub(null); toast('ok', 'Pagamento estornado. O registro foi mantido no histórico.'); opId.current = newId() },
    onError: (e) => { setSub(null); setError(errorMessage(e)); opId.current = newId() },
  })

  const s = sale.data
  const loading = sale.isLoading || items.isLoading || pays.isLoading

  return (
    <>
      <Modal title={s ? `Venda nº ${s.sale_number}` : 'Venda'} onClose={onClose} wide>
        {loading && <Spinner />}
        {(sale.isError || items.isError || pays.isError) && <ErrorBanner message="Não foi possível carregar a venda." onRetry={() => { sale.refetch(); items.refetch(); pays.refetch() }} />}
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        {s && items.data && pays.data && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-lg font-semibold">{s.customer_name}</p><p className="text-sm text-tinta/70">{s.customer_phone}</p></div>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-sm">Compra: {formatDate(s.purchase_date)} · Pagamento previsto: {formatDate(s.due_date)}</p>
            {s.cancelled_at && <p className="rounded bg-tinta/10 p-2 text-sm">Cancelada em {formatDateTime(s.cancelled_at)} — {s.cancel_reason}</p>}

            <ul className="divide-y divide-tinta/10 rounded-lg border border-tinta/10">
              {items.data.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 p-3 text-sm">
                  <span>{i.product_name} <span className="text-tinta/60">({i.brand}) · tam. {i.size} · {i.quantity} × {formatBRL(i.unit_price_cents)}</span></span>
                  <strong>{formatBRL(i.quantity * i.unit_price_cents)}</strong>
                </li>
              ))}
            </ul>

            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Bruto</dt><dd>{formatBRL(s.gross_cents)}</dd></div>
              <div className="flex justify-between"><dt>Desconto</dt><dd>− {formatBRL(s.discount_cents)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Líquido</dt><dd>{formatBRL(s.net_cents)}</dd></div>
              <div className="flex justify-between"><dt>Pago</dt><dd>{formatBRL(s.paid_cents)}</dd></div>
              <div className="flex justify-between font-bold"><dt>{s.balance_cents < 0 ? 'A devolver' : 'Saldo pendente'}</dt><dd>{formatBRL(Math.abs(s.balance_cents))}</dd></div>
            </dl>

            <div>
              <h3 className="mb-2 text-lg">Pagamentos</h3>
              {pays.data.length === 0 ? <p className="text-sm text-tinta/70">Nenhum pagamento registrado.</p> : (
                <ul className="space-y-1.5">
                  {pays.data.map((p) => (
                    <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-tinta/10 p-2.5 text-sm ${p.reversed_at ? 'opacity-60' : ''}`}>
                      <span className={p.reversed_at ? 'line-through' : ''}>{formatDateTime(p.received_at)} · {methodLabel(p.method)}{p.kind === 'refund' && ' · devolução'}{p.reference && ` · ${p.reference}`}</span>
                      <span className="flex items-center gap-2">
                        <strong className={p.reversed_at ? 'line-through' : ''}>{p.kind === 'refund' ? '− ' : ''}{formatBRL(p.amount_cents)}</strong>
                        {p.reversed_at ? <span className="text-xs">estornado: {p.reversal_reason}</span>
                          : role === 'admin' && <button type="button" className="btn-ghost !min-h-[32px] !px-2 !text-chilli" onClick={() => setSub({ reverse: p })}><Undo2 size={14} />Estornar</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-tinta/10 pt-4">
              {!s.cancelled_at && s.balance_cents > 0 && <button type="button" className="btn-primary" onClick={() => setSub('payment')}><Banknote size={18} />Registrar pagamento</button>}
              {s.balance_cents < 0 && !s.cancelled_at && <button type="button" className="btn-primary" onClick={() => setSub('refund')}><Undo2 size={18} />Registrar devolução</button>}
              {s.cancelled_at && s.paid_cents > 0 && <button type="button" className="btn-primary" onClick={() => setSub('refund')}><Undo2 size={18} />Registrar devolução</button>}
              {!s.cancelled_at && <button type="button" className="btn-outline" onClick={() => nav(`/vendas/${s.id}/editar`)}><Pencil size={18} />Editar</button>}
              <button type="button" className="btn-outline" onClick={() => setSub('share')}><Send size={18} />Enviar ao cliente</button>
              {!s.cancelled_at && role === 'admin' && <button type="button" className="btn-ghost ml-auto !text-chilli" onClick={() => setSub('cancel')}><XCircle size={18} />Cancelar venda</button>}
            </div>
          </div>
        )}
      </Modal>

      {s && (sub === 'payment' || sub === 'refund') && <PaymentModal sale={s} mode={sub} onClose={() => setSub(null)} />}
      {s && sub === 'share' && items.data && pays.data && <ShareModal sale={s} items={items.data} payments={pays.data} onClose={() => setSub(null)} />}
      {sub === 'cancel' && <ConfirmDialog title="Cancelar venda" danger confirmLabel="Cancelar venda" busy={cancel.isPending} askReason="Motivo do cancelamento"
        message="O estoque dos itens será devolvido uma única vez. A venda e os pagamentos continuam no histórico." onConfirm={(r) => cancel.mutate(r)} onClose={() => setSub(null)} />}
      {sub && typeof sub === 'object' && 'reverse' in sub && <ConfirmDialog title="Estornar pagamento" danger confirmLabel="Estornar" busy={reverse.isPending} askReason="Justificativa do estorno"
        message={`Estornar ${formatBRL(sub.reverse.amount_cents)}? O registro não é apagado: fica marcado como estornado, com a justificativa.`}
        onConfirm={(r) => reverse.mutate({ id: sub.reverse.id, reason: r })} onClose={() => setSub(null)} />}
    </>
  )
}
