import { formatBRL } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { STATUS_META } from './status'
import type { SaleItem, SaleSummary } from '@/types'

export function buildSaleMessage(sale: SaleSummary, items: SaleItem[], storeName = 'Visual Pimenta'): string {
  const lines: string[] = []
  lines.push(`*${storeName}*`)
  lines.push(`Olá, ${sale.customer_name.split(' ')[0]}! Segue o resumo da sua compra.`)
  lines.push('')
  lines.push(`Venda nº ${sale.sale_number}`)
  lines.push(`Data da compra: ${formatDate(sale.purchase_date)}`)
  lines.push('')
  lines.push('*Produtos*')
  for (const it of items) {
    lines.push(`• ${it.product_name} — tam. ${it.size} — ${it.quantity} x ${formatBRL(it.unit_price_cents)} = ${formatBRL(it.quantity * it.unit_price_cents)}`)
  }
  lines.push('')
  lines.push(`Subtotal: ${formatBRL(sale.gross_cents)}`)
  if (sale.discount_cents > 0) lines.push(`Desconto: -${formatBRL(sale.discount_cents)}`)
  lines.push(`*Total: ${formatBRL(sale.net_cents)}*`)
  lines.push(`Já pago: ${formatBRL(sale.paid_cents)}`)
  lines.push(`Saldo pendente: ${formatBRL(Math.max(sale.balance_cents, 0))}`)
  if (sale.balance_cents > 0) lines.push(`Data prevista para pagamento: ${formatDate(sale.due_date)}`)
  lines.push(`Status: ${STATUS_META[sale.status].label}`)
  lines.push('')
  lines.push('Obrigada pela preferência!')
  return lines.join('\n')
}

/** Telefone para wa.me: acrescenta 55 (Brasil) quando vier só com DDD. */
export function whatsappLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}
