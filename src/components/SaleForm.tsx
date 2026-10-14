import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/categories'
import { addDays, todayLocal } from '@/lib/dates'
import { centsToInput, formatBRL, parseBRL } from '@/lib/money'
import { errorMessage, newId } from '@/lib/supabase'
import { isValidPhone } from '@/lib/validation'
import { createSale, updateSale, type SalePayload } from '@/services/sales'
import { useCompany } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { ProductPicker, type CartItem } from './ProductPicker'
import { ErrorBanner, Field } from './ui'
import type { SaleItem, SaleSummary } from '@/types'

export interface SaleFormInitial { sale: SaleSummary; items: SaleItem[] }

export function SaleForm({ initial }: { initial?: SaleFormInitial }) {
  const { companyId } = useCompany()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const editing = !!initial
  const today = todayLocal()
  const opId = useRef(newId()) // estável: reenvio/clique duplo não duplica a venda

  const [name, setName] = useState(initial?.sale.customer_name ?? '')
  const [phone, setPhone] = useState(initial?.sale.customer_phone ?? '')
  const [purchase, setPurchase] = useState(initial?.sale.purchase_date ?? today)
  const [due, setDue] = useState(initial?.sale.due_date ?? addDays(today, 7))
  const [notes, setNotes] = useState(initial?.sale.notes ?? '')
  const [hasDiscount, setHasDiscount] = useState((initial?.sale.discount_cents ?? 0) > 0)
  const [discount, setDiscount] = useState(initial && initial.sale.discount_cents > 0 ? centsToInput(initial.sale.discount_cents) : '')
  const [items, setItems] = useState<CartItem[]>(initial?.items.map((i) => ({
    product_id: i.product_id, category: i.category, name: i.product_name, brand: i.brand, size: i.size,
    quantity: i.quantity, unit_price_cents: i.unit_price_cents })) ?? [])
  const [payNow, setPayNow] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('pix')
  const [error, setError] = useState<string | null>(null)

  const gross = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0), [items])
  const discountCents = hasDiscount ? parseBRL(discount) : 0
  const discountErr = hasDiscount && (discountCents === null ? 'Valor inválido' : discountCents > gross ? 'O desconto não pode ser maior que o subtotal' : null)
  const net = gross - (discountCents && !discountErr ? discountCents : 0)

  const addItem = (it: CartItem) => setItems((cur) => {
    const i = cur.findIndex((x) => x.product_id === it.product_id)
    if (i < 0) return [...cur, it]
    const copy = cur.slice(); copy[i] = { ...copy[i], quantity: copy[i].quantity + it.quantity }; return copy
  })

  const payCents = payNow ? parseBRL(payAmount) : 0
  const problems: string[] = []
  if (name.trim().length < 2) problems.push('Informe o nome completo do cliente.')
  if (!isValidPhone(phone)) problems.push('Informe o telefone com DDD.')
  if (due < purchase) problems.push('A data prevista de pagamento não pode ser anterior à compra.')
  if (!items.length) problems.push('Adicione pelo menos um produto.')
  if (discountErr) problems.push(discountErr)
  if (payNow && (!payCents || payCents > net)) problems.push('O pagamento informado é inválido ou maior que o total.')

  const m = useMutation({
    mutationFn: async () => {
      const payload: SalePayload = {
        customer_name: name.trim(), customer_phone: phone.trim(), purchase_date: purchase, due_date: due, notes,
        discount_cents: hasDiscount ? discountCents ?? 0 : 0,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        ...(!editing && payNow && payCents ? { payment: { amount_cents: payCents, method: payMethod } } : {}),
      }
      return editing ? updateSale(companyId, opId.current, initial!.sale.id, payload) : createSale(companyId, opId.current, payload)
    },
    onSuccess: (r) => {
      qc.invalidateQueries()
      if (editing && 'credit_cents' in r && r.credit_cents > 0)
        toast('ok', `Venda atualizada. Há ${formatBRL(r.credit_cents)} pagos a mais — registre a devolução ou o crédito no detalhe da venda.`)
      else toast('ok', editing ? 'Venda atualizada e estoque ajustado.' : 'Venda registrada e estoque atualizado.')
      nav('/vendas')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <form className="space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); setError(null); if (!problems.length) m.mutate() }}>
      {error && <ErrorBanner message={error} />}

      <section className="card grid gap-4 p-4 sm:grid-cols-2">
        <h2 className="text-xl sm:col-span-2">Cliente</h2>
        <Field label="Nome completo *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field label="Telefone com DDD *"><input className="input" inputMode="tel" placeholder="(27) 99999-0000" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Data da compra"><input className="input" type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} /></Field>
        <Field label="Data prevista para pagamento"><input className="input" type="date" min={purchase} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Observações"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Produtos</h2>
        <ProductPicker onAdd={addItem} />
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-tinta/25 p-4 text-center text-sm text-tinta/70">Nenhum produto adicionado ainda. Use “Adicionar produto à compra”.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.product_id} className="card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-[180px] flex-1">
                  <p className="font-semibold" style={{ color: CATEGORIES[i.category].main }}>{i.name}</p>
                  <p className="text-sm text-tinta/70">{CATEGORIES[i.category].label} · {i.brand} · tam. {i.size}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">Qtd.
                  <input className="input !w-20 !py-1.5" type="number" min={1} inputMode="numeric" value={i.quantity}
                    onChange={(e) => { const v = Math.max(1, Math.floor(Number(e.target.value) || 1)); setItems((c) => c.map((x) => x.product_id === i.product_id ? { ...x, quantity: v } : x)) }} />
                </label>
                <p className="w-24 text-right text-sm">{formatBRL(i.unit_price_cents)}</p>
                <p className="w-28 text-right font-semibold">{formatBRL(i.quantity * i.unit_price_cents)}</p>
                <button type="button" className="btn-ghost !text-chilli !px-2" aria-label={`Remover ${i.name}`} onClick={() => setItems((c) => c.filter((x) => x.product_id !== i.product_id))}><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4 p-4">
        <fieldset>
          <legend className="label">Foi aplicado desconto?</legend>
          <div className="flex gap-6">
            {[false, true].map((v) => (
              <label key={String(v)} className="flex items-center gap-2"><input type="radio" name="desc" checked={hasDiscount === v} onChange={() => { setHasDiscount(v); if (!v) setDiscount('') }} />{v ? 'Sim' : 'Não'}</label>
            ))}
          </div>
        </fieldset>
        {hasDiscount && <Field label="Valor do desconto (R$)" error={discountErr ?? undefined}><input className="input sm:max-w-xs" inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>}

        {!editing && (
          <div className="space-y-3 border-t border-tinta/10 pt-3">
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={payNow} onChange={(e) => { setPayNow(e.target.checked); if (e.target.checked && !payAmount) setPayAmount(centsToInput(net)) }} />Cliente já pagou (total ou parte)</label>
            {payNow && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor recebido (R$)"><input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></Field>
                <Field label="Forma de pagamento"><select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
              </div>
            )}
          </div>
        )}

        <dl className="space-y-1 border-t border-tinta/10 pt-3 text-sm">
          <div className="flex justify-between"><dt>Soma dos produtos (bruto)</dt><dd>{formatBRL(gross)}</dd></div>
          <div className="flex justify-between"><dt>Desconto</dt><dd>− {formatBRL(gross - net)}</dd></div>
          <div className="flex justify-between text-lg font-bold"><dt>Valor líquido</dt><dd>{formatBRL(net)}</dd></div>
        </dl>
        <p className="text-xs text-tinta/60">Os valores são conferidos novamente pelo servidor ao confirmar.</p>
      </section>

      {problems.length > 0 && (m.isError || m.isIdle) && <ul className="list-disc space-y-0.5 pl-5 text-sm text-tinta/70">{problems.slice(0, 3).map((p) => <li key={p}>{p}</li>)}</ul>}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="btn-outline" onClick={() => nav('/vendas')} disabled={m.isPending}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={m.isPending || problems.length > 0}>
          {m.isPending ? 'Confirmando…' : editing ? 'Salvar alterações da venda' : 'Confirmar venda'}
        </button>
      </div>
    </form>
  )
}
