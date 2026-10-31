export type Category = 'feminino' | 'masculino' | 'lingerie' | 'sex_shop'
export type Role = 'admin' | 'staff'
export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'transferencia' | 'outra'
export type SaleStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO' | 'CREDITO' | 'CANCELADA'
export type MovementType =
  | 'estoque_inicial' | 'entrada_manual' | 'devolucao' | 'ajuste'
  | 'venda' | 'edicao_venda' | 'cancelamento_venda'

export const SIZES = ['P', 'M', 'G', 'GG', 'EXG', 'G2', 'G3', 'G4', 'G5', 'Único'] as const
export type Size = (typeof SIZES)[number]

export interface Product {
  id: string
  company_id: string
  category: Category
  name: string
  brand: string
  size: Size
  color: string | null
  material: string
  price_cents: number
  cost_cents: number | null
  quantity: number
  min_stock: number
  sku: string | null
  barcode: string | null
  supplier: string | null
  description: string | null
  notes: string | null
  image_path: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface SaleSummary {
  id: string
  company_id: string
  sale_number: number
  customer_name: string
  customer_phone: string
  purchase_date: string
  due_date: string
  gross_cents: number
  discount_cents: number
  net_cents: number
  notes: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  paid_cents: number
  balance_cents: number
  status: SaleStatus
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price_cents: number
  product_name: string
  brand: string
  size: string
  color?: string | null
  category: Category
}

export interface Payment {
  id: string
  sale_id: string
  kind: 'payment' | 'refund'
  amount_cents: number
  method: PaymentMethod
  reference: string | null
  notes: string | null
  received_at: string
  reversed_at: string | null
  reversal_reason: string | null
}

export interface Movement {
  id: string
  product_id: string
  type: MovementType
  quantity_delta: number
  quantity_before: number
  quantity_after: number
  reason: string | null
  created_at: string
  products?: { name: string; size: string; brand: string } | null
}

export interface BalanceReport {
  gross_cents: number
  discount_cents: number
  net_cents: number
  received_cents: number
  pending_cents: number
  sales_count: number
  paid_count: number
  pending_count: number
  late_count: number
  credit_count: number
  avg_ticket_cents: number
  daily: { date: string; sold_cents: number; received_cents: number }[]
  by_category: { category: Category; gross_cents: number; units: number }[]
  top_products: { name: string; brand: string; size: string; units: number; gross_cents: number }[]
  debtors: { customer_name: string; customer_phone: string; balance_cents: number; sales: number }[]
  low_stock: { name: string; brand: string; size: string; quantity: number; min_stock: number; category: Category }[]
}

export interface HomeSummary {
  products: number
  units: number
  low_stock: number
  pending_sales: number
  received_month: number
}
