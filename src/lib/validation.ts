import { z } from 'zod'
import { SIZES } from '@/types'
import { parseBRL } from './money'

const money = (label: string, required = true) =>
  z.string().trim().refine((v) => (v === '' ? !required : parseBRL(v) !== null), `${label} inválido (ex.: 49,90)`)
    .refine((v) => v === '' || (parseBRL(v) ?? 0) >= 0, `${label} não pode ser negativo`)

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto'),
  category: z.enum(['feminino', 'masculino', 'lingerie', 'sex_shop']),
  brand: z.string().trim().min(1, 'Informe a marca'),
  size: z.enum(SIZES, { errorMap: () => ({ message: 'Selecione o tamanho' }) }),
  color: z.string().trim().optional(),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida').optional(),
  material: z.string().trim().min(1, 'Informe o material'),
  quantity: z.coerce.number({ invalid_type_error: 'Informe a quantidade' }).int('Use número inteiro').min(0, 'Não pode ser negativa'),
  price: money('Preço', true).refine((v) => v !== '', 'Informe o preço de venda'),
  cost: money('Custo', false),
  min_stock: z.coerce.number().int().min(0, 'Não pode ser negativo').default(0),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  description: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})
export type ProductFormValues = z.infer<typeof productSchema>

export const phoneDigits = (s: string) => s.replace(/\D/g, '')
export const isValidPhone = (s: string) => {
  const d = phoneDigits(s)
  return d.length >= 10 && d.length <= 13
}
