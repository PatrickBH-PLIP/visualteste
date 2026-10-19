import { supabase, IMAGE_BUCKET, newId } from '@/lib/supabase'
import { optimizeImage, extForBlob } from '@/lib/image'
import type { Category, HomeSummary, Movement, Product } from '@/types'

export async function listProducts(companyId: string, category?: Category): Promise<Product[]> {
  let q = supabase.from('products').select('*').eq('company_id', companyId).is('archived_at', null)
  if (category) q = q.eq('category', category)
  const { data, error } = await q.order('name', { ascending: true }).limit(2000)
  if (error) throw error
  return data as Product[]
}

export async function listArchivedProducts(companyId: string): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*')
    .eq('company_id', companyId).not('archived_at', 'is', null)
    .order('archived_at', { ascending: false }).limit(2000)
  if (error) throw error
  return data as Product[]
}

export async function deleteProductPermanently(companyId: string, id: string) {
  const { error } = await supabase.rpc('delete_product_permanently', { p_company: companyId, p_product: id })
  if (error) throw error
}

export async function restoreProduct(id: string) {
  const { error } = await supabase.from('products').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

export async function homeSummary(companyId: string): Promise<HomeSummary> {
  const { data, error } = await supabase.rpc('home_summary', { p_company: companyId })
  if (error) throw error
  return data as HomeSummary
}

export interface ProductPayload {
  id: string
  category: Category
  name: string
  brand: string
  size: string
  material: string
  price_cents: number
  cost_cents: number | null
  quantity: number
  min_stock: number
  sku?: string
  barcode?: string
  supplier?: string
  description?: string
  notes?: string
}

/** Envia a foto (otimizada) para o Storage. Retorna o caminho gravado no banco. */
export async function uploadProductImage(companyId: string, productId: string, file: File, fileKey: string): Promise<string> {
  const blob = await optimizeImage(file)
  const path = `${companyId}/${productId}/${fileKey}.${extForBlob(blob)}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: blob.type, upsert: true, cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

export async function removeImage(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(IMAGE_BUCKET).remove([path]) // melhor esforço: não bloqueia o fluxo
}

/** Cria o produto. op_id estável por formulário => repetir não duplica. */
export async function createProduct(companyId: string, opId: string, payload: ProductPayload, imagePath: string | null) {
  const { data, error } = await supabase.rpc('create_product', {
    p_company: companyId, p_op: opId, p: { ...payload, image_path: imagePath },
  })
  if (error) throw error
  return data as { product_id: string }
}

export interface ProductUpdate {
  category: Category; name: string; brand: string; size: string; material: string
  price_cents: number; cost_cents: number | null; min_stock: number
  sku: string | null; barcode: string | null; supplier: string | null
  description: string | null; notes: string | null; image_path: string | null
}

export async function updateProduct(id: string, patch: ProductUpdate) {
  const { error } = await supabase.from('products').update(patch).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um produto igual (mesmo nome, marca e tamanho) ou o SKU já está em uso.')
    throw error
  }
}

export async function archiveProduct(id: string) {
  const { error } = await supabase.from('products').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function addStock(companyId: string, opId: string, productId: string, qty: number,
  type: 'entrada_manual' | 'devolucao' | 'ajuste', reason: string) {
  const { data, error } = await supabase.rpc('add_stock', {
    p_company: companyId, p_op: opId, p_product: productId, p_qty: qty, p_type: type, p_reason: reason,
  })
  if (error) throw error
  return data as { product_id: string; quantity: number }
}

export async function listMovements(companyId: string, limit = 50): Promise<Movement[]> {
  const { data, error } = await supabase.from('inventory_movements')
    .select('*, products(name, size, brand)').eq('company_id', companyId)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as unknown as Movement[]
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  const out: Record<string, string> = {}
  data.forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl })
  return out
}

export const newOpId = newId
