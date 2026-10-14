import { supabase } from '@/lib/supabase'
import type { Payment, SaleItem, SaleStatus, SaleSummary } from '@/types'

export interface SaleItemInput { product_id: string; quantity: number }
export interface SalePayload {
  customer_name: string
  customer_phone: string
  purchase_date: string
  due_date: string
  discount_cents: number
  notes: string
  items: SaleItemInput[]
  payment?: { amount_cents: number; method: string; reference?: string; notes?: string }
}

export interface SaleFilters {
  search: string
  status: SaleStatus | ''
  from: string
  to: string
}

export async function listSales(companyId: string, f: SaleFilters, page: number, pageSize = 20) {
  let q = supabase.from('sales_summary').select('*', { count: 'exact' }).eq('company_id', companyId)
  if (f.search.trim()) q = q.ilike('customer_name', `%${f.search.trim().replace(/[%,]/g, '')}%`)
  if (f.status) q = q.eq('status', f.status)
  if (f.from) q = q.gte('purchase_date', f.from)
  if (f.to) q = q.lte('purchase_date', f.to)
  const from = page * pageSize
  const { data, error, count } = await q
    .order('purchase_date', { ascending: false }).order('sale_number', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { rows: data as SaleSummary[], total: count ?? 0 }
}

export async function getSale(id: string): Promise<SaleSummary> {
  const { data, error } = await supabase.from('sales_summary').select('*').eq('id', id).single()
  if (error) throw error
  return data as SaleSummary
}

export async function listSaleItems(saleIds: string[]): Promise<SaleItem[]> {
  if (!saleIds.length) return []
  const { data, error } = await supabase.from('sale_items').select('*').in('sale_id', saleIds)
  if (error) throw error
  return data as SaleItem[]
}

export async function listPayments(saleId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').eq('sale_id', saleId)
    .order('received_at', { ascending: true })
  if (error) throw error
  return data as Payment[]
}

export async function createSale(companyId: string, opId: string, p: SalePayload) {
  const { data, error } = await supabase.rpc('create_sale', { p_company: companyId, p_op: opId, p })
  if (error) throw error
  return data as { sale_id: string; sale_number: number }
}

export async function updateSale(companyId: string, opId: string, saleId: string, p: SalePayload) {
  const { data, error } = await supabase.rpc('update_sale', { p_company: companyId, p_op: opId, p_sale: saleId, p })
  if (error) throw error
  return data as { sale_id: string; credit_cents: number }
}

export async function cancelSale(companyId: string, opId: string, saleId: string, reason: string) {
  const { data, error } = await supabase.rpc('cancel_sale', { p_company: companyId, p_op: opId, p_sale: saleId, p_reason: reason })
  if (error) throw error
  return data as { sale_id: string; refund_due_cents: number }
}

export async function registerPayment(companyId: string, opId: string, a: {
  saleId: string; amountCents: number; method: string; reference?: string; notes?: string; receivedAt?: string
}) {
  const { error } = await supabase.rpc('register_payment', {
    p_company: companyId, p_op: opId, p_sale: a.saleId, p_amount: a.amountCents, p_method: a.method,
    p_reference: a.reference || null, p_notes: a.notes || null, p_received_at: a.receivedAt || null,
  })
  if (error) throw error
}

export async function registerRefund(companyId: string, opId: string, a: {
  saleId: string; amountCents: number; method: string; notes?: string
}) {
  const { error } = await supabase.rpc('register_refund', {
    p_company: companyId, p_op: opId, p_sale: a.saleId, p_amount: a.amountCents, p_method: a.method, p_notes: a.notes || null,
  })
  if (error) throw error
}

export async function reversePayment(companyId: string, opId: string, paymentId: string, reason: string) {
  const { error } = await supabase.rpc('reverse_payment', { p_company: companyId, p_op: opId, p_payment: paymentId, p_reason: reason })
  if (error) throw error
}
