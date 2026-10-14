import { describe, expect, it } from 'vitest'
import { buildSaleMessage, whatsappLink } from '@/utils/saleMessage'
import type { SaleItem, SaleSummary } from '@/types'

const sale: SaleSummary = {
  id: 's1', company_id: 'c1', sale_number: 12, customer_name: 'Maria Souza', customer_phone: '(27) 99999-0000',
  purchase_date: '2026-10-01', due_date: '2026-10-10', gross_cents: 20000, discount_cents: 2000, net_cents: 18000,
  notes: null, cancelled_at: null, cancel_reason: null, created_at: '', paid_cents: 8000, balance_cents: 10000, status: 'ATRASADO',
}
const items: SaleItem[] = [
  { id: 'i1', sale_id: 's1', product_id: 'p1', quantity: 2, unit_price_cents: 5000, product_name: 'Cueca boxer', size: 'M', brand: 'X', category: 'masculino' },
  { id: 'i2', sale_id: 's1', product_id: 'p2', quantity: 1, unit_price_cents: 10000, product_name: 'Conjunto renda', size: 'G', brand: 'Y', category: 'lingerie' },
]

describe('mensagem de WhatsApp', () => {
  const msg = buildSaleMessage(sale, items)
  it('inclui os dados exigidos', () => {
    for (const t of ['Visual Pimenta', 'Maria', 'nº 12', '01/10/2026', 'Cueca boxer', 'tam. M', '2 x', 'Desconto', 'Já pago', 'Saldo pendente', '10/10/2026', 'ATRASADO'])
      expect(msg).toContain(t)
  })
  it('monta o link com telefone brasileiro e texto codificado', () => {
    const link = whatsappLink('(27) 99999-0000', 'olá & tudo')
    expect(link.startsWith('https://wa.me/5527999990000?text=')).toBe(true)
    expect(link).toContain(encodeURIComponent('olá & tudo'))
  })
  it('não duplica o 55', () => expect(whatsappLink('5527999990000', 'x')).toContain('wa.me/5527999990000'))
})
